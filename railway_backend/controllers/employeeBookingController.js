const pool = require('../config/database');
const { calculateFare } = require('../utils/fareCalculator');
const { sendEmployeeBookingEmail } = require('../utils/userEmail'); // ✅ Import employee email function

const bookEmployeeTicket = async (req, res) => {
  try {
    const {
      train_no,
      source_station,
      dest_station,
      class_id,
      journey_date,
      passenger_name,
      passenger_age,
      passenger_gender,
      preferred_seat_type = null,
      is_dependent = false,
      dependent_id = null
    } = req.body;

    const employee_id = req.employee.employee_id;
    const employee_name = req.employee.emp_name;
    const employee_email = req.employee.email; // ✅ Make sure email is available in employee object

    console.log('🎫 Starting employee booking process for:', { 
      employee_id, 
      employee_name,
      passenger_name, 
      is_dependent 
    });

    // ========== 1. ENHANCED VALIDATION ==========
    
    // If booking for self, passenger_name MUST match employee name
    if (!is_dependent && passenger_name !== employee_name) {
      return res.status(400).json({
        success: false,
        error: `When booking for yourself, passenger name must match your employee name. Expected: ${employee_name}, Received: ${passenger_name}`
      });
    }

    let dependent = null;
    
    // If booking for dependent, validate dependent exists and belongs to employee
    if (is_dependent) {
      const [employeeData] = await pool.execute(
        `SELECT e.employee_id, e.emp_name, e.designation, 
                d.dependent_id, d.f_name, d.l_name, d.relation
         FROM employee e
         LEFT JOIN dependent d ON e.employee_id = d.employee_id AND d.dependent_id = ?
         WHERE e.employee_id = ?`,
        [dependent_id, employee_id]
      );

      if (employeeData.length === 0 || !employeeData[0].dependent_id) {
        return res.status(400).json({
          success: false,
          error: 'Dependent not found or does not belong to this employee'
        });
      }

      dependent = employeeData[0];
      const expected_dependent_name = `${dependent.f_name} ${dependent.l_name}`;
      
      // Validate passenger_name matches dependent name
      if (passenger_name !== expected_dependent_name) {
        return res.status(400).json({
          success: false,
          error: `Passenger name must match dependent name. Expected: ${expected_dependent_name}, Received: ${passenger_name}`
        });
      }
    }
    // ========== 2. VALIDATE JOURNEY DATE ==========
    const journeyDate = new Date(journey_date);
    const currentDate = new Date();
    const maxAdvanceDate = new Date();
    maxAdvanceDate.setDate(currentDate.getDate() + 120);

    journeyDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);
    maxAdvanceDate.setHours(0, 0, 0, 0);

    if (journeyDate < currentDate) {
      return res.status(400).json({
        success: false,
        error: 'Cannot book tickets for past dates'
      });
    }

    if (journeyDate > maxAdvanceDate) {
      return res.status(400).json({
        success: false,
        error: `Tickets can only be booked up to 120 days in advance`
      });
    }

    // ========== 3. CHECK MONTHLY QUOTA ==========
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
const [monthlyBookings] = await pool.execute(
  `SELECT COUNT(*) as booking_count 
   FROM employee_booking_history 
   WHERE employee_id = ? 
     AND MONTH(booking_time) = ? 
     AND YEAR(booking_time) = ? 
     AND booking_status != 'cancelled'`,
  [employee_id, currentMonth, currentYear]
);

    const maxQuota = 10;
    if (monthlyBookings[0].booking_count >= maxQuota) {
      return res.status(400).json({
        success: false,
        error: `Monthly booking quota (${maxQuota}) exceeded. Please try again next month.`
      });
    }

    // Generate IDs
    const pnr_no = 'EPNR' + Date.now().toString().slice(-6);
    const allocation_id = 'EALC' + Date.now().toString().slice(-6);
    const booking_history_id = 'EBH' + Date.now().toString().slice(-6);

    // ========== 4. GET FARE (FOR RECORD KEEPING) ==========
    const fareData = await calculateFare(pool, train_no, source_station, dest_station, class_id);
    
    if (!fareData) {
      return res.status(400).json({
        success: false,
        error: 'Cannot calculate fare for this route'
      });
    }

    const fare = parseFloat(fareData.fare);

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let berth_id = null;
      let allocation_status = 'confirmed';
      let waiting_list_position = 0;
      let assigned_seat_type = null;
      let preference_met = false;
      let alternative_provided = false;

      // ========== 5. SMART SEAT ALLOCATION ==========
      const seatAlternatives = {
        'Lower': ['Side Lower', 'Middle', 'Upper', 'Side Upper'],
        'Middle': ['Lower', 'Upper', 'Side Lower', 'Side Upper'],
        'Upper': ['Side Upper', 'Middle', 'Lower', 'Side Lower'],
        'Side Lower': ['Lower', 'Middle', 'Upper', 'Side Upper'],
        'Side Upper': ['Upper', 'Middle', 'Lower', 'Side Lower']
      };

      // Try preferred seat first
      if (preferred_seat_type) {
        const [preferredBerths] = await connection.execute(
          `SELECT b.berth_id, b.seat_type 
           FROM berth b
           WHERE b.class_id = ?
             AND b.seat_type = ?
             AND b.berth_id NOT IN (
               SELECT a.berth_id 
               FROM allocates a 
               JOIN ticket t ON a.pnr_no = t.pnr_no
               WHERE a.class_id = ?
                 AND t.train_no = ?
                 AND t.source_station = ?
                 AND t.destination_station = ?
                 AND DATE(t.date_time) = ?
                 AND a.allocation_status = 'confirmed'
             )
           ORDER BY b.coach_no, b.berth_no 
           LIMIT 1`,
          [class_id, preferred_seat_type, class_id, train_no, source_station, dest_station, journey_date]
        );

        if (preferredBerths.length > 0) {
          berth_id = preferredBerths[0].berth_id;
          assigned_seat_type = preferredBerths[0].seat_type;
          preference_met = true;
        }
      }

      // Try alternatives if preferred not available
      if (!berth_id && preferred_seat_type) {
        const alternatives = seatAlternatives[preferred_seat_type] || ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper'];
        
        for (let alternative of alternatives) {
          const [altBerths] = await connection.execute(
            `SELECT b.berth_id, b.seat_type 
             FROM berth b
             WHERE b.class_id = ?
               AND b.seat_type = ?
               AND b.berth_id NOT IN (
                 SELECT a.berth_id 
                 FROM allocates a 
                 JOIN ticket t ON a.pnr_no = t.pnr_no
                 WHERE a.class_id = ?
                   AND t.train_no = ?
                   AND t.source_station = ?
                   AND t.destination_station = ?
                   AND DATE(t.date_time) = ?
                   AND a.allocation_status = 'confirmed'
               )
             ORDER BY b.coach_no, b.berth_no 
             LIMIT 1`,
            [class_id, alternative, class_id, train_no, source_station, dest_station, journey_date]
          );
          
          if (altBerths.length > 0) {
            berth_id = altBerths[0].berth_id;
            assigned_seat_type = altBerths[0].seat_type;
            alternative_provided = true;
            break;
          }
        }
      }

      // Try any available seat
      if (!berth_id) {
        const [anyBerth] = await connection.execute(
          `SELECT b.berth_id, b.seat_type 
           FROM berth b
           WHERE b.class_id = ?
             AND b.berth_id NOT IN (
               SELECT a.berth_id 
               FROM allocates a 
               JOIN ticket t ON a.pnr_no = t.pnr_no
               WHERE a.class_id = ?
                 AND t.train_no = ?
                 AND t.source_station = ?
                 AND t.destination_station = ?
                 AND DATE(t.date_time) = ?
                 AND a.allocation_status = 'confirmed'
             )
           ORDER BY b.coach_no, b.berth_no 
           LIMIT 1`,
          [class_id, class_id, train_no, source_station, dest_station, journey_date]
        );

        if (anyBerth.length > 0) {
          berth_id = anyBerth[0].berth_id;
          assigned_seat_type = anyBerth[0].seat_type;
        }
      }

      // Check for RAC/Waiting if no berths available
      if (!berth_id) {
        const [racCount] = await connection.execute(
          `SELECT COUNT(*) as rac_count 
           FROM allocates a 
           JOIN ticket t ON a.pnr_no = t.pnr_no
           WHERE a.class_id = ? 
             AND t.train_no = ?
             AND t.source_station = ?
             AND t.destination_station = ?
             AND DATE(t.date_time) = ?
             AND a.allocation_status = 'rac'`,
          [class_id, train_no, source_station, dest_station, journey_date]
        );

        const current_rac = racCount[0]?.rac_count || 0;
        const [totalBerths] = await connection.execute(
          `SELECT COUNT(*) as total FROM berth WHERE class_id = ?`,
          [class_id]
        );
        const total_berths = totalBerths[0]?.total || 0;
        
        if (current_rac < total_berths * 0.1) {
          allocation_status = 'rac';
        } else {
          allocation_status = 'waiting';
          const [waitingCount] = await connection.execute(
            `SELECT COUNT(*) as waiting_count 
             FROM allocates a 
             JOIN ticket t ON a.pnr_no = t.pnr_no
             WHERE a.class_id = ? 
               AND t.train_no = ?
               AND t.source_station = ?
               AND t.destination_station = ?
               AND DATE(t.date_time) = ?
               AND a.allocation_status = 'waiting'`,
            [class_id, train_no, source_station, dest_station, journey_date]
          );
          waiting_list_position = (waitingCount[0]?.waiting_count || 0) + 1;
        }
      }

      // ========== 6. INSERT EMPLOYEE TICKET RECORDS ==========
     // ========== 3. INSERT CORE RECORDS ==========
const ticketStatus = allocation_status === 'confirmed' ? 'confirmed' : 'waiting';

// Insert employee ticket (NOT regular ticket)
await connection.execute(
  `INSERT INTO ticket (pnr_no, train_no, passenger_name, date_time, source_station, 
                      destination_station, status, user_id, employee_id, booking_time, fare)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
  [pnr_no, train_no, passenger_name, journey_date, source_station, dest_station, 
   ticketStatus, null, employee_id, fare]  // user_id = null, employee_id = actual employee
);
// Insert allocation
await connection.execute(
  `INSERT INTO allocates (allocation_id, pnr_no, class_id, berth_id, allocation_status, allocation_time)
   VALUES (?, ?, ?, ?, ?, NOW())`,
  [allocation_id, pnr_no, class_id, berth_id, allocation_status]
);

      // Update class booked_seats for confirmed bookings
      if (allocation_status === 'confirmed') {
        await connection.execute(
          `UPDATE class SET booked_seats = booked_seats + 1 WHERE class_id = ?`,
          [class_id]
        );
      }

      // ========== 7. EMPLOYEE BOOKING HISTORY ==========
      let bookingDetails = '';
let passengerType;
if (!is_dependent) {
  passengerType = `Employee: ${employee_name}`;
} else {
  passengerType = `Dependent: ${passenger_name} (${dependent.relation})`;
}

      if (allocation_status === 'confirmed') {
        bookingDetails = `FREE CONFIRMED booking for ${passengerType}. Train: ${train_no}, Class: ${fareData.class_name}, Seat: ${assigned_seat_type}, Original Fare: ₹${fare} (FREE for employee)`;
      } else if (allocation_status === 'rac') {
        bookingDetails = `FREE RAC booking for ${passengerType}. Train: ${train_no}, Class: ${fareData.class_name}, Original Fare: ₹${fare} (FREE for employee)`;
      } else {
        bookingDetails = `FREE WAITING LIST booking for ${passengerType}. Train: ${train_no}, Class: ${fareData.class_name}, Position: ${waiting_list_position}, Original Fare: ₹${fare} (FREE for employee)`;
      }
await connection.execute(
  `INSERT INTO employee_booking_history (
    booking_id, employee_id, pnr_no, passenger_name, train_no, 
    from_station, to_station, travel_date, class_id, booking_status, booking_time
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
  [
    booking_history_id, 
    employee_id, 
    pnr_no, 
    passenger_name, 
    train_no,
    source_station, 
    dest_station, 
    journey_date, 
    class_id, 
    allocation_status === 'confirmed' ? 'confirmed' : 'waiting'
  ]
);

      await connection.commit();
      connection.release();

      // ========== 8. PREPARE RESPONSE ==========
      const [stations] = await pool.execute(
        `SELECT 
          (SELECT station_name FROM station WHERE station_id = ?) as from_station_name,
          (SELECT station_name FROM station WHERE station_id = ?) as to_station_name`,
        [source_station, dest_station]
      );

      const [classInfo] = await pool.execute(
        `SELECT class_name FROM class WHERE class_id = ?`,
        [class_id]
      );

      let message = '';
      if (allocation_status === 'confirmed') {
        message = `🎉 FREE ticket booked successfully! Your ${assigned_seat_type} berth is confirmed.`;
      } else if (allocation_status === 'rac') {
        message = '🟡 FREE Reservation Against Cancellation (RAC). You have a confirmed journey but no specific berth yet.';
      } else {
        message = `⏳ FREE waiting list booking. Your position: ${waiting_list_position}.`;
      }

      try {
      if (employee_email) {
        // Get station names for email
        const [stations] = await pool.execute(
          `SELECT 
            (SELECT station_name FROM station WHERE station_id = ?) as from_station_name,
            (SELECT station_name FROM station WHERE station_id = ?) as to_station_name`,
          [source_station, dest_station]
        );

        const [classInfo] = await pool.execute(
          `SELECT class_name FROM class WHERE class_id = ?`,
          [class_id]
        );

        await sendEmployeeBookingEmail(employee_email, {
          pnr_no,
          passenger_name,
          employee_name,
          passenger_type: is_dependent ? 'Dependent' : 'Employee',
          train_no,
          from_station: stations[0].from_station_name,
          to_station: stations[0].to_station_name,
          journey_date,
          class_name: classInfo[0]?.class_name,
          seat_type: assigned_seat_type,
          original_fare: fare,
          final_fare: 0,
          status: ticketStatus,
          waiting_list_position: allocation_status === 'waiting' ? waiting_list_position : null
        });
        
        console.log('📧 Employee booking email sent successfully to:', employee_email);
      } else {
        console.log('⚠️ Employee email not found, skipping email');
      }
    } catch (emailError) {
      console.log('⚠️ Employee booking email failed, but booking successful:', emailError.message);
    }
      res.json({
        success: true,
        message: message,
        data: {
          pnr_no,
          passenger_name,
          passenger_type: is_dependent ? 'dependent' : 'employee',
          train_no,
          from_station: stations[0].from_station_name,
          to_station: stations[0].to_station_name,
          journey_date,
          original_fare: fare,
          final_fare: 0,
          status: ticketStatus,
          class_id: class_id,
          class_name: classInfo[0]?.class_name,
          berth_id: berth_id,
          seat_type: assigned_seat_type,
          allocation_status: allocation_status,
          waiting_list_position: allocation_status === 'waiting' ? waiting_list_position : null,
          employee_benefits: {
            free_travel: true,
            monthly_quota_used: monthlyBookings[0].booking_count + 1,
            monthly_quota_remaining: maxQuota - (monthlyBookings[0].booking_count + 1)
          },
          booking_history: {
            history_id: booking_history_id,
            action: 'booked'
          }
        }
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('❌ Employee booking transaction error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Booking failed: ' + error.message 
      });
    }

  } catch (error) {
    console.error('Employee book ticket error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }


};

// Get employee bookings
const getEmployeeBookings = async (req, res) => {
  try {
    const employee_id = req.employee.employee_id;
    const { status } = req.query;

    let query = `
      SELECT et.pnr_no, et.passenger_name, et.train_no, et.source_station, 
             et.destination_station, et.date_time as journey_date, et.status,
             et.original_fare, et.booking_time, et.cancellation_time,
             s1.station_name as from_station_name, 
             s2.station_name as to_station_name,
             c.class_name, a.allocation_status, a.berth_id,
             b.seat_type, d.f_name as dep_f_name, d.l_name as dep_l_name, d.relation
      FROM employee_ticket et
      LEFT JOIN station s1 ON et.source_station = s1.station_id
      LEFT JOIN station s2 ON et.destination_station = s2.station_id
      LEFT JOIN allocates a ON et.pnr_no = a.pnr_no
      LEFT JOIN class c ON a.class_id = c.class_id
      LEFT JOIN berth b ON a.berth_id = b.berth_id
      LEFT JOIN dependent d ON et.dependent_id = d.dependent_id
      WHERE et.employee_id = ?
    `;

    const params = [employee_id];

    if (status && status !== 'all') {
      query += ' AND et.status = ?';
      params.push(status);
    }

    query += ' ORDER BY et.booking_time DESC';

    const [bookings] = await pool.execute(query, params);

    res.json({
      success: true,
      data: bookings
    });

  } catch (error) {
    console.error('Get employee bookings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get specific booking details
const getBookingDetails = async (req, res) => {
  try {
    const { pnr_no } = req.params;
    const employee_id = req.employee.employee_id;

    const [booking] = await pool.execute(
      `SELECT t.*, s1.station_name as from_station_name, s2.station_name as to_station_name,
              c.class_name, a.allocation_status, a.berth_id, b.seat_type, b.coach_no, b.berth_no
       FROM ticket t
       LEFT JOIN station s1 ON t.source_station = s1.station_id
       LEFT JOIN station s2 ON t.destination_station = s2.station_id
       LEFT JOIN allocates a ON t.pnr_no = a.pnr_no
       LEFT JOIN class c ON a.class_id = c.class_id
       LEFT JOIN berth b ON a.berth_id = b.berth_id
       WHERE t.pnr_no = ? AND t.employee_id = ?`,
      [pnr_no, employee_id]
    );

    if (booking.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: booking[0]
    });

  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  bookEmployeeTicket,
  getEmployeeBookings,
  getBookingDetails
};
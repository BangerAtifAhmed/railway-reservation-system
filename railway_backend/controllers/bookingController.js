// controllers/bookingController.js


const pool = require('../config/database');

const { calculateFare } = require('../utils/fareCalculator');
const { sendUserBookingEmail, sendUserCancellationEmail } = require('../utils/userEmail'); 
const bookTicket = async (req, res) => {
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
      payment_mode,
      preferred_seat_type = null
    } = req.body;

    const user_id = req.user.user_id;

    // ========== 0. VALIDATE JOURNEY DATE (120-DAY ADVANCE BOOKING) ==========
    const journeyDate = new Date(journey_date);
    const currentDate = new Date();
    const maxAdvanceDate = new Date();
    maxAdvanceDate.setDate(currentDate.getDate() + 120); // 120 days from today

    // Reset time part for accurate date comparison
    journeyDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);
    maxAdvanceDate.setHours(0, 0, 0, 0);

    console.log('📅 Date validation:', {
      journey_date: journeyDate.toISOString().split('T')[0],
      current_date: currentDate.toISOString().split('T')[0],
      max_advance_date: maxAdvanceDate.toISOString().split('T')[0]
    });

    // Validate journey date
    if (journeyDate < currentDate) {
      return res.status(400).json({
        success: false,
        error: 'Cannot book tickets for past dates. Please select a future date.'
      });
    }

    if (journeyDate > maxAdvanceDate) {
      return res.status(400).json({
        success: false,
        error: `Tickets can only be booked up to 120 days in advance. Maximum booking date is ${maxAdvanceDate.toISOString().split('T')[0]}.`
      });
    }

    // Generate IDs
    const pnr_no = 'PNR' + Date.now().toString().slice(-6);
    const allocation_id = 'ALC' + Date.now().toString().slice(-6);
    const transaction_id = 'TXN' + Date.now().toString().slice(-6);
    const booking_history_id = 'BH' + Date.now().toString().slice(-6);
    const transaction_history_id = 'TH' + Date.now().toString().slice(-6);

    console.log('🎫 Starting booking process for:', {
      train_no, class_id, journey_date, passenger_name, preferred_seat_type
    });

    // ========== 1. GET CONSISTENT FARE ==========
    const fareData = await calculateFare(pool, train_no, source_station, dest_station, class_id);
    
    if (!fareData) {
      return res.status(400).json({
        success: false,
        error: 'Cannot calculate fare for this route'
      });
    }

    const fare = parseFloat(fareData.fare);
    console.log('💰 Consistent fare:', fare);

    // Validate payment mode
    const validPaymentModes = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'];
    if (!payment_mode || !validPaymentModes.includes(payment_mode)) {
      return res.status(400).json({
        success: false,
        error: 'Valid payment_mode is required'
      });
    }

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

      // ========== 2. SMART SEAT ALLOCATION WITH PREFERENCE HANDLING ==========
      
      // Define smart alternatives for each seat type
      const seatAlternatives = {
        'Lower': ['Side Lower', 'Middle', 'Upper', 'Side Upper'],
        'Middle': ['Lower', 'Upper', 'Side Lower', 'Side Upper'],
        'Upper': ['Side Upper', 'Middle', 'Lower', 'Side Lower'],
        'Side Lower': ['Lower', 'Middle', 'Upper', 'Side Upper'],
        'Side Upper': ['Upper', 'Middle', 'Lower', 'Side Lower']
      };

      // Try preferred seat first (if specified)
      if (preferred_seat_type && ['Lower','Middle','Upper','Side Lower','Side Upper'].includes(preferred_seat_type)) {
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
          console.log('✅ Preferred seat allocated:', { berth_id, seat_type: assigned_seat_type });
        }
      }

      // If preferred seat not available, try alternatives
      if (!berth_id && preferred_seat_type) {
        console.log(`⚠️ Preferred ${preferred_seat_type} not available, finding alternatives...`);
        
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
            console.log(`✅ Alternative seat allocated: ${assigned_seat_type} (instead of ${preferred_seat_type})`);
            break;
          }
        }
      }

      // If still no berth (no preference or no alternatives), try any available seat
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
          console.log(`✅ Any available seat allocated: ${assigned_seat_type}`);
        }
      }

      // If no berths available at all, check for RAC/Waiting
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
        
        if (current_rac < total_berths * 0.1) { // 10% RAC quota
          allocation_status = 'rac';
          console.log('🟡 RAC assigned');
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
          console.log('⏳ Waiting list position:', waiting_list_position);
        }
      }

      // ========== 3. INSERT CORE RECORDS ==========
      const ticketStatus = allocation_status === 'confirmed' ? 'confirmed' : 'waiting';
      
      // Insert ticket
      await connection.execute(
        `INSERT INTO ticket (pnr_no, train_no, passenger_name, date_time, source_station, 
                          destination_station, status, user_id, booking_time, fare)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [pnr_no, train_no, passenger_name, journey_date, source_station, dest_station, ticketStatus, user_id, fare]
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

      // ========== 4. PAYMENT RECORDS ==========
      await connection.execute(
        `INSERT INTO payment (transaction_id, pnr_no, user_id, amount, type, mode, status, transaction_date)
         VALUES (?, ?, ?, ?, 'payment', ?, 'success', NOW())`,
        [transaction_id, pnr_no, user_id, fare, payment_mode]
      );

      // ========== 5. USER BOOKING HISTORY ==========
      let bookingDetails = '';
      let seatInfo = '';
      
      if (preference_met) {
        seatInfo = `Seat: ${assigned_seat_type} (Preferred)`;
      } else if (alternative_provided) {
        seatInfo = `Seat: ${assigned_seat_type} (Alternative for ${preferred_seat_type})`;
      } else if (assigned_seat_type) {
        seatInfo = `Seat: ${assigned_seat_type}`;
      }

      if (allocation_status === 'confirmed') {
        bookingDetails = `CONFIRMED booking for ${passenger_name}. Train: ${train_no}, Class: ${fareData.class_name}, ${seatInfo}, Fare: ₹${fare}`;
      } else if (allocation_status === 'rac') {
        bookingDetails = `RAC booking for ${passenger_name}. Train: ${train_no}, Class: ${fareData.class_name}, Fare: ₹${fare}. Waiting for berth confirmation.`;
      } else {
        bookingDetails = `WAITING LIST booking for ${passenger_name}. Train: ${train_no}, Class: ${fareData.class_name}, Position: ${waiting_list_position}, Fare: ₹${fare}`;
      }

      await connection.execute(
        `INSERT INTO user_booking_history (history_id, user_id, pnr_no, action, action_time, details)
         VALUES (?, ?, ?, 'booked', NOW(), ?)`,
        [booking_history_id, user_id, pnr_no, bookingDetails]
      );

      // ========== 6. USER TRANSACTION HISTORY ==========
      let transactionDescription = '';
      if (allocation_status === 'confirmed') {
        if (preference_met) {
          transactionDescription = `Payment for CONFIRMED ticket ${pnr_no}. Preferred ${assigned_seat_type} berth allocated.`;
        } else if (alternative_provided) {
          transactionDescription = `Payment for CONFIRMED ticket ${pnr_no}. ${assigned_seat_type} berth allocated (alternative for ${preferred_seat_type}).`;
        } else {
          transactionDescription = `Payment for CONFIRMED ticket ${pnr_no}. ${assigned_seat_type} berth allocated.`;
        }
      } else if (allocation_status === 'rac') {
        transactionDescription = `Payment for RAC ticket ${pnr_no}. Reservation Against Cancellation - berth not allocated yet.`;
      } else {
        transactionDescription = `Payment for WAITING LIST ticket ${pnr_no}. Position: ${waiting_list_position}. Will be confirmed when berth available.`;
      }

      await connection.execute(
        `INSERT INTO user_transaction_history (transaction_history_id, user_id, pnr_no, transaction_id, 
                                         transaction_type, amount, transaction_time, status, description)
         VALUES (?, ?, ?, ?, 'payment', ?, NOW(), 'success', ?)`,
        [transaction_history_id, user_id, pnr_no, transaction_id, fare, transactionDescription]
      );

      // Commit transaction
      await connection.commit();
      connection.release();

      // ========== 7. GET RESPONSE DATA ==========
      // Get station names
      const [stations] = await pool.execute(
        `SELECT 
          (SELECT station_name FROM station WHERE station_id = ?) as from_station_name,
          (SELECT station_name FROM station WHERE station_id = ?) as to_station_name`,
        [source_station, dest_station]
      );

      // Get class name
      const [classInfo] = await pool.execute(
        `SELECT class_name FROM class WHERE class_id = ?`,
        [class_id]
      );

      console.log('🎉 Booking process completed. Status:', allocation_status);
      try {
      const [userData] = await pool.execute(
        'SELECT email FROM user WHERE user_id = ?',
        [user_id]
      );
      
      if (userData.length > 0 && userData[0].email) {
        // ✅ Now use the imported function directly
        await sendUserBookingEmail(userData[0].email, {
          pnr_no,
          passenger_name,
          train_no,
          from_station: stations[0].from_station_name,
          to_station: stations[0].to_station_name,
          journey_date,
          class_name: classInfo[0]?.class_name,
          seat_type: assigned_seat_type,
          fare: fare,
          status: ticketStatus
        });
      }
    } catch (emailError) {
      console.log('⚠️ Email sending failed, but booking successful');
    }

console.log('🎉 Booking process completed. Status:', allocation_status);
      // ========== 8. PREPARE RESPONSE ==========
      let message = '';
      if (allocation_status === 'confirmed') {
        if (preference_met) {
          message = `🎉 Ticket booked successfully! Your preferred ${assigned_seat_type} berth is confirmed.`;
        } else if (alternative_provided) {
          message = `🎉 Ticket booked successfully! Your ${assigned_seat_type} berth is confirmed. (${preferred_seat_type} was not available)`;
        } else {
          message = `🎉 Ticket booked successfully! Your ${assigned_seat_type} berth is confirmed.`;
        }
      } else if (allocation_status === 'rac') {
        message = '🟡 Reservation Against Cancellation (RAC). You have a confirmed journey but no specific berth yet.';
      } else {
        message = `⏳ Added to waiting list. Your position: ${waiting_list_position}. You will be automatically confirmed when a seat becomes available.`;
      }

      const response = {
        success: true,
        message: message,
        data: {
          pnr_no,
          passenger_name,
          train_no,
          from_station: stations[0].from_station_name,
          to_station: stations[0].to_station_name,
          journey_date,
          fare: fare,
          status: ticketStatus,
          class_id: class_id,
          class_name: classInfo[0]?.class_name,
          berth_id: berth_id,
          seat_type: assigned_seat_type,
          allocation_status: allocation_status,
          waiting_list_position: allocation_status === 'waiting' ? waiting_list_position : null,
          preference_info: {
            preferred_seat: preferred_seat_type,
            preference_met: preference_met,
            alternative_provided: alternative_provided
          },
          booking_history: {
            history_id: booking_history_id,
            action: 'booked',
            details: bookingDetails
          },
          transaction_history: {
            transaction_history_id: transaction_history_id,
            transaction_type: 'payment',
            amount: fare,
            description: transactionDescription
          },
          payment: {
            transaction_id,
            amount_paid: fare,
            payment_mode,
            payment_status: 'success'
          }
        }
      };

      res.json(response);

    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('❌ Booking transaction error:', error);
      throw error;
    }

  } catch (error) {
    console.error('Book ticket error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};


const getBookingHistory = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    console.log(`📋 Fetching booking history for user: ${user_id}`);

    // Simplified query focusing on user_booking_history with essential booking info
    const [bookings] = await pool.execute(
      `SELECT 
        ubh.history_id,
        ubh.pnr_no,
        ubh.action as booking_action,
        ubh.action_time as booking_time,
        ubh.details as booking_details,
        t.passenger_name,
        t.train_no,
        t.date_time as journey_date,
        t.status as ticket_status,
        src.station_name as from_station,
        dest.station_name as to_station,
        a.allocation_status,
        c.class_name,
        p.amount as fare,
        p.mode as payment_mode,
        p.status as payment_status
      FROM user_booking_history ubh
      LEFT JOIN ticket t ON ubh.pnr_no = t.pnr_no
      LEFT JOIN station src ON t.source_station = src.station_id
      LEFT JOIN station dest ON t.destination_station = dest.station_id
      LEFT JOIN allocates a ON ubh.pnr_no = a.pnr_no
      LEFT JOIN class c ON a.class_id = c.class_id
      LEFT JOIN payment p ON ubh.pnr_no = p.pnr_no
      WHERE ubh.user_id = ?
      ORDER BY ubh.action_time DESC`,
      [user_id]
    );

    console.log(`✅ Found ${bookings.length} booking records for user ${user_id}`);

    // Format the response in a more organized way
    const formattedBookings = bookings.map(booking => ({
      // Core booking history info
      history_id: booking.history_id,
      pnr_no: booking.pnr_no,
      booking_action: booking.booking_action,
      booking_time: booking.booking_time,
      booking_details: booking.booking_details,
      
      // Passenger and journey info
      passenger_info: {
        passenger_name: booking.passenger_name,
        train_no: booking.train_no,
        journey_date: booking.journey_date,
        route: `${booking.from_station} → ${booking.to_station}`
      },
      
      // Status info
      status: {
        ticket_status: booking.ticket_status,
        allocation_status: booking.allocation_status,
        payment_status: booking.payment_status
      },
      
      // Class and fare info
      travel_info: {
        class_name: booking.class_name,
        fare: booking.fare,
        payment_mode: booking.payment_mode
      }
    }));

    res.json({
      success: true,
      data: {
        user_id: user_id,
        total_bookings: bookings.length,
        bookings: formattedBookings
      }
    });

  } catch (error) {
    console.error('❌ Get booking history error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch booking history',
      details: error.message 
    });
  }
};

const getBookingByPnr = async (req, res) => {
  try {
    const { pnr_no } = req.params;
    const user_id = req.user.user_id;

    console.log(`🔍 Fetching complete booking details for PNR: ${pnr_no}`);

    if (!pnr_no) {
      return res.status(400).json({
        success: false,
        error: 'PNR number is required'
      });
    }

    const [bookings] = await pool.execute(
      `SELECT 
        -- Ticket basic info
        t.pnr_no,
        t.passenger_name,
        t.train_no,
        DATE(t.date_time) as journey_date,
        t.booking_time,
        t.status as ticket_status,
        t.cancellation_time,
        t.refund_amount,
        
        -- Station info
        src.station_name as source_station_name,
        dest.station_name as destination_station_name,
        
        -- Allocation & seat info
        a.allocation_id,
        a.allocation_status,
        a.allocation_time,
        a.class_id,
        a.berth_id,
        c.class_name,
        
        -- Berth details (if allocated)
        b.coach_no,
        b.berth_no,
        b.seat_type,
        
        -- Payment info
        p.transaction_id,
        p.amount as fare,
        p.mode as payment_mode,
        p.status as payment_status,
        p.transaction_date as payment_date

      FROM ticket t
      LEFT JOIN station src ON t.source_station = src.station_id
      LEFT JOIN station dest ON t.destination_station = dest.station_id
      LEFT JOIN allocates a ON t.pnr_no = a.pnr_no
      LEFT JOIN class c ON a.class_id = c.class_id
      LEFT JOIN berth b ON a.berth_id = b.berth_id
      LEFT JOIN payment p ON t.pnr_no = p.pnr_no
      WHERE t.pnr_no = ? AND t.user_id = ?
      LIMIT 1`,
      [pnr_no, user_id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found or you do not have permission to view this ticket'
      });
    }

    const booking = bookings[0];
    
    // Get waiting list position if applicable
    let waiting_list_position = null;
    let total_waiting_in_class = null;
    
    if (booking.allocation_status === 'waiting') {
      const [waitingData] = await pool.execute(
        `SELECT 
          (SELECT COUNT(*) + 1 
           FROM allocates a2 
           WHERE a2.class_id = ? 
           AND a2.allocation_status = 'waiting' 
           AND a2.allocation_time < ?
           AND a2.berth_id IS NULL) as waiting_position,
          (SELECT COUNT(*) 
           FROM allocates a3 
           WHERE a3.class_id = ? 
           AND a3.allocation_status = 'waiting'
           AND a3.berth_id IS NULL) as total_waiting`,
        [booking.class_id, booking.allocation_time, booking.class_id]
      );
      
      if (waitingData.length > 0) {
        waiting_list_position = waitingData[0].waiting_position;
        total_waiting_in_class = waitingData[0].total_waiting;
      }
    }

    // Get latest booking history
    const [latestHistory] = await pool.execute(
      `SELECT action, action_time, details 
       FROM user_booking_history 
       WHERE pnr_no = ? 
       ORDER BY action_time DESC 
       LIMIT 1`,
      [pnr_no]
    );

    // Get payment transaction history
    const [paymentHistory] = await pool.execute(
      `SELECT transaction_history_id, transaction_time, status, description, amount 
       FROM user_transaction_history 
       WHERE pnr_no = ? AND transaction_type = 'payment'
       ORDER BY transaction_time DESC 
       LIMIT 1`,
      [pnr_no]
    );

    // Determine overall status with emojis and descriptions
    let overall_status = '';
    let status_emoji = '';
    let status_description = '';
    
    if (booking.ticket_status === 'cancelled') {
      overall_status = 'CANCELLED';
      status_emoji = '❌';
      const cancelTime = booking.cancellation_time ? new Date(booking.cancellation_time).toLocaleString() : 'Unknown time';
      status_description = `Ticket was cancelled on ${cancelTime}`;
      if (booking.refund_amount) {
        status_description += `. Refund: ₹${booking.refund_amount}`;
      }
    } else if (booking.allocation_status === 'confirmed') {
      overall_status = 'CONFIRMED';
      status_emoji = '✅';
      status_description = `Seat confirmed in ${booking.class_name}`;
      if (booking.coach_no && booking.berth_no) {
        status_description += `. Coach ${booking.coach_no}, Berth ${booking.berth_no}`;
        if (booking.seat_type) {
          status_description += ` (${booking.seat_type})`;
        }
      }
    } else if (booking.allocation_status === 'rac') {
      overall_status = 'RAC';
      status_emoji = '🟡';
      status_description = 'Reservation Against Cancellation - Berth will be allocated before journey';
    } else if (booking.allocation_status === 'waiting') {
      overall_status = 'WAITING LIST';
      status_emoji = '⏳';
      status_description = `Waiting list position: ${waiting_list_position || 'Unknown'}`;
      if (total_waiting_in_class > 0) {
        status_description += ` out of ${total_waiting_in_class} waiting`;
      }
    } else {
      overall_status = 'UNKNOWN';
      status_emoji = '❓';
      status_description = 'Ticket status could not be determined';
    }

    // Format the response
    const formattedResponse = {
      success: true,
      data: {
        // Basic ticket info
        pnr_no: booking.pnr_no,
        passenger_name: booking.passenger_name,
        train_no: booking.train_no,
        
        // Journey details
        journey: {
          from_station: booking.source_station_name,
          to_station: booking.destination_station_name,
          journey_date: booking.journey_date, // Now correctly formatted as DATE only
          class: {
            class_id: booking.class_id,
            class_name: booking.class_name
          }
        },
        
        // Status information
        status: {
          overall: `${status_emoji} ${overall_status}`,
          description: status_description,
          ticket_status: booking.ticket_status,
          allocation_status: booking.allocation_status,
          payment_status: booking.payment_status
        },
        
        // Seat allocation details
        seat_allocation: booking.allocation_status === 'confirmed' && booking.coach_no ? {
          coach_no: booking.coach_no,
          berth_no: booking.berth_no,
          berth_id: booking.berth_id,
          seat_type: booking.seat_type,
          allocation_id: booking.allocation_id
        } : null,
        
        // RAC information
        rac: booking.allocation_status === 'rac' ? {
          status: 'Reservation Against Cancellation',
          description: 'You have a confirmed journey but berth will be allocated later'
        } : null,
        
        // Waiting list information
        waiting_list: booking.allocation_status === 'waiting' ? {
          current_position: waiting_list_position,
          total_waiting: total_waiting_in_class,
          chances: waiting_list_position <= 5 ? 'HIGH' : 
                  waiting_list_position <= 10 ? 'MEDIUM' : 'LOW'
        } : null,
        
        // Payment information
        payment: {
          transaction_id: booking.transaction_id,
          amount: booking.fare,
          payment_mode: booking.payment_mode,
          payment_status: booking.payment_status,
          payment_date: booking.payment_date
        },
        
        // Booking timeline
        timeline: {
          booking_time: booking.booking_time,
          allocation_time: booking.allocation_time,
          last_action: latestHistory.length > 0 ? {
            action: latestHistory[0].action,
            time: latestHistory[0].action_time,
            details: latestHistory[0].details
          } : null,
          cancellation_time: booking.cancellation_time
        },
        
        // Financial details
        financial: {
          fare_paid: booking.fare,
          refund_amount: booking.refund_amount,
          net_amount: booking.refund_amount ? 
            parseFloat(booking.fare) - parseFloat(booking.refund_amount) : 
            parseFloat(booking.fare)
        }
      }
    };

    console.log(`✅ Found booking for PNR: ${pnr_no} - Status: ${overall_status}`);
    
    res.json(formattedResponse);

  } catch (error) {
    console.error('❌ Get booking by PNR error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch booking details',
      details: error.message 
    });
  }
};

const cancelTicket = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { pnr_no } = req.body;
    const user_id = req.user.user_id;

    console.log('🗑️ Starting cancellation with waiting list promotion for PNR:', pnr_no);

    await connection.beginTransaction();

    // ========== 1. GET TICKET BEING CANCELLED ==========
    const [cancellingTickets] = await connection.execute(
      `SELECT t.pnr_no, t.passenger_name, a.berth_id, a.class_id, t.fare as paid_amount,
              t.train_no, t.source_station, t.destination_station, t.date_time as journey_date,
              p.transaction_id as original_transaction_id
       FROM ticket t
       JOIN allocates a ON t.pnr_no = a.pnr_no
       LEFT JOIN payment p ON t.pnr_no = p.pnr_no AND p.type = 'payment'
       WHERE t.pnr_no = ? AND t.user_id = ? AND t.status != 'cancelled'
       LIMIT 1`,
      [pnr_no, user_id]
    );

    if (cancellingTickets.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ 
        success: false, 
        error: 'Ticket not found or already cancelled' 
      });
    }

    const cancellingTicket = cancellingTickets[0];
    const refund_amount = Math.round(cancellingTicket.paid_amount * 0.85 * 100) / 100;
    const cancel_history_id = 'CH' + Date.now().toString().slice(-6);

    console.log('🎫 Cancelling ticket:', {
      pnr: cancellingTicket.pnr_no,
      class: cancellingTicket.class_id,
      berth: cancellingTicket.berth_id,
      journey_date: cancellingTicket.journey_date,
      original_transaction: cancellingTicket.original_transaction_id
    });

    // ========== 2. CHECK FOR WAITING LIST USERS ==========
    let waiting_list_promoted = null;
    let freed_berth_id = null;
    let waiting_list_updates = [];

    // Only process berth if it's not NULL (waiting list/RAC tickets have NULL berth_id)
    if (cancellingTicket.berth_id) {
      freed_berth_id = cancellingTicket.berth_id;

      console.log('✅ Freeing berth for reallocation:', freed_berth_id);

      // ========== 3. GET ALL ACTIVE WAITING LIST USERS IN ORDER ==========
      const [allWaitingUsers] = await connection.execute(
        `SELECT 
          a.pnr_no, 
          a.allocation_id, 
          t.passenger_name, 
          t.user_id, 
          a.allocation_time,
          (@position := @position + 1) as current_position
         FROM allocates a
         JOIN ticket t ON a.pnr_no = t.pnr_no
         CROSS JOIN (SELECT @position := 0) as vars
         WHERE a.class_id = ? 
           AND a.allocation_status = 'waiting' 
           AND a.berth_id IS NULL
           AND t.status = 'confirmed'
           AND t.train_no = ?
           AND t.source_station = ?
           AND t.destination_station = ?
           AND DATE(t.date_time) = ?
         ORDER BY a.allocation_time ASC`,
        [
          cancellingTicket.class_id,
          cancellingTicket.train_no,
          cancellingTicket.source_station,
          cancellingTicket.destination_station,
          cancellingTicket.journey_date
        ]
      );

      console.log('⏳ Total active waiting list users found:', allWaitingUsers.length);
      
      if (allWaitingUsers.length > 0) {
        const firstWaitingUser = allWaitingUsers[0];
        const currentPosition = firstWaitingUser.current_position;
        
        console.log('🚀 Promoting first waiting list user:', firstWaitingUser.pnr_no, 'from position:', currentPosition);

        // ========== 4. PROMOTE FIRST WAITING LIST USER ==========
        await connection.execute(
          `UPDATE allocates 
           SET allocation_status = 'confirmed', berth_id = ?, allocation_time = NOW()
           WHERE allocation_id = ? AND pnr_no = ?`,
          [freed_berth_id, firstWaitingUser.allocation_id, firstWaitingUser.pnr_no]
        );

        // Update class booked_seats count
        await connection.execute(
          `UPDATE class SET booked_seats = booked_seats + 1 WHERE class_id = ?`,
          [cancellingTicket.class_id]
        );

        // Add promotion notification to booking history
        const promotion_history_id = 'PH' + Date.now().toString().slice(-6);
        await connection.execute(
          `INSERT INTO user_booking_history (history_id, user_id, pnr_no, action, action_time, details)
           VALUES (?, ?, ?, 'modified', NOW(), ?)`,
          [promotion_history_id, firstWaitingUser.user_id, firstWaitingUser.pnr_no,
           `🎉 UPGRADED from Waiting List to CONFIRMED! Position ${currentPosition} → CONFIRMED. Berth: ${freed_berth_id}`]
        );

        waiting_list_promoted = {
          pnr_no: firstWaitingUser.pnr_no,
          passenger_name: firstWaitingUser.passenger_name,
          berth_id: freed_berth_id,
          allocation_id: firstWaitingUser.allocation_id,
          previous_position: currentPosition
        };

        console.log('✅ Waiting list promotion successful:', waiting_list_promoted);

        // ========== 5. UPDATE REMAINING WAITING LIST POSITIONS ==========
        const remainingUsers = allWaitingUsers.slice(1);
        console.log(`🔄 ${remainingUsers.length} remaining waiting list users to update`);

        // Update booking history for remaining waiting list users with new positions
        for (let i = 0; i < remainingUsers.length; i++) {
          const user = remainingUsers[i];
          const new_position = i + 1;
          const old_position = user.current_position;
          const update_history_id = 'UH' + Date.now().toString().slice(-6) + i;
          
          await connection.execute(
            `INSERT INTO user_booking_history (history_id, user_id, pnr_no, action, action_time, details)
             VALUES (?, ?, ?, 'modified', NOW(), ?)`,
            [update_history_id, user.user_id, user.pnr_no,
             `Waiting list position improved: ${old_position} → ${new_position}`]
          );

          waiting_list_updates.push({
            pnr_no: user.pnr_no,
            passenger_name: user.passenger_name,
            old_position: old_position,
            new_position: new_position
          });
        }

        console.log('✅ Waiting list positions updated:', waiting_list_updates.length, 'users affected');

      } else {
        console.log('ℹ️ No waiting list users to promote');
      }
    } else {
      console.log('ℹ️ Cancelling waiting list/RAC ticket, no berth to free');
    }

    // ========== 6. UPDATE CANCELLED TICKET ==========
    await connection.execute(
      `UPDATE ticket SET status = 'cancelled', cancellation_time = NOW(), refund_amount = ? 
       WHERE pnr_no = ? AND user_id = ?`,
      [refund_amount, pnr_no, user_id]
    );

    await connection.execute(
      `UPDATE allocates SET allocation_status = 'cancelled' WHERE pnr_no = ?`,
      [pnr_no]
    );

    // Update class booked_seats count for confirmed cancellations
    if (cancellingTicket.berth_id) {
      await connection.execute(
        `UPDATE class SET booked_seats = booked_seats - 1 WHERE class_id = ?`,
        [cancellingTicket.class_id]
      );
    }

    console.log('✅ Cancelled ticket updated');

    // ========== 7. ADD REFUND TRANSACTION - FIXED ==========
    const refund_history_id = 'RH' + Date.now().toString().slice(-6);
    
    // Use the original transaction_id from payment table to satisfy foreign key constraint
    await connection.execute(
      `INSERT INTO user_transaction_history (transaction_history_id, user_id, pnr_no, transaction_id, 
                                       transaction_type, amount, transaction_time, status, description)
       VALUES (?, ?, ?, ?, 'refund', ?, NOW(), 'success', ?)`,
      [refund_history_id, user_id, pnr_no, cancellingTicket.original_transaction_id, refund_amount,
       `Refund for cancelled ticket ${pnr_no}. Original amount: ₹${cancellingTicket.paid_amount}, Refund: ₹${refund_amount} (85%)`]
    );

    // ========== 8. ADD CANCELLATION HISTORY ==========
    await connection.execute(
      `INSERT INTO user_booking_history (history_id, user_id, pnr_no, action, action_time, details)
       VALUES (?, ?, ?, 'cancelled', NOW(), ?)`,
      [cancel_history_id, user_id, pnr_no,
       `Ticket cancelled. Refund: ₹${refund_amount}. ` +
       (waiting_list_promoted 
         ? `Waiting list user ${waiting_list_promoted.pnr_no} (position ${waiting_list_promoted.previous_position}) promoted to berth ${freed_berth_id}. ${waiting_list_updates.length} users had their waiting positions improved.`
         : (freed_berth_id ? `Berth ${freed_berth_id} freed up.` : 'No berth to free.'))]
    );

    // Commit transaction
    await connection.commit();
    connection.release();

    console.log('🎉 Cancellation with waiting list processing completed');

    res.json({
      success: true,
      message: waiting_list_promoted 
        ? `Ticket cancelled successfully. Waiting list user ${waiting_list_promoted.passenger_name} (position ${waiting_list_promoted.previous_position}) has been promoted! ${waiting_list_updates.length} other users had their waiting positions improved. Refund: ₹${refund_amount}`
        : `Ticket cancelled successfully. Refund: ₹${refund_amount}`,
      data: {
        pnr_no,
        original_amount: cancellingTicket.paid_amount,
        refund_amount,
        cancellation_time: new Date().toISOString(),
        berth_freed: !!freed_berth_id,
        waiting_list_promoted: waiting_list_promoted,
        waiting_list_updates: waiting_list_updates,
        refund_transaction_id: cancellingTicket.original_transaction_id // Using original transaction ID
      }
    });
    // ✅ ADD EMAIL FUNCTIONALITY - Send cancellation email
// ✅ ADD EMAIL FUNCTIONALITY - Send cancellation email (optimized)
try {
  const [userData] = await pool.execute(
    'SELECT email FROM user WHERE user_id = ?',
    [user_id]
  );
  
  if (userData.length > 0 && userData[0].email) {
    // ✅ Import at top level to avoid repeated requires
    const { sendUserCancellationEmail } = require('../utils/userEmail');
    
    // Get station names for better email content
    const [stationData] = await pool.execute(
      `SELECT 
        (SELECT station_name FROM station WHERE station_id = ?) as from_station_name,
        (SELECT station_name FROM station WHERE station_id = ?) as to_station_name`,
      [cancellingTicket.source_station, cancellingTicket.destination_station]
    );

    await sendUserCancellationEmail(userData[0].email, {
      pnr_no,
      passenger_name: cancellingTicket.passenger_name,
      train_no: cancellingTicket.train_no,
      from_station: stationData[0]?.from_station_name || cancellingTicket.source_station,
      to_station: stationData[0]?.to_station_name || cancellingTicket.destination_station,
      original_amount: cancellingTicket.paid_amount,
      refund_amount: refund_amount,
      cancellation_time: new Date().toISOString()
    });
    
    console.log('📧 Cancellation email sent successfully');
  } else {
    console.log('⚠️ User email not found, skipping cancellation email');
  }
} catch (emailError) {
  console.log('⚠️ Cancellation email failed, but cancellation successful:', emailError.message);
}

console.log('🎉 Cancellation with waiting list processing completed');

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('❌ Cancellation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
module.exports = { bookTicket, getBookingHistory, getBookingByPnr,cancelTicket };

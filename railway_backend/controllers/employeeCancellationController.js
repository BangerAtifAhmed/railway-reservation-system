const pool = require('../config/database');
const { sendEmployeeCancellationEmail } = require('../utils/userEmail'); 
const cancelEmployeeTicket = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { pnr_no } = req.body;
    const employee_id = req.employee.employee_id;
const employee_name = req.employee.emp_name;
    const employee_email = req.employee.email; // 
    console.log('🗑️ Starting employee cancellation with waiting list promotion for PNR:', pnr_no);

    await connection.beginTransaction();

    // ========== 1. GET TICKET BEING CANCELLED ==========
    const [cancellingTickets] = await connection.execute(
      `SELECT t.pnr_no, t.passenger_name, a.berth_id, a.class_id, t.fare as paid_amount,
              t.train_no, t.source_station, t.destination_station, t.date_time as journey_date
       FROM ticket t
       JOIN allocates a ON t.pnr_no = a.pnr_no
       WHERE t.pnr_no = ? AND t.employee_id = ? AND t.status != 'cancelled'
       LIMIT 1`,
      [pnr_no, employee_id]
    );

    if (cancellingTickets.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ 
        success: false, 
        error: 'Employee ticket not found or already cancelled' 
      });
    }

    const cancellingTicket = cancellingTickets[0];
    const cancel_history_id = 'ECH' + Date.now().toString().slice(-6);

    console.log('🎫 Cancelling employee ticket:', {
      pnr: cancellingTicket.pnr_no,
      class: cancellingTicket.class_id,
      berth: cancellingTicket.berth_id,
      journey_date: cancellingTicket.journey_date
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
      `UPDATE ticket SET status = 'cancelled', cancellation_time = NOW(), refund_amount = 0 
       WHERE pnr_no = ? AND employee_id = ?`,
      [pnr_no, employee_id]
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

    console.log('✅ Cancelled employee ticket updated');

    // ========== 7. ADD EMPLOYEE CANCELLATION HISTORY ==========
    await connection.execute(
      `INSERT INTO employee_booking_history (
        booking_id, employee_id, pnr_no, passenger_name, train_no, 
        from_station, to_station, travel_date, class_id, booking_status, booking_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cancelled', NOW())`,
      [
        cancel_history_id, employee_id, pnr_no, cancellingTicket.passenger_name, 
        cancellingTicket.train_no, cancellingTicket.source_station, 
        cancellingTicket.destination_station, cancellingTicket.journey_date, 
        cancellingTicket.class_id
      ]
    );
    // ========== 8. SEND EMPLOYEE CANCELLATION EMAIL ==========
    try {
      if (employee_email) {
        // Get station names for email
        const [stations] = await pool.execute(
          `SELECT 
            (SELECT station_name FROM station WHERE station_id = ?) as from_station_name,
            (SELECT station_name FROM station WHERE station_id = ?) as to_station_name`,
          [cancellingTicket.source_station, cancellingTicket.destination_station]
        );

        await sendEmployeeCancellationEmail(employee_email, {
          pnr_no,
          passenger_name: cancellingTicket.passenger_name,
          employee_name: employee_name,
          train_no: cancellingTicket.train_no,
          from_station: stations[0]?.from_station_name || cancellingTicket.source_station,
          to_station: stations[0]?.to_station_name || cancellingTicket.destination_station,
          original_amount: cancellingTicket.paid_amount,
          cancellation_time: new Date().toISOString()
        });
        
        console.log('📧 Employee cancellation email sent successfully to:', employee_email);
      } else {
        console.log('⚠️ Employee email not found, skipping cancellation email');
      }
    } catch (emailError) {
      console.log('⚠️ Employee cancellation email failed, but cancellation successful:', emailError.message);
    }
    // Commit transaction
    await connection.commit();
    connection.release();

    console.log('🎉 Employee cancellation with waiting list processing completed');

    res.json({
      success: true,
      message: waiting_list_promoted 
        ? `FREE ticket cancelled successfully. Waiting list user ${waiting_list_promoted.passenger_name} (position ${waiting_list_promoted.previous_position}) has been promoted! ${waiting_list_updates.length} other users had their waiting positions improved.`
        : `FREE ticket cancelled successfully.`,
      data: {
        pnr_no,
        passenger_name: cancellingTicket.passenger_name,
        passenger_type: "employee",
        original_amount: cancellingTicket.paid_amount,
        refund_amount: 0, // FREE tickets get no refund
        cancellation_time: new Date().toISOString(),
        berth_freed: !!freed_berth_id,
        waiting_list_promoted: waiting_list_promoted,
        waiting_list_updates: waiting_list_updates
      }
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('❌ Employee cancellation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  cancelEmployeeTicket
};
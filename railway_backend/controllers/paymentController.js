const pool = require('../config/database');

const makePayment = async (req, res) => {
  try {
    const { pnr_no, payment_mode, amount } = req.body;
    const user_id = req.user.user_id;

    console.log('🔍 Payment request received:', { pnr_no, payment_mode, user_id, amount });

    // Validate input
    if (!pnr_no || !payment_mode) {
      return res.status(400).json({
        success: false,
        error: 'pnr_no and payment_mode are required'
      });
    }

    // Check if ticket exists
    const [tickets] = await pool.execute(
      `SELECT pnr_no, user_id, status FROM ticket WHERE pnr_no = ?`,
      [pnr_no]
    );

    console.log('🎫 Ticket query result:', tickets);

    if (tickets.length === 0) {
      console.log('❌ Ticket not found for PNR:', pnr_no);
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    const ticket = tickets[0];
    
    // Check if user owns this ticket
    if (ticket.user_id !== user_id) {
      console.log('❌ User mismatch. Ticket user:', ticket.user_id, 'Request user:', user_id);
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to pay for this ticket'
      });
    }

    // Calculate fare if not provided
    let finalAmount = amount;
    if (!finalAmount || finalAmount <= 0) {
      console.log('💰 Calculating fare...');
      
      // Get fare from availability check
      const [fareResults] = await pool.execute(
        `SELECT fare FROM class c 
         JOIN ticket t ON c.train_no = t.train_no 
         JOIN allocates a ON t.pnr_no = a.pnr_no AND c.class_id = a.class_id
         WHERE t.pnr_no = ?`,
        [pnr_no]
      );

      if (fareResults.length > 0 && fareResults[0].fare) {
        finalAmount = parseFloat(fareResults[0].fare);
      } else {
        // Default amount
        finalAmount = 1000.00;
      }
    }

    console.log('💵 Final amount to charge:', finalAmount);

    // Generate IDs
    const transaction_id = 'TXN' + Date.now().toString().slice(-6);
    const trans_history_id = 'TH' + Date.now().toString().slice(-6);

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Create payment record
      const [paymentResult] = await connection.execute(
        `INSERT INTO payment (transaction_id, pnr_no, user_id, amount, type, mode, status, transaction_date)
         VALUES (?, ?, ?, ?, 'payment', ?, 'success', NOW())`,
        [transaction_id, pnr_no, user_id, finalAmount, payment_mode]
      );

      console.log('✅ Payment record created:', paymentResult);

      // 2. Add to transaction history
      const [historyResult] = await connection.execute(
        `INSERT INTO user_transaction_history (transaction_history_id, user_id, pnr_no, transaction_id, 
                                         transaction_type, amount, transaction_time, status, description)
         VALUES (?, ?, ?, ?, 'payment', ?, NOW(), 'success', ?)`,
        [trans_history_id, user_id, pnr_no, transaction_id, finalAmount, `Payment for ticket ${pnr_no}`]
      );

      console.log('✅ Transaction history recorded:', historyResult);

      // 3. Update ticket status to confirmed
      await connection.execute(
        `UPDATE ticket SET status = 'confirmed' WHERE pnr_no = ?`,
        [pnr_no]
      );

      console.log('✅ Ticket status updated to confirmed');

      // 4. Update allocation status
      await connection.execute(
        `UPDATE allocates SET allocation_status = 'confirmed' WHERE pnr_no = ?`,
        [pnr_no]
      );

      console.log('✅ Allocation status updated to confirmed');

      // Commit transaction
      await connection.commit();
      connection.release();

      console.log('🎉 Payment successful for PNR:', pnr_no);

      res.json({
        success: true,
        message: 'Payment successful and ticket confirmed',
        data: {
          transaction_id,
          pnr_no,
          amount_paid: finalAmount,
          payment_mode,
          payment_status: 'success',
          payment_date: new Date().toISOString(),
          ticket_status: 'confirmed'
        }
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('❌ Payment transaction error:', error);
      throw error;
    }

  } catch (error) {
    console.error('Make payment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ... keep other payment functions

const getPaymentHistory = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const [payments] = await pool.execute(
      `SELECT 
        p.transaction_id,
        p.pnr_no,
        p.amount,
        p.type as transaction_type,
        p.mode as payment_mode,
        p.status as payment_status,
        p.transaction_date,
        t.passenger_name,
        t.train_no,
        src.station_name as from_station,
        dest.station_name as to_station
      FROM payment p
      JOIN ticket t ON p.pnr_no = t.pnr_no
      JOIN station src ON t.source_station = src.station_id
      JOIN station dest ON t.destination_station = dest.station_id
      WHERE p.user_id = ?
      ORDER BY p.transaction_date DESC`,
      [user_id]
    );

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getPaymentByTransactionId = async (req, res) => {
  try {
    const { transaction_id } = req.params;
    const user_id = req.user.user_id;

    const [payments] = await pool.execute(
      `SELECT 
        p.*,
        t.passenger_name,
        t.train_no,
        t.date_time as journey_date,
        src.station_name as from_station,
        dest.station_name as to_station
      FROM payment p
      JOIN ticket t ON p.pnr_no = t.pnr_no
      JOIN station src ON t.source_station = src.station_id
      JOIN station dest ON t.destination_station = dest.station_id
      WHERE p.transaction_id = ? AND p.user_id = ?`,
      [transaction_id, user_id]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: payments[0]
    });
  } catch (error) {
    console.error('Get payment by ID error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { makePayment, getPaymentHistory, getPaymentByTransactionId };
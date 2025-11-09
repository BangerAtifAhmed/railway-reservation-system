const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const [users] = await pool.execute(
      `SELECT user_id, user_name, name, email, dob, age, gender, 
              address, city, state, pin_code, mobile_no
       FROM user 
       WHERE user_id = ?`,
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { name, dob, gender, address, city, state, pin_code, mobile_no } = req.body;

    // Calculate age from dob
    const age = new Date().getFullYear() - new Date(dob).getFullYear();

    await pool.execute(
      `UPDATE user 
       SET name = ?, dob = ?, age = ?, gender = ?, 
           address = ?, city = ?, state = ?, pin_code = ?, mobile_no = ?
       WHERE user_id = ?`,
      [name, dob, age, gender, address, city, state, pin_code, mobile_no, user_id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user booking history
router.get('/bookings', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const [bookings] = await pool.execute(
      `SELECT 
        t.pnr_no,
        t.passenger_name,
        t.train_no,
        src.station_name as from_station,
        dest.station_name as to_station,
        t.date_time as journey_date,
        t.status as ticket_status,
        a.allocation_status as seat_status,
        c.class_name,
        CASE 
          WHEN a.berth_id LIKE 'WL%' THEN 'Waiting List'
          ELSE CONCAT('Coach ', b.coach_no, ' - Berth ', b.berth_no)
        END as seat_info,
        t.fare,
        t.booking_time,
        t.cancellation_time,
        t.refund_amount
      FROM ticket t
      JOIN station src ON t.source_station = src.station_id
      JOIN station dest ON t.destination_station = dest.station_id
      JOIN allocates a ON t.pnr_no = a.pnr_no
      JOIN class c ON a.class_id = c.class_id
      LEFT JOIN berth b ON a.berth_id = b.berth_id
      WHERE t.user_id = ?
      ORDER BY t.booking_time DESC`,
      [user_id]
    );

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user transaction history
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const [transactions] = await pool.execute(
      `SELECT 
        th.transaction_history_id,
        th.pnr_no,
        th.transaction_type,
        th.amount,
        th.transaction_time,
        th.status,
        th.description,
        p.mode as payment_mode
      FROM user_transaction_history th
      JOIN payment p ON th.transaction_id = p.transaction_id
      WHERE th.user_id = ?
      ORDER BY th.transaction_time DESC`,
      [user_id]
    );

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    // Get current password
    const [users] = await pool.execute(
      'SELECT password FROM user WHERE user_id = ?',
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(current_password, users[0].password);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await pool.execute(
      'UPDATE user SET password = ? WHERE user_id = ?',
      [hashedPassword, user_id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_bookings,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting_bookings,
        COALESCE(SUM(fare), 0) as total_spent,
        COALESCE(SUM(refund_amount), 0) as total_refunded
      FROM ticket 
      WHERE user_id = ?`,
      [user_id]
    );

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
const getProfile = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    console.log(`👤 Fetching comprehensive profile for user: ${user_id}`);

    // Get basic user information
    const [users] = await pool.execute(
      `SELECT 
        u.user_id,
        u.user_name,
        u.name,
        u.email,
        u.dob,
        u.age,
        u.gender,
        u.address,
        u.city,
        u.state,
        u.pin_code,
        u.mobile_no,
        u.created_at
       FROM user u
       WHERE u.user_id = ?`,
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Get booking statistics
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(fare) as total_spent
       FROM ticket 
       WHERE user_id = ?`,
      [user_id]
    );

    // Get recent bookings
    const [recentBookings] = await pool.execute(
      `SELECT 
        pnr_no, passenger_name, train_no, status, booking_time
       FROM ticket 
       WHERE user_id = ?
       ORDER BY booking_time DESC
       LIMIT 3`,
      [user_id]
    );

    const profileData = {
      user_info: {
        user_id: user.user_id,
        user_name: user.user_name,
        personal_info: {
          name: user.name,
          email: user.email,
          dob: user.dob,
          age: user.age,
          gender: user.gender
        },
        contact_info: {
          mobile_no: user.mobile_no,
          address: `${user.address}, ${user.city}, ${user.state} - ${user.pin_code}`
        },
        member_since: user.created_at
      },
      booking_summary: {
        total_bookings: stats[0].total_bookings || 0,
        confirmed_bookings: stats[0].confirmed || 0,
        cancelled_bookings: stats[0].cancelled || 0,
        total_amount_spent: parseFloat(stats[0].total_spent) || 0
      },
      recent_bookings: recentBookings.map(booking => ({
        pnr_no: booking.pnr_no,
        passenger_name: booking.passenger_name,
        train_no: booking.train_no,
        status: booking.status,
        booking_date: booking.booking_time
      }))
    };

    console.log(`✅ Profile fetched successfully for: ${user.name}`);

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: profileData
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
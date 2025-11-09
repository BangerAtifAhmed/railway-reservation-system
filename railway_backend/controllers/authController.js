// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const register = async (req, res) => {
  try {
    const { user_name, name, email, password, dob, gender, address, city, state, pin_code, mobile_no } = req.body;

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT * FROM user WHERE email = ? OR user_name = ?',
      [email, user_name]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'User with this email or username already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const user_id = 'U' + Date.now().toString().slice(-6);

    // Calculate age
    const age = new Date().getFullYear() - new Date(dob).getFullYear();

    // Insert user with mobile_no directly in user table
    await pool.execute(
      `INSERT INTO user (user_id, user_name, name, email, password, dob, age, gender, address, city, state, pin_code, mobile_no) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, user_name, name, email, hashedPassword, dob, age, gender, address, city, state, pin_code, mobile_no]
    );

    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully',
      user_id: user_id
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { user_name, user_id, email, password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is required' 
      });
    }

    // Check if user exists by username OR user_id OR email
    let query = 'SELECT * FROM user WHERE ';
    let params = [];
    
    if (user_name) {
      query += 'user_name = ?';
      params = [user_name];
    } else if (user_id) {
      query += 'user_id = ?';
      params = [user_id];
    } else if (email) {
      query += 'email = ?';
      params = [email];
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'user_name, user_id, or email is required' 
      });
    }

    const [users] = await pool.execute(query, params);

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET || 'railway_secret_key_2024',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        user_name: user.user_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
const getProfile = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const [users] = await pool.execute(
      `SELECT u.user_id, u.user_name, u.name, u.email, u.dob, u.age, u.gender, 
              u.address, u.city, u.state, u.pin_code,
              GROUP_CONCAT(um.mobile_no) as mobile_numbers
       FROM user u
       LEFT JOIN user_mobile um ON u.user_id = um.user_id
       WHERE u.user_id = ?
       GROUP BY u.user_id`,
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const user = users[0];
    if (user.mobile_numbers) {
      user.mobile_numbers = user.mobile_numbers.split(',');
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Helper function to generate user ID
function generateUserId() {
  return 'U' + Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 3).toUpperCase();
}

module.exports = { register, login, getProfile };
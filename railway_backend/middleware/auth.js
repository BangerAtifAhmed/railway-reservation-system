// middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'railway_secret_key_2024');
    
    // Verify user still exists in database
    const [users] = await pool.execute(
      'SELECT user_id, email, name FROM user WHERE user_id = ?',
      [decoded.user_id]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        success: false, 
        error: 'Token expired' 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Authentication failed' 
    });
  }
};

module.exports = { authenticateToken };
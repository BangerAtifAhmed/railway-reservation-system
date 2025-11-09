const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticateEmployee = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // ✅ USE EMPLOYEE SECRET ONLY - will reject user tokens
    const decoded = jwt.verify(token, process.env.JWT_EMPLOYEE_SECRET || 'employee_secret_key_2024_secure');

    // Check if employee_id exists in decoded token
    if (!decoded.employee_id) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. Employee ID not found.'
      });
    }

    // Verify employee exists in database
    const [employees] = await pool.execute(
      'SELECT employee_id, emp_name, designation, email FROM employee WHERE employee_id = ?',
      [decoded.employee_id]
    );

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Employee not found.'
      });
    }

    req.employee = employees[0];
    next();
  } catch (error) {
    console.error('Employee authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        error: 'Invalid employee token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        error: 'Employee token expired'
      });
    }

    return res.status(403).json({
      success: false,
      error: 'Employee authentication failed'
    });
  }
};

module.exports = { authenticateEmployee };
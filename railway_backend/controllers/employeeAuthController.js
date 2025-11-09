const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Employee Login with proper JWT
const loginEmployee = async (req, res) => {
  try {
    const { employee_id, password } = req.body;

    if (!employee_id || !password) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID and password are required'
      });
    }

    console.log(`🔐 Employee login attempt: ${employee_id}`);

    // Get employee from database
    const [employees] = await pool.execute(
      `SELECT * FROM employee WHERE employee_id = ?`,
      [employee_id]
    );

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid employee ID or password'
      });
    }

    const employee = employees[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, employee.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid employee ID or password'
      });
    }

    // Generate proper JWT token (same as user login)
    const token = jwt.sign(
      {
        employee_id: employee.employee_id,
        emp_name: employee.emp_name,
        designation: employee.designation,
        email: employee.email,
        type: 'employee' // Add type to distinguish from user tokens
      },
      process.env.JWT_SECRET || 'your_jwt_secret_key', // Use same secret as user auth
      { expiresIn: '24h' }
    );

    console.log(`✅ Employee login successful: ${employee.emp_name}`);

    // Remove password from response
    const { password: _, ...employeeWithoutPassword } = employee;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token, // This will be a real JWT token
        employee: employeeWithoutPassword
      }
    });

  } catch (error) {
    console.error('❌ Employee login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      details: error.message
    });
  }
};

// Get Employee Profile
const getEmployeeProfile = async (req, res) => {
  try {
    const employee_id = req.employee.employee_id;

    const [employees] = await pool.execute(
      `SELECT 
        employee_id, emp_name, designation, email, 
        phone_no, hire_date, salary, supervisor_id
       FROM employee 
       WHERE employee_id = ?`,
      [employee_id]
    );

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Get supervisor name if exists
    let supervisor_name = null;
    if (employees[0].supervisor_id) {
      const [supervisors] = await pool.execute(
        `SELECT emp_name FROM employee WHERE employee_id = ?`,
        [employees[0].supervisor_id]
      );
      supervisor_name = supervisors.length > 0 ? supervisors[0].emp_name : null;
    }

    // Get dependents count
    const [dependents] = await pool.execute(
      `SELECT COUNT(*) as dependent_count FROM dependent WHERE employee_id = ?`,
      [employee_id]
    );

    // Get recent bookings count
    const [bookings] = await pool.execute(
      `SELECT COUNT(*) as recent_bookings FROM employee_booking_history 
       WHERE employee_id = ? AND booking_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [employee_id]
    );

    const employeeData = {
      ...employees[0],
      supervisor_name,
      stats: {
        dependent_count: dependents[0].dependent_count,
        recent_bookings: bookings[0].recent_bookings
      }
    };

    res.json({
      success: true,
      data: employeeData
    });

  } catch (error) {
    console.error('Get employee profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { loginEmployee, getEmployeeProfile };
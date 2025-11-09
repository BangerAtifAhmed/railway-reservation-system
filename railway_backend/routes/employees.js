//routes/employee.js
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const router = express.Router();

const { authenticateEmployee } = require('../middleware/employeeAuth');
const employeeBookingController = require('../controllers/employeeBookingController');
const employeeCancellationController = require('../controllers/employeeCancellationController');
// Employee Login
// Add train controller (if not already imported)
const { searchTrains, getTrainRoute, checkAvailability } = require('../controllers/trainController');

// Employee train routes - add these before module.exports
router.get('/trains/search', authenticateEmployee, searchTrains);
router.get('/trains/:train_no/route', authenticateEmployee, getTrainRoute);
router.get('/trains/availability/check', authenticateEmployee, checkAvailability);
router.post('/auth/login', async (req, res) => {
  try {
    console.log('🎯 Employee login called with body:', req.body);
    
    const { employee_id, password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is required' 
      });
    }

    if (!employee_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Employee ID is required' 
      });
    }

    // Get employee from database
    const [employees] = await pool.execute(
      'SELECT * FROM employee WHERE employee_id = ?',
      [employee_id]
    );

    if (employees.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const employee = employees[0];

    // Compare plain text passwords directly
    if (password !== employee.password) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        employee_id: employee.employee_id,
        emp_name: employee.emp_name,
        designation: employee.designation,
        email: employee.email,
        type: 'employee'
      },
      process.env.JWT_EMPLOYEE_SECRET || 'employee_secret_key_2024_secure',
      { expiresIn: '24h' }
    );

    console.log('✅ Employee login successful, token generated');

    // Remove password from response
    const { password: _, ...employeeWithoutPassword } = employee;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      employee: {
        employee_id: employee.employee_id,
        emp_name: employee.emp_name,
        designation: employee.designation,
        email: employee.email
      }
    });

  } catch (error) {
    console.error('Employee login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Employee Profile (Temporary - without auth middleware)
router.get('/profile', async (req, res) => {
  try {
    // For now, get profile by employee_id from query param
    const { employee_id } = req.query;
    
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID is required'
      });
    }

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

    const employeeData = {
      ...employees[0],
      supervisor_name,
      dependent_count: dependents[0].dependent_count
    };

    res.json({
      success: true,
      data: employeeData
    });

  } catch (error) {
    console.error('Get employee profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// Add this route before module.exports

// Get employee booking history - FIXED ROUTE
// Get employee booking history - WITH AUTHENTICATION
router.get('/bookings/history', authenticateEmployee, async (req, res) => {
  try {
    const employee_id = req.employee.employee_id;
    const { status } = req.query;

    console.log(`📋 Fetching booking history for employee: ${employee_id}`);

    let query = `
      SELECT 
        ebh.booking_id,
        ebh.pnr_no,
        ebh.passenger_name,
        ebh.train_no,
        ebh.travel_date as journey_date,
        ebh.booking_status,
        ebh.booking_time,
        ebh.cancellation_time,
        t.status as ticket_status,
        t.fare,
        src.station_name as from_station_name,
        dest.station_name as to_station_name,
        a.allocation_status,
        a.berth_id,
        c.class_name,
        b.coach_no,
        b.berth_no
      FROM employee_booking_history ebh
      LEFT JOIN ticket t ON ebh.pnr_no = t.pnr_no
      LEFT JOIN station src ON ebh.from_station = src.station_id
      LEFT JOIN station dest ON ebh.to_station = dest.station_id
      LEFT JOIN allocates a ON ebh.pnr_no = a.pnr_no
      LEFT JOIN class c ON a.class_id = c.class_id
      LEFT JOIN berth b ON a.berth_id = b.berth_id
      WHERE ebh.employee_id = ?
    `;

    const params = [employee_id];

    if (status && status !== 'all') {
      query += ' AND ebh.booking_status = ?';
      params.push(status);
    }

    query += ' ORDER BY ebh.booking_time DESC';

    const [bookings] = await pool.execute(query, params);

    console.log(`✅ Found ${bookings.length} booking records for employee ${employee_id}`);

    // Format the response
    const formattedBookings = bookings.map(booking => ({
      booking_id: booking.booking_id,
      pnr_no: booking.pnr_no,
      passenger_name: booking.passenger_name,
      train_no: booking.train_no,
      journey: {
        from_station: booking.from_station_name,
        to_station: booking.to_station_name,
        journey_date: booking.journey_date
      },
      status: {
        booking_status: booking.booking_status,
        ticket_status: booking.ticket_status,
        allocation_status: booking.allocation_status
      },
      seat_info: booking.berth_id ? {
        class_name: booking.class_name,
        coach_no: booking.coach_no,
        berth_no: booking.berth_no,
        berth_id: booking.berth_id
      } : {
        class_name: booking.class_name,
        status: 'Waiting List'
      },
      financial: {
        fare: booking.fare
      },
      timeline: {
        booking_time: booking.booking_time,
        cancellation_time: booking.cancellation_time
      }
    }));

    res.json({
      success: true,
      data: {
        employee_id: employee_id,
        total_bookings: bookings.length,
        bookings: formattedBookings
      }
    });

  } catch (error) {
    console.error('❌ Get employee booking history error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch employee booking history',
      details: error.message 
    });
  }
});

router.use(authenticateEmployee);

// Book free ticket for employee or dependent
router.post('/book-ticket', employeeBookingController.bookEmployeeTicket);

// Cancel employee ticket
router.post('/cancel-ticket', employeeCancellationController.cancelEmployeeTicket);

// Get employee booking history
router.get('/my-bookings', employeeBookingController.getEmployeeBookings);

// Get specific booking details
router.get('/booking/:pnr_no', employeeBookingController.getBookingDetails);

// Get employee dependents for booking
router.get('/dependents-list', async (req, res) => {
  try {
    const employee_id = req.employee.employee_id;

    const [dependents] = await pool.execute(
      `SELECT dependent_id, f_name, l_name, dob, gender, relation
       FROM dependent 
       WHERE employee_id = ? 
       ORDER BY relation, f_name`,
      [employee_id]
    );

    res.json({
      success: true,
      data: dependents
    });

  } catch (error) {
    console.error('Get employee dependents error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get employee quota info
// Get employee quota info - FIXED
// Get employee quota info - FIXED RESET DATE
router.get('/quota-info', async (req, res) => {
  try {
    const employee_id = req.employee.employee_id;

    // Get monthly quota usage
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
    const quota_used = monthlyBookings[0].booking_count;
    const quota_remaining = Math.max(0, maxQuota - quota_used);

    // FIXED: Calculate reset date (1st day of NEXT month)
    let resetMonth = currentMonth + 1;
    let resetYear = currentYear;
    
    if (resetMonth > 12) {
      resetMonth = 1;
      resetYear = currentYear + 1;
    }
    
    const reset_date = new Date(resetYear, resetMonth - 1, 1).toISOString().split('T')[0];

    res.json({
      success: true,
      data: {
        quota_used,
        quota_remaining,
        max_quota: maxQuota,
        reset_date: reset_date,
        current_month: currentMonth,
        current_year: currentYear
      }
    });

  } catch (error) {
    console.error('Get employee quota info error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// Protected profile route (alternative to the public one above)
router.get('/my-profile', async (req, res) => {
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

    const employeeData = {
      ...employees[0],
      supervisor_name,
      dependent_count: dependents[0].dependent_count
    };

    res.json({
      success: true,
      data: employeeData
    });

  } catch (error) {
    console.error('Get employee profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});








module.exports = router;
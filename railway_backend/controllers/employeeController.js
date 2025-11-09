const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// Get all employees (for admin)
const getAllEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 10, designation, department } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        e.employee_id, e.emp_name, e.designation, e.email, 
        e.phone_no, e.hire_date, e.salary, e.supervisor_id,
        s.emp_name as supervisor_name,
        d.department_name,
        (SELECT COUNT(*) FROM dependent dep WHERE dep.employee_id = e.employee_id) as dependent_count
      FROM employee e
      LEFT JOIN employee s ON e.supervisor_id = s.employee_id
      LEFT JOIN departments d ON e.department_id = d.department_id
      WHERE 1=1
    `;

    let countQuery = `SELECT COUNT(*) as total FROM employee e WHERE 1=1`;
    const params = [];
    const countParams = [];

    if (designation) {
      query += ` AND e.designation = ?`;
      countQuery += ` AND e.designation = ?`;
      params.push(designation);
      countParams.push(designation);
    }

    if (department) {
      query += ` AND e.department_id = ?`;
      countQuery += ` AND e.department_id = ?`;
      params.push(department);
      countParams.push(department);
    }

    query += ` ORDER BY e.hire_date DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [employees] = await pool.execute(query, params);
    const [countResult] = await pool.execute(countQuery, countParams);

    res.json({
      success: true,
      data: {
        employees,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(countResult[0].total / limit),
          total_employees: countResult[0].total
        }
      }
    });

  } catch (error) {
    console.error('Get all employees error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get employee by ID
const getEmployeeById = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const [employees] = await pool.execute(
      `SELECT 
        e.employee_id, e.emp_name, e.designation, e.email, 
        e.phone_no, e.hire_date, e.salary, e.supervisor_id,
        s.emp_name as supervisor_name,
        d.department_name
       FROM employee e
       LEFT JOIN employee s ON e.supervisor_id = s.employee_id
       LEFT JOIN departments d ON e.department_id = d.department_id
       WHERE e.employee_id = ?`,
      [employee_id]
    );

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Get dependents
    const [dependents] = await pool.execute(
      `SELECT * FROM dependent WHERE employee_id = ?`,
      [employee_id]
    );

    // Get booking history
    const [bookings] = await pool.execute(
      `SELECT * FROM employee_booking_history WHERE employee_id = ? ORDER BY booking_time DESC`,
      [employee_id]
    );

    // Get transaction history
    const [transactions] = await pool.execute(
      `SELECT * FROM employee_transaction_history WHERE employee_id = ? ORDER BY transaction_time DESC`,
      [employee_id]
    );

    res.json({
      success: true,
      data: {
        employee: employees[0],
        dependents,
        bookings,
        transactions
      }
    });

  } catch (error) {
    console.error('Get employee by ID error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create new employee
const createEmployee = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      emp_name,
      designation,
      email,
      phone_no,
      hire_date,
      salary,
      supervisor_id,
      department_id,
      password
    } = req.body;

    await connection.beginTransaction();

    // Generate employee ID
    const employee_id = 'EMP' + Date.now().toString().slice(-6);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert employee
    await connection.execute(
      `INSERT INTO employee (employee_id, emp_name, designation, email, phone_no, 
       hire_date, salary, supervisor_id, department_id, password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee_id, emp_name, designation, email, phone_no, hire_date, salary, supervisor_id, department_id, hashedPassword]
    );

    await connection.commit();
    connection.release();

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: { employee_id }
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Create employee error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Employee with this email already exists'
      });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update employee
const updateEmployee = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const updates = req.body;

    const allowedFields = ['emp_name', 'designation', 'email', 'phone_no', 'salary', 'supervisor_id', 'department_id'];
    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updateValues.push(employee_id);

    await pool.execute(
      `UPDATE employee SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Employee updated successfully'
    });

  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { 
  getAllEmployees, 
  getEmployeeById, 
  createEmployee, 
  updateEmployee 
};
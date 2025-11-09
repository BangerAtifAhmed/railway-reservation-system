const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enhanced request logger
app.use((req, res, next) => {
  console.log(`🔍 ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log(`   Headers:`, req.headers);
  console.log(`   Body:`, req.body);
  next();
});
// Add this line to your app.js
const employeeTrainRoutes = require('./routes/employeeTrains');

// Register employee train routes
app.use('/api/employee/trains', (req, res, next) => {
  console.log('📍 Routing to /api/employee/trains');
  next();
}, employeeTrainRoutes);
// Debug: Test if we can load routes
console.log('\n=== 🔄 LOADING ROUTES ===');

try {
  const authRoutes = require('./routes/auth');
  console.log('✅ authRoutes loaded');
} catch (error) {
  console.log('❌ authRoutes failed:', error.message);
}

try {
  const userRoutes = require('./routes/users');
  console.log('✅ userRoutes loaded');
} catch (error) {
  console.log('❌ userRoutes failed:', error.message);
}

try {
  const trainRoutes = require('./routes/trains');
  console.log('✅ trainRoutes loaded');
} catch (error) {
  console.log('❌ trainRoutes failed:', error.message);
}

try {
  const bookingRoutes = require('./routes/bookings');
  console.log('✅ bookingRoutes loaded');
} catch (error) {
  console.log('❌ bookingRoutes failed:', error.message);
}

try {
  const paymentRoutes = require('./routes/payments');
  console.log('✅ paymentRoutes loaded');
} catch (error) {
  console.log('❌ paymentRoutes failed:', error.message);
}

try {
  const employeeRoutes = require('./routes/employees');
  console.log('✅ employeeRoutes loaded');
} catch (error) {
  console.log('❌ employeeRoutes failed:', error.message);
}

// Now import properly
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const trainRoutes = require('./routes/trains');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const employeeRoutes = require('./routes/employees');

console.log('\n=== 🚀 REGISTERING ROUTES ===');

// Register routes with debug
app.use('/api/auth', (req, res, next) => {
  console.log('📍 Routing to /api/auth');
  next();
}, authRoutes);

app.use('/api/users', (req, res, next) => {
  console.log('📍 Routing to /api/users');
  next();
}, userRoutes);

app.use('/api/trains', (req, res, next) => {
  console.log('📍 Routing to /api/trains');
  next();
}, trainRoutes);

app.use('/api/bookings', (req, res, next) => {
  console.log('📍 Routing to /api/bookings');
  next();
}, bookingRoutes);

app.use('/api/employees', (req, res, next) => {
  console.log('📍 Routing to /api/employees - THIS SHOULD APPEAR');
  next();
}, employeeRoutes);

app.use('/api/payments', (req, res, next) => {
  console.log('📍 Routing to /api/payments');
  next();
}, paymentRoutes);

console.log('✅ All routes registered');

// Test route to verify server is working
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Railway Reservation System API is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Railway Reservation System API',
    version: '1.0.0',
    endpoints: {
      test: '/api/test',
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      trains: '/api/trains',
      bookings: '/api/bookings',
      employees: '/api/employees',
      payments: '/api/payments'
    }
  });
});

// 404 handler - Enhanced to show available routes
app.use('*', (req, res) => {
  console.log(`❌ 404: Route ${req.originalUrl} not found`);
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
    available_routes: [
      'GET /',
      'GET /api/health',
      'GET /api/test',
      'POST /api/auth/login',
      'POST /api/employees/auth/login'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 Error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: err.message
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n=== 🚄 SERVER STARTED ===`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/api/health`);
  console.log(`  http://localhost:${PORT}/api/test`);
  console.log(`  http://localhost:${PORT}/api/employees/auth/login`);
  console.log(`========================\n`);
});
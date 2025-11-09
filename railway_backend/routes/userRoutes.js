const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// User profile routes
router.get('/profile', userController.getProfile);
// Add other user routes as needed
// router.put('/profile', userController.updateProfile);
// router.get('/bookings', userController.getUserBookings);

module.exports = router;
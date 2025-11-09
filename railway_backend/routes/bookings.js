// routes/bookings.js
const express = require('express');
const { bookTicket, cancelTicket, getBookingHistory, getBookingByPnr } = require('../controllers/bookingController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/book', authenticateToken, bookTicket);
router.post('/cancel', authenticateToken, cancelTicket);
router.get('/history', authenticateToken, getBookingHistory);
router.get('/:pnr_no', authenticateToken, getBookingByPnr);

module.exports = router;
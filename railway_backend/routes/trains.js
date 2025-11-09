// routes/trains.js
const express = require('express');
const { searchTrains, getTrainRoute, checkAvailability } = require('../controllers/trainController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/search', authenticateToken, searchTrains);
router.get('/:train_no/route', authenticateToken, getTrainRoute);
router.get('/availability/check', authenticateToken, checkAvailability);

module.exports = router;
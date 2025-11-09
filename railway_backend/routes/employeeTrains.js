// routes/employeeTrains.js
const express = require('express');
const { searchTrains, getTrainRoute, checkAvailability } = require('../controllers/trainController');
const { authenticateEmployee } = require('../middleware/employeeAuth');

const router = express.Router();

// Employee train routes - use authenticateEmployee
router.get('/search', authenticateEmployee, searchTrains);
router.get('/:train_no/route', authenticateEmployee, getTrainRoute);
router.get('/availability/check', authenticateEmployee, checkAvailability);

module.exports = router;
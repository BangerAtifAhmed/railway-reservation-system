const express = require('express');
const { makePayment, getPaymentHistory, getPaymentByTransactionId } = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/make-payment', authenticateToken, makePayment);
router.get('/history', authenticateToken, getPaymentHistory);
router.get('/:transaction_id', authenticateToken, getPaymentByTransactionId);

module.exports = router;
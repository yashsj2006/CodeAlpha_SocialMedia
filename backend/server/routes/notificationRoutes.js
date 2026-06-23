const express = require('express');
const { getNotifications, markAllRead, getUnreadCount } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/notifications', protect, getNotifications);
router.put('/notifications/read', protect, markAllRead);
router.get('/notifications/unread-count', protect, getUnreadCount);

module.exports = router;

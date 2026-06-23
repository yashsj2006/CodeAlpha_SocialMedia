const express = require('express');
const { getConversations, getMessages, sendMessage, getUnreadCount } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/messages', protect, getConversations);
router.get('/messages/unread-count', protect, getUnreadCount);
router.get('/messages/:userId', protect, getMessages);
router.post('/messages/:userId', protect, sendMessage);

module.exports = router;

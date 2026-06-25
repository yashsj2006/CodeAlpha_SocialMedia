const express = require('express');
const { getUserProfile, updateUserProfile, searchUsers, blockUser, unblockUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/users/search', protect, searchUsers);
router.get('/profile/:id', protect, getUserProfile);
router.put('/profile/update', protect, upload.single('profilePicture'), updateUserProfile);
router.post('/users/:id/block', protect, blockUser);
router.post('/users/:id/unblock', protect, unblockUser);

module.exports = router;

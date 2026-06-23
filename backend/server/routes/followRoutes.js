const express = require('express');
const {
  followUser, unfollowUser,
  acceptFollow, declineFollow,
  getFollowRequests
} = require('../controllers/followController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/follow/:id',         protect, followUser);
router.post('/follow/:id/accept',  protect, acceptFollow);
router.post('/follow/:id/decline', protect, declineFollow);
router.post('/unfollow/:id',       protect, unfollowUser);
router.get('/follow-requests',     protect, getFollowRequests);

module.exports = router;

const { Follow, User, Notification } = require('../models');

exports.followUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    if (followerId.toString() === followingId.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const existingFollow = await Follow.findOne({ follower_id: followerId, following_id: followingId });
    if (existingFollow) return res.status(400).json({ message: 'Already following' });

    await Follow.create({ follower_id: followerId, following_id: followingId });

    await Notification.create({
      user_id: followingId,
      actor_id: followerId,
      type: 'follow'
    });
    if (req.io) req.io.to(followingId.toString()).emit('newNotification');

    res.json({ message: 'Followed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    await Follow.findOneAndDelete({ follower_id: req.user.id, following_id: req.params.id });
    res.json({ message: 'Unfollowed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFollowers = async (req, res) => {
  try {
    const follows = await Follow.find({ following_id: req.params.id })
      .populate('follower_id', 'full_name username profile_picture');
    
    res.json(follows.map(f => ({
      id: f.follower_id._id,
      fullName: f.follower_id.full_name,
      username: f.follower_id.username,
      profilePicture: f.follower_id.profile_picture
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFollowing = async (req, res) => {
  try {
    const follows = await Follow.find({ follower_id: req.params.id, status: 'accepted' })
      .populate('following_id', 'full_name username profile_picture');

    res.json(follows.map(f => ({
      id: f.following_id._id,
      fullName: f.following_id.full_name,
      username: f.following_id.username,
      profilePicture: f.following_id.profile_picture
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.acceptFollow = async (req, res) => {
  try {
    await Follow.findOneAndUpdate(
      { follower_id: req.params.id, following_id: req.user.id },
      { $set: { status: 'accepted' } }
    );
    res.json({ message: 'Follow request accepted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.declineFollow = async (req, res) => {
  try {
    await Follow.findOneAndDelete({ follower_id: req.params.id, following_id: req.user.id });
    res.json({ message: 'Follow request declined' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFollowRequests = async (req, res) => {
  try {
    const follows = await Follow.find({ following_id: req.user.id, status: 'pending' })
      .populate('follower_id', 'full_name username profile_picture');
      
    res.json(follows.map(f => ({
      id: f.follower_id._id,
      fullName: f.follower_id.full_name,
      username: f.follower_id.username,
      profilePicture: f.follower_id.profile_picture
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

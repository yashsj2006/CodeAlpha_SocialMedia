const { User, Post, Follow, Comment } = require('../models');

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const viewerId = req.user ? req.user.id : null;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const postsCount = await Post.countDocuments({ user_id: userId, is_story: false });
    const followersCount = await Follow.countDocuments({ following_id: userId });
    const followingCount = await Follow.countDocuments({ follower_id: userId });

    let followStatus = null;
    let reverseFollowStatus = null;
    let isBlocked = false;
    if (viewerId && viewerId.toString() !== userId.toString()) {
      const viewer = await User.findById(viewerId);
      if (viewer && viewer.blocked_users && viewer.blocked_users.includes(userId)) {
        isBlocked = true;
      }
      const f = await Follow.findOne({ follower_id: viewerId, following_id: userId });
      if (f) followStatus = f.status;
      
      const rf = await Follow.findOne({ follower_id: userId, following_id: viewerId });
      if (rf) reverseFollowStatus = rf.status;
    }

    const posts = await Post.find({ user_id: userId, is_story: false })
      .sort({ createdAt: -1 })
      .lean();
    
    for (let p of posts) {
      p.commentsCount = await Comment.countDocuments({ post_id: p._id });
    }

    const mappedPosts = posts.map(p => ({
      id: p._id,
      content: p.content,
      imageUrl: p.image_url,
      isStory: p.is_story,
      createdAt: p.createdAt,
      likesCount: p.likes ? p.likes.length : 0,
      commentsCount: p.commentsCount || 0
    }));

    const reposts = await Post.find({ shares: userId, is_story: false })
      .populate('user_id', 'full_name username profile_picture')
      .sort({ createdAt: -1 })
      .lean();

    for (let r of reposts) {
      r.commentsCount = await Comment.countDocuments({ post_id: r._id });
    }

    const mappedReposts = reposts.map(r => ({
      id: r._id,
      content: r.content,
      imageUrl: r.image_url,
      isStory: r.is_story,
      createdAt: r.createdAt,
      likesCount: r.likes ? r.likes.length : 0,
      commentsCount: r.commentsCount || 0,
      authorId: r.user_id._id,
      authorFullName: r.user_id.full_name,
      authorUsername: r.user_id.username,
      authorProfilePicture: r.user_id.profile_picture
    }));

    res.json({
      id: user._id,
      fullName: user.full_name,
      username: user.username,
      profilePicture: user.profile_picture,
      bio: user.bio,
      lastActive: user.last_active,
      createdAt: user.createdAt,
      postsCount,
      followersCount,
      followingCount,
      followStatus,
      reverseFollowStatus,
      isBlocked,
      posts: mappedPosts,
      reposts: mappedReposts
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, bio } = req.body;
    let profilePicture = req.user.profilePicture;

    if (req.file) {
      profilePicture = req.file.path; // Cloudinary URL
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          full_name: fullName || undefined,
          profile_picture: profilePicture
        }
      },
      { new: true }
    );

    res.json({
      id: updatedUser._id,
      fullName: updatedUser.full_name,
      username: updatedUser.username,
      profilePicture: updatedUser.profile_picture
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const keyword = req.query.q || '';
    const currentUserId = req.user ? req.user.id : null;

    const regex = new RegExp(keyword, 'i');
    const query = {
      $and: [
        { $or: [{ username: regex }, { full_name: regex }] }
      ]
    };
    if (currentUserId) {
      query.$and.push({ _id: { $ne: currentUserId } });
    }

    const users = await User.find(query).lean();

    if (currentUserId) {
      const follows = await Follow.find({ follower_id: currentUserId });
      const followingMap = {};
      follows.forEach(f => {
        followingMap[f.following_id.toString()] = f.status;
      });
      
      res.json(users.map(u => ({
        id: u._id,
        fullName: u.full_name,
        username: u.username,
        profilePicture: u.profile_picture,
        lastActive: u.last_active,
        followStatus: followingMap[u._id.toString()] || null
      })));
    } else {
      res.json(users.map(u => ({
        id: u._id,
        fullName: u.full_name,
        username: u.username,
        profilePicture: u.profile_picture,
        lastActive: u.last_active,
        followStatus: null
      })));
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.blockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { blocked_users: req.params.id } }
    );
    res.json({ message: 'User blocked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { blocked_users: req.params.id } }
    );
    res.json({ message: 'User unblocked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

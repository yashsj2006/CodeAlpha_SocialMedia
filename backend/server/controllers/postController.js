const { Post, User, Follow, Comment, Notification } = require('../models');

async function processHashtags(postId, content) {
  if (!content) return;
  const tags = [...new Set((content.match(/#(\w+)/g) || []).map(t => t.slice(1).toLowerCase()))];
  if (tags.length > 0) {
    await Post.findByIdAndUpdate(postId, { $addToSet: { hashtags: { $each: tags } } });
  }
}

exports.createPost = async (req, res) => {
  try {
    const { content, is_story } = req.body;
    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path; // Cloudinary URL
    }

    if ((!content || !content.trim()) && !imageUrl) {
      return res.status(400).json({ message: 'Post content or image is required' });
    }
    const isStory = is_story === 'true' || is_story === true;
    const expiresAt = isStory ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

    const post = await Post.create({
      user_id: req.user.id,
      content,
      image_url: imageUrl,
      is_story: isStory,
      expires_at: expiresAt
    });

    await processHashtags(post._id, content);

    const populatedPost = await Post.findById(post._id).populate('user_id', 'full_name username profile_picture');

    res.status(201).json({
      id: populatedPost._id,
      content: populatedPost.content,
      imageUrl: populatedPost.image_url,
      isStory: populatedPost.is_story,
      createdAt: populatedPost.createdAt,
      authorId: populatedPost.user_id._id,
      authorFullName: populatedPost.user_id.full_name,
      authorUsername: populatedPost.user_id.username,
      authorProfilePicture: populatedPost.user_id.profile_picture
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    let userFilter = {};

    if (userId) {
      const follows = await Follow.find({ follower_id: userId });
      const followingIds = follows.map(f => f.following_id);
      followingIds.push(userId); // include own posts
      userFilter = { user_id: { $in: followingIds } };
    }

    const posts = await Post.find({
      is_story: false,
      $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
      ...userFilter
    })
    .populate('user_id', 'full_name username profile_picture')
    .sort({ createdAt: -1 })
    .lean();

    const formattedPosts = [];
    for (const p of posts) {
      const commentsCount = await Comment.countDocuments({ post_id: p._id });
      formattedPosts.push({
        id: p._id,
        content: p.content,
        imageUrl: p.image_url,
        isStory: p.is_story,
        createdAt: p.createdAt,
        authorId: p.user_id._id,
        authorFullName: p.user_id.full_name,
        authorUsername: p.user_id.username,
        authorProfilePicture: p.user_id.profile_picture,
        likesCount: p.likes ? p.likes.length : 0,
        commentsCount,
        sharesCount: p.shares ? p.shares.length : 0,
        isLiked: userId ? (p.likes || []).some(l => l.toString() === userId.toString()) : false,
        isSaved: userId ? (p.saves || []).some(s => s.toString() === userId.toString()) : false
      });
    }

    res.json(formattedPosts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStories = async (req, res) => {
  try {
    const userId = req.user.id;
    const follows = await Follow.find({ follower_id: userId });
    const followingIds = follows.map(f => f.following_id);
    followingIds.push(userId);

    const stories = await Post.find({
      is_story: true,
      expires_at: { $gt: new Date() },
      user_id: { $in: followingIds }
    })
    .populate('user_id', 'full_name username profile_picture')
    .sort({ createdAt: -1 })
    .lean();

    res.json(stories.map(p => ({
      id: p._id,
      content: p.content,
      imageUrl: p.image_url,
      createdAt: p.createdAt,
      expiresAt: p.expires_at,
      authorId: p.user_id._id,
      authorFullName: p.user_id.full_name,
      authorUsername: p.user_id.username,
      authorProfilePicture: p.user_id.profile_picture,
      isLiked: (p.story_likes || []).some(l => l.toString() === userId.toString())
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.user_id.toString() !== req.user.id.toString()) return res.status(401).json({ message: 'Not authorized' });
    
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getExplorePosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const follows = await Follow.find({ follower_id: userId });
    const followingIds = follows.map(f => f.following_id);
    followingIds.push(userId);

    const posts = await Post.find({
      is_story: false,
      user_id: { $nin: followingIds },
      $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }]
    })
    .populate('user_id', 'full_name username profile_picture')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
    
    // Sort by likesCount in memory
    posts.sort((a, b) => (b.likes ? b.likes.length : 0) - (a.likes ? a.likes.length : 0));

    const formattedPosts = [];
    for (const p of posts) {
      const commentsCount = await Comment.countDocuments({ post_id: p._id });
      formattedPosts.push({
        id: p._id,
        content: p.content,
        imageUrl: p.image_url,
        createdAt: p.createdAt,
        authorId: p.user_id._id,
        authorFullName: p.user_id.full_name,
        authorUsername: p.user_id.username,
        authorProfilePicture: p.user_id.profile_picture,
        likesCount: p.likes ? p.likes.length : 0,
        commentsCount,
        isLiked: (p.likes || []).some(l => l.toString() === userId.toString()),
        isSaved: (p.saves || []).some(s => s.toString() === userId.toString())
      });
    }

    res.json(formattedPosts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHashtagPosts = async (req, res) => {
  try {
    const tag = req.params.tag.toLowerCase();
    const userId = req.user.id;

    const posts = await Post.find({
      is_story: false,
      hashtags: tag,
      $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }]
    })
    .populate('user_id', 'full_name username profile_picture')
    .sort({ createdAt: -1 })
    .lean();

    const formattedPosts = [];
    for (const p of posts) {
      const commentsCount = await Comment.countDocuments({ post_id: p._id });
      formattedPosts.push({
        id: p._id,
        content: p.content,
        imageUrl: p.image_url,
        createdAt: p.createdAt,
        authorId: p.user_id._id,
        authorFullName: p.user_id.full_name,
        authorUsername: p.user_id.username,
        authorProfilePicture: p.user_id.profile_picture,
        likesCount: p.likes ? p.likes.length : 0,
        commentsCount,
        isLiked: (p.likes || []).some(l => l.toString() === userId.toString())
      });
    }
    res.json(formattedPosts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTrending = async (req, res) => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const posts = await Post.find({ createdAt: { $gt: yesterday } }).lean();
    
    const tagCounts = {};
    posts.forEach(p => {
      if (p.hashtags) {
        p.hashtags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    res.json(sortedTags);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.repost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    if (post.shares && post.shares.some(s => s.toString() === userId.toString())) {
      return res.status(400).json({ message: 'Already reposted' });
    }

    await Post.findByIdAndUpdate(postId, { $addToSet: { shares: userId } });

    if (post.user_id.toString() !== userId.toString()) {
      await Notification.create({
        user_id: post.user_id,
        actor_id: userId,
        type: 'repost',
        post_id: postId
      });
      if (req.io) req.io.to(post.user_id.toString()).emit('newNotification');
    }

    res.json({ message: 'Reposted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.viewStory = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post || !post.is_story) {
      return res.status(404).json({ message: 'Story not found' });
    }
    
    if (post.user_id.toString() !== userId.toString()) {
      await Post.findByIdAndUpdate(postId, { $addToSet: { story_views: userId } });
    }
    res.json({ message: 'Story viewed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStoryStats = async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId)
      .populate('story_views', 'full_name username profile_picture')
      .populate('story_likes', 'full_name username profile_picture')
      .lean();
      
    if (!post) return res.status(404).json({ message: 'Story not found' });

    const viewers = (post.story_views || []).map(u => ({
      id: u._id,
      fullName: u.full_name,
      username: u.username,
      profilePicture: u.profile_picture
    }));

    const likers = (post.story_likes || []).map(u => ({
      id: u._id,
      fullName: u.full_name,
      username: u.username,
      profilePicture: u.profile_picture
    }));

    res.json({ viewers, likers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

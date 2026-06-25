const { Post } = require('../models');

exports.savePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    await Post.findByIdAndUpdate(postId, { $addToSet: { saves: userId } });
    res.json({ message: 'Post saved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unsavePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    await Post.findByIdAndUpdate(postId, { $pull: { saves: userId } });
    res.json({ message: 'Post unsaved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const posts = await Post.find({ saves: userId })
      .populate('user_id', 'full_name username profile_picture')
      .sort({ createdAt: -1 })
      .lean();

    res.json(posts.map(p => ({
      id: p._id,
      content: p.content,
      imageUrl: p.image_url,
      createdAt: p.createdAt,
      authorId: p.user_id._id,
      authorFullName: p.user_id.full_name,
      authorUsername: p.user_id.username,
      authorProfilePicture: p.user_id.profile_picture,
      likesCount: p.likes ? p.likes.length : 0,
      isLiked: (p.likes || []).some(l => l.toString() === userId.toString()),
      isSaved: true
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const { Comment, Post, Notification } = require('../models');

exports.addComment = async (req, res) => {
  try {
    const { content } = req.body;
    const postId = req.params.id;
    const userId = req.user.id;

    if (!content || !content.trim()) return res.status(400).json({ message: 'Content required' });

    const comment = await Comment.create({
      post_id: postId,
      user_id: userId,
      content
    });

    const populatedComment = await Comment.findById(comment._id).populate('user_id', 'full_name username profile_picture');

    const post = await Post.findById(postId);
    if (post && post.user_id.toString() !== userId.toString()) {
      await Notification.create({
        user_id: post.user_id,
        actor_id: userId,
        type: 'comment',
        post_id: postId
      });
      if (req.io) req.io.to(post.user_id.toString()).emit('newNotification');
    }

    res.status(201).json({
      id: populatedComment._id,
      content: populatedComment.content,
      createdAt: populatedComment.createdAt,
      authorId: populatedComment.user_id._id,
      authorFullName: populatedComment.user_id.full_name,
      authorUsername: populatedComment.user_id.username,
      authorProfilePicture: populatedComment.user_id.profile_picture
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ post_id: req.params.id })
      .populate('user_id', 'full_name username profile_picture')
      .sort({ createdAt: 1 })
      .lean();

    res.json(comments.map(c => ({
      id: c._id,
      content: c.content,
      createdAt: c.createdAt,
      authorId: c.user_id._id,
      authorFullName: c.user_id.full_name,
      authorUsername: c.user_id.username,
      authorProfilePicture: c.user_id.profile_picture
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const commentId = req.params.id;
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.user_id.toString() !== req.user.id.toString()) return res.status(401).json({ message: 'Not authorized' });

    await Comment.findByIdAndDelete(commentId);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

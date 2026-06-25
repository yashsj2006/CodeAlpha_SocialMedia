const { Post, Notification } = require('../models');

exports.likePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const post = await Post.findByIdAndUpdate(
      postId, 
      { $addToSet: { likes: userId } },
      { new: true }
    );

    if (!post) return res.status(404).json({ message: 'Post not found' });

    if (post.user_id.toString() !== userId.toString()) {
      await Notification.create({
        user_id: post.user_id,
        actor_id: userId,
        type: 'like',
        post_id: postId
      });
      if (req.io) req.io.to(post.user_id.toString()).emit('newNotification');
    }

    res.json({ message: 'Post liked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unlikePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } });
    res.json({ message: 'Post unliked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

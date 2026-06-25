const { Post, Notification } = require('../models');

exports.likeStory = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const post = await Post.findOneAndUpdate(
      { _id: postId, is_story: true },
      { $addToSet: { story_likes: userId } },
      { new: true }
    );

    if (!post) return res.status(404).json({ message: 'Story not found' });

    if (post.user_id.toString() !== userId.toString()) {
      await Notification.create({
        user_id: post.user_id,
        actor_id: userId,
        type: 'story_like',
        post_id: postId
      });
      if (req.io) req.io.to(post.user_id.toString()).emit('newNotification');
    }

    res.json({ message: 'Story liked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unlikeStory = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    await Post.findOneAndUpdate(
      { _id: postId, is_story: true },
      { $pull: { story_likes: userId } }
    );

    res.json({ message: 'Story unliked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

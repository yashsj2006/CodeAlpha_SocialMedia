const { Notification } = require('../models');

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user_id: req.user.id })
      .populate('actor_id', 'full_name username profile_picture')
      .populate('post_id', 'image_url')
      .sort({ createdAt: -1 })
      .lean();

    res.json(notifications.map(n => ({
      id: n._id,
      type: n.type,
      isRead: n.is_read,
      createdAt: n.createdAt,
      postId: n.post_id ? n.post_id._id : null,
      postImage: n.post_id ? n.post_id.image_url : null,
      actorId: n.actor_id._id,
      actorFullName: n.actor_id.full_name,
      actorUsername: n.actor_id.username,
      actorProfilePicture: n.actor_id.profile_picture
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ user_id: req.user.id, is_read: false }, { $set: { is_read: true } });
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user_id: req.user.id, is_read: false });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

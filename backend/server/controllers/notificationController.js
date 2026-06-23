const pool = require('../config/db');

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const [notifications] = await pool.query(`
      SELECT n.id, n.type, n.is_read as isRead, n.created_at as createdAt,
             n.post_id as postId,
             u.id as actorId, u.full_name as actorFullName,
             u.username as actorUsername,
             u.profile_picture as actorProfilePicture
      FROM Notifications n
      JOIN Users u ON u.id = n.actor_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 60
    `, [userId]);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await pool.query('UPDATE Notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) as count FROM Notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

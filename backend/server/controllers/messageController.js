const pool = require('../config/db');

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    // Get latest message per conversation partner
    const [rows] = await pool.query(`
      SELECT 
        m.id, m.content, m.is_read as isRead, m.created_at as createdAt,
        m.sender_id as senderId, m.receiver_id as receiverId,
        u.id as partnerId, u.full_name as partnerFullName,
        u.username as partnerUsername,
        u.profile_picture as partnerProfilePicture,
        u.last_active as partnerLastActive
      FROM Messages m
      JOIN Users u ON u.id = IF(m.sender_id = ?, m.receiver_id, m.sender_id)
      WHERE m.id IN (
        SELECT MAX(id) FROM Messages
        WHERE sender_id = ? OR receiver_id = ?
        GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
      )
      ORDER BY m.created_at DESC
    `, [userId, userId, userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const partnerId = req.params.userId;

    const [messages] = await pool.query(`
      SELECT m.id, m.content, m.is_read as isRead,
             m.created_at as createdAt,
             m.sender_id as senderId, m.receiver_id as receiverId
      FROM Messages m
      WHERE (m.sender_id = ? AND m.receiver_id = ?)
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
    `, [userId, partnerId, partnerId, userId]);

    // Mark as read
    await pool.query(
      'UPDATE Messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?',
      [partnerId, userId]
    );

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const senderId   = req.user.id;
    const receiverId = parseInt(req.params.userId);
    const { content } = req.body;

    if (!content || !content.trim())
      return res.status(400).json({ message: 'Message cannot be empty' });

    // Allow ONLY if there is an accepted follow relationship
    const [follows] = await pool.query(
      "SELECT id FROM Followers WHERE ((follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)) AND status = 'accepted'",
      [senderId, receiverId, receiverId, senderId]
    );
    if (!follows.length)
      return res.status(403).json({ message: 'You can only message accepted followers' });

    const [result] = await pool.query(
      'INSERT INTO Messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
      [senderId, receiverId, content.trim()]
    );

    const [rows] = await pool.query(
      'SELECT id, content, is_read as isRead, created_at as createdAt, sender_id as senderId, receiver_id as receiverId FROM Messages WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) as count FROM Messages WHERE receiver_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

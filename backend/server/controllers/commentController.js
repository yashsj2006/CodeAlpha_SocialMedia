const pool = require('../config/db');

exports.addComment = async (req, res) => {
  try {
    const { comment } = req.body;
    const postId = req.params.id;
    const userId = req.user.id;

    const [result] = await pool.query(
      'INSERT INTO Comments (post_id, user_id, comment) VALUES (?, ?, ?)',
      [postId, userId, comment]
    );

    // Notify post author
    const [postRows] = await pool.query('SELECT user_id FROM Posts WHERE id = ?', [postId]);
    if (postRows.length > 0 && postRows[0].user_id !== userId) {
      await pool.query(
        'INSERT INTO Notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)',
        [postRows[0].user_id, userId, 'comment', postId]
      );
    }

    const [comments] = await pool.query(`
      SELECT c.id, c.comment, c.created_at as createdAt,
             u.id as authorId, u.full_name as authorFullName,
             u.username as authorUsername,
             u.profile_picture as authorProfilePicture
      FROM Comments c
      JOIN Users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);

    res.status(201).json(comments[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getComments = async (req, res) => {
  try {
    const [comments] = await pool.query(`
      SELECT c.id, c.comment, c.created_at as createdAt,
             u.id as authorId, u.full_name as authorFullName,
             u.username as authorUsername,
             u.profile_picture as authorProfilePicture
      FROM Comments c
      JOIN Users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `, [req.params.id]);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const [comments] = await pool.query('SELECT user_id FROM Comments WHERE id = ?', [req.params.id]);
    if (comments.length === 0) return res.status(404).json({ message: 'Comment not found' });
    if (comments[0].user_id !== req.user.id) return res.status(401).json({ message: 'Not authorized' });
    await pool.query('DELETE FROM Comments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Comment removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

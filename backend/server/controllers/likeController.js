const pool = require('../config/db');

exports.likePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const [existing] = await pool.query(
      'SELECT id FROM Likes WHERE post_id = ? AND user_id = ?', [postId, userId]
    );
    if (existing.length > 0) return res.status(400).json({ message: 'Already liked' });

    await pool.query('INSERT INTO Likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);

    // Notify post author
    const [postRows] = await pool.query('SELECT user_id FROM Posts WHERE id = ?', [postId]);
    if (postRows.length > 0 && postRows[0].user_id !== userId) {
      await pool.query(
        'INSERT INTO Notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)',
        [postRows[0].user_id, userId, 'like', postId]
      );
    }

    const [count] = await pool.query('SELECT COUNT(*) as c FROM Likes WHERE post_id = ?', [postId]);
    res.json({ message: 'Post liked', likesCount: count[0].c });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unlikePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    await pool.query('DELETE FROM Likes WHERE post_id = ? AND user_id = ?', [postId, userId]);

    const [count] = await pool.query('SELECT COUNT(*) as c FROM Likes WHERE post_id = ?', [postId]);
    res.json({ message: 'Post unliked', likesCount: count[0].c });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

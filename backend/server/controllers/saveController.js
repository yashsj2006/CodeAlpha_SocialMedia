const pool = require('../config/db');

exports.savePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    await pool.query('INSERT IGNORE INTO Saves (user_id, post_id) VALUES (?, ?)', [userId, postId]);
    res.json({ message: 'Post saved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unsavePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    await pool.query('DELETE FROM Saves WHERE user_id = ? AND post_id = ?', [userId, postId]);
    res.json({ message: 'Post unsaved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const [posts] = await pool.query(`
      SELECT p.id, p.content, p.image_url as imageUrl,
             p.created_at as createdAt,
             u.id as authorId, u.full_name as authorFullName,
             u.username as authorUsername,
             u.profile_picture as authorProfilePicture,
             (SELECT COUNT(*) FROM Likes WHERE post_id = p.id) as likesCount,
             (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as commentsCount
      FROM Saves s
      JOIN Posts p ON p.id = s.post_id
      JOIN Users u ON u.id = p.user_id
      WHERE s.user_id = ? AND p.is_story = 0
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
      ORDER BY s.created_at DESC
    `, [userId]);

    const [likes] = await pool.query('SELECT post_id FROM Likes WHERE user_id = ?', [userId]);
    const userLikes = likes.map(l => l.post_id);

    res.json(posts.map(p => ({ ...p, isLiked: userLikes.includes(p.id), isSaved: true })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

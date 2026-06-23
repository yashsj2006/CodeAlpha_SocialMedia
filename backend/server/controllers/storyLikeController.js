const pool = require('../config/db');

exports.likeStory = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    // Verify it is actually a story
    const [postRows] = await pool.query('SELECT user_id, is_story FROM Posts WHERE id = ?', [postId]);
    if (!postRows.length) return res.status(404).json({ message: 'Story not found' });
    if (!postRows[0].is_story) return res.status(400).json({ message: 'Not a story' });

    await pool.query(
      'INSERT IGNORE INTO StoryLikes (post_id, user_id) VALUES (?, ?)',
      [postId, userId]
    );

    // Notify story author
    if (postRows[0].user_id !== userId) {
      await pool.query(
        'INSERT INTO Notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)',
        [postRows[0].user_id, userId, 'story_like', postId]
      );
    }

    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) as count FROM StoryLikes WHERE post_id = ?', [postId]
    );
    res.json({ message: 'Story liked', likesCount: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unlikeStory = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM StoryLikes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) as count FROM StoryLikes WHERE post_id = ?', [postId]
    );
    res.json({ message: 'Story unliked', likesCount: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

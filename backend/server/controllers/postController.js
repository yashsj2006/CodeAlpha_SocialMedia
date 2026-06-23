const pool = require('../config/db');
const path = require('path');

// Helper: parse and store hashtags from content
async function processHashtags(postId, content) {
  if (!content) return;
  const tags = [...new Set((content.match(/#(\w+)/g) || []).map(t => t.slice(1).toLowerCase()))];
  for (const tag of tags) {
    const [rows] = await pool.query('INSERT IGNORE INTO Hashtags (tag) VALUES (?)', [tag]);
    let hashtagId;
    if (rows.insertId) {
      hashtagId = rows.insertId;
    } else {
      const [existing] = await pool.query('SELECT id FROM Hashtags WHERE tag = ?', [tag]);
      hashtagId = existing[0].id;
    }
    await pool.query('INSERT IGNORE INTO PostHashtags (post_id, hashtag_id) VALUES (?, ?)', [postId, hashtagId]);
  }
}

exports.createPost = async (req, res) => {
  try {
    const { content, is_story } = req.body;
    let imageUrl = null;
    if (req.file) {
      imageUrl = '/uploads/' + req.file.filename;
    }

    if ((!content || !content.trim()) && !imageUrl) {
      return res.status(400).json({ message: 'Post content or image is required' });
    }
    const isStory = is_story === 'true' || is_story === true ? 1 : 0;
    const expiresAt = isStory ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

    const [result] = await pool.query(
      'INSERT INTO Posts (user_id, content, image_url, is_story, expires_at) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, content, imageUrl, isStory, expiresAt]
    );

    await processHashtags(result.insertId, content);

    const [posts] = await pool.query(`
      SELECT p.id, p.content, p.image_url as imageUrl, p.is_story as isStory,
             p.created_at as createdAt,
             u.id as authorId, u.full_name as authorFullName,
             u.username as authorUsername,
             u.profile_picture as authorProfilePicture
      FROM Posts p
      JOIN Users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [result.insertId]);

    res.status(201).json(posts[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const [posts] = await pool.query(`
      SELECT p.id, p.content, p.image_url as imageUrl, p.is_story as isStory,
             p.created_at as createdAt,
             u.id as authorId, u.full_name as authorFullName,
             u.username as authorUsername,
             u.profile_picture as authorProfilePicture,
             (SELECT COUNT(*) FROM Likes WHERE post_id = p.id) as likesCount,
             (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as commentsCount,
             (SELECT COUNT(*) FROM Shares WHERE original_post_id = p.id) as sharesCount
      FROM Posts p
      JOIN Users u ON p.user_id = u.id
      WHERE p.is_story = 0
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND (p.user_id = ? OR p.user_id IN (SELECT following_id FROM Followers WHERE follower_id = ?))
      ORDER BY p.created_at DESC
    `, [userId, userId]);

    let userLikes = [];
    let userSaves = [];
    if (userId) {
      const [likes] = await pool.query('SELECT post_id FROM Likes WHERE user_id = ?', [userId]);
      userLikes = likes.map(l => l.post_id);
      const [saves] = await pool.query('SELECT post_id FROM Saves WHERE user_id = ?', [userId]);
      userSaves = saves.map(s => s.post_id);
    }

    const formattedPosts = posts.map(p => ({
      ...p,
      isLiked: userLikes.includes(p.id),
      isSaved: userSaves.includes(p.id)
    }));

    res.json(formattedPosts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStories = async (req, res) => {
  try {
    const userId = req.user.id;
    const [stories] = await pool.query(`
      SELECT p.id, p.content, p.image_url as imageUrl,
             p.created_at as createdAt, p.expires_at as expiresAt,
             u.id as authorId, u.full_name as authorFullName,
             u.username as authorUsername,
             u.profile_picture as authorProfilePicture
      FROM Posts p
      JOIN Users u ON p.user_id = u.id
      WHERE p.is_story = 1 AND p.expires_at > NOW()
        AND (p.user_id = ? OR p.user_id IN (SELECT following_id FROM Followers WHERE follower_id = ?))
      ORDER BY p.created_at DESC
    `, [userId, userId]);
    res.json(stories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const [posts] = await pool.query('SELECT user_id FROM Posts WHERE id = ?', [req.params.id]);
    if (posts.length === 0) return res.status(404).json({ message: 'Post not found' });
    if (posts[0].user_id !== req.user.id) return res.status(401).json({ message: 'Not authorized' });
    await pool.query('DELETE FROM Posts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Post removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getExplorePosts = async (req, res) => {
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
      FROM Posts p
      JOIN Users u ON p.user_id = u.id
      WHERE p.is_story = 0
        AND p.user_id NOT IN (
          SELECT following_id FROM Followers WHERE follower_id = ?
        )
        AND p.user_id != ?
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
      ORDER BY likesCount DESC, p.created_at DESC
      LIMIT 50
    `, [userId, userId]);

    const [likes] = await pool.query('SELECT post_id FROM Likes WHERE user_id = ?', [userId]);
    const userLikes = likes.map(l => l.post_id);
    const [saves] = await pool.query('SELECT post_id FROM Saves WHERE user_id = ?', [userId]);
    const userSaves = saves.map(s => s.post_id);

    res.json(posts.map(p => ({ ...p, isLiked: userLikes.includes(p.id), isSaved: userSaves.includes(p.id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHashtagPosts = async (req, res) => {
  try {
    const tag = req.params.tag.toLowerCase();
    const userId = req.user.id;
    const [posts] = await pool.query(`
      SELECT p.id, p.content, p.image_url as imageUrl,
             p.created_at as createdAt,
             u.id as authorId, u.full_name as authorFullName,
             u.username as authorUsername,
             u.profile_picture as authorProfilePicture,
             (SELECT COUNT(*) FROM Likes WHERE post_id = p.id) as likesCount,
             (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as commentsCount
      FROM Posts p
      JOIN Users u ON p.user_id = u.id
      JOIN PostHashtags ph ON ph.post_id = p.id
      JOIN Hashtags h ON h.id = ph.hashtag_id
      WHERE h.tag = ? AND p.is_story = 0
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
      ORDER BY p.created_at DESC
    `, [tag]);

    const [likes] = await pool.query('SELECT post_id FROM Likes WHERE user_id = ?', [userId]);
    const userLikes = likes.map(l => l.post_id);
    res.json(posts.map(p => ({ ...p, isLiked: userLikes.includes(p.id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTrending = async (req, res) => {
  try {
    const [tags] = await pool.query(`
      SELECT h.tag, COUNT(ph.post_id) as count
      FROM PostHashtags ph
      JOIN Hashtags h ON h.id = ph.hashtag_id
      JOIN Posts p ON p.id = ph.post_id
      WHERE p.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY h.id
      ORDER BY count DESC
      LIMIT 10
    `);
    res.json(tags);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.repost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const [existing] = await pool.query('SELECT id FROM Shares WHERE user_id = ? AND original_post_id = ?', [userId, postId]);
    if (existing.length > 0) return res.status(400).json({ message: 'Already reposted' });

    await pool.query('INSERT INTO Shares (user_id, original_post_id) VALUES (?, ?)', [userId, postId]);

    // Notify original post author
    const [postRows] = await pool.query('SELECT user_id FROM Posts WHERE id = ?', [postId]);
    if (postRows.length > 0 && postRows[0].user_id !== userId) {
      await pool.query(
        'INSERT INTO Notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)',
        [postRows[0].user_id, userId, 'repost', postId]
      );
    }

    res.json({ message: 'Reposted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.viewStory = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const [posts] = await pool.query('SELECT is_story, user_id FROM Posts WHERE id = ?', [postId]);
    if (posts.length === 0 || posts[0].is_story === 0) {
      return res.status(404).json({ message: 'Story not found' });
    }
    
    if (posts[0].user_id !== userId) {
      await pool.query('INSERT IGNORE INTO StoryViews (post_id, user_id) VALUES (?, ?)', [postId, userId]);
    }
    res.json({ message: 'Story viewed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStoryStats = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const [posts] = await pool.query('SELECT user_id FROM Posts WHERE id = ?', [postId]);
    if (posts.length === 0) return res.status(404).json({ message: 'Story not found' });

    const [viewers] = await pool.query(`
      SELECT u.id, u.full_name as fullName, u.username, u.profile_picture as profilePicture, sv.created_at as viewedAt
      FROM StoryViews sv
      JOIN Users u ON sv.user_id = u.id
      WHERE sv.post_id = ?
      ORDER BY sv.created_at DESC
    `, [postId]);

    const [likers] = await pool.query(`
      SELECT u.id, u.full_name as fullName, u.username, u.profile_picture as profilePicture, sl.created_at as likedAt
      FROM StoryLikes sl
      JOIN Users u ON sl.user_id = u.id
      WHERE sl.post_id = ?
      ORDER BY sl.created_at DESC
    `, [postId]);

    res.json({ viewers, likers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

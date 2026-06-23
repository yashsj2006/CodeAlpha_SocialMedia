const pool = require('../config/db');

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const viewerId = req.user ? req.user.id : null;

    const [users] = await pool.query(
      `SELECT id, full_name as fullName, username, bio,
              profile_picture as profilePicture, last_active as lastActive,
              created_at as createdAt
       FROM Users WHERE id = ?`,
      [userId]
    );
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });

    const user = users[0];

    const [[{ count: postsCount }]] = await pool.query(
      'SELECT COUNT(*) as count FROM Posts WHERE user_id = ? AND is_story = 0', [userId]
    );
    const [[{ count: followersCount }]] = await pool.query(
      "SELECT COUNT(*) as count FROM Followers WHERE following_id = ? AND status = 'accepted'", [userId]
    );
    const [[{ count: followingCount }]] = await pool.query(
      "SELECT COUNT(*) as count FROM Followers WHERE follower_id = ? AND status = 'accepted'", [userId]
    );

    let isFollowing = false;
    let followStatus = null; // null | 'pending' | 'accepted'
    let reverseFollowStatus = null;
    if (viewerId && viewerId !== parseInt(userId)) {
      const [f] = await pool.query(
        'SELECT status FROM Followers WHERE follower_id = ? AND following_id = ?',
        [viewerId, userId]
      );
      if (f.length > 0) {
        followStatus = f[0].status;
        isFollowing  = f[0].status === 'accepted';
      }
      const [rev] = await pool.query(
        'SELECT status FROM Followers WHERE follower_id = ? AND following_id = ?',
        [userId, viewerId]
      );
      if (rev.length > 0) {
        reverseFollowStatus = rev[0].status;
      }
    }

    // Get user posts
    const [posts] = await pool.query(`
      SELECT p.id, p.content, p.image_url as imageUrl, p.created_at as createdAt,
             (SELECT COUNT(*) FROM Likes WHERE post_id = p.id) as likesCount,
             (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as commentsCount
      FROM Posts p
      WHERE p.user_id = ? AND p.is_story = 0
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
      ORDER BY p.created_at DESC
    `, [userId]);

    res.json({ ...user, postsCount, followersCount, followingCount, isFollowing, followStatus, reverseFollowStatus, posts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, bio } = req.body;
    let profilePicture = req.user.profilePicture;

    if (req.file) {
      profilePicture = '/uploads/' + req.file.filename;
    }

    await pool.query(
      'UPDATE Users SET full_name = COALESCE(?, full_name), bio = COALESCE(?, bio), profile_picture = ? WHERE id = ?',
      [fullName || null, bio !== undefined ? bio : null, profilePicture, userId]
    );

    const [updatedUsers] = await pool.query(
      'SELECT id, full_name as fullName, username, bio, profile_picture as profilePicture FROM Users WHERE id = ?',
      [userId]
    );
    res.json(updatedUsers[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const keyword = req.query.q ? `%${req.query.q}%` : '%';
    const currentUserId = req.user ? req.user.id : null;

    const [users] = await pool.query(
      `SELECT id, full_name as fullName, username, bio,
              profile_picture as profilePicture, last_active as lastActive
       FROM Users
       WHERE (username LIKE ? OR full_name LIKE ?)
         AND id != ?`,
      [keyword, keyword, currentUserId || 0]
    );

    // Attach following status with pending/accepted distinction
    if (currentUserId) {
      const [f] = await pool.query(
        'SELECT following_id, status FROM Followers WHERE follower_id = ?',
        [currentUserId]
      );
      const followMap = {};
      f.forEach(r => { followMap[r.following_id] = r.status; });
      res.json(users.map(u => ({
        ...u,
        followStatus: followMap[u.id] || null
      })));
    } else {
      res.json(users.map(u => ({ ...u, followStatus: null })));
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

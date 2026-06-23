const pool = require('../config/db');

// POST /follow/:id  →  sends a follow request (status = pending)
exports.followUser = async (req, res) => {
  try {
    const followingId = parseInt(req.params.id);
    const followerId  = req.user.id;

    if (followingId === followerId)
      return res.status(400).json({ message: 'Cannot follow yourself' });

    const [existing] = await pool.query(
      'SELECT id, status FROM Followers WHERE follower_id = ? AND following_id = ?',
      [followerId, followingId]
    );
    if (existing.length > 0)
      return res.status(400).json({ message: existing[0].status === 'pending' ? 'Request already sent' : 'Already following' });

    await pool.query(
      'INSERT INTO Followers (follower_id, following_id, status) VALUES (?, ?, ?)',
      [followerId, followingId, 'pending']
    );

    // Notify target user about the follow request
    await pool.query(
      'INSERT INTO Notifications (user_id, actor_id, type) VALUES (?, ?, ?)',
      [followingId, followerId, 'follow_request']
    );

    res.json({ message: 'Follow request sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /follow/:id/accept  →  accept a pending request
exports.acceptFollow = async (req, res) => {
  try {
    const requesterId = parseInt(req.params.id); // the person who sent the request
    const userId      = req.user.id;             // the person accepting

    const [rows] = await pool.query(
      'SELECT id FROM Followers WHERE follower_id = ? AND following_id = ? AND status = ?',
      [requesterId, userId, 'pending']
    );
    if (!rows.length)
      return res.status(404).json({ message: 'No pending request found' });

    await pool.query(
      'UPDATE Followers SET status = ? WHERE follower_id = ? AND following_id = ?',
      ['accepted', requesterId, userId]
    );

    // Also create mutual follow relationship for messaging
    await pool.query(
      'INSERT IGNORE INTO Followers (follower_id, following_id, status) VALUES (?, ?, ?)',
      [userId, requesterId, 'accepted']
    );

    // Notify requester that they were accepted
    await pool.query(
      'INSERT INTO Notifications (user_id, actor_id, type) VALUES (?, ?, ?)',
      [requesterId, userId, 'follow_accept']
    );

    res.json({ message: 'Follow request accepted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /follow/:id/decline  →  decline / delete a pending request
exports.declineFollow = async (req, res) => {
  try {
    const requesterId = parseInt(req.params.id);
    const userId      = req.user.id;

    await pool.query(
      'DELETE FROM Followers WHERE follower_id = ? AND following_id = ? AND status = ?',
      [requesterId, userId, 'pending']
    );

    // Also completely remove the notification so it vanishes from the UI
    await pool.query(
      "DELETE FROM Notifications WHERE actor_id = ? AND user_id = ? AND type = 'follow_request'",
      [requesterId, userId]
    );

    res.json({ message: 'Follow request declined and removed completely' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /unfollow/:id  →  remove accepted follow OR cancel pending request
exports.unfollowUser = async (req, res) => {
  try {
    const followingId = parseInt(req.params.id);
    const followerId  = req.user.id;

    await pool.query(
      'DELETE FROM Followers WHERE follower_id = ? AND following_id = ?',
      [followerId, followingId]
    );

    res.json({ message: 'Unfollowed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /follow-requests  →  list pending requests directed at the logged-in user
exports.getFollowRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(`
      SELECT f.id, f.created_at as createdAt,
             u.id as requesterId, u.full_name as fullName,
             u.username, u.profile_picture as profilePicture, u.bio
      FROM Followers f
      JOIN Users u ON u.id = f.follower_id
      WHERE f.following_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

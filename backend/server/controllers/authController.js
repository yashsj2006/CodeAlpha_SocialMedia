const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.registerUser = async (req, res) => {
  const { fullName, username, email, password } = req.body;
  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    const [existingUsers] = await pool.query('SELECT * FROM Users WHERE email = ? OR username = ?', [email, username]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      'INSERT INTO Users (full_name, username, email, password) VALUES (?, ?, ?, ?)',
      [fullName, username, email, hashedPassword]
    );

    res.status(201).json({
      id: result.insertId,
      fullName,
      username,
      email,
      token: generateToken(result.insertId)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, identifier, password } = req.body;
  const loginId = identifier || email;
  if (!loginId || !password) {
    return res.status(400).json({ message: 'Please provide email/username and password' });
  }
  try {
    const [users] = await pool.query('SELECT * FROM Users WHERE email = ? OR username = ?', [loginId, loginId]);
    const user = users[0];

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        profilePicture: user.profile_picture,
        token: generateToken(user.id)
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.logoutUser = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

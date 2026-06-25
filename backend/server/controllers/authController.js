const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.registerUser = async (req, res) => {
  const { fullName, username, email, password } = req.body;
  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      full_name: fullName,
      username,
      email,
      password: hashedPassword
    });

    res.status(201).json({
      id: user._id,
      fullName: user.full_name,
      username: user.username,
      email: user.email,
      token: generateToken(user._id)
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
    const user = await User.findOne({ $or: [{ email: loginId }, { username: loginId }] });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        id: user._id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        profilePicture: user.profile_picture,
        token: generateToken(user._id)
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

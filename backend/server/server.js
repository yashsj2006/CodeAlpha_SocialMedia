const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = require('./config/db');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*', credentials: true }));

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Update last_active for authenticated requests
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await pool.query('UPDATE Users SET last_active = NOW() WHERE id = ?', [decoded.id]);
    } catch (_) { /* ignore */ }
  }
  next();
});

// Routes
app.use('/', require('./routes/authRoutes'));
app.use('/', require('./routes/userRoutes'));
app.use('/', require('./routes/postRoutes'));
app.use('/', require('./routes/followRoutes'));
app.use('/', require('./routes/notificationRoutes'));
app.use('/', require('./routes/messageRoutes'));

app.get('/', (req, res) => res.send('ConnectSphere API running...'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

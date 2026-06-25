const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('./config/db');
const { User } = require('./models');

// Connect to MongoDB
connectDB();

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*', credentials: true }));

// Socket.io Injection Middleware
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Update last_active for authenticated requests
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await User.findByIdAndUpdate(decoded.id, { last_active: Date.now() });
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

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // Allow client to join a room specific to their userId
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

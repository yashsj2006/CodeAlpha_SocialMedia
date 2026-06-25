const { Message, User } = require('../models');

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all messages involving the user
    const messages = await Message.find({
      $or: [{ sender_id: userId }, { receiver_id: userId }]
    }).sort({ createdAt: -1 });

    const me = await User.findById(userId);
    const myBlocked = me.blocked_users || [];

    const conversationsMap = new Map();
    for (const msg of messages) {
      const otherId = msg.sender_id.toString() === userId.toString() ? msg.receiver_id : msg.sender_id;
      if (!conversationsMap.has(otherId.toString())) {
        const otherUser = await User.findById(otherId);
        if (otherUser) {
          const theirBlocked = otherUser.blocked_users || [];
          if (!myBlocked.includes(otherId) && !theirBlocked.includes(userId)) {
            conversationsMap.set(otherId.toString(), {
              partnerId: otherUser._id,
              partnerFullName: otherUser.full_name,
              partnerUsername: otherUser.username,
              partnerProfilePicture: otherUser.profile_picture,
              content: msg.content,
              createdAt: msg.createdAt,
              isRead: msg.is_read,
              receiverId: msg.receiver_id
            });
          }
        }
      } else {
        if (msg.receiver_id.toString() === userId.toString() && !msg.is_read) {
          const conv = conversationsMap.get(otherId.toString());
          conv.unreadCount += 1;
        }
      }
    }

    res.json(Array.from(conversationsMap.values()));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const otherId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender_id: userId, receiver_id: otherId },
        { sender_id: otherId, receiver_id: userId }
      ]
    }).sort({ createdAt: 1 });

    // Mark as read
    await Message.updateMany(
      { sender_id: otherId, receiver_id: userId, is_read: false },
      { $set: { is_read: true } }
    );

    res.json(messages.map(m => ({
      id: m._id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      content: m.content,
      isRead: m.is_read,
      createdAt: m.createdAt
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const receiverId = req.params.userId;
    const senderId = req.user.id;

    if (!content || !content.trim()) return res.status(400).json({ message: 'Content required' });

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) return res.status(404).json({ message: 'User not found' });

    if (sender.blocked_users.includes(receiverId) || receiver.blocked_users.includes(senderId)) {
      return res.status(403).json({ message: 'You cannot send messages to this user' });
    }

    const msg = await Message.create({
      sender_id: senderId,
      receiver_id: receiverId,
      content
    });

    const newMessage = {
      id: msg._id,
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      content: msg.content,
      isRead: msg.is_read,
      createdAt: msg.createdAt
    };

    // Socket.io integration: Emit to receiver if connected
    if (req.io) {
      req.io.to(receiverId.toString()).emit('receiveMessage', newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({ receiver_id: req.user.id, is_read: false });
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const Communication = require('../models/Communication');
const Restaurant = require('../models/Restaurant');
const Billing = require('../models/Billing');

const createMessage = async (req, res) => {
  try {
    const { title, message, type, priority, recipients, specificRestaurants } = req.body;
    
    const communication = new Communication({
      title,
      message,
      type,
      priority,
      recipients,
      specificRestaurants: recipients === 'SPECIFIC' ? specificRestaurants : [],
      sentBy: req.user.userId
    });

    await communication.save();
    
    // Emit notification via WebSocket
    const io = req.app.get('io');
    if (io) {
      const populatedMessage = await Communication.findById(communication._id).populate('sentBy', 'name');
      
      if (recipients === 'ALL') {
        io.emit('new-notification', populatedMessage);
      } else if (recipients === 'SPECIFIC') {
        const restaurants = await Restaurant.find({ _id: { $in: specificRestaurants } });
        restaurants.forEach(restaurant => {
          io.to(restaurant.slug).emit('new-notification', populatedMessage);
        });
      } else {
        // For ACTIVE/TRIAL, emit to all and let client filter
        io.emit('new-notification', populatedMessage);
      }
    }
    
    res.status(201).json({ message: 'Message sent successfully', communication });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

const getMessages = async (req, res) => {
  try {
    const messages = await Communication.find()
      .populate('sentBy', 'name email')
      .populate('specificRestaurants', 'name slug')
      .sort({ sentAt: -1 });
    
    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

const getRestaurantMessages = async (req, res) => {
  try {
    const restaurantSlug = req.user.restaurantSlug;
    const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const billing = await Billing.findOne({ restaurantId: restaurant._id });
    const isOnTrial = billing && billing.trialEnd && new Date(billing.trialEnd) > new Date();
    
    // Get messages based on recipient criteria
    const query = {
      isActive: true,
      $or: [
        { recipients: 'ALL' },
        { recipients: 'ACTIVE', $and: [billing && billing.status === 'ACTIVE'] },
        { recipients: 'TRIAL', $and: [isOnTrial || billing?.plan === 'TRIAL'] },
        { recipients: 'SPECIFIC', specificRestaurants: restaurant._id }
      ]
    };

    const messages = await Communication.find(query)
      .populate('sentBy', 'name')
      .sort({ sentAt: -1 });
    
    // Add read status for this restaurant
    const messagesWithReadStatus = messages.map(msg => ({
      ...msg.toObject(),
      isRead: msg.readBy.some(read => read.restaurantId.toString() === restaurant._id.toString())
    }));
    
    res.json({ messages: messagesWithReadStatus });
  } catch (error) {
    console.error('Get restaurant messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    
    const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const communication = await Communication.findById(messageId);
    if (!communication) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const alreadyRead = communication.readBy.some(
      read => read.restaurantId.toString() === restaurant._id.toString()
    );
    
    if (!alreadyRead) {
      communication.readBy.push({
        restaurantId: restaurant._id,
        readAt: new Date()
      });
      await communication.save();
    }

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
};

module.exports = {
  createMessage,
  getMessages,
  getRestaurantMessages,
  markAsRead
};
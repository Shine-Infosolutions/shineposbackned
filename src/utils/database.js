const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 10000,
    });
    console.log('MongoDB connected successfully');

    mongoose.connection.on('disconnected', () => console.error('MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
    mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
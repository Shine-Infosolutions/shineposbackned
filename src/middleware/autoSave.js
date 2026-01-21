const mongoose = require('mongoose');

// Auto-save middleware for all schemas
const autoSaveMiddleware = function(schema) {
  // Pre-save hook to ensure data is always saved
  schema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
  });

  // Post-save hook for logging
  schema.post('save', function(doc) {
    // Silent save - no console logs
  });

  // Pre-update hooks for findOneAndUpdate, updateOne, etc.
  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
    this.setUpdate({ updatedAt: new Date() });
    next();
  });

  // Post-update hook
  schema.post(['findOneAndUpdate', 'updateOne', 'updateMany'], function(result) {
    // Silent update - no console logs
  });
};

// Apply to all schemas globally
mongoose.plugin(autoSaveMiddleware);

module.exports = autoSaveMiddleware;
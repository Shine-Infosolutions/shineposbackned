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
    console.log(`Auto-saved: ${this.constructor.modelName} - ${doc._id}`);
  });

  // Pre-update hooks for findOneAndUpdate, updateOne, etc.
  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
    this.setUpdate({ updatedAt: new Date() });
    next();
  });

  // Post-update hook
  schema.post(['findOneAndUpdate', 'updateOne', 'updateMany'], function(result) {
    if (result) {
      console.log(`Auto-updated: ${this.model.modelName}`);
    }
  });
};

// Apply to all schemas globally
mongoose.plugin(autoSaveMiddleware);

module.exports = autoSaveMiddleware;
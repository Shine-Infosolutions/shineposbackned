const ActivityLog = require('../models/ActivityLog');

const SENSITIVE_FIELDS = ['password', 'token', 'pin', 'cvv', 'cardNumber', 'otp'];

const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  const sanitized = { ...data };
  SENSITIVE_FIELDS.forEach(field => {
    if (sanitized[field]) sanitized[field] = '[REDACTED]';
  });
  return sanitized;
};

const logActivity = async (userId, action, resource, options = {}) => {
  try {
    const logData = {
      userId,
      userRole: options.userRole,
      restaurantSlug: options.restaurantSlug,
      action,
      resource,
      resourceId: options.resourceId || null,
      details: sanitizeData(options.details),
      reason: options.reason,
      beforeValue: options.beforeValue,
      afterValue: options.afterValue,
      shiftId: options.shiftId,
      ipAddress: options.req?.ip || options.req?.connection?.remoteAddress,
      userAgent: options.req?.get('User-Agent'),
      success: options.success !== false
    };

    await ActivityLog.create(logData);
  } catch (error) {
    console.error('❌ Activity logging failed:', error.message);
    // TODO: Alert monitoring system
  }
};

const activityLogger = (resource) => {
  return (req, res, next) => {
    const originalJson = res.json;
    const originalSend = res.send;
    
    const logResponse = function(data) {
      const statusCode = res.statusCode;
      
      if (req.user && statusCode >= 200 && statusCode < 300) {
        let action = 'VIEW';
        
        switch (req.method) {
          case 'POST': action = 'CREATE'; break;
          case 'PUT':
          case 'PATCH': action = 'UPDATE'; break;
          case 'DELETE': action = 'DELETE'; break;
          case 'GET': action = 'VIEW'; break;
        }

        logActivity(req.user.userId, action, resource, {
          userRole: req.user.role,
          restaurantSlug: req.user.restaurantSlug,
          resourceId: req.params.id,
          details: { method: req.method, url: req.originalUrl },
          req
        });
      }
    };
    
    res.json = function(data) {
      logResponse(data);
      return originalJson.call(this, data);
    };
    
    res.send = function(data) {
      logResponse(data);
      return originalSend.call(this, data);
    };
    
    next();
  };
};

const logBusinessAction = async (req, action, resource, details) => {
  return logActivity(req.user.userId, action, resource, {
    userRole: req.user.role,
    restaurantSlug: req.user.restaurantSlug,
    resourceId: details.resourceId,
    details: sanitizeData(details.data),
    reason: details.reason,
    beforeValue: details.before,
    afterValue: details.after,
    shiftId: details.shiftId,
    req
  });
};

const logFailedAction = async (req, action, resource, reason) => {
  if (!req.user) return;
  return logActivity(req.user.userId, action, resource, {
    userRole: req.user.role,
    restaurantSlug: req.user.restaurantSlug,
    reason,
    success: false,
    req
  });
};

module.exports = { logActivity, activityLogger, logBusinessAction, logFailedAction };
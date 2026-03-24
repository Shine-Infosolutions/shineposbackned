const ModuleConfig = require('../models/ModuleConfig');

// Cache with size cap to prevent unbounded memory growth
const moduleCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 500;

const getModuleConfig = async (restaurantId) => {
  const cacheKey = restaurantId.toString();
  const cached = moduleCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.config;
  }

  let config = await ModuleConfig.findOne({ restaurantId });
  if (!config) {
    config = await ModuleConfig.create({
      restaurantId,
      modules: {
        inventory: { enabled: true },
        orderTaking: { enabled: true },
        kot: { enabled: true }
      }
    });
  }

  // Evict oldest entry if at capacity
  if (moduleCache.size >= CACHE_MAX_SIZE) {
    moduleCache.delete(moduleCache.keys().next().value);
  }
  moduleCache.set(cacheKey, { config, timestamp: Date.now() });
  return config;
};

// Clear cache when config changes
const clearModuleCache = (restaurantId) => {
  moduleCache.delete(restaurantId.toString());
};

// Middleware factory
const checkModule = (moduleName) => {
  return async (req, res, next) => {
    try {
      const restaurantId = req.user?.restaurantId;
      
      if (!restaurantId) {
        return res.status(400).json({ error: 'Restaurant ID not found' });
      }

      const config = await getModuleConfig(restaurantId);
      const moduleEnabled = config.modules[moduleName]?.enabled;

      if (!moduleEnabled) {
        return res.status(403).json({ 
          error: 'Module disabled',
          message: `${moduleName} module is currently disabled by restaurant owner`,
          module: moduleName
        });
      }

      // Attach config to request for conditional logic
      req.moduleConfig = config.modules;
      next();
    } catch (error) {
      console.error('Module check error:', error);
      // Fail open for safety - allow request if check fails
      next();
    }
  };
};

// Helper to check module status in code (non-blocking)
const isModuleEnabled = async (restaurantId, moduleName) => {
  try {
    const config = await getModuleConfig(restaurantId);
    return config.modules[moduleName]?.enabled ?? true;
  } catch (error) {
    console.error('Module status check error:', error);
    return true; // Fail open
  }
};

module.exports = {
  checkModule,
  isModuleEnabled,
  getModuleConfig,
  clearModuleCache
};

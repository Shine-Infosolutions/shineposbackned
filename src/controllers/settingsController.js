const Settings = require('../models/Settings');

const getSettings = async (req, res) => {
  try {
    const settings = await Settings.find().sort({ category: 1, key: 1 });
    
    // Group settings by category
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    res.json({ settings: groupedSettings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

const updateSetting = async (req, res) => {
  try {
    const { key, value, category, description } = req.body;
    
    const setting = await Settings.findOneAndUpdate(
      { key },
      { 
        value, 
        category: category || 'GENERAL',
        description,
        updatedBy: req.user.userId,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json({ message: 'Setting updated successfully', setting });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
};

const deleteSetting = async (req, res) => {
  try {
    const { key } = req.params;
    
    const setting = await Settings.findOneAndDelete({ key });
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Delete setting error:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
};

const initializeDefaultSettings = async () => {
  const defaultSettings = [
    { key: 'APP_NAME', value: 'Restaurant SaaS', category: 'SYSTEM', description: 'Application name' },
    { key: 'MAINTENANCE_MODE', value: false, category: 'SYSTEM', description: 'Enable maintenance mode' },
    { key: 'MAX_RESTAURANTS', value: 1000, category: 'SYSTEM', description: 'Maximum number of restaurants' },
    { key: 'TRIAL_DAYS', value: 30, category: 'SYSTEM', description: 'Trial period in days' },
    { key: 'SMTP_HOST', value: '', category: 'EMAIL', description: 'SMTP server host' },
    { key: 'SMTP_PORT', value: 587, category: 'EMAIL', description: 'SMTP server port' },
    { key: 'SMTP_USER', value: '', category: 'EMAIL', description: 'SMTP username' },
    { key: 'SUPPORT_EMAIL', value: 'support@restaurantsaas.com', category: 'EMAIL', description: 'Support email address' },
    { key: 'STRIPE_ENABLED', value: false, category: 'PAYMENT', description: 'Enable Stripe payments' },
    { key: 'PAYPAL_ENABLED', value: false, category: 'PAYMENT', description: 'Enable PayPal payments' },
    { key: 'SESSION_TIMEOUT', value: 24, category: 'SECURITY', description: 'Session timeout in hours' },
    { key: 'PASSWORD_MIN_LENGTH', value: 6, category: 'SECURITY', description: 'Minimum password length' }
  ];

  for (const setting of defaultSettings) {
    const existing = await Settings.findOne({ key: setting.key });
    if (!existing) {
      await Settings.create(setting);
    }
  }
};

module.exports = {
  getSettings,
  updateSetting,
  deleteSetting,
  initializeDefaultSettings
};
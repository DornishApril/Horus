require('dotenv').config();
const path = require('path');
const { ensureDirectoryExists } = require('./utils/pathResolver');

// Default configuration
const defaultConfig = {
  server: {
    port: parseInt(process.env.SERVER_PORT, 10) || 4000,
    host: 'localhost',
    timeout: parseInt(process.env.SERVER_TIMEOUT, 10) || 60000
  },
  app: {
    defaultPort: parseInt(process.env.DEFAULT_APP_PORT, 10) || 3000,
    startupTimeout: parseInt(process.env.STARTUP_TIMEOUT, 10) || 60000,
    shutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT, 10) || 5000
  },
  browser: {
    headless: true,
    timeout: parseInt(process.env.BROWSER_TIMEOUT, 10) || 30000,
    viewport: { 
      width: 1920, 
      height: 1080,
      deviceScaleFactor: 1
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  },
  screenshot: {
    directory: process.env.SCREENSHOT_DIR || './screenshots',
    fullPage: true,
    format: 'png',
    quality: 80
  }
};

// Ensure screenshot directory exists
const ensureScreenshotDir = () => {
  try {
    return ensureDirectoryExists(defaultConfig.screenshot.directory);
  } catch (error) {
    console.error('Failed to create screenshot directory:', error);
    process.exit(1);
  }
};

// Validate configuration
const validateConfig = (config) => {
  const errors = [];
  
  // Validate server port
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Server port must be between 1 and 65535');
  }
  
  // Validate screenshot directory
  try {
    ensureScreenshotDir();
  } catch (error) {
    errors.push(`Invalid screenshot directory: ${error.message}`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join('; ')}`);
  }
  
  return true;
};

// Load and validate configuration
const loadConfig = (userConfig = {}) => {
  const config = {
    ...defaultConfig,
    ...userConfig,
    server: { ...defaultConfig.server, ...(userConfig.server || {}) },
    app: { ...defaultConfig.app, ...(userConfig.app || {}) },
    browser: { 
      ...defaultConfig.browser, 
      ...(userConfig.browser || {}),
      viewport: { 
        ...defaultConfig.browser.viewport, 
        ...(userConfig.browser?.viewport || {}) 
      }
    },
    screenshot: { 
      ...defaultConfig.screenshot, 
      ...(userConfig.screenshot || {}) 
    }
  };
  
  validateConfig(config);
  return config;
};

// Initialize and validate config on load
const config = loadConfig();

// Get configuration sections
const getServerConfig = () => config.server;
const getBrowserConfig = () => config.browser;
const getScreenshotConfig = () => config.screenshot;
const getAppConfig = () => config.app;

// Export the config object as default (for processManager.js compatibility)
module.exports = config;

// Also export utility functions as named exports
module.exports.loadConfig = loadConfig;
module.exports.validateConfig = validateConfig;
module.exports.getServerConfig = getServerConfig;
module.exports.getBrowserConfig = getBrowserConfig;
module.exports.getScreenshotConfig = getScreenshotConfig;
module.exports.getAppConfig = getAppConfig;
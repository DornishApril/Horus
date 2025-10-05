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
    startupTimeout: 60000
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

// Get configuration sections
const getServerConfig = () => loadConfig().server;
const getBrowserConfig = () => loadConfig().browser;
const getScreenshotConfig = () => loadConfig().screenshot;

module.exports = {
  loadConfig,
  validateConfig,
  getServerConfig,
  getBrowserConfig,
  getScreenshotConfig
};

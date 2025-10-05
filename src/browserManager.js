const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { ensureDirectoryExists } = require('./utils/pathResolver');
const logger = require('./utils/logger');
const config = require('./config');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.pages = new Map();
  }

  async launch() {
    if (this.browser) {
      logger.warn('Browser is already running');
      return this.browser;
    }

    const browserConfig = config.getBrowserConfig();
    
    try {
      logger.info('Launching browser...');
      this.browser = await puppeteer.launch({
        headless: browserConfig.headless ? 'new' : false,
        args: browserConfig.args,
        defaultViewport: browserConfig.viewport,
        timeout: browserConfig.timeout,
        ignoreHTTPSErrors: true,
        dumpio: process.env.NODE_ENV === 'development'
      });

      this.browser.on('disconnected', () => {
        logger.warn('Browser was disconnected');
        this.browser = null;
      });

      logger.success('Browser launched successfully');
      return this.browser;
    } catch (error) {
      logger.error('Failed to launch browser', error);
      throw error;
    }
  }

  async close() {
    if (!this.browser) {
      logger.warn('No browser instance to close');
      return;
    }

    try {
      // Close all pages first
      const pages = await this.browser.pages();
      await Promise.all(pages.map(page => page.close()));
      
      // Close the browser
      await this.browser.close();
      this.browser = null;
      this.pages.clear();
      
      logger.info('Browser closed successfully');
    } catch (error) {
      logger.error('Error while closing browser', error);
      throw error;
    }
  }

  async createPage() {
    if (!this.browser) {
      await this.launch();
    }

    try {
      const page = await this.browser.newPage();
      const pageId = Math.random().toString(36).substring(2, 9);
      
      // Set default navigation timeout
      page.setDefaultNavigationTimeout(config.getBrowserConfig().timeout);
      
      // Set default viewport
      await page.setViewport(config.getBrowserConfig().viewport);
      
      // Add basic error handling
      page.on('pageerror', (error) => {
        logger.error(`Page error: ${error.message}`);
      });

      page.on('requestfailed', (request) => {
        logger.warn(`Request failed: ${request.url()} (${request.failure().errorText})`);
      });

      this.pages.set(pageId, page);
      
      logger.debug(`Created new page with ID: ${pageId}`);
      return { pageId, page };
      
    } catch (error) {
      logger.error('Failed to create new page', error);
      throw error;
    }
  }

  async closePage(pageId) {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`No page found with ID: ${pageId}`);
    }

    try {
      await page.close();
      this.pages.delete(pageId);
      logger.debug(`Closed page with ID: ${pageId}`);
    } catch (error) {
      logger.error(`Error closing page ${pageId}`, error);
      throw error;
    }
  }

  async navigateToUrl(pageId, url, options = {}) {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`No page found with ID: ${pageId}`);
    }

    const {
      waitUntil = 'networkidle2',
      timeout = config.getBrowserConfig().timeout,
      waitForSelector,
      waitForTimeout = 2000
    } = options;

    try {
      logger.info(`Navigating to: ${url}`);
      await page.goto(url, { waitUntil, timeout });
      
      // Wait for additional selector if specified
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: waitForTimeout })
          .catch(error => {
            logger.warn(`Selector '${waitForSelector}' not found: ${error.message}`);
          });
      }
      
      // Wait for network to be idle
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', () => resolve(), { once: true });
          }
        });
      });
      
      logger.debug(`Successfully navigated to: ${url}`);
      return page;
      
    } catch (error) {
      logger.error(`Failed to navigate to ${url}`, error);
      throw error;
    }
  }

  async takeScreenshot(pageId, options = {}) {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`No page found with ID: ${pageId}`);
    }

    const screenshotConfig = config.getScreenshotConfig();
    const {
      fullPage = screenshotConfig.fullPage,
      path: filePath,
      type = screenshotConfig.format,
      quality = screenshotConfig.quality,
      clip
    } = options;

    try {
      // Ensure the directory exists
      const dir = filePath ? path.dirname(filePath) : screenshotConfig.directory;
      await ensureDirectoryExists(dir);
      
      // Generate a filename if not provided
      const screenshotPath = filePath || path.join(
        dir,
        `screenshot-${Date.now()}.${type}`
      );
      
      const screenshotOptions = {
        type,
        fullPage,
        ...(type === 'jpeg' && { quality }),
        ...(clip && { clip })
      };
      
      logger.info(`Taking screenshot: ${screenshotPath}`);
      await page.screenshot({ ...screenshotOptions, path: screenshotPath });
      
      logger.success(`Screenshot saved to: ${screenshotPath}`);
      return {
        path: screenshotPath,
        size: fs.statSync(screenshotPath).size,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Failed to take screenshot', error);
      throw error;
    }
  }

  async evaluate(pageId, pageFunction, ...args) {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`No page found with ID: ${pageId}`);
    }

    try {
      return await page.evaluate(pageFunction, ...args);
    } catch (error) {
      logger.error('Failed to evaluate script on page', error);
      throw error;
    }
  }
}

module.exports = new BrowserManager();

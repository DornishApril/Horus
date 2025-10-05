require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const processManager = require('./processManager');
const screenshotService = require('./screenshotService');
const config = require('./config');
const logger = require('./utils/logger');
const { ensureDirectoryExists } = require('./utils/pathResolver');

class ScreenshotServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Enable CORS
    this.app.use(cors());
    
    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    
    // Logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
      });
      
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API routes
    const apiRouter = express.Router();
    
    // Process management endpoints
    apiRouter.post('/process/start', async (req, res, next) => {
      try {
        const { projectPath, port, env } = req.body;
        
        if (!projectPath) {
          return res.status(400).json({ error: 'projectPath is required' });
        }
        
        const processInfo = await processManager.start(projectPath, { port, env });
        res.json(processInfo);
      } catch (error) {
        next(error);
      }
    });
    
    apiRouter.post('/process/stop/:processId', async (req, res, next) => {
      try {
        const { processId } = req.params;
        await processManager.stop(processId);
        res.json({ success: true, message: `Process ${processId} stopped` });
      } catch (error) {
        next(error);
      }
    });
    
    apiRouter.get('/process', (req, res) => {
      const processes = processManager.listProcesses();
      res.json(processes);
    });
    
    // Screenshot endpoints
    apiRouter.post('/screenshot', async (req, res, next) => {
      try {
        const { url, options } = req.body;
        
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }
        
        const result = await screenshotService.capturePageScreenshot(url, options || {});
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
    
    apiRouter.post('/screenshot/batch', async (req, res, next) => {
      try {
        const { urls, options } = req.body;
        
        if (!Array.isArray(urls) || urls.length === 0) {
          return res.status(400).json({ error: 'URLs array is required' });
        }
        
        const result = await screenshotService.captureMultipleScreenshots(urls, options || {});
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
    
    apiRouter.get('/screenshot', (req, res) => {
      const screenshots = screenshotService.listScreenshots();
      res.json(screenshots);
    });
    
    apiRouter.get('/screenshot/:id', (req, res, next) => {
      try {
        const { id } = req.params;
        const info = screenshotService.getScreenshotInfo(id);
        res.json(info);
      } catch (error) {
        next(error);
      }
    });
    
    // Serve static files from the screenshots directory
    apiRouter.use('/screenshots', express.static(config.getScreenshotConfig().directory));
    
    // Mount the API router
    this.app.use('/api', apiRouter);
    
    // Serve the frontend if in production
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static(path.join(__dirname, '../client/build')));
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build/index.html'));
      });
    }
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res, next) => {
      res.status(404).json({ error: 'Not Found' });
    });
    
    // Error handler
    this.app.use((err, req, res, next) => {
      logger.error('Error:', err);
      
      const statusCode = err.statusCode || 500;
      const message = err.message || 'Internal Server Error';
      
      res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
  }

  async start(port = config.getServerConfig().port) {
    try {
      // Ensure required directories exist
      await ensureDirectoryExists(config.getScreenshotConfig().directory);
      
      // Start the server
      this.server = this.app.listen(port, () => {
        logger.success(`Server is running on http://localhost:${port}`);
        logger.info(`Screenshots directory: ${path.resolve(config.getScreenshotConfig().directory)}`);
      });
      
      // Handle server errors
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${port} is already in use`);
          process.exit(1);
        }
        throw error;
      });
      
      // Handle process termination
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));
      
      return this.server;
    } catch (error) {
      logger.error('Failed to start server', error);
      throw error;
    }
  }

  async shutdown() {
    logger.info('Shutting down server...');
    
    try {
      // Stop all running processes
      await processManager.stopAll();
      
      // Close the HTTP server
      if (this.server) {
        this.server.close(() => {
          logger.info('Server has been stopped');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new ScreenshotServer();
  server.start().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ScreenshotServer;

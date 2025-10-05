const net = require('net');
const { EventEmitter } = require('events');
const logger = require('./logger');

const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.debug(`Port ${port} is already in use`);
          resolve(false);
        } else {
          logger.error(`Error checking port ${port}`, err);
          resolve(false);
        }
      })
      .once('listening', () => {
        server.once('close', () => {
          resolve(true);
        }).close();
      })
      .listen(port);
  });
};

const findAvailablePort = async (startPort = 3000, endPort = 4000) => {
  for (let port = startPort; port <= endPort; port++) {
    const available = await isPortAvailable(port);
    if (available) {
      logger.debug(`Found available port: ${port}`);
      return port;
    }
  }
  throw new Error(`No available ports found in range ${startPort}-${endPort}`);
};

const waitForPort = (port, timeout = 10000) => {
  const emitter = new EventEmitter();
  const startTime = Date.now();
  
  const checkPort = async () => {
    try {
      const available = await isPortAvailable(port);
      if (!available) {
        emitter.emit('listening');
        return;
      }
      
      if (Date.now() - startTime >= timeout) {
        emitter.emit('timeout');
        return;
      }
      
      setTimeout(checkPort, 100);
    } catch (error) {
      emitter.emit('error', error);
    }
  };
  
  checkPort();
  return emitter;
};

module.exports = {
  isPortAvailable,
  findAvailablePort,
  waitForPort
};

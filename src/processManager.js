const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { isPortAvailable, waitForPort } = require('./utils/portChecker');
const { validateProjectPath, resolveAbsolutePath } = require('./utils/pathResolver');
const logger = require('./utils/logger');
const config = require('./config');

class DevServerManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map();
  }

  async detectPackageManager(projectPath) {
    try {
      const absolutePath = resolveAbsolutePath(projectPath);
      logger.debug(`Detecting package manager in: ${absolutePath}`);
      
      // Check for lock files to determine package manager
      const pnpmLockPath = path.join(absolutePath, 'pnpm-lock.yaml');
      const yarnLockPath = path.join(absolutePath, 'yarn.lock');
      const packageLockPath = path.join(absolutePath, 'package-lock.json');
      
      // Check which package manager files exist
      const [hasPnpmLock, hasYarnLock, hasPackageLock] = await Promise.all([
        fs.promises.access(pnpmLockPath).then(() => true).catch(() => false),
        fs.promises.access(yarnLockPath).then(() => true).catch(() => false),
        fs.promises.access(packageLockPath).then(() => true).catch(() => false)
      ]);
      
      // Determine package manager based on lock files
      if (hasPnpmLock) {
        logger.debug('Detected pnpm as package manager');
        return 'pnpm';
      }
      
      if (hasYarnLock) {
        logger.debug('Detected yarn as package manager');
        return 'yarn';
      }
      
      if (hasPackageLock) {
        logger.debug('Detected npm as package manager (package-lock.json found)');
        return 'npm';
      }
      
      // If no lock files, check for package.json scripts
      try {
        const packageJsonPath = path.join(absolutePath, 'package.json');
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
        
        if (packageJson.scripts && packageJson.scripts.dev) {
          logger.debug('No lock file found, using npm as default package manager');
          return 'npm';
        }
      } catch (error) {
        logger.warn('Error reading package.json:', error);
      }
      
      // Default to npm if no lock files are found
      logger.info('No package manager lock file found, defaulting to npm');
      return 'npm';
      
    } catch (error) {
      logger.error('Error detecting package manager:', error);
      // Default to npm if there's an error
      return 'npm';
    }
  }

  async start(projectPath, options = {}) {
    try {
      const absolutePath = resolveAbsolutePath(projectPath);
      validateProjectPath(absolutePath);
      
      const port = options.port || await this.findAvailablePort();
      const packageManager = await this.detectPackageManager(absolutePath);
      
      const env = {
        ...process.env,
        PORT: port,
        BROWSER: 'none',
        FORCE_COLOR: '1',
        ...options.env
      };
      
      // On Windows, we need to use the .cmd extension for package managers
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'cmd.exe' : packageManager;
      const args = isWindows 
        ? ['/c', `${packageManager}.cmd`, 'run', 'dev'] 
        : ['run', 'dev'];
      
      logger.info(`Starting dev server with ${packageManager} on port ${port}`);
      
      const child = spawn(command, args, {
        cwd: absolutePath,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      const processId = child.pid;
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        logger.debug(`[${processId}] ${output.trim()}`);
        this.emit('stdout', { processId, data: output });
      });
      
      child.stderr.on('data', (data) => {
        const output = data.toString();
        logger.error(`[${processId}] ${output.trim()}`);
        this.emit('stderr', { processId, data: output });
      });
      
      child.on('close', (code) => {
        logger.warn(`Process ${processId} exited with code ${code}`);
        this.processes.delete(processId);
        this.emit('close', { processId, code });
      });
      
      const processInfo = {
        id: processId,
        port,
        projectPath: absolutePath,
        startTime: new Date(),
        process: child
      };
      
      this.processes.set(processId, processInfo);
      
      // Wait for the server to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error(`Server did not start within ${config.app.startupTimeout}ms`));
        }, config.app.startupTimeout);
        
        const onListening = () => {
          cleanup();
          resolve(processInfo);
        };
        
        const onError = (err) => {
          cleanup();
          reject(err);
        };
        
        const cleanup = () => {
          clearTimeout(timeout);
          child.removeListener('exit', onError);
          child.removeListener('error', onError);
          child.stdout.removeListener('data', checkReady);
        };
        
        const checkReady = (data) => {
          const output = data.toString();
          
          // Check for common ready indicators
          if (
            output.includes('ready - started server on') || // Next.js
            output.includes('Compiled successfully') || // Create React App
            output.includes(`Local:   http://localhost:${port}`) // Vite
          ) {
            onListening();
          }
        };
        
        child.on('exit', onError);
        child.on('error', onError);
        child.stdout.on('data', checkReady);
        
        // Also check if port is in use as an additional ready check
        waitForPort(port, config.app.startupTimeout)
          .on('listening', onListening)
          .on('timeout', () => {
            cleanup();
            reject(new Error(`Port ${port} did not become available within timeout`));
          })
          .on('error', onError);
      });
      
      logger.success(`Dev server started successfully (PID: ${processId}, Port: ${port})`);
      return processInfo;
      
    } catch (error) {
      logger.error('Failed to start dev server', error);
      throw error;
    }
  }

  async stop(processId) {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      throw new Error(`No process found with ID: ${processId}`);
    }
    
    return new Promise((resolve) => {
      processInfo.process.on('close', () => {
        this.processes.delete(processId);
        logger.info(`Stopped process ${processId}`);
        resolve();
      });
      
      processInfo.process.kill('SIGTERM');
      
      // Force kill if process doesn't exit gracefully
      setTimeout(() => {
        if (this.processes.has(processId)) {
          processInfo.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  async stopAll() {
    const stopPromises = [];
    for (const processId of this.processes.keys()) {
      stopPromises.push(this.stop(processId));
    }
    await Promise.all(stopPromises);
  }

  async findAvailablePort(startPort = config.app.defaultPort) {
    const port = await isPortAvailable(startPort) 
      ? startPort 
      : await findAvailablePort(startPort, startPort + 100);
    return port;
  }

  getProcessInfo(processId) {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      throw new Error(`No process found with ID: ${processId}`);
    }
    return { ...processInfo, process: undefined }; // Don't expose the actual process object
  }

  listProcesses() {
    return Array.from(this.processes.values()).map(({ process, ...info }) => ({
      ...info,
      running: !process.killed
    }));
  }
}

module.exports = new DevServerManager();

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const normalizePath = (pathStr) => {
  return path.normalize(pathStr).replace(/\\/g, '/');
};

const resolveAbsolutePath = (pathStr) => {
  return path.isAbsolute(pathStr) 
    ? normalizePath(pathStr) 
    : normalizePath(path.resolve(process.cwd(), pathStr));
};

const ensureDirectoryExists = (dirPath) => {
  try {
    const absolutePath = resolveAbsolutePath(dirPath);
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
      logger.debug(`Created directory: ${absolutePath}`);
    }
    return absolutePath;
  } catch (error) {
    logger.error(`Failed to create directory: ${dirPath}`, error);
    throw error;
  }
};

const validateProjectPath = (projectPath) => {
  try {
    const absolutePath = resolveAbsolutePath(projectPath);
    const packageJsonPath = path.join(absolutePath, 'package.json');
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Directory does not exist: ${absolutePath}`);
    }
    
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`No package.json found in: ${absolutePath}`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Invalid project path: ${projectPath}`, error);
    throw error;
  }
};

module.exports = {
  normalizePath,
  resolveAbsolutePath,
  ensureDirectoryExists,
  validateProjectPath
};

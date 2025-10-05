const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

const getTimestamp = () => {
  return new Date().toISOString();
};

const logger = {
  info: (message) => {
    console.log(`[${getTimestamp()}] ${colors.blue}INFO${colors.reset}: ${message}`);
  },
  
  error: (message, error = null) => {
    console.error(`[${getTimestamp()}] ${colors.red}ERROR${colors.reset}: ${message}`);
    if (error) {
      console.error(error);
    }
  },
  
  success: (message) => {
    console.log(`[${getTimestamp()}] ${colors.green}SUCCESS${colors.reset}: ${message}`);
  },
  
  warn: (message) => {
    console.warn(`[${getTimestamp()}] ${colors.yellow}WARN${colors.reset}: ${message}`);
  },
  
  debug: (message) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${getTimestamp()}] ${colors.magenta}DEBUG${colors.reset}: ${message}`);
    }
  }
};

module.exports = logger;

class Logger {
  constructor(moduleName = 'System') {
    this.moduleName = moduleName;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
    const extraArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'string' ? arg : JSON.stringify(arg)
    ).join(' ') : '';

    return `[${timestamp}] [${level.toUpperCase()}] [${this.moduleName}] ${formattedMessage}${extraArgs}`;
  }

  error(message, ...args) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, ...args));
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, ...args));
    }
  }

  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, ...args));
    }
  }
}

module.exports = Logger;

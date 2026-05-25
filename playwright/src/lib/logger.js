const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['DBS_PASSWORD', 'password', '*.password', '*.DBS_PASSWORD'],
});

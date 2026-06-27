const path = require('path');

module.exports = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  SESSION_SECRET: process.env.SESSION_SECRET || 'chem-inventory-dev-secret-change-me',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

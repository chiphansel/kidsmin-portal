const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASS,
  database: config.DB_NAME,
  connectionLimit: 10,
  timezone: 'Z', // use UTC
  supportBigNumbers: true,
  multipleStatements: false,
});

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params),
  getConnection: () => pool.getConnection(),
};

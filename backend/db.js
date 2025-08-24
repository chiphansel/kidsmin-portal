const mysql = require('mysql2/promise');
const { db } = require('./config');

const pool = mysql.createPool({
  host: db.host,
  user: db.user,
  password: db.password,
  database: db.database,
  waitForConnections: db.waitForConnections,
  connectionLimit: db.connectionLimit,
  dateStrings: true
});

module.exports = pool;

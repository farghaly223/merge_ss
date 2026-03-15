'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:               process.env.DB_HOST     || 'localhost',
      port:               parseInt(process.env.DB_PORT || '3306'),
      database:           process.env.DB_NAME     || 'animal_merge',
      user:               process.env.DB_USER     || 'root',
      password:           process.env.DB_PASS     || '',
      waitForConnections: true,
      connectionLimit:    10,
      queueLimit:         0,
      charset:            'utf8mb4',
    });
  }
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function testConnection() {
  const rows = await query('SELECT 1 AS ok');
  return rows[0].ok === 1;
}

module.exports = { query, testConnection, getPool };

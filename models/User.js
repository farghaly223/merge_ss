'use strict';
const { query } = require('./db');

const User = {
  async findByUsername(username) {
    const rows = await query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    return rows[0] || null;
  },

  async findById(id) {
    const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async create(username, hashedPassword) {
    const result = await query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );
    return result.insertId;
  },

  async updateFingerprint(id, fingerprint) {
    await query('UPDATE users SET fingerprint = ? WHERE id = ?', [fingerprint, id]);
  },

  async updateLastLogin(id) {
    await query('UPDATE users SET last_login = NOW() WHERE id = ?', [id]);
  },

  async incrementSolveCount(id) {
    await query('UPDATE users SET solve_count = solve_count + 1 WHERE id = ?', [id]);
  },

  async setApproved(id, approved) {
    await query('UPDATE users SET is_approved = ? WHERE id = ?', [approved ? 1 : 0, id]);
  },

  async resetFingerprint(id) {
    await query('UPDATE users SET fingerprint = NULL WHERE id = ?', [id]);
  },

  async deleteById(id) {
    await query('DELETE FROM users WHERE id = ?', [id]);
  },

  async listNonAdmins() {
    return query(
      'SELECT id, username, is_approved, solve_count, fingerprint, created_at, last_login FROM users WHERE is_admin = 0 ORDER BY created_at DESC'
    );
  },

  async countStats() {
    const rows = await query(`
      SELECT
        SUM(is_admin = 0)                        AS total,
        SUM(is_admin = 0 AND is_approved = 1)    AS approved,
        SUM(is_admin = 0 AND is_approved = 0)    AS pending
      FROM users
    `);
    return rows[0];
  },
};

const SolveLog = {
  async add(userId, boardState, bestMove, score) {
    await query(
      'INSERT INTO solve_logs (user_id, board_state, best_move, score) VALUES (?, ?, ?, ?)',
      [userId, boardState, bestMove, score || 0]
    );
  },

  async count() {
    const rows = await query('SELECT COUNT(*) AS n FROM solve_logs');
    return rows[0].n;
  },
};

module.exports = { User, SolveLog };

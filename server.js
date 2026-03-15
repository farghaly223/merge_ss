'use strict';
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');

// استيراد الـ Sequelize والـ Models
const { sequelize, testConnection } = require('./models/db'); 
const { User } = require('./models/User');
const { solveIDDFS, validateGrid } = require('./solver');

const app  = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* Rate limiters */
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { ok: false, error: 'Too many attempts — wait 15 minutes.' }
});

const solveLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { ok: false, error: 'Too many solve requests.' }
});

/* ── JWT middleware ── */
async function requireAuth(req, res, next) {
  const h = (req.headers['authorization'] || '').trim();
  if (!h.startsWith('Bearer '))
    return res.status(401).json({ ok: false, error: 'Not logged in' });
  try {
    const p = jwt.verify(h.slice(7), SECRET);
    const user = await User.findByPk(p.id); // استخدام findByPk للـ Sequelize
    if (!user) return res.status(401).json({ ok: false, error: 'Account not found' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Session expired' });
  }
}

/* ════════════════════════════════════════
   API ROUTES
════════════════════════════════════════ */

// 1. تسجيل مستخدم جديد
app.post('/api/auth/register', loginLimit, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || password.length < 6) return res.status(400).json({ ok: false, error: 'Invalid data' });

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) return res.status(409).json({ ok: false, error: 'Username taken' });

    const hash = await bcrypt.hash(password, 10);
    
    // إنشاء باستخدام Sequelize Object
    await User.create({ 
      username: username, 
      password: hash 
    });

    res.status(201).json({ ok: true, message: 'Account created! Needs admin approval.' });
  } catch (e) {
    console.error('[REGISTER ERROR]', e);
    res.status(500).json({ ok: false, error: 'DB Error: ' + e.message });
  }
});

// 2. تسجيل الدخول
app.post('/api/auth/login', loginLimit, async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ ok: false, error: 'Wrong credentials' });

    // تحديث آخر ظهور
    user.last_login = new Date();
    await user.save();

    const token = jwt.sign({ id: user.id, is_admin: !!user.is_admin }, SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, user: { username: user.username, is_approved: !!user.is_approved, is_admin: !!user.is_admin } });
  } catch (e) {
    console.error('[LOGIN ERROR]', e);
    res.status(500).json({ ok: false, error: 'Login Error: ' + e.message });
  }
});

app.post('/api/solve', requireAuth, solveLimit, async (req, res) => {
  try {
    if (!req.user.is_approved && !req.user.is_admin) 
      return res.status(403).json({ ok: false, error: 'Pending approval' });
    
    const { grid } = req.body;
    if (!validateGrid(grid)) return res.status(400).json({ ok: false, error: 'Invalid grid' });
    
    const result = solveIDDFS(grid);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Solver error' });
  }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

/* ════════════════════════════════════════
   START ENGINE - الجرافة
════════════════════════════════════════ */
async function start() {
  console.log('🛠️ VERSION 3.0: Starting System...');
  try {
    await testConnection();
    console.log('✅ DB Connection Verified.');

    // السطر السحري: بناء الجداول بناءً على الـ Model الجديد
    await sequelize.sync({ alter: true });
    console.log('✅ DATABASE SYNCED & TABLES CREATED!');

    app.listen(PORT, () => {
      console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
    });
  } catch (e) {
    console.error('❌ FATAL BOOT ERROR:', e.message);
  }
}

start();

module.exports = app;

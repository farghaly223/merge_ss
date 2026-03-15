'use strict';
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');

// استيراد الـ Sequelize instance
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
    const user = await User.findById(p.id);
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

app.post('/api/auth/register', loginLimit, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || password.length < 6) return res.status(400).json({ ok: false, error: 'Invalid data' });

    if (await User.findByUsername(username))
      return res.status(409).json({ ok: false, error: 'Username taken' });

    const hash = await bcrypt.hash(password, 10);
    await User.create(username, hash);
    res.status(201).json({ ok: true, message: 'Account created! Needs admin approval.' });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'DB Error: ' + e.message });
  }
});

app.post('/api/auth/login', loginLimit, async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ ok: false, error: 'Wrong credentials' });

    await User.updateLastLogin(user.id);
    const token = jwt.sign({ id: user.id, is_admin: !!user.is_admin }, SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, user: { username: user.username, is_approved: !!user.is_approved, is_admin: !!user.is_admin } });
  } catch (e) {
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
   START ENGINE - الجرافة اللي هتبني الداتابيز
════════════════════════════════════════ */
async function start() {
  console.log('🛠️ Starting Boot Sequence...');
  try {
    // التأكد من الاتصال
    await sequelize.authenticate();
    console.log('✅ Connection to Aiven has been established successfully.');

    // بناء الجداول أوتوماتيكياً بناءً على الموديلات الجديدة
    // السطر ده هو اللي هيحل مشكلة "Table doesn't exist" نهائياً
    await sequelize.sync({ alter: true });
    console.log('✅ DATABASE SYNCED & TABLES CREATED!');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 SERVER IS LIVE ON PORT ${PORT}`);
    });
  } catch (e) {
    console.error('❌ FATAL BOOT ERROR:', e.message);
  }
}

start();

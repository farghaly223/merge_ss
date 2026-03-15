'use strict';
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const path      = require('path');

// استيراد الـ Sequelize instance من ملف الـ models بتاعك
// تأكد أن ملف models/db.js يحتوي على إعدادات الـ SSL كما اتفقنا
const { sequelize, testConnection } = require('./models/db'); 
const { User, SolveLog }           = require('./models/User');
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
    const p    = jwt.verify(h.slice(7), SECRET);
    const user = await User.findById(p.id);
    if (!user) return res.status(401).json({ ok: false, error: 'Account not found' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Session expired — please log in again' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user.is_admin)
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  next();
}

/* ════════════════════════════════════════
   POST /api/auth/register
════════════════════════════════════════ */
app.post('/api/auth/register', loginLimit, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || username.length < 3) return res.status(400).json({ ok: false, error: 'Username must be at least 3 chars' });
    if (!password || password.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 chars' });

    if (await User.findByUsername(username))
      return res.status(409).json({ ok: false, error: 'Username already taken' });

    const hash = await bcrypt.hash(password, 10);
    await User.create(username, hash);

    res.status(201).json({ ok: true, message: 'Account created! Admin approval required.' });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Server error: ' + e.message });
  }
});

/* ════════════════════════════════════════
   POST /api/auth/login
════════════════════════════════════════ */
app.post('/api/auth/login', loginLimit, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    const user = await User.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ ok: false, error: 'Wrong username or password' });

    await User.updateLastLogin(user.id);

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: !!user.is_admin },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({ ok: true, token, user: { id: user.id, username: user.username, is_approved: !!user.is_approved, is_admin: !!user.is_admin } });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Server error: ' + e.message });
  }
});

/* ════════════════════════════════════════
   POST /api/solve
════════════════════════════════════════ */
app.post('/api/solve', requireAuth, solveLimit, async (req, res) => {
  try {
    const u = req.user;
    if (!u.is_approved && !u.is_admin) return res.status(403).json({ ok: false, error: 'Pending approval' });

    const { grid } = req.body;
    if (!validateGrid(grid)) return res.status(400).json({ ok: false, error: 'Invalid grid' });

    const result = solveIDDFS(grid); // افتراضاً أن الـ solver جاهز
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Solver error: ' + e.message });
  }
});

// ... يمكنك إضافة بقية الـ Admin Routes هنا بنفس الطريقة ...

/* SPA fallback */
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

/* ════════════════════════════════════════
   START - تشغيل السيرفر والداتابيز
════════════════════════════════════════ */
/* ════════════════════════════════════════
   START - تشغيل السيرفر والداتابيز
════════════════════════════════════════ */
async function start() {
  console.log('\n🐉 Starting Server...');
  try {
    await testConnection();
    
    // الحل القاتل: تنفيذ SQL يدوي لإنشاء الجداول لو مش موجودة
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        is_approved TINYINT(1) DEFAULT 0,
        is_admin TINYINT(1) DEFAULT 0,
        fingerprint VARCHAR(255) DEFAULT NULL,
        solve_count INT DEFAULT 0,
        last_login DATETIME DEFAULT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Users table is ready (Manually Created)');

    // كود إضافي لإنشاء جدول الـ logs لو محتاجه
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS solve_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        grid_json TEXT,
        move VARCHAR(10),
        score INT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 SERVER IS LIVE!');
    });
  } catch (e) {
    console.error('❌ FATAL ERROR:', e.message);
  }
}
// تشغيل الفانكشن
start();

// مهم جداً لـ Vercel
module.exports = app;

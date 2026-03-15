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
  console.log('\n🐉 Animal Merge Solver — Starting...');
  try {
    // 1. اختبار الاتصال الأساسي
    await testConnection();
    console.log('✅ Database connected');

    // 2. الجزء السحري: بناء الجداول أوتوماتيكياً (Sync)
    // ده اللي هيحل مشكلة "Table doesn't exist"
    await sequelize.sync({ alter: true });
    console.log("✅ Database tables are synced & ready!");

    // 3. تشغيل السماع للطلبات (Listen)
    app.listen(PORT, '0.0.0.0', () => {
      console.log('✅ Server running at port: ' + PORT);
      console.log('🚀 Go to your website and Register now!');
    });

  } catch (e) {
    console.error('❌ Database connection FAILED:', e.message);
    // لو فيه مشكلة في الـ IP Allowance أو الباسورد هيظهر هنا
    process.exit(1);
  }
}

// تشغيل الفانكشن
start();

// مهم جداً لـ Vercel
module.exports = app;

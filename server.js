'use strict';
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const path      = require('path');

const { testConnection }           = require('./models/db');
const { User, SolveLog }           = require('./models/User');
const { solveIDDFS, validateGrid } = require('./solver');

const app    = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is booming on port ${PORT}`);
});
const SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';

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

    if (!username) return res.status(400).json({ ok: false, error: 'Username is required' });
    if (username.length < 3) return res.status(400).json({ ok: false, error: 'Username must be at least 3 characters' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ ok: false, error: 'Username: only letters, numbers, underscores' });
    if (!password) return res.status(400).json({ ok: false, error: 'Password is required' });
    if (password.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });

    if (await User.findByUsername(username))
      return res.status(409).json({ ok: false, error: 'Username already taken' });

    const hash = await bcrypt.hash(password, 10);
    await User.create(username, hash);

    res.status(201).json({
      ok: true,
      message: 'Account created! An admin must approve it before you can use the solver.'
    });
  } catch (e) {
    console.error('[REGISTER ERROR]', e.message);
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

    if (!username || !password)
      return res.status(400).json({ ok: false, error: 'Username and password are required' });

    const user = await User.findByUsername(username);
    if (!user)
      return res.status(401).json({ ok: false, error: 'Wrong username or password' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(401).json({ ok: false, error: 'Wrong username or password' });

    await User.updateLastLogin(user.id);

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: !!user.is_admin },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      ok: true,
      token,
      user: {
        id:          user.id,
        username:    user.username,
        is_approved: !!user.is_approved,
        is_admin:    !!user.is_admin,
        solve_count: user.solve_count || 0
      }
    });
  } catch (e) {
    console.error('[LOGIN ERROR]', e.message);
    res.status(500).json({ ok: false, error: 'Server error: ' + e.message });
  }
});

/* ════════════════════════════════════════
   GET /api/auth/me
════════════════════════════════════════ */
app.get('/api/auth/me', requireAuth, (req, res) => {
  const u = req.user;
  res.json({
    ok:          true,
    id:          u.id,
    username:    u.username,
    is_approved: !!u.is_approved,
    is_admin:    !!u.is_admin,
    solve_count: u.solve_count || 0
  });
});

/* ════════════════════════════════════════
   POST /api/solve
════════════════════════════════════════ */
app.post('/api/solve', requireAuth, solveLimit, async (req, res) => {
  try {
    const u = req.user;
    if (u.is_admin)
      return res.status(403).json({ ok: false, error: 'Admin accounts cannot use the solver' });
    if (!u.is_approved)
      return res.status(403).json({ ok: false, error: 'Account pending approval' });

    const fp = String(req.headers['x-device-fingerprint'] || req.body.fingerprint || '').trim();
    if (!fp)
      return res.status(400).json({ ok: false, error: 'Device fingerprint missing — reload the page' });

    if (!u.fingerprint) {
      await User.updateFingerprint(u.id, fp);
    } else if (u.fingerprint !== fp) {
      return res.status(403).json({ ok: false, error: 'Device mismatch — ask admin to reset your device' });
    }

    const { grid, moveCount } = req.body;
    if (!validateGrid(grid))
      return res.status(400).json({ ok: false, error: 'Invalid grid — must be 4×4 with values 0-10' });

    const result = solveIDDFS(grid, parseInt(moveCount) || 0);

    SolveLog.add(u.id, JSON.stringify(grid), result.bestMove || 'none',
      result.bestMove ? (result.scores[result.bestMove] || 0) : 0).catch(() => {});
    User.incrementSolveCount(u.id).catch(() => {});

    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[SOLVE ERROR]', e.message);
    res.status(500).json({ ok: false, error: 'Solver error: ' + e.message });
  }
});

/* ════════════════════════════════════════
   ADMIN ROUTES
════════════════════════════════════════ */
app.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [stats, solves] = await Promise.all([User.countStats(), SolveLog.count()]);
    res.json({ ok: true, total: stats.total || 0, approved: stats.approved || 0, pending: stats.pending || 0, solves });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.listNonAdmins();
    res.json({ ok: true, users });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.put('/api/admin/users/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id      = parseInt(req.params.id);
    const user    = await User.findById(id);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    const approve = req.body.approve !== false;
    await User.setApproved(id, approve);
    res.json({ ok: true, message: user.username + (approve ? ' approved ✓' : ' revoked ✗') });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.put('/api/admin/users/:id/reset-device', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id   = parseInt(req.params.id);
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    await User.resetFingerprint(id);
    res.json({ ok: true, message: 'Device reset for ' + user.username });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id)
      return res.status(400).json({ ok: false, error: 'Cannot delete your own account' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    await User.deleteById(id);
    res.json({ ok: true, message: 'Deleted ' + user.username });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* SPA fallback */
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

/* ════════════════════════════════════════
   START
════════════════════════════════════════ */
async function start() {
  console.log('\n🐉  Animal Merge Solver — Starting...');
  try {
    await testConnection();
    console.log('✅  Database connected');
  } catch (e) {
    console.error('❌  Database connection FAILED:', e.message);
    console.error('    → Open .env and fill in DB_HOST, DB_NAME, DB_USER, DB_PASS');
    process.exit(1);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log('✅  Server running at http://localhost:' + PORT);
    console.log('    Login: admin / admin123\n');
  });
}

start();

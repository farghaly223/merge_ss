# 🐉 Animal Merge Solver — Setup Guide

## ─── STEP 1: Create the MySQL Database in phpMyAdmin ───

1. Open **phpMyAdmin** (on InfinityFree: go to your hosting panel → MySQL Databases)
2. Create a new database (e.g. `animal_merge`)
3. Open the database, click the **SQL** tab at the top
4. Open the file `database.sql` from this project, copy the entire contents, paste it in phpMyAdmin, click **Go**
5. You should see the `users` and `solve_logs` tables created, plus the default admin user

**Default admin credentials:**
- Username: `admin`
- Password: `admin123`
- ⚠️ Change this after first login!

---

## ─── STEP 2: Configure .env ───

Edit the `.env` file and fill in your database details:

```env
PORT=3000
JWT_SECRET=put_a_long_random_string_here_at_least_32_characters

DB_HOST=your_mysql_host      # e.g. sql123.infinityfree.com
DB_PORT=3306
DB_NAME=your_database_name   # the one you created in phpMyAdmin
DB_USER=your_database_user   # from InfinityFree MySQL panel
DB_PASS=your_database_password
```

On **InfinityFree**, find these values in:
`Control Panel → MySQL Databases → View databases`

---

## ─── STEP 3: Install & Run ───

```bash
# Install dependencies (one time only)
npm install

# Run the app
npm start

# For development (auto-restart on file changes)
npm run dev
```

Open http://localhost:3000 in your browser.

---

## ─── STEP 4: Run the Test Suite ───

```bash
npm test
```

This will run 25+ automated tests covering:
- Grid validation
- All 4 move directions (up/down/left/right)
- Tile merging and capping at level 10
- Solver speed (must complete in < 200ms)
- Correct best-move selection

---

## ─── STEP 5: Deploy on InfinityFree ───

InfinityFree is PHP hosting. To run a Node.js app, you need to use it differently:

### Option A: Run locally, access from internet (easiest)
Use a tunnel like **ngrok** (free):
```bash
# Install ngrok from https://ngrok.com
npm start
# In another terminal:
ngrok http 3000
# Share the https URL ngrok gives you
```

### Option B: Use a free Node.js host instead
InfinityFree is PHP-only. For Node.js, use:
- **Railway** (railway.app) — free tier, MySQL add-on available
- **Render** (render.com) — free tier with PostgreSQL
- **Glitch** (glitch.com) — free Node.js hosting

For Railway (recommended free option):
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway add mysql      # adds MySQL database
railway up             # deploys
```

Railway will give you a public URL and auto-set the DB environment variables.

---

## ─── Project Structure ───

```
animal-merge-saas/
├── server.js           ← Express server + all API routes
├── solver.js           ← Expectimax + IDDFS AI solver
├── models/
│   ├── db.js           ← MySQL connection pool
│   └── User.js         ← All database queries
├── public/
│   └── index.html      ← Complete frontend (all JS inline)
├── tests/
│   └── test.js         ← 25+ automated tests
├── database.sql        ← Run this in phpMyAdmin
├── .env                ← Database & JWT config
└── package.json
```

---

## ─── API Reference ───

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login, get token |
| GET  | `/api/auth/me` | Token | Get own user info |
| POST | `/api/solve` | Token + Approved + FP | Run solver |
| GET  | `/api/admin/stats` | Admin | Dashboard stats |
| GET  | `/api/admin/users` | Admin | List all users |
| PUT  | `/api/admin/users/:id/approve` | Admin | Approve/revoke user |
| PUT  | `/api/admin/users/:id/reset-device` | Admin | Clear device lock |
| DELETE | `/api/admin/users/:id` | Admin | Delete user |

---

## ─── Security Features ───

| Feature | How it works |
|---------|-------------|
| **JWT Tokens** | 7-day signed tokens, verified on every protected request |
| **bcrypt passwords** | Cost factor 10, stored as hash |
| **Device fingerprint** | SHA-256 of browser/hardware, locked per user |
| **Admin approval** | New accounts blocked until admin approves |
| **Admin-only routes** | Separate middleware check for `is_admin = 1` |

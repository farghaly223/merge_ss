# 🚀 Deployment Guide — Animal Merge Solver

## ⚠️ Important: InfinityFree is PHP-only
InfinityFree does NOT support Node.js. It only runs PHP websites.
Use **Railway.app** instead — it's free, runs Node.js, and includes MySQL.

---

## ═══════════════════════════════════════════
## OPTION A: Railway.app (FREE — Recommended)
## Best for: permanent public URL, real hosting
## ═══════════════════════════════════════════

### Step 1 — Install Git (if you don't have it)
Download from: https://git-scm.com/download/win
Install with default settings.

---

### Step 2 — Create a GitHub account & repository
1. Go to https://github.com and create a free account
2. Click the **+** button → **New repository**
3. Name it `animal-merge-solver`
4. Set to **Private** (important — keeps your .env hidden)
5. Click **Create repository**

---

### Step 3 — Upload your project to GitHub

Open a terminal in your project folder and run:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/animal-merge-solver.git
git push -u origin main
```

⚠️ BEFORE pushing, make sure `.gitignore` exists (see below).

---

### Step 4 — Create .gitignore (IMPORTANT — protects secrets)

Create a file called `.gitignore` in your project folder with this content:
```
node_modules/
.env
database.sqlite
*.log
```

This prevents your database password and JWT secret from being uploaded to GitHub.

---

### Step 5 — Deploy on Railway

1. Go to https://railway.app and sign up (free, use GitHub login)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `animal-merge-solver` repository
4. Railway will detect Node.js automatically

---

### Step 6 — Add MySQL database on Railway

1. In your Railway project, click **+ New**
2. Select **Database** → **MySQL**
3. Railway creates a MySQL database and gives you the connection details
4. Click the MySQL service → **Variables** tab
5. You'll see: `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`

---

### Step 7 — Set Environment Variables on Railway

1. Click your **Node.js service** (not the database)
2. Go to **Variables** tab
3. Add these variables one by one:

| Variable | Value |
|----------|-------|
| `DB_HOST` | Copy from MySQL `MYSQL_HOST` |
| `DB_PORT` | `3306` |
| `DB_NAME` | Copy from MySQL `MYSQL_DATABASE` |
| `DB_USER` | Copy from MySQL `MYSQL_USER` |
| `DB_PASS` | Copy from MySQL `MYSQL_PASSWORD` |
| `JWT_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste result |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGIN` | Your Railway URL (get it after first deploy, e.g. `https://animal-merge-solver-production.up.railway.app`) |

---

### Step 8 — Create the database tables

1. In Railway, click the **MySQL service**
2. Go to the **Query** tab (or connect with a MySQL client)
3. Paste the entire contents of `database.sql` and run it
4. You'll see the `users` and `solve_logs` tables created

---

### Step 9 — Get your public URL

1. Click your Node.js service in Railway
2. Go to **Settings** → **Networking** → **Generate Domain**
3. Railway gives you a URL like: `https://animal-merge-solver-production.up.railway.app`
4. Go back to Variables and set `ALLOWED_ORIGIN` to that URL
5. Redeploy (Railway does it automatically when you update Variables)

---

### Step 10 — Test it!

Open your Railway URL in browser.
- Login with `admin` / `admin123`
- **Change the admin password immediately!**

---

## ═══════════════════════════════════════════
## OPTION B: Run locally + share with Ngrok
## Best for: testing, temporary sharing
## ═══════════════════════════════════════════

This lets people access your laptop from the internet.

### Step 1 — Fill in your .env
```env
JWT_SECRET=run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DB_HOST=localhost
DB_NAME=animal_merge
DB_USER=root
DB_PASS=your_mysql_password
```

### Step 2 — Set up database
1. Open phpMyAdmin → create database `animal_merge`
2. Run `database.sql` in the SQL tab

### Step 3 — Start the server
```bash
npm install
npm start
```

### Step 4 — Install and run Ngrok
1. Download ngrok from https://ngrok.com (free account)
2. In a new terminal:
```bash
ngrok http 3000
```
3. Ngrok gives you a URL like: `https://abc123.ngrok-free.app`
4. Share that URL — it works until you close ngrok

---

## ═══════════════════════════════════════════
## SECURITY CHECKLIST before going live
## ═══════════════════════════════════════════

- [ ] JWT_SECRET is at least 64 random hex characters
- [ ] `.env` is in `.gitignore` (NOT uploaded to GitHub)
- [ ] Admin password changed from `admin123`
- [ ] `NODE_ENV=production` set on server
- [ ] `ALLOWED_ORIGIN` set to your actual domain
- [ ] HTTPS enabled (Railway gives you free HTTPS automatically)
- [ ] Database password is strong (not empty or "root")

---

## What each security layer protects against

| Layer | Attacks blocked |
|-------|----------------|
| **Helmet headers** | XSS, clickjacking, MIME sniffing, info leakage |
| **Rate limiting** | Brute force login, DDoS, API scraping |
| **bcrypt cost 12** | Password cracking (even if DB is stolen) |
| **JWT HS256** | Session forgery, token tampering |
| **Timing-safe login** | Username enumeration attacks |
| **Input validation** | SQL injection (+ parameterized queries), buffer overflow |
| **Device fingerprint** | Account sharing, credential theft |
| **Admin approval** | Unauthorized solver access |
| **CORS restriction** | Cross-site request forgery from other domains |
| **Parameterized SQL** | SQL injection completely prevented |

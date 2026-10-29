# 🚀 NexusEdu AI - Student & Campus Intelligence Platform

A unified, full-stack educational and developer intelligence platform built with **Flask (Python)**, **SQL (SQLite)**, **HTML5/CSS3/JavaScript**, and **Firebase Authentication**.

NexusEdu tracks and integrates **LeetCode algorithmic problem-solving**, **GitHub open-source contributions**, and **College Coursework/Assignments** with an intelligent **AI Diagnostic & Career Readiness Engine**, wrapped in a modern **Gamification Economy** (Avatars, Banners, Profile Titles, ByteCoins & Streaks) plus a dedicated **College Management Dashboard** for faculty.

---

## 🌟 Core Features

### 🎓 1. Student Dashboard & Academic Intelligence
- **LeetCode Tracker**:
  - Live problem metrics (Total Solved, Easy, Medium, Hard breakdown).
  - Interactive Chart.js doughnut chart for difficulty visualization.
  - Algorithmic Topic Mastery (Dynamic Programming, Graphs, Binary Search, Trees, Arrays).
  - Acceptance rate, global ranking, and contest rating.
  - Recent submissions list with status tags (*Accepted*, *Time Limit Exceeded*, etc.).
- **GitHub Portfolio Tracker**:
  - Public repositories, stars count, total annual commits, and commit streaks.
  - Language composition analysis (TypeScript, Python, C++, Go, etc.) with official color accents.
  - Recent commit history and activity stream.
- **Unified 90-Day Dual Activity Calendar**:
  - Synchronizes daily LeetCode submissions (⚡) and GitHub commits (🐙) day-by-day.
  - 7-Column calendar layout with month navigator tabs (August, September, October 2026).
  - Fixed-position viewport tooltips with boundary clamping.
- **College Assignments Tracker**:
  - Deadlines countdown with priority indicators (*Due Today*, *Pending*, *Submitted*, *Graded*).
  - 1-Click Assignment submission with GitHub repository link & notes.
  - Early submission bonus: Awards **+120 XP** and **+60 ByteCoins** upon submission.
  - Real-time review of faculty grades and qualitative feedback.
- **Personalized Profile & Customization**:
  - Target Dream Company (e.g., Google, Meta, Amazon) & Dream Role (e.g., Senior SDE-1).
  - Bio, academic department, semester, and college roll number.

---

### 🧠 2. AI Performance & Career Readiness Engine
- **Multimodal Industry Readiness Index (0 - 100%)**:
  - Synthesizes DSA Problem Solving, GitHub Codebase Hygiene, and College Academic Compliance into a single placement score.
  - Tier Classification: *Diamond Pioneer*, *Platinum Dev*, *Gold Striker*, *Silver Explorer*.
- **Interactive AI Code Arena**:
  - **🔥 Roast My Code**: Witty, senior engineer roast with deep technical feedback and Engineering Score.
  - **⚡ Turbo Optimize**: Automatic Big-O leap detection ($O(2^N) \to O(N)$, $O(N^2) \to O(N)$) with clean production rewrites.
  - **💥 Adversarial Edge Cases**: 5 lethal edge cases with inputs, crash reasons, and defensive guard code.
  - **💡 Explain Code**: Line-by-line mental model breakdown.
- **FAANG Mock Interview Challenge Simulator**:
  - Company-specific rounds (Google, Meta, Amazon, Microsoft, Netflix) across DP, Graphs, System Design, Sliding Window, and Concurrency.
  - Real-time bar-raiser evaluation grading logic, Big-O, and edge cases, awarding verified XP and ByteCoins!
- **AI Assignment Tutor**:
  - For any college assignment, provides conceptual breakdowns, algorithmic strategies, corner cases/pitfalls, and starter code scaffolds.

---

### 🛍️ 3. Gamification & Virtual Economy
- **XP & Level Progression**:
  - Level 1 (*Novice Coder*) up to Level 50+ (*Grandmaster Developer*) with progressive XP curve.
- **ByteCoins Economy**:
  - Earn virtual ByteCoins by solving LeetCode problems, pushing Git commits, maintaining daily streaks, and submitting coursework early.
- **Gamified Cosmetic Shop**:
  - **Avatars**: Cyberpunk Hacker, Neon Samurai, Pixel Archmage, Quantum Scholar, Silicon Sage, Glitch Drifter.
  - **Profile Banners**: Synthwave Grid, Matrix Cascade, Deep Void Nebula, Solar Supernova, Nordic Aurora.
  - **Exclusive Titles**: *« Algorithmic Titan »*, *« Git Maestro »*, *« Bug Slayer Prime »*, *« 10x Scholar »*, *« Terminal Ghost »*.
  - **UI Themes**: *Cyberpunk Neon*, *Emerald Terminal*, *Amethyst Royale*, *Solar Flare*.
- **Live Equip System**:
  - Equipping an item instantly applies it across the user's header banner, glowing avatar frame, titles, and application-wide theme styling.
- **Celebratory Audio & Confetti**:
  - Web Audio API chimes and confetti animations on purchases, level-ups, and submissions.

---

### 🏫 4. College Management & Faculty Dashboard
- **Campus Bulletin & Notice Publisher**:
  - Post official circulars with category tags (*Urgent*, *Placement*, *Academic*, *Hackathon*, *General*).
  - High-priority urgent notices flash with pulsing alerts on all student dashboards.
- **Assignment Publisher**:
  - Set course codes, deadlines, point weights, problem difficulty, and topic tags.
  - AI-assisted assignment drafting with starter boilerplate and grading rubrics.
- **Cohort Submissions & Grading Queue**:
  - Review student code links, solution notes, and timestamp.
  - Run AI auto-evaluation to draft rubric scores and qualitative feedback recorded in the SQL database.
- **Campus Leaderboard**:
  - Cohort-wide student rankings with podium badges (🥇 🥈 🥉), level, XP, LeetCode solved count, GitHub commits, and GPA.

---

## 🛠️ Tech Stack Architecture

| Layer | Technology |
|---|---|
| **Backend** | Python 3.13, Flask 3.1, Werkzeug (ProxyFix & Scrypt/SHA256), Requests |
| **WSGI Server** | Gunicorn (Linux/Cloud), Waitress (Windows) |
| **Database** | SQL (SQLite3) with relational schema, foreign keys & ACID transactions |
| **Frontend** | HTML5, Modern CSS3 (Glassmorphism & Cyberpunk tokens), Vanilla JavaScript (ES6+) |
| **Styling & UI** | Tailwind CSS (CDN), Custom CSS Variables & Animations |
| **Visualizations** | Chart.js (Doughnut charts, topic mastery) |
| **AI Engine** | Google Gemini 2.0 Flash (`google-genai` SDK) + Local AST Heuristic Engine |
| **Authentication** | Cryptographic HTTPOnly Session Cookies + Firebase Auth (Google OAuth) |
| **Special Effects** | Canvas Confetti, Web Audio API synthetic chimes |

---

## 🌐 Production Deployment Guide

### Option 1: 1-Click Deploy on Render.com (Recommended)
1. Fork or push this repository to your GitHub account (`https://github.com/CodingWithAman1/NexusEduAI.git`).
2. Log in to [Render.com](https://render.com) and click **New +** ➔ **Web Service**.
3. Connect your GitHub repository.
4. Render automatically detects [`render.yaml`](render.yaml) or use these settings:
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn wsgi:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120`
   - **Health Check Path**: `/health`
5. Under **Environment Variables**, add:
   - `SECRET_KEY`: `<generate-a-random-32-byte-hex-string>`
   - `APP_ENV`: `production`
   - `COOKIE_SECURE`: `false` (or `true` if your domain uses HTTPS)
   - `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key
6. Click **Deploy Web Service**! Your live URL will be active in ~2 minutes.

---

### Option 2: Deploy with Docker & Docker Compose
The repository includes a production-hardened multi-stage [`Dockerfile`](Dockerfile) and [`docker-compose.yml`](docker-compose.yml).

1. **Build and Run with Docker Compose**:
```bash
docker compose up --build -d
```
2. **Or build and run standard Docker container**:
```bash
docker build -t nexusedu-ai .
docker run -d -p 5000:5000 --name nexusedu-app -e APP_ENV=production -v $(pwd)/campus_nexus.db:/app/campus_nexus.db nexusedu-ai
```
3. Verify container health:
```bash
curl http://localhost:5000/health
# Returns: {"database": "connected", "platform": "NexusEdu AI", "status": "healthy", "version": "2.4.0"}
```

---

### Option 3: Deploy on Railway.app
1. Go to [Railway.app](https://railway.app) and select **New Project** ➔ **Deploy from GitHub Repo**.
2. Railway detects [`Procfile`](Procfile) and [`requirements.txt`](requirements.txt) automatically.
3. In the Railway dashboard under **Variables**, set:
   - `APP_ENV=production`
   - `SECRET_KEY=<your-secret-key>`
4. Set the Healthcheck path to `/health`. Deployment completes automatically!

---

### Option 4: Linux / Ubuntu VPS (Nginx + Gunicorn + Systemd)
1. **Clone and setup virtual environment**:
```bash
sudo apt update && sudo apt install python3-pip python3-venv git -y
git clone https://github.com/CodingWithAman1/NexusEduAI.git /var/www/nexusedu
cd /var/www/nexusedu
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
2. **Create a Systemd Service** (`/etc/systemd/system/nexusedu.service`):
```ini
[Unit]
Description=NexusEdu AI Gunicorn Service
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/nexusedu
Environment="PATH=/var/www/nexusedu/venv/bin"
Environment="APP_ENV=production"
ExecStart=/var/www/nexusedu/venv/bin/gunicorn wsgi:app --bind 127.0.0.1:5000 --workers 3 --threads 4

[Install]
WantedBy=multi-user.target
```
3. Start and enable service:
```bash
sudo systemctl daemon-reload
sudo systemctl start nexusedu
sudo systemctl enable nexusedu
```

---

### Option 5: Local Windows Development
1. Double-click [`run.bat`](run.bat) or run:
```bash
pip install -r requirements.txt
python app.py
```
2. Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your browser!

---

## 🔑 Default Production Baseline Accounts

The database comes pre-configured with a clean verified baseline (zero dummy assignments or clutter):

| Role | Username / Email | Password | Access Level |
|---|---|---|---|
| **Faculty Admin** | `faculty@12345` | `password123` | Full Coursework, Grading & Announcement Access |
| **Student** | `funwithcode8630@gmail.com` | `password123` | Section A, Connected to @CodingWithAman1 |
| **Student** | `shruti.sharma6386@gmail.com` | `password123` | Section A Student Portal |

---

## 📂 Project Directory Structure

```
├── wsgi.py                    # Production WSGI server entrypoint
├── Procfile                   # Cloud process execution rule (Gunicorn)
├── Dockerfile                 # Production Docker container image definition
├── docker-compose.yml         # Container orchestration with volume mounts
├── render.yaml                # Render.com 1-Click deployment blueprint
├── app.py                     # Main Flask application & REST API routes
├── config.py                  # Database, session & Firebase configuration
├── requirements.txt           # Python package dependencies
├── campus_nexus.db            # SQLite database file (auto-initialized)
├── database/
│   ├── schema.sql             # Relational SQL schema definitions
│   └── db.py                  # Database connection, init, and migrations
├── services/
│   ├── leetcode_service.py    # LeetCode public API & algorithmic metrics
│   ├── github_service.py      # GitHub REST API & language composition
│   ├── ai_service.py          # AI diagnostic engine, Arena & FAANG interviewer
│   └── gamification_service.py# XP, ByteCoins, levels & rewards calculation
├── static/
│   ├── css/
│   │   └── style.css          # Glassmorphism, animations, themes & glow accents
│   └── js/
│       ├── firebase-config.js # Firebase Auth integration & sync
│       ├── gamification.js    # Shop rendering, equip, audio chime & confetti
│       ├── student.js         # LeetCode chart, GitHub feed, assignment submit
│       ├── college.js         # Notice board, assignment creator, grading queue
│       └── app.js             # Tab navigation, toasts, profile modal
├── templates/
│   ├── landing.html           # Landing entrance portal for choosing student vs college
│   ├── auth.html              # Dedicated Sign In & Sign Up authentication page
│   ├── faculty.html           # Dedicated College & Faculty Management Dashboard
│   └── index.html             # Master responsive Single Page Application
├── NexusEdu_AI_Mini_Project_Presentation.pdf   # 15-Slide Presentation (PDF)
└── NexusEdu_AI_Mini_Project_Presentation.pptx  # Source Presentation Deck (PPTX)
```

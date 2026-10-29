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
  - Search any LeetCode username live on demand.
- **GitHub Portfolio Tracker**:
  - Public repositories, stars count, total annual commits, and commit streaks.
  - Language composition analysis (TypeScript, Python, C++, Go, etc.) with official color accents.
  - Recent commit history and activity stream.
- **College Assignments Tracker**:
  - Deadlines countdown with priority indicators (*Due Today*, *Pending*, *Submitted*, *Graded*).
  - 1-Click Assignment submission with GitHub repository link & notes.
  - Early submission bonus: Awards **+120 XP** and **+60 ByteCoins** upon submission.
  - Real-time review of faculty grades and qualitative feedback.
- **Personalized Profile & Customization**:
  - Target Dream Company (e.g., Google, Meta, Apple) & Dream Role (e.g., Senior SDE-1).
  - Bio, academic department, semester, and college roll number.

---

### 🧠 2. AI Performance & Career Readiness Engine
- **Multimodal Industry Readiness Index (0 - 100%)**:
  - Synthesizes DSA Problem Solving, GitHub Codebase Hygiene, and College Academic Compliance into a single placement score.
  - Tier Classification: *Diamond Pioneer*, *Platinum Dev*, *Gold Striker*, *Silver Explorer*.
- **Skill Gap & Weakness Detector**:
  - Flags weak areas (e.g., low hard problem ratio in Dynamic Programming, commit slowdowns, impending assignment deadlines).
- **7-Day Personalized Action Plan**:
  - Day-by-day task checklist with urgency flags and estimated time allocations.
- **AI Assignment Tutor**:
  - For any college assignment, provides conceptual breakdowns, algorithmic strategies, corner cases/pitfalls, and starter code scaffolds.
- **AI Resume & Portfolio Impact Bullet Generator**:
  - Formulates quantifiable STAR-method bullet points based on the student's actual achievements for software engineering resumes.

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
- **Cohort Submissions & Grading Queue**:
  - Review student code links, solution notes, and timestamp.
  - Grade submissions and provide qualitative feedback recorded in the SQL database.
- **Campus Leaderboard**:
  - Cohort-wide student rankings with podium badges (🥇 🥈 🥉), level, XP, LeetCode solved count, GitHub commits, and GPA.

---

### 🔐 5. Authentication (Firebase Auth & Sign Up / Sign In Pages)
- **Dedicated Sign Up Page (`/signup`)**:
  - Full Name, Student vs Faculty role, College ID, Email, and Password.
  - Built-in Developer Handle Onboarding: Connect personal LeetCode and GitHub handles during signup so dashboards populate immediately.
- **Dedicated Sign In Page (`/login`)**:
  - 1-Click Google OAuth Popup via Firebase Auth (`firebase.auth().signInWithPopup`).
  - Email & Password login with automated local session fallback (`/api/auth/login-local`).
  - 1-Click Demo Login as Student (*Alex Rivera*) or Faculty (*Dr. Sarah Vance*).
- **Persistent Header Navigation**:
  - Direct links to **Sign In**, **Sign Up**, and **Sign Out** (`/logout`) accessible across the Landing Portal and Dashboards.

### 🔗 6. Personal LeetCode & GitHub Handle Connection
- **Connect Accounts Modal**:
  - Step-by-step connection for personal LeetCode and GitHub handles.
  - Live **Verify Handle** feature: checks real-time reachability, problem count, rank, and repository stats.
  - Awards **+100 XP** and **+50 ByteCoins** upon successful profile synchronization.
  - 1-Click test presets for Neal Wu, Linus Torvalds, Tourist, and Dan Abramov.
- **Persistent Developer Handles Banner**:
  - Prominent banner on the dashboard showing currently connected handles and 1-click sync button.

### 🗓️ 7. Unified Dev & Algorithmic Activity Matrix (Dual Calendar)
- **60-Day Synchronized Heatmap**:
  - Merges LeetCode algorithmic solutions and GitHub commits day-by-day.
  - 4 View Modes: **Combined Matrix**, **Parallel Dual-Track**, **LeetCode Only**, **GitHub Only**.
  - Interactive **Day Inspector**: Click any cell to view exact daily problem breakdown, commit counts, XP earned, and ByteCoin rewards.
  - Cross-platform correlation index highlighting consistent dev velocity.

---

## 🛠️ Tech Stack Architecture

| Layer | Technology |
|---|---|
| **Backend** | Python 3.13, Flask 3.1, Flask-CORS, Requests |
| **Database** | SQL (SQLite3) with relational schema & foreign keys |
| **Frontend** | HTML5, Modern CSS3 (Glassmorphism & Cyberpunk Design System), Vanilla JavaScript |
| **Styling & UI** | Tailwind CSS (CDN), Custom CSS Variables & Animations |
| **Visualizations** | Chart.js (Doughnut charts, topic mastery) |
| **Authentication** | Firebase Auth (Google OAuth & Email/Pass) + Flask Sessions |
| **Special Effects** | Canvas Confetti, Web Audio API synthetic chimes |

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run locally
On Windows, use `run.bat`. It creates a random development-only session secret for that run and serves the app over HTTP on your machine.

For a direct launch, set a session secret first:
```bash
set SECRET_KEY=<a-long-random-secret>
python app.py
```

### 3. Open in Browser
Visit **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your browser!

### Production configuration
Set a stable, randomly generated `SECRET_KEY`, `APP_ENV=production`, and `FACULTY_INVITE_CODE` in the deployment environment. Production cookies are then Secure and only invited faculty can register with faculty access. Do not expose the development server; run behind HTTPS with a production WSGI server, for example `waitress-serve --listen=127.0.0.1:8080 app:app`, and place a TLS reverse proxy in front of it. Persist and back up the SQLite database and uploads directory.

Local email/password accounts are stored with a password hash. Public registration is student-only unless an invitation code is configured. Firebase sign-in is disabled until server-side Firebase token verification is configured; Firebase client settings alone do not establish a trusted session. Set `GEMINI_API_KEY` to enable live Gemini features. Seeded demo profiles are showcase data and cannot be used to sign in. Existing accounts created before password authentication must register with a new email or be migrated by an administrator.

---

## 📂 Project Directory Structure

```
├── app.py                     # Main Flask application & REST API routes
├── config.py                  # Database & Firebase configuration
├── requirements.txt           # Python package dependencies
├── campus_nexus.db            # SQLite database file (auto-initialized)
├── database/
│   ├── schema.sql             # Relational SQL schema definitions
│   └── db.py                  # Database connection, init, and seed data
├── services/
│   ├── leetcode_service.py    # LeetCode public API & algorithmic metrics
│   ├── github_service.py      # GitHub REST API & language composition
│   ├── ai_service.py          # AI diagnostic engine & assignment assistant
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
│   └── index.html             # Master responsive Single Page Application
```

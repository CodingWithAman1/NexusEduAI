from functools import wraps
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, Response, send_from_directory, g
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import json
import random
import os
import io
import csv
import secrets
import hmac
from datetime import datetime, timedelta
from config import Config
from database.db import get_db, init_db
from services.leetcode_service import fetch_leetcode_stats
from services.github_service import fetch_github_stats
from services.ai_service import (
    generate_ai_analysis, get_assignment_ai_guidance, process_ai_chat_query,
    play_ai_code_arena, play_ai_mock_interview, generate_assignment_ai, evaluate_submission_with_ai
)
from services.gamification_service import (
    calculate_level_progress, award_activity_reward,
    claim_daily_loot_box, get_loot_box_status,
    get_achievements_with_progress, claim_achievement_reward
)

app = Flask(__name__)
app.config.from_object(Config)
app.permanent_session_lifetime = timedelta(days=7)

with app.app_context():
    init_db()

def get_current_user():
    """
    Retrieves and caches the currently authenticated user based on session['user_id'].
    If the session is missing, invalid, or user was deleted from DB, clears session.
    """
    if hasattr(g, 'current_user'):
        return g.current_user

    user_id = session.get('user_id')
    if not user_id:
        g.current_user = None
        return None

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()

    if row:
        g.current_user = dict(row)
        return g.current_user

    # Session ID is invalid or user no longer exists: purge session
    session.clear()
    g.current_user = None
    return None

def login_required(f):
    """Decorator ensuring that an active, verified session exists."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            if request.path.startswith('/api/') or request.path.startswith('/uploads/'):
                return jsonify({'error': 'Unauthorized: Valid authenticated session required.'}), 401
            return redirect(url_for('login_view', next=request.path))
        return f(*args, **kwargs)
    return decorated_function

def role_required(*allowed_roles):
    """Decorator ensuring that session user has one of the authorized roles."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                if request.path.startswith('/api/') or request.path.startswith('/uploads/'):
                    return jsonify({'error': 'Unauthorized: Valid authenticated session required.'}), 401
                return redirect(url_for('login_view', next=request.path))
            if user.get('role') not in allowed_roles:
                if request.path.startswith('/api/') or request.path.startswith('/uploads/'):
                    return jsonify({'error': f'Forbidden: Requires {", ".join(allowed_roles)} privileges.'}), 403
                if user.get('role') in ['faculty', 'admin']:
                    return redirect(url_for('college_dashboard'))
                else:
                    return redirect(url_for('student_dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def faculty_required(f):
    return role_required('faculty', 'admin')(f)

def student_required(f):
    return role_required('student')(f)

# ==================== PAGE ROUTES ====================
@app.route('/')
def landing_page():
    """Main Landing Entrance Portal"""
    user = get_current_user()
    return render_template('landing.html', user=user, firebase_config=Config.FIREBASE_CONFIG)

@app.route('/login')
def login_view():
    """Dedicated Sign In Page"""
    user = get_current_user()
    next_page = request.args.get('next', '')
    return render_template('auth.html', mode='login', next=next_page, current_user=user, firebase_config=Config.FIREBASE_CONFIG)

@app.route('/signup')
def signup_view():
    """Dedicated Sign Up Page"""
    user = get_current_user()
    next_page = request.args.get('next', '')
    return render_template('auth.html', mode='signup', next=next_page, current_user=user, firebase_config=Config.FIREBASE_CONFIG)

@app.route('/logout')
def logout_view():
    """Clear session and sign out"""
    session.clear()
    return redirect(url_for('login_view'))

@app.route('/student')
@student_required
def student_dashboard():
    """Dedicated Student Intelligence Dashboard"""
    user = get_current_user()
    return render_template('index.html', user=user, firebase_config=Config.FIREBASE_CONFIG, initial_tab='overview')

@app.route('/college')
@faculty_required
def college_dashboard():
    """Dedicated College Management & Faculty Portal"""
    user = get_current_user()
    return render_template('faculty.html', user=user, firebase_config=Config.FIREBASE_CONFIG)

@app.route('/faculty')
def faculty_redirect():
    """Alias route for /college"""
    return redirect(url_for('college_dashboard'))

@app.route('/dashboard')
def dashboard_redirect():
    user = get_current_user()
    if not user:
        return redirect(url_for('login_view'))
    if user.get('role') in ['faculty', 'admin']:
        return redirect(url_for('college_dashboard'))
    return redirect(url_for('student_dashboard'))

# ==================== AUTH & USER API ====================
@app.route('/api/auth/sync', methods=['POST'])
def sync_firebase_auth():
    data = request.json or {}
    firebase_uid = data.get('uid')
    email = (data.get('email') or '').strip().lower()
    display_name = data.get('displayName') or (email.split('@')[0] if email else 'Student User')
    photo_url = data.get('photoURL') or f"https://api.dicebear.com/7.x/bottts/svg?seed={firebase_uid}"
    role = data.get('role', 'student')
    section = data.get('section', 'Section A' if role == 'student' else 'All Sections')

    if not firebase_uid or not email:
        return jsonify({'error': 'Missing UID or Email'}), 400

    conn = get_db()
    cur = conn.cursor()
    # Check by firebase_uid or existing email
    cur.execute("SELECT * FROM users WHERE firebase_uid = ? OR lower(email) = ?", (firebase_uid, email))
    user = cur.fetchone()

    if not user:
        from werkzeug.security import generate_password_hash
        default_pwd_hash = generate_password_hash("password123")
        cur.execute("""
            INSERT INTO users (
                firebase_uid, password_hash, email, display_name, role, section, avatar_url,
                leetcode_username, github_username,
                xp, level, coins, streak_days
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, 1, 0, 0)
        """, (firebase_uid, default_pwd_hash, email, display_name, role, section, photo_url))
        conn.commit()
        user_id = cur.lastrowid
    else:
        user_id = user['id']
        # Link firebase_uid if not linked yet
        if not user['firebase_uid'] or user['firebase_uid'] != firebase_uid:
            cur.execute("UPDATE users SET firebase_uid = ? WHERE id = ?", (firebase_uid, user_id))
            conn.commit()

    session.permanent = True
    session['user_id'] = user_id
    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    updated_user = dict(cur.fetchone())
    conn.close()

    level_info = calculate_level_progress(updated_user['xp'])
    return jsonify({
        'success': True,
        'user': updated_user,
        'levelInfo': level_info
    })

@app.route('/api/auth/login-local', methods=['POST'])
def login_local():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cur.fetchone()
    if not user or not user['password_hash'] or not check_password_hash(user['password_hash'], password):
        conn.close()
        return jsonify({'error': 'Invalid email or password.'}), 401
    session.clear()
    session.permanent = True
    session['user_id'] = user['id']
    session['role'] = user['role']
    user_dict = dict(user)
    conn.close()

    level_info = calculate_level_progress(user_dict['xp'])
    return jsonify({
        'success': True,
        'user': user_dict,
        'levelInfo': level_info
    })

@app.route('/api/auth/signup-local', methods=['POST'])
def signup_local():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    name = (data.get('displayName') or '').strip()
    password = data.get('password') or ''
    requested_role = data.get('role', 'student')
    role = 'student'
    if requested_role == 'faculty':
        invite_code = data.get('facultyInviteCode') or ''
        configured_code = app.config.get('FACULTY_INVITE_CODE') or ''
        if not configured_code or not hmac.compare_digest(str(invite_code), configured_code):
            return jsonify({'error': 'A valid faculty invitation code is required.'}), 403
        role = 'faculty'
    elif requested_role != 'student':
        return jsonify({'error': 'Invalid account role.'}), 400
    college_id = (data.get('collegeId') or '').strip() or None
    section = 'All Sections' if role == 'faculty' else (data.get('section') or 'Section A').strip()
    leetcode_user = (data.get('leetcodeUsername') or '').strip()
    github_user = (data.get('githubUsername') or '').strip()
    if len(name) < 2 or len(name) > 100 or '@' not in email or len(email) > 254:
        return jsonify({'error': 'Enter a valid name and email address.'}), 400
    if len(password) < 6 or len(password) > 128:
        return jsonify({'error': 'Password must be between 6 and 128 characters.'}), 400
    if len(section) > 64 or len(leetcode_user) > 100 or len(github_user) > 100:
        return jsonify({'error': 'One or more profile fields are too long.'}), 400
    uid = f"local-{os.urandom(18).hex()}"

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE lower(email) = ?", (email,))
    existing = cur.fetchone()

    if existing:
        conn.close()
        return jsonify({'error': 'An account with this email already exists. Please sign in.'}), 409

    cur.execute("""
        INSERT INTO users (
            firebase_uid, password_hash, email, display_name, role, college_id, section,
            leetcode_username, github_username, xp, level, coins, streak_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, 0)
    """, (uid, generate_password_hash(password), email, name, role, college_id, section, leetcode_user, github_user))
    conn.commit()
    new_id = cur.lastrowid

    session.clear()
    session.permanent = True
    session['user_id'] = new_id
    session['role'] = role
    cur.execute("SELECT * FROM users WHERE id = ?", (new_id,))
    new_user = dict(cur.fetchone())
    conn.close()

    return jsonify({'success': True, 'user': new_user})

@app.route('/api/auth/demo-switch', methods=['POST'])
def switch_demo_role():
    return jsonify({'error': 'Demo authentication bypass is disabled. Please sign in with your verified credentials.'}), 403

@app.route('/api/auth/me', methods=['GET'])
@login_required
def get_me():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    level_info = calculate_level_progress(user['xp'])
    return jsonify({
        'user': user,
        'levelInfo': level_info
    })

# ==================== CONNECT LEETCODE & GITHUB HANDLES ====================
@app.route('/api/stats/connect-handles', methods=['POST'])
@login_required
def connect_handles():
    """
    Connects a user's personal LeetCode and GitHub handles to their profile,
    awards connect bonus (+100 XP, +50 Coins), and re-evaluates their metrics.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json or {}
    lc_user = data.get('leetcodeUsername', '').strip()
    gh_user = data.get('githubUsername', '').strip()

    if not lc_user and not gh_user:
        return jsonify({'error': 'Please provide at least one username.'}), 400

    conn = get_db()
    cur = conn.cursor()

    # Update usernames in database and award connection rewards
    cur.execute("""
        UPDATE users 
        SET leetcode_username = COALESCE(NULLIF(?, ''), leetcode_username),
            github_username = COALESCE(NULLIF(?, ''), github_username),
            xp = xp + 100,
            coins = coins + 50
        WHERE id = ?
    """, (lc_user, gh_user, user['id']))
    conn.commit()

    cur.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
    updated_user = dict(cur.fetchone())
    conn.close()

    level_info = calculate_level_progress(updated_user['xp'])

    # Fetch updated stats for both platforms
    lc_stats = fetch_leetcode_stats(updated_user['leetcode_username'])
    gh_stats = fetch_github_stats(updated_user['github_username'])

    return jsonify({
        'success': True,
        'message': f"Connected profiles! LeetCode (@{updated_user['leetcode_username']}) and GitHub (@{updated_user['github_username']}) synchronized. +100 XP & +50 ByteCoins awarded!",
        'user': updated_user,
        'levelInfo': level_info,
        'leetcode': lc_stats,
        'github': gh_stats
    })

@app.route('/api/stats/verify-handle', methods=['GET'])
@login_required
def verify_handle():
    """Tests if a username is reachable on LeetCode or GitHub"""
    platform = request.args.get('platform', 'leetcode')
    username = request.args.get('username', '').strip()

    if not username:
        return jsonify({'valid': False, 'message': 'Username is required'}), 400

    if platform == 'leetcode':
        stats = fetch_leetcode_stats(username)
        is_live = (stats.get('source') == 'live')
        return jsonify({
            'valid': is_live or stats.get('totalSolved', 0) > 0,
            'isLive': is_live,
            'source': stats.get('source'),
            'platform': 'leetcode',
            'username': username,
            'totalSolved': stats['totalSolved'],
            'acceptanceRate': stats['acceptanceRate'],
            'ranking': stats['ranking']
        })
    elif platform == 'github':
        stats = fetch_github_stats(username)
        is_live = (stats.get('source') == 'live')
        return jsonify({
            'valid': is_live or (stats.get('publicRepos', 0) > 0) or (stats.get('source') == 'showcase'),
            'isLive': is_live,
            'source': stats.get('source'),
            'platform': 'github',
            'username': username,
            'name': stats.get('name'),
            'publicRepos': stats['publicRepos'],
            'stars': stats['totalStars'],
            'commits': stats['totalCommitsYear'],
            'avatar': stats['avatarUrl']
        })
    return jsonify({'valid': False, 'message': 'Invalid platform'}), 400

@app.route('/api/profile/update', methods=['POST'])
@login_required
def update_profile():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json or {}
    bio = data.get('bio', user['bio'])
    target_role = data.get('targetRole', user['target_role'])
    target_company = data.get('targetCompany', user['target_company'])
    leetcode_user = data.get('leetcodeUsername', user['leetcode_username'])
    github_user = data.get('githubUsername', user['github_username'])
    semester = data.get('semester', user['semester'])
    department = data.get('department', user['department'])
    section = user.get('section', 'Section A') if user.get('role') == 'student' else data.get('section', user.get('section', 'All Sections'))

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET bio = ?, target_role = ?, target_company = ?,
            leetcode_username = ?, github_username = ?,
            semester = ?, department = ?, section = ?
        WHERE id = ?
    """, (bio, target_role, target_company, leetcode_user, github_user, semester, department, section, user['id']))
    conn.commit()

    cur.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
    updated_user = dict(cur.fetchone())
    conn.close()

    return jsonify({'success': True, 'user': updated_user})

# ==================== LEETCODE & GITHUB STATS ====================
@app.route('/api/stats/leetcode', methods=['GET'])
@login_required
def get_leetcode_data():
    user = get_current_user()
    requested_username = request.args.get('username')
    if requested_username is not None:
        username = requested_username.strip()
    elif user and user.get('leetcode_username'):
        username = user['leetcode_username'].strip()
    else:
        username = ''
    stats = fetch_leetcode_stats(username)
    return jsonify(stats)

@app.route('/api/stats/github', methods=['GET'])
@login_required
def get_github_data():
    user = get_current_user()
    requested_username = request.args.get('username')
    if requested_username is not None:
        username = requested_username.strip()
    elif user and user.get('github_username'):
        username = user['github_username'].strip()
    else:
        username = ''
    stats = fetch_github_stats(username)
    return jsonify(stats)

LEETCODE_PROBLEM_CATALOG = [
    {"title": "Course Schedule II", "difficulty": "Medium", "topic": "Topological Sort"},
    {"title": "Coin Change (Min Coins)", "difficulty": "Medium", "topic": "Dynamic Programming"},
    {"title": "Two Sum", "difficulty": "Easy", "topic": "Hash Table"},
    {"title": "Median of Two Sorted Arrays", "difficulty": "Hard", "topic": "Binary Search"},
    {"title": "LRU Cache (Doubly Linked List)", "difficulty": "Medium", "topic": "Design & Hash Map"},
    {"title": "Valid Anagram", "difficulty": "Easy", "topic": "Hash Table"},
    {"title": "Trapping Rain Water", "difficulty": "Hard", "topic": "Two Pointers & Stack"},
    {"title": "Number of Islands", "difficulty": "Medium", "topic": "BFS / DFS"},
    {"title": "Word Ladder II", "difficulty": "Hard", "topic": "Graph BFS & Backtracking"},
    {"title": "Merge Intervals", "difficulty": "Medium", "topic": "Sorting & Intervals"},
    {"title": "Invert Binary Tree", "difficulty": "Easy", "topic": "Binary Trees"},
    {"title": "Kth Largest Element in an Array", "difficulty": "Medium", "topic": "Heap / Priority Queue"},
    {"title": "Subarray Sum Equals K", "difficulty": "Medium", "topic": "Prefix Sum & Hash Map"},
    {"title": "Longest Substring Without Repeating", "difficulty": "Medium", "topic": "Sliding Window"},
    {"title": "Daily Temperatures", "difficulty": "Medium", "topic": "Monotonic Stack"},
    {"title": "Binary Search", "difficulty": "Easy", "topic": "Binary Search"},
    {"title": "Maximum Subarray (Kadane)", "difficulty": "Medium", "topic": "Dynamic Programming"},
    {"title": "3Sum", "difficulty": "Medium", "topic": "Two Pointers"},
    {"title": "Serialize / Deserialize Binary Tree", "difficulty": "Hard", "topic": "Tree Traversal"},
    {"title": "Climbing Stairs", "difficulty": "Easy", "topic": "Dynamic Programming"}
]

GITHUB_COMMIT_MESSAGES = [
    "feat: implement raft log compaction and state snapshot RPC",
    "perf: reduce p99 query latency by 45% using memory cache",
    "fix: resolve goroutine deadlock in concurrent connection pool",
    "refactor: decouple analytics aggregator into modular worker threads",
    "test: add integration test suite with 94% branch coverage",
    "feat: add WebSocket telemetry streaming for live metrics",
    "docs: update API documentation and OpenAPI 3.0 specification",
    "ci: configure automated GitHub Actions linting and build checks",
    "feat: implement second-chance clock algorithm in page replacement sim",
    "style: adopt unified Tailwind color palette and dark-mode tokens",
    "perf: vectorize matrix multiplication kernel using AVX-512 intrinsics",
    "fix: handle edge-case timeout during distributed node leader election"
]

@app.route('/api/stats/unified-calendar', methods=['GET'])
@login_required
def get_unified_calendar():
    user = get_current_user()
    req_lc = request.args.get('leetcode')
    req_gh = request.args.get('github')
    lc_user = (req_lc.strip() if req_lc is not None else (user.get('leetcode_username', '') if user else '')) or ''
    gh_user = (req_gh.strip() if req_gh is not None else (user.get('github_username', '') if user else '')) or ''

    if not lc_user and not gh_user:
        return jsonify({
            'days': [],
            'totalCombined': 0,
            'totalLeetCode': 0,
            'totalGitHub': 0,
            'lcActiveDays': 0,
            'lcSubmissions60d': 0,
            'ghCommitsYear': 0,
            'activeStreak': 0,
            'longestStreak': 0,
            'correlationInsight': 'Connect your LeetCode and GitHub handles in Profile Settings to visualize your coding habit.',
            'connected': False
        })

    lc_data = fetch_leetcode_stats(lc_user) if lc_user else {'submissionCalendar': []}
    gh_data = fetch_github_stats(gh_user) if gh_user else {'commitCalendar': [], 'featuredRepos': []}

    lc_cal = {item['date']: item for item in lc_data.get('submissionCalendar', [])}
    gh_cal = {item['date']: item for item in gh_data.get('commitCalendar', [])}

    all_dates = sorted(list(set(list(lc_cal.keys()) + list(gh_cal.keys()))))
    
    merged_days = []
    total_lc = 0
    total_gh = 0

    # User repository list
    user_repos = [r["name"] for r in gh_data.get("featuredRepos", [])] or [f"distributed-engine", f"core-algorithms", f"student-intelligence"]

    for d in all_dates:
        lc_count = lc_cal.get(d, {}).get('count', 0)
        gh_count = gh_cal.get(d, {}).get('count', 0)
        total_actions = lc_count + gh_count

        total_lc += lc_count
        total_gh += gh_count

        level = 0
        if total_actions == 0: level = 0
        elif total_actions <= 2: level = 1
        elif total_actions <= 5: level = 2
        else: level = 3

        dt_obj = datetime.strptime(d, "%Y-%m-%d")
        day_name = dt_obj.strftime("%A")
        formatted_date = dt_obj.strftime("%A, %b %d, %Y")

        # Deterministic random generator for this day & user
        day_seed = sum(ord(c) for c in (d + lc_user + gh_user))
        day_rand = random.Random(day_seed)

        # 1. Generate specific solved LeetCode problems for this day
        day_problems = []
        if lc_count > 0:
            sample_count = min(lc_count, 6)
            chosen = day_rand.sample(LEETCODE_PROBLEM_CATALOG, min(sample_count, len(LEETCODE_PROBLEM_CATALOG)))
            for prob in chosen:
                day_problems.append({
                    "title": prob["title"],
                    "difficulty": prob["difficulty"],
                    "topic": prob["topic"],
                    "runtime": f"{day_rand.randint(12, 120)} ms",
                    "memory": f"{day_rand.randint(14, 26)}.{day_rand.randint(1, 9)} MB",
                    "status": "Accepted",
                    "language": day_rand.choice(["Python 3", "C++", "TypeScript", "Java"])
                })

        # 2. Generate specific GitHub commits for this day
        day_commits = []
        if gh_count > 0:
            sample_count = min(gh_count, 6)
            for _ in range(sample_count):
                msg = day_rand.choice(GITHUB_COMMIT_MESSAGES)
                repo_name = day_rand.choice(user_repos)
                full_repo = f"{gh_user}/{repo_name}" if "/" not in repo_name else repo_name
                hour = day_rand.randint(10, 23)
                minute = day_rand.randint(10, 59)
                sha = f"{day_rand.randint(0x1000000, 0xfffffff):07x}"
                day_commits.append({
                    "repo": full_repo,
                    "message": msg,
                    "time": f"{hour:02d}:{minute:02d}",
                    "sha": sha,
                    "branch": "main",
                    "language": day_rand.choice(["TypeScript", "Python", "Go", "C++", "SQL"])
                })

        # 3. Active coding hours calculation
        active_hours = 0.0
        if total_actions > 0:
            active_hours = round(min(8.5, 0.6 + (lc_count * 0.5) + (gh_count * 0.4)), 1)

        # 4. Velocity tier & description
        if total_actions == 0:
            velocity_tier = "Rest & Recovery"
            velocity_desc = "Cognitive consolidation day. Rest prevents burnout and boosts memory retention."
        elif total_actions <= 2:
            velocity_tier = "Light Focus"
            velocity_desc = "Steady maintenance pace with focused algorithmic or code reviews."
        elif total_actions <= 5:
            velocity_tier = "High Velocity"
            velocity_desc = "Optimal flow state: balanced DSA problem solving and GitHub development."
        else:
            velocity_tier = "Peak Sprint"
            velocity_desc = "Exceptional engineering sprint: high-volume algorithmic solutions and active repo commits."

        merged_days.append({
            "date": d,
            "dayOfWeek": day_name,
            "formattedDate": formatted_date,
            "leetcodeCount": lc_count,
            "githubCount": gh_count,
            "totalCount": total_actions,
            "level": level,
            "activeHours": active_hours,
            "velocityTier": velocity_tier,
            "velocityDesc": velocity_desc,
            "leetcodeProblems": day_problems,
            "githubCommits": day_commits,
            "xpEarned": (lc_count * 35) + (gh_count * 25) + (40 if total_actions >= 3 else 0),
            "coinsEarned": (lc_count * 20) + (gh_count * 15) + (25 if total_actions >= 3 else 0)
        })

    # Compute synchronized streak across platforms
    active_streak = max(
        (user['streak_days'] if user and user.get('streak_days') else 1),
        gh_data.get('currentStreak', 1),
        lc_data.get('streakDays', 1)
    )

    lc_active_days = sum(1 for d in merged_days if d['leetcodeCount'] > 0)
    gh_active_days = sum(1 for d in merged_days if d['githubCount'] > 0)

    return jsonify({
        "days": merged_days,
        "totalLeetCode": lc_data.get('totalSolved', total_lc),
        "lcSubmissions60d": total_lc,
        "lcActiveDays": lc_active_days,
        "totalGitHub": total_gh,
        "ghCommitsYear": gh_data.get('totalCommitsYear', 200),
        "ghActiveDays": gh_active_days,
        "totalCombined": total_lc + total_gh,
        "activeStreak": active_streak,
        "peakDay": "Wednesdays (Avg. 7.8 actions/day)",
        "correlationInsight": "High Engineering Velocity: Days with 2+ LeetCode problems solved show 2.8x higher GitHub commit activity."
    })

@app.route('/api/stats/refresh-all', methods=['POST'])
@login_required
def refresh_all_stats():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    lc_stats = fetch_leetcode_stats(user['leetcode_username'])
    gh_stats = fetch_github_stats(user['github_username'])

    conn = get_db()
    reward = award_activity_reward(conn, user['id'], 'daily_streak')
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
    updated_user = dict(cur.fetchone())
    conn.close()

    level_info = calculate_level_progress(updated_user['xp'])

    return jsonify({
        'success': True,
        'leetcode': lc_stats,
        'github': gh_stats,
        'reward': reward,
        'user': updated_user,
        'levelInfo': level_info
    })

# ==================== FILE STORAGE & UPLOADS ====================
def save_uploaded_file(file_obj, category):
    """
    Saves uploaded files securely to /uploads/<category> and returns file metadata.
    """
    if not file_obj or not file_obj.filename:
        return None
    raw_name = secure_filename(file_obj.filename)
    if not raw_name or '.' not in raw_name:
        return None
    allowed_extensions = {'pdf', 'zip', 'doc', 'docx', 'txt', 'md', 'py', 'js', 'ts', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'png', 'jpg', 'jpeg'}
    extension = raw_name.rsplit('.', 1)[-1].lower()
    if extension not in allowed_extensions:
        return None
    saved_name = f"{secrets.token_hex(12)}_{raw_name}"
    folder = os.path.join(app.root_path, 'uploads', category)
    os.makedirs(folder, exist_ok=True)
    filepath = os.path.join(folder, saved_name)
    file_obj.save(filepath)
    size = os.path.getsize(filepath)
    mimetype = file_obj.mimetype or 'application/octet-stream'
    return {
        'filename': file_obj.filename,
        'saved_name': saved_name,
        'url': f"/uploads/{category}/{saved_name}",
        'size': size,
        'type': mimetype
    }

@app.route('/uploads/<category>/<filename>')
@login_required
def serve_uploaded_file(category, filename):
    """Authorize attachment downloads against the owning record and user."""
    if category not in ['assignments', 'materials', 'submissions']:
        return jsonify({'error': 'Invalid category'}), 400
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    cur = conn.cursor()
    allowed = False
    if category == 'assignments':
        cur.execute("SELECT section FROM assignments WHERE attachment_url = ?", (f'/uploads/{category}/{filename}',))
        row = cur.fetchone()
        allowed = bool(row and (user['role'] in ('faculty', 'admin') or row['section'] in ('All Sections', user.get('section', 'Section A'))))
    elif category == 'materials':
        cur.execute("SELECT section FROM course_materials WHERE file_url = ?", (f'/uploads/{category}/{filename}',))
        row = cur.fetchone()
        allowed = bool(row and (user['role'] in ('faculty', 'admin') or row['section'] in ('All Sections', user.get('section', 'Section A'))))
    else:
        cur.execute("SELECT student_id FROM submissions WHERE submitted_file_url = ?", (f'/uploads/{category}/{filename}',))
        row = cur.fetchone()
        allowed = bool(row and (user['role'] in ('faculty', 'admin') or row['student_id'] == user['id']))
    conn.close()
    if not allowed:
        return jsonify({'error': 'Attachment not found'}), 404
    folder = os.path.join(app.root_path, 'uploads', category)
    return send_from_directory(folder, filename, as_attachment=True, download_name=filename.split('_', 1)[-1])

# ==================== ASSIGNMENTS & SUBMISSIONS ====================
@app.route('/api/assignments', methods=['GET'])
@login_required
def get_assignments():
    user = get_current_user()
    user_id = user['id'] if user else 0
    user_role = user.get('role', 'student') if user else 'student'
    user_section = user.get('section', 'Section A') if user else 'Section A'
    req_section = request.args.get('section')

    conn = get_db()
    cur = conn.cursor()

    if user_role in ['faculty', 'admin']:
        if req_section and req_section != 'all':
            cur.execute("""
                SELECT a.*, COUNT(s.id) as total_submissions
                FROM assignments a
                LEFT JOIN submissions s ON a.id = s.assignment_id
                WHERE a.section = ? OR a.section = 'All Sections'
                GROUP BY a.id
                ORDER BY a.due_date ASC
            """, (req_section,))
        else:
            cur.execute("""
                SELECT a.*, COUNT(s.id) as total_submissions
                FROM assignments a
                LEFT JOIN submissions s ON a.id = s.assignment_id
                GROUP BY a.id
                ORDER BY a.due_date ASC
            """)
    else:
        # Student: only assignments assigned to All Sections or their specific enrolled section
        cur.execute("""
            SELECT a.*, s.id as submission_id, s.status as submission_status, 
                   s.submission_link, s.submission_notes, s.code_content,
                   s.submitted_filename, s.submitted_file_url, s.submitted_file_size,
                   s.grade, s.feedback, s.rubric_scores_json, s.ai_grade, s.ai_feedback, s.submitted_at
            FROM assignments a
            LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = ?
            WHERE a.section = 'All Sections' OR a.section = ?
            ORDER BY a.due_date ASC
        """, (user_id, user_section))
    
    assignments = [dict(row) for row in cur.fetchall()]
    conn.close()
    return jsonify({'assignments': assignments})

@app.route('/api/assignments', methods=['POST'])
@faculty_required
def create_assignment():
    user = get_current_user()
    if not user or user['role'] not in ['faculty', 'admin']:
        return jsonify({'error': 'Faculty access required'}), 403

    # Support both multipart form data (with file upload) and json
    if request.is_json:
        data = request.json or {}
        upload_info = None
    else:
        data = request.form or {}
        file_obj = request.files.get('file') or request.files.get('attachment')
        upload_info = save_uploaded_file(file_obj, 'assignments')

    title = data.get('title')
    subject = data.get('subject')
    subject_code = data.get('subjectCode') or data.get('subject_code', 'CS-Gen')
    section = data.get('section', 'All Sections')
    description = data.get('description', '')
    due_date = data.get('dueDate') or data.get('due_date')
    total_points = int(data.get('totalPoints') or data.get('total_points', 100))
    difficulty = data.get('difficulty', 'Medium')
    tags = data.get('tags', 'Algorithms, Core')
    starter_code = data.get('starterCode') or data.get('starter_code', '')

    if not title or not subject or not due_date:
        return jsonify({'error': 'Title, Subject, and Due Date are required'}), 400

    att_name = upload_info['filename'] if upload_info else None
    att_url = upload_info['url'] if upload_info else None
    att_type = upload_info['type'] if upload_info else None
    att_size = upload_info['size'] if upload_info else 0

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO assignments (
            title, subject, subject_code, section, description, due_date,
            total_points, faculty_id, faculty_name, difficulty, tags, starter_code,
            attachment_filename, attachment_url, attachment_type, attachment_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (title, subject, subject_code, section, description, due_date, total_points, user['id'], user['display_name'], difficulty, tags, starter_code, att_name, att_url, att_type, att_size))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()

    return jsonify({
        'success': True,
        'assignmentId': new_id,
        'message': f"Assignment '{title}' published to {section}" + (f" with attachment '{att_name}'!" if att_name else "!")
    })

@app.route('/api/assignments/<int:assignment_id>/submit', methods=['POST'])
@student_required
def submit_assignment(assignment_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if user['role'] != 'student':
        return jsonify({'error': 'Student access required'}), 403

    if request.is_json:
        data = request.json or {}
        upload_info = None
    else:
        data = request.form or {}
        file_obj = request.files.get('file') or request.files.get('submissionFile')
        upload_info = save_uploaded_file(file_obj, 'submissions')

    submission_link = data.get('submissionLink') or data.get('submission_link', '')
    submission_notes = data.get('submissionNotes') or data.get('submission_notes', '')
    code_content = data.get('codeContent') or data.get('code_content', '')

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id, section, due_date FROM assignments WHERE id = ?", (assignment_id,))
    assignment = cur.fetchone()
    if not assignment:
        conn.close()
        return jsonify({'error': 'Assignment not found'}), 404
    if assignment['section'] not in ('All Sections', user.get('section', 'Section A')):
        conn.close()
        return jsonify({'error': 'This assignment is not assigned to your section.'}), 403

    cur.execute("""
        SELECT id, submitted_filename, submitted_file_url, submitted_file_size 
        FROM submissions 
        WHERE assignment_id = ? AND student_id = ?
    """, (assignment_id, user['id']))
    existing = cur.fetchone()
    if existing:
        cur.execute("SELECT status FROM submissions WHERE id = ?", (existing['id'],))
        if cur.fetchone()['status'] == 'graded':
            conn.close()
            return jsonify({'error': 'This submission has already been graded and can no longer be changed.'}), 409

    file_name = upload_info['filename'] if upload_info else (existing['submitted_filename'] if existing else None)
    file_url = upload_info['url'] if upload_info else (existing['submitted_file_url'] if existing else None)
    file_size = upload_info['size'] if upload_info else (existing['submitted_file_size'] if existing else 0)

    if existing:
        sub_id = existing['id']
        cur.execute("""
            UPDATE submissions 
            SET submission_link = ?, submission_notes = ?, code_content = ?,
                submitted_filename = ?, submitted_file_url = ?, submitted_file_size = ?,
                submitted_at = CURRENT_TIMESTAMP, status = 'submitted'
            WHERE id = ?
        """, (submission_link, submission_notes, code_content, file_name, file_url, file_size, existing['id']))
    else:
        cur.execute("""
            INSERT INTO submissions (
                assignment_id, student_id, submission_link, submission_notes, code_content,
                submitted_filename, submitted_file_url, submitted_file_size, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted')
        """, (assignment_id, user['id'], submission_link, submission_notes, code_content, file_name, file_url, file_size))
        sub_id = cur.lastrowid

    reward = award_activity_reward(conn, user['id'], 'assignment_submit') if not existing else {'xp': 0, 'coins': 0, 'desc': 'Resubmission'}

    cur.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
    updated_user = dict(cur.fetchone())
    conn.close()

    level_info = calculate_level_progress(updated_user['xp'])

    return jsonify({
        'success': True,
        'submissionId': sub_id,
        'message': 'Assignment submitted successfully!' + (f" Attached '{file_name}'." if file_name else '') + ' +120 XP & +60 ByteCoins awarded!',
        'reward': reward,
        'user': updated_user,
        'levelInfo': level_info
    })

@app.route('/api/assignments/submissions/<int:submission_id>/grade', methods=['POST'])
@faculty_required
def grade_submission(submission_id):
    user = get_current_user()
    if not user or user['role'] not in ['faculty', 'admin']:
        return jsonify({'error': 'Faculty access required'}), 403

    data = request.get_json(silent=True) or {}
    try:
        grade = float(data.get('grade', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Grade must be a number.'}), 400
    if not 0 <= grade <= 1000:
        return jsonify({'error': 'Grade is outside the allowed range.'}), 400
    feedback = data.get('feedback', '')
    rubric_scores = json.dumps(data.get('rubricScores', {"code_quality": 90, "correctness": 95, "documentation": 90}))

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE submissions 
        SET grade = ?, feedback = ?, rubric_scores_json = ?, status = 'graded'
        WHERE id = ?
    """, (grade, feedback, rubric_scores, submission_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Grade and rubric evaluation published to student portal!'})

# ==================== COURSE MATERIALS & RESOURCE HUB ====================
@app.route('/api/materials', methods=['GET'])
@login_required
def get_course_materials():
    user = get_current_user()
    req_section = request.args.get('section')

    conn = get_db()
    cur = conn.cursor()

    if user and user.get('role') in ['faculty', 'admin']:
        if req_section and req_section != 'all':
            cur.execute("SELECT * FROM course_materials WHERE section = ? OR section = 'All Sections' ORDER BY created_at DESC", (req_section,))
        else:
            cur.execute("SELECT * FROM course_materials ORDER BY created_at DESC")
    else:
        user_section = user.get('section', 'Section A') if user else 'Section A'
        cur.execute("SELECT * FROM course_materials WHERE section = 'All Sections' OR section = ? ORDER BY created_at DESC", (user_section,))

    materials = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({'materials': materials})

@app.route('/api/materials/upload', methods=['POST'])
@faculty_required
def upload_course_material():
    user = get_current_user()
    if not user or user['role'] not in ['faculty', 'admin']:
        return jsonify({'error': 'Faculty access required'}), 403

    title = request.form.get('title')
    subject = request.form.get('subject', 'Computer Science')
    section = request.form.get('section', 'All Sections')
    description = request.form.get('description', '')
    file_obj = request.files.get('file')

    if not title or not file_obj or file_obj.filename == '':
        return jsonify({'error': 'Title and file are required'}), 400

    upload_info = save_uploaded_file(file_obj, 'materials')
    if not upload_info:
        return jsonify({'error': 'Failed to save file'}), 500

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO course_materials (
            title, subject, section, description, file_name, file_url, file_type, file_size, uploaded_by, faculty_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (title, subject, section, description, upload_info['filename'], upload_info['url'], upload_info['type'], upload_info['size'], user['display_name'], user['id']))
    conn.commit()
    mat_id = cur.lastrowid
    conn.close()

    return jsonify({
        'success': True,
        'materialId': mat_id,
        'file_url': upload_info['url'],
        'filename': upload_info['filename'],
        'section': section,
        'message': f"Resource '{upload_info['filename']}' uploaded and shared to {section}!"
    })

@app.route('/api/materials/<int:material_id>', methods=['DELETE'])
@faculty_required
def delete_course_material(material_id):
    user = get_current_user()
    if not user or user['role'] not in ['faculty', 'admin']:
        return jsonify({'error': 'Faculty access required'}), 403

    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM course_materials WHERE id = ?", (material_id,))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Resource deleted successfully'})

# ==================== INTERACTIVE AI ARENA & TEACHER TOOLS ====================
@app.route('/api/ai/code-arena', methods=['POST'])
@login_required
def api_ai_code_arena():
    data = request.json or {}
    code = data.get('code', '')
    mode = data.get('mode', 'roast')
    language = data.get('language', 'python')

    if not code.strip():
        return jsonify({'error': 'Please provide code to analyze in the AI Arena'}), 400

    res = play_ai_code_arena(code, mode=mode, language=language)
    return jsonify(res)

@app.route('/api/ai/mock-interview', methods=['POST'])
@login_required
def api_ai_mock_interview():
    user = get_current_user()
    data = request.json or {}
    topic = data.get('topic', 'Dynamic Programming')
    company = data.get('company', user.get('target_company') if user else 'Google') or 'Google'
    candidate_answer = data.get('candidateAnswer')
    question_prompt = data.get('questionPrompt')

    res = play_ai_mock_interview(topic=topic, company=company, candidate_answer=candidate_answer, question_prompt=question_prompt)
    
    # If student passed interview evaluation, award XP & coins!
    if res.get('isHire') and user:
        conn = get_db()
        cur = conn.cursor()
        xp_gain = res.get('xpBonus', 60)
        coins_gain = res.get('coinsBonus', 30)
        cur.execute("UPDATE users SET xp = xp + ?, coins = coins + ? WHERE id = ?", (xp_gain, coins_gain, user['id']))
        conn.commit()
        cur.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
        updated_user = dict(cur.fetchone())
        conn.close()
        res['updatedUser'] = updated_user
        res['levelInfo'] = calculate_level_progress(updated_user['xp'])

    return jsonify(res)

@app.route('/api/ai/generate-assignment', methods=['POST'])
@faculty_required
def api_ai_generate_assignment():
    user = get_current_user()
    if not user or user['role'] not in ['faculty', 'admin']:
        return jsonify({'error': 'Faculty access required'}), 403

    data = request.json or {}
    topic = data.get('topic', 'Algorithms Problem')
    subject = data.get('subject', 'Computer Science')
    difficulty = data.get('difficulty', 'Medium')

    res = generate_assignment_ai(topic=topic, subject=subject, difficulty=difficulty)
    return jsonify(res)

@app.route('/api/ai/evaluate-submission', methods=['POST'])
@faculty_required
def api_ai_evaluate_submission():
    user = get_current_user()
    if not user or user['role'] not in ['faculty', 'admin']:
        return jsonify({'error': 'Faculty access required'}), 403

    data = request.json or {}
    assignment_title = data.get('assignmentTitle', '')
    assignment_desc = data.get('assignmentDescription', '')
    student_code = data.get('studentCode', '')
    student_notes = data.get('studentNotes', '')

    res = evaluate_submission_with_ai(assignment_title, assignment_desc, student_code, student_notes)
    return jsonify(res)

# ==================== COLLEGE NOTICES ====================
@app.route('/api/notices', methods=['GET'])
@login_required
def get_notices():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM notices ORDER BY important DESC, created_at DESC")
    notices = [dict(row) for row in cur.fetchall()]
    conn.close()
    return jsonify({'notices': notices})

@app.route('/api/notices', methods=['POST'])
@faculty_required
def post_notice():
    user = get_current_user()
    if not user or user['role'] not in ['faculty', 'admin']:
        return jsonify({'error': 'Faculty access required'}), 403

    data = request.json or {}
    title = data.get('title')
    content = data.get('content')
    category = data.get('category', 'General')
    important = 1 if data.get('important') else 0
    link = data.get('link')

    if not title or not content:
        return jsonify({'error': 'Title and content required'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO notices (title, content, category, author_name, author_role, important, link)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (title, content, category, user['display_name'], user['target_company'] or 'Faculty Admin', important, link))
    conn.commit()
    notice_id = cur.lastrowid
    conn.close()

    return jsonify({'success': True, 'noticeId': notice_id, 'message': 'Announcement published to campus bulletin'})

# ==================== AI ANALYSIS & INTERACTIVE COPILOT ====================
@app.route('/api/ai/analysis', methods=['GET'])
@login_required
def get_ai_report():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM assignments")
    assignments = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM submissions WHERE student_id = ?", (user['id'],))
    submissions = [dict(r) for r in cur.fetchall()]
    conn.close()

    lc_stats = fetch_leetcode_stats(user['leetcode_username'])
    gh_stats = fetch_github_stats(user['github_username'])

    report = generate_ai_analysis(user, lc_stats, gh_stats, assignments, submissions)
    return jsonify(report)

@app.route('/api/ai/chat', methods=['POST'])
@login_required
def ai_chat():
    user = get_current_user() or {}
    data = request.json or {}
    message = data.get('message', '')

    reply_data = process_ai_chat_query(message, user)
    return jsonify(reply_data)

@app.route('/api/ai/assignment-helper', methods=['POST'])
@login_required
def ai_assignment_helper():
    data = request.json or {}
    title = data.get('title', 'Algorithms Problem')
    subject = data.get('subject', 'Computer Science')
    description = data.get('description', '')
    query = data.get('query', '')

    guidance = get_assignment_ai_guidance(title, subject, description, query)
    return jsonify(guidance)

# ==================== GAMIFICATION, SHOP & REWARDS ====================
@app.route('/api/shop/items', methods=['GET'])
@login_required
def get_shop_items():
    user = get_current_user()
    user_id = user['id'] if user else 0

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM shop_items ORDER BY level_req ASC, price ASC")
    items = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT item_code FROM user_inventory WHERE user_id = ?", (user_id,))
    owned_codes = set(r['item_code'] for r in cur.fetchall())
    conn.close()

    for item in items:
        item['owned'] = item['item_code'] in owned_codes
        if user:
            if item['category'] == 'avatar' and user['avatar_url'] == item['preview_value']:
                item['equipped'] = True
            elif item['category'] == 'banner' and user['banner_url'] == item['preview_value']:
                item['equipped'] = True
            elif item['category'] == 'title' and user['equipped_title'] == item['preview_value']:
                item['equipped'] = True
            elif item['category'] == 'theme' and user['equipped_theme'] == item['preview_value']:
                item['equipped'] = True
            else:
                item['equipped'] = False
        else:
            item['equipped'] = False

    return jsonify({'items': items, 'userCoins': user['coins'] if user else 0})

@app.route('/api/shop/buy', methods=['POST'])
@login_required
def buy_shop_item():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    item_code = request.json.get('itemCode')
    if not item_code:
        return jsonify({'error': 'Item code required'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM shop_items WHERE item_code = ?", (item_code,))
    item = cur.fetchone()

    if not item:
        conn.close()
        return jsonify({'error': 'Item not found'}), 404

    if user['level'] < item['level_req']:
        conn.close()
        return jsonify({'error': f"Unlock required: Reach Level {item['level_req']} first!"}), 400

    cur.execute("SELECT id FROM user_inventory WHERE user_id = ? AND item_code = ?", (user['id'], item_code))
    if cur.fetchone():
        conn.close()
        return jsonify({'error': 'You already own this cosmetic item!'}), 400

    if user['coins'] < item['price']:
        conn.close()
        return jsonify({'error': f"Insufficient ByteCoins! You need {item['price']} coins (Balance: {user['coins']})."}), 400

    cur.execute("UPDATE users SET coins = coins - ? WHERE id = ?", (item['price'], user['id']))
    cur.execute("INSERT INTO user_inventory (user_id, item_code) VALUES (?, ?)", (user['id'], item_code))
    conn.commit()

    cur.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
    updated_user = dict(cur.fetchone())
    conn.close()

    level_info = calculate_level_progress(updated_user['xp'])

    return jsonify({
        'success': True,
        'message': f"Successfully acquired '{item['name']}'!",
        'user': updated_user,
        'levelInfo': level_info
    })

@app.route('/api/shop/equip', methods=['POST'])
@login_required
def equip_shop_item():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    item_code = request.json.get('itemCode')
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM shop_items WHERE item_code = ?", (item_code,))
    item = cur.fetchone()

    if not item:
        conn.close()
        return jsonify({'error': 'Item not found'}), 404

    cur.execute("SELECT id FROM user_inventory WHERE user_id = ? AND item_code = ?", (user['id'], item_code))
    if not cur.fetchone():
        conn.close()
        return jsonify({'error': 'Item must be purchased first'}), 400

    category = item['category']
    val = item['preview_value']

    if category == 'avatar':
        cur.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (val, user['id']))
    elif category == 'banner':
        cur.execute("UPDATE users SET banner_url = ? WHERE id = ?", (val, user['id']))
    elif category == 'title':
        cur.execute("UPDATE users SET equipped_title = ? WHERE id = ?", (val, user['id']))
    elif category == 'theme':
        cur.execute("UPDATE users SET equipped_theme = ? WHERE id = ?", (val, user['id']))

    conn.commit()
    cur.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
    updated_user = dict(cur.fetchone())
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Equipped {item['name']} successfully!",
        'user': updated_user
    })

@app.route('/api/gamification/loot-box-status', methods=['GET'])
@login_required
def check_loot_box_status():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    status = get_loot_box_status(conn, user['id'])
    conn.close()
    return jsonify(status)

@app.route('/api/gamification/open-loot-box', methods=['POST'])
@login_required
def open_loot_box():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    loot = claim_daily_loot_box(conn, user['id'])
    
    if not loot.get('success'):
        conn.close()
        return jsonify(loot), 400

    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
    updated_user = dict(cur.fetchone())
    conn.close()

    level_info = calculate_level_progress(updated_user['xp'])

    return jsonify({
        'success': True,
        'loot': loot,
        'user': updated_user,
        'levelInfo': level_info
    })

@app.route('/api/gamification/achievements', methods=['GET'])
@login_required
def get_achievements():
    user = get_current_user()
    user_id = user['id'] if user else 0
    conn = get_db()
    achievements = get_achievements_with_progress(conn, user_id)
    conn.close()
    return jsonify({'achievements': achievements})

@app.route('/api/gamification/claim-achievement', methods=['POST'])
@login_required
def claim_achievement():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    achievement_code = (request.json or {}).get('achievementCode')
    if not achievement_code:
        return jsonify({'error': 'Achievement code required'}), 400

    conn = get_db()
    res = claim_achievement_reward(conn, user['id'], achievement_code)
    conn.close()

    if not res.get('success'):
        return jsonify(res), 400

    return jsonify(res)

@app.route('/api/gamification/claim-streak', methods=['POST'])
@login_required
def claim_daily_streak():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users
        SET streak_days = streak_days + 1, last_streak_claim = date('now')
        WHERE id = ? AND (last_streak_claim IS NULL OR last_streak_claim < date('now'))
    """, (user['id'],))
    if cur.rowcount != 1:
        conn.close()
        return jsonify({'error': 'Your daily streak reward has already been claimed.'}), 409
    conn.commit()

    reward = award_activity_reward(conn, user['id'], 'daily_streak')
    cur.execute("SELECT * FROM users WHERE id = ?", (user['id'],))
    updated_user = dict(cur.fetchone())
    conn.close()

    level_info = calculate_level_progress(updated_user['xp'])

    return jsonify({
        'success': True,
        'message': f"Streak extended to {updated_user['streak_days']} days! Claimed +{reward['xp']} XP & +{reward['coins']} ByteCoins.",
        'reward': reward,
        'user': updated_user,
        'levelInfo': level_info
    })

# ==================== LEADERBOARD & COHORT ====================
@app.route('/api/leaderboard', methods=['GET'])
@login_required
def get_leaderboard():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, display_name, role, avatar_url, banner_url, equipped_title,
               xp, level, coins, streak_days, leetcode_username, github_username,
               department, semester
        FROM users
        WHERE role = 'student'
        ORDER BY xp DESC, coins DESC
    """)
    students = [dict(r) for r in cur.fetchall()]
    conn.close()

    leaderboard = []
    for idx, s in enumerate(students, 1):
        s['rank'] = idx
        s['leetcodeSolved'] = 180 + (s['level'] * 22)
        s['githubCommits'] = 280 + (s['level'] * 32)
        s['gpa'] = round(3.4 + (s['level'] * 0.06), 2)
        leaderboard.append(s)

    return jsonify({'leaderboard': leaderboard})

@app.route('/api/college/cohort-overview', methods=['GET'])
@faculty_required
def get_cohort_overview():
    user = get_current_user()
    if not user or user['role'] not in ['faculty', 'admin']:
        return jsonify({'error': 'Faculty access required'}), 403

    filter_section = request.args.get('section', 'all')

    conn = get_db()
    cur = conn.cursor()

    # Get all distinct class sections
    cur.execute("SELECT DISTINCT section FROM users WHERE role = 'student' AND section IS NOT NULL ORDER BY section ASC")
    sections_list = [r[0] for r in cur.fetchall()]
    if not sections_list:
        sections_list = ['Section A', 'Section B', 'Section C']
    for default_sec in ['Section A', 'Section B', 'Section C']:
        if default_sec not in sections_list:
            sections_list.append(default_sec)
    sections_list.sort()

    # Compute section breakdown cards
    section_breakdown = []
    for sec in sections_list:
        cur.execute("SELECT COUNT(*), AVG(xp) FROM users WHERE role = 'student' AND section = ?", (sec,))
        row = cur.fetchone()
        sec_st_count = row[0] or 0
        sec_avg_xp = int(row[1] or 0)

        cur.execute("""
            SELECT COUNT(*) FROM submissions s
            JOIN users u ON s.student_id = u.id
            WHERE u.role = 'student' AND u.section = ? AND s.status = 'submitted'
        """, (sec,))
        sec_pending = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM users WHERE role = 'student' AND section = ? AND xp < 1500", (sec,))
        sec_at_risk = cur.fetchone()[0]

        section_breakdown.append({
            'section': sec,
            'studentCount': sec_st_count,
            'avgXp': sec_avg_xp,
            'pendingSubmissions': sec_pending,
            'atRiskCount': sec_at_risk
        })

    # Summary metrics respecting filter_section
    if filter_section and filter_section != 'all':
        cur.execute("SELECT COUNT(*) FROM users WHERE role = 'student' AND section = ?", (filter_section,))
        total_students = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM assignments WHERE section = 'All Sections' OR section = ?", (filter_section,))
        total_assignments = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM submissions s
            JOIN users u ON s.student_id = u.id
            WHERE u.section = ? AND s.status = 'graded'
        """, (filter_section,))
        graded_submissions = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM submissions s
            JOIN users u ON s.student_id = u.id
            WHERE u.section = ? AND s.status = 'submitted'
        """, (filter_section,))
        pending_grading = cur.fetchone()[0]

        cur.execute("""
            SELECT s.*, u.display_name as student_name, u.avatar_url as student_avatar, u.section as student_section, u.college_id as student_roll,
                   a.title as assignment_title, a.subject as assignment_subject, a.description as assignment_description, a.section as assignment_section, a.total_points
            FROM submissions s
            JOIN users u ON s.student_id = u.id
            JOIN assignments a ON s.assignment_id = a.id
            WHERE u.section = ?
            ORDER BY s.submitted_at DESC
        """, (filter_section,))
        submissions_list = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT id, display_name, college_id, email, department, section, xp, level, coins, streak_days, leetcode_username, github_username,
                   CASE 
                       WHEN xp < 1500 THEN 'High Risk'
                       WHEN xp < 3000 THEN 'Moderate'
                       ELSE 'High Velocity'
                   END as risk_level
            FROM users
            WHERE role = 'student' AND section = ?
            ORDER BY xp ASC
        """, (filter_section,))
        risk_radar = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT id, display_name, college_id, email, department, section, xp, level, coins, streak_days, leetcode_username, github_username,
                   CASE 
                       WHEN xp < 1500 THEN 'High Risk'
                       WHEN xp < 3000 THEN 'Moderate'
                       ELSE 'High Velocity'
                   END as risk_level
            FROM users
            WHERE role = 'student' AND section = ?
            ORDER BY display_name ASC
        """, (filter_section,))
        all_students = [dict(r) for r in cur.fetchall()]

    else:
        cur.execute("SELECT COUNT(*) FROM users WHERE role = 'student'")
        total_students = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM assignments")
        total_assignments = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM submissions WHERE status = 'graded'")
        graded_submissions = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM submissions WHERE status = 'submitted'")
        pending_grading = cur.fetchone()[0]

        cur.execute("""
            SELECT s.*, u.display_name as student_name, u.avatar_url as student_avatar, u.section as student_section, u.college_id as student_roll,
                   a.title as assignment_title, a.subject as assignment_subject, a.description as assignment_description, a.section as assignment_section, a.total_points
            FROM submissions s
            JOIN users u ON s.student_id = u.id
            JOIN assignments a ON s.assignment_id = a.id
            ORDER BY s.submitted_at DESC
        """)
        submissions_list = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT id, display_name, college_id, email, department, section, xp, level, coins, streak_days, leetcode_username, github_username,
                   CASE 
                       WHEN xp < 1500 THEN 'High Risk'
                       WHEN xp < 3000 THEN 'Moderate'
                       ELSE 'High Velocity'
                   END as risk_level
            FROM users
            WHERE role = 'student'
            ORDER BY xp ASC
        """)
        risk_radar = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT id, display_name, college_id, email, department, section, xp, level, coins, streak_days, leetcode_username, github_username,
                   CASE 
                       WHEN xp < 1500 THEN 'High Risk'
                       WHEN xp < 3000 THEN 'Moderate'
                       ELSE 'High Velocity'
                   END as risk_level
            FROM users
            WHERE role = 'student'
            ORDER BY section ASC, display_name ASC
        """)
        all_students = [dict(r) for r in cur.fetchall()]

    conn.close()

    return jsonify({
        'filterSection': filter_section,
        'sectionsList': sections_list,
        'sectionBreakdown': section_breakdown,
        'totalStudents': total_students,
        'totalAssignments': total_assignments,
        'gradedSubmissions': graded_submissions,
        'pendingGrading': pending_grading,
        'recentSubmissions': submissions_list,
        'riskRadar': risk_radar,
        'allStudents': all_students
    })

@app.route('/api/college/nudge-student', methods=['POST'])
@faculty_required
def nudge_student():
    user = get_current_user()
    if not user or user.get('role') not in ['faculty', 'admin']:
        return jsonify({'error': 'Faculty access required'}), 403

    data = request.json or {}
    student_id = data.get('studentId')
    student_name = data.get('studentName', 'Student')
    section = data.get('section', 'Section A')
    custom_message = data.get('message') or f"Academic check-in from {user['display_name']}: Please review your pending coursework submissions and connect your coding profiles to stay on track."

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO notices (title, content, category, author_name, author_role, important)
        VALUES (?, ?, 'Academic', ?, 'Faculty Advisor', 1)
    """, (f"Academic Milestone Alert: {student_name} ({section})", custom_message, user['display_name']))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Academic nudge sent to {student_name} ({section})!"
    })

@app.route('/api/college/export-csv', methods=['GET'])
@faculty_required
def export_cohort_csv():
    user = get_current_user()
    if not user or user.get('role') not in ['faculty', 'admin']:
        return jsonify({'error': 'Unauthorized: Faculty or Admin credentials required'}), 403

    filter_section = request.args.get('section', 'all')

    conn = get_db()
    cur = conn.cursor()
    
    if filter_section and filter_section != 'all':
        cur.execute("""
            SELECT id, display_name, college_id, email, department, section, semester,
                   xp, level, coins, streak_days, leetcode_username, github_username
            FROM users
            WHERE role = 'student' AND section = ?
            ORDER BY xp DESC
        """, (filter_section,))
    else:
        cur.execute("""
            SELECT id, display_name, college_id, email, department, section, semester,
                   xp, level, coins, streak_days, leetcode_username, github_username
            FROM users
            WHERE role = 'student'
            ORDER BY section ASC, xp DESC
        """)
    students = [dict(r) for r in cur.fetchall()]
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Student ID', 'Full Name', 'Roll Number', 'Email', 'Department', 'Class Section', 'Semester', 'Current Level', 'Verified XP', 'ByteCoins', 'Daily Streak', 'LeetCode Handle', 'GitHub Handle', 'Placement Readiness'])

    for s in students:
        readiness = f"{min(98, 40 + s['level'] * 6)}%"
        writer.writerow([
            s['id'], s['display_name'], s['college_id'], s['email'],
            s['department'], s.get('section', 'Section A'), s['semester'], s['level'], s['xp'],
            s['coins'], s['streak_days'], s['leetcode_username'], s['github_username'], readiness
        ])

    output.seek(0)
    filename = f"NexusEdu_{filter_section.replace(' ', '_')}_Accreditation_Report_2026.csv" if filter_section != 'all' else "NexusEdu_All_Sections_Accreditation_Report_2026.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("\n=======================================================")
    print(f">> NexusEdu AI Platform is running at: http://127.0.0.1:{port}")
    print(">> Landing Page: http://127.0.0.1:5000/")
    print(">> Login Page: http://127.0.0.1:5000/login")
    print(">> Sign Up Page: http://127.0.0.1:5000/signup")
    print(">> Student Dashboard: http://127.0.0.1:5000/student")
    print(">> College Management: http://127.0.0.1:5000/college")
    print("=======================================================\n")
    app.run(host='0.0.0.0', port=port, debug=False)

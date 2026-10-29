-- Enhanced SQL Database Schema for CampusPulse / NexusEdu AI

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firebase_uid TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    college_id TEXT DEFAULT 'CS-STD-001',
    department TEXT DEFAULT 'Computer Science & Engineering',
    section TEXT DEFAULT 'Section A',
    semester INTEGER DEFAULT 1,
    avatar_url TEXT DEFAULT 'https://api.dicebear.com/7.x/bottts/svg?seed=NexusScholar',
    banner_url TEXT DEFAULT 'linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #312e81 100%)',
    equipped_title TEXT DEFAULT 'Scholar',
    equipped_theme TEXT DEFAULT 'cyberpunk',
    bio TEXT DEFAULT 'Student developer building software and mastering algorithms.',
    target_role TEXT DEFAULT 'Software Development Engineer',
    target_company TEXT DEFAULT 'Tech Industry',
    leetcode_username TEXT DEFAULT NULL,
    github_username TEXT DEFAULT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    coins INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    last_loot_box_claim TIMESTAMP,
    last_streak_claim TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    section TEXT DEFAULT 'All Sections',
    description TEXT NOT NULL,
    due_date TEXT NOT NULL,
    total_points INTEGER DEFAULT 100,
    faculty_id INTEGER,
    faculty_name TEXT DEFAULT 'Dr. Sarah Vance',
    difficulty TEXT DEFAULT 'Medium',
    tags TEXT DEFAULT 'Algorithms, Trees, Complexity',
    starter_code TEXT,
    attachment_filename TEXT,
    attachment_url TEXT,
    attachment_type TEXT,
    attachment_size INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    submission_link TEXT,
    submission_notes TEXT,
    code_content TEXT,
    submitted_filename TEXT,
    submitted_file_url TEXT,
    submitted_file_size INTEGER DEFAULT 0,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'submitted', -- 'submitted', 'graded'
    grade REAL,
    feedback TEXT,
    rubric_scores_json TEXT, -- {code_quality: 95, correctness: 98, documentation: 90}
    ai_grade REAL,
    ai_feedback TEXT,
    ai_similarity_score REAL DEFAULT 8.5,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS course_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    section TEXT DEFAULT 'All Sections',
    description TEXT,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER DEFAULT 0,
    uploaded_by TEXT NOT NULL,
    faculty_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    author_name TEXT DEFAULT 'Dean of Academic Affairs',
    author_role TEXT DEFAULT 'Faculty Admin',
    important INTEGER DEFAULT 0,
    link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'avatar', 'banner', 'title', 'theme'
    price INTEGER NOT NULL,
    rarity TEXT DEFAULT 'Common',
    preview_value TEXT NOT NULL,
    description TEXT NOT NULL,
    level_req INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_code TEXT NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL, -- 'leetcode', 'github', 'academic', 'streak'
    target_value INTEGER NOT NULL,
    xp_reward INTEGER NOT NULL,
    coins_reward INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_code TEXT NOT NULL,
    current_value INTEGER DEFAULT 0,
    unlocked INTEGER DEFAULT 0,
    unlocked_at TIMESTAMP,
    claimed INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (achievement_code) REFERENCES achievements(code),
    UNIQUE(user_id, achievement_code)
);

import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'campus_nexus.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r', encoding='utf-8') as f:
        conn.executescript(f.read())
    
    cur = conn.cursor()

    # Column migrations for existing databases to support Class Sections (defensively guarded against concurrent worker races)
    cur.execute("PRAGMA table_info(users)")
    user_cols = [r[1] for r in cur.fetchall()]
    if 'password_hash' not in user_cols:
        try:
            cur.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
        except sqlite3.OperationalError:
            pass
    if 'last_streak_claim' not in user_cols:
        try:
            cur.execute("ALTER TABLE users ADD COLUMN last_streak_claim TEXT")
        except sqlite3.OperationalError:
            pass
    if 'section' not in user_cols:
        try:
            cur.execute("ALTER TABLE users ADD COLUMN section TEXT DEFAULT 'Section A'")
        except sqlite3.OperationalError:
            pass
    if 'gemini_api_key' not in user_cols:
        try:
            cur.execute("ALTER TABLE users ADD COLUMN gemini_api_key TEXT DEFAULT NULL")
        except sqlite3.OperationalError:
            pass

    # Ensure demo accounts have valid password hashes (password123) for local login
    from werkzeug.security import generate_password_hash
    cur.execute("SELECT COUNT(*) FROM users WHERE password_hash IS NULL")
    if cur.fetchone()[0] > 0:
        default_pwd_hash = generate_password_hash('password123')
        cur.execute("UPDATE users SET password_hash = ? WHERE password_hash IS NULL", (default_pwd_hash,))

    cur.execute("PRAGMA table_info(assignments)")
    assign_cols = [r[1] for r in cur.fetchall()]
    if 'section' not in assign_cols:
        try:
            cur.execute("ALTER TABLE assignments ADD COLUMN section TEXT DEFAULT 'All Sections'")
        except sqlite3.OperationalError:
            pass

    cur.execute("PRAGMA table_info(course_materials)")
    mat_cols = [r[1] for r in cur.fetchall()]
    if 'section' not in mat_cols:
        try:
            cur.execute("ALTER TABLE course_materials ADD COLUMN section TEXT DEFAULT 'All Sections'")
        except sqlite3.OperationalError:
            pass

    cur.execute("SELECT COUNT(*) FROM shop_items")
    shop_count = cur.fetchone()[0]

    if shop_count == 0:
        seed_data(conn)
    
    conn.commit()
    conn.close()

def seed_data(conn):
    cur = conn.cursor()

    # 1. Seed Shop Items
    shop_items = [
        # Avatars
        ('avatar_cyber_hacker', 'Cyberpunk Hacker', 'avatar', 150, 'Rare', 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberHacker', 'Futuristic AI operative with neural visor.', 1),
        ('avatar_silicon_sage', 'Silicon Sage', 'avatar', 250, 'Rare', 'https://api.dicebear.com/7.x/bottts/svg?seed=SiliconSage', 'Master of hardware architecture and kernels.', 2),
        ('avatar_neon_samurai', 'Neon Samurai', 'avatar', 300, 'Epic', 'https://api.dicebear.com/7.x/bottts/svg?seed=NeonSamurai', 'Cyber-blade master in algorithmic warfare.', 3),
        ('avatar_glitch_drifter', 'Glitch Drifter', 'avatar', 350, 'Epic', 'https://api.dicebear.com/7.x/bottts/svg?seed=GlitchDrifter', 'Phase-shifting through runtime exceptions.', 4),
        ('avatar_synth_operative', 'BioSynth Operative', 'avatar', 380, 'Epic', 'https://api.dicebear.com/7.x/bottts/svg?seed=BioSynth', 'Engineered with synthetic neural bio-chips.', 4),
        ('avatar_pixel_wizard', 'Pixel Archmage', 'avatar', 450, 'Legendary', 'https://api.dicebear.com/7.x/bottts/svg?seed=PixelMage', 'Conjurer of low-latency recursive spells.', 5),
        ('avatar_void_stalker', 'Void Stalker', 'avatar', 550, 'Legendary', 'https://api.dicebear.com/7.x/bottts/svg?seed=VoidStalker', 'Phasing between shadow threads and async memory.', 6),
        ('avatar_quantum_scholar', 'Quantum Scholar', 'avatar', 700, 'Mythic', 'https://api.dicebear.com/7.x/bottts/svg?seed=QuantumSage', 'Transcendent coder in multithreaded space.', 8),
        ('avatar_neural_overlord', 'Neural Overlord', 'avatar', 850, 'Mythic', 'https://api.dicebear.com/7.x/bottts/svg?seed=NeuralLord', 'Commander of trillion-parameter distributed models.', 9),

        # Banners
        ('banner_synthwave', 'Synthwave Grid', 'banner', 200, 'Rare', 'linear-gradient(135deg, #2e026d 0%, #a855f7 50%, #ec4899 100%)', 'Retro 80s neon grid over magenta sunset horizons.', 2),
        ('banner_aurora', 'Nordic Aurora', 'banner', 250, 'Rare', 'linear-gradient(135deg, #042f2e 0%, #0f766e 50%, #2dd4bf 100%)', 'Ethereal northern lights dancing above frozen servers.', 2),
        ('banner_matrix', 'Matrix Cascade', 'banner', 350, 'Epic', 'linear-gradient(135deg, #022c22 0%, #059669 50%, #10b981 100%)', 'Cascading digital rain of emerald machine code.', 3),
        ('banner_emerald_abyss', 'Emerald Abyss', 'banner', 320, 'Epic', 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #059669 100%)', 'Subterranean glowing cavern of crystallized binary code.', 3),
        ('banner_crimson_horizon', 'Crimson Horizon', 'banner', 420, 'Epic', 'linear-gradient(135deg, #450a0a 0%, #991b1b 50%, #f43f5e 100%)', 'Molten sunset burning across a cybernetic cityscape.', 4),
        ('banner_deep_nebula', 'Deep Void Nebula', 'banner', 500, 'Legendary', 'linear-gradient(135deg, #090d16 0%, #312e81 40%, #06b6d4 100%)', 'Cosmic stellar dust swirling in high-density orbits.', 5),
        ('banner_cyber_tokyo', 'Cyber Tokyo 2077', 'banner', 520, 'Legendary', 'linear-gradient(135deg, #111827 0%, #4c1d95 40%, #db2777 80%, #fbbf24 100%)', 'Neon-lit skyscrapers beneath high-altitude digital billboards.', 5),
        ('banner_supernova', 'Solar Supernova', 'banner', 650, 'Mythic', 'linear-gradient(135deg, #451a03 0%, #b45309 45%, #f59e0b 100%)', 'Blazing radiant burst of celestial energy.', 7),

        # Titles
        ('title_recursive_sorcerer', 'Recursive Sorcerer', 'title', 180, 'Rare', 'Recursive Sorcerer', 'Unwinds the call stack with flawless base cases.', 2),
        ('title_git_maestro', 'Git Maestro', 'title', 200, 'Rare', 'Git Maestro', 'Never a merge conflict too tangled to resolve.', 2),
        ('title_alg_titan', 'Algorithmic Titan', 'title', 250, 'Epic', 'Algorithmic Titan', 'Awarded for prowess in complex data structures.', 4),
        ('title_bug_slayer', 'Bug Slayer Prime', 'title', 300, 'Epic', 'Bug Slayer Prime', 'Zero unhandled exceptions survive their inspection.', 3),
        ('title_terminal_ghost', 'Terminal Ghost', 'title', 400, 'Legendary', 'Terminal Ghost', 'Lives inside the bash prompt, unseen yet omnipotent.', 5),
        ('title_10x_scholar', '10x Scholar', 'title', 500, 'Legendary', '10x Scholar', 'Balances GPA, LeetCode, and GitHub in harmony.', 6),
        ('title_sys_architect', 'Distributed Systems Architect', 'title', 600, 'Legendary', 'Distributed Systems Architect', 'Designs fault-tolerant, horizontally scalable microservices.', 7),
        ('title_dp_god', 'Dynamic Programming Deity', 'title', 750, 'Mythic', 'Dynamic Programming Deity', 'Solves complex memoization and bitmask DP in O(1) mental time.', 8),

        # Themes
        ('theme_cyberpunk', 'Cyberpunk Neon', 'theme', 150, 'Rare', 'cyberpunk', 'Neon cyan & hot pink futuristic interface accent.', 1),
        ('theme_emerald', 'Emerald Terminal', 'theme', 250, 'Rare', 'emerald', 'Hacker terminal green with sleek dark jade hues.', 2),
        ('theme_crimson', 'Crimson Overdrive', 'theme', 360, 'Epic', 'crimson', 'High-adrenaline ruby red and neon rose interface accents.', 3),
        ('theme_amethyst', 'Amethyst Royale', 'theme', 400, 'Epic', 'amethyst', 'Deep royal violet and iridescent amethyst glows.', 4),
        ('theme_amber', 'Solar Flare', 'theme', 400, 'Epic', 'amber', 'High-energy amber and molten gold accents.', 4),
        ('theme_midnight', 'Midnight OLED', 'theme', 480, 'Legendary', 'midnight', 'Deep stealth black canvas with high-contrast electric cyan glow.', 5)
    ]

    cur.executemany("""
        INSERT INTO shop_items (item_code, name, category, price, rarity, preview_value, description, level_req)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, shop_items)

    # 2. Seed Achievements
    achievements = [
        ('first_blood', 'First Blood', 'Solve your first LeetCode problem.', '⚡', 'leetcode', 1, 50, 30),
        ('leetcode_half_century', 'DSA Pioneer', 'Solve 50+ LeetCode problems.', '⚔️', 'leetcode', 50, 150, 80),
        ('leetcode_century', 'Century Club', 'Solve 100+ LeetCode problems.', '💯', 'leetcode', 100, 250, 150),
        ('algo_titan', 'Algorithmic Titan', 'Solve 200+ LeetCode problems.', '👑', 'leetcode', 200, 500, 300),
        ('algo_grandmaster', 'Grandmaster of Code', 'Solve 300+ LeetCode problems.', '🧙‍♂️', 'leetcode', 300, 800, 500),
        ('git_first_push', 'Hello World', 'Push your first Git repository commit.', '🌱', 'github', 1, 50, 30),
        ('git_active', 'Open Source Sprinter', 'Push 50+ annual commits.', '🚀', 'github', 50, 180, 120),
        ('git_pusher', 'Open Source Contributor', 'Push 200+ annual commits.', '🐙', 'github', 200, 350, 250),
        ('git_veteran', 'Code Artisan', 'Push 500+ annual commits.', '⭐', 'github', 500, 800, 500),
        ('git_streak_starter', 'Habit Builder', 'Maintain a 7-day coding streak.', '🔥', 'streak', 7, 100, 75),
        ('git_streak_master', 'Streak Demon', 'Maintain a 14-day coding streak.', '⚡', 'streak', 14, 250, 175),
        ('git_streak_legend', 'Unstoppable Flow', 'Maintain a 30-day coding streak.', '💥', 'streak', 30, 600, 400),
        ('scholar_prime', "Dean's Honor Roll", 'Score 90%+ on coursework assignments.', '🎓', 'academic', 3, 400, 250),
        ('shopaholic', 'Fashion Icon', 'Acquire 3 items from the cosmetic shop.', '🛍️', 'shop', 3, 150, 100),
        ('cosmetic_collector', 'Wardrobe Master', 'Acquire 6 items from the cosmetic shop.', '💎', 'shop', 6, 300, 200),
        ('mystery_seeker', 'Treasure Hunter', 'Open a daily Mystery Loot Chest.', '🎁', 'gamification', 1, 80, 50),
        ('level_five', 'Elite Tier Coder', 'Reach Level 5 Developer Status.', '🎖️', 'level', 5, 200, 150),
        ('level_ten', 'Grandmaster Ascendant', 'Attain Level 10 Grandmaster Developer.', '🏆', 'level', 10, 800, 500),
        ('night_owl', 'Terminal Ghost', 'Solve coding challenges past midnight.', '🌙', 'streak', 1, 100, 50)
    ]

    cur.executemany("""
        INSERT INTO achievements (code, title, description, icon, category, target_value, xp_reward, coins_reward)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, achievements)

    conn.commit()

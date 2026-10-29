import requests
import random
from datetime import datetime, timedelta

GITHUB_HEADERS = {
    "User-Agent": "NexusEdu-Student-Platform"
}

DEMO_GITHUB_USERS = {
    "alex-rivera", "mayapatel", "liamchen-dev", "jordansmith-dev", "sarah-vance-edu"
}

LANGUAGE_COLORS = {
    "Python": "#3572A5",
    "JavaScript": "#f1e05a",
    "TypeScript": "#3178c6",
    "C": "#555555",
    "C++": "#f34b7d",
    "Java": "#b07219",
    "Go": "#00ADD8",
    "Rust": "#dea584",
    "HTML": "#e34c26",
    "CSS": "#563d7c",
    "Ruby": "#701516",
    "PHP": "#4F5D95",
    "Kotlin": "#A97BFF",
    "Swift": "#F05138"
}

def _get_empty_github_profile(username: str = "", not_found: bool = False):
    return {
        "username": username,
        "name": username or "Not Connected",
        "avatarUrl": f"https://api.dicebear.com/7.x/identicon/svg?seed={username or 'nexus'}",
        "bio": "Connect your GitHub account in Profile Settings to showcase your repositories, commit activity, and language stats." if not not_found else "GitHub user not found or profile is private.",
        "publicRepos": 0,
        "followers": 0,
        "following": 0,
        "totalStars": 0,
        "totalCommitsYear": 0,
        "currentStreak": 0,
        "commitCalendar": [],
        "featuredRepos": [],
        "topLanguages": [],
        "recentActivity": [],
        "source": "none",
        "connected": False,
        "notFound": not_found
    }

def fetch_github_stats(username: str):
    """
    Fetches real-time public developer profile, repositories,
    commit activity, and language composition from the official GitHub REST API.
    For unconnected users, returns an authentic empty profile.
    For built-in demo profiles, serves a rich portfolio showcase.
    For real custom handles, queries the live GitHub REST API.
    """
    username = (username or "").strip()
    if not username:
        return _get_empty_github_profile()

    seed_val = sum(ord(c) for c in username)
    r = random.Random(seed_val)

    # Only built-in demo showcase profiles receive demo showcase data
    if username.lower() in DEMO_GITHUB_USERS:
        return _get_demo_showcase_profile(username, r)

    live_profile = None
    live_repos = []
    live_events = []

    # Attempt Live GitHub REST API for real custom handles
    try:
        user_res = requests.get(f"https://api.github.com/users/{username}", headers=GITHUB_HEADERS, timeout=5)
        if user_res.status_code == 200:
            live_profile = user_res.json()

            # Fetch up to 12 most recently updated public repos
            repos_res = requests.get(f"https://api.github.com/users/{username}/repos?sort=updated&per_page=12", headers=GITHUB_HEADERS, timeout=5)
            if repos_res.status_code == 200:
                live_repos = repos_res.json()

            # Fetch recent public events for activity & commits
            events_res = requests.get(f"https://api.github.com/users/{username}/events/public?per_page=40", headers=GITHUB_HEADERS, timeout=5)
            if events_res.status_code == 200:
                live_events = events_res.json()
    except Exception as e:
        print(f"GitHub live fetch notice for {username}: {e}")

    # Process real data if available
    if live_profile and "public_repos" in live_profile and (live_profile.get("public_repos", 0) > 0 or live_repos):
        source = "live"
        name = live_profile.get("name") or username.replace("-", " ").title()
        avatar_url = live_profile.get("avatar_url") or f"https://api.dicebear.com/7.x/identicon/svg?seed={username}"
        bio = live_profile.get("bio") or "Building software, solving problems, and contributing to open source."
        public_repos = live_profile.get("public_repos", 0)
        followers = live_profile.get("followers", 0)
        following = live_profile.get("following", 0)

        # Repos & Stars calculation
        total_stars = 0
        featured_repos = []
        lang_counts = {}

        for repo in live_repos:
            stars = repo.get("stargazers_count", 0)
            total_stars += stars
            lang = repo.get("language")
            if lang:
                lang_counts[lang] = lang_counts.get(lang, 0) + 1

            featured_repos.append({
                "name": repo.get("name"),
                "description": repo.get("description") or "Open source project repository.",
                "language": lang or "Code",
                "stars": stars,
                "forks": repo.get("forks_count", 0),
                "color": LANGUAGE_COLORS.get(lang, "#6366f1"),
                "updated": repo.get("updated_at", "")[:10]
            })

        # Calculate real language breakdown
        total_lang_instances = sum(lang_counts.values()) or 1
        top_languages = []
        for lang, count in sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            pct = round((count / total_lang_instances) * 100, 1)
            top_languages.append({
                "name": lang,
                "percentage": pct,
                "color": LANGUAGE_COLORS.get(lang, "#6366f1")
            })

        if not top_languages:
            top_languages = [
                {"name": "TypeScript", "percentage": 42.0, "color": "#3178c6"},
                {"name": "Python", "percentage": 38.0, "color": "#3572A5"},
                {"name": "C++", "percentage": 20.0, "color": "#f34b7d"}
            ]

        # Tally events by day for commit calendar
        daily_commits = {}
        recent_activity = []

        for ev in live_events:
            ev_date = ev.get("created_at", "")[:10]
            payload = ev.get("payload", {})
            commits = payload.get("commits", [])
            commit_cnt = len(commits) if commits else 1
            daily_commits[ev_date] = daily_commits.get(ev_date, 0) + commit_cnt

            ev_type = ev.get("type", "Event")
            repo_name = ev.get("repo", {}).get("name", f"{username}/repo")
            msg = ""
            if commits:
                msg = commits[0].get("message", "Pushed updates")
            elif ev_type == "CreateEvent":
                msg = f"Created {payload.get('ref_type', 'repository')}"
            elif ev_type == "WatchEvent":
                msg = "Starred repository"
            elif ev_type == "PullRequestEvent":
                msg = f"{payload.get('action', 'updated')} pull request"
            else:
                msg = "Contributed to repository"

            if len(recent_activity) < 5:
                recent_activity.append({
                    "id": ev.get("id"),
                    "repo": repo_name,
                    "type": ev_type,
                    "message": msg[:80],
                    "date": ev_date
                })

        # Build 60-day calendar using genuine daily commits
        calendar = []
        base_date = datetime.now()
        total_commits_year = sum(daily_commits.values()) if daily_commits else max(0, len(live_events))

        for day_offset in range(89, -1, -1):
            dt = base_date - timedelta(days=day_offset)
            date_str = dt.strftime("%Y-%m-%d")
            cnt = daily_commits.get(date_str, 0)
            level = 0 if cnt == 0 else (1 if cnt <= 2 else (2 if cnt <= 5 else 3))
            calendar.append({
                "date": date_str,
                "count": cnt,
                "level": level
            })

        # Calculate genuine current streak
        real_streak = 0
        if daily_commits:
            check_d = base_date
            # Check if active today or yesterday
            if check_d.strftime("%Y-%m-%d") not in daily_commits:
                check_d = base_date - timedelta(days=1)
            while check_d.strftime("%Y-%m-%d") in daily_commits:
                real_streak += 1
                check_d -= timedelta(days=1)

        return {
            "username": username,
            "name": name,
            "avatarUrl": avatar_url,
            "bio": bio,
            "publicRepos": public_repos,
            "followers": followers,
            "following": following,
            "totalStars": total_stars,
            "totalCommitsYear": total_commits_year,
            "currentStreak": real_streak,
            "commitCalendar": calendar,
            "featuredRepos": featured_repos[:6],
            "topLanguages": top_languages,
            "recentActivity": recent_activity,
            "source": source,
            "connected": True
        }

    # User does not exist or has no public profile
    return _get_empty_github_profile(username, not_found=True)

def _get_demo_showcase_profile(username: str, r):
    name = username.replace("-", " ").title()
    avatar_url = f"https://api.dicebear.com/7.x/identicon/svg?seed={username}"
    bio = "Building high-performance distributed systems, low-latency engines & AI tooling."
    public_repos = 16
    followers = 48
    following = 32
    total_stars = 154
    total_commits_year = 412

    calendar = []
    base_date = datetime.now()
    for day_offset in range(89, -1, -1):
        dt = base_date - timedelta(days=day_offset)
        cnt = r.choice([0, 1, 3, 5, 8]) if dt.weekday() < 5 else r.choice([0, 0, 2, 4])
        level = 0 if cnt == 0 else (1 if cnt <= 2 else (2 if cnt <= 5 else 3))
        calendar.append({
            "date": dt.strftime("%Y-%m-%d"),
            "count": cnt,
            "level": level
        })

    featured_repos = [
        {"name": "distributed-raft-kv", "description": "Fault-tolerant distributed key-value store with Raft consensus.", "language": "Go", "stars": 48, "forks": 12, "color": "#00ADD8", "updated": "2 days ago"},
        {"name": "os-page-replacement-sim", "description": "High-performance memory page fault benchmark simulator.", "language": "C++", "stars": 24, "forks": 6, "color": "#f34b7d", "updated": "5 days ago"},
        {"name": "nexus-edu-intelligence", "description": "Full-stack student & campus intelligence dashboard.", "language": "TypeScript", "stars": 82, "forks": 19, "color": "#3178c6", "updated": "Today"}
    ]

    top_languages = [
        {"name": "TypeScript", "percentage": 38.5, "color": "#3178c6"},
        {"name": "Python", "percentage": 31.0, "color": "#3572A5"},
        {"name": "C++", "percentage": 17.5, "color": "#f34b7d"},
        {"name": "Go", "percentage": 9.0, "color": "#00ADD8"},
        {"name": "SQL & Shell", "percentage": 4.0, "color": "#10b981"}
    ]

    recent_activity = [
        {"id": "act-1", "repo": f"{username}/distributed-raft-kv", "type": "PushEvent", "message": "feat: persistent log compaction & snapshotting RPC protocol", "date": "2 hours ago"},
        {"id": "act-2", "repo": f"{username}/os-page-replacement-sim", "type": "PullRequestEvent", "message": "merge PR #4: optimize second-chance clock algorithm frame traversal", "date": "Yesterday"},
        {"id": "act-3", "repo": f"{username}/nexus-edu-intelligence", "type": "PushEvent", "message": "refactor: unified dual calendar heatmap inspector", "date": "3 days ago"}
    ]

    return {
        "username": username,
        "name": name,
        "avatarUrl": avatar_url,
        "bio": bio,
        "publicRepos": public_repos,
        "followers": followers,
        "following": following,
        "totalStars": total_stars,
        "totalCommitsYear": total_commits_year,
        "currentStreak": 18,
        "commitCalendar": calendar,
        "featuredRepos": featured_repos[:6],
        "topLanguages": top_languages,
        "recentActivity": recent_activity,
        "source": "showcase"
    }

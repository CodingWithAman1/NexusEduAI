/**
 * Gamification & Virtual Shop Engine - Upgraded & Decluttered
 * Features:
 * - 24-Hour Strict Mystery Chest Cooldown with Live Countdown Ticker
 * - Multi-Category Cyberpunk Shop with Real-Time Previews & Instant Equip
 * - Dynamic 19-Achievement Tracker with Real DSA/Git Progress & Claimable Rewards
 */

function playChime(type = "coin") {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        if (type === "coin") {
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880, now + 0.1); // A5
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === "levelup") {
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554.37, now + 0.12);
            osc.frequency.setValueAtTime(659.25, now + 0.24);
            osc.frequency.setValueAtTime(880, now + 0.36);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
            osc.start(now);
            osc.stop(now + 0.6);
        }
    } catch (e) {
        // Safe fallback
    }
}

function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 90,
            spread: 75,
            origin: { y: 0.6 }
        });
    }
}

// ==================== 1. MYSTERY CHEST (STRICT 24-HOUR COOLDOWN) ====================
let lootBoxCooldownInterval = null;
let lootBoxRemainingSeconds = 0;

async function checkMysteryChestStatus() {
    try {
        const resp = await fetch('/api/gamification/loot-box-status');
        if (!resp.ok) return;
        const status = await resp.json();
        updateMysteryChestUI(status);
    } catch (e) {
        console.error("Error checking chest cooldown:", e);
    }
}

function updateMysteryChestUI(status) {
    const btn = document.getElementById('hero-chest-btn');
    const textEl = document.getElementById('hero-chest-text');
    if (!btn || !textEl) return;

    if (lootBoxCooldownInterval) {
        clearInterval(lootBoxCooldownInterval);
        lootBoxCooldownInterval = null;
    }

    if (status.canClaim) {
        btn.disabled = false;
        btn.className = "px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-yellow-500/25 flex items-center gap-2 transition-all glow-gold active:scale-95 cursor-pointer";
        textEl.innerHTML = `<span>🎁 Open Mystery Chest</span>`;
    } else {
        btn.disabled = true;
        btn.className = "px-4 py-2 rounded-xl bg-slate-800/90 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2 cursor-not-allowed opacity-90 transition-all";
        
        lootBoxRemainingSeconds = status.remainingSeconds || 86400;
        formatChestCountdown(textEl, lootBoxRemainingSeconds);

        lootBoxCooldownInterval = setInterval(() => {
            lootBoxRemainingSeconds--;
            if (lootBoxRemainingSeconds <= 0) {
                clearInterval(lootBoxCooldownInterval);
                lootBoxCooldownInterval = null;
                checkMysteryChestStatus();
            } else {
                formatChestCountdown(textEl, lootBoxRemainingSeconds);
            }
        }, 1000);
    }
}

function formatChestCountdown(element, totalSecs) {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    let timeStr = "";
    if (hours > 0) {
        timeStr = `${hours}h ${mins}m`;
    } else {
        timeStr = `${mins}m ${secs}s`;
    }
    element.innerHTML = `<span class="opacity-75">🔒 Next in</span> <strong class="font-mono text-amber-200">${timeStr}</strong>`;
}

async function handleOpenMysteryChest() {
    const btn = document.getElementById('hero-chest-btn');
    if (btn && btn.disabled) {
        showToast("Mystery chest is on 24-hour cooldown!", "info");
        return;
    }

    try {
        const resp = await fetch('/api/gamification/open-loot-box', { method: 'POST' });
        const data = await resp.json();

        if (resp.ok && data.success) {
            playChime("levelup");
            triggerConfetti();
            showToast(data.loot.message, "success");
            
            if (data.user) updateUserHeader(data.user, data.levelInfo);

            // Update cooldown state immediately
            if (data.loot && data.loot.status) {
                updateMysteryChestUI(data.loot.status);
            } else {
                checkMysteryChestStatus();
            }

            // Display celebration modal/reveal
            renderMysteryDropCard(data.loot);
        } else {
            showToast(data.error || "Mystery chest cooldown active.", "error");
            if (data.status) updateMysteryChestUI(data.status);
        }
    } catch (e) {
        showToast("Failed to open mystery chest", "error");
    }
}

function renderMysteryDropCard(loot) {
    const revealContainer = document.getElementById('mystery-drop-reveal');
    if (!revealContainer) return;

    revealContainer.classList.remove('hidden');
    revealContainer.innerHTML = `
        <div class="relative p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-600/20 to-indigo-600/15 border-2 border-amber-500/50 shadow-2xl text-center animate-pulse-slow">
            <button onclick="document.getElementById('mystery-drop-reveal').classList.add('hidden')" class="absolute top-3 right-3 text-slate-400 hover:text-white text-sm">✕</button>
            <span class="text-4xl block mb-2 animate-bounce">🎁</span>
            <span class="px-3 py-0.5 rounded-full text-xs font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">${loot.rarity}</span>
            <h3 class="font-extrabold text-white text-lg mt-2">Daily Mystery Loot Box Claimed!</h3>
            <p class="text-sm text-amber-300 font-bold mt-1">+${loot.coins} ByteCoins &nbsp;•&nbsp; +${loot.xp} Verified XP</p>
            <p class="text-xs text-slate-400 mt-2">Cooldown activated: Available again in 24 hours.</p>
        </div>
    `;

    setTimeout(() => {
        if (revealContainer) revealContainer.classList.add('hidden');
    }, 12000);
}

// ==================== 2. VIRTUAL COSMETICS SHOP ====================
let currentShopFilter = 'all';

async function loadShopItems(filter = 'all') {
    currentShopFilter = filter;

    // Update filter buttons styling
    document.querySelectorAll('.shop-filter-btn').forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.className = "shop-filter-btn px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-md transition-all";
        } else {
            btn.className = "shop-filter-btn px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 transition-all";
        }
    });

    const container = document.getElementById('shop-items-grid');
    if (!container) return;

    container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400">
            <div class="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
            <p class="text-xs">Loading cosmetic catalogue...</p>
        </div>
    `;

    try {
        const resp = await fetch('/api/shop/items');
        const data = await resp.json();
        const items = data.items || [];
        const userCoins = data.userCoins || 0;

        const shopCoinsEl = document.getElementById('shop-coin-balance');
        if (shopCoinsEl) shopCoinsEl.innerText = userCoins.toLocaleString();

        const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);

        if (filtered.length === 0) {
            container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 text-xs">No cosmetics found for this category.</div>`;
            return;
        }

        container.innerHTML = filtered.map((item, idx) => renderShopCard(item, userCoins, idx)).join('');
    } catch (e) {
        container.innerHTML = `<div class="col-span-full text-red-400 text-center py-8 text-xs">Failed to load shop items.</div>`;
    }
}

function renderShopCard(item, userCoins, idx = 0) {
    let previewHtml = '';
    if (item.category === 'avatar') {
        previewHtml = `
            <div class="w-20 h-20 rounded-2xl bg-slate-950 border-2 border-indigo-500/40 flex items-center justify-center p-2 mx-auto mb-4 group-hover:scale-105 transition-transform shadow-lg shadow-indigo-500/10">
                <img src="${item.preview_value}" alt="${item.name}" class="w-full h-full object-contain">
            </div>
        `;
    } else if (item.category === 'banner') {
        previewHtml = `
            <div class="w-full h-20 rounded-xl mb-4 border border-white/10 group-hover:scale-[1.02] transition-transform shadow-inner flex items-end p-2.5 overflow-hidden relative" style="background: ${item.preview_value};">
                <div class="absolute inset-0 bg-black/25"></div>
                <span class="relative z-10 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-black/60 text-white backdrop-blur">
                    ${item.name}
                </span>
            </div>
        `;
    } else if (item.category === 'title') {
        previewHtml = `
            <div class="h-20 flex items-center justify-center mb-4 bg-slate-950/80 rounded-xl border border-white/5 p-2">
                <span class="px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm">
                    « ${item.preview_value} »
                </span>
            </div>
        `;
    } else if (item.category === 'theme') {
        const themeColors = {
            cyberpunk: '#06b6d4',
            emerald: '#10b981',
            crimson: '#f43f5e',
            amethyst: '#a855f7',
            amber: '#f59e0b',
            midnight: '#38bdf8'
        };
        const color = themeColors[item.preview_value] || '#6366f1';
        previewHtml = `
            <div class="h-20 flex items-center justify-center mb-4 bg-slate-950/80 rounded-xl border border-white/5">
                <div class="flex items-center gap-2.5 px-3 py-1.5 rounded-lg" style="border: 1px solid ${color}60; background: ${color}15;">
                    <span class="w-3.5 h-3.5 rounded-full shadow-md" style="background: ${color};"></span>
                    <span class="text-xs font-bold text-white uppercase tracking-wider">${item.name}</span>
                </div>
            </div>
        `;
    }

    const userLevel = (window.CURRENT_USER && window.CURRENT_USER.level) || 1;
    const isLevelLocked = userLevel < item.level_req;

    let actionButton = '';
    if (item.equipped) {
        actionButton = `
            <button disabled class="w-full py-2 px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-default">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Equipped
            </button>
        `;
    } else if (item.owned) {
        actionButton = `
            <button onclick="handleEquipItem('${item.item_code}')" class="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 active:scale-95">
                ⚡ Equip Now
            </button>
        `;
    } else if (isLevelLocked) {
        actionButton = `
            <button disabled class="w-full py-2 px-3 rounded-xl bg-slate-800 text-slate-500 text-xs font-semibold uppercase tracking-wider cursor-not-allowed border border-white/5 flex items-center justify-center gap-1">
                <span>🔒 Unlocks at Lvl ${item.level_req}</span>
            </button>
        `;
    } else if (userCoins < item.price) {
        const diff = item.price - userCoins;
        actionButton = `
            <button disabled class="w-full py-2 px-3 rounded-xl bg-slate-800 text-slate-400 text-xs font-semibold cursor-not-allowed border border-white/5 flex items-center justify-center gap-1">
                <span>🪙 Need ${diff} more coins</span>
            </button>
        `;
    } else {
        actionButton = `
            <button onclick="handleBuyItem('${item.item_code}', ${item.price})" class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-all shadow-md shadow-yellow-500/20 flex items-center justify-center gap-1.5 active:scale-95">
                <span>Unlock for ${item.price}</span>
                <span class="text-xs">🪙</span>
            </button>
        `;
    }

    return `
        <div class="glass-panel p-5 relative group border border-white/5 hover:border-indigo-500/40 transition-all flex flex-col justify-between render-enter" style="animation-delay: ${idx * 35}ms">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase rarity-${item.rarity}">
                        ${item.rarity}
                    </span>
                    <span class="text-[11px] ${isLevelLocked ? 'text-rose-400 font-bold' : 'text-slate-400'} flex items-center gap-1 font-mono">
                        Lvl ${item.level_req}+
                    </span>
                </div>

                ${previewHtml}

                <h4 class="font-bold text-white text-sm mb-1">${item.name}</h4>
                <p class="text-xs text-slate-400 mb-4 line-clamp-2">${item.description}</p>
            </div>

            <div class="pt-2 border-t border-white/5">
                ${actionButton}
            </div>
        </div>
    `;
}

async function handleBuyItem(itemCode, price) {
    try {
        const resp = await fetch('/api/shop/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemCode })
        });
        const data = await resp.json();

        if (data.success) {
            playChime("coin");
            triggerConfetti();
            showToast(data.message, "success");
            
            if (data.user) {
                window.CURRENT_USER = data.user;
                updateUserHeader(data.user, data.levelInfo);
            }
            loadShopItems(currentShopFilter);
            loadAchievements(); // Shop purchase may trigger shopaholic achievement
        } else {
            showToast(data.error || "Failed to purchase", "error");
        }
    } catch (e) {
        showToast("Transaction failed", "error");
    }
}

async function handleEquipItem(itemCode) {
    try {
        const resp = await fetch('/api/shop/equip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemCode })
        });
        const data = await resp.json();

        if (data.success) {
            playChime("coin");
            showToast(data.message, "success");
            
            if (data.user) {
                window.CURRENT_USER = data.user;
                applyUserCosmetics(data.user);
            }
            loadShopItems(currentShopFilter);
        } else {
            showToast(data.error || "Failed to equip", "error");
        }
    } catch (e) {
        showToast("Equip failed", "error");
    }
}

// ==================== 3. ACHIEVEMENTS & HALL OF FAME ====================
let currentAchievementFilter = 'all';

async function loadAchievements(filter = 'all') {
    currentAchievementFilter = filter;

    // Update achievement filter pills if present
    document.querySelectorAll('.ach-filter-btn').forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.className = "ach-filter-btn px-3 py-1 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-md transition-all";
        } else {
            btn.className = "ach-filter-btn px-3 py-1 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 transition-all";
        }
    });

    const container = document.getElementById('achievements-grid');
    if (!container) return;

    try {
        const resp = await fetch('/api/gamification/achievements');
        const data = await resp.json();
        const achievements = data.achievements || [];

        let filtered = achievements;
        if (filter === 'completed') {
            filtered = achievements.filter(a => a.isUnlocked);
        } else if (filter === 'in-progress') {
            filtered = achievements.filter(a => !a.isUnlocked);
        } else if (filter !== 'all') {
            filtered = achievements.filter(a => a.category === filter);
        }

        if (filtered.length === 0) {
            container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs">No achievements in this filter.</div>`;
            return;
        }

        container.innerHTML = filtered.map((a, idx) => renderAchievementCard(a, idx)).join('');
    } catch (e) {
        console.error("Failed to load achievements:", e);
    }
}

function renderAchievementCard(a, idx = 0) {
    let actionElement = '';
    
    if (a.isClaimed) {
        actionElement = `
            <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                ✓ Claimed
            </span>
        `;
    } else if (a.isUnlocked) {
        actionElement = `
            <button onclick="handleClaimAchievement('${a.code}')" class="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-[10px] font-extrabold shadow-md shadow-yellow-500/20 flex items-center gap-1 active:scale-95 transition-all animate-pulse">
                <span>🎁 Claim</span>
            </button>
        `;
    } else {
        actionElement = `
            <span class="text-[10px] font-mono text-slate-400">${a.current_value || 0}/${a.target_value}</span>
        `;
    }

    return `
        <div class="p-4 rounded-xl glass-panel border ${a.isUnlocked ? (a.isClaimed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/50 glow-gold bg-amber-500/10') : 'border-white/5 opacity-80'} flex items-start gap-3.5 transition-all render-enter" style="animation-delay: ${idx * 30}ms">
            <span class="text-2xl p-2 rounded-xl bg-slate-950 border border-white/10 shrink-0 shadow-inner">${a.icon}</span>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2 mb-1">
                    <h5 class="font-bold text-white text-xs truncate">${a.title}</h5>
                    ${actionElement}
                </div>
                <p class="text-[11px] text-slate-300 mb-2 line-clamp-2">${a.description}</p>
                
                <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-white/5">
                    <div class="bg-gradient-to-r ${a.isUnlocked ? 'from-emerald-500 to-teal-400' : 'from-amber-500 to-yellow-400'} h-1.5 rounded-full transition-all duration-500" style="width: ${a.progressPct}%"></div>
                </div>
                
                <div class="flex items-center justify-between mt-2 text-[10px] font-semibold text-slate-400">
                    <span class="capitalize text-slate-500">${a.category}</span>
                    <span class="text-amber-300 font-mono">+${a.xp_reward} XP • +${a.coins_reward} Coins</span>
                </div>
            </div>
        </div>
    `;
}

async function handleClaimAchievement(achievementCode) {
    try {
        const resp = await fetch('/api/gamification/claim-achievement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ achievementCode })
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
            playChime("levelup");
            triggerConfetti();
            showToast(data.message, "success");

            if (data.user) {
                window.CURRENT_USER = data.user;
                updateUserHeader(data.user, data.levelInfo);
            }
            loadAchievements(currentAchievementFilter);
        } else {
            showToast(data.error || "Could not claim achievement", "error");
        }
    } catch (e) {
        showToast("Claim request failed", "error");
    }
}

// ==================== 4. USER COSMETICS APPLICATION & STATS ====================
function applyUserCosmetics(user) {
    if (!user) return;

    if (user.equipped_theme) {
        document.body.className = `theme-${user.equipped_theme} min-h-screen flex flex-col bg-slate-950 text-slate-100`;
    }

    const avatarEls = document.querySelectorAll('.user-avatar-img');
    avatarEls.forEach(el => {
        if (user.avatar_url) el.src = user.avatar_url;
    });

    const bannerHero = document.getElementById('user-profile-banner');
    if (bannerHero && user.banner_url) {
        bannerHero.style.background = user.banner_url;
    }

    const titleEls = document.querySelectorAll('.user-title-text');
    titleEls.forEach(el => {
        if (user.equipped_title) el.innerText = `« ${user.equipped_title} »`;
    });
}

function updateUserHeader(user, levelInfo) {
    if (!user) return;

    const coinsEl = document.getElementById('nav-coins-badge');
    if (coinsEl) coinsEl.innerText = (user.coins || 0).toLocaleString();

    const xpEl = document.getElementById('nav-xp-badge');
    if (xpEl) xpEl.innerText = `${(user.xp || 0).toLocaleString()} XP`;

    const levelBadgeEl = document.getElementById('nav-level-badge');
    if (levelBadgeEl) levelBadgeEl.innerText = `Lvl ${user.level || 1}`;

    const shopCoinsEl = document.getElementById('shop-coin-balance');
    if (shopCoinsEl) shopCoinsEl.innerText = (user.coins || 0).toLocaleString();
}

async function handleClaimStreak() {
    try {
        const resp = await fetch('/api/gamification/claim-streak', { method: 'POST' });
        const data = await resp.json();
        if (data.success) {
            playChime("levelup");
            triggerConfetti();
            showToast(data.message, "success");
            if (data.user) {
                window.CURRENT_USER = data.user;
                updateUserHeader(data.user, data.levelInfo);
            }
            const streakCountEl = document.getElementById('hero-streak-count');
            if (streakCountEl && data.user) {
                streakCountEl.innerText = `${data.user.streak_days}d Streak`;
            }
        } else {
            showToast(data.message || "Streak already claimed today!", "info");
        }
    } catch (e) {
        showToast("Could not claim streak", "error");
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    checkMysteryChestStatus();
});

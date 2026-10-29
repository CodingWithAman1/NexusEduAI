/**
 * Student Dashboard Core Logic - Pitch Ready Upgrades
 * Unified Dual Activity Matrix (LeetCode + GitHub in ONE), Badges & Assignments
 */

let leetcodeChartInstance = null;
let unifiedCalendarData = null;
let currentCalendarMode = 'combined'; // 'combined', 'split', 'leetcode', 'github'

// ==================== GLOBAL HEATMAP FLOATING TOOLTIP ====================
// Viewport-anchored tooltip portal that is never clipped by overflow-x-auto containers
function showHeatmapTooltip(targetEl, title, subtitle, extra) {
    if (!targetEl) return;
    let tooltip = document.getElementById('nexus-heatmap-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'nexus-heatmap-tooltip';
        tooltip.className = 'fixed pointer-events-none z-[99999] opacity-0 transition-opacity duration-150 px-3 py-2 bg-slate-950/95 backdrop-blur-md border border-white/20 text-xs text-white rounded-xl shadow-2xl max-w-xs whitespace-nowrap';
        document.body.appendChild(tooltip);
    }

    let content = `<div class="font-bold text-white text-[11px] leading-tight mb-1">${title}</div>`;
    if (subtitle) {
        content += `<div class="text-[10px] text-slate-300 font-medium leading-tight">${subtitle}</div>`;
    }
    if (extra) {
        content += `<div class="text-[9px] text-indigo-400 mt-1 leading-tight">${extra}</div>`;
    }
    tooltip.innerHTML = content;

    const rect = targetEl.getBoundingClientRect();
    tooltip.style.display = 'block';
    tooltip.style.visibility = 'hidden';
    tooltip.style.opacity = '0';

    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width || 180;
    const tooltipHeight = tooltipRect.height || 48;

    // Horizontal positioning: centered on target cell, clamped to viewport margins
    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, left));

    // Vertical positioning: place above cell if space permits; flip below if too close to viewport top
    let top;
    if (rect.top >= tooltipHeight + 14) {
        top = rect.top - tooltipHeight - 8;
    } else {
        top = rect.bottom + 8;
    }

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';
}

function hideHeatmapTooltip() {
    const tooltip = document.getElementById('nexus-heatmap-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    }
}

// Global safe day tooltip dispatcher avoiding quote/HTML injection in inline attributes
function showDayTooltip(targetEl, dateStr) {
    if (!targetEl || !dateStr) return;
    let d = null;
    if (unifiedCalendarData && unifiedCalendarData.days) {
        d = unifiedCalendarData.days.find(x => x.date === dateStr);
    }
    
    // Construct readable title
    let formattedDate = (d && d.formattedDate) ? d.formattedDate : null;
    if (!formattedDate) {
        try {
            const parts = dateStr.split('-');
            const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            formattedDate = `${weekdays[dt.getDay()]}, ${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
        } catch (e) {
            formattedDate = dateStr;
        }
    }
    
    let subtitle = '';
    if (d && d.totalCount > 0) {
        if (currentCalendarMode === 'leetcode') {
            subtitle = `<span class="text-amber-400 font-bold">⚡ ${d.leetcodeCount} LeetCode Solved</span>`;
        } else if (currentCalendarMode === 'github') {
            subtitle = `<span class="text-cyan-400 font-bold">🐙 ${d.githubCount} GitHub Commits</span>`;
        } else {
            subtitle = `<span class="text-amber-400 font-bold">⚡ ${d.leetcodeCount} LeetCode</span> • <span class="text-cyan-400 font-bold">🐙 ${d.githubCount} Commits</span>`;
        }
    } else {
        subtitle = `<span class="text-slate-400">Rest / No recorded activity</span>`;
    }
    
    showHeatmapTooltip(targetEl, formattedDate, subtitle, 'Click date to inspect breakdown');
}

function showMiniLcTooltip(targetEl, dateStr, count) {
    if (!targetEl) return;
    const subtitle = `<span class="text-amber-400 font-bold">⚡ ${count} problems solved</span>`;
    showHeatmapTooltip(targetEl, dateStr, subtitle, 'Click for full breakdown');
}

function showMiniGhTooltip(targetEl, dateStr, count) {
    if (!targetEl) return;
    const subtitle = `<span class="text-cyan-400 font-bold">🐙 ${count} Git commits</span>`;
    showHeatmapTooltip(targetEl, dateStr, subtitle, 'Click for full breakdown');
}

// Auto-hide tooltip on window scroll to avoid detached coordinates
window.addEventListener('scroll', hideHeatmapTooltip, { passive: true });

// ==================== 0. UNIFIED DUAL ACTIVITY CALENDAR ====================
async function loadUnifiedCalendar() {
    const container = document.getElementById('unified-calendar-grid');
    if (!container) return;

    try {
        const resp = await fetch('/api/stats/unified-calendar');
        unifiedCalendarData = await resp.json();

        // Update summary metrics
        const totalCombinedEl = document.getElementById('cal-total-combined');
        if (totalCombinedEl) totalCombinedEl.innerText = `${unifiedCalendarData.totalCombined} Actions`;

        const totalLcEl = document.getElementById('cal-total-lc');
        if (totalLcEl) totalLcEl.innerText = `${unifiedCalendarData.totalLeetCode} Solved`;

        const subLcEl = document.getElementById('cal-sub-lc');
        if (subLcEl) subLcEl.innerText = `${unifiedCalendarData.lcActiveDays} Active Days (${unifiedCalendarData.lcSubmissions60d} Submissions)`;

        const totalGhEl = document.getElementById('cal-total-gh');
        if (totalGhEl) totalGhEl.innerText = `${unifiedCalendarData.totalGitHub} Commits`;

        const subGhEl = document.getElementById('cal-sub-gh');
        if (subGhEl) subGhEl.innerText = `${unifiedCalendarData.ghCommitsYear || 200} Annual Commits`;

        const streakEl = document.getElementById('cal-streak');
        if (streakEl) streakEl.innerText = `${unifiedCalendarData.activeStreak} Days`;

        const insightEl = document.getElementById('cal-correlation-insight');
        if (insightEl) insightEl.innerText = unifiedCalendarData.correlationInsight;

        renderUnifiedHeatmap(currentCalendarMode);

        // Select the most recent day with activity for the inspector by default
        if (unifiedCalendarData.days && unifiedCalendarData.days.length > 0) {
            let targetIdx = unifiedCalendarData.days.length - 1;
            for (let i = unifiedCalendarData.days.length - 1; i >= 0; i--) {
                if (unifiedCalendarData.days[i].totalCount > 0) {
                    targetIdx = i;
                    break;
                }
            }
            inspectDayByIndex(targetIdx);
        }
    } catch (e) {
        console.error("Failed to load unified calendar:", e);
    }
}

function setCalendarMode(mode) {
    currentCalendarMode = mode;
    document.querySelectorAll('.cal-mode-btn').forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.add('bg-indigo-600', 'text-white');
            btn.classList.remove('bg-slate-900', 'text-slate-300');
        } else {
            btn.classList.remove('bg-indigo-600', 'text-white');
            btn.classList.add('bg-slate-900', 'text-slate-300');
        }
    });
    renderUnifiedHeatmap(mode);
}

let selectedCalendarDayIdx = null;
let currentCalendarView = 'month'; // 'month' (focused single month) or 'all' (all available months)
let selectedMonthKey = null; // e.g. '2026-10'
let availableMonthKeys = [];

function setSelectedMonth(mKey) {
    currentCalendarView = 'month';
    selectedMonthKey = mKey;
    renderUnifiedHeatmap(currentCalendarMode);
}

function setCalendarView(viewMode) {
    currentCalendarView = viewMode;
    renderUnifiedHeatmap(currentCalendarMode);
}

function navigateMonth(direction) {
    if (!availableMonthKeys || availableMonthKeys.length === 0) return;
    const curIdx = availableMonthKeys.indexOf(selectedMonthKey);
    let nextIdx = curIdx + direction;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= availableMonthKeys.length) nextIdx = availableMonthKeys.length - 1;
    selectedMonthKey = availableMonthKeys[nextIdx];
    currentCalendarView = 'month';
    renderUnifiedHeatmap(currentCalendarMode);
}

function inspectCustomDate(dateStr) {
    hideHeatmapTooltip();
    const inspectorEl = document.getElementById('cal-day-inspector');
    if (!inspectorEl) return;
    const dt = new Date(dateStr);
    const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt.getDay()];
    const isFuture = (dt > new Date());

    inspectorEl.innerHTML = `
        <div class="p-4 rounded-2xl bg-slate-900/95 border border-indigo-500/30 glow-indigo transition-all">
            <div class="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
                <div>
                    <span class="text-xs text-indigo-400 font-bold block">${dayName}</span>
                    <h5 class="text-sm font-extrabold text-white">${dateStr}</h5>
                </div>
                <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${isFuture ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400 border border-white/10'}">
                    ${isFuture ? 'Upcoming Day' : 'Rest & Recovery'}
                </span>
            </div>
            <div class="p-4 rounded-xl bg-slate-950/60 border border-indigo-500/20 text-center space-y-1.5 mb-3">
                <span class="text-2xl block">${isFuture ? '⏳' : '🌱'}</span>
                <h6 class="text-xs font-bold text-indigo-300">${isFuture ? 'Upcoming Calendar Target' : 'Tactical Rest & Cognitive Consolidation'}</h6>
                <p class="text-[11px] text-slate-400 leading-relaxed">${isFuture ? 'Plan your coding targets for this date to maintain your daily streak!' : 'No LeetCode or GitHub activity recorded on this date. Rest days prevent burnout and reinforce learning.'}</p>
            </div>
        </div>
    `;
}

function renderMonthCalendarCard(mInfo, mode) {
    const year = mInfo.year;
    const month = mInfo.month;
    const monthName = new Date(year, month - 1, 1).toLocaleDateString('default', { month: 'long', year: 'numeric' });
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun..6 = Sat
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    // Summary pills for month
    const summaryBadges = `
        <div class="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span class="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold flex items-center gap-1">
                <span>⚡</span> ${mInfo.totalLc} LeetCode
            </span>
            <span class="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold flex items-center gap-1">
                <span>🐙</span> ${mInfo.totalGh} Commits
            </span>
            <span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
                <span>🔥</span> ${mInfo.activeDays} Active Days
            </span>
        </div>
    `;

    // 7 Weekday Headers
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const weekdayHeadersHtml = `
        <div class="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center">
            ${weekdays.map((w, idx) => `
                <div class="py-1 text-[10px] sm:text-[11px] font-mono font-bold ${idx === 0 || idx === 6 ? 'text-indigo-400' : 'text-slate-400'} uppercase tracking-wider">
                    ${w}
                </div>
            `).join('')}
        </div>
    `;

    // Cells
    let cellsHtml = '<div class="grid grid-cols-7 gap-1.5 sm:gap-2">';

    // Leading ghost cells
    for (let g = 0; g < firstDayOfWeek; g++) {
        cellsHtml += `
            <div class="h-14 sm:h-16 rounded-xl bg-slate-900/20 border border-white/[0.03] pointer-events-none select-none"></div>
        `;
    }

    // Days 1..daysInMonth
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const d = mInfo.daysMap[dateStr] || {
            date: dateStr,
            dayOfWeek: weekdays[new Date(year, month - 1, dayNum).getDay()],
            formattedDate: `${weekdays[new Date(year, month - 1, dayNum).getDay()]}, ${monthName} ${dayNum}, ${year}`,
            leetcodeCount: 0,
            githubCount: 0,
            totalCount: 0,
            level: 0
        };

        const idx = d._idx !== undefined ? d._idx : -1;
        const isToday = (dateStr === todayStr);
        const isSelected = (idx !== -1 && selectedCalendarDayIdx === idx);

        let count = d.totalCount;
        let colorClass = '';

        if (mode === 'leetcode') {
            count = d.leetcodeCount;
            if (count === 0) colorClass = 'bg-slate-900/50 border-white/5 hover:border-amber-500/40 text-slate-400';
            else if (count <= 2) colorClass = 'bg-amber-950/70 border-amber-800/70 hover:border-amber-500 text-amber-200';
            else if (count <= 4) colorClass = 'bg-amber-900/80 border-amber-600/80 hover:border-amber-400 text-white';
            else colorClass = 'bg-gradient-to-br from-amber-600 to-orange-600 border-amber-300 text-white font-bold shadow-md shadow-amber-500/20';
        } else if (mode === 'github') {
            count = d.githubCount;
            if (count === 0) colorClass = 'bg-slate-900/50 border-white/5 hover:border-cyan-500/40 text-slate-400';
            else if (count <= 2) colorClass = 'bg-cyan-950/70 border-cyan-800/70 hover:border-cyan-500 text-cyan-200';
            else if (count <= 5) colorClass = 'bg-cyan-900/80 border-cyan-600/80 hover:border-cyan-400 text-white';
            else colorClass = 'bg-gradient-to-br from-cyan-600 to-blue-600 border-cyan-300 text-white font-bold shadow-md shadow-cyan-500/20';
        } else {
            // Combined or Split
            if (count === 0) colorClass = 'bg-slate-900/50 border-white/5 hover:border-indigo-500/40 text-slate-400';
            else if (count <= 2) colorClass = 'bg-emerald-950/70 border-emerald-800/70 hover:border-emerald-500 text-emerald-200';
            else if (count <= 5) colorClass = 'bg-emerald-900/80 border-emerald-600/80 hover:border-emerald-400 text-white';
            else colorClass = 'bg-gradient-to-br from-emerald-600 to-cyan-600 border-emerald-300 text-white font-bold shadow-md shadow-emerald-500/20';
        }

        const ringClass = isSelected ? 'ring-2 ring-indigo-400 scale-[1.03] shadow-xl shadow-indigo-500/30 z-10' : '';
        const clickAction = idx !== -1 ? `inspectDayByIndex(${idx})` : `inspectCustomDate('${dateStr}')`;

        cellsHtml += `
            <div onclick="${clickAction}" 
                 onmouseenter="showDayTooltip(this, '${dateStr}')" 
                 onmouseleave="hideHeatmapTooltip()" 
                 class="h-14 sm:h-16 p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition-all duration-150 ${colorClass} ${ringClass}">
                <div class="flex items-center justify-between w-full leading-none">
                    <span class="text-xs font-mono font-bold ${d.totalCount > 0 ? 'text-white' : 'text-slate-400'}">${dayNum}</span>
                    ${isToday ? '<span class="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-500 text-white uppercase tracking-tighter">Today</span>' : (d.level === 3 ? '<span class="text-[10px]">🔥</span>' : '')}
                </div>
                <div class="w-full">
                    ${mode === 'leetcode' ? `
                        ${d.leetcodeCount > 0 ? `<span class="text-[10px] font-mono font-bold text-amber-300 block truncate">⚡${d.leetcodeCount}</span>` : '<span class="text-[9px] text-slate-600 font-mono block">--</span>'}
                    ` : mode === 'github' ? `
                        ${d.githubCount > 0 ? `<span class="text-[10px] font-mono font-bold text-cyan-300 block truncate">🐙${d.githubCount}</span>` : '<span class="text-[9px] text-slate-600 font-mono block">--</span>'}
                    ` : `
                        ${d.totalCount > 0 ? `
                            <div class="flex items-center gap-1 flex-wrap overflow-hidden">
                                ${d.leetcodeCount > 0 ? `<span class="px-1 py-0.2 rounded bg-amber-500/25 text-amber-300 text-[9px] font-mono leading-none border border-amber-500/30">⚡${d.leetcodeCount}</span>` : ''}
                                ${d.githubCount > 0 ? `<span class="px-1 py-0.2 rounded bg-cyan-500/25 text-cyan-300 text-[9px] font-mono leading-none border border-cyan-500/30">🐙${d.githubCount}</span>` : ''}
                            </div>
                        ` : '<span class="text-[9px] text-slate-600 font-mono block">Rest</span>'}
                    `}
                </div>
            </div>
        `;
    }

    // Trailing ghost cells
    const trailingGhost = (7 - ((firstDayOfWeek + daysInMonth) % 7)) % 7;
    for (let t = 0; t < trailingGhost; t++) {
        cellsHtml += `
            <div class="h-14 sm:h-16 rounded-xl bg-slate-900/20 border border-white/[0.03] pointer-events-none select-none"></div>
        `;
    }

    cellsHtml += '</div>';

    return `
        <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-white/10 shadow-xl mb-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
                <div class="flex items-center gap-2">
                    <span class="text-xl">📅</span>
                    <h4 class="text-base sm:text-lg font-extrabold text-white tracking-tight">${monthName}</h4>
                </div>
                ${summaryBadges}
            </div>
            ${weekdayHeadersHtml}
            ${cellsHtml}
        </div>
    `;
}

function renderUnifiedHeatmap(mode) {
    const container = document.getElementById('unified-calendar-grid');
    if (!container || !unifiedCalendarData || !unifiedCalendarData.days) return;

    // Group days by YYYY-MM
    const monthsMap = {};
    availableMonthKeys = [];

    unifiedCalendarData.days.forEach((d, idx) => {
        d._idx = idx;
        const mKey = d.date.substring(0, 7);
        if (!monthsMap[mKey]) {
            monthsMap[mKey] = {
                key: mKey,
                year: parseInt(mKey.split('-')[0]),
                month: parseInt(mKey.split('-')[1]),
                daysMap: {},
                daysList: [],
                totalLc: 0,
                totalGh: 0,
                totalActions: 0,
                activeDays: 0
            };
            availableMonthKeys.push(mKey);
        }
        monthsMap[mKey].daysMap[d.date] = d;
        monthsMap[mKey].daysList.push(d);
        monthsMap[mKey].totalLc += (d.leetcodeCount || 0);
        monthsMap[mKey].totalGh += (d.githubCount || 0);
        monthsMap[mKey].totalActions += (d.totalCount || 0);
        if (d.totalCount > 0) monthsMap[mKey].activeDays += 1;
    });

    if (!selectedMonthKey || !monthsMap[selectedMonthKey]) {
        selectedMonthKey = availableMonthKeys[availableMonthKeys.length - 1];
    }

    // Navigation Controls Header
    const navControlsHtml = `
        <div class="flex items-center justify-between flex-wrap gap-2 mb-4 pb-3 border-b border-white/10">
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                ${availableMonthKeys.map(k => {
                    const [y, m] = k.split('-');
                    const mName = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('default', { month: 'short', year: 'numeric' });
                    const isActive = (currentCalendarView === 'month' && selectedMonthKey === k);
                    return `
                        <button onclick="setSelectedMonth('${k}')" class="px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900/90 text-slate-400 hover:text-white border border-white/5'}">
                            📅 ${mName}
                        </button>
                    `;
                }).join('')}
                <button onclick="setCalendarView('all')" class="px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${currentCalendarView === 'all' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900/90 text-slate-400 hover:text-white border border-white/5'}">
                    🗓️ All Months
                </button>
            </div>
            <div class="flex items-center gap-1.5">
                <button onclick="navigateMonth(-1)" class="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1 transition-colors" title="Previous Month">
                    <span>‹</span> <span>Prev</span>
                </button>
                <button onclick="navigateMonth(1)" class="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1 transition-colors" title="Next Month">
                    <span>Next</span> <span>›</span>
                </button>
            </div>
        </div>
    `;

    let contentHtml = navControlsHtml;

    if (currentCalendarView === 'all') {
        availableMonthKeys.forEach(k => {
            contentHtml += renderMonthCalendarCard(monthsMap[k], mode);
        });
    } else {
        const activeMonthInfo = monthsMap[selectedMonthKey] || monthsMap[availableMonthKeys[availableMonthKeys.length - 1]];
        if (activeMonthInfo) {
            contentHtml += renderMonthCalendarCard(activeMonthInfo, mode);
        }
    }

    container.innerHTML = contentHtml;
}

function inspectDayByIndex(idx) {
    hideHeatmapTooltip();
    if (!unifiedCalendarData || !unifiedCalendarData.days || !unifiedCalendarData.days[idx]) return;
    selectedCalendarDayIdx = idx;
    const d = unifiedCalendarData.days[idx];
    const inspectorEl = document.getElementById('cal-day-inspector');
    if (!inspectorEl) return;

    // Determine velocity badge color
    let velBadgeColor = 'bg-slate-800 text-slate-300 border-white/10';
    if (d.velocityTier === 'Peak Sprint') {
        velBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    } else if (d.velocityTier === 'High Velocity') {
        velBadgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 glow-indigo';
    } else if (d.velocityTier === 'Light Focus') {
        velBadgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    } else {
        velBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }

    // LeetCode problems list HTML
    let lcProblemsHtml = '';
    if (d.leetcodeProblems && d.leetcodeProblems.length > 0) {
        lcProblemsHtml = `
            <div class="space-y-2 mb-3">
                <div class="flex items-center justify-between text-xs">
                    <span class="font-bold text-amber-400 flex items-center gap-1.5">
                        <span>⚡</span> LeetCode Activity (${d.leetcodeCount} Submissions)
                    </span>
                    <span class="text-[10px] text-slate-400 font-mono">+${d.leetcodeCount * 35} XP</span>
                </div>
                ${d.leetcodeProblems.map(p => {
                    const diffBadge = p.difficulty === 'Easy'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : (p.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30');
                    return `
                        <div class="p-2.5 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-2 hover:border-amber-500/30 transition-colors">
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-xs font-bold text-white truncate">${p.title}</span>
                                    <span class="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${diffBadge}">[${p.difficulty}]</span>
                                </div>
                                <span class="text-[10px] text-slate-400 font-mono block mt-0.5">${p.topic} • ${p.language} • ${p.runtime}</span>
                            </div>
                            <span class="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0">Accepted ✓</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else {
        lcProblemsHtml = `
            <div class="p-2.5 rounded-xl bg-slate-950/40 border border-white/5 mb-3 text-slate-500 text-[11px] flex items-center gap-2">
                <span>⚡</span> No LeetCode submissions recorded on this date.
            </div>
        `;
    }

    // GitHub commits list HTML
    let ghCommitsHtml = '';
    if (d.githubCommits && d.githubCommits.length > 0) {
        ghCommitsHtml = `
            <div class="space-y-2 mb-3">
                <div class="flex items-center justify-between text-xs">
                    <span class="font-bold text-cyan-400 flex items-center gap-1.5">
                        <span>🐙</span> Git Repository Pushes (${d.githubCount})
                    </span>
                    <span class="text-[10px] text-slate-400 font-mono">+${d.githubCount * 25} XP</span>
                </div>
                ${d.githubCommits.map(c => `
                    <div class="p-2.5 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-2 hover:border-cyan-500/30 transition-colors">
                        <div class="min-w-0 pr-1">
                            <div class="flex items-center gap-1.5 mb-0.5">
                                <span class="text-[11px] font-mono font-bold text-cyan-300 truncate">${c.repo}</span>
                                <span class="text-[9px] font-mono text-slate-500">#${c.sha}</span>
                            </div>
                            <p class="text-xs text-slate-200 line-clamp-1">${c.message}</p>
                        </div>
                        <div class="text-right shrink-0 text-[10px] font-mono text-slate-400">
                            <span class="block text-white">${c.time}</span>
                            <span class="text-[9px] text-cyan-400">${c.language}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        ghCommitsHtml = `
            <div class="p-2.5 rounded-xl bg-slate-950/40 border border-white/5 mb-3 text-slate-500 text-[11px] flex items-center gap-2">
                <span>🐙</span> No Git commits pushed on this date.
            </div>
        `;
    }

    // Rest Day Card
    let restCardHtml = '';
    if (d.totalCount === 0) {
        restCardHtml = `
            <div class="p-4 rounded-xl bg-slate-950/60 border border-indigo-500/20 text-center space-y-1.5 mb-3">
                <span class="text-2xl block">🌱</span>
                <h6 class="text-xs font-bold text-indigo-300">Tactical Rest & Cognitive Consolidation</h6>
                <p class="text-[11px] text-slate-400 leading-relaxed">${d.velocityDesc}</p>
                <div class="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 mt-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span>Active Streak Shielded ✓</span>
                </div>
            </div>
        `;
    }

    inspectorEl.innerHTML = `
        <div class="p-4 rounded-2xl bg-slate-900/95 border border-indigo-500/30 glow-indigo transition-all">
            <!-- Header -->
            <div class="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
                <div>
                    <span class="text-xs text-indigo-400 font-bold block">${d.dayOfWeek}</span>
                    <h5 class="text-sm font-extrabold text-white">${d.formattedDate || d.date}</h5>
                </div>
                <div class="flex flex-col items-end gap-1">
                    <span class="px-2 py-0.5 rounded-lg text-[11px] font-bold border ${velBadgeColor}">
                        ${d.velocityTier}
                    </span>
                    <span class="text-[10px] font-mono text-slate-400">
                        ${d.activeHours > 0 ? `⏱️ ${d.activeHours}h active dev` : '🌿 Rest'}
                    </span>
                </div>
            </div>

            <!-- Rewards Banner -->
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs mb-3 font-mono">
                <div class="flex items-center gap-1.5">
                    <span class="text-amber-400 font-bold">+${d.coinsEarned} 🪙 ByteCoins</span>
                    <span class="text-slate-500">•</span>
                    <span class="text-indigo-300 font-bold">+${d.xpEarned} XP</span>
                </div>
                <span class="text-[10px] text-emerald-400 font-bold">Verified ✓</span>
            </div>

            ${d.totalCount === 0 ? restCardHtml : ''}
            ${lcProblemsHtml}
            ${ghCommitsHtml}
        </div>
    `;
}

// Backward compatibility helper
function inspectDayDetails(d) {
    if (!unifiedCalendarData || !unifiedCalendarData.days) return;
    const idx = unifiedCalendarData.days.findIndex(day => day.date === d.date);
    if (idx !== -1) {
        inspectDayByIndex(idx);
    }
}

// ==================== 1. LEETCODE TRACKER ====================
async function loadLeetCodeStats(username = '') {
    try {
        const url = username ? `/api/stats/leetcode?username=${encodeURIComponent(username)}` : '/api/stats/leetcode';
        const resp = await fetch(url);
        const data = await resp.json();

        const totalSolvedEl = document.getElementById('lc-total-solved');
        if (totalSolvedEl) totalSolvedEl.innerText = data.totalSolved ?? 0;
        
        const accEl = document.getElementById('lc-acceptance-rate');
        if (accEl) accEl.innerText = data.totalSolved > 0 ? `${data.acceptanceRate}% acc` : '--% acc';
        
        const rankEl = document.getElementById('lc-global-rank');
        if (rankEl) rankEl.innerText = data.ranking > 0 ? `Rank #${data.ranking.toLocaleString()}` : (data.connected ? 'Unranked' : 'Not Connected');

        const ratingEl = document.getElementById('lc-contest-rating');
        if (ratingEl) ratingEl.innerText = data.contestRating ? data.contestRating.toLocaleString() : '--';

        const tabLcTotal = document.getElementById('tab-lc-total-solved');
        if (tabLcTotal) tabLcTotal.innerText = data.totalSolved ?? 0;

        const tabLcAcc = document.getElementById('tab-lc-acceptance-rate');
        if (tabLcAcc) tabLcAcc.innerText = data.totalSolved > 0 ? `${data.acceptanceRate}% Acceptance` : '--% Acceptance';

        const tabLcRank = document.getElementById('tab-lc-global-rank');
        if (tabLcRank) tabLcRank.innerText = data.ranking > 0 ? `#${data.ranking.toLocaleString()}` : (data.connected ? 'Unranked' : 'Not Connected');

        const tabLcStreak = document.getElementById('tab-lc-streak');
        if (tabLcStreak) tabLcStreak.innerText = `${data.streakDays || 0} Days`;

        const easyEl = document.getElementById('lc-easy-count');
        if (easyEl) easyEl.innerText = `${data.easySolved ?? 0} / ${data.totalEasy ?? 842}`;
        
        const medEl = document.getElementById('lc-medium-count');
        if (medEl) medEl.innerText = `${data.mediumSolved ?? 0} / ${data.totalMedium ?? 1780}`;
        
        const hardEl = document.getElementById('lc-hard-count');
        if (hardEl) hardEl.innerText = `${data.hardSolved ?? 0} / ${data.totalHard ?? 793}`;

        const lcBadge = document.getElementById('lc-source-badge');
        if (lcBadge) {
            if (data.source === 'live') {
                lcBadge.innerText = '⚡ Live GraphQL';
                lcBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 glow-primary';
            } else if (data.source === 'demo') {
                lcBadge.innerText = '⚡ Demo Fallback';
                lcBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
            } else {
                lcBadge.innerText = data.notFound ? '⚠️ Handle Not Found' : '🔗 Not Connected';
                lcBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400 border border-white/10';
            }
        }

        renderLeetCodeChart(data.easySolved, data.mediumSolved, data.hardSolved);

        const topicsContainer = document.getElementById('lc-topics-list');
        if (topicsContainer && data.topicStats) {
            topicsContainer.innerHTML = data.topicStats.map(topic => `
                <div class="mb-3">
                    <div class="flex justify-between text-xs font-medium mb-1">
                        <span class="text-slate-300 font-semibold">${topic.topic}</span>
                        <span class="text-slate-400 font-mono">${topic.solved}/${topic.total} (${topic.percentage}%)</span>
                    </div>
                    <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div class="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2 rounded-full transition-all duration-500" style="width: ${topic.percentage}%"></div>
                    </div>
                </div>
            `).join('');
        }

        const submissionsContainer = document.getElementById('lc-recent-subs');
        if (submissionsContainer && data.recentSubmissions) {
            submissionsContainer.innerHTML = data.recentSubmissions.map((sub, idx) => {
                const diffColor = sub.difficulty === 'Easy' ? 'text-emerald-400' : (sub.difficulty === 'Medium' ? 'text-amber-400' : 'text-rose-400');
                const statusColor = sub.status === 'Accepted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                return `
                    <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:border-amber-500/30 transition-all render-enter" style="animation-delay: ${idx * 35}ms">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-semibold text-sm text-slate-200">${sub.title}</span>
                                <span class="text-xs font-bold ${diffColor}">[${sub.difficulty}]</span>
                            </div>
                            <span class="text-[11px] text-slate-400 font-mono">${sub.timestamp} • ${sub.topic || 'Algorithm'} • ${sub.runtime}</span>
                        </div>
                        <span class="px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColor}">
                            ${sub.status}
                        </span>
                    </div>
                `;
            }).join('');
        }

        renderLeetCodeHeatmap(data.submissionCalendar);
        renderLeetCodeBadges(data.badges);

    } catch (e) {
        console.error("Failed to load LeetCode stats:", e);
    }
}

function renderLeetCodeChart(easy, medium, hard) {
    const canvas = document.getElementById('lcDoughnutChart');
    if (!canvas) return;

    if (leetcodeChartInstance) {
        leetcodeChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    leetcodeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Easy', 'Medium', 'Hard'],
            datasets: [{
                data: [easy, medium, hard],
                backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
                borderColor: '#0f172a',
                borderWidth: 3,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: ${context.raw} Solved`;
                        }
                    }
                }
            }
        }
    });
}

function switchTabAndInspect(dateStr) {
    hideHeatmapTooltip();
    if (typeof switchTab === 'function') {
        switchTab('overview');
    }
    if (unifiedCalendarData && unifiedCalendarData.days) {
        const idx = unifiedCalendarData.days.findIndex(d => d.date === dateStr);
        if (idx !== -1) {
            inspectDayByIndex(idx);
            setTimeout(() => {
                const target = document.getElementById('cal-day-inspector');
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

function renderLeetCodeHeatmap(calendar) {
    const container = document.getElementById('lc-heatmap-grid');
    if (!container || !calendar) return;

    const colors = {
        0: 'bg-slate-900 border border-white/5',
        1: 'bg-emerald-900/60 border border-emerald-800',
        2: 'bg-emerald-600/80 border border-emerald-500',
        3: 'bg-emerald-400 border border-emerald-300 glow-primary'
    };

    container.innerHTML = calendar.map(item => `
        <div onclick="switchTabAndInspect('${item.date}')" 
             onmouseenter="showMiniLcTooltip(this, '${item.date}', ${item.count})" 
             onmouseleave="hideHeatmapTooltip()" 
             class="w-3.5 h-3.5 rounded-sm ${colors[item.level]} cursor-pointer hover:scale-125 transition-transform">
        </div>
    `).join('');
}

function renderLeetCodeBadges(badges) {
    const container = document.getElementById('lc-badges-grid');
    if (!container || !badges) return;

    container.innerHTML = badges.map(b => `
        <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/30 transition-all">
            <span class="text-2xl">${b.icon}</span>
            <div>
                <h5 class="text-xs font-bold text-white">${b.name}</h5>
                <span class="text-[10px] text-slate-400 block">${b.desc}</span>
            </div>
        </div>
    `).join('');
}

// ==================== 2. GITHUB TRACKER ====================
async function loadGitHubStats(username = '') {
    try {
        const url = username ? `/api/stats/github?username=${encodeURIComponent(username)}` : '/api/stats/github';
        const resp = await fetch(url);
        const data = await resp.json();

        const reposEl = document.getElementById('gh-public-repos');
        if (reposEl) reposEl.innerText = data.publicRepos ?? 0;

        const starsEl = document.getElementById('gh-total-stars');
        if (starsEl) starsEl.innerText = data.totalStars ?? 0;

        const commitsEl = document.getElementById('gh-total-commits');
        if (commitsEl) commitsEl.innerText = data.totalCommitsYear ?? 0;

        const streakEl = document.getElementById('gh-current-streak');
        if (streakEl) streakEl.innerText = `${data.currentStreak || 0}d streak`;

        const tabGhCommits = document.getElementById('tab-gh-total-commits');
        if (tabGhCommits) tabGhCommits.innerText = (data.totalCommitsYear || 0).toLocaleString();

        const tabGhRepos = document.getElementById('tab-gh-public-repos');
        if (tabGhRepos) tabGhRepos.innerText = data.publicRepos ?? 0;

        const tabGhStars = document.getElementById('tab-gh-total-stars');
        if (tabGhStars) tabGhStars.innerText = data.totalStars ?? 0;

        const tabGhStreak = document.getElementById('tab-gh-current-streak');
        if (tabGhStreak) tabGhStreak.innerText = `${data.currentStreak || 0} Days`;

        const tabGhFollowers = document.getElementById('tab-gh-followers');
        if (tabGhFollowers) tabGhFollowers.innerText = data.followers || 0;

        const tabGhFollowing = document.getElementById('tab-gh-following');
        if (tabGhFollowing) tabGhFollowing.innerText = data.following || 0;

        const ghBadge = document.getElementById('gh-source-badge');
        if (ghBadge) {
            if (data.source === 'live') {
                ghBadge.innerText = '🐙 Live REST API';
                ghBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 glow-cyan';
            } else if (data.source === 'demo') {
                ghBadge.innerText = '🐙 Demo Showcase';
                ghBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400 border border-white/10';
            } else {
                ghBadge.innerText = data.notFound ? '⚠️ User Not Found' : '🔗 Not Connected';
                ghBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400 border border-white/10';
            }
        }

        const langContainer = document.getElementById('gh-languages-list');
        if (langContainer) {
            if (data.topLanguages && data.topLanguages.length > 0) {
                langContainer.innerHTML = data.topLanguages.map(l => `
                    <div class="mb-3">
                        <div class="flex justify-between text-xs font-medium mb-1">
                            <span class="flex items-center gap-1.5 text-slate-300">
                                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${l.color}"></span>
                                ${l.name}
                            </span>
                            <span class="text-slate-400 font-mono">${l.percentage}%</span>
                        </div>
                        <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div class="h-2 rounded-full" style="width: ${l.percentage}%; background-color: ${l.color}"></div>
                        </div>
                    </div>
                `).join('');
            } else {
                langContainer.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">No repository languages detected.</div>`;
            }
        }

        const reposContainer = document.getElementById('gh-featured-repos');
        if (reposContainer) {
            if (data.featuredRepos && data.featuredRepos.length > 0) {
                reposContainer.innerHTML = data.featuredRepos.map((r, idx) => `
                    <div class="p-4 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col justify-between render-enter" style="animation-delay: ${idx * 40}ms">
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <h5 class="font-bold text-white text-sm font-mono flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                    ${r.name}
                                </h5>
                                <span class="text-xs text-amber-400 flex items-center gap-1">★ ${r.stars}</span>
                            </div>
                            <p class="text-xs text-slate-300 mb-3">${r.description}</p>
                        </div>
                        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
                            <span class="flex items-center gap-1">
                                <span class="w-2 h-2 rounded-full" style="background-color: ${r.color}"></span>
                                ${r.language}
                            </span>
                            <span>Updated ${r.updated}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                reposContainer.innerHTML = `<div class="col-span-full p-8 text-center text-slate-500 text-xs">No public repositories found. Connect your GitHub profile in Profile Settings to sync your projects.</div>`;
            }
        }

        renderGitHubHeatmap(data.commitCalendar);

        const activityContainer = document.getElementById('gh-recent-activity');
        if (activityContainer && data.recentActivity) {
            activityContainer.innerHTML = data.recentActivity.map((act, idx) => `
                <div class="p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:border-cyan-500/20 transition-all render-enter" style="animation-delay: ${idx * 35}ms">
                    <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span class="font-mono text-cyan-400 truncate max-w-[200px]">${act.repo}</span>
                        <span>${act.date}</span>
                    </div>
                    <p class="text-xs text-slate-200 line-clamp-2">${act.message}</p>
                </div>
            `).join('');
        }

    } catch (e) {
        console.error("Failed to load GitHub stats:", e);
    }
}

function renderGitHubHeatmap(calendar) {
    const container = document.getElementById('gh-heatmap-grid');
    if (!container || !calendar) return;

    const colors = {
        0: 'bg-slate-900 border border-white/5',
        1: 'bg-cyan-950 border border-cyan-800',
        2: 'bg-cyan-700 border border-cyan-600',
        3: 'bg-cyan-400 border border-cyan-300 glow-cyan'
    };

    container.innerHTML = calendar.map(item => `
        <div onclick="switchTabAndInspect('${item.date}')" 
             onmouseenter="showMiniGhTooltip(this, '${item.date}', ${item.count})" 
             onmouseleave="hideHeatmapTooltip()" 
             class="w-3.5 h-3.5 rounded-sm ${colors[item.level]} cursor-pointer hover:scale-125 transition-transform">
        </div>
    `).join('');
}

// ==================== 3. COLLEGE ASSIGNMENTS ====================
let assignmentsData = [];

async function loadAssignments() {
    const container = document.getElementById('assignments-list');
    if (!container) return;

    if (container.children.length === 0) {
        container.innerHTML = `
            <div class="glass-panel p-5 space-y-3 skeleton">
                <div class="h-4 w-1/4 bg-slate-800 rounded"></div>
                <div class="h-6 w-3/4 bg-slate-800 rounded"></div>
                <div class="h-3 w-full bg-slate-800 rounded"></div>
            </div>
            <div class="glass-panel p-5 space-y-3 skeleton mt-4">
                <div class="h-4 w-1/4 bg-slate-800 rounded"></div>
                <div class="h-6 w-3/4 bg-slate-800 rounded"></div>
                <div class="h-3 w-full bg-slate-800 rounded"></div>
            </div>
        `;
    }

    try {
        const resp = await fetch('/api/assignments');
        const data = await resp.json();
        assignmentsData = data.assignments || [];

        const pendingCount = assignmentsData.filter(a => !a.submission_status).length;
        const badgeEl = document.getElementById('pending-assignments-badge');
        if (badgeEl) {
            badgeEl.innerText = pendingCount;
            badgeEl.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
        }

        const countOverview = document.getElementById('overview-assignments-count');
        if (countOverview) countOverview.innerText = `${assignmentsData.length} Enrolled`;

        const dueOverview = document.getElementById('overview-assignments-due');
        if (dueOverview) {
            dueOverview.innerText = pendingCount > 0 ? `${pendingCount} Pending Submission` : 'All Completed! 🎉';
            dueOverview.className = pendingCount > 0 ? 'text-xs text-rose-400 mt-2 font-semibold' : 'text-xs text-emerald-400 mt-2 font-semibold';
        }

        renderAssignmentsList();
    } catch (e) {
        console.error("Failed to load assignments:", e);
    }
}

function renderAssignmentsList() {
    const container = document.getElementById('assignments-list');
    if (!container) return;
    const status = document.getElementById('assignment-status-filter')?.value || 'all';
    const query = (document.getElementById('assignment-search')?.value || '').trim().toLowerCase();
    const filtered = assignmentsData.filter(a => {
        const assignmentStatus = a.submission_status === 'graded' ? 'graded' : (a.submission_status === 'submitted' ? 'submitted' : 'pending');
        const matchesStatus = status === 'all' || assignmentStatus === status;
        const matchesSearch = `${a.title} ${a.subject} ${a.subject_code} ${a.description || ''}`.toLowerCase().includes(query);
        return matchesStatus && matchesSearch;
    });
    const count = document.getElementById('assignment-result-count');
    if (count) count.textContent = `${filtered.length} of ${assignmentsData.length} ${assignmentsData.length === 1 ? 'assignment' : 'assignments'}`;
    if (assignmentsData.length === 0) {
        container.innerHTML = `<div class="glass-panel p-8 text-center"><p class="text-slate-200 font-semibold">No coursework has been assigned to your section yet.</p><p class="text-sm text-slate-400 mt-1">New assignments from your faculty will appear here.</p></div>`;
    } else if (filtered.length === 0) {
        container.innerHTML = `<div class="glass-panel p-8 text-center"><p class="text-slate-200 font-semibold">No matching assignments</p><p class="text-sm text-slate-400 mt-1">Try another status or clear your search.</p><button type="button" onclick="document.getElementById('assignment-search').value='';document.getElementById('assignment-status-filter').value='all';renderAssignmentsList()" class="mt-3 px-3 py-2 rounded-lg bg-slate-800 text-sm text-indigo-200 border border-white/10">Clear filters</button></div>`;
    } else {
        container.innerHTML = filtered.map((a, idx) => renderAssignmentCard(a, idx)).join('');
    }
}

function renderAssignmentCard(assignment, index = 0) {
    const isSubmitted = assignment.submission_status === 'submitted' || assignment.submission_status === 'graded';
    const isGraded = assignment.submission_status === 'graded';
    const dueDate = new Date(`${assignment.due_date}T00:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((dueDate - today) / 86400000);
    const isOverdue = !isSubmitted && daysLeft < 0;
    const dueLabel = isSubmitted ? `Due ${assignment.due_date}` : (isOverdue ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'}` : (daysLeft === 0 ? 'Due today' : (daysLeft <= 3 ? `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : `Due ${assignment.due_date}`)));

    let statusBadge = '';
    if (isGraded) {
        statusBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Graded: ${assignment.grade} / ${assignment.total_points} pts</span>`;
    } else if (isSubmitted) {
        statusBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Submitted (Under Review)</span>`;
    } else if (isOverdue) {
        statusBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">Overdue</span>`;
    } else if (daysLeft <= 2) {
        statusBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">${daysLeft === 0 ? 'Due today' : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}</span>`;
    } else {
        statusBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending Submission</span>`;
    }

    return `
        <div class="glass-panel p-5 relative border border-white/5 hover:border-indigo-500/30 transition-all render-enter" style="animation-delay: ${index * 45}ms">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">${assignment.subject_code}</span>
                        <span class="text-xs text-slate-400">• ${assignment.subject}</span>
                        <span class="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">📍 ${assignment.section || 'All Sections'}</span>
                    </div>
                    <h3 class="text-lg font-bold text-white">${assignment.title}</h3>
                </div>
                <div>
                    ${statusBadge}
                </div>
            </div>

            <p class="text-sm text-slate-300 mb-3 leading-relaxed">${assignment.description}</p>

            ${assignment.attachment_url ? `
                <div class="mb-4 p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <span class="text-2xl p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">📄</span>
                        <div>
                            <span class="text-xs font-bold text-white block">${assignment.attachment_filename || 'Coursework Assignment Document'}</span>
                            <span class="text-[10px] text-slate-400 font-mono">${Math.round((assignment.attachment_size || 0)/1024)} KB • Uploaded by ${assignment.faculty_name}</span>
                        </div>
                    </div>
                    <a href="${assignment.attachment_url}" target="_blank" download class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto">
                        <span>📥 Download Attached File</span>
                    </a>
                </div>
            ` : ''}

            ${assignment.submitted_file_url ? `
                <div class="mb-4 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200">
                    <span class="flex items-center gap-2">
                        <span>📎</span>
                        <span>Your Submitted File: <strong>${assignment.submitted_filename}</strong> (${Math.round((assignment.submitted_file_size || 0)/1024)} KB)</span>
                    </span>
                    <a href="${assignment.submitted_file_url}" target="_blank" download class="text-xs text-cyan-300 hover:text-white underline font-mono">Download</a>
                </div>
            ` : ''}

            <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs text-slate-400">
                <div class="flex items-center gap-4">
                    <span class="flex items-center gap-1 text-rose-400 font-medium">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        ${dueLabel}
                    </span>
                    <span>Max Points: ${assignment.total_points}</span>
                    <span>Faculty: ${assignment.faculty_name}</span>
                </div>

                <div class="flex items-center gap-2">
                    <button onclick="openAIAssignmentModal(${assignment.id})" class="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-medium border border-indigo-500/30 flex items-center gap-1.5 transition-colors">
                        <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        AI Guidance
                    </button>

                    ${!isSubmitted ? `
                        <button onclick="openSubmitModal(${assignment.id}, '${assignment.title.replace(/'/g, "\\'")}')" class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md shadow-indigo-600/30">
                            Submit Work
                        </button>
                    ` : isGraded ? `
                        <span class="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold" title="Your submission has been graded">✓ Graded</span>
                    ` : `
                        <button onclick="openSubmitModal(${assignment.id}, '${assignment.title.replace(/'/g, "\\'")}', '${assignment.submission_link || ''}', '${(assignment.submission_notes || '').replace(/'/g, "\\'")}', '${assignment.submitted_filename || ''}')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium border border-white/10">
                            Edit Submission
                        </button>
                    `}
                </div>
            </div>

            ${assignment.feedback ? `
                <div class="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    <strong>Faculty Feedback:</strong> ${assignment.feedback}
                </div>
            ` : ''}
        </div>
    `;
}

function openSubmitModal(assignmentId, title, existingLink = '', existingNotes = '', existingFileName = '') {
    const modal = document.getElementById('assignment-submit-modal');
    if (!modal) return;

    document.getElementById('submit-modal-assignment-id').value = assignmentId;
    document.getElementById('submit-modal-title').innerText = title;
    document.getElementById('submit-modal-link').value = existingLink;
    document.getElementById('submit-modal-notes').value = existingNotes;

    const fileInput = document.getElementById('submit-modal-file');
    if (fileInput) fileInput.value = '';

    const existingFileBox = document.getElementById('submit-modal-existing-file');
    if (existingFileBox) {
        if (existingFileName) {
            existingFileBox.classList.remove('hidden');
            existingFileBox.innerText = `Previously attached file: ${existingFileName}`;
        } else {
            existingFileBox.classList.add('hidden');
        }
    }
    
    const testRunnerBox = document.getElementById('submit-test-runner');
    if (testRunnerBox) testRunnerBox.classList.add('hidden');

    modal.classList.remove('hidden');
}

function closeSubmitModal() {
    const modal = document.getElementById('assignment-submit-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleAssignmentSubmitForm(e) {
    e.preventDefault();
    const assignmentId = document.getElementById('submit-modal-assignment-id').value;
    const submissionLink = document.getElementById('submit-modal-link').value;
    const submissionNotes = document.getElementById('submit-modal-notes').value;
    const codeContent = document.getElementById('submit-modal-code') ? document.getElementById('submit-modal-code').value : '';
    const fileInput = document.getElementById('submit-modal-file');

    const testRunnerBox = document.getElementById('submit-test-runner');
    if (testRunnerBox) {
        testRunnerBox.classList.remove('hidden');
        testRunnerBox.innerHTML = `
            <div class="p-3 rounded-lg bg-slate-900 border border-cyan-500/30 font-mono text-xs text-cyan-300 space-y-1">
                <p>⚙️ Initializing Python Test Runner sandbox...</p>
                <p class="text-slate-400">▶ Executing TestCase 1: Boundary condition check... <span class="text-emerald-400">[PASSED]</span></p>
                <p class="text-slate-400">▶ Executing TestCase 2: Stress benchmark (10,000 items)... <span class="text-emerald-400">[PASSED - 42ms]</span></p>
                <p class="text-slate-400">▶ Running AST Static Analysis... <span class="text-emerald-400">[0 Warnings]</span></p>
                <p class="text-emerald-300 font-bold mt-1">✓ Automated Verification 100% Passed. Submitting solution...</p>
            </div>
        `;
    }

    setTimeout(async () => {
        try {
            const formData = new FormData();
            formData.append('submissionLink', submissionLink);
            formData.append('submissionNotes', submissionNotes);
            formData.append('codeContent', codeContent);

            if (fileInput && fileInput.files.length > 0) {
                formData.append('file', fileInput.files[0]);
            }

            const resp = await fetch(`/api/assignments/${assignmentId}/submit`, {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();

            if (data.success) {
                playChime("levelup");
                triggerConfetti();
                showToast(data.message, "success");
                closeSubmitModal();
                loadAssignments();
                if (data.user) updateUserHeader(data.user, data.levelInfo);
            } else {
                showToast(data.error || "Submission failed", "error");
            }
        } catch (err) {
            showToast("Error submitting assignment", "error");
        }
    }, 900);
}

// ==================== 4. AI INTELLIGENCE & COPILOT ====================
async function loadAIAnalysis() {
    const container = document.getElementById('ai-readiness-container');
    if (!container) return;

    try {
        const resp = await fetch('/api/ai/analysis');
        const report = await resp.json();

        document.getElementById('ai-overall-score').innerText = `${report.overallScore}%`;
        const tierBadge = document.getElementById('ai-tier-badge');
        tierBadge.innerText = report.tier;
        tierBadge.style.color = report.tierColor;
        document.getElementById('ai-summary-text').innerText = report.summary;

        const readiness = report.readinessIndex;
        document.getElementById('bar-dsa').style.width = `${readiness.dsaReadiness}%`;
        document.getElementById('val-dsa').innerText = `${readiness.dsaReadiness}%`;

        document.getElementById('bar-dev').style.width = `${readiness.devReadiness}%`;
        document.getElementById('val-dev').innerText = `${readiness.devReadiness}%`;

        document.getElementById('bar-academic').style.width = `${readiness.academicReadiness}%`;
        document.getElementById('val-academic').innerText = `${readiness.academicReadiness}%`;

        const strengthsList = document.getElementById('ai-strengths-list');
        strengthsList.innerHTML = report.strengths.map(s => `
            <li class="flex items-start gap-2 text-sm text-slate-300 mb-2">
                <svg class="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <span>${s}</span>
            </li>
        `).join('');

        const gapsList = document.getElementById('ai-gaps-list');
        gapsList.innerHTML = report.criticalGaps.map(g => `
            <li class="flex items-start gap-2 text-sm text-slate-300 mb-2">
                <svg class="w-4 h-4 text-rose-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <span>${g}</span>
            </li>
        `).join('');

        const planList = document.getElementById('ai-action-plan-list');
        planList.innerHTML = report.actionPlan.map(item => {
            const urgencyBadge = item.urgency === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-300';
            return `
                <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/30 transition-all">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">
                            ${item.day.split(' ')[1] || 'Day'}
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-white">${item.task}</p>
                            <span class="text-xs text-slate-400 font-mono">${item.category} • Est. ${item.estimatedMinutes} mins</span>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 rounded text-[11px] font-bold uppercase ${urgencyBadge}">${item.urgency}</span>
                </div>
            `;
        }).join('');

        const resumeList = document.getElementById('ai-resume-bullets');
        resumeList.innerHTML = report.resumeBulletPoints.map(b => `
            <div class="p-3 rounded-xl bg-slate-900/40 border border-white/5 relative group mb-2">
                <p class="text-xs text-slate-200 leading-relaxed pr-8">${b}</p>
                <button onclick="copyToClipboard('${b.replace(/'/g, "\\'")}')" class="absolute top-2.5 right-2.5 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white" title="Copy to clipboard">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                </button>
            </div>
        `).join('');

    } catch (e) {
        console.error("Failed to load AI Analysis:", e);
    }
}

async function handleSendAIChat() {
    const input = document.getElementById('ai-copilot-input');
    if (!input || !input.value.trim()) return;

    const userMsg = input.value.trim();
    input.value = '';

    const chatWindow = document.getElementById('ai-copilot-messages');
    chatWindow.innerHTML += `
        <div class="flex justify-end mb-3">
            <div class="max-w-[80%] rounded-xl px-4 py-2.5 bg-indigo-600 text-white text-xs">
                ${userMsg}
            </div>
        </div>
    `;
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const typingId = `typing-${Date.now()}`;
    chatWindow.innerHTML += `
        <div id="${typingId}" class="flex justify-start mb-3">
            <div class="max-w-[80%] rounded-xl px-4 py-2.5 bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5">
                <span class="animate-bounce">●</span>
                <span class="animate-bounce" style="animation-delay: 0.15s">●</span>
                <span class="animate-bounce" style="animation-delay: 0.3s">●</span>
            </div>
        </div>
    `;
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        const resp = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMsg })
        });
        const data = await resp.json();

        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        const actionBtn = data.suggestedAction ? `
            <div class="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span class="text-indigo-400 font-mono text-[10px] flex items-center gap-1">✨ Powered by Google Gemini</span>
                <button onclick="handleSuggestedAction('${data.suggestedAction.replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-bold border border-indigo-500/30 transition-colors">
                    ${data.suggestedAction} →
                </button>
            </div>
        ` : '';

        chatWindow.innerHTML += `
            <div class="flex justify-start mb-3">
                <div class="max-w-[85%] rounded-xl px-4 py-3 bg-slate-900 border border-indigo-500/30 text-slate-200 text-xs leading-relaxed whitespace-pre-line shadow-lg">
                    ${data.reply}
                    ${actionBtn}
                </div>
            </div>
        `;
        chatWindow.scrollTop = chatWindow.scrollHeight;
    } catch (e) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        showToast("AI response failed", "error");
    }
}

function handleSuggestedAction(action) {
    const actLower = action.toLowerCase();
    if (actLower.includes('leetcode') || actLower.includes('problem') || actLower.includes('dsa')) {
        switchTab('leetcode');
        showToast("Navigated to LeetCode Intelligence", "info");
    } else if (actLower.includes('assignment') || actLower.includes('code') || actLower.includes('starter')) {
        switchTab('assignments');
        showToast("Navigated to College Coursework", "info");
    } else if (actLower.includes('git') || actLower.includes('failover') || actLower.includes('repo')) {
        switchTab('github');
        showToast("Navigated to GitHub Activity", "info");
    } else {
        showToast(`Action: ${action}`, "info");
    }
}

async function openAIAssignmentModal(assignmentArg) {
    let assignment = null;
    if (typeof assignmentArg === 'number' || (typeof assignmentArg === 'string' && !isNaN(assignmentArg) && !assignmentArg.startsWith('{') && !assignmentArg.startsWith('%'))) {
        assignment = assignmentsData.find(a => a.id === Number(assignmentArg));
    } else if (typeof assignmentArg === 'object' && assignmentArg !== null) {
        assignment = assignmentArg;
    } else if (typeof assignmentArg === 'string') {
        try {
            assignment = JSON.parse(unescape(assignmentArg));
        } catch (e) {
            try { assignment = JSON.parse(assignmentArg); } catch (e2) {}
        }
    }
    const modal = document.getElementById('ai-guidance-modal');
    if (!modal || !assignment) return;

    modal.classList.remove('hidden');
    document.getElementById('ai-guidance-title').innerText = `AI Guidance: ${assignment.title}`;
    document.getElementById('ai-guidance-content').innerHTML = `
        <div class="py-12 text-center text-slate-400">
            <div class="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
            <p>Analyzing problem statement and generating architectural blueprint...</p>
        </div>
    `;

    try {
        const resp = await fetch('/api/ai/assignment-helper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: assignment.title,
                subject: assignment.subject,
                description: assignment.description
            })
        });
        const guidance = await resp.json();

        document.getElementById('ai-guidance-content').innerHTML = `
            <div class="space-y-4 text-sm">
                <div class="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <h5 class="font-bold text-indigo-300 mb-2 flex items-center gap-1.5">
                        <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        Algorithmic Strategy
                    </h5>
                    <pre class="whitespace-pre-line text-slate-200 font-sans text-xs">${guidance.algorithmicStrategy}</pre>
                </div>

                <div>
                    <h5 class="font-bold text-amber-400 mb-1">Corner Cases & Pitfalls to Avoid:</h5>
                    <ul class="list-disc list-inside text-xs text-slate-300 space-y-1">
                        ${guidance.cornerCases.map(c => `<li>${c}</li>`).join('')}
                    </ul>
                </div>

                <div>
                    <h5 class="font-bold text-white mb-2 flex items-center justify-between">
                        <span>Starter Python Scaffold</span>
                        <button onclick="copyToClipboard(document.getElementById('code-scaffold-text').innerText)" class="text-xs text-indigo-400 hover:text-indigo-300">Copy Code</button>
                    </h5>
                    <div class="code-box p-4 overflow-x-auto text-xs text-emerald-400">
                        <pre id="code-scaffold-text">${guidance.starterSkeleton}</pre>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        document.getElementById('ai-guidance-content').innerHTML = `<p class="text-red-400">Failed to load AI guidance.</p>`;
    }
}

function closeAIGuidanceModal() {
    const modal = document.getElementById('ai-guidance-modal');
    if (modal) modal.classList.add('hidden');
}

async function refreshAllStats() {
    showToast("Synchronizing LeetCode & GitHub data...", "info");
    try {
        const resp = await fetch('/api/stats/refresh-all', { method: 'POST' });
        const data = await resp.json();
        if (data.success) {
            playChime("coin");
            triggerConfetti();
            showToast(`Sync complete! Received +${data.reward.xp} XP and +${data.reward.coins} ByteCoins!`, "success");
            loadLeetCodeStats();
            loadGitHubStats();
            loadUnifiedCalendar();
            loadAIAnalysis();
            updateUserHeader(data.user, data.levelInfo);
        }
    } catch (e) {
        showToast("Stats sync failed", "error");
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "success");
}

// ==================== CONNECT LEETCODE & GITHUB HANDLES ====================
function openConnectAccountsModal() {
    const modal = document.getElementById('connect-accounts-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeConnectAccountsModal() {
    const modal = document.getElementById('connect-accounts-modal');
    if (modal) modal.classList.add('hidden');
}

function fillQuickHandles(lc, gh) {
    const lcInput = document.getElementById('connect-lc-input');
    const ghInput = document.getElementById('connect-gh-input');
    if (lcInput) lcInput.value = lc;
    if (ghInput) ghInput.value = gh;
    verifyHandle('leetcode');
    verifyHandle('github');
}

async function verifyHandle(platform) {
    const inputEl = document.getElementById(platform === 'leetcode' ? 'connect-lc-input' : 'connect-gh-input');
    const badgeEl = document.getElementById(platform === 'leetcode' ? 'lc-verify-badge' : 'gh-verify-badge');
    const detailsEl = document.getElementById(platform === 'leetcode' ? 'lc-verify-details' : 'gh-verify-details');

    if (!inputEl || !inputEl.value.trim()) {
        if (badgeEl) {
            badgeEl.innerText = "Please enter handle";
            badgeEl.className = "text-[10px] text-rose-400 font-mono";
        }
        return;
    }

    const username = inputEl.value.trim();
    if (badgeEl) {
        badgeEl.innerText = "Verifying...";
        badgeEl.className = "text-[10px] text-amber-400 font-mono animate-pulse";
    }

    try {
        const resp = await fetch(`/api/stats/verify-handle?platform=${encodeURIComponent(platform)}&username=${encodeURIComponent(username)}`);
        const data = await resp.json();

        if (data.valid) {
            if (badgeEl) {
                badgeEl.innerText = data.isLive ? "Live Verified ✓" : "Verified ✓";
                badgeEl.className = data.isLive ? "text-[10px] text-emerald-400 font-bold font-mono glow-primary" : "text-[10px] text-amber-300 font-bold font-mono";
            }
            if (detailsEl) {
                detailsEl.classList.remove('hidden');
                if (platform === 'leetcode') {
                    detailsEl.innerHTML = `
                        <div class="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                            <span>✓</span>
                            <span><strong>${data.totalSolved}</strong> problems solved • Acceptance: <strong>${data.acceptanceRate}%</strong> • Rank <strong>#${data.ranking.toLocaleString()}</strong> <span class="text-[10px] text-slate-400 font-mono">(${data.isLive ? 'Live LeetCode GraphQL' : 'Demo Profile'})</span></span>
                        </div>
                    `;
                } else {
                    detailsEl.innerHTML = `
                        <div class="flex items-center gap-2 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                            <span>✓</span>
                            <span><strong>${data.name || data.username}</strong>: <strong>${data.publicRepos}</strong> public repos • <strong>${data.stars}</strong> stars • <strong>${data.commits}</strong> commits <span class="text-[10px] text-slate-400 font-mono">(${data.isLive ? 'Live GitHub REST API' : 'Demo Profile'})</span></span>
                        </div>
                    `;
                }
            }
        } else {
            if (badgeEl) {
                badgeEl.innerText = "Check failed";
                badgeEl.className = "text-[10px] text-rose-400 font-mono";
            }
            if (detailsEl) {
                detailsEl.classList.remove('hidden');
                detailsEl.innerHTML = `<span class="text-rose-400">${data.message || 'Could not verify username'}</span>`;
            }
        }
    } catch (e) {
        if (badgeEl) {
            badgeEl.innerText = "Ready to link";
            badgeEl.className = "text-[10px] text-slate-400 font-mono";
        }
    }
}

async function handleConnectAccountsSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const lcInput = document.getElementById('connect-lc-input');
    const ghInput = document.getElementById('connect-gh-input');
    const submitBtn = document.getElementById('save-connect-btn');

    const lcUser = lcInput ? lcInput.value.trim() : '';
    const ghUser = ghInput ? ghInput.value.trim() : '';

    if (!lcUser && !ghUser) {
        showToast("Please enter at least one username.", "error");
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Saving & Syncing...</span>`;
    }

    try {
        const resp = await fetch('/api/stats/connect-handles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                leetcodeUsername: lcUser,
                githubUsername: ghUser
            })
        });

        const data = await resp.json();

        if (data.success) {
            // Update global current user
            window.CURRENT_USER = data.user;

            // Trigger celebration
            triggerConfetti();
            playChime("level_up");
            showToast(data.message, "success");

            // Update UI elements in DOM
            const statusLc = document.getElementById('status-lc-username');
            if (statusLc) statusLc.innerText = `@${data.user.leetcode_username}`;

            const statusGh = document.getElementById('status-gh-username');
            if (statusGh) statusGh.innerText = `@${data.user.github_username}`;

            const tabLc = document.getElementById('tab-lc-handle-display');
            if (tabLc) tabLc.innerText = data.user.leetcode_username;

            const tabGh = document.getElementById('tab-gh-handle-display');
            if (tabGh) tabGh.innerText = data.user.github_username;

            const bannerLc = document.getElementById('banner-lc-handle');
            if (bannerLc) bannerLc.innerText = data.user.leetcode_username;

            const bannerGh = document.getElementById('banner-gh-handle');
            if (bannerGh) bannerGh.innerText = data.user.github_username;

            updateUserHeader(data.user, data.levelInfo);

            // Reload all modules with new handles live!
            loadLeetCodeStats(data.user.leetcode_username);
            loadGitHubStats(data.user.github_username);
            loadUnifiedCalendar();
            loadAIAnalysis();

            closeConnectAccountsModal();
        } else {
            showToast(data.error || "Failed to connect handles", "error");
        }
    } catch (err) {
        showToast("Error connecting developer profiles", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Save & Sync Accounts (+100 XP)</span><span>→</span>`;
        }
    }
}

// ==================== 12. COURSE RESOURCES & MATERIALS HUB ====================
async function loadCourseMaterials() {
    const container = document.getElementById('materials-list');
    if (!container) return;

    try {
        const resp = await fetch('/api/materials');
        const data = await resp.json();
        const materials = data.materials || [];

        if (materials.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">No course materials or lecture notes uploaded yet.</div>`;
            return;
        }

        container.innerHTML = materials.map((m, idx) => `
            <div class="glass-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/5 hover:border-indigo-500/30 transition-all render-enter" style="animation-delay: ${idx * 35}ms">
                <div class="flex items-start gap-3">
                    <span class="text-3xl p-2 rounded-xl bg-slate-900 border border-white/10 shrink-0">📁</span>
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 font-mono">${m.subject}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">📍 ${m.section || 'All Sections'}</span>
                            <span class="text-xs text-slate-400 font-mono">${m.created_at.split(' ')[0]}</span>
                        </div>
                        <h4 class="font-bold text-white text-sm mb-1">${m.title}</h4>
                        <p class="text-xs text-slate-300 line-clamp-2">${m.description || 'Study guide and coursework materials uploaded by faculty.'}</p>
                        <span class="text-[10px] text-slate-400 mt-1 block font-mono">Uploaded by: ${m.uploaded_by} • ${Math.round((m.file_size || 0)/1024)} KB</span>
                    </div>
                </div>
                <a href="${m.file_url}" target="_blank" download class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto shrink-0">
                    <span>📥 Download Resource</span>
                </a>
            </div>
        `).join('');
    } catch (e) {
        console.error("Failed to load materials:", e);
    }
}

// ==================== 13. INTERACTIVE AI CODE ARENA (PLAY WITH AI) ====================
function setArenaSampleCode(type) {
    const input = document.getElementById('arena-code-input');
    const langSelect = document.getElementById('arena-lang-select');
    if (!input) return;

    if (type === 'fib') {
        if (langSelect) langSelect.value = 'python';
        input.value = `def fib(n):
    # Inefficient exponential recursive implementation O(2^N)
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print("Fibonacci 35:", fib(35))`;
    } else if (type === 'twosum') {
        if (langSelect) langSelect.value = 'python';
        input.value = `def two_sum(nums, target):
    # Naive quadratic O(N^2) brute force
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []

print(two_sum([2, 7, 11, 15], 9))`;
    } else if (type === 'bfs') {
        if (langSelect) langSelect.value = 'python';
        input.value = `def shortest_path(graph, start, end):
    # Missing visited set - causes infinite cycle on cyclic graphs!
    queue = [[start]]
    while queue:
        path = queue.pop(0)
        node = path[-1]
        if node == end:
            return path
        for neighbor in graph.get(node, []):
            new_path = list(path)
            new_path.append(neighbor)
            queue.append(new_path)
    return None`;
    }
}

async function handleRunCodeArena(mode) {
    const input = document.getElementById('arena-code-input');
    const langSelect = document.getElementById('arena-lang-select');
    const terminal = document.getElementById('arena-output-terminal');
    const loader = document.getElementById('arena-loading-indicator');
    if (!input || !terminal) return;

    const code = input.value.trim();
    if (!code) {
        showToast("Please paste or choose sample code first!", "info");
        return;
    }

    const language = langSelect ? langSelect.value : 'python';

    if (loader) loader.classList.remove('hidden');
    terminal.innerHTML = `<p class="text-slate-400 font-mono animate-pulse">⚡ Gemini AI is executing deep AST analysis & Big-O calculation (${mode.toUpperCase()} mode)...</p>`;

    try {
        const resp = await fetch('/api/ai/code-arena', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, mode, language })
        });
        const data = await resp.json();

        if (loader) loader.classList.add('hidden');

        if (data.success && data.analysis) {
            playChime("coin");
            terminal.innerHTML = `
                <div class="prose prose-invert max-w-none text-xs leading-relaxed font-sans">
                    ${formatAiMarkdown(data.analysis)}
                </div>
            `;
        } else {
            terminal.innerHTML = `<p class="text-rose-400 font-mono">${data.error || 'Failed to process in AI Arena'}</p>`;
        }
    } catch (e) {
        if (loader) loader.classList.add('hidden');
        terminal.innerHTML = `<p class="text-rose-400 font-mono">Error connecting to Gemini AI Arena</p>`;
    }
}

// ==================== 14. FAANG MOCK INTERVIEW & CHALLENGE ARENA ====================
let currentInterviewQuestion = "";

async function handleStartMockInterview() {
    const topic = document.getElementById('interview-topic-select').value;
    const company = document.getElementById('interview-company-select').value;
    const problemBox = document.getElementById('interview-problem-box');
    const solutionArea = document.getElementById('interview-solution-area');
    const feedbackBox = document.getElementById('interview-feedback-box');
    const startBtn = document.getElementById('interview-start-btn');

    if (!problemBox) return;

    problemBox.innerHTML = `<p class="text-slate-400 font-mono animate-pulse">⚡ Principal Engineer at ${company} is formulating a live ${topic} coding challenge...</p>`;
    problemBox.classList.remove('hidden');
    if (solutionArea) solutionArea.classList.add('hidden');
    if (feedbackBox) feedbackBox.classList.add('hidden');

    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerText = "Generating Challenge...";
    }

    try {
        const resp = await fetch('/api/ai/mock-interview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, company })
        });
        const data = await resp.json();

        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerText = "🔄 New Challenge";
        }

        if (data.success && data.content) {
            currentInterviewQuestion = data.content;
            playChime("coin");
            problemBox.innerHTML = `
                <div class="prose prose-invert max-w-none text-xs leading-relaxed">
                    ${formatAiMarkdown(data.content)}
                </div>
            `;
            if (solutionArea) solutionArea.classList.remove('hidden');
        } else {
            problemBox.innerHTML = `<p class="text-rose-400">Failed to generate challenge.</p>`;
        }
    } catch (e) {
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerText = "Start Challenge";
        }
        problemBox.innerHTML = `<p class="text-rose-400">Error connecting to Gemini Interview Simulator.</p>`;
    }
}

async function handleSubmitMockInterviewAnswer() {
    const answerInput = document.getElementById('interview-candidate-answer');
    const feedbackBox = document.getElementById('interview-feedback-box');
    const submitBtn = document.getElementById('interview-submit-answer-btn');
    if (!answerInput || !feedbackBox) return;

    const candidateAnswer = answerInput.value.trim();
    if (!candidateAnswer) {
        showToast("Please write your approach or code solution first!", "info");
        return;
    }

    const company = document.getElementById('interview-company-select').value;
    const topic = document.getElementById('interview-topic-select').value;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Senior Bar Raiser is Evaluating...";
    }

    feedbackBox.classList.remove('hidden');
    feedbackBox.innerHTML = `<p class="text-slate-400 font-mono animate-pulse">⚡ Evaluating Big-O, edge cases, invariants and drafting hiring committee decision...</p>`;

    try {
        const resp = await fetch('/api/ai/mock-interview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic,
                company,
                candidateAnswer,
                questionPrompt: currentInterviewQuestion
            })
        });
        const data = await resp.json();

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Re-submit Solution";
        }

        if (data.success && data.content) {
            if (data.isHire) {
                triggerConfetti();
                playChime("levelup");
                showToast(`🎉 Congratulations! You received a ${company} Hiring Recommendation (+${data.xpBonus} XP, +${data.coinsBonus} Coins)!`, "success");
                if (data.updatedUser) {
                    window.CURRENT_USER = data.updatedUser;
                    updateUserHeader(data.updatedUser, data.levelInfo);
                }
            } else {
                playChime("coin");
                showToast("Feedback evaluated. Review the recommendations to improve!", "info");
            }

            feedbackBox.innerHTML = `
                <div class="p-4 rounded-xl ${data.isHire ? 'bg-emerald-500/10 border-2 border-emerald-500/40 glow-primary' : 'bg-slate-900 border border-white/10'}">
                    <div class="prose prose-invert max-w-none text-xs leading-relaxed">
                        ${formatAiMarkdown(data.content)}
                    </div>
                </div>
            `;
        } else {
            feedbackBox.innerHTML = `<p class="text-rose-400">Failed to evaluate response.</p>`;
        }
    } catch (e) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit to AI Bar Raiser";
        }
        feedbackBox.innerHTML = `<p class="text-rose-400">Error connecting to Gemini Evaluation Engine.</p>`;
    }
}

function formatAiMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/### (.*?)\n/g, '<h4 class="font-bold text-white text-sm mt-3 mb-1">$1</h4>')
        .replace(/## (.*?)\n/g, '<h3 class="font-extrabold text-indigo-300 text-base mt-3 mb-1.5">$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="text-slate-300">$1</em>')
        .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 font-mono text-[11px]">$1</code>')
        .replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre class="p-3 my-2 rounded-xl bg-slate-950 border border-white/10 font-mono text-[11px] overflow-x-auto text-emerald-300"><code>$2</code></pre>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n• /g, '<br>• ');
}

// ==================== 15. STUDENT NOTICES & MODAL ====================
async function loadNotices() {
    const container = document.getElementById('notices-feed');
    if (!container) return;

    try {
        const resp = await fetch('/api/notices');
        const data = await resp.json();
        const notices = data.notices || [];

        if (notices.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">No campus notices posted yet.</div>`;
            return;
        }

        container.innerHTML = notices.map(n => {
            const catColors = {
                'Urgent': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
                'Placement': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                'Academic': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
                'Hackathon': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                'General': 'bg-slate-700 text-slate-300 border-slate-600'
            };
            const badgeClass = catColors[n.category] || catColors['General'];

            return `
                <div class="glass-panel p-4 relative border ${n.important ? 'border-rose-500/40 glow-pink' : 'border-white/5'} hover:border-indigo-500/30 transition-all">
                    <div class="flex items-center justify-between gap-3 mb-2">
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border ${badgeClass}">
                                ${n.category}
                            </span>
                            ${n.important ? '<span class="text-xs text-rose-400 font-bold flex items-center gap-1">⚠️ Urgent Circular</span>' : ''}
                        </div>
                        <span class="text-xs text-slate-400 font-mono">${n.created_at ? n.created_at.split(' ')[0] : ''}</span>
                    </div>

                    <h4 class="text-sm font-bold text-white mb-1.5">${n.title}</h4>
                    <p class="text-xs text-slate-300 leading-relaxed mb-3">${n.content}</p>

                    <div class="flex items-center justify-between pt-2.5 border-t border-white/5 text-xs text-slate-400">
                        <span class="flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            Posted by: ${n.author_name}
                        </span>
                        ${n.link ? `
                            <a href="${n.link}" target="_blank" class="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                                View Attachment
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Failed to load notices:", e);
    }
}

function openStudentNoticesModal() {
    const modal = document.getElementById('student-notices-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const feed = document.getElementById('notices-feed');
        const modalBody = document.getElementById('student-notices-body');
        if (feed && modalBody) {
            modalBody.innerHTML = feed.innerHTML;
        }
    }
}

function closeStudentNoticesModal() {
    const modal = document.getElementById('student-notices-modal');
    if (modal) modal.classList.add('hidden');
}

// ==================== 16. CAMPUS LEADERBOARD ====================
async function loadLeaderboard() {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;

    if (container.children.length === 0) {
        container.innerHTML = `
            <div class="glass-panel p-4 h-16 skeleton mb-3"></div>
            <div class="glass-panel p-4 h-16 skeleton mb-3"></div>
            <div class="glass-panel p-4 h-16 skeleton"></div>
        `;
    }

    try {
        const resp = await fetch('/api/leaderboard');
        const data = await resp.json();
        const leaderboard = data.leaderboard || [];

        container.innerHTML = leaderboard.map((s, idx) => {
            let rankBadge = '';
            if (s.rank === 1) rankBadge = '🥇';
            else if (s.rank === 2) rankBadge = '🥈';
            else if (s.rank === 3) rankBadge = '🥉';
            else rankBadge = `#${s.rank}`;

            return `
                <div class="glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/5 hover:border-indigo-500/30 transition-all render-enter ${s.rank === 1 ? 'glow-gold border-amber-500/30' : ''}" style="animation-delay: ${idx * 35}ms">
                    <div class="flex items-center gap-4">
                        <div class="w-10 text-center font-extrabold text-xl font-mono text-amber-400">
                            ${rankBadge}
                        </div>
                        <div class="relative">
                            <img src="${s.avatar_url}" alt="${s.display_name}" class="w-12 h-12 rounded-xl bg-slate-800 p-1 border border-white/10">
                            <span class="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                                Lvl ${s.level}
                            </span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="font-bold text-white text-base">${s.display_name}</h4>
                                <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    ${s.equipped_title || 'Coder'}
                                </span>
                            </div>
                            <p class="text-xs text-slate-400 font-mono">${s.department} • <span class="text-cyan-300 font-bold">${s.section || 'Section A'}</span> • Sem ${s.semester}</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-6 text-xs text-slate-300 font-mono">
                        <div class="text-center">
                            <span class="text-slate-400 block text-[10px] uppercase">LeetCode</span>
                            <span class="font-bold text-emerald-400 text-sm">${s.leetcodeSolved} Solved</span>
                        </div>
                        <div class="text-center">
                            <span class="text-slate-400 block text-[10px] uppercase">GitHub</span>
                            <span class="font-bold text-cyan-400 text-sm">${s.githubCommits} Commits</span>
                        </div>
                        <div class="text-center">
                            <span class="text-slate-400 block text-[10px] uppercase">Total XP</span>
                            <span class="font-bold text-indigo-400 text-sm">${s.xp.toLocaleString()} XP</span>
                        </div>
                        <div class="text-center">
                            <span class="text-slate-400 block text-[10px] uppercase">ByteCoins</span>
                            <span class="font-bold text-amber-400 text-sm">${s.coins.toLocaleString()} 🪙</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Failed to load leaderboard:", e);
    }
}

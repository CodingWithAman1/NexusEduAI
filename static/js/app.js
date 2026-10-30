/**
 * CampusPulse / NexusEdu AI - Master Application Controller
 * Pitch Mode Tour, AI Copilot, Toast Alerts & Tab Switching
 */

let currentTab = 'overview';

// ==================== LIVELY APP LOADING SCREEN DISMISSAL ====================
function dismissLoadingScreen() {
    const loader = document.getElementById('app-loading-screen');
    if (!loader) return;
    loader.classList.add('fade-out');
    setTimeout(() => {
        if (loader && loader.parentNode) {
            loader.parentNode.removeChild(loader);
        }
    }, 450);
}

window.addEventListener('load', () => {
    setTimeout(dismissLoadingScreen, 350);
});
setTimeout(dismissLoadingScreen, 1200);

document.addEventListener('DOMContentLoaded', () => {
    const initialStudentTab = window.INITIAL_TAB || 'overview';
    document.querySelector(`.nav-tab-btn[data-tab="${initialStudentTab}"]`)?.setAttribute('aria-current', 'page');
    document.querySelectorAll('.tab-view-content').forEach(view => {
        view.setAttribute('aria-hidden', String(view.id !== `tab-view-${initialStudentTab}`));
    });

    if (window.FIREBASE_CONFIG) {
        initFirebase(window.FIREBASE_CONFIG);
    }

    loadLeetCodeStats();
    loadGitHubStats();
    loadUnifiedCalendar();
    loadAssignments();
    loadNotices();
    loadAIAnalysis();
    if (typeof updateAiStatusBadge === 'function') updateAiStatusBadge();
    loadLeaderboard();
    loadShopItems('all');
    loadAchievements();
    if (typeof loadCourseMaterials === 'function') loadCourseMaterials();

    // Check for access restriction redirection
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('access_denied') === 'student_portal_restricted') {
        showToast("Access Restricted: Faculty accounts are restricted to the Faculty & College Management Portal.", "info");
    } else if (urlParams.get('access_denied')) {
        showToast("Access Restricted: College Administration portal requires Faculty or Dean credentials.", "error");
    }

    // If an initial tab is requested
    if (window.INITIAL_TAB && window.INITIAL_TAB !== 'overview') {
        switchTab(window.INITIAL_TAB);
    }

    if (window.CURRENT_USER) {
        applyUserCosmetics(window.CURRENT_USER);
    }

    setupFormListeners();

    // AI Copilot enter key handler
    const chatInput = document.getElementById('ai-copilot-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendAIChat();
            }
        });
    }

    document.addEventListener('click', (event) => {
        const menu = document.getElementById('account-menu');
        const trigger = document.getElementById('account-menu-trigger');
        if (menu && trigger && !menu.contains(event.target) && !trigger.contains(event.target)) {
            menu.classList.add('hidden');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });
});

function toggleAccountMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('account-menu');
    const trigger = document.getElementById('account-menu-trigger');
    if (!menu || !trigger) return;
    const isOpening = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !isOpening);
    trigger.setAttribute('aria-expanded', String(isOpening));
}

function setupFormListeners() {
    const noticeForm = document.getElementById('create-notice-form');
    if (noticeForm) noticeForm.addEventListener('submit', handleCreateNoticeForm);

    const assignForm = document.getElementById('create-assignment-form');
    if (assignForm) assignForm.addEventListener('submit', handleCreateAssignmentForm);

    const submitForm = document.getElementById('assignment-submission-form');
    if (submitForm) submitForm.addEventListener('submit', handleAssignmentSubmitForm);

    const gradeForm = document.getElementById('grading-submission-form');
    if (gradeForm) gradeForm.addEventListener('submit', handleGradeSubmissionForm);

    const profileForm = document.getElementById('profile-edit-form');
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);

    const connectForm = document.getElementById('connect-accounts-form');
    if (connectForm) connectForm.addEventListener('submit', handleConnectAccountsSubmit);

    const uploadMatForm = document.getElementById('upload-material-form');
    if (uploadMatForm) uploadMatForm.addEventListener('submit', handleUploadCourseMaterialForm);
}

function switchTab(tabId) {
    currentTab = tabId;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active', 'bg-indigo-600/20', 'text-indigo-400');
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.classList.remove('active', 'bg-indigo-600/20', 'text-indigo-400');
            btn.removeAttribute('aria-current');
        }
    });

    document.querySelectorAll('.tab-view-content').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('view-transition-enter');
    });

    const activeView = document.getElementById(`tab-view-${tabId}`);
    if (activeView) {
        activeView.classList.remove('hidden');
        activeView.setAttribute('aria-hidden', 'false');
        void activeView.offsetWidth;
        activeView.classList.add('view-transition-enter');
    }
    document.querySelectorAll('.tab-view-content').forEach(view => {
        if (view !== activeView) view.setAttribute('aria-hidden', 'true');
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'shop') {
        loadShopItems(currentShopFilter);
        loadAchievements();
    }
    if (tabId === 'assignments') {
        loadAssignments();
        if (typeof loadCourseMaterials === 'function') loadCourseMaterials();
    }
    if (tabId === 'ai-hub') {
        if (typeof loadAIAnalysis === 'function') loadAIAnalysis();
        if (typeof updateAiStatusBadge === 'function') updateAiStatusBadge();
    }
    if (tabId === 'leaderboard') loadLeaderboard();
}

// ==================== PITCH WALKTHROUGH TOUR ====================
let currentPitchSlide = 0;
const pitchSlides = [
    {
        title: "1. The Problem: Fragmented Student Portfolios",
        subtitle: "Students juggle LeetCode, GitHub, and university coursework in silos.",
        bullets: [
            "Colleges lack visibility into real student coding ability beyond GPA.",
            "Recruiters struggle to evaluate true hands-on development experience.",
            "Students lose motivation without gamified daily engagement loops."
        ],
        icon: "⚡"
    },
    {
        title: "2. The Solution: Unified Multimodal Intelligence",
        subtitle: "NexusEdu correlates live DSA algorithms with real Git engineering.",
        bullets: [
            "Real-time scraping of LeetCode contest rankings and submission streaks.",
            "GitHub repository composition and verified commit velocity.",
            "Direct integration with university assignment grading and rubrics."
        ],
        icon: "🧠"
    },
    {
        title: "3. Retention Engine: Web3-Style Gamification",
        subtitle: "ByteCoins, mystery loot chests, and custom cosmetics.",
        bullets: [
            "XP Leveling curve from Novice Coder to Grandmaster Developer.",
            "Shop with equipped avatars, banners, and cyberpunk themes.",
            "Daily loot drops & coding streak multipliers driving 3x higher retention."
        ],
        icon: "🛍️"
    },
    {
        title: "4. Institutional Value: College Accreditation & Risk Radar",
        subtitle: "Automating university compliance, grading, and early intervention.",
        bullets: [
            "Cohort Risk Radar automatically flags students falling behind in practice.",
            "Interactive Grading Studio with AI similarity detection & rubric scoring.",
            "1-Click accredited CSV export for academic dean and NBA/NAAC audits."
        ],
        icon: "🏫"
    }
];

function openPitchTour() {
    currentPitchSlide = 0;
    renderPitchSlide();
    const modal = document.getElementById('pitch-tour-modal');
    if (modal) modal.classList.remove('hidden');
}

function closePitchTour() {
    const modal = document.getElementById('pitch-tour-modal');
    if (modal) modal.classList.add('hidden');
}

function nextPitchSlide() {
    if (currentPitchSlide < pitchSlides.length - 1) {
        currentPitchSlide++;
        renderPitchSlide();
    } else {
        closePitchTour();
        showToast("Pitch tour complete! Feel free to test each module live.", "success");
    }
}

function prevPitchSlide() {
    if (currentPitchSlide > 0) {
        currentPitchSlide--;
        renderPitchSlide();
    }
}

function renderPitchSlide() {
    const s = pitchSlides[currentPitchSlide];
    document.getElementById('pitch-slide-title').innerText = s.title;
    document.getElementById('pitch-slide-subtitle').innerText = s.subtitle;
    document.getElementById('pitch-slide-icon').innerText = s.icon;
    document.getElementById('pitch-slide-bullets').innerHTML = s.bullets.map(b => `
        <li class="flex items-start gap-2.5 text-slate-200">
            <svg class="w-4 h-4 text-cyan-400 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span>${b}</span>
        </li>
    `).join('');
    document.getElementById('pitch-slide-counter').innerText = `Slide ${currentPitchSlide + 1} of ${pitchSlides.length}`;
}

// Toast Notifications System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colors = {
        success: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200 glow-primary',
        error: 'border-rose-500/40 bg-rose-950/90 text-rose-200 glow-pink',
        info: 'border-indigo-500/40 bg-slate-900/90 text-slate-100 glow-indigo'
    };

    const icons = {
        success: '<svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
        error: '<svg class="w-5 h-5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
        info: '<svg class="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0 text-sm max-w-md ${colors[type] || colors.info}`;
    toast.innerHTML = `
        ${icons[type] || icons.info}
        <span class="font-medium">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-4');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Profile Modal & Updates
function openProfileModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeProfileModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const bio = document.getElementById('prof-bio').value;
    const targetRole = document.getElementById('prof-target-role').value;
    const targetCompany = document.getElementById('prof-target-company').value;
    const leetcodeUsername = document.getElementById('prof-lc-user').value;
    const githubUsername = document.getElementById('prof-gh-user').value;
    const semester = document.getElementById('prof-semester').value;
    const department = document.getElementById('prof-department').value;
    const section = document.getElementById('prof-section')?.value || 'Section A';

    try {
        const resp = await fetch('/api/profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bio, targetRole, targetCompany, leetcodeUsername, githubUsername, semester, department, section
            })
        });
        const data = await resp.json();

        if (data.success) {
            triggerConfetti();
            showToast("Profile personalization saved!", "success");
            closeProfileModal();
            setTimeout(() => window.location.reload(), 800);
        } else {
            showToast(data.error || "Update failed", "error");
        }
    } catch (err) {
        showToast("Error updating profile", "error");
    }
}

function openFirebaseModal() {
    const modal = document.getElementById('firebase-settings-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeFirebaseModal() {
    const modal = document.getElementById('firebase-settings-modal');
    if (modal) modal.classList.add('hidden');
}

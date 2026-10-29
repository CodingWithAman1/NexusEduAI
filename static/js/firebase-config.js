/**
 * Firebase Auth Integration & Backend Synchronization
 * Supports Real Firebase Auth (Google Sign-In, Email/Password)
 * and seamless fallback demo logins for immediate local testing.
 */

let firebaseApp = null;
let firebaseAuth = null;

function redirectAfterAuth(user) {
    // If already on student or college dashboard, reload to refresh user data
    const path = window.location.pathname;
    if (path === '/student' || path === '/college') {
        window.location.reload();
        return;
    }

    // Otherwise, redirect forward to the appropriate portal
    let dest = '/student';
    if (window.NEXT_PAGE === 'college' || (user && user.role === 'faculty')) {
        dest = '/college';
    } else if (window.NEXT_PAGE === 'student') {
        dest = '/student';
    }
    window.location.href = dest;
}

function triggerConfetti() {
    if (typeof confetti === 'function') {
        try {
            confetti({
                particleCount: 90,
                spread: 75,
                origin: { y: 0.6 }
            });
        } catch (e) {
            // Safe fallback
        }
    }
}
window.triggerConfetti = triggerConfetti;

function initFirebase(config) {
    try {
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(config);
        } else {
            firebaseApp = firebase.app();
        }
        firebaseAuth = firebase.auth();
        console.log("🔥 Firebase initialized successfully:", config.projectId);
        
        // Listen to Firebase auth state changes
        firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                console.log("Firebase user logged in:", user.email);
            }
        });
    } catch (e) {
        console.warn("Firebase initialization warning (Normal if demo keys):", e.message);
    }
}

// 1. Google Sign-In via Firebase
async function handleFirebaseGoogleLogin() {
    if (!firebaseAuth) {
        showToast("Firebase Auth not initialized. Using demo mode.", "info");
        return;
    }

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebaseAuth.signInWithPopup(provider);
        const user = result.user;

        // Sync with Flask backend
        const syncResp = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL,
                role: 'student'
            })
        });

        const syncData = await syncResp.json();
        if (syncData.success) {
            triggerConfetti();
            showToast(`Welcome back, ${syncData.user.display_name}! Redirecting to dashboard...`, "success");
            setTimeout(() => redirectAfterAuth(syncData.user), 600);
        } else {
            showToast(syncData.error || "Failed to synchronize session with backend", "error");
        }
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        if (error.code === 'auth/unauthorized-domain') {
            showFirebaseDomainHelperModal();
        } else if (error.code === 'auth/operation-not-allowed') {
            showToast("Google sign-in is disabled in your Firebase console. Enable it under Authentication > Sign-in method.", "error");
        } else if (error.code === 'auth/internal-error') {
            showToast("Firebase internal error. Please ensure popups and cookies are allowed, or sign in directly with Email & Password below.", "error");
        } else if (error.code === 'auth/popup-closed-by-user') {
            showToast("Google sign-in was closed before completing.", "info");
        } else {
            showToast(error.message || "Failed to sign in with Google", "error");
        }
    }
}

// Modal helper when Firebase rejects OAuth domain (e.g. 127.0.0.1 vs localhost)
function showFirebaseDomainHelperModal() {
    let existing = document.getElementById('firebase-domain-helper-modal');
    if (existing) existing.remove();

    const currentHost = window.location.hostname;
    const currentPort = window.location.port ? `:${window.location.port}` : '';
    const localhostUrl = `http://localhost${currentPort}${window.location.pathname}${window.location.search}`;
    const projectId = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId) ? window.FIREBASE_CONFIG.projectId : 'ai-student-dashboard-3fa4a';

    const modal = document.createElement('div');
    modal.id = 'firebase-domain-helper-modal';
    modal.className = 'fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="glass-panel max-w-lg w-full p-6 relative border-amber-500/40 glow-gold shadow-2xl rounded-2xl">
            <div class="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <div class="flex items-center gap-2">
                    <span class="text-2xl">🔥</span>
                    <div>
                        <h3 class="text-sm font-extrabold text-white">Firebase Domain Authorization Required</h3>
                        <p class="text-[10px] text-amber-400 font-mono">auth/unauthorized-domain</p>
                    </div>
                </div>
                <button onclick="document.getElementById('firebase-domain-helper-modal').remove()" class="text-slate-400 hover:text-white text-lg">✕</button>
            </div>
            
            <p class="text-xs text-slate-300 mb-4 leading-relaxed">
                Firebase Google Sign-In blocked OAuth because <strong class="text-white font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-white/10">${currentHost}</strong> is not listed under Authorized Domains in your Firebase project (<span class="text-cyan-400 font-mono">${projectId}</span>).
            </p>

            <div class="space-y-3 text-xs mb-5">
                <div class="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/30">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-cyan-400">⚡ Solution 1: Switch to localhost (Instant Fix!)</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">Recommended</span>
                    </div>
                    <p class="text-slate-300 text-[11px] mb-2.5">
                        Firebase authorizes <code class="text-white font-mono">localhost</code> by default. If you opened the site as <code class="text-white font-mono">127.0.0.1</code>, switch to localhost below:
                    </p>
                    <a href="${localhostUrl}" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs shadow-md transition-all">
                        <span>Open on http://localhost${currentPort}</span>
                        <span>→</span>
                    </a>
                </div>

                <div class="p-3.5 rounded-xl bg-slate-900/90 border border-indigo-500/30">
                    <span class="font-bold text-indigo-300 block mb-1">🛠️ Solution 2: Add 127.0.0.1 to Firebase Console</span>
                    <p class="text-slate-400 text-[11px] mb-2">
                        1. Open Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains<br>
                        2. Click "Add domain" and type <strong>127.0.0.1</strong><br>
                        3. Make sure Google Sign-in provider is enabled under Sign-in method.
                    </p>
                    <a href="https://console.firebase.google.com/project/${projectId}/authentication/settings" target="_blank" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-bold text-[11px] transition-colors">
                        <span>Open Firebase Console Settings</span>
                        <span>↗</span>
                    </a>
                </div>

                <div class="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30">
                    <span class="font-bold text-emerald-400 block mb-1">✨ Solution 3: Use Email & Password or Local Demo</span>
                    <p class="text-slate-400 text-[11px]">
                        Email/Password sign-up and sign-in work locally without needing OAuth domain authorization.
                    </p>
                </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button onclick="document.getElementById('firebase-domain-helper-modal').remove()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors">
                    Close
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 2. Email & Password Sign-In
async function handleFirebaseEmailLogin(email, password) {
    if (!firebaseAuth) {
        showToast("Firebase Auth unavailable. Please check credentials in Settings.", "error");
        return;
    }

    try {
        const result = await firebaseAuth.signInWithEmailAndPassword(email, password);
        const user = result.user;

        const syncResp = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || email.split('@')[0]
            })
        });

        const syncData = await syncResp.json();
        if (syncData.success) {
            triggerConfetti();
            showToast(`Logged in as ${syncData.user.display_name}! Redirecting...`, "success");
            setTimeout(() => redirectAfterAuth(syncData.user), 600);
        } else {
            showToast(syncData.error || "Login synchronization failed", "error");
        }
    } catch (error) {
        if (error.code === 'auth/operation-not-allowed') {
            showToast("Email/Password provider is disabled in Firebase Console. Enable it under Authentication > Sign-in method.", "error");
        } else if (error.code === 'auth/internal-error') {
            showToast("Firebase internal error: Please verify network connection or use standard Email & Password sign-in below.", "error");
        } else {
            showToast(error.message, "error");
        }
    }
}

// 3. Email & Password Sign-Up
async function handleFirebaseEmailSignUp(email, password, displayName, role = 'student') {
    if (!firebaseAuth) {
        showToast("Firebase Auth unavailable.", "error");
        return;
    }

    try {
        const result = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        const user = result.user;

        await user.updateProfile({ displayName: displayName });

        const syncResp = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: displayName,
                role: role
            })
        });

        const syncData = await syncResp.json();
        if (syncData.success) {
            triggerConfetti();
            showToast(`Account created for ${displayName}! Redirecting...`, "success");
            setTimeout(() => redirectAfterAuth(syncData.user), 600);
        } else {
            showToast(syncData.error || "Account synchronization failed", "error");
        }
    } catch (error) {
        if (error.code === 'auth/operation-not-allowed') {
            showToast("Email/Password provider is disabled in Firebase Console. Enable it under Authentication > Sign-in method.", "error");
        } else if (error.code === 'auth/internal-error') {
            showToast("Firebase internal error: Please verify network connection or use standard Email & Password sign-in below.", "error");
        } else {
            showToast(error.message, "error");
        }
    }
}

// 4. Demo 1-Click Role Switcher (Student <-> College Admin)
async function switchDemoRole(targetRole) {
    try {
        const resp = await fetch('/api/auth/demo-switch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: targetRole })
        });
        const data = await resp.json();
        if (data.success) {
            showToast(`Switched view to ${data.user.display_name} (${data.user.role.toUpperCase()})`, "success");
            setTimeout(() => redirectAfterAuth(data.user), 600);
        }
    } catch (e) {
        showToast("Role switch failed", "error");
    }
}

// 5. Firebase Sign Out
async function handleSignOut() {
    if (firebaseAuth && firebaseAuth.currentUser) {
        await firebaseAuth.signOut();
    }
    showToast("Signed out", "info");
    setTimeout(() => {
        window.location.href = '/logout';
    }, 400);
}

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
        const errCode = error.code || '';
        const errMsg = error.message || '';
        if (errCode === 'auth/unauthorized-domain' || errMsg.includes('auth/unauthorized-domain')) {
            showFirebaseDomainHelperModal();
        } else if (errCode === 'auth/operation-not-allowed' || errMsg.includes('auth/operation-not-allowed')) {
            showToast("Google sign-in is disabled in your Firebase console. Enable it under Authentication > Sign-in method.", "error");
        } else if (errCode === 'auth/internal-error' || errMsg.includes('auth/internal-error')) {
            showToast("Firebase internal error: Domain not authorized in Firebase or third-party cookies blocked.", "error");
            showFirebaseDomainHelperModal();
        } else if (errCode === 'auth/popup-closed-by-user' || errMsg.includes('auth/popup-closed-by-user')) {
            showToast("Google sign-in was closed before completing.", "info");
        } else {
            showToast(error.message || "Failed to sign in with Google", "error");
        }
    }
}

// Modal helper when Firebase rejects OAuth domain
function showFirebaseDomainHelperModal() {
    let existing = document.getElementById('firebase-domain-helper-modal');
    if (existing) existing.remove();

    const currentHost = window.location.hostname;
    const currentPort = window.location.port ? `:${window.location.port}` : '';
    const isCloudHost = currentHost !== 'localhost' && currentHost !== '127.0.0.1';
    const localhostUrl = `http://localhost${currentPort}${window.location.pathname}${window.location.search}`;
    const projectId = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId) ? window.FIREBASE_CONFIG.projectId : 'brandbuildai-2749e';

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
                Firebase Google Sign-In blocked OAuth because <strong class="text-white font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-white/10">${currentHost}</strong> is not listed under Authorized Domains in your Firebase project (<span class="text-cyan-400 font-mono font-bold">${projectId}</span>).
            </p>

            <div class="space-y-3 text-xs mb-5">
                ${isCloudHost ? `
                <div class="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="font-bold text-emerald-400">⚡ Permanent Fix: Add Domain in Firebase (30s)</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Recommended</span>
                    </div>
                    <ol class="text-slate-300 text-[11px] mb-3 space-y-1 list-decimal list-inside">
                        <li>Open Firebase Console Settings below</li>
                        <li>Scroll down to <strong class="text-white">Authorized domains</strong></li>
                        <li>Click <strong class="text-white">Add domain</strong> and enter: <code class="text-amber-300 font-mono font-bold select-all bg-slate-950 px-1.5 py-0.5 rounded">${currentHost}</code></li>
                    </ol>
                    <div class="flex items-center gap-2 flex-wrap">
                        <a href="https://console.firebase.google.com/project/${projectId}/authentication/settings" target="_blank" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md transition-all">
                            <span>Open Firebase Console Settings</span>
                            <span>↗</span>
                        </a>
                        <button type="button" onclick="navigator.clipboard.writeText('${currentHost}'); this.innerText='✓ Domain Copied!';" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs transition-colors">
                            📋 Copy "${currentHost}"
                        </button>
                    </div>
                </div>
                ` : `
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
                `}

                <div class="p-3.5 rounded-xl bg-slate-900/90 border border-indigo-500/30">
                    <span class="font-bold text-indigo-300 block mb-1">✨ Solution 2: Sign In with Email &amp; Password (Instant)</span>
                    <p class="text-slate-400 text-[11px] leading-relaxed mb-2">
                        You can sign in immediately without Google OAuth domain whitelisting. Email authentication runs on your cloud server:
                    </p>
                    <div class="flex items-center gap-2 flex-wrap">
                        <button type="button" onclick="document.getElementById('firebase-domain-helper-modal').remove(); const e=document.getElementById('login-email'); const p=document.getElementById('login-password'); if(e&&p){e.value='funwithcode8630@gmail.com';p.value='password123';}" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-[11px]">
                            🎓 Student: funwithcode8630@gmail.com
                        </button>
                        <button type="button" onclick="document.getElementById('firebase-domain-helper-modal').remove(); const e=document.getElementById('login-email'); const p=document.getElementById('login-password'); if(e&&p){e.value='faculty@12345';p.value='password123';}" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 font-bold text-[11px]">
                            🏫 Faculty: faculty@12345
                        </button>
                    </div>
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

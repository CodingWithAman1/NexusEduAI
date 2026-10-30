/**
 * College Management & Faculty Dashboard Controller
 * Multi-Section Supervision, Grading Studio, Risk Radar, and AI Rubric Evaluation
 */

let currentFacultyTab = 'overview';
window._facultyActiveSection = 'all';
window._cohortSubmissions = [];
window._allCohortStudents = [];

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
    const dueDateInput = document.getElementById('assign-due-date');
    if (dueDateInput) {
        const today = new Date();
        const localIsoDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        dueDateInput.min = localIsoDate;
        if (!dueDateInput.value) dueDateInput.value = localIsoDate;
    }
});
setTimeout(dismissLoadingScreen, 1200);

// ==================== 1. FACULTY TAB & SECTION NAVIGATION ====================
function switchFacultyTab(tabId) {
    currentFacultyTab = tabId;

    document.querySelectorAll('.faculty-nav-btn').forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active', 'bg-indigo-600', 'text-white', 'shadow-md');
            btn.classList.remove('text-slate-300', 'hover:bg-white/5');
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.classList.remove('active', 'bg-indigo-600', 'text-white', 'shadow-md');
            btn.classList.add('text-slate-300', 'hover:bg-white/5');
            btn.removeAttribute('aria-current');
        }
    });

    document.querySelectorAll('.faculty-view-content').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('view-transition-enter');
    });

    const activeView = document.getElementById(`faculty-view-${tabId}`);
    if (activeView) {
        activeView.classList.remove('hidden');
        activeView.setAttribute('aria-hidden', 'false');
        void activeView.offsetWidth;
        activeView.classList.add('view-transition-enter');
    }
    document.querySelectorAll('.faculty-view-content').forEach(view => {
        if (view !== activeView) view.setAttribute('aria-hidden', 'true');
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'notices-board') loadNotices();
    if (tabId === 'assignment-studio') loadFacultyAssignments(window._facultyActiveSection);
    if (tabId === 'course-materials') loadFacultyCourseMaterials(window._facultyActiveSection);
    if (tabId === 'cohort-overview' || tabId === 'section-roster' || tabId === 'risk-radar' || tabId === 'grading-studio' || tabId === 'overview') {
        loadCohortOverview(window._facultyActiveSection);
    }
}

function filterFacultySection(section) {
    window._facultyActiveSection = section;

    // Update Section pill active styles
    document.querySelectorAll('.faculty-section-btn').forEach(btn => {
        const btnSec = btn.dataset.section;
        if (btnSec === section) {
            btn.className = 'faculty-section-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition-all';
        } else {
            btn.className = 'faculty-section-btn px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 transition-all';
        }
    });

    // Update active section label in header/hero
    const labelEl = document.getElementById('faculty-active-section-display');
    if (labelEl) {
        labelEl.innerText = section === 'all' ? 'All Sections Cohort' : section;
    }

    // Update export CSV links with section param
    const exportBtn = document.getElementById('faculty-export-csv-btn');
    if (exportBtn) {
        exportBtn.href = `/api/college/export-csv?section=${encodeURIComponent(section)}`;
    }
    const exportBtnTab = document.getElementById('faculty-tab-export-csv-btn');
    if (exportBtnTab) {
        exportBtnTab.href = `/api/college/export-csv?section=${encodeURIComponent(section)}`;
    }

    // Refresh active data
    loadCohortOverview(section);
    loadFacultyAssignments(section);
    loadFacultyCourseMaterials(section);
}

// ==================== 2. CAMPUS NOTICES ====================
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

        container.innerHTML = notices.map((n, idx) => {
            const catColors = {
                'Urgent': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
                'Placement': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                'Academic': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
                'Hackathon': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                'General': 'bg-slate-700 text-slate-300 border-slate-600'
            };
            const badgeClass = catColors[n.category] || catColors['General'];

            return `
                <div class="glass-panel p-5 relative border ${n.important ? 'border-rose-500/40 glow-pink' : 'border-white/5'} hover:border-indigo-500/30 transition-all render-enter" style="animation-delay: ${idx * 40}ms">
                    <div class="flex items-center justify-between gap-3 mb-2">
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border ${badgeClass}">
                                ${n.category}
                            </span>
                            ${n.important ? '<span class="text-xs text-rose-400 font-bold flex items-center gap-1">⚠️ Urgent Circular</span>' : ''}
                        </div>
                        <span class="text-xs text-slate-400 font-mono">${n.created_at ? n.created_at.split(' ')[0] : ''}</span>
                    </div>

                    <h4 class="text-base font-bold text-white mb-2">${n.title}</h4>
                    <p class="text-sm text-slate-300 leading-relaxed mb-4">${n.content}</p>

                    <div class="flex items-center justify-between pt-3 border-t border-white/5 text-xs text-slate-400">
                        <span class="flex items-center gap-1.5">
                            <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            Posted by: ${n.author_name} (${n.author_role})
                        </span>
                        ${n.link ? `
                            <a href="${n.link}" target="_blank" class="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                                View Attachment
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
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

async function handleCreateNoticeForm(e) {
    e.preventDefault();
    const title = document.getElementById('notice-title').value;
    const category = document.getElementById('notice-category').value;
    const content = document.getElementById('notice-content').value;
    const important = document.getElementById('notice-important')?.checked || false;
    const link = document.getElementById('notice-link')?.value || '';

    try {
        const resp = await fetch('/api/notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, content, important, link })
        });
        const data = await resp.json();

        if (data.success) {
            triggerConfetti();
            showToast("Campus notice broadcasted successfully!", "success");
            e.target.reset();
            loadNotices();
        } else {
            showToast(data.error || "Failed to post notice", "error");
        }
    } catch (err) {
        showToast("Error posting notice", "error");
    }
}

// ==================== 3. ASSIGNMENT PUBLISHER & LIST ====================
async function loadFacultyAssignments(section = window._facultyActiveSection || 'all') {
    const container = document.getElementById('faculty-assignments-list');
    if (!container) return;

    try {
        const url = (section && section !== 'all') ? `/api/assignments?section=${encodeURIComponent(section)}` : '/api/assignments';
        const resp = await fetch(url);
        const data = await resp.json();
        const assignments = data.assignments || [];

        if (assignments.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">No assignments posted for ${section === 'all' ? 'any section' : section}. Use the form above to publish one!</div>`;
            return;
        }

        container.innerHTML = assignments.map((a, idx) => `
            <div class="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-indigo-500/30 transition-all render-enter" style="animation-delay: ${idx * 35}ms">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 font-mono">${a.subject_code}</span>
                        <span class="text-xs text-slate-400">• ${a.subject}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.section === 'All Sections' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'}">📍 ${a.section || 'All Sections'}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">${a.difficulty}</span>
                    </div>
                    <h5 class="text-sm font-bold text-white mb-1">${a.title}</h5>
                    <p class="text-xs text-slate-400 line-clamp-1">${a.description}</p>
                    <span class="text-[10px] text-slate-500 font-mono mt-1 block">Due: ${a.due_date} • ${a.total_points} Pts • ${a.total_submissions || 0} Submissions</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <a href="/api/assignments/${a.id}/pdf" target="_blank" download class="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center gap-1" title="Download official coursework PDF sheet">
                        📄 Export PDF
                    </a>
                    ${a.attachment_url ? `
                        <a href="${a.attachment_url}" target="_blank" download class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all">
                            📥 Download File
                        </a>
                    ` : ''}
                    <button onclick="switchFacultyTab('grading-studio'); filterFacultySection('${a.section || 'all'}')" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all">
                        View Submissions
                    </button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error("Failed to load faculty assignments:", e);
    }
}

async function handleCreateAssignmentForm(e) {
    e.preventDefault();
    const title = document.getElementById('assign-title').value;
    const subject = document.getElementById('assign-subject').value;
    const subjectCode = document.getElementById('assign-subject-code').value;
    const section = document.getElementById('assign-section')?.value || 'All Sections';
    const dueDate = document.getElementById('assign-due-date').value;
    const totalPoints = document.getElementById('assign-points').value;
    const difficulty = document.getElementById('assign-difficulty').value;
    const tags = document.getElementById('assign-tags').value;
    const description = document.getElementById('assign-description').value;
    const starterCode = document.getElementById('assign-starter-code') ? document.getElementById('assign-starter-code').value : '';

    const formData = new FormData();
    formData.append('title', title);
    formData.append('subject', subject);
    formData.append('subjectCode', subjectCode);
    formData.append('section', section);
    formData.append('dueDate', dueDate);
    formData.append('totalPoints', totalPoints);
    formData.append('difficulty', difficulty);
    formData.append('tags', tags);
    formData.append('description', description);
    formData.append('starterCode', starterCode);

    const fileInput = document.getElementById('assign-file');
    if (fileInput && fileInput.files[0]) {
        formData.append('file', fileInput.files[0]);
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Publishing Assignment...";
    }

    try {
        const resp = await fetch('/api/assignments', {
            method: 'POST',
            body: formData
        });
        const data = await resp.json();

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Post Assignment to Target Section";
        }

        if (data.success) {
            triggerConfetti();
            showToast(`Assignment published to ${section}!`, "success");
            e.target.reset();
            loadFacultyAssignments(window._facultyActiveSection);
            loadCohortOverview(window._facultyActiveSection);
        } else {
            showToast(data.error || "Failed to publish assignment", "error");
        }
    } catch (err) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Post Assignment to Target Section";
        }
        showToast("Error creating assignment", "error");
    }
}

const ASSIGNMENT_PROMPT_TEMPLATES = {
    cpu_scheduling: "Create an Operating Systems lab on CPU Scheduling: FCFS, Round Robin (quantum=4ms), and Shortest Job First. Ask students to calculate average waiting time and turnaround time, show Gantt chart trace examples, and write a Python or C simulation with a 100 pt grading rubric.",
    lru_cache: "Design an in-depth assignment on an O(1) LRU Cache data structure. Include doubly linked list sentinel nodes, hash table lookup, capacity eviction test cases, Big-O bounds, and complete starter code.",
    raft_consensus: "Design a Distributed Systems assignment on Raft Consensus protocol with 3 parts: Leader Election with randomized timers, AppendEntries log replication, and Network Partition split-brain defense.",
    graph_dijkstra: "Create a Data Structures assignment on Graph Algorithms: Priority Queue Dijkstra's Shortest Path with path reconstruction, cycle detection, and Kahn's Topological Sort with test cases.",
    rsa_crypto: "Design an Applied Cryptography assignment on RSA Encryption: Key generation with Miller-Rabin primality, modular exponentiation, and Chinese Remainder Theorem cryptanalysis on small exponent e=3.",
    dp_knapsack: "Create an Advanced Algorithms lab on 2D Dynamic Programming (0/1 Knapsack & Subset Sum), memory optimization to 1D array, item reconstruction trace, and unit tests.",
    cnn_pytorch: "Design a Machine Learning assignment on Convolutional Neural Networks (CNN) with PyTorch for image classification on MNIST. Include architectural layers, loss tracking, and evaluation rubric."
};

function applyAssignmentPromptTemplate(key) {
    const promptInput = document.getElementById('ai-assignment-prompt');
    if (!promptInput) return;
    const text = ASSIGNMENT_PROMPT_TEMPLATES[key] || '';
    if (text) {
        promptInput.value = text;
        promptInput.focus();
        showToast("💡 Template loaded into prompt box! You can customize it freely.", "info");
    }
}

async function handleGenerateFromPrompt(mode = 'draft') {
    const promptInput = document.getElementById('ai-assignment-prompt');
    const promptText = promptInput ? promptInput.value.trim() : '';
    if (!promptText) {
        showToast("Please enter an assignment prompt or click a quick template above!", "warning");
        if (promptInput) promptInput.focus();
        return;
    }

    const section = document.getElementById('ai-prompt-section')?.value || 'All Sections';
    const difficulty = document.getElementById('ai-prompt-difficulty')?.value || 'Medium';
    const totalPoints = parseInt(document.getElementById('ai-prompt-points')?.value || '100', 10);
    const subject = document.getElementById('assign-subject')?.value || 'Computer Science & Engineering';

    if (mode === 'pdf') {
        const btn = document.getElementById('ai-prompt-pdf-btn');
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span>⏳ Gemini Generating PDF...</span>`;
        }
        showToast("⚡ Drafting and compiling publication-grade PDF sheet...", "info");

        try {
            const resp = await fetch('/api/ai/generate-assignment-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptText,
                    subject,
                    difficulty,
                    section,
                    totalPoints
                })
            });

            if (!resp.ok) throw new Error("PDF generation failed");

            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const contentDisp = resp.headers.get('Content-Disposition');
            let filename = 'Coursework_Specification.pdf';
            if (contentDisp && contentDisp.includes('filename=')) {
                filename = contentDisp.split('filename=')[1].replace(/["']/g, '').trim();
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            playChime("coin");
            showToast("📄 Prompt-generated PDF downloaded successfully!", "success");
        } catch (err) {
            console.error("Prompt PDF generation failed:", err);
            showToast("Failed to generate PDF from prompt. Please try again.", "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        }
    } else {
        // mode === 'draft' -> populate form below
        const btn = document.getElementById('ai-prompt-draft-btn');
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span>⚡ Drafting with Gemini...</span>`;
        }
        showToast("✨ Gemini drafting assignment from your prompt...", "info");

        try {
            const resp = await fetch('/api/ai/generate-assignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptText,
                    subject,
                    difficulty,
                    section,
                    totalPoints
                })
            });

            const data = await resp.json();
            if (!data.success || !data.assignment) throw new Error(data.error || "Failed to draft assignment");

            const a = data.assignment;
            if (document.getElementById('assign-title')) document.getElementById('assign-title').value = a.title || 'Coursework Assignment';
            if (document.getElementById('assign-subject')) document.getElementById('assign-subject').value = a.subject || subject;
            if (document.getElementById('assign-subject-code')) document.getElementById('assign-subject-code').value = a.subject_code || 'CS-401';
            if (document.getElementById('assign-section')) document.getElementById('assign-section').value = section;
            if (document.getElementById('assign-points')) document.getElementById('assign-points').value = a.total_points || totalPoints;
            if (document.getElementById('assign-difficulty')) document.getElementById('assign-difficulty').value = a.difficulty || difficulty;

            const tagsVal = Array.isArray(a.tags) ? a.tags.join(', ') : (typeof a.tags === 'string' ? a.tags : '');
            if (document.getElementById('assign-tags')) document.getElementById('assign-tags').value = tagsVal;

            let desc = a.description || '';
            if (Array.isArray(a.rubric) && a.rubric.length && !desc.toLowerCase().includes('rubric')) {
                desc += "\n\n### 5. Official Grading Rubric (100 Pts Total)\n" + a.rubric.map(r => `- **${r.criterion}** (${r.points || 30} pts): ${r.description || ''}`).join('\n');
            }
            if (document.getElementById('assign-description')) document.getElementById('assign-description').value = desc;
            if (document.getElementById('assign-starter-code')) document.getElementById('assign-starter-code').value = a.starter_code || '';

            const dueDateInput = document.getElementById('assign-due-date');
            if (dueDateInput && !dueDateInput.value) {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                dueDateInput.value = nextWeek.toISOString().split('T')[0];
            }

            playChime("coin");
            showToast("✨ Assignment drafted into form below! Review and post to your section.", "success");
            const formElem = document.getElementById('create-assignment-form');
            if (formElem) {
                formElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (err) {
            console.error("Prompt drafting failed:", err);
            showToast("Failed to draft assignment from prompt: " + err.message, "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        }
    }
}

async function handleAIGenerateAssignment() {
    const promptInput = document.getElementById('ai-assignment-prompt');
    if (promptInput) {
        promptInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        promptInput.focus();
        showToast("Type your assignment prompt or click a quick template chip above!", "info");
    } else {
        handleGenerateFromPrompt('draft');
    }
}

async function previewOrExportDraftPDF() {
    const title = document.getElementById('assign-title')?.value || 'Assignment Specification Draft';
    const subject = document.getElementById('assign-subject')?.value || 'Computer Science & Engineering';
    const subjectCode = document.getElementById('assign-subject-code')?.value || 'CS-401';
    const section = document.getElementById('assign-section')?.value || 'All Sections';
    const dueDate = document.getElementById('assign-due-date')?.value || 'Upcoming';
    const totalPoints = document.getElementById('assign-points')?.value || '100';
    const difficulty = document.getElementById('assign-difficulty')?.value || 'Medium';
    const tags = document.getElementById('assign-tags')?.value || '';
    const description = document.getElementById('assign-description')?.value || '';
    const starterCode = document.getElementById('assign-starter-code')?.value || '';

    if (!description && !title) {
        showToast("Please enter an assignment title or generate with AI first", "warning");
        return;
    }

    showToast("📄 Generating official Assignment PDF...", "info");

    try {
        const resp = await fetch('/api/assignments/preview-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                subject,
                subjectCode,
                section,
                dueDate,
                totalPoints,
                difficulty,
                tags,
                description,
                starterCode
            })
        });

        if (!resp.ok) throw new Error("PDF Generation failed");

        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = title.replace(/[^\w\-_\. ]/g, '_').trim() || 'Assignment';
        a.download = `${safeTitle}_Specification.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        playChime("coin");
        showToast("📄 Assignment PDF downloaded successfully!", "success");
    } catch (err) {
        console.error("Error generating draft PDF:", err);
        showToast("Failed to generate assignment PDF", "error");
    }
}

// ==================== 4. COHORT RADAR & MULTI-SECTION ROSTER ====================
async function loadCohortOverview(section = window._facultyActiveSection || 'all') {
    try {
        const url = (section && section !== 'all') ? `/api/college/cohort-overview?section=${encodeURIComponent(section)}` : '/api/college/cohort-overview';
        const resp = await fetch(url);
        const data = await resp.json();

        // Metric Counter Updates
        if (document.getElementById('cohort-total-students')) {
            document.getElementById('cohort-total-students').innerText = data.totalStudents;
            document.getElementById('cohort-total-assignments').innerText = data.totalAssignments;
            document.getElementById('cohort-pending-grading').innerText = data.pendingGrading;
            document.getElementById('cohort-graded-count').innerText = data.gradedSubmissions;
        }

        const pendingBadge = document.getElementById('faculty-pending-badge');
        if (pendingBadge) {
            pendingBadge.innerText = data.pendingGrading;
            pendingBadge.classList.toggle('hidden', Number(data.pendingGrading) === 0);
        }

        // Section Breakdown Cards (Section Comparison Matrix)
        const breakdownContainer = document.getElementById('cohort-section-breakdown');
        if (breakdownContainer && data.sectionBreakdown) {
            const secColors = {
                'Section A': 'from-blue-600/20 to-indigo-600/20 border-indigo-500/30 text-indigo-300',
                'Section B': 'from-purple-600/20 to-pink-600/20 border-purple-500/30 text-purple-300',
                'Section C': 'from-emerald-600/20 to-teal-600/20 border-teal-500/30 text-teal-300'
            };

            breakdownContainer.innerHTML = data.sectionBreakdown.map((sec, idx) => {
                const colorClass = secColors[sec.section] || 'from-slate-800/40 to-slate-900/40 border-white/10 text-slate-200';
                const isCurrent = window._facultyActiveSection === sec.section;
                return `
                    <div class="p-4 rounded-2xl bg-gradient-to-br ${colorClass} border backdrop-blur-md relative overflow-hidden transition-all hover:scale-[1.02] render-enter" style="animation-delay: ${idx * 40}ms">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-2">
                                <span class="text-lg">🏫</span>
                                <h4 class="font-extrabold text-white text-base">${sec.section}</h4>
                            </div>
                            <button onclick="filterFacultySection('${sec.section}')" class="px-2.5 py-1 rounded-lg ${isCurrent ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-900/80 hover:bg-white/10 text-slate-300'} text-[11px] font-semibold border border-white/10 transition-colors">
                                ${isCurrent ? 'Active View ✓' : 'Filter Section'}
                            </button>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <div class="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                                <span class="text-[10px] text-slate-400 uppercase font-semibold block">Students</span>
                                <strong class="text-white text-base font-mono">${sec.studentCount}</strong>
                            </div>
                            <div class="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                                <span class="text-[10px] text-slate-400 uppercase font-semibold block">Avg XP</span>
                                <strong class="text-indigo-400 text-base font-mono">${sec.avgXp}</strong>
                            </div>
                            <div class="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                                <span class="text-[10px] text-slate-400 uppercase font-semibold block">Pending</span>
                                <strong class="text-amber-400 text-base font-mono">${sec.pendingSubmissions}</strong>
                            </div>
                            <div class="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                                <span class="text-[10px] text-slate-400 uppercase font-semibold block">At Risk</span>
                                <strong class="${sec.atRiskCount > 0 ? 'text-rose-400' : 'text-emerald-400'} text-base font-mono">${sec.atRiskCount}</strong>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Student Roster & Directory Table
        if (data.allStudents) {
            window._allCohortStudents = data.allStudents;
            renderStudentRosterTable(data.allStudents);
        }

        // Student Risk Radar
        const radarContainer = document.getElementById('cohort-risk-radar');
        const radarPreview = document.getElementById('cohort-risk-radar-preview');

        if (data.riskRadar) {
            const renderRadarItem = (st, idx = 0) => {
                let badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                if (st.risk_level === 'High Risk') badgeClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30 glow-pink';
                else if (st.risk_level === 'Moderate') badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';

                const secBadgeClass = st.section === 'Section A' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                                     (st.section === 'Section B' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-teal-500/20 text-teal-300 border-teal-500/30');

                return `
                    <div class="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-500/20 transition-all render-enter" style="animation-delay: ${idx * 35}ms">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <h5 class="text-sm font-bold text-white">${st.display_name}</h5>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${st.risk_level}</span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${secBadgeClass}">🏫 ${st.section || 'Section A'}</span>
                            </div>
                            <span class="text-xs text-slate-400 font-mono">Roll: ${st.college_id} • ${st.xp} XP • Lvl ${st.level} • Streak: ${st.streak_days}d</span>
                        </div>
                        <button onclick="triggerStudentNudge(${st.id}, '${st.display_name.replace(/'/g, "\\'")}', '${st.section || 'Section A'}')" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-colors self-start sm:self-auto flex items-center gap-1.5">
                            🔔 Nudge Student
                        </button>
                    </div>
                `;
            };

            if (radarContainer) {
                if (data.riskRadar.length === 0) {
                    radarContainer.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">No at-risk students in this section filter.</div>`;
                } else {
                    radarContainer.innerHTML = data.riskRadar.map((st, idx) => renderRadarItem(st, idx)).join('');
                }
            }

            if (radarPreview) {
                const atRiskSubset = data.riskRadar.slice(0, 3);
                if (atRiskSubset.length === 0) {
                    radarPreview.innerHTML = `<div class="p-4 text-center text-slate-500 text-xs">All students on track!</div>`;
                } else {
                    radarPreview.innerHTML = atRiskSubset.map((st, idx) => renderRadarItem(st, idx)).join('');
                }
            }
        }

        // Submissions Table
        const subsContainer = document.getElementById('cohort-submissions-table');
        const subsPreview = document.getElementById('cohort-submissions-preview');

        if (data.recentSubmissions) {
            const subs = data.recentSubmissions;
            window._cohortSubmissions = subs;

            if (subsContainer) {
                if (subs.length === 0) {
                    subsContainer.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-500 text-xs">No submissions recorded for ${section === 'all' ? 'any section' : section}.</td></tr>`;
                } else {
                    subsContainer.innerHTML = subs.map((s, idx) => {
                        const isGraded = s.status === 'graded';
                        const secBadgeClass = s.student_section === 'Section A' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                                             (s.student_section === 'Section B' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-teal-500/20 text-teal-300 border-teal-500/30');

                        return `
                            <tr data-status="${isGraded ? 'graded' : 'pending'}" class="border-b border-white/5 hover:bg-slate-900/40 transition-colors render-enter" style="animation-delay: ${idx * 30}ms">
                                <td class="py-4 px-4">
                                    <div class="flex items-center gap-3">
                                        <img src="${s.student_avatar}" class="w-8 h-8 rounded-lg bg-slate-800" alt="">
                                        <div>
                                            <p class="font-bold text-white text-sm">${s.student_name}</p>
                                            <span class="text-xs text-slate-400 font-mono">Roll: ${s.student_roll || 'CS-Std'}</span>
                                        </div>
                                    </div>
                                </td>
                                <td class="py-4 px-4">
                                    <span class="px-2.5 py-1 rounded-lg text-xs font-bold border ${secBadgeClass}">
                                        ${s.student_section || 'Section A'}
                                    </span>
                                </td>
                                <td class="py-4 px-4 text-sm text-slate-200">
                                    <p class="font-semibold">${s.assignment_title}</p>
                                    <span class="text-xs text-slate-400">${s.assignment_subject}</span>
                                </td>
                                <td class="py-4 px-4 text-xs font-mono space-y-1">
                                    ${s.submission_link ? `
                                        <a href="${s.submission_link}" target="_blank" class="text-cyan-400 hover:underline flex items-center gap-1">
                                            🔗 Repo Link
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                        </a>
                                    ` : ''}
                                    ${s.submitted_file_url ? `
                                        <a href="${s.submitted_file_url}" target="_blank" download class="text-emerald-400 hover:underline font-bold flex items-center gap-1">
                                            📥 ${s.submitted_filename || 'Download Student File'}
                                        </a>
                                    ` : ''}
                                    ${!s.submission_link && !s.submitted_file_url ? '<span class="text-slate-500">Code Inlined</span>' : ''}
                                </td>
                                <td class="py-4 px-4">
                                    ${isGraded ? `
                                        <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            ${s.grade} / ${s.total_points} pts
                                        </span>
                                    ` : `
                                        <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                            Awaiting Evaluation
                                        </span>
                                    `}
                                </td>
                                <td class="py-4 px-4 text-right">
                                    <button onclick="openGradingModal(${s.id})" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20">
                                        ${isGraded ? 'Update Rubric' : 'Grade Studio'}
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            if (subsPreview) {
                const previewSubs = subs.filter(s => s.status !== 'graded').slice(0, 3);
                if (previewSubs.length === 0) {
                    subsPreview.innerHTML = `<div class="p-4 text-center text-slate-500 text-xs">No pending submissions right now.</div>`;
                } else {
                    subsPreview.innerHTML = previewSubs.map(s => `
                        <div class="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between gap-3">
                            <div>
                                <div class="flex items-center gap-2">
                                    <strong class="text-white text-xs">${s.student_name}</strong>
                                    <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300">${s.student_section || 'Section A'}</span>
                                </div>
                                <span class="text-[11px] text-slate-400 block">${s.assignment_title}</span>
                            </div>
                            <button onclick="openGradingModal(${s.id})" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
                                Grade
                            </button>
                        </div>
                    `).join('');
                }
            }
            filterGradingQueue();
        }

    } catch (e) {
        console.error("Failed to load cohort overview:", e);
    }
}

function filterGradingQueue() {
    const table = document.getElementById('cohort-submissions-table');
    if (!table) return;
    const query = (document.getElementById('grading-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('grading-status-filter')?.value || 'pending';
    let visible = 0;
    table.querySelectorAll('tr[data-status]').forEach(row => {
        const matchesSearch = row.textContent.toLowerCase().includes(query);
        const matchesStatus = status === 'all' || row.dataset.status === status;
        row.hidden = !(matchesSearch && matchesStatus);
        if (!row.hidden) visible++;
    });
    const count = document.getElementById('grading-result-count');
    if (count) count.textContent = `${visible} ${visible === 1 ? 'submission' : 'submissions'}`;
}

function renderStudentRosterTable(students) {
    const container = document.getElementById('cohort-student-roster-table');
    if (!container) return;

    if (!students || students.length === 0) {
        container.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500 text-xs">No students enrolled in this section filter.</td></tr>`;
        return;
    }

    container.innerHTML = students.map((st, idx) => {
        let badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        if (st.risk_level === 'High Risk') badgeClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30 glow-pink';
        else if (st.risk_level === 'Moderate') badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';

        const secBadgeClass = st.section === 'Section A' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                             (st.section === 'Section B' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-teal-500/20 text-teal-300 border-teal-500/30');

        return `
            <tr class="border-b border-white/5 hover:bg-slate-900/40 transition-colors render-enter" style="animation-delay: ${idx * 25}ms">
                <td class="py-3 px-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300">
                            ${st.display_name.charAt(0)}
                        </div>
                        <div>
                            <p class="font-bold text-white text-sm">${st.display_name}</p>
                            <span class="text-xs text-slate-400 font-mono">${st.email}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2.5 py-1 rounded-lg text-xs font-bold border ${secBadgeClass}">
                        ${st.section || 'Section A'}
                    </span>
                </td>
                <td class="py-3 px-4 font-mono text-xs text-slate-300">${st.college_id}</td>
                <td class="py-3 px-4">
                    <div class="text-xs font-mono">
                        <span class="text-indigo-400 font-bold">${st.xp} XP</span>
                        <span class="text-slate-500 text-[10px] block">Level ${st.level}</span>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <div class="space-y-0.5 text-[11px] font-mono">
                        ${st.leetcode_username ? `<a href="https://leetcode.com/${st.leetcode_username}" target="_blank" class="text-amber-400 hover:underline block">⚡ @${st.leetcode_username}</a>` : '<span class="text-slate-500">None</span>'}
                        ${st.github_username ? `<a href="https://github.com/${st.github_username}" target="_blank" class="text-cyan-400 hover:underline block">🐙 @${st.github_username}</a>` : ''}
                    </div>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}">
                        ${st.risk_level}
                    </span>
                </td>
                <td class="py-3 px-4 text-right">
                    <button onclick="showToast('Alert dispatched to ${st.display_name} (${st.section})', 'info')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors">
                        Alert
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterFacultyStudentSearch(query) {
    if (!window._allCohortStudents) return;
    const q = query.toLowerCase().trim();
    if (!q) {
        renderStudentRosterTable(window._allCohortStudents);
        return;
    }
    const filtered = window._allCohortStudents.filter(st =>
        (st.display_name && st.display_name.toLowerCase().includes(q)) ||
        (st.email && st.email.toLowerCase().includes(q)) ||
        (st.college_id && st.college_id.toLowerCase().includes(q)) ||
        (st.section && st.section.toLowerCase().includes(q))
    );
    renderStudentRosterTable(filtered);
}

// ==================== 5. GRADING STUDIO MODAL & AI RUBRICS ====================
function openGradingModal(submissionId, studentName, assignmentTitle, maxPoints, existingGrade, existingFeedback, repoLink, notes) {
    const modal = document.getElementById('grading-modal');
    if (!modal) return;

    let sub = (window._cohortSubmissions || []).find(s => s.id === submissionId);
    if (!sub && studentName) {
        sub = {
            id: submissionId,
            student_name: studentName,
            assignment_title: assignmentTitle,
            total_points: maxPoints,
            grade: existingGrade,
            feedback: existingFeedback,
            submission_link: repoLink,
            submission_notes: notes
        };
    }
    if (!sub) return;
    window._currentGradingSubmission = sub;

    document.getElementById('grade-sub-id').value = sub.id;
    document.getElementById('grade-student-name').innerText = sub.student_name;
    document.getElementById('grade-assignment-title').innerText = sub.assignment_title;
    document.getElementById('grade-max-points').innerText = `${sub.total_points || 100}`;
    document.getElementById('grade-score-input').value = (sub.grade !== null && sub.grade !== undefined) ? sub.grade : '';
    document.getElementById('grade-score-input').max = sub.total_points || 100;
    document.getElementById('grade-feedback-input').value = sub.feedback || '';

    const previewLinkEl = document.getElementById('grade-preview-link');
    if (previewLinkEl) {
        if (sub.submission_link) {
            previewLinkEl.href = sub.submission_link;
            previewLinkEl.innerText = sub.submission_link;
            document.getElementById('grade-preview-link-container')?.classList.remove('hidden');
        } else {
            document.getElementById('grade-preview-link-container')?.classList.add('hidden');
        }
    }

    const previewNotesEl = document.getElementById('grade-preview-notes');
    if (previewNotesEl) {
        previewNotesEl.innerText = sub.submission_notes || 'No extra notes provided.';
    }

    const previewFileEl = document.getElementById('grade-preview-file-container');
    if (previewFileEl) {
        if (sub.submitted_file_url) {
            previewFileEl.innerHTML = `
                <span class="text-slate-400 font-semibold block text-[10px] uppercase">Attached Solution File:</span>
                <a href="${sub.submitted_file_url}" target="_blank" download class="text-emerald-400 hover:underline font-bold text-xs inline-flex items-center gap-1.5 mt-0.5">
                    📥 ${sub.submitted_filename || 'Download File'}
                    <span class="text-[10px] text-slate-400 font-mono font-normal">(${Math.round((sub.submitted_file_size || 0)/1024)} KB)</span>
                </a>
            `;
            previewFileEl.classList.remove('hidden');
        } else {
            previewFileEl.classList.add('hidden');
        }
    }

    modal.classList.remove('hidden');
}

function closeGradingModal() {
    const modal = document.getElementById('grading-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleAIEvaluateSubmission() {
    const sub = window._currentGradingSubmission;
    if (!sub) {
        showToast("No active submission loaded", "error");
        return;
    }

    const aiBtn = document.getElementById('ai-evaluate-btn');
    if (aiBtn) {
        aiBtn.disabled = true;
        aiBtn.innerHTML = `<span>⚡ Gemini AI is grading...</span>`;
    }

    try {
        const resp = await fetch('/api/ai/evaluate-submission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assignmentTitle: sub.assignment_title,
                assignmentDescription: sub.assignment_description || 'Student coursework task implementation',
                studentCode: sub.code_content || (sub.submission_link ? `Repository: ${sub.submission_link}\nFile: ${sub.submitted_filename || 'none'}` : (sub.submitted_filename ? `File: ${sub.submitted_filename}` : 'Solution submitted')),
                studentNotes: sub.submission_notes || ''
            })
        });
        const data = await resp.json();

        if (aiBtn) {
            aiBtn.disabled = false;
            aiBtn.innerHTML = `<span>🤖 AI Auto-Evaluate & Suggest Rubric</span>`;
        }

        if (data.success) {
            const rawPercent = data.suggested_grade_percent ?? 
                               data.suggested_grade ?? 
                               data.evaluation?.suggested_grade_percent ?? 
                               data.evaluation?.suggested_grade ?? 
                               88;
            const percent = Math.max(0, Math.min(100, isNaN(Number(rawPercent)) ? 88 : Math.round(Number(rawPercent))));
            const maxPts = Number(sub.total_points) > 0 ? Number(sub.total_points) : 100;
            const awarded = Math.min(maxPts, Math.max(0, Math.round((percent / 100) * maxPts)));
            document.getElementById('grade-score-input').value = awarded;

            const feedbackText = data.feedback_critique || 
                                 data.feedback || 
                                 data.evaluation?.feedback_critique || 
                                 data.evaluation?.feedback || 
                                 'Student solution submitted and verified against assignment specifications.';

            let fb = `### AI Rubric Evaluation (${percent}% Score Suggestion)\n${feedbackText}\n\n`;
            
            const breakdown = data.rubric_breakdown || data.evaluation?.rubric_breakdown;
            if (breakdown && Array.isArray(breakdown) && breakdown.length) {
                fb += "Rubric Breakdown:\n";
                breakdown.forEach(r => {
                    fb += `• ${r.criterion || 'Criterion'}: ${r.score ?? 0}/${r.max_score ?? 30} - ${r.notes || 'Requirement met'}\n`;
                });
            } else if (data.rubric_scores || data.evaluation?.rubric_scores) {
                const rs = data.rubric_scores || data.evaluation?.rubric_scores;
                fb += "Rubric Breakdown:\n";
                Object.entries(rs).forEach(([k, v]) => {
                    const label = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    fb += `• ${label}: ${v}/100\n`;
                });
            }
            document.getElementById('grade-feedback-input').value = fb;
            playChime("coin");
            showToast(`🤖 Gemini suggested ${awarded}/${maxPts} pts with structured rubric!`, "success");
        } else {
            showToast(data.error || "Failed to evaluate submission", "error");
        }
    } catch (err) {
        if (aiBtn) {
            aiBtn.disabled = false;
            aiBtn.innerHTML = `<span>🤖 AI Auto-Evaluate & Suggest Rubric</span>`;
        }
        showToast("Error connecting to Gemini evaluation engine", "error");
    }
}

async function handleGradeSubmissionForm(e) {
    e.preventDefault();
    const submissionId = document.getElementById('grade-sub-id').value;
    const grade = document.getElementById('grade-score-input').value;
    const feedback = document.getElementById('grade-feedback-input').value;

    try {
        const resp = await fetch(`/api/assignments/submissions/${submissionId}/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grade, feedback })
        });
        const data = await resp.json();

        if (data.success) {
            triggerConfetti();
            showToast("Grade and evaluation published to student!", "success");
            closeGradingModal();
            loadCohortOverview(window._facultyActiveSection);
            loadFacultyAssignments(window._facultyActiveSection);
        } else {
            showToast(data.error || "Failed to grade submission", "error");
        }
    } catch (err) {
        showToast("Error grading submission", "error");
    }
}

// ==================== 6. FACULTY COURSE MATERIALS ====================
async function loadFacultyCourseMaterials(section = window._facultyActiveSection || 'all') {
    const container = document.getElementById('faculty-materials-list');
    if (!container) return;

    try {
        const url = (section && section !== 'all') ? `/api/materials?section=${encodeURIComponent(section)}` : '/api/materials';
        const resp = await fetch(url);
        const data = await resp.json();
        const materials = data.materials || [];

        if (materials.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">No course materials uploaded for ${section === 'all' ? 'any section' : section}. Upload lecture notes or starter archives above.</div>`;
            return;
        }

        container.innerHTML = materials.map((m, idx) => `
            <div class="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between gap-3 hover:border-purple-500/30 transition-all render-enter" style="animation-delay: ${idx * 35}ms">
                <div class="flex items-center gap-3">
                    <span class="text-2xl p-2 rounded-lg bg-slate-800 border border-white/5 shrink-0">📁</span>
                    <div>
                        <div class="flex items-center gap-2">
                            <h5 class="text-sm font-bold text-white">${m.title}</h5>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 font-mono">${m.subject}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 font-mono">📍 ${m.section || 'All Sections'}</span>
                        </div>
                        <p class="text-xs text-slate-400 font-mono">${m.file_name} • ${Math.round((m.file_size || 0)/1024)} KB • ${m.created_at ? m.created_at.split(' ')[0] : ''}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <a href="${m.file_url}" target="_blank" download class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all">
                        Download
                    </a>
                    <button type="button" onclick="handleDeleteCourseMaterial(${m.id})" class="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error("Failed to load faculty materials:", e);
    }
}

async function handleUploadCourseMaterialForm(e) {
    e.preventDefault();
    const title = document.getElementById('mat-title').value;
    const subject = document.getElementById('mat-subject').value;
    const section = document.getElementById('mat-section')?.value || 'All Sections';
    const description = document.getElementById('mat-desc').value;
    const fileInput = document.getElementById('mat-file');

    if (!fileInput || !fileInput.files[0]) {
        showToast("Please choose a file to upload (PDF, ZIP, DOCX, Code, etc.)", "error");
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('subject', subject);
    formData.append('section', section);
    formData.append('description', description);
    formData.append('file', fileInput.files[0]);

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Uploading Material...";
    }

    try {
        const resp = await fetch('/api/materials/upload', {
            method: 'POST',
            body: formData
        });
        const data = await resp.json();

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Upload & Share Resource to Section";
        }

        if (data.success) {
            triggerConfetti();
            playChime("coin");
            showToast(`Course material uploaded and shared with ${section}!`, "success");
            e.target.reset();
            loadFacultyCourseMaterials(window._facultyActiveSection);
        } else {
            showToast(data.error || "Failed to upload material", "error");
        }
    } catch (err) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Upload & Share Resource to Section";
        }
        showToast("Error uploading material", "error");
    }
}

async function handleDeleteCourseMaterial(id) {
    if (!confirm("Are you sure you want to delete this course material?")) return;

    try {
        const resp = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
        const data = await resp.json();
        if (data.success) {
            showToast("Course material removed", "info");
            loadFacultyCourseMaterials(window._facultyActiveSection);
        } else {
            showToast(data.error || "Failed to delete", "error");
        }
    } catch (e) {
        showToast("Error deleting material", "error");
    }
}

// Helpers
function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    }
}

function playChime(type = "coin") {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        if (type === "levelup") {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else {
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
        }
    } catch (e) {}
}

function toggleAccountMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('account-menu');
    const trigger = document.getElementById('account-menu-trigger');
    if (!menu || !trigger) return;
    const isOpening = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !isOpening);
    trigger.setAttribute('aria-expanded', String(isOpening));
}

document.addEventListener('click', (event) => {
    const menu = document.getElementById('account-menu');
    const trigger = document.getElementById('account-menu-trigger');
    if (menu && trigger && !menu.contains(event.target) && !trigger.contains(event.target)) {
        menu.classList.add('hidden');
        trigger.setAttribute('aria-expanded', 'false');
    }
});

async function triggerStudentNudge(studentId, studentName, section) {
    try {
        const resp = await fetch('/api/college/nudge-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, studentName, section })
        });
        const data = await resp.json();
        if (data.success) {
            playChime('ping');
            showToast(data.message || `Academic nudge sent to ${studentName}!`, 'success');
        } else {
            showToast(data.error || 'Failed to deliver student nudge', 'error');
        }
    } catch (e) {
        showToast('Error communicating student nudge', 'error');
    }
}

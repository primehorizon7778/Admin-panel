// ==================== FIREBASE CONFIGURATION ====================
const firebaseConfig = {
    apiKey: "AIzaSyA-6ZngcQRagHV3MEtTUoYoyfZgT8OqaF4",
    databaseURL: "https://nazim-8c4cf-default-rtdb.firebaseio.com",
    projectId: "nazim-8c4cf"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dhib5t6me/image/upload";
const CLOUDINARY_PRESET = "Naeeem";

let selectedChatPhone = null;
let adminChatAttachmentFile = null;
let popupUploadedImageUrl = '';
let aboutUploadedImageUrl = '';
let currentDollarRate = 278.50; // Default fallback

// Global Auth & Sessions Variables
let currentAdminUsername = 'Nazim@007';
let currentAdminPassword = '12345';
let currentSessionId = localStorage.getItem('admin_session_id');
if(!currentSessionId) {
    currentSessionId = 'SESS_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('admin_session_id', currentSessionId);
}

// Global Notification Counters
let qCounts = { dep:0, wit:0, kyc:0, da:0, pwd:0, cmp:0 };


// ==================== GLOBAL LISTENERS & ALERTS ====================
function initGlobalListeners() {
    db.ref('admin_settings/credentials').on('value', snap => {
        if(snap.exists()) {
            currentAdminUsername = snap.val().username || 'Nazim@007';
            currentAdminPassword = snap.val().password || '12345';
            
            if(document.getElementById('session-old-username')) document.getElementById('session-old-username').value = currentAdminUsername;
            if(document.getElementById('session-old-password')) document.getElementById('session-old-password').value = currentAdminPassword;
        } else {
            db.ref('admin_settings/credentials').set({username: 'Nazim@007', password: '12345'});
        }
    });

    db.ref('admin_sessions/' + currentSessionId).on('value', snap => {
        const isLogged = localStorage.getItem('admin1_logged_in') === 'true' || sessionStorage.getItem('admin_temp_logged_in') === 'true';
        if(!snap.exists() && isLogged) {
            triggerToast('Your session was terminated remotely.', 'error');
            setTimeout(() => forceLocalLogout(true), 2000);
        }
    });
    
    db.ref('admin_queues/deposits').on('value', s => { let c=0; if(s.exists()) s.forEach(x => {if(x.val().status==='Pending') c++;}); qCounts.dep = c; updateAlerts(); updateBadge('badge-deposits', c); document.getElementById('dash-pending-deposit').innerText = c; });
    db.ref('admin_queues/withdrawals').on('value', s => { let c=0; if(s.exists()) s.forEach(x => {if(x.val().status==='Pending') c++;}); qCounts.wit = c; updateAlerts(); updateBadge('badge-withdrawals', c); document.getElementById('dash-pending-withdraw').innerText = c; });
    db.ref('admin_queues/kyc_requests').on('value', s => { let c=0; if(s.exists()) s.forEach(x => {if(x.val().status==='pending') c++;}); qCounts.kyc = c; updateAlerts(); updateBadge('badge-kyc', c); });
    db.ref('admin_queues/double_auth').on('value', s => { let c=0; if(s.exists()) s.forEach(x => {if(x.val().status==='pending') c++;}); qCounts.da = c; updateAlerts(); updateBadge('badge-doubleauth', c); });
    db.ref('admin_queues/password_requests').on('value', s => { let c=0; if(s.exists()) s.forEach(x => {if(x.val().status==='pending') c++;}); qCounts.pwd = c; updateAlerts(); updateBadge('badge-password', c); });
    
    db.ref('support_channels').on('value', rootSnap => {
        let c=0;
        if(rootSnap.exists()) {
            rootSnap.forEach(phoneSnap => {
                if(phoneSnap.child('tickets').exists()){
                    phoneSnap.child('tickets').forEach(t => { if(t.val().status === 'Pending') c++; });
                }
            });
        }
        qCounts.cmp = c; updateAlerts(); updateBadge('badge-complaints', c);
    });
}

function updateAlerts() {
    let total = qCounts.dep + qCounts.wit + qCounts.kyc + qCounts.da + qCounts.pwd + qCounts.cmp;
    const alertEl = document.getElementById('global-new-alert');
    const qtyEl = document.getElementById('global-new-qty');
    if(alertEl && qtyEl) {
        if(total > 0) {
            qtyEl.innerText = total;
            alertEl.classList.remove('hidden'); alertEl.classList.add('flex');
        } else {
            alertEl.classList.add('hidden'); alertEl.classList.remove('flex');
        }
    }
}


// ==================== ADMIN LOGIN & SESSION SYSTEM ====================
function checkAdminLogin() {
    initGlobalListeners();
    
    setTimeout(() => {
        const hasLongSession = localStorage.getItem('admin1_logged_in') === 'true';
        const expiry = localStorage.getItem('admin_login_expiry');
        const hasTempSession = sessionStorage.getItem('admin_temp_logged_in') === 'true';
        
        let isValid = false;
        
        if(hasLongSession && expiry && Date.now() < parseInt(expiry)) isValid = true;
        if(hasTempSession) isValid = true;

        const loginScreen = document.getElementById('login-screen');
        if (isValid) {
            loginScreen.style.display = 'none';
            loginScreen.classList.add('hidden');
            initAdminApp();
        } else {
            forceLocalLogout(false);
        }
    }, 800);
}

function performAdminLogin() {
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const auto2h = document.getElementById('login-2h-check').checked;
    
    if (user === currentAdminUsername && pass === currentAdminPassword) {
        if(auto2h) {
            localStorage.setItem('admin1_logged_in', 'true');
            localStorage.setItem('admin_login_expiry', Date.now() + (2 * 60 * 60 * 1000));
        } else {
            sessionStorage.setItem('admin_temp_logged_in', 'true');
        }
        
        registerAdminSession();
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('login-screen').style.display = 'none';
        
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        
        // SHOW CONGRATULATIONS SCREEN
        const congratsScreen = document.getElementById('congrats-overlay');
        if(congratsScreen) {
            congratsScreen.classList.remove('hidden');
            document.getElementById('congrats-username').innerText = user;
            document.getElementById('congrats-password').innerText = pass;
            startFlowerAnimation();
        } else {
            initAdminApp();
        }
        
        triggerToast('Login Successful!');
    } else {
        triggerToast('Invalid username or password', 'error');
    }
}

function startFlowerAnimation() {
    const style = document.createElement('style');
    style.innerHTML = `@keyframes fallFlower { 0% { transform: translateY(-50px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } }`;
    document.head.appendChild(style);
    
    const container = document.getElementById('flower-container');
    if(!container) return;
    container.innerHTML = '';
    const emojis = ['🌸','🌺','🌼','🌻','🌷','🎊','✨'];
    for(let i=0; i<40; i++) {
        let fl = document.createElement('div');
        fl.innerHTML = emojis[Math.floor(Math.random()*emojis.length)];
        fl.style.position = 'absolute';
        fl.style.left = Math.random() * 100 + '%';
        fl.style.top = '-50px';
        fl.style.fontSize = (Math.random() * 20 + 15) + 'px';
        fl.style.animation = `fallFlower ${Math.random() * 3 + 2}s linear infinite`;
        fl.style.animationDelay = `${Math.random() * 2}s`;
        container.appendChild(fl);
    }
}

function closeCongrats() {
    document.getElementById('congrats-overlay').classList.add('hidden');
    initAdminApp();
}

function takeCongratsScreenshot() {
    const card = document.getElementById('congrats-card');
    html2canvas(card, { backgroundColor: '#0f172a' }).then(canvas => {
        let link = document.createElement('a');
        link.download = 'PrimeHorizon-Admin-Credentials.png';
        link.href = canvas.toDataURL();
        link.click();
        triggerToast('Screenshot saved successfully!');
    });
}

function toggleLoginPassword() {
    const input = document.getElementById('login-password');
    const icon = document.getElementById('login-eye-icon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function forceLocalLogout(reload = true) {
    db.ref('admin_sessions/' + currentSessionId).remove();
    localStorage.removeItem('admin1_logged_in');
    localStorage.removeItem('admin_login_expiry');
    sessionStorage.removeItem('admin_temp_logged_in');
    
    if(reload) window.location.reload();
    else {
        const loginScreen = document.getElementById('login-screen');
        if(loginScreen) {
            loginScreen.style.display = 'flex';
            loginScreen.classList.remove('hidden');
        }
    }
}

function logoutAdmin() {
    if (confirm("Are you sure you want to logout?")) forceLocalLogout(true);
}

function initAdminApp() {
    showSection('dashboard');
    loadDashboardStats();
    listenAdmin2SystemLock();
    startSlimTickerTracker();
    fetchLiveTemperature();
    
    // Load Settings
    db.ref('admin_settings').once('value', s => {
        if (s.exists()) {
            const data = s.val();
            if(data.min_withdraw) document.getElementById('min-withdraw').value = data.min_withdraw;
            if(data.coins_per_rupee) document.getElementById('coins-per-rupee').value = data.coins_per_rupee;
            if(data.dollar_rate) {
                document.getElementById('dollar-rate').value = data.dollar_rate;
                currentDollarRate = data.dollar_rate;
            }
        }
    });
    
    db.ref('admin_settings/deposit_gateway').once('value', s => {
        if (s.exists()) {
            const data = s.val();
            if(data.JazzCash) { document.getElementById('dep-jazz-title').value = data.JazzCash.title || ''; document.getElementById('dep-jazz-acc').value = data.JazzCash.account || ''; }
            if(data.EasyPaisa) { document.getElementById('dep-easy-title').value = data.EasyPaisa.title || ''; document.getElementById('dep-easy-acc').value = data.EasyPaisa.account || ''; }
            if(data.CustomBank) { document.getElementById('dep-bank-title').value = data.CustomBank.title || ''; document.getElementById('dep-bank-acc').value = data.CustomBank.account || ''; }
            if(data.Binance) { document.getElementById('dep-binance-name').value = data.Binance.title || ''; document.getElementById('dep-binance-uid').value = data.Binance.uid || ''; }
        }
    });
    
    db.ref('admin_settings/about_us').once('value', s => {
        if (s.exists()) {
            const data = s.val();
            document.getElementById('about-us-text').value = data.text || '';
            if (data.image) {
                aboutUploadedImageUrl = data.image;
                document.getElementById('about-image-preview-img').src = data.image;
                document.getElementById('about-image-preview').classList.remove('hidden');
            }
        }
    });

    loadFeaturesVideosIntoAdmin();
}

// Live Weather
async function fetchLiveTemperature() {
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=31.558&longitude=74.3507&current_weather=true');
        const data = await res.json();
        if(data && data.current_weather) {
            document.getElementById('dash-live-temp').innerHTML = `${data.current_weather.temperature}°C <i class="fa-solid fa-temperature-three-quarters text-2xl"></i>`;
        }
    } catch(e) { console.log('Weather fetch failed', e); }
}


// ==================== MULTIPLE FEATURES VIDEOS SETUP ====================
let adminVideosList = [];

function loadFeaturesVideosIntoAdmin() {
    db.ref('admin_settings/features_video').once('value', snap => {
        adminVideosList = [];
        const container = document.getElementById('dynamic-videos-container');
        container.innerHTML = '';
        
        if (snap.exists()) {
            const data = snap.val();
            if (data.url || data.link) {
                adminVideosList.push({ id: generateUniqueId(), link: data.link || data.url, title: data.title || '', description: data.description || '' });
            } else {
                Object.values(data).forEach(item => {
                    if (item && (item.url || item.link)) {
                        adminVideosList.push({ id: generateUniqueId(), link: item.url || item.link, title: item.title || '', description: item.description || '' });
                    }
                });
            }
        }
        
        if (adminVideosList.length === 0) {
            addNewVideoField();
        } else {
            adminVideosList.forEach(vid => renderVideoFieldHTML(vid));
            updateAdminVideoPreview(adminVideosList[0].link);
        }
    });
}

function generateUniqueId() {
    return 'VID_' + Math.random().toString(36).substr(2, 9);
}

function addNewVideoField() {
    const newVid = { id: generateUniqueId(), link: '', title: '', description: '' };
    adminVideosList.push(newVid);
    renderVideoFieldHTML(newVid);
}

function renderVideoFieldHTML(videoObj) {
    const container = document.getElementById('dynamic-videos-container');
    
    const box = document.createElement('div');
    box.id = `video-box-${videoObj.id}`;
    box.className = "bg-slate-800 p-4 rounded-2xl border border-slate-700 relative";
    
    const removeBtn = document.createElement('button');
    removeBtn.className = "absolute top-3 right-3 w-8 h-8 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg flex items-center justify-center transition-colors";
    removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    removeBtn.onclick = () => removeVideoField(videoObj.id);
    
    box.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10">
            <div>
                <label class="text-[10px] font-bold text-slate-400 block mb-1">VIDEO LINK / URL</label>
                <input type="text" id="vid-link-${videoObj.id}" value="${videoObj.link}" oninput="updateAdminVideoPreview(this.value)" placeholder="https://youtu.be/..." class="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-red-500 rounded-xl text-xs outline-none">
            </div>
            <div>
                <label class="text-[10px] font-bold text-slate-400 block mb-1">VIDEO TITLE (TAB NAME)</label>
                <input type="text" id="vid-title-${videoObj.id}" value="${videoObj.title}" placeholder="e.g. Deposit Tutorial" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-red-500 rounded-xl text-xs outline-none">
            </div>
            <div class="md:col-span-2">
                <label class="text-[10px] font-bold text-slate-400 block mb-1">DESCRIPTION</label>
                <input type="text" id="vid-desc-${videoObj.id}" value="${videoObj.description}" placeholder="Short description about this video..." class="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-red-500 rounded-xl text-xs outline-none">
            </div>
        </div>
    `;
    
    box.appendChild(removeBtn);
    container.appendChild(box);
}

function removeVideoField(id) {
    if (adminVideosList.length <= 1) {
        return triggerToast("You must have at least one video box. Leave it empty if you don't want any video.", "error");
    }
    
    adminVideosList = adminVideosList.filter(v => v.id !== id);
    document.getElementById(`video-box-${id}`).remove();
    triggerToast("Video removed from list");
}

function updateAdminVideoPreview(url) {
    const container = document.getElementById('video-preview-container');
    if(!url) {
        container.innerHTML = '<span class="text-slate-500 text-xs relative z-10">Video preview will appear here</span>';
        return;
    }
    
    const vidId = extractYouTubeID(url);
    if(vidId) {
        container.innerHTML = `<iframe class="absolute inset-0 w-full h-full" src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen></iframe>`;
    } else if (url.includes('embed')) {
        container.innerHTML = `<iframe class="absolute inset-0 w-full h-full" src="${url}" frameborder="0" allowfullscreen></iframe>`;
    } else {
        container.innerHTML = `<span class="text-red-400 text-xs font-bold relative z-10"><i class="fa-solid fa-link-slash"></i> Invalid Link Format</span>`;
    }
}

function saveAllFeaturesVideos() {
    let finalDataToSave = [];
    
    adminVideosList.forEach(vidObj => {
        const link = document.getElementById(`vid-link-${vidObj.id}`).value.trim();
        const title = document.getElementById(`vid-title-${vidObj.id}`).value.trim();
        const desc = document.getElementById(`vid-desc-${vidObj.id}`).value.trim();
        
        if (link) {
            finalDataToSave.push({
                url: link,
                title: title || "Video",
                description: desc
            });
        }
    });

    if (finalDataToSave.length === 0) {
        db.ref('admin_settings/features_video').remove();
        triggerToast("All videos removed successfully", "success");
    } else {
        db.ref('admin_settings/features_video').set(finalDataToSave);
        triggerToast(`${finalDataToSave.length} Videos Saved Successfully!`, "success");
    }
}

function extractYouTubeID(url) {
    let videoID = '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) { videoID = match[2]; }
    return videoID;
}

// ==================== SESSIONS & CREDENTIALS MANAGMENT ====================
function registerAdminSession() {
    const ua = navigator.userAgent;
    let browser = "Desktop PC";
    if(ua.includes('Chrome')) browser = "Google Chrome";
    else if(ua.includes('Safari')) browser = "Safari Browser";
    if(ua.includes('Firefox')) browser = "Mozilla Firefox";
    if(ua.includes('Mobile')) browser = "Mobile Phone";

    db.ref('admin_sessions/' + currentSessionId).set({
        id: currentSessionId,
        browser: browser,
        loginTime: Date.now(),
        userAgent: ua
    });
}

function loadAdminSessions() {
    const container = document.getElementById('session-devices-list');
    const countEl = document.getElementById('session-total-count');
    
    db.ref('admin_sessions').on('value', snap => {
        if(container) container.innerHTML = '';
        let count = 0;
        if(snap.exists()) {
            snap.forEach(child => {
                count++;
                const s = child.val();
                const isCurrent = (s.id === currentSessionId);
                
                if(container) {
                    const div = document.createElement('div');
                    div.className = `p-4 rounded-2xl border ${isCurrent ? 'bg-emerald-900/10 border-emerald-500/30 session-device-card current-session' : 'bg-slate-900 border-slate-700/50 session-device-card'} flex justify-between items-center`;
                    
                    let rightAction = isCurrent 
                        ? `<span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-bold">Active Now</span>` 
                        : `<button onclick="logoutOtherSession('${s.id}')" class="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs font-bold transition-colors">Logout Device</button>`;
                        
                    div.innerHTML = `
                        <div>
                            <div class="font-bold ${isCurrent ? 'text-emerald-400' : 'text-slate-300'} flex items-center gap-2">
                                <i class="fa-solid ${isCurrent ? 'fa-desktop' : 'fa-mobile-screen'}"></i> 
                                ${s.browser || 'Unknown Device'}
                            </div>
                            <div class="text-[10px] text-slate-500 mt-1">Logged in: ${new Date(s.loginTime).toLocaleString()}</div>
                        </div>
                        <div>${rightAction}</div>
                    `;
                    container.appendChild(div);
                }
            });
        }
        if(countEl) countEl.innerText = count;
        updateBadge('badge-sessions', count > 1 ? count : 0);
    });
}

function logoutOtherSession(id) {
    if(confirm('Log out this device remotely?')) {
        db.ref('admin_sessions/' + id).remove();
        triggerToast('Device logged out successfully');
    }
}

function updateAdminCredentials() {
    const newUser = document.getElementById('session-new-username').value.trim();
    const newPass = document.getElementById('session-new-password').value.trim();
    
    if(!newUser || !newPass) return triggerToast('Please fill both Username and Password fields', 'error');
    if(newPass.length < 5) return triggerToast('Password must be at least 5 characters', 'error');
    
    if(confirm("Are you sure you want to change Admin credentials? This will apply to all logins.")) {
        db.ref('admin_settings/credentials').update({ username: newUser, password: newPass });
        document.getElementById('session-new-username').value = '';
        document.getElementById('session-new-password').value = '';
        triggerToast('Credentials updated successfully!');
    }
}

// ==================== SYSTEM LOCK ====================
let systemLockListener = null;
let systemScreenshotFile = null;

function listenAdmin2SystemLock() {
    if (systemLockListener) systemLockListener.off();
    systemLockListener = db.ref('admin2_status').on('value', snap => {
        const data = snap.exists() ? snap.val() : { isOffline: false };
        const isLocked = data.isOffline === true;
        const lockScreen = document.getElementById('system-lock-screen');
        if (isLocked && lockScreen) {
            lockScreen.classList.remove('hidden');
            lockScreen.style.display = 'block';
            document.getElementById('system-lock-bill-amount').innerText = 'Rs. ' + (data.billAmount || 10000);
            document.querySelector('.flex.h-screen').style.display = 'none';
        } else if (lockScreen) {
            lockScreen.style.display = 'none';
            lockScreen.classList.add('hidden');
            document.querySelector('.flex.h-screen').style.display = 'flex';
        }
    });
}

function handleSystemScreenshot(e) {
    systemScreenshotFile = e.target.files[0];
    if (systemScreenshotFile) {
        const reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('system-screenshot-img').src = ev.target.result;
            document.getElementById('system-screenshot-preview').classList.remove('hidden');
        };
        reader.readAsDataURL(systemScreenshotFile);
    }
}

async function submitSystemBillPayment() {
    const trxId = document.getElementById('system-trx-id').value.trim();
    if (!trxId) return triggerToast('Please enter TRX ID', 'error');
    
    let screenshotUrl = '';
    if (systemScreenshotFile) {
        const formData = new FormData(); formData.append('file', systemScreenshotFile); formData.append('upload_preset', CLOUDINARY_PRESET);
        try {
            const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
            const data = await res.json();
            screenshotUrl = data.secure_url || '';
        } catch (e) { return triggerToast('Screenshot upload failed', 'error'); }
    }
    
    const statusSnap = await db.ref('admin2_status').once('value');
    const billAmount = statusSnap.exists() ? (statusSnap.val().billAmount || 10000) : 10000;
    
    const paymentRef = db.ref('admin2_billing/payments').push();
    await paymentRef.set({ amount: billAmount, trxId: trxId, screenshotUrl: screenshotUrl, submittedAt: Date.now(), status: 'Pending', type: 'system_lock', timerCompleted: false });
    triggerToast('Payment submitted! Waiting for Admin approval...');
    
    let seconds = 30;
    const timerDiv = document.createElement('div');
    timerDiv.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 glass px-8 py-3 rounded-2xl border border-emerald-500/30 flex items-center gap-3 z-[999]';
    timerDiv.innerHTML = `<i class="fa-solid fa-clock text-emerald-400"></i><span class="font-bold">Processing payment... <span id="sys-timer-seconds" class="font-mono text-xl">${seconds}</span>s</span>`;
    document.body.appendChild(timerDiv);
    
    const interval = setInterval(async () => {
        seconds--;
        if (document.getElementById('sys-timer-seconds')) document.getElementById('sys-timer-seconds').innerText = seconds;
        if (seconds <= 0) {
            clearInterval(interval);
            timerDiv.remove();
            await db.ref('admin2_billing/payments/' + paymentRef.key).update({ timerCompleted: true });
            triggerToast('Timer done. Please wait for approval.');
        }
    }, 1000);
}

// ==================== NAVIGATION & UI ====================
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('section-' + section);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('[id^="nav-"]').forEach(nav => nav.classList.remove('nav-active'));
    const navEl = document.getElementById('nav-' + section);
    if (navEl) navEl.classList.add('nav-active');
    
    const title = document.getElementById('section-title');
    if (title) {
        const titles = { 'sessions': 'Session Phone', 'old-history': 'All Old History', 'kyc': 'KYC Approvals', 'doubleauth': 'Double Verification', 'password': 'Password Recovery', 'active-verified': 'Verified & Active Nodes', 'global-logs': 'Global System Logs' };
        title.innerText = titles[section] || (section.charAt(0).toUpperCase() + section.slice(1));
    }
    
    if (section === 'sessions') loadAdminSessions();
    if (section === 'users') loadUsersAdvanced();
    if (section === 'old-history') loadOldHistory('all');
    if (section === 'active-verified') loadActiveVerified();
    if (section === 'kyc') loadKYCRequests();
    if (section === 'doubleauth') loadDoubleAuthRequests();
    if (section === 'password') loadPasswordRequests();
    if (section === 'deposits') loadDepositsAdvanced();
    if (section === 'withdrawals') loadWithdrawalsAdvanced();
    if (section === 'plans') loadPlans();
    if (section === 'tasks') loadTasks();
    if (section === 'social') loadSocialChannels();
    if (section === 'support') loadSupportChannels();
    if (section === 'feedback') loadFeedbackAndAppeals();
    if (section === 'complaints') loadComplaints();
    if (section === 'history') {
        const container = document.getElementById('history-results-container');
        if (container && !container.dataset.searched) { showEmptyState(container, "Search above to view user's activity history", 'fa-clock-rotate-left'); }
    }
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden'); overlay.classList.add('block');
    } else { closeMobileSidebar(); }
}

function closeMobileSidebar() {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    const overlay = document.getElementById('mobile-overlay');
    overlay.classList.remove('block'); overlay.classList.add('hidden');
}

function triggerToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `px-6 py-4 rounded-2xl shadow-2xl text-sm mb-2 flex items-center gap-3 max-w-xs ${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-lg"></i><span class="font-medium">${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function updateBadge(id, count) {
    const badge = document.getElementById(id);
    if(badge) {
        if(count > 0) { badge.innerText = count; badge.classList.remove('hidden'); } 
        else { badge.classList.add('hidden'); }
    }
}

function showSkeletonLoader(container, type = 'user') {
    container.innerHTML = '';
    for (let i = 0; i < (type === 'user' ? 4 : 3); i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'glass rounded-3xl p-5 skeleton mb-3';
        skeleton.innerHTML = type === 'user' ? `<div class="flex items-center gap-4"><div class="w-12 h-12 bg-slate-700 rounded-2xl"></div><div class="space-y-2"><div class="h-4 bg-slate-700 rounded w-28"></div><div class="h-3 bg-slate-700 rounded w-20"></div></div></div>` : `<div class="h-4 bg-slate-700 rounded w-2/3 mb-2"></div><div class="h-3 bg-slate-700 rounded w-1/2"></div>`;
        container.appendChild(skeleton);
    }
}

function showEmptyState(container, message, icon = 'fa-inbox') {
    container.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-center"><div class="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4"><i class="fa-solid ${icon} text-3xl text-slate-500"></i></div><p class="text-slate-400 font-medium">${message}</p></div>`;
}

// ==================== DASHBOARD & SLIM TICKER ====================
function startSlimTickerTracker() {
    setInterval(() => {
        let tickerHtml = [];
        if(qCounts.dep > 0) tickerHtml.push(`<span class="text-emerald-400"><i class="fa-solid fa-upload"></i> ${qCounts.dep} Pending Deposits</span>`);
        if(qCounts.wit > 0) tickerHtml.push(`<span class="text-purple-400"><i class="fa-solid fa-clock"></i> ${qCounts.wit} Pending Withdrawals</span>`);
        if(qCounts.kyc > 0) tickerHtml.push(`<span class="text-amber-400"><i class="fa-solid fa-id-card-clip"></i> ${qCounts.kyc} Pending KYC</span>`);
        if(qCounts.da > 0) tickerHtml.push(`<span class="text-indigo-400"><i class="fa-solid fa-camera-rotate"></i> ${qCounts.da} Pending Verifications</span>`);
        if(qCounts.pwd > 0) tickerHtml.push(`<span class="text-rose-400"><i class="fa-solid fa-unlock-keyhole"></i> ${qCounts.pwd} Password Requests</span>`);
        if(qCounts.cmp > 0) tickerHtml.push(`<span class="text-orange-400"><i class="fa-solid fa-exclamation-triangle"></i> ${qCounts.cmp} Complaints</span>`);

        const ticker = document.getElementById('slim-ticker-content');
        if(ticker) {
            if(tickerHtml.length > 0) ticker.innerHTML = tickerHtml.join(' &nbsp; • &nbsp; ');
            else ticker.innerHTML = '<span class="text-slate-500">All queues are clear. Ecosystem is stable.</span>';
        }
    }, 4000); 
}

function loadDashboardStats() {
    db.ref('users').on('value', snap => {
        let total = 0, balance = 0;
        if (snap.exists()) {
            snap.forEach(child => {
                total++;
                balance += Number(child.val().balance || 0);
            });
        }
        document.getElementById('dash-total-users').innerText = total;
        document.getElementById('dash-total-balance').innerText = 'Rs. ' + balance.toFixed(0);
        document.getElementById('live-users-count').innerText = total;
    });

    db.ref('admin_queues/deposits').on('value', snap => {
        let totalDep = 0;
        if (snap.exists()) snap.forEach(c => { if (c.val().status === 'Approved') totalDep += Number(c.val().amount || 0); });
        document.getElementById('dash-total-deposits').innerText = 'Rs. ' + totalDep.toFixed(0);
    });
    
    db.ref('admin_queues/withdrawals').on('value', snap => {
        let totalW = 0;
        if (snap.exists()) snap.forEach(c => { if (c.val().status === 'Approved') totalW += Number(c.val().totalDeducted || c.val().amount || 0); });
        document.getElementById('dash-total-withdrawals').innerText = 'Rs. ' + totalW.toFixed(0);
    });
    
    db.ref('admin_queues/complaints').on('value', snap => { document.getElementById('dash-total-complaints').innerText = snap.exists() ? snap.numChildren() : 0; });
    db.ref('admin_feedbacks').on('value', snap => {
        let count = 0;
        if (snap.exists()) snap.forEach(u => { count += u.numChildren(); });
        document.getElementById('dash-total-feedbacks').innerText = count;
    });
    db.ref('admin_queues/appeals').on('value', snap => { document.getElementById('dash-total-appeals').innerText = snap.exists() ? snap.numChildren() : 0; });
}

// ==================== USERS DIRECTORY ====================
function loadUsersAdvanced() {
    const container = document.getElementById('users-directory-feed');
    showSkeletonLoader(container, 'user');
    
    db.ref('users').on('value', snapshot => {
        container.innerHTML = '';
        if (!snapshot.exists()) return showEmptyState(container, 'No users found', 'fa-users');
        
        window.allUsersData = []; 
        
        snapshot.forEach(child => {
            const user = child.val();
            const phone = child.key;
            user.phoneKey = phone; 
            window.allUsersData.push(user);
        });
        
        // Render after all are loaded so RefBy logic can access all users
        window.allUsersData.forEach(user => {
            renderUserCard(user, container);
        });
    });
}

function filterUsersDirectory() {
    const query = document.getElementById('users-search-input').value.toLowerCase();
    const container = document.getElementById('users-directory-feed');
    container.innerHTML = '';
    
    if(!window.allUsersData) return;
    
    const filtered = window.allUsersData.filter(u => {
        return (u.phoneKey && u.phoneKey.toLowerCase().includes(query)) ||
               (u.username && u.username.toLowerCase().includes(query)) ||
               (u.email && u.email.toLowerCase().includes(query));
    });
    
    if(filtered.length === 0) {
        showEmptyState(container, 'No user matches your search', 'fa-search');
        return;
    }
    
    filtered.forEach(user => renderUserCard(user, container));
}

function renderUserCard(user, container) {
    const phone = user.phoneKey;
    const coins = parseInt(user.coinsCommission || user.coins || 0);
    const balance = Number(user.balance || 0);
    const baseLimit = parseInt(user.withdrawalLimit) || 1000;
    const freeWithdraws = user.freeWithdraws !== undefined ? user.freeWithdraws : 1; 
    
    let validRefs = 0;
    let invitedListHtml = '';
    if (user.referrals) {
        Object.values(user.referrals).forEach(r => {
            if (r.isDeposited || r.depositCommissionPaid) validRefs++;
            invitedListHtml += `<div class="flex justify-between items-center bg-slate-900 p-2 rounded-lg mb-1 border border-slate-800"><span class="font-bold text-xs">${r.username}</span><span class="text-[10px] text-slate-500">${r.email || 'No email'}</span></div>`;
        });
    }
    if(invitedListHtml === '') invitedListHtml = '<div class="text-xs text-slate-500 italic">No invited users yet.</div>';
    
    let tier = Math.floor(validRefs / 10) + 1;
    if(tier > 10) tier = 10;
    
    let kycDate = user.kycDetails && user.kycDetails.submittedAt ? new Date(user.kycDetails.submittedAt).toLocaleDateString() : 'Not Set';
    let pinDate = user.withdrawPin ? 'Set' : 'Not Set';
    let daStatus = user.doubleAuthEnabled ? '<span class="text-emerald-400">ON</span>' : '<span class="text-red-400">OFF</span>';

    // ADDED: Ref By details logic
    let refByHtml = '';
    if (user.referredByPhone && user.referredByPhone !== "NONE") {
        let referrer = (window.allUsersData || []).find(u => u.phoneKey === user.referredByPhone || u.phone === user.referredByPhone || u.myRefCode === user.referredByPhone);
        if (referrer) {
            refByHtml = `<div class="invite-by-tag mt-1.5 inline-block"><i class="fa-solid fa-link"></i> Invited By: <b>${referrer.username || 'User'}</b> (${referrer.email || referrer.gmail || 'No email'})</div>`;
        } else {
            refByHtml = `<div class="invite-by-tag mt-1.5 inline-block"><i class="fa-solid fa-link"></i> Invited By: ${user.referredByPhone}</div>`;
        }
    }

    const card = document.createElement('div');
    card.className = `glass rounded-3xl p-5 user-card border border-slate-700/60`;
    
    card.innerHTML = `
        <div class="flex items-center justify-between cursor-pointer" onclick="toggleUserDetails('${phone}')">
            <div class="flex items-center gap-4">
                <img src="${user.avatarUrl || 'https://i.pravatar.cc/48'}" class="w-12 h-12 rounded-2xl object-cover border border-slate-600" alt="">
                <div>
                    <div class="font-extrabold text-lg">${user.username || 'No Name'}</div>
                    <div class="text-emerald-400 font-mono text-sm">${phone} <span class="text-xs text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md inline-block ml-1">Level ${tier}</span></div>
                    ${refByHtml}
                </div>
            </div>
            <div class="text-right">
                <div class="font-extrabold text-xl">Rs. ${balance.toFixed(0)}</div>
                <div class="text-indigo-400 text-sm font-semibold">${coins} 🪙</div>
            </div>
        </div>
        
        <div id="user-details-${phone}" class="hidden mt-6 pt-5 border-t border-slate-700">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div class="space-y-3">
                    <div>
                        <label class="text-xs font-bold text-slate-400 tracking-wider">BALANCE (Rs)</label>
                        <div class="flex gap-2 mt-1.5">
                            <input type="number" id="bal-input-${phone}" value="${balance}" class="flex-1 bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-sm outline-none">
                            <button onclick="adjustBalance('${phone}', 'credit')" class="px-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-extrabold text-lg">+</button>
                            <button onclick="adjustBalance('${phone}', 'debit')" class="px-4 bg-red-600 hover:bg-red-500 rounded-2xl font-extrabold text-lg">-</button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 tracking-wider">COINS</label>
                        <div class="flex gap-2 mt-1.5">
                            <input type="number" id="coins-input-${phone}" value="${coins}" class="flex-1 bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-2xl px-4 py-2.5 text-sm outline-none">
                            <button onclick="adjustCoins('${phone}', 'credit')" class="px-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-extrabold text-lg">+</button>
                            <button onclick="adjustCoins('${phone}', 'debit')" class="px-4 bg-indigo-800 hover:bg-indigo-700 rounded-2xl font-extrabold text-lg">-</button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 tracking-wider">REFERENCE ID</label>
                        <div class="flex gap-2 mt-1.5">
                            <input type="text" id="ref-input-${phone}" value="${user.myRefCode || ''}" class="flex-1 bg-slate-800 border border-slate-700 focus:border-fuchsia-500 rounded-2xl px-4 py-2.5 text-sm outline-none font-mono text-fuchsia-400">
                            <button onclick="updateUserRef('${phone}')" class="px-4 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-2xl text-xs font-extrabold">Save</button>
                        </div>
                    </div>
                </div>
                
                <div class="space-y-3">
                    <div>
                        <label class="text-xs font-bold text-slate-400 tracking-wider">WARNING MESSAGE</label>
                        <div class="flex gap-2 mt-1.5">
                            <input type="text" id="warning-input-${phone}" value="${user.customProfileWarningText || user.warningMessage || ''}" placeholder="Enter warning..." class="flex-1 bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-2xl px-4 py-2.5 text-sm outline-none">
                            <button onclick="setWarning('${phone}')" class="px-5 bg-amber-600 hover:bg-amber-500 rounded-2xl text-xs font-extrabold">SET</button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 tracking-wider">FREE WITHDRAWS & LIMIT</label>
                        <div class="flex gap-2 mt-1.5">
                            <input type="number" id="free-wd-input-${phone}" value="${freeWithdraws}" title="Free Withdraws count" placeholder="Free" class="w-16 bg-slate-800 border border-slate-700 focus:border-cyan-500 rounded-2xl px-2 py-2.5 text-center text-sm outline-none">
                            <input type="number" id="limit-input-${phone}" value="${baseLimit}" title="Withdraw Limit (Rs)" class="flex-1 bg-slate-800 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-2.5 text-sm outline-none">
                            <button onclick="saveUserWithdrawSettings('${phone}')" class="px-4 bg-cyan-600 hover:bg-cyan-500 rounded-2xl text-xs font-extrabold">Save</button>
                        </div>
                        <div class="flex gap-2 mt-2">
                            <button onclick="toggleWithdrawLock('${phone}', false)" class="flex-1 py-2 text-[10px] bg-emerald-600 hover:bg-emerald-500 rounded-xl font-extrabold">Unlock W.D</button>
                            <button onclick="toggleWithdrawLock('${phone}', true)" class="flex-1 py-2 text-[10px] bg-red-600 hover:bg-red-500 rounded-xl font-extrabold">Lock W.D</button>
                        </div>
                    </div>
                </div>
                
                <div class="flex flex-col gap-2.5 justify-end">
                    <div class="flex gap-2">
                        <button onclick="verifyUser('${phone}')" class="flex-1 py-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-extrabold">VERIFY</button>
                        <button onclick="suspendUser('${phone}', '${user.verificationStatus || ''}')" class="flex-1 py-2.5 text-xs ${user.verificationStatus === 'suspended' ? 'bg-emerald-600' : 'bg-red-600'} rounded-2xl font-extrabold">
                            ${user.verificationStatus === 'suspended' ? 'UNSUSPEND' : 'SUSPEND'}
                        </button>
                    </div>
                    <button onclick="forceLogoutUser('${phone}')" class="py-2.5 text-xs bg-orange-600 hover:bg-orange-500 rounded-2xl font-extrabold text-white"><i class="fa-solid fa-power-off"></i> FORCE LOGOUT DEVICE</button>
                    <button onclick="deleteUser('${phone}')" class="py-2.5 text-xs bg-red-900 hover:bg-red-800 rounded-2xl font-extrabold text-white">DELETE ACCOUNT</button>
                    <button onclick="downloadUserPDF('${phone}')" class="py-2.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-2xl font-extrabold flex items-center justify-center gap-2">
                        <i class="fa-solid fa-file-pdf text-red-400"></i> DOWNLOAD PDF REPORT
                    </button>
                </div>
            </div>

            <!-- New Details Panel -->
            <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-700 pt-4">
                <div class="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                    <h5 class="text-xs font-bold text-slate-400 mb-2 border-b border-slate-700 pb-2">SECURITY & LOGS</h5>
                    <div class="space-y-1.5 text-xs">
                        <div class="flex justify-between"><span>KYC Date:</span> <span class="font-bold text-white">${kycDate}</span></div>
                        <div class="flex justify-between"><span>Withdraw PIN:</span> <span class="font-bold text-white">${pinDate}</span></div>
                        <div class="flex justify-between"><span>Double Auth:</span> <span class="font-bold">${daStatus}</span></div>
                        <div class="flex justify-between"><span>Total Invites:</span> <span class="font-bold text-cyan-400">${validRefs}</span></div>
                    </div>
                </div>
                <div class="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                    <h5 class="text-xs font-bold text-slate-400 mb-2 border-b border-slate-700 pb-2">INVITED FRIENDS LIST</h5>
                    <div class="max-h-24 overflow-y-auto custom-scroll pr-1">
                        ${invitedListHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(card);
}

function toggleUserDetails(phone) {
    const el = document.getElementById('user-details-' + phone);
    if (el) el.classList.toggle('hidden');
}

function adjustBalance(phone, type) {
    const input = document.getElementById('bal-input-' + phone);
    const value = parseFloat(input.value) || 0;
    if (!value) return triggerToast('Please enter a valid amount', 'error');
    db.ref('users/' + phone).transaction(u => {
        if (u) {
            if (type === 'credit') u.balance = Number(u.balance || 0) + value;
            else u.balance = Math.max(0, Number(u.balance || 0) - value);
        }
        return u;
    });
    triggerToast('Balance updated');
}

function adjustCoins(phone, type) {
    const input = document.getElementById('coins-input-' + phone);
    const value = parseInt(input.value) || 0;
    if (!value) return triggerToast('Please enter a valid amount', 'error');
    db.ref('users/' + phone).transaction(u => {
        if (u) {
            if (type === 'credit') u.coinsCommission = Number(u.coinsCommission || u.coins || 0) + value;
            else u.coinsCommission = Math.max(0, Number(u.coinsCommission || u.coins || 0) - value);
        }
        return u;
    });
    triggerToast('Coins updated');
}

function updateUserRef(phone) {
    const newRef = document.getElementById('ref-input-' + phone).value.trim();
    if(!newRef) return triggerToast('Reference ID cannot be empty', 'error');
    db.ref('users/' + phone).update({ myRefCode: newRef.toUpperCase() });
    triggerToast('Reference ID updated');
}

function setWarning(phone) {
    const input = document.getElementById('warning-input-' + phone);
    db.ref('users/' + phone).update({ customProfileWarningText: input.value.trim() });
    triggerToast('Warning message updated');
}

function saveUserWithdrawSettings(phone) {
    const limit = parseInt(document.getElementById('limit-input-' + phone).value) || 0;
    const freeWd = parseInt(document.getElementById('free-wd-input-' + phone).value) || 0;
    const isLocked = freeWd === 0;

    db.ref('users/' + phone).update({ 
        withdrawalLimit: limit,
        freeWithdraws: freeWd,
        withdrawalAccountLocked: isLocked
    });
    
    if(isLocked) {
        triggerToast('Limit saved & Withdrawals LOCKED (0 free)', 'error');
    } else {
        triggerToast(`Saved! Limit: Rs.${limit} | Free: ${freeWd}`);
    }
}

function toggleWithdrawLock(phone, lock) {
    if (lock) {
        db.ref('users/' + phone).update({ freeWithdraws: 0, withdrawalLimit: 0, withdrawalAccountLocked: true });
        triggerToast('User withdrawals have been LOCKED', 'error');
    } else {
        db.ref('users/' + phone).update({ freeWithdraws: 1, withdrawalLimit: 1000, withdrawalAccountLocked: false });
        triggerToast('User withdrawals UNLOCKED');
    }
}

function verifyUser(phone) {
    db.ref('users/' + phone).update({ verificationStatus: 'verified', kycStatus: 'verified' });
    triggerToast('User verified successfully');
}

function suspendUser(phone, current) {
    const newStatus = current === 'suspended' ? 'verified' : 'suspended';
    db.ref('users/' + phone).update({ verificationStatus: newStatus });
    triggerToast(newStatus === 'suspended' ? 'User has been suspended' : 'User has been unsuspended');
}

function forceLogoutUser(phone) {
    if(!confirm('Force this user to logout from their device?')) return;
    db.ref('users/' + phone).update({ forceLogout: true });
    triggerToast('Logout command sent to user device');
}

function deleteUser(phone) {
    if (!confirm('Are you sure you want to permanently delete this user?')) return;
    db.ref('users/' + phone).remove();
    triggerToast('User deleted permanently', 'error');
}

function showAddUserModal() {
    const username = prompt("Enter Username:"); if (!username) return;
    const phone = prompt("Enter Phone Number:"); if (!phone) return;
    const email = prompt("Enter Email (optional):") || '';
    const password = prompt("Set Password (default: 123456):") || '123456';
    const cleanPhone = phone.replace(/\D/g, '');
    db.ref('users/' + cleanPhone).set({ username: username, phone: cleanPhone, email: email, gmail: email, password: password, balance: 0, coinsCommission: 0, verificationStatus: 'unverified', registeredDate: new Date().toLocaleDateString() });
    triggerToast('New user created successfully');
}

// ==================== NEW: ALL OLD HISTORY ====================

async function filterOldHistory(type) {
    const buttons = document.querySelectorAll('#section-old-history button[onclick^="filterOldHistory"]');
    buttons.forEach(b => { b.classList.remove('ring-2', 'ring-white'); });
    event.currentTarget.classList.add('ring-2', 'ring-white');
    await loadOldHistory(type);
}

async function loadOldHistory(filter = 'all') {
    const container = document.getElementById('old-history-feed');
    showSkeletonLoader(container, 'list');
    
    let history = [];
    
    // 1. Deposits
    if (filter === 'all' || filter === 'deposit') {
        const dSnap = await db.ref('admin_queues/deposits').once('value');
        if(dSnap.exists()) {
            dSnap.forEach(c => {
                const d = c.val();
                history.push({
                    type: 'deposit',
                    id: c.key,
                    path: `admin_queues/deposits/${c.key}`,
                    username: d.username || 'User',
                    phone: d.userPhone || 'N/A',
                    amount: d.amount,
                    status: d.status,
                    proofUrl: d.proofUrl,
                    ts: d.timestamp || d.createdAt || 0
                });
            });
        }
    }
    
    // 2. Withdrawals
    if (filter === 'all' || filter === 'withdraw') {
        const wSnap = await db.ref('admin_queues/withdrawals').once('value');
        if(wSnap.exists()) {
            wSnap.forEach(c => {
                const w = c.val();
                history.push({
                    type: 'withdraw',
                    id: c.key,
                    path: `admin_queues/withdrawals/${c.key}`,
                    username: w.username || 'User',
                    phone: w.userPhone || 'N/A',
                    amount: w.amount || w.requestedAmount,
                    status: w.status,
                    ts: w.timestamp || w.createdAt || 0
                });
            });
        }
    }

    // 3. Complaints
    if (filter === 'all' || filter === 'complaint') {
        const sSnap = await db.ref('support_channels').once('value');
        if(sSnap.exists()) {
            sSnap.forEach(uSnap => {
                if(uSnap.child('tickets').exists()) {
                    uSnap.child('tickets').forEach(tSnap => {
                        const t = tSnap.val();
                        history.push({
                            type: 'complaint',
                            id: tSnap.key,
                            path: `support_channels/${uSnap.key}/tickets/${tSnap.key}`,
                            username: t.username || uSnap.key,
                            phone: uSnap.key,
                            message: t.description || t.message,
                            status: t.status,
                            proofUrl: t.proofUrl && t.proofUrl !== 'NONE' ? t.proofUrl : null,
                            ts: t.timestamp || 0
                        });
                    });
                }
            });
        }
    }

    // 4. Commissions (From Users' Logs)
    if (filter === 'all' || filter === 'commission') {
        const uSnap = await db.ref('users').once('value');
        if(uSnap.exists()) {
            uSnap.forEach(userNode => {
                const u = userNode.val();
                if(u.logs) {
                    Object.keys(u.logs).forEach(logId => {
                        const l = u.logs[logId];
                        if(l.type && (l.type.toLowerCase().includes('commission') || l.type.toLowerCase().includes('invite'))) {
                            history.push({
                                type: 'commission',
                                id: logId,
                                path: `users/${userNode.key}/logs/${logId}`,
                                username: u.username || 'User',
                                phone: userNode.key,
                                amount: l.amount,
                                message: l.title || l.type,
                                ts: l.timestamp || 0
                            });
                        }
                    });
                }
            });
        }
    }

    history.sort((a, b) => b.ts - a.ts);
    
    container.innerHTML = '';
    if(history.length === 0) {
        showEmptyState(container, 'No history found for this category', 'fa-folder-open');
        return;
    }

    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'glass p-5 rounded-3xl border border-slate-700/60 flex flex-col md:flex-row gap-4 justify-between items-start history-item';
        
        let badgeColor = 'slate';
        let icon = 'history';
        if(item.type==='deposit') { badgeColor = 'emerald'; icon = 'upload'; }
        if(item.type==='withdraw') { badgeColor = 'purple'; icon = 'hand-holding-dollar'; }
        if(item.type==='complaint') { badgeColor = 'orange'; icon = 'exclamation-triangle'; }
        if(item.type==='commission') { badgeColor = 'indigo'; icon = 'coins'; }
        
        let proofHtml = item.proofUrl ? `<div class="mt-3"><a href="${item.proofUrl}" target="_blank"><img src="${item.proofUrl}" class="h-20 w-20 object-cover rounded-xl border border-slate-600 shadow-md"></a></div>` : '';
        
        let detailsHtml = item.amount ? `<div class="text-2xl font-black text-${badgeColor}-400 mt-2">Rs. ${item.amount}</div>` : `<div class="text-sm text-slate-300 italic mt-2 bg-slate-900/50 p-2 rounded-xl">"${item.message}"</div>`;
        if(item.type==='commission') detailsHtml = `<div class="text-2xl font-black text-indigo-400 mt-2">${item.amount} 🪙</div><div class="text-xs text-slate-400 font-bold">${item.message}</div>`;

        div.innerHTML = `
            <div class="flex-1 w-full">
                <div class="flex items-center gap-2 mb-2">
                    <span class="px-2 py-1 text-[10px] bg-${badgeColor}-500/20 text-${badgeColor}-400 rounded-lg font-bold uppercase tracking-wider"><i class="fa-solid fa-${icon} mr-1"></i> ${item.type}</span>
                    ${item.status ? `<span class="text-[10px] text-slate-400 font-bold ml-1 border border-slate-700 px-2 py-0.5 rounded-lg">${item.status}</span>` : ''}
                </div>
                <div class="font-extrabold text-xl">${item.username}</div>
                <div class="text-sm font-mono text-cyan-400 mb-1">${item.phone}</div>
                ${detailsHtml}
                ${proofHtml}
                <div class="text-xs text-slate-500 mt-4"><i class="fa-regular fa-clock"></i> ${new Date(item.ts).toLocaleString()}</div>
            </div>
            <div class="mt-4 md:mt-0 flex-shrink-0 w-full md:w-auto text-right">
                <button onclick="deleteOldHistoryItem('${item.path}', '${item.type}')" class="delete-btn-red hover:bg-red-900 transition-colors inline-flex items-center justify-center gap-2 px-4 py-2 w-full md:w-auto">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function deleteOldHistoryItem(path, type) {
    if(confirm(`Are you sure you want to permanently delete this ${type} record?`)) {
        db.ref(path).remove().then(() => {
            triggerToast('Record deleted successfully', 'success');
            loadOldHistory('all'); // Reload to reflect changes
        }).catch(err => {
            triggerToast('Error deleting record', 'error');
        });
    }
}


// ==================== VERIFIED & ACTIVE PLANS ====================
function loadActiveVerified() {
    const container = document.getElementById('active-verified-feed');
    showSkeletonLoader(container, 'user');
    
    db.ref('users').on('value', snap => {
        container.innerHTML = '';
        if(!snap.exists()) return showEmptyState(container, 'No active/verified users found', 'fa-user-shield');
        
        let count = 0;
        snap.forEach(child => {
            const u = child.val();
            if(u.activePlan) {
                count++;
                
                let endDateStr = 'Unknown';
                if(u.activePlan.activationDate) {
                    let endMs = u.activePlan.activationDate + (u.activePlan.days * 24 * 60 * 60 * 1000);
                    endDateStr = new Date(endMs).toLocaleDateString();
                }

                let is2FA = u.doubleAuthEnabled === true;
                
                let badgeHtml = is2FA 
                    ? `<span class="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full ml-1"><i class="fa-solid fa-shield"></i> 2FA Active</span>`
                    : `<span class="text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded-full ml-1">Plan Only</span>`;
                    
                let turnOffBtn = is2FA 
                    ? `<button onclick="turnOffUser2FA('${child.key}')" class="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg text-xs font-bold transition-colors">Turn OFF 2FA</button>`
                    : ``;

                const div = document.createElement('div');
                div.className = 'glass p-5 rounded-3xl border border-emerald-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4';
                div.innerHTML = `
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-2xl ${is2FA ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-sky-500/10 border-sky-500/20'} flex items-center justify-center border">
                            <i class="fa-solid ${is2FA ? 'fa-check-double text-emerald-400' : 'fa-check text-sky-400'} text-xl"></i>
                        </div>
                        <div>
                            <div class="font-extrabold text-lg">${u.username || 'N/A'} ${badgeHtml}</div>
                            <div class="text-xs text-slate-400 font-mono mt-0.5">${child.key}</div>
                        </div>
                    </div>
                    <div class="text-left md:text-right w-full md:w-auto">
                        <div class="text-sm font-bold text-amber-400 uppercase tracking-wider">${u.activePlan.name}</div>
                        <div class="text-[10px] text-slate-400 mt-1">Cost: Rs. ${u.activePlan.cost} &nbsp;•&nbsp; Ends: <span class="text-white font-bold">${endDateStr}</span></div>
                        
                        <div class="flex gap-2 mt-3 flex-wrap justify-end w-full">
                            ${turnOffBtn}
                            <button onclick="changeUserPlan('${child.key}')" class="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600 text-amber-400 hover:text-white rounded-lg text-xs font-bold transition-colors">Change Plan</button>
                            <button onclick="deactivateUserPlan('${child.key}')" class="px-3 py-1.5 bg-red-600/30 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs font-bold transition-colors">Deactivate</button>
                        </div>
                    </div>
                `;
                container.appendChild(div);
            }
        });
        if(count === 0) showEmptyState(container, 'No user has an active plan.', 'fa-user-shield');
    });
}

function turnOffUser2FA(phone) {
    if(confirm('Turn off Double Verification for this user? They will need to verify again.')) {
        db.ref('users/' + phone).update({doubleAuthEnabled: false, verificationStatus: 'unverified'});
        triggerToast('Double Verification turned OFF');
    }
}
function deactivateUserPlan(phone) {
    if(confirm('Are you sure you want to completely deactivate their current plan?')) {
        db.ref('users/' + phone).update({activePlan: null});
        triggerToast('Plan deactivated successfully', 'error');
    }
}
function changeUserPlan(phone) {
    const pName = prompt("Enter New Plan Name (e.g. VIP 1):"); if(!pName) return;
    const pCost = prompt("Enter Plan Cost (Rs):"); if(!pCost) return;
    const pDays = prompt("Enter Plan Duration (Days):"); if(!pDays) return;
    
    const newPlan = { name: pName, cost: parseFloat(pCost), days: parseInt(pDays), activationDate: Date.now() };
    db.ref('users/' + phone).update({activePlan: newPlan});
    triggerToast('User plan updated successfully');
}


// ==================== KYC, DOUBLE AUTH, PASSWORD ====================
function loadKYCRequests() {
    const container = document.getElementById('kyc-requests-feed');
    showSkeletonLoader(container, 'list');
    db.ref('admin_queues/kyc_requests').on('value', snap => {
        container.innerHTML = '';
        let pending = 0;
        if (!snap.exists()) { showEmptyState(container, 'No pending KYC requests', 'fa-id-card-clip'); updateBadge('badge-kyc', 0); return; }
        snap.forEach(child => {
            const req = child.val();
            if (req.status !== 'pending') return;
            pending++;
            const div = document.createElement('div');
            div.className = 'glass p-5 rounded-3xl border border-amber-500/30 flex flex-col md:flex-row gap-4 justify-between items-center';
            div.innerHTML = `
                <div class="flex-1">
                    <div class="flex items-center gap-2"><h4 class="font-extrabold text-lg">${req.fullName || 'N/A'}</h4><span class="px-2 py-0.5 text-[9px] bg-amber-500/20 text-amber-400 rounded-full font-bold uppercase">Pending</span></div>
                    <div class="text-sm text-slate-400 mt-1">Username: <span class="text-white">${req.username || 'N/A'}</span> | Phone: <span class="font-mono text-emerald-400">${req.phone}</span></div>
                    <div class="text-sm text-slate-400 mt-1">Date of Birth: <span class="text-white font-mono">${req.birthday || 'N/A'}</span></div>
                    <div class="text-xs text-slate-500 mt-2">Submitted: ${new Date(req.timestamp).toLocaleString()}</div>
                </div>
                <div class="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <button onclick="db.ref('admin_queues/kyc_requests/${child.key}').update({status:'Approved'}); db.ref('users/${req.phone}').update({kycStatus:'verified'}); triggerToast('Approved');" class="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-sm font-extrabold">APPROVE</button>
                    <button onclick="db.ref('admin_queues/kyc_requests/${child.key}').update({status:'Rejected'}); db.ref('users/${req.phone}').update({kycStatus:'unverified'}); triggerToast('Rejected','error');" class="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 rounded-2xl text-sm font-extrabold">REJECT</button>
                </div>
            `;
            container.appendChild(div);
        });
        if(pending === 0) showEmptyState(container, 'No pending KYC requests', 'fa-id-card-clip');
    });
}

function loadDoubleAuthRequests() {
    const container = document.getElementById('doubleauth-requests-feed');
    showSkeletonLoader(container, 'list');
    db.ref('admin_queues/double_auth').on('value', snap => {
        container.innerHTML = '';
        let pending = 0;
        if (!snap.exists()) { showEmptyState(container, 'No pending double verification requests', 'fa-camera-rotate'); updateBadge('badge-doubleauth', 0); return; }
        snap.forEach(child => {
            const req = child.val();
            if (req.status !== 'pending') return;
            pending++;
            const div = document.createElement('div');
            div.className = 'glass p-5 rounded-3xl border border-indigo-500/30 flex flex-col md:flex-row gap-4 justify-between items-center';
            div.innerHTML = `
                <div class="flex-1">
                    <div class="flex items-center gap-2"><h4 class="font-extrabold text-lg">${req.username || 'N/A'}</h4><span class="px-2 py-0.5 text-[9px] bg-indigo-500/20 text-indigo-400 rounded-full font-bold uppercase">Pending</span></div>
                    <div class="text-sm text-slate-400 mt-1">Phone: <span class="font-mono text-emerald-400">${req.phone}</span></div>
                    <div class="flex flex-wrap gap-4 mt-4">
                        <div class="text-center"><div class="text-[10px] text-slate-400 mb-1 font-bold">BASELINE</div><img src="${req.oldImage}" class="w-24 h-24 object-cover rounded-xl border border-slate-600"></div>
                        <div class="text-center"><div class="text-[10px] text-slate-400 mb-1 font-bold">LIVE CAPTURE</div><img src="${req.newImage}" class="w-24 h-24 object-cover rounded-xl border border-emerald-500 shadow-lg shadow-emerald-500/30"></div>
                    </div>
                </div>
                <div class="flex gap-3 w-full md:w-auto mt-4 md:mt-0 flex-col sm:flex-row md:flex-col">
                    <button onclick="db.ref('admin_queues/double_auth/${child.key}').update({status:'Approved'}); db.ref('users/${req.phone}').update({verificationStatus:'verified'}); triggerToast('Approved');" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-sm font-extrabold">APPROVE</button>
                    <button onclick="db.ref('admin_queues/double_auth/${child.key}').update({status:'Rejected'}); db.ref('users/${req.phone}').update({verificationStatus:'suspended', suspensionWarning:'Double Verification Failed. Live face did not match baseline.'}); triggerToast('Rejected. User Suspended.','error');" class="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-2xl text-sm font-extrabold">REJECT & SUSPEND</button>
                </div>
            `;
            container.appendChild(div);
        });
        if(pending === 0) showEmptyState(container, 'No pending double verification requests', 'fa-camera-rotate');
    });
}

function loadPasswordRequests() {
    const container = document.getElementById('password-requests-feed');
    showSkeletonLoader(container, 'list');
    db.ref('admin_queues/password_requests').on('value', snap => {
        container.innerHTML = '';
        let pending = 0;
        if (!snap.exists()) { showEmptyState(container, 'No password recovery requests', 'fa-unlock-keyhole'); updateBadge('badge-password', 0); return; }
        snap.forEach(child => {
            const req = child.val();
            if (req.status !== 'pending') return;
            pending++;
            const div = document.createElement('div');
            div.className = 'glass p-5 rounded-3xl border border-rose-500/30 flex flex-col md:flex-row gap-4 justify-between items-start';
            div.innerHTML = `
                <div class="flex-1">
                    <div class="flex items-center gap-2"><h4 class="font-extrabold text-lg">${req.username || 'N/A'}</h4></div>
                    <div class="text-sm text-slate-400 mt-1">Phone: <span class="text-white font-mono">${req.phone || 'N/A'}</span> | Email: <span class="text-white">${req.email || 'N/A'}</span></div>
                    <div class="mt-4 p-4 bg-slate-900 rounded-2xl border border-slate-700 inline-block">
                        <div class="text-xs text-slate-500 mb-1">WhatsApp Provided:</div>
                        <div class="font-mono text-emerald-400 font-bold"><i class="fa-brands fa-whatsapp"></i> ${req.whatsappProvided || 'N/A'}</div>
                    </div>
                    <div class="mt-4 p-4 bg-slate-900 rounded-2xl border border-rose-500/30 inline-block ml-0 sm:ml-2">
                        <div class="text-xs text-slate-500 mb-1">User's Real Password:</div>
                        <div class="font-mono text-rose-400 font-bold text-lg">${req.foundPassword || 'Not Found'}</div>
                    </div>
                </div>
                <div class="flex gap-3 w-full md:w-auto mt-4 md:mt-0 flex-col sm:flex-row md:flex-col">
                    <a href="https://wa.me/${(req.whatsappProvided || '').replace(/\D/g, '')}?text=Hello ${req.username}, your Prime Horizon system password is: ${req.foundPassword}" target="_blank" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-sm font-extrabold text-center"><i class="fa-brands fa-whatsapp"></i> WhatsApp User</a>
                    <button onclick="db.ref('admin_queues/password_requests/${child.key}').update({status:'Resolved'}); triggerToast('Resolved');" class="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl text-sm font-extrabold">Mark Resolved</button>
                    <button onclick="db.ref('admin_queues/password_requests/${child.key}').update({status:'Rejected'}); triggerToast('Rejected','error');" class="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-2xl text-sm font-extrabold">Reject Request</button>
                </div>
            `;
            container.appendChild(div);
        });
        if(pending === 0) showEmptyState(container, 'No password recovery requests', 'fa-unlock-keyhole');
    });
}

// ==================== DEPOSITS & WITHDRAWALS ====================
function loadDepositsAdvanced() {
    const container = document.getElementById('deposit-requests-feed');
    showSkeletonLoader(container, 'list');
    db.ref('admin_queues/deposits').on('value', snap => {
        container.innerHTML = '';
        if (!snap.exists()) { showEmptyState(container, 'No pending deposits', 'fa-wallet'); return; }
        let hasPending = false;
        snap.forEach(child => {
            const d = child.val();
            if (d.status !== 'Pending') return;
            hasPending = true;
            
            // Binance Check
            const isBinance = (d.gateway === 'Binance' || d.method === 'Binance' || d.paymentMethod === 'Binance');
            const stylingClass = isBinance ? 'binance-card' : 'border border-emerald-500/30';
            
            let usdDisplay = '';
            if(isBinance) {
                let usdVal = (Number(d.amount) / currentDollarRate).toFixed(2);
                usdDisplay = `<div class="mt-1"><span class="binance-badge px-2 py-0.5 rounded text-xs font-bold font-mono">≈ $${usdVal} USDT</span></div>`;
            }

            const div = document.createElement('div');
            div.className = `glass p-5 rounded-3xl flex flex-col md:flex-row gap-5 items-center ${stylingClass}`;
            div.innerHTML = `
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <div class="font-extrabold text-lg ${isBinance ? 'binance-text' : ''}">${d.username || 'Unknown User'}</div>
                        ${isBinance ? '<i class="fa-brands fa-btc text-amber-500" title="Binance Crypto Deposit"></i>' : ''}
                    </div>
                    <div class="${isBinance ? 'text-amber-400' : 'text-emerald-400'} font-mono text-sm">${d.userPhone}</div>
                    
                    <div class="mt-3">
                        <span class="text-xs text-slate-400">AMOUNT ${isBinance ? '(PKR)' : ''}</span><br>
                        <span class="font-black text-3xl">Rs. ${d.amount}</span>
                        ${usdDisplay}
                    </div>
                    
                    <div class="text-xs text-slate-400 mt-2">
                        ${isBinance ? 'Binance Hash / TRX:' : 'TRX ID:'} 
                        <span class="font-mono text-white break-all">${d.trxId || 'N/A'}</span>
                    </div>
                    ${isBinance && d.senderUid ? `<div class="text-xs text-slate-400 mt-1">Sender UID: <span class="font-mono text-amber-300">${d.senderUid}</span></div>` : ''}
                </div>
                <div class="flex-shrink-0"><a href="${d.proofUrl}" target="_blank" class="block"><img src="${d.proofUrl}" class="w-24 h-24 object-cover rounded-2xl border border-slate-600 shadow-lg"></a></div>
                <div class="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
                    <button onclick="approveDeposit('${child.key}', '${d.userPhone}', ${d.amount})" class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-sm font-extrabold">APPROVE</button>
                    <button onclick="rejectDeposit('${child.key}')" class="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-2xl text-sm font-extrabold">REJECT</button>
                </div>
            `;
            container.appendChild(div);
        });
        if (!hasPending) showEmptyState(container, 'No pending deposits', 'fa-wallet');
    });
}

function approveDeposit(id, phone, amount) {
    db.ref('admin_queues/deposits/' + id).update({ status: 'Approved' });
    db.ref('users/' + phone).transaction(u => {
        if (u) { u.balance = Number(u.balance || 0) + amount; u.totalDeposit = Number(u.totalDeposit || 0) + amount; }
        return u;
    });
    triggerToast('Deposit approved');
}
function rejectDeposit(id) { db.ref('admin_queues/deposits/' + id).update({ status: 'Rejected' }); triggerToast('Deposit rejected', 'error'); }

function loadWithdrawalsAdvanced() {
    const container = document.getElementById('withdrawal-requests-feed');
    showSkeletonLoader(container, 'list');
    db.ref('admin_queues/withdrawals').on('value', snap => {
        container.innerHTML = '';
        if (!snap.exists()) { showEmptyState(container, 'No pending withdrawals', 'fa-hand-holding-dollar'); return; }
        let hasPending = false;
        snap.forEach(child => {
            const w = child.val();
            if (w.status !== 'Pending') return;
            hasPending = true;
            
            let requestedAmount = w.requestedAmount || w.amount;
            let finalDeduct = w.totalDeducted || w.amount;

            // Binance Check
            const isBinance = (w.bankName === 'Binance' || w.method === 'Binance' || w.accountDetails?.method === 'Binance');
            const stylingClass = isBinance ? 'binance-card' : 'border border-purple-500/30';
            
            let usdDisplay = '';
            if(isBinance) {
                let usdVal = (Number(requestedAmount) / currentDollarRate).toFixed(2);
                usdDisplay = `<div class="mt-1"><span class="binance-badge px-2 py-0.5 rounded text-[10px] font-bold font-mono">Pay user: ≈ $${usdVal} USDT</span></div>`;
            }

            const div = document.createElement('div');
            div.className = `glass p-5 rounded-3xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between ${stylingClass}`;
            div.innerHTML = `
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <div class="font-extrabold text-lg ${isBinance ? 'binance-text' : ''}">${w.username || 'Unknown User'}</div>
                        ${isBinance ? '<i class="fa-brands fa-btc text-amber-500" title="Binance Crypto Withdrawal"></i>' : ''}
                    </div>
                    <div class="text-sm ${isBinance ? 'text-amber-400' : 'text-purple-400'} font-mono">${w.userPhone}</div>
                    
                    <div class="mt-4 text-sm bg-slate-800 p-3 rounded-xl border border-slate-700 inline-block w-full max-w-sm">
                        ${isBinance ? `
                            <div class="flex justify-between border-b border-slate-700 pb-1 mb-1"><span class="text-slate-400">Binance Name:</span> <span class="font-bold text-white">${w.accountTitle || w.accountDetails?.accountTitle || 'N/A'}</span></div>
                            <div class="flex justify-between border-b border-slate-700 pb-1 mb-1"><span class="text-slate-400">Pay UID:</span> <span class="font-mono text-amber-400 font-bold">${w.accountNumber || w.accountDetails?.accountNumber || w.binanceUid || 'N/A'}</span></div>
                            <div class="flex justify-between border-b border-slate-700 pb-1 mb-1"><span class="text-slate-400">Network:</span> <span class="font-bold text-white">Binance Pay (Internal)</span></div>
                        ` : `
                            <div class="flex justify-between border-b border-slate-700 pb-1 mb-1"><span class="text-slate-400">Account Title:</span> <span class="font-bold text-white">${w.accountTitle || w.accountDetails?.accountTitle || 'N/A'}</span></div>
                            <div class="flex justify-between border-b border-slate-700 pb-1 mb-1"><span class="text-slate-400">Account No:</span> <span class="font-mono text-emerald-400 font-bold">${w.accountNumber || w.accountDetails?.accountNumber || 'N/A'}</span></div>
                            <div class="flex justify-between border-b border-slate-700 pb-1 mb-1"><span class="text-slate-400">Bank / Method:</span> <span class="font-bold text-white">${w.bankName || w.method || 'N/A'}</span></div>
                        `}
                        <div class="flex justify-between"><span class="text-slate-400">User PIN:</span> <span class="text-rose-400 font-mono font-black tracking-widest">${w.withdrawPin || w.userCode || 'N/A'}</span></div>
                    </div>
                </div>
                <div class="text-left md:text-right w-full md:w-auto mt-4 md:mt-0">
                    <div><span class="text-xs text-slate-400">REQUESTED</span><br><span class="font-black text-3xl ${isBinance ? 'text-amber-500' : 'text-purple-400'}">Rs. ${requestedAmount}</span></div>
                    ${usdDisplay}
                    <div class="text-[10px] text-rose-400 font-bold mt-1">Deducted from balance: Rs. ${finalDeduct} (Tax Incl.)</div>
                    
                    <div class="flex gap-2 mt-4 flex-col sm:flex-row md:flex-col">
                        <button onclick="approveWithdrawal('${child.key}')" class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-extrabold">APPROVE</button>
                        <button onclick="rejectWithdrawal('${child.key}', '${w.userPhone}', ${finalDeduct})" class="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-2xl font-extrabold">REJECT & REFUND</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
        if (!hasPending) showEmptyState(container, 'No pending withdrawals', 'fa-hand-holding-dollar');
    });
}

function approveWithdrawal(id) { db.ref('admin_queues/withdrawals/' + id).update({ status: 'Approved' }); triggerToast('Withdrawal approved'); }
function rejectWithdrawal(id, phone, amount) {
    if (!confirm('Reject and refund Rs. ' + amount + ' back to user?')) return;
    db.ref('admin_queues/withdrawals/' + id).update({ status: 'Rejected' });
    db.ref('users/' + phone).transaction(u => { if (u) u.balance = Number(u.balance || 0) + amount; return u; });
    triggerToast('Withdrawal rejected & refunded', 'error');
}


// ==================== LIVE CHAT & SUPPORT ====================
function loadSupportChannels() {
    const container = document.getElementById('support-active-channels-list');
    const countEl = document.getElementById('support-channel-count');
    db.ref('support_channels').on('value', snap => {
        container.innerHTML = '';
        let count = 0;
        if (!snap.exists()) { container.innerHTML = `<div class="text-center text-sm text-slate-400 py-8">No active chats</div>`; if (countEl) countEl.innerText = '0'; return; }
        snap.forEach(child => {
            const meta = child.val().meta || {};
            const hasMessages = child.val().messages && Object.keys(child.val().messages).length > 0;
            if (!hasMessages) return;
            count++;
            
            const btn = document.createElement('button');
            btn.className = `w-full text-left p-3.5 rounded-2xl flex items-center gap-3 hover:bg-slate-800 transition-colors ${selectedChatPhone === child.key ? 'bg-slate-800 ring-1 ring-cyan-500/30' : ''}`;
            btn.innerHTML = `<img src="${meta.avatarUrl || 'https://i.pravatar.cc/36'}" class="w-9 h-9 rounded-2xl object-cover border border-slate-600 flex-shrink-0"><div class="flex-1 min-w-0"><div class="font-extrabold truncate">${meta.username || child.key}</div><div class="text-xs text-slate-400 font-mono truncate">${child.key}</div></div>`;
            
            btn.onclick = () => { 
                openChat(child.key); 
                document.querySelectorAll('#support-active-channels-list button').forEach(b => b.classList.remove('bg-slate-800', 'ring-1', 'ring-cyan-500/30')); 
                btn.classList.add('bg-slate-800', 'ring-1', 'ring-cyan-500/30'); 
            };
            container.appendChild(btn);
        });
        if (countEl) countEl.innerText = count;
    });
}

function openChat(phone) {
    selectedChatPhone = phone;
    document.getElementById('chat-header-user-title').innerText = phone;
    document.getElementById('chat-header-user-phone').innerText = phone;
    document.getElementById('chat-header-avatar').classList.remove('hidden');
    document.getElementById('chat-status-dot').classList.remove('hidden');
    
    const clearBtn = document.getElementById('clear-all-chat-btn');
    if(clearBtn) clearBtn.classList.remove('hidden');

    const viewport = document.getElementById('admin-chat-messages-viewport');
    db.ref('support_channels/' + phone + '/messages').on('value', snap => {
        viewport.innerHTML = '';
        if (!snap.exists()) { viewport.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400 text-sm">No messages yet.</div>'; return; }
        snap.forEach(msg => {
            const m = msg.val();
            const isAdmin = m.sender === 'admin';
            const div = document.createElement('div');
            div.className = `flex ${isAdmin ? 'justify-end' : 'justify-start'}`;
            let content = m.text || '';
            if (m.imageUrl) content += `<img src="${m.imageUrl}" class="mt-2 rounded-xl max-w-[220px] border border-slate-600">`;
            let actionsHtml = '';
            if (isAdmin) actionsHtml = `<div class="flex gap-1 mt-1 justify-end"><button onclick="editAdminMessage('${phone}', '${msg.key}', '${(m.text || '').replace(/'/g, "\\'")}')" class="text-[10px] px-1.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-white">Edit</button><button onclick="deleteAdminMessage('${phone}', '${msg.key}')" class="text-[10px] px-1.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-white">Del</button></div>`;
            div.innerHTML = `<div class="chat-bubble ${isAdmin ? 'admin-chat-bubble' : 'user-chat-bubble'}">${content}<div class="text-[10px] mt-1.5 opacity-60 text-right">${new Date(m.timestamp || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>${actionsHtml}</div>`;
            viewport.appendChild(div);
        });
        viewport.scrollTop = viewport.scrollHeight;
    });
}

async function transmitAdminLiveChatMessage() {
    if (!selectedChatPhone) return triggerToast('Please select a chat first', 'error');
    const input = document.getElementById('admin-chat-message-field');
    const text = input.value.trim();
    if (!text && !adminChatAttachmentFile) return;
    
    let imageUrl = '';
    if (adminChatAttachmentFile) {
        const formData = new FormData(); formData.append('file', adminChatAttachmentFile); formData.append('upload_preset', CLOUDINARY_PRESET);
        try { const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData }); const data = await res.json(); imageUrl = data.secure_url || ''; } 
        catch (e) { return triggerToast('Failed to upload image', 'error'); }
    }
    await db.ref('support_channels/' + selectedChatPhone + '/messages').push({ sender: 'admin', text: text, imageUrl: imageUrl, timestamp: Date.now() });
    input.value = ''; adminChatAttachmentFile = null;
}

function handleAdminChatImageFileSelectionEvent(e) { adminChatAttachmentFile = e.target.files[0]; if (adminChatAttachmentFile) triggerToast('Image attached.'); }
function editAdminMessage(phone, msgId, currentText) {
    const newText = prompt('Edit your message:', currentText);
    if (!newText || !newText.trim()) return;
    db.ref(`support_channels/${phone}/messages/${msgId}`).update({ text: newText.trim(), edited: true });
}
function deleteAdminMessage(phone, msgId) {
    if (confirm('Delete this message?')) db.ref(`support_channels/${phone}/messages/${msgId}`).remove();
}

function clearAllUserChat() {
    if(!selectedChatPhone) return;
    if(!confirm('Are you SURE you want to permanently delete ALL messages in this conversation? This cannot be undone.')) return;
    db.ref('support_channels/' + selectedChatPhone + '/messages').remove();
    triggerToast('Entire conversation history cleared', 'success');
}

// ==================== GLOBAL SYSTEM LOGS ====================
async function generateGlobalLogs() {
    const fromVal = document.getElementById('log-date-from').value;
    const toVal = document.getElementById('log-date-to').value;
    
    if(!fromVal || !toVal) return triggerToast('Please select both From and To dates', 'error');
    
    const fromTime = new Date(fromVal + 'T00:00:00').getTime();
    const toTime = new Date(toVal + 'T23:59:59').getTime();
    
    if(fromTime > toTime) return triggerToast('From Date cannot be later than To Date', 'error');

    triggerToast('Generating Global Report...', 'success');
    
    const container = document.getElementById('global-logs-results');
    container.innerHTML = '<div class="col-span-full text-center py-8"><i class="fa-solid fa-spinner fa-spin text-fuchsia-400 text-3xl"></i></div>';

    try {
        const [usersSnap, depSnap, wSnap] = await Promise.all([
            db.ref('users').once('value'),
            db.ref('admin_queues/deposits').once('value'),
            db.ref('admin_queues/withdrawals').once('value')
        ]);

        let newUsersCount = 0;
        let totalInvitesDistributed = 0; 
        
        if (usersSnap.exists()) {
            usersSnap.forEach(child => {
                const u = child.val();
                let regDateMs = 0;
                
                if(u.registeredDate) {
                    regDateMs = new Date(u.registeredDate).getTime();
                } else if(u.userSince) {
                    regDateMs = new Date(u.userSince).getTime();
                }

                if(regDateMs >= fromTime && regDateMs <= toTime) {
                    newUsersCount++;
                    if(u.referredByPhone && u.referredByPhone !== "NONE") {
                        totalInvitesDistributed += 30; 
                    }
                }
            });
        }

        let totalDepositAmount = 0;
        if(depSnap.exists()) {
            depSnap.forEach(child => {
                const d = child.val();
                if(d.status === 'Approved') {
                    let ts = d.timestamp || d.createdAt || 0;
                    if(ts >= fromTime && ts <= toTime) {
                        totalDepositAmount += Number(d.amount || 0);
                    }
                }
            });
        }

        let totalWithdrawAmount = 0;
        let totalTaxCollected = 0;
        if(wSnap.exists()) {
            wSnap.forEach(child => {
                const w = child.val();
                if(w.status === 'Approved') {
                    let ts = w.timestamp || w.createdAt || 0;
                    if(ts >= fromTime && ts <= toTime) {
                        let requested = Number(w.requestedAmount || w.amount || 0);
                        let deducted = Number(w.totalDeducted || w.amount || 0);
                        let tax = Number(w.tax || 0);
                        if(tax === 0 && deducted > requested) tax = deducted - requested;
                        
                        totalWithdrawAmount += requested;
                        totalTaxCollected += tax;
                    }
                }
            });
        }

        let platformProfitLoss = totalDepositAmount - totalWithdrawAmount;
        let profitLabel = platformProfitLoss >= 0 ? 'Platform Profit' : 'Platform Loss';
        let profitColor = platformProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400';

        container.innerHTML = `
            <div class="glass p-5 rounded-2xl border border-cyan-500/30">
                <div class="text-xs text-slate-400 font-bold mb-1">NEW REGISTRATIONS</div>
                <div class="text-3xl font-black text-cyan-400">${newUsersCount} Users</div>
            </div>
            <div class="glass p-5 rounded-2xl border border-emerald-500/30">
                <div class="text-xs text-slate-400 font-bold mb-1">TOTAL DEPOSIT</div>
                <div class="text-3xl font-black text-emerald-400">Rs. ${totalDepositAmount.toLocaleString()}</div>
            </div>
            <div class="glass p-5 rounded-2xl border border-purple-500/30">
                <div class="text-xs text-slate-400 font-bold mb-1">TOTAL WITHDRAWN</div>
                <div class="text-3xl font-black text-purple-400">Rs. ${totalWithdrawAmount.toLocaleString()}</div>
            </div>
            <div class="glass p-5 rounded-2xl border border-fuchsia-500/30">
                <div class="text-xs text-slate-400 font-bold mb-1">${profitLabel.toUpperCase()}</div>
                <div class="text-3xl font-black ${profitColor}">Rs. ${Math.abs(platformProfitLoss).toLocaleString()}</div>
            </div>
            <div class="glass p-5 rounded-2xl border border-rose-500/30">
                <div class="text-xs text-slate-400 font-bold mb-1">WITHDRAW TAX COLLECTED</div>
                <div class="text-3xl font-black text-rose-400">Rs. ${totalTaxCollected.toLocaleString()}</div>
            </div>
            <div class="glass p-5 rounded-2xl border border-amber-500/30">
                <div class="text-xs text-slate-400 font-bold mb-1">INVITE BONUSES GIVEN</div>
                <div class="text-3xl font-black text-amber-400">${totalInvitesDistributed.toLocaleString()} Coins</div>
            </div>
        `;

    } catch (err) {
        container.innerHTML = '<div class="col-span-full text-center text-red-400">Failed to generate report.</div>';
    }
}

// ==================== FEEDBACKS & COMPLAINTS ====================
function loadFeedbackAndAppeals() {
    const fbContainer = document.getElementById('feedback-list');
    showSkeletonLoader(fbContainer, 'list');
    db.ref('admin_feedbacks').on('value', snap => {
        fbContainer.innerHTML = '';
        if (!snap.exists()) { showEmptyState(fbContainer, 'No user feedback yet', 'fa-comments'); return; }
        snap.forEach(userFb => {
            userFb.forEach(fb => {
                const data = fb.val();
                const div = document.createElement('div');
                div.className = 'p-4 border-b border-slate-700 last:border-0';
                div.innerHTML = `
                    <div class="flex justify-between items-start"><div><div class="font-extrabold">${data.username || 'Anonymous'}</div><div class="text-xs text-slate-400 font-mono">${userFb.key}</div></div></div>
                    <p class="text-sm mt-3 leading-relaxed">${data.text || ''}</p>
                    ${data.adminReply ? `<div class="mt-3 p-3 bg-slate-800 rounded-2xl text-xs"><strong class="text-emerald-400">Your Reply:</strong> ${data.adminReply}</div>` : `<div class="mt-3"><input placeholder="Write reply..." class="text-xs px-4 py-2.5 bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-2xl w-full outline-none" onblur="replyToFeedback('${userFb.key}', '${fb.key}', this.value)"></div>`}
                `;
                fbContainer.appendChild(div);
            });
        });
    });

    const apContainer = document.getElementById('appeals-list');
    showSkeletonLoader(apContainer, 'list');
    db.ref('admin_queues/appeals').on('value', snap => {
        apContainer.innerHTML = '';
        if (!snap.exists()) { showEmptyState(apContainer, 'No suspension appeals', 'fa-gavel'); return; }
        snap.forEach(child => {
            const a = child.val();
            const div = document.createElement('div');
            div.className = 'p-4 border-b border-slate-700 last:border-0';
            div.innerHTML = `
                <div class="font-extrabold">${a.username || 'User'} <span class="font-mono text-xs text-slate-400">(${a.phone || ''})</span></div>
                <p class="text-sm mt-2 leading-relaxed">${a.message || ''}</p>
                ${a.adminReply ? `<div class="mt-3 p-3 bg-emerald-900/30 rounded-2xl text-xs"><strong class="text-emerald-400">Your Reply:</strong> ${a.adminReply}</div>` : `<div class="mt-3"><input placeholder="Write reply..." class="text-xs px-4 py-2.5 bg-slate-800 border border-slate-700 focus:border-purple-500 rounded-2xl w-full outline-none" onblur="replyToAppeal('${child.key}', this.value)"></div>`}
                <div class="flex gap-2 mt-3"><button onclick="db.ref('admin_queues/appeals/${child.key}').update({status:'Resolved'}); triggerToast('Resolved');" class="flex-1 py-2 text-xs bg-emerald-600 rounded-2xl font-extrabold">RESOLVE</button><button onclick="db.ref('admin_queues/appeals/${child.key}').remove();" class="flex-1 py-2 text-xs bg-red-600 rounded-2xl font-extrabold">DELETE</button></div>
            `;
            apContainer.appendChild(div);
        });
    });
}
function replyToFeedback(uPhone, fId, rep) { if (rep.trim()) db.ref(`admin_feedbacks/${uPhone}/${fId}`).update({ adminReply: rep.trim() }); }
function replyToAppeal(id, rep) { if (rep.trim()) db.ref(`admin_queues/appeals/${id}`).update({ adminReply: rep.trim() }); }

function loadComplaints() {
    const container = document.getElementById('complaints-feed');
    showSkeletonLoader(container, 'list');
    db.ref('support_channels').on('value', rootSnap => {
        container.innerHTML = '';
        let allTickets = [];
        if (!rootSnap.exists()) return showEmptyState(container, 'No complaints yet', 'fa-exclamation-triangle');
        rootSnap.forEach(phoneSnap => {
            const phone = phoneSnap.key;
            if (phoneSnap.child('tickets').exists()) {
                phoneSnap.child('tickets').forEach(tChild => {
                    const t = tChild.val();
                    allTickets.push({ id: tChild.key, userPhone: phone, username: t.username || phone, message: t.description || t.message || 'No description', category: t.category || 'General Issue', proofUrl: t.proofUrl, createdAt: t.timestamp || Date.now(), adminReply: t.adminReply || '', status: t.status || 'Pending' });
                });
            }
        });
        if (allTickets.length === 0) return showEmptyState(container, 'No complaints yet', 'fa-exclamation-triangle');
        allTickets.sort((a, b) => b.createdAt - a.createdAt);
        
        allTickets.forEach(c => {
            const div = document.createElement('div');
            div.className = 'glass p-5 rounded-3xl border border-slate-700/60';
            let proofHtml = (c.proofUrl && c.proofUrl !== 'NONE') ? `<a href="${c.proofUrl}" target="_blank" class="inline-block mt-2"><img src="${c.proofUrl}" class="w-16 h-16 object-cover rounded-xl border border-slate-600"></a>` : '';
            div.innerHTML = `
                <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-2"><div class="font-extrabold text-lg">${c.username}</div><span class="px-2 py-0.5 text-[9px] bg-orange-500/20 text-orange-400 rounded-full font-bold">${c.category}</span></div>
                        <div class="text-sm text-orange-400 font-mono">${c.userPhone}</div>
                        <div class="mt-3 text-sm leading-relaxed bg-slate-900/60 p-3 rounded-2xl">${c.message}</div>
                        ${proofHtml}
                        ${c.adminReply ? `<div class="mt-3 p-3 bg-emerald-900/30 rounded-2xl text-xs"><strong class="text-emerald-400">Reply:</strong> ${c.adminReply}</div>` : `<div class="mt-3"><input placeholder="Write reply..." class="text-xs px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl w-full outline-none" onblur="if(this.value.trim()){db.ref('support_channels/${c.userPhone}/tickets/${c.id}').update({adminReply: this.value.trim()}); triggerToast('Replied');}"></div>`}
                    </div>
                    <div class="flex flex-col gap-2 w-full md:w-auto"><button onclick="db.ref('support_channels/${c.userPhone}/tickets/${c.id}').update({status:'Resolved'}); triggerToast('Resolved');" class="px-5 py-2 bg-emerald-600 rounded-2xl text-xs font-extrabold">RESOLVE</button><button onclick="db.ref('support_channels/${c.userPhone}/tickets/${c.id}').remove(); triggerToast('Deleted');" class="px-5 py-2 bg-red-600 rounded-2xl text-xs font-extrabold">DELETE</button></div>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

// ==================== OTHER SECTIONS (PLANS, TASKS, SOCIAL, HISTORY) ====================
function loadPlans() {
    const container = document.getElementById('plans-list');
    showSkeletonLoader(container, 'list');
    db.ref('investment_plans').on('value', snap => {
        container.innerHTML = '';
        if (!snap.exists()) return showEmptyState(container, 'No investment plans', 'fa-seedling');
        snap.forEach(child => {
            const plan = child.val();
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center p-5 border-b border-slate-700 last:border-0';
            div.innerHTML = `<div class="flex-1"><span class="font-extrabold text-lg">${plan.name}</span><div class="text-sm text-slate-400 mt-1">Rs.${plan.cost} • ${plan.days} days • ${plan.percentage}% daily</div></div><button onclick="if(confirm('Delete?')) db.ref('investment_plans/${child.key}').remove();" class="px-6 py-2 text-sm text-red-400 font-bold">Delete</button>`;
            container.appendChild(div);
        });
    });
}
function showAddPlanModal() {
    const n = prompt("Plan Name:"); if(!n) return;
    const c = prompt("Cost (Rs):"); if(!c) return;
    const d = prompt("Duration (Days):"); if(!d) return;
    const p = prompt("Daily Return %:"); if(!p) return;
    db.ref('investment_plans/PLAN-' + Date.now()).set({ name: n, cost: parseFloat(c), days: parseInt(d), percentage: parseFloat(p) });
    triggerToast('Plan added');
}

function loadTasks() {
    const container = document.getElementById('tasks-list');
    showSkeletonLoader(container, 'list');
    db.ref('daily_tasks').on('value', snap => {
        container.innerHTML = '';
        if (!snap.exists()) return showEmptyState(container, 'No daily tasks', 'fa-list-check');
        snap.forEach(child => {
            const task = child.val();
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center p-5 border-b border-slate-700 last:border-0';
            div.innerHTML = `<div><div class="font-extrabold">${task.title}</div><div class="text-sm text-slate-400 mt-1">${task.description || ''} - <span class="text-purple-400 font-bold">${task.rewardCoins} Coins</span></div></div><button onclick="db.ref('daily_tasks/${child.key}').remove();" class="text-red-400 font-bold">Delete</button>`;
            container.appendChild(div);
        });
    });
}
function showAddTaskModal() {
    const t = prompt("Title:"); if(!t) return;
    const d = prompt("Description:");
    const r = prompt("Reward Coins:"); if(!r) return;
    db.ref('daily_tasks/TASK-' + Date.now()).set({ title: t, description: d, rewardCoins: parseInt(r) });
    triggerToast('Task added');
}

function loadSocialChannels() {
    const container = document.getElementById('social-list');
    showSkeletonLoader(container, 'list');
    db.ref('social_channels').on('value', snap => {
        container.innerHTML = '';
        if (!snap.exists()) return showEmptyState(container, 'No social channels', 'fa-share-alt');
        snap.forEach(child => {
            const c = child.val();
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center p-5 border-b border-slate-700 last:border-0';
            div.innerHTML = `<div><div class="font-extrabold">${c.name}</div><div class="text-sm text-emerald-400">${c.url}</div></div><button onclick="db.ref('social_channels/${child.key}').remove();" class="text-red-400 font-bold">Delete</button>`;
            container.appendChild(div);
        });
    });
}
function showAddSocialModal() {
    const n = prompt("Name:"); if(!n) return;
    const u = prompt("URL:"); if(!u) return;
    db.ref('social_channels/CH-' + Date.now()).set({ name: n, url: u });
    triggerToast('Channel added');
}

// User History Advanced
async function performHistorySearch() {
    const rawInput = document.getElementById('history-search-input').value.trim();
    const container = document.getElementById('history-results-container');
    if (!rawInput) return triggerToast('Please enter a search term', 'error');
    container.dataset.searched = 'true';
    showSkeletonLoader(container, 'user');
    try {
        let targetPhone = null;
        const clInput = rawInput.replace(/\s/g, '');
        
        const direct = await db.ref('users/' + clInput).once('value');
        if (direct.exists()) targetPhone = clInput;
        if (!targetPhone) { const uSnap = await db.ref('users').once('value'); if(uSnap.exists()) uSnap.forEach(c => { if(c.val().gmail?.toLowerCase() === rawInput.toLowerCase()) targetPhone = c.key; }); }
        if (!targetPhone) { const dSnap = await db.ref('admin_queues/deposits/' + rawInput).once('value'); if(dSnap.exists()) targetPhone = dSnap.val().userPhone; }
        if (!targetPhone) { const wSnap = await db.ref('admin_queues/withdrawals/' + rawInput).once('value'); if(wSnap.exists()) targetPhone = wSnap.val().userPhone; }
        
        if (!targetPhone) return showEmptyState(container, 'No user found matching "' + rawInput + '"', 'fa-user-slash');
        await renderUserHistory(targetPhone, container);
    } catch (err) { showEmptyState(container, 'Error loading history', 'fa-triangle-exclamation'); }
}

async function renderUserHistory(phone, container) {
    const userSnap = await db.ref('users/' + phone).once('value');
    const user = userSnap.exists() ? userSnap.val() : {};
    const [depSnap, wSnap, tSnap, fbSnap] = await Promise.all([ db.ref('admin_queues/deposits').once('value'), db.ref('admin_queues/withdrawals').once('value'), db.ref('support_channels/' + phone + '/tickets').once('value'), db.ref('admin_feedbacks/' + phone).once('value') ]);
    
    let timeline = [], totalD = 0, totalW = 0;
    
    if(depSnap.exists()) depSnap.forEach(c => { 
        const d=c.val(); 
        if(d.userPhone===phone) { 
            if(d.status==='Approved') totalD+=Number(d.amount); 
            let methodText = (d.gateway === 'Binance' || d.method === 'Binance') ? 'Deposit (Binance)' : 'Deposit';
            timeline.push({type: methodText, id:c.key, amount:d.amount, status:d.status, ts:d.timestamp, isBinance: methodText.includes('Binance')}); 
        } 
    });
    
    if(wSnap.exists()) wSnap.forEach(c => { 
        const w=c.val(); 
        if(w.userPhone===phone) { 
            if(w.status==='Approved') totalW+=Number(w.amount); 
            let methodText = (w.bankName === 'Binance' || w.method === 'Binance') ? 'Withdraw (Binance)' : 'Withdraw';
            timeline.push({type: methodText, id:c.key, amount:w.amount, status:w.status, ts:w.timestamp, isBinance: methodText.includes('Binance')}); 
        } 
    });
    
    if(tSnap.exists()) tSnap.forEach(c => { const t=c.val(); timeline.push({type:'Complaint', id:c.key, message:t.description||t.message, status:t.status, ts:t.timestamp}); });
    if(fbSnap.exists()) fbSnap.forEach(c => { const f=c.val(); timeline.push({type:'Feedback', id:c.key, message:f.text, status:f.adminReply?'Replied':'Awaiting', ts:f.timestamp}); });
    
    timeline.sort((a,b) => b.ts - a.ts);
    
    container.innerHTML = `
        <div class="glass rounded-3xl p-6 border border-slate-700/50 mb-6 flex items-center gap-4">
            <img src="${user.avatarUrl || 'https://i.pravatar.cc/56'}" class="w-14 h-14 rounded-2xl object-cover">
            <div class="flex-1">
                <div class="font-extrabold text-xl">${user.username || 'No Name'}</div>
                <div class="text-teal-400 font-mono">${phone}</div>
            </div>
            <div class="text-right">
                <div class="font-extrabold text-2xl">Rs. ${Number(user.balance || 0).toFixed(0)}</div>
                <div class="text-indigo-400 text-sm font-semibold">${user.coins || 0} 🪙</div>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="glass p-4 rounded-2xl border border-emerald-500/30 text-center"><div class="text-2xl font-black text-emerald-400">Rs. ${totalD}</div><div class="text-xs text-slate-400">Total Deposits</div></div>
            <div class="glass p-4 rounded-2xl border border-purple-500/30 text-center"><div class="text-2xl font-black text-purple-400">Rs. ${totalW}</div><div class="text-xs text-slate-400">Total Withdrawals</div></div>
        </div>
        <div class="glass rounded-3xl p-2 border border-slate-700/50" id="hist-timeline"></div>
    `;
    
    const list = document.getElementById('hist-timeline');
    if(timeline.length === 0) return showEmptyState(list, 'No history found', 'fa-clock');
    
    timeline.forEach(item => {
        const isBin = item.isBinance;
        const textColor = isBin ? 'text-amber-400' : '';
        const iconHtml = isBin ? '<i class="fa-brands fa-btc text-amber-500 ml-1"></i>' : '';
        
        const div = document.createElement('div');
        div.className = `flex items-start gap-4 p-4 border-b border-slate-700 last:border-0 ${isBin ? 'bg-amber-900/5' : ''}`;
        div.innerHTML = `
            <div class="flex-1">
                <div class="font-extrabold ${textColor}">${item.type} ${iconHtml} <span class="text-xs text-slate-400 font-mono ml-2">(${item.id})</span></div>
                <div class="text-sm mt-1">${item.amount ? `Rs. ${item.amount}` : item.message}</div>
                <div class="text-xs text-slate-500 mt-1">${new Date(item.ts).toLocaleString()} • <span class="font-bold">${item.status}</span></div>
            </div>`;
        list.appendChild(div);
    });
}

// PDF GENERATION 
function downloadUserPDF(phone) {
    db.ref('users/' + phone).once('value', snap => {
        const user = snap.exists() ? snap.val() : {};
        const createdDate = user.registeredDate || user.userSince || 'N/A';
        const email = user.email || user.gmail || 'N/A';
        const verifStatus = user.verificationStatus || 'unverified';
        const kycStatus = user.kycStatus || 'unverified';
        
        let validRefs = 0;
        let refsHtml = '';
        if (user.referrals) {
            Object.values(user.referrals).forEach(r => {
                if (r.isDeposited || r.depositCommissionPaid) validRefs++;
                refsHtml += `<tr><td style="padding: 5px 0; border-bottom: 1px solid #e2e8f0;">${r.username || 'N/A'}</td><td style="padding: 5px 0; border-bottom: 1px solid #e2e8f0;">${r.email || 'N/A'}</td><td style="padding: 5px 0; border-bottom: 1px solid #e2e8f0;">${(r.isDeposited || r.depositCommissionPaid) ? 'Active' : 'Pending'}</td><td style="padding: 5px 0; border-bottom: 1px solid #e2e8f0;">${r.commissionEarnedCoins || 0} 🪙</td></tr>`;
            });
        }
        let tier = Math.floor(validRefs / 10) + 1;
        if(tier > 10) tier = 10;
        
        const logsArray = user.logs ? Object.values(user.logs).sort((a,b)=>b.timestamp-a.timestamp) : [];
        
        const element = document.createElement('div');
        element.style.padding = '40px';
        element.style.fontFamily = 'Inter, system-ui, sans-serif';
        element.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto; color: #0f172a;">
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 30px; border-bottom: 3px solid #06b6d4; padding-bottom: 20px;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #06b6d4, #10b981); border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 32px;">🛡️</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; font-size: 28px; font-weight: 900;">PRIME HORIZON</h1>
                        <p style="margin: 4px 0 0; color: #64748b; font-size: 13px; letter-spacing: 2px;">OFFICIAL USER REPORT</p>
                    </div>
                </div>
                <h2 style="font-size: 22px; margin-bottom: 8px;">User Account Summary</h2>
                <p style="color: #64748b; margin-bottom: 25px;">Generated on ${new Date().toLocaleString()}</p>
                <div style="background: #f8fafc; padding: 24px; border-radius: 16px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600; width: 200px;">Phone Number</td><td style="padding: 10px 0; font-weight: 700; font-family: monospace;">${phone}</td></tr>
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600;">Username</td><td style="padding: 10px 0; font-weight: 700;">${user.username || 'N/A'}</td></tr>
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600;">Email / Gmail</td><td style="padding: 10px 0; font-weight: 700;">${email}</td></tr>
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600;">Password</td><td style="padding: 10px 0; font-weight: 700; font-family: monospace;">${user.password || 'N/A'}</td></tr>
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600;">Withdrawal PIN</td><td style="padding: 10px 0; font-weight: 700; font-family: monospace;">${user.withdrawPin || 'Not Set'}</td></tr>
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600;">Affiliate Level</td><td style="padding: 10px 0; font-weight: 700;">Level ${tier} (${validRefs} Active Refs)</td></tr>
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600;">Account Created</td><td style="padding: 10px 0; font-weight: 700;">${createdDate}</td></tr>
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600;">Current Balance</td><td style="padding: 10px 0; font-weight: 700; color: #059669;">Rs. ${(user.balance || 0).toFixed(0)}</td></tr>
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600;">Coins</td><td style="padding: 10px 0; font-weight: 700;">${user.coinsCommission || user.coins || 0} 🪙</td></tr>
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600;">Verification Status</td><td style="padding: 10px 0; font-weight: 700; text-transform: uppercase;">${verifStatus}</td></tr>
                        <tr><td style="padding: 10px 0; color: #475569; font-weight: 600;">KYC Status</td><td style="padding: 10px 0; font-weight: 700; text-transform: uppercase;">${kycStatus}</td></tr>
                    </table>
                </div>
                <h3 style="font-size: 16px; margin: 20px 0 10px; color: #334155;">Referred Users</h3>
                <div style="background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 25px; max-height: 220px; overflow-y: auto;">
                    ${user.referrals ? `<table style="width: 100%; text-align: left; font-size: 13px;"><thead><tr><th style="padding-bottom: 10px;">Username</th><th style="padding-bottom: 10px;">Gmail</th><th style="padding-bottom: 10px;">Status</th><th style="padding-bottom: 10px;">Commission Earned</th></tr></thead><tbody>${refsHtml}</tbody></table>` : '<div style="color:#64748b; font-size:13px; padding:10px 0;">No users invited yet.</div>'}
                </div>
                <h3 style="font-size: 16px; margin: 20px 0 10px; color: #334155;">Recent Activity Logs</h3>
                <div style="background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 25px; max-height: 220px; overflow-y: auto;">
                    ${logsArray.length > 0 ? logsArray.map(l => `<div style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 13px;"><span>${new Date(l.timestamp).toLocaleString()} - ${l.title || l.type}</span><span style="font-weight: 600; color: ${l.amount > 0 ? '#059669' : '#dc2626'};">${l.amount || 0}</span></div>`).join('') : '<div style="color:#64748b; font-size:13px; padding:10px 0;">No transaction history.</div>'}
                </div>
            </div>
        `;
        html2pdf().from(element).set({ margin: 0, filename: `PH-User-Report-${phone}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' } }).save();
    });
}

// ==================== SETTINGS SAVING ====================
function saveDepositGateways() {
    const data = {
        JazzCash: { title: document.getElementById('dep-jazz-title').value, account: document.getElementById('dep-jazz-acc').value },
        EasyPaisa: { title: document.getElementById('dep-easy-title').value, account: document.getElementById('dep-easy-acc').value },
        CustomBank: { title: document.getElementById('dep-bank-title').value, account: document.getElementById('dep-bank-acc').value },
        Binance: { title: document.getElementById('dep-binance-name').value, uid: document.getElementById('dep-binance-uid').value }
    };
    db.ref('admin_settings/deposit_gateway').set(data);
    triggerToast('All Deposit & Binance accounts saved');
}

function saveLimits() {
    const dollar = parseFloat(document.getElementById('dollar-rate').value) || 278.50;
    currentDollarRate = dollar;
    
    db.ref('admin_settings').update({
        min_withdraw: parseFloat(document.getElementById('min-withdraw').value) || 0,
        coins_per_rupee: parseFloat(document.getElementById('coins-per-rupee').value) || 0,
        dollar_rate: dollar
    });
    triggerToast('Limits & Dollar Rate saved');
}

function toggleMaintenance(state) {
    db.ref('admin_settings/maintenance').update({ isEnabled: state });
    triggerToast(state ? 'Maintenance Mode ENABLED' : 'Maintenance Mode DISABLED', state ? 'error' : 'success');
}
function updateMaintenanceNote() {
    db.ref('admin_settings/maintenance').update({ note: document.getElementById('maintenance-note').value });
    triggerToast('Maintenance note updated');
}

async function uploadPopupImage(e) {
    const file = e.target.files[0];
    if(file) {
        const fData = new FormData(); fData.append('file', file); fData.append('upload_preset', CLOUDINARY_PRESET);
        const res = await fetch(CLOUDINARY_URL, {method:'POST', body:fData});
        const data = await res.json();
        popupUploadedImageUrl = data.secure_url;
        document.getElementById('popup-image-preview-img').src = popupUploadedImageUrl;
        document.getElementById('popup-image-preview').classList.remove('hidden');
        document.getElementById('popup-image-url-display').innerText = "Image attached";
        document.getElementById('popup-image-url-display').classList.remove('hidden');
    }
}
function savePopupAnnouncement(active) {
    const title = document.getElementById('popup-title').value;
    const desc = document.getElementById('popup-desc').value;
    db.ref('admin_settings/popup_announcement').set({ active: active, title: title, description: desc, imageUrl: popupUploadedImageUrl });
    triggerToast(active ? 'Popup Activated' : 'Popup Deactivated');
}

async function uploadAboutImage(e) {
    const file = e.target.files[0];
    if(file) {
        const fData = new FormData(); fData.append('file', file); fData.append('upload_preset', CLOUDINARY_PRESET);
        const res = await fetch(CLOUDINARY_URL, {method:'POST', body:fData});
        const data = await res.json();
        aboutUploadedImageUrl = data.secure_url;
        document.getElementById('about-image-preview-img').src = aboutUploadedImageUrl;
        document.getElementById('about-image-preview').classList.remove('hidden');
        document.getElementById('about-image-url-display').innerText = "Image attached";
        document.getElementById('about-image-url-display').classList.remove('hidden');
    }
}
function saveAboutUs() {
    const text = document.getElementById('about-us-text').value;
    db.ref('admin_settings/about_us').set({ text: text, image: aboutUploadedImageUrl });
    triggerToast('About Us saved');
}

// ==================== INIT ====================
window.onload = function() { checkAdminLogin(); };

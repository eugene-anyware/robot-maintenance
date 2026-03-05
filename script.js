// Data structure
let robots = [];
let maintenanceLogs = [];
let customTasks = [];
let dailyReminderItems = [];
let selectedRobotId = null;
let editingRobotId = null;
let supabaseClient = null;

const DEFAULT_DAILY_ITEMS = [
    { id: 'dr1', label: 'Container Tracksheet Entry', url: 'https://customers.anyware-robotics.com' },
    { id: 'dr2', label: 'Camera Calibration & Validation Daily Check', url: '' },
    { id: 'dr3', label: 'Lidar Calibration & Validation Daily Check', url: '' },
    { id: 'dr4', label: 'Database for Individual Container Unload Time', url: 'https://anyware-robotics.atlassian.net/wiki/x/GYChLQ' }
];

// Frequency intervals in days
const frequencyDays = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    semiAnnual: 180,
    annual: 365,
    biennial: 730,
    threeYear: 1095,
    other: 545 // ~18 months for battery
};

// Maintenance schedule organized by frequency
const maintenanceSchedule = {
    weekly: [
        { task: "System wipe down", partNumber: "", note: "" },
        { task: "Dragons inspected", partNumber: "", note: "" },
        { task: "Gripper inspected", partNumber: "", note: "" },
        { task: "IOLink Inspected", partNumber: "", note: "" },
        { task: "Operator station cleaned", partNumber: "", note: "" }
    ],
    monthly: [
        { task: "Pump blast the external air filter", partNumber: "", note: "Pump maintenance schedule" },
        { task: "Ventilation fan filter blast", partNumber: "", note: "" },
        { task: "Gripper and hose condition visual inspection, clean dust on sensors", partNumber: "", note: "" },
        { task: "Inspection of suction cup for wear and tear", partNumber: "", note: "" },
        { task: "Power connector visual and manual inspection", partNumber: "", note: "Inspect all the power line connectors (on the wall, charger area, charger head, VFDs) with hand jog to see if the connector is loose." },
        { task: "Clean dust from lidar with compressed air/clean towel", partNumber: "", note: "" }
    ],
    quarterly: [
        { task: "Pump change external filter", partNumber: "", note: "" },
        { task: "Replace suction cups", partNumber: "", note: "" },
        { task: "Ventilation fan replacement", partNumber: "", note: "" }
    ],
    semiAnnual: [
        { task: "Inspection of the wheel brake friction plate clearance and protective cover", partNumber: "", note: "" }
    ],
    annual: [
        { task: "Pump check carbon vanes, replace if necessary", partNumber: "", note: "" },
        { task: "Robot arm encoder battery", partNumber: "", note: "CRX25 ONLY" },
        { task: "Wheel wearing condition", partNumber: "", note: "" }
    ],
    biennial: [
        { task: "Riser/30X wheel encoder battery replacement", partNumber: "", note: "" }
    ],
    threeYear: [
        { task: "Vacuum pump overhaul", partNumber: "", note: "" },
        { task: "Fan module replacement", partNumber: "", note: "Due to bearing wear" },
        { task: "LED indicator light replacement", partNumber: "", note: "" },
        { task: "Linear guide rails greasing", partNumber: "", note: "" },
        { task: "Drivetrain gearbox oil change", partNumber: "TBD", note: "FANUC and Tier 2 supplier are given different spec, pending confirmation" }
    ],
    other: [
        { task: "Battery examination", schedule: "Every 500 charges (~18 months)", partNumber: "", note: "" }
    ]
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await initSupabase();
    await loadData();
    initTabs();
    initModals();
    initForms();
    initFilters();
    startClock();
    renderRobots();
    renderSchedule();
    renderLogs();
    renderTaskChecklist();
    renderDashboard();
    renderDailyReminderList();
    renderOwnerWebhookList();
    loadWebhookUrl();
    loadSupabaseCredentials();
    loadGithubConfig();
});

// Live clock
function startClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const el = document.getElementById('currentDateTime');
    if (el) {
        el.innerHTML = `${dateStr} &bull; ${timeStr}`;
    }
}

// ==========================================
// SUPABASE INTEGRATION
// ==========================================

async function initSupabase() {
    const url = localStorage.getItem('supabaseUrl');
    const key = localStorage.getItem('supabaseKey');
    if (url && key && typeof supabase !== 'undefined') {
        try {
            supabaseClient = supabase.createClient(url, key);
            const { error } = await supabaseClient.from('app_data').select('key').limit(1);
            if (error) {
                console.warn('Supabase connection failed:', error.message);
                supabaseClient = null;
            } else {
                console.log('Supabase connected');
            }
        } catch (e) {
            console.error('Supabase init error:', e);
            supabaseClient = null;
        }
    }
}

function loadSupabaseCredentials() {
    const urlInput = document.getElementById('supabaseUrl');
    const keyInput = document.getElementById('supabaseKey');
    const savedUrl = localStorage.getItem('supabaseUrl');
    const savedKey = localStorage.getItem('supabaseKey');
    if (urlInput && savedUrl) urlInput.value = savedUrl;
    if (keyInput && savedKey) keyInput.value = savedKey;
    updateSupabaseStatusBadge();
}

function updateSupabaseStatusBadge() {
    const badge = document.getElementById('supabaseConnectionBadge');
    if (!badge) return;
    if (supabaseClient) {
        badge.textContent = '🟢 Connected to shared database — all users see the same data';
        badge.className = 'connection-badge badge-connected';
    } else {
        badge.textContent = '🔴 Using local storage only — data not shared between users';
        badge.className = 'connection-badge badge-disconnected';
    }
}

async function connectSupabase() {
    const urlInput = document.getElementById('supabaseUrl');
    const keyInput = document.getElementById('supabaseKey');
    const statusEl = document.getElementById('supabaseStatus');
    const url = urlInput.value.trim();
    const key = keyInput.value.trim();

    if (!url || !key) {
        statusEl.innerHTML = '<span class="status-error">Please enter both the Project URL and anon key.</span>';
        return;
    }

    statusEl.innerHTML = '<span class="status-pending">Connecting...</span>';

    try {
        const client = supabase.createClient(url, key);
        const { error } = await client.from('app_data').select('key').limit(1);
        if (error) {
            statusEl.innerHTML = `<span class="status-error">Connection failed: ${error.message}. Make sure you ran the SQL setup.</span>`;
            return;
        }

        localStorage.setItem('supabaseUrl', url);
        localStorage.setItem('supabaseKey', key);
        supabaseClient = client;
        updateSupabaseStatusBadge();

        statusEl.innerHTML = '<span class="status-pending">Connected! Loading shared data...</span>';

        // Migrate local data to Supabase if Supabase is empty
        const { data } = await supabaseClient.from('app_data').select('*');
        const hasSupabaseData = data && data.some(r => r.key === 'robots' && r.value && r.value.length > 0);
        if (!hasSupabaseData && robots.length > 0) {
            if (confirm(`Found ${robots.length} robot(s) in local storage. Upload to shared database?`)) {
                await saveDataToSupabase();
            }
        } else {
            await loadDataFromSupabase();
            renderRobots();
            renderLogs();
            renderSchedule();
            renderDashboard();
            populateRobotSelects();
            populateOverviewFilters();
        }

        subscribeToRealtime();
        statusEl.innerHTML = '<span class="status-success">Connected! All users will now share the same data in real time.</span>';
    } catch (e) {
        statusEl.innerHTML = `<span class="status-error">Error: ${e.message}</span>`;
    }
}

async function loadDataFromSupabase() {
    const { data, error } = await supabaseClient.from('app_data').select('*');
    if (error) throw error;
    const robotsRow = data.find(r => r.key === 'robots');
    const logsRow = data.find(r => r.key === 'maintenance_logs');
    const tasksRow = data.find(r => r.key === 'custom_tasks');
    const dailyRow = data.find(r => r.key === 'daily_reminder_items');
    robots = robotsRow ? robotsRow.value : [];
    maintenanceLogs = logsRow ? logsRow.value : [];
    customTasks = tasksRow ? tasksRow.value : [];
    dailyReminderItems = (dailyRow && dailyRow.value.length > 0) ? dailyRow.value : [...DEFAULT_DAILY_ITEMS];
}

async function saveDataToSupabase() {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.from('app_data').upsert([
        { key: 'robots', value: robots, updated_at: new Date().toISOString() },
        { key: 'maintenance_logs', value: maintenanceLogs, updated_at: new Date().toISOString() },
        { key: 'custom_tasks', value: customTasks, updated_at: new Date().toISOString() },
        { key: 'daily_reminder_items', value: dailyReminderItems, updated_at: new Date().toISOString() }
    ]);
    if (error) console.error('Supabase save error:', error);
}

function subscribeToRealtime() {
    if (!supabaseClient) return;
    supabaseClient
        .channel('app_data_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data' }, (payload) => {
            if (!payload.new) return;
            const { key, value } = payload.new;
            if (key === 'robots') {
                robots = value;
                renderRobots();
                renderDashboard();
                renderOwnerWebhookList();
                populateRobotSelects();
                populateOverviewFilters();
            }
            if (key === 'maintenance_logs') {
                maintenanceLogs = value;
                renderLogs();
                renderDashboard();
            }
            if (key === 'custom_tasks') {
                customTasks = value;
                renderSchedule();
                renderTaskChecklist();
            }
            if (key === 'daily_reminder_items') {
                dailyReminderItems = value;
                renderDailyReminderList();
            }
        })
        .subscribe();
}

// Tab functionality
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabName).classList.add('active');
            if (tabName === 'dashboard') renderDashboard();
            if (tabName === 'teams') { renderDailyReminderList(); renderOwnerWebhookList(); }
        });
    });
}

// Modal functionality
function initModals() {
    const robotModal = document.getElementById('robotModal');
    const logModal = document.getElementById('logModal');
    const taskModal = document.getElementById('taskModal');
    const addRobotBtn = document.getElementById('addRobotBtn');
    const addLogBtn = document.getElementById('addLogBtn');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const debugBtn = document.getElementById('debugBtn');
    const closeBtns = document.querySelectorAll('.close');

    addRobotBtn.addEventListener('click', () => {
        resetRobotModal();
        robotModal.classList.add('show');
    });

    addLogBtn.addEventListener('click', () => {
        populateRobotSelects();
        logModal.classList.add('show');
    });

    addTaskBtn.addEventListener('click', () => {
        taskModal.classList.add('show');
    });

    debugBtn.addEventListener('click', () => {
        showDebugInfo();
    });

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            robotModal.classList.remove('show');
            logModal.classList.remove('show');
            taskModal.classList.remove('show');
            resetRobotModal();
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === robotModal) { robotModal.classList.remove('show'); resetRobotModal(); }
        if (e.target === logModal) logModal.classList.remove('show');
        if (e.target === taskModal) taskModal.classList.remove('show');
    });
}

function resetRobotModal() {
    editingRobotId = null;
    document.getElementById('robotId').readOnly = false;
    document.getElementById('robotModalTitle').textContent = 'Add New Robot';
    document.querySelector('#robotForm button[type="submit"]').textContent = 'Add Robot';
    document.getElementById('robotForm').reset();
}

// Show debug information
function showDebugInfo() {
    const info = window.debugMaintenanceTracker();
    const debugMessage = `
=== MAINTENANCE TRACKER DEBUG ===

Data in Memory:
- Robots: ${info.robots}
- Maintenance Logs: ${info.logs}
- Custom Tasks: ${info.tasks}

Storage Used: ${info.storageSizeKB} KB

Check the browser console (F12) for detailed information.

${maintenanceLogs.length > 0 ? '\nRecent Logs:\n' + maintenanceLogs.slice(-5).map((log, i) =>
    `${i+1}. Robot: ${log.robotId}, Date: ${log.date}, Tasks: ${log.tasks.length}`
).join('\n') : 'No logs found in memory!'}
    `;
    alert(debugMessage);
    console.log('=== DETAILED DEBUG INFO ===');
    console.table(maintenanceLogs);
}

// Form handlers
function initForms() {
    document.getElementById('robotForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addRobot();
    });
    document.getElementById('logForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addLog();
    });
    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addCustomTask();
    });
}

// Initialize filters
function initFilters() {
    document.getElementById('overviewRobotFilter').addEventListener('change', renderRobots);
    document.getElementById('overviewCustomerFilter').addEventListener('change', renderRobots);
    document.getElementById('robotLogSelect').addEventListener('change', renderLogs);
}

// Add new robot or save edit
function addRobot() {
    if (editingRobotId) {
        // Update existing robot
        const idx = robots.findIndex(r => r.id === editingRobotId);
        if (idx !== -1) {
            robots[idx] = {
                ...robots[idx],
                customer: document.getElementById('robotCustomer').value,
                location: document.getElementById('robotLocation').value,
                application: document.getElementById('robotApplication').value,
                owner: document.getElementById('robotOwner').value,
                ownerEmail: document.getElementById('robotOwnerEmail').value,
                ownerWebhookUrl: document.getElementById('robotOwnerWebhook').value.trim(),
                installDate: document.getElementById('robotInstallDate').value,
            };
        }
    } else {
        // Add new robot
        const robot = {
            id: document.getElementById('robotId').value,
            customer: document.getElementById('robotCustomer').value,
            location: document.getElementById('robotLocation').value,
            application: document.getElementById('robotApplication').value,
            owner: document.getElementById('robotOwner').value,
            ownerEmail: document.getElementById('robotOwnerEmail').value,
            ownerWebhookUrl: document.getElementById('robotOwnerWebhook').value.trim(),
            installDate: document.getElementById('robotInstallDate').value,
            trackingStartDate: new Date().toISOString().split('T')[0],
            status: 'good'
        };
        robots.push(robot);
    }

    saveData();
    renderRobots();
    populateRobotSelects();
    populateOverviewFilters();
    renderDashboard();
    renderOwnerWebhookList();

    document.getElementById('robotModal').classList.remove('show');
    resetRobotModal();
}

// Open robot modal pre-filled for editing
function editRobot(robotId) {
    if (!robotId) return;
    const robot = robots.find(r => r.id === robotId);
    if (!robot) return;

    editingRobotId = robotId;
    document.getElementById('robotId').value = robot.id;
    document.getElementById('robotId').readOnly = true;
    document.getElementById('robotCustomer').value = robot.customer;
    document.getElementById('robotLocation').value = robot.location;
    document.getElementById('robotApplication').value = robot.application;
    document.getElementById('robotOwner').value = robot.owner || '';
    document.getElementById('robotOwnerEmail').value = robot.ownerEmail || '';
    document.getElementById('robotOwnerWebhook').value = robot.ownerWebhookUrl || '';
    document.getElementById('robotInstallDate').value = robot.installDate || '';

    document.getElementById('robotModalTitle').textContent = `Edit Robot: ${robotId}`;
    document.querySelector('#robotForm button[type="submit"]').textContent = 'Save Changes';
    document.getElementById('robotModal').classList.add('show');
}

// Add custom task
function addCustomTask() {
    const task = {
        task: document.getElementById('taskName').value,
        frequency: document.getElementById('taskFrequency').value,
        partNumber: document.getElementById('taskPartNumber').value,
        note: document.getElementById('taskNote').value,
        isCustom: true
    };

    customTasks.push(task);
    saveData();
    renderSchedule();
    renderTaskChecklist();

    document.getElementById('taskModal').classList.remove('show');
    document.getElementById('taskForm').reset();
}

// Add maintenance log
function addLog() {
    const robotId = document.getElementById('logRobotSelect').value;
    const date = document.getElementById('logDate').value;
    const notes = document.getElementById('logNotes').value;
    const photosInput = document.getElementById('logPhotos');

    const checkedTasks = [];
    document.querySelectorAll('#taskChecklist input[type="checkbox"]:checked').forEach(checkbox => {
        checkedTasks.push(checkbox.value);
    });

    if (checkedTasks.length === 0) {
        alert('Please select at least one task');
        return;
    }

    const log = {
        id: Date.now(),
        robotId: robotId,
        date: date,
        tasks: checkedTasks,
        notes: notes,
        photos: []
    };

    console.log('Creating log entry:', log);

    const finalizeLog = () => {
        maintenanceLogs.push(log);
        saveData();
        renderLogs();
        renderDashboard();
        updateRobotStatuses();
        renderRobots();
        console.log('Log saved. Total logs:', maintenanceLogs.length);
        document.getElementById('logModal').classList.remove('show');
        document.getElementById('logForm').reset();
        renderTaskChecklist();
    };

    if (photosInput.files.length > 0) {
        const submitBtn = document.querySelector('#logForm button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = `Uploading ${photosInput.files.length} photo(s)...`;
        submitBtn.disabled = true;

        const uploadPhoto = async (file) => {
            // Upload to Supabase Storage if connected
            if (supabaseClient) {
                const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                const { error } = await supabaseClient.storage
                    .from('maintenance-photos')
                    .upload(filename, file, { contentType: file.type });
                if (!error) {
                    const { data: { publicUrl } } = supabaseClient.storage
                        .from('maintenance-photos')
                        .getPublicUrl(filename);
                    return publicUrl;
                }
            }
            // Fallback: base64 in localStorage
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
        };

        Promise.all(Array.from(photosInput.files).map(uploadPhoto))
            .then(urls => {
                log.photos = urls.filter(u => u !== null);
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                finalizeLog();
            })
            .catch(err => {
                console.error('Photo upload error:', err);
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                finalizeLog();
            });
    } else {
        finalizeLog();
    }
}

// ==========================================
// MAINTENANCE DUE DATE CALCULATIONS
// ==========================================

// Weekly: every Monday and Thursday
// Monthly: 1st of every month
// Quarterly: 1st of Jan, Apr, Jul, Oct
// Semi-Annual: 1st of Jan, Jul
// Annual: 1st of Jan

function getNextDueDate(frequency, _lastMaintenanceDate, trackingStartDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (frequency === 'weekly') return getNextWeeklyDue();
    if (frequency === 'monthly') return getNextMonthlyDue();
    if (frequency === 'quarterly') return getNextQuarterlyDue();
    if (frequency === 'semiAnnual') return getNextSemiAnnualDue();
    if (frequency === 'annual') return getNextAnnualDue();

    // Fallback for other frequencies
    const intervalDays = frequencyDays[frequency] || 30;
    const startDate = new Date(trackingStartDate || today);
    startDate.setHours(0, 0, 0, 0);
    const nextDue = new Date(startDate);
    nextDue.setDate(nextDue.getDate() + intervalDays);
    return nextDue;
}

// Weekly: next Monday (1) or Thursday (4)
function getNextWeeklyDue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();

    let daysToMon = (1 - day + 7) % 7;
    let daysToThu = (4 - day + 7) % 7;
    if (daysToMon === 0) daysToMon = 0;
    if (daysToThu === 0) daysToThu = 0;

    const nextDays = Math.min(daysToMon, daysToThu);
    const nextDue = new Date(today);
    nextDue.setDate(nextDue.getDate() + nextDays);
    return nextDue;
}

// Monthly: 1st of next month (or today if it's the 1st)
function getNextMonthlyDue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today.getDate() === 1) return today;
    const nextDue = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return nextDue;
}

// Quarterly: 1st of Jan(0), Apr(3), Jul(6), Oct(9)
function getNextQuarterlyDue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const quarterMonths = [0, 3, 6, 9];
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    for (const m of quarterMonths) {
        if (m > currentMonth || (m === currentMonth && currentDay === 1)) {
            return new Date(today.getFullYear(), m, 1);
        }
    }
    // Next year January
    return new Date(today.getFullYear() + 1, 0, 1);
}

// Semi-Annual: 1st of Jan(0), Jul(6)
function getNextSemiAnnualDue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const semiMonths = [0, 6];
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    for (const m of semiMonths) {
        if (m > currentMonth || (m === currentMonth && currentDay === 1)) {
            return new Date(today.getFullYear(), m, 1);
        }
    }
    return new Date(today.getFullYear() + 1, 0, 1);
}

// Annual: 1st of Jan
function getNextAnnualDue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today.getMonth() === 0 && today.getDate() === 1) return today;
    return new Date(today.getFullYear() + 1, 0, 1);
}

function getLastMaintenanceDateForFrequency(robotId, frequency) {
    // Get all tasks in this frequency category
    const mergedSchedule = getMergedSchedule();
    const tasksInFrequency = mergedSchedule[frequency] || [];
    const taskNames = tasksInFrequency.map(t => t.task);

    // Find the most recent log entry for this robot that includes any task from this frequency
    const robotLogs = maintenanceLogs
        .filter(log => log.robotId === robotId)
        .filter(log => log.tasks.some(t => taskNames.includes(t)))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return robotLogs.length > 0 ? robotLogs[0].date : null;
}

function getMaintenanceStatus(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { status: 'overdue', label: `Overdue by ${Math.abs(diffDays)} day(s)`, daysUntil: diffDays, class: 'alert-overdue' };
    } else if (diffDays === 0) {
        return { status: 'due-soon', label: 'Due today!', daysUntil: 0, class: 'alert-due-soon' };
    } else if (diffDays === 1) {
        return { status: 'due-soon', label: 'Due tomorrow', daysUntil: 1, class: 'alert-due-soon' };
    } else {
        return { status: 'ok', label: `Due in ${diffDays} days`, daysUntil: diffDays, class: 'alert-ok' };
    }
}

function getMergedSchedule() {
    const mergedSchedule = {};
    for (const key in maintenanceSchedule) {
        mergedSchedule[key] = [...maintenanceSchedule[key]];
    }
    if (!mergedSchedule.daily) mergedSchedule.daily = [];
    customTasks.forEach(task => {
        if (!mergedSchedule[task.frequency]) {
            mergedSchedule[task.frequency] = [];
        }
        mergedSchedule[task.frequency].push(task);
    });
    return mergedSchedule;
}

function getAllMaintenanceAlerts() {
    const alerts = [];
    const frequencyLabels = {
        daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
        quarterly: 'Quarterly', semiAnnual: 'Semi-Annual',
        annual: 'Annual', biennial: 'Biennial',
        threeYear: 'Every 3 Years', other: 'Other'
    };

    robots.forEach(robot => {
        if (!robot.installDate) return;

        const activeFrequencies = ['weekly', 'monthly', 'quarterly', 'semiAnnual', 'annual'];
        activeFrequencies.forEach(frequency => {
            const mergedSchedule = getMergedSchedule();
            const tasks = mergedSchedule[frequency];
            if (!tasks || tasks.length === 0) return;

            const lastMaint = getLastMaintenanceDateForFrequency(robot.id, frequency);
            const nextDue = getNextDueDate(frequency, lastMaint, robot.trackingStartDate);
            const statusInfo = getMaintenanceStatus(nextDue);

            alerts.push({
                robotId: robot.id,
                customer: robot.customer,
                owner: robot.owner || 'Unassigned',
                ownerEmail: robot.ownerEmail || '',
                frequency: frequency,
                frequencyLabel: frequencyLabels[frequency] || frequency,
                tasks: tasks.map(t => t.task),
                lastMaintenance: lastMaint,
                nextDue: nextDue,
                statusInfo: statusInfo,
                deploymentDate: robot.installDate
            });
        });
    });

    // Sort: overdue first, then due-soon, then ok
    alerts.sort((a, b) => a.statusInfo.daysUntil - b.statusInfo.daysUntil);
    return alerts;
}

function updateRobotStatuses() {
    robots.forEach(robot => {
        if (!robot.installDate) {
            robot.status = 'good';
            return;
        }

        let worstStatus = 'good';
        const activeFrequencies = ['weekly', 'monthly', 'quarterly', 'semiAnnual', 'annual'];
        activeFrequencies.forEach(frequency => {
            const mergedSchedule = getMergedSchedule();
            const tasks = mergedSchedule[frequency];
            if (!tasks || tasks.length === 0) return;

            const lastMaint = getLastMaintenanceDateForFrequency(robot.id, frequency);
            const nextDue = getNextDueDate(frequency, lastMaint, robot.trackingStartDate);
            const statusInfo = getMaintenanceStatus(nextDue);

            if (statusInfo.status === 'overdue') {
                worstStatus = 'overdue';
            } else if (statusInfo.status === 'due-soon' && worstStatus !== 'overdue') {
                worstStatus = 'due';
            }
        });

        robot.status = worstStatus;
    });
    saveData();
}

// ==========================================
// RENDER DASHBOARD
// ==========================================

function renderDashboard() {
    const summaryEl = document.getElementById('dashboardSummary');
    const alertsEl = document.getElementById('maintenanceAlerts');
    const filterSelect = document.getElementById('dashboardRobotFilter');

    // Populate filter dropdown
    if (filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Robots</option>';
        robots.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = `${r.id} — ${r.customer}`;
            if (r.id === currentVal) opt.selected = true;
            filterSelect.appendChild(opt);
        });
    }

    const robotFilter = filterSelect ? filterSelect.value : '';

    if (robots.length === 0) {
        summaryEl.innerHTML = '';
        alertsEl.innerHTML = `<div class="empty-state"><h3>No robots added yet</h3><p>Add robots in the Overview tab</p></div>`;
        return;
    }

    updateRobotStatuses();

    // Summary chips (all robots, ignore filter)
    const robotsOverdue = robots.filter(r => r.status === 'overdue').length;
    const robotsDue    = robots.filter(r => r.status === 'due').length;
    const robotsOk     = robots.filter(r => r.status === 'good').length;

    summaryEl.innerHTML = `
        <div class="summary-cards">
            <div class="summary-card summary-overdue"><div class="summary-number">${robotsOverdue}</div><div class="summary-label">Overdue</div></div>
            <div class="summary-card summary-due-soon"><div class="summary-number">${robotsDue}</div><div class="summary-label">Due Soon</div></div>
            <div class="summary-card summary-ok"><div class="summary-number">${robotsOk}</div><div class="summary-label">On Track</div></div>
            <div class="summary-card summary-total"><div class="summary-number">${robots.length}</div><div class="summary-label">Total Robots</div></div>
        </div>`;

    const freqCols = [
        { key: 'weekly',     label: 'Weekly' },
        { key: 'monthly',    label: 'Monthly' },
        { key: 'quarterly',  label: 'Quarterly' },
        { key: 'semiAnnual', label: 'Semi-Ann.' },
        { key: 'annual',     label: 'Annual' }
    ];

    const filteredRobots = robotFilter ? robots.filter(r => r.id === robotFilter) : robots;

    const rows = filteredRobots.map(robot => {
        const statusLabel = robot.status === 'good' ? 'On Track' : robot.status === 'due' ? 'Due Soon' : 'Overdue';

        const freqCells = freqCols.map(({ key }) => {
            const lastMaint = getLastMaintenanceDateForFrequency(robot.id, key);
            const nextDue   = getNextDueDate(key, lastMaint, robot.trackingStartDate);
            const si        = getMaintenanceStatus(nextDue);
            const icon      = si.status === 'overdue' ? '🔴' : si.status === 'due-soon' ? '🟡' : '🟢';
            const nextStr   = nextDue ? nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
            const label     = si.status === 'overdue' ? 'Overdue' : (si.status === 'due-soon' ? 'Due Soon' : nextStr);
            return `<td class="dash-cell dash-cell-${si.status}"><span class="dash-icon">${icon}</span><span class="dash-date">${label}</span></td>`;
        }).join('');

        return `<tr>
            <td class="dash-robot-id">${robot.id}</td>
            <td class="dash-customer">${robot.customer}</td>
            <td class="dash-location">${robot.location}</td>
            <td class="dash-owner">${robot.owner || '—'}</td>
            <td><span class="rsc-badge rsc-badge-${robot.status}">${statusLabel}</span></td>
            ${freqCells}
        </tr>`;
    }).join('');

    alertsEl.innerHTML = `
        <div class="dash-table-wrapper">
            <table class="dash-table">
                <thead>
                    <tr>
                        <th>Robot ID</th>
                        <th>Customer</th>
                        <th>Location</th>
                        <th>Owner</th>
                        <th>Status</th>
                        ${freqCols.map(f => `<th>${f.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================

function getRobotNextDueInfo(robot) {
    const freqs = ['weekly', 'monthly', 'quarterly', 'semiAnnual', 'annual'];
    const freqLabels = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', semiAnnual: 'Semi-Annual', annual: 'Annual' };
    let mostUrgent = null;
    freqs.forEach(freq => {
        const lastMaint = getLastMaintenanceDateForFrequency(robot.id, freq);
        const nextDue = getNextDueDate(freq, lastMaint, robot.trackingStartDate);
        const si = getMaintenanceStatus(nextDue);
        if (!mostUrgent || si.status === 'overdue' || (si.status === 'due-soon' && mostUrgent.siStatus === 'ok')) {
            mostUrgent = { freq, label: freqLabels[freq], nextDue, siStatus: si.status, siLabel: si.label };
        }
    });
    return mostUrgent;
}

function renderRobots() {
    const robotList = document.getElementById('robotList');
    const robotFilter = document.getElementById('overviewRobotFilter').value;
    const customerFilter = document.getElementById('overviewCustomerFilter').value;

    if (robots.length === 0) {
        document.getElementById('fleetSummaryBar').innerHTML = '';
        robotList.innerHTML = `
            <div class="empty-state">
                <h3>No robots added yet</h3>
                <p>Click "+ Add Robot" to get started</p>
            </div>`;
        return;
    }

    updateRobotStatuses();

    // Fleet summary bar
    const nOverdue = robots.filter(r => r.status === 'overdue').length;
    const nDue     = robots.filter(r => r.status === 'due').length;
    const nOk      = robots.filter(r => r.status === 'good').length;
    document.getElementById('fleetSummaryBar').innerHTML = `
        <div class="fleet-summary-bar">
            <span class="fsb-total">${robots.length} Robot${robots.length !== 1 ? 's' : ''}</span>
            <span class="fsb-divider">·</span>
            ${nOverdue > 0 ? `<span class="fsb-chip fsb-overdue">🔴 ${nOverdue} Overdue</span>` : ''}
            ${nDue > 0     ? `<span class="fsb-chip fsb-due">🟡 ${nDue} Due Soon</span>` : ''}
            <span class="fsb-chip fsb-ok">🟢 ${nOk} On Track</span>
        </div>`;

    let filteredRobots = robots;
    if (robotFilter) filteredRobots = filteredRobots.filter(r => r.id === robotFilter);
    if (customerFilter) filteredRobots = filteredRobots.filter(r => r.customer === customerFilter);

    if (filteredRobots.length === 0) {
        robotList.innerHTML = `
            <div class="empty-state">
                <h3>No robots match the selected filters</h3>
                <p>Try adjusting your filters</p>
            </div>`;
        return;
    }

    robotList.innerHTML = filteredRobots.map(robot => {
        const statusLabel = robot.status === 'good' ? 'On Track' : robot.status === 'due' ? 'Due Soon' : 'Overdue';
        const daysActive = robot.installDate
            ? Math.floor((new Date() - new Date(robot.installDate)) / (1000*60*60*24))
            : null;
        const nextDue = getRobotNextDueInfo(robot);
        const nextDueText = nextDue
            ? (nextDue.siStatus === 'overdue'
                ? `⚠️ ${nextDue.label} overdue`
                : nextDue.siStatus === 'due-soon'
                    ? `🕐 ${nextDue.label} due soon`
                    : `✅ Next: ${nextDue.label} on ${nextDue.nextDue ? nextDue.nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}`)
            : '';

        return `
        <div class="rc rc-border-${robot.status}">
            <div class="rc-stripe rc-stripe-${robot.status}"></div>
            <div class="rc-body">
                <div class="rc-top">
                    <div class="rc-id">${robot.id}</div>
                    <span class="rc-badge rc-badge-${robot.status}">${statusLabel}</span>
                </div>
                <div class="rc-company">${robot.customer}</div>
                <div class="rc-details">
                    <div class="rc-detail"><span class="rc-di">📍</span>${robot.location}</div>
                    <div class="rc-detail"><span class="rc-di">👤</span>${robot.owner || '—'}</div>
                    ${robot.application ? `<div class="rc-detail"><span class="rc-di">⚙️</span>${robot.application}</div>` : ''}
                    <div class="rc-detail"><span class="rc-di">📅</span>${robot.installDate ? formatDate(robot.installDate) : 'No install date'}${daysActive !== null ? ` <span class="rc-days">(${daysActive}d)</span>` : ''}</div>
                </div>
                ${nextDueText ? `<div class="rc-next-due rc-next-${nextDue.siStatus}">${nextDueText}</div>` : ''}
            </div>
            <div class="rc-actions">
                <button class="rc-btn-edit" onclick="editRobot('${robot.id}')">✏️ Edit</button>
                <button class="rc-btn-delete" onclick="deleteRobot('${robot.id}')">🗑️ Delete</button>
            </div>
        </div>`;
    }).join('');
}

// Render maintenance schedule
function renderSchedule() {
    const scheduleTable = document.getElementById('scheduleTable');
    const frequencyLabels = {
        daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
        quarterly: 'Quarterly (Every 3 Months)',
        semiAnnual: 'Semi-Annual (Every 6 Months)',
        annual: 'Annual (Every 12 Months)',
        biennial: 'Every 2 Years', threeYear: 'Every 3 Years',
        other: 'Other Schedules'
    };

    const mergedSchedule = getMergedSchedule();

    scheduleTable.innerHTML = Object.entries(mergedSchedule)
        .filter(([frequency, tasks]) => tasks.length > 0)
        .map(([frequency, tasks]) => `
        <div class="schedule-section">
            <h3 class="schedule-frequency">${frequencyLabels[frequency] || frequency}</h3>
            <table>
                <thead>
                    <tr>
                        <th>Maintenance Task</th>
                        <th>Part Number</th>
                        <th>Note</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map(item => `
                        <tr>
                            <td>${item.task}${item.isCustom ? ' <span class="custom-badge">Custom</span>' : ''}</td>
                            <td>${item.partNumber || '-'}</td>
                            <td>${item.note || '-'}</td>
                            <td>
                                ${item.isCustom ? `<button class="btn-delete" onclick="deleteCustomTask('${item.task}', '${frequency}')">Delete</button>` : '-'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('');
}

// Delete custom task
function deleteCustomTask(taskName, frequency) {
    if (confirm(`Delete task "${taskName}"?`)) {
        customTasks = customTasks.filter(t => !(t.task === taskName && t.frequency === frequency));
        saveData();
        renderSchedule();
        renderTaskChecklist();
    }
}

// Select robot
function selectRobot(robotId) {
    if (selectedRobotId === robotId) {
        selectedRobotId = null;
    } else {
        selectedRobotId = robotId;
    }
    renderRobots();
}

// Update robot action buttons visibility
function updateDeleteRobotButton() {
    const deleteBtn = document.getElementById('deleteRobotBtn');
    const editBtn = document.getElementById('editRobotBtn');
    if (selectedRobotId) {
        deleteBtn.style.display = 'block';
        deleteBtn.textContent = `Delete "${selectedRobotId}"`;
        editBtn.style.display = 'block';
        editBtn.textContent = `Edit "${selectedRobotId}"`;
    } else {
        deleteBtn.style.display = 'none';
        editBtn.style.display = 'none';
    }
}

// Delete robot — accepts direct id (from card button) or falls back to selectedRobotId
function deleteRobot(robotId) {
    const id = robotId || selectedRobotId;
    if (!id) return;
    const robot = robots.find(r => r.id === id);
    if (!robot) return;
    selectedRobotId = id; // keep in sync for existing code paths

    const associatedLogs = maintenanceLogs.filter(log => log.robotId === id);
    let confirmMessage = `Are you sure you want to delete robot "${id}"?`;
    if (associatedLogs.length > 0) {
        confirmMessage += `\n\nThis robot has ${associatedLogs.length} maintenance log(s) that will also be deleted.`;
    }
    confirmMessage += '\n\nThis action cannot be undone.';

    if (confirm(confirmMessage)) {
        robots = robots.filter(r => r.id !== selectedRobotId);
        maintenanceLogs = maintenanceLogs.filter(log => log.robotId !== selectedRobotId);
        console.log(`Robot ${selectedRobotId} and ${associatedLogs.length} associated log(s) deleted`);
        selectedRobotId = null;
        saveData();
        renderRobots();
        renderLogs();
        renderDashboard();
        populateRobotSelects();
        populateOverviewFilters();
    }
}

// Delete log entry
function deleteLog(logId) {
    const log = maintenanceLogs.find(l => l.id === logId);
    if (!log) return;
    const confirmMessage = `Delete this maintenance log?\n\nRobot: ${log.robotId}\nDate: ${formatDate(log.date)}\nTasks: ${log.tasks.length}\n\nThis action cannot be undone.`;
    if (confirm(confirmMessage)) {
        maintenanceLogs = maintenanceLogs.filter(l => l.id !== logId);
        saveData();
        renderLogs();
        renderDashboard();
        console.log(`Log ${logId} deleted`);
    }
}

// Render task checklist for log entry
function renderTaskChecklist() {
    const checklist = document.getElementById('taskChecklist');
    const frequencyLabels = {
        daily: 'Daily Tasks', weekly: 'Weekly Tasks', monthly: 'Monthly Tasks',
        quarterly: 'Quarterly Tasks', semiAnnual: 'Semi-Annual Tasks',
        annual: 'Annual Tasks', biennial: 'Biennial Tasks',
        threeYear: 'Every 3 Years', other: 'Other Tasks'
    };

    const mergedSchedule = getMergedSchedule();

    checklist.innerHTML = Object.entries(mergedSchedule)
        .filter(([frequency, tasks]) => tasks.length > 0)
        .map(([frequency, tasks]) => `
        <div class="checklist-section">
            <h4>${frequencyLabels[frequency] || frequency}</h4>
            ${tasks.map(item => `
                <label class="checkbox-label">
                    <input type="checkbox" name="task" value="${item.task}">
                    <span>${item.task}${item.isCustom ? ' <span class="custom-tag">(Custom)</span>' : ''}</span>
                </label>
            `).join('')}
        </div>
    `).join('');
}

// Render maintenance logs
function renderLogs() {
    const logEntries = document.getElementById('logEntries');
    const robotFilter = document.getElementById('robotLogSelect').value;

    console.log('Rendering logs. Total logs:', maintenanceLogs.length);

    if (maintenanceLogs.length === 0) {
        logEntries.innerHTML = `
            <div class="empty-state">
                <h3>No maintenance logs yet</h3>
                <p>Click "Add Log Entry" to record maintenance activities</p>
            </div>`;
        return;
    }

    let filteredLogs = maintenanceLogs;
    if (robotFilter) {
        filteredLogs = maintenanceLogs.filter(log => log.robotId === robotFilter);
    }

    if (filteredLogs.length === 0) {
        logEntries.innerHTML = `
            <div class="empty-state">
                <h3>No logs found for selected robot</h3>
                <p>Try selecting a different robot or add new log entries</p>
            </div>`;
        return;
    }

    const sortedLogs = [...filteredLogs].sort((a, b) => new Date(b.date) - new Date(a.date));

    logEntries.innerHTML = `
        <div class="logs-table-container">
            <table class="logs-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Robot ID</th>
                        <th>Tasks Completed</th>
                        <th>Notes</th>
                        <th>Photos</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedLogs.map(log => {
                        const robot = robots.find(r => r.id === log.robotId);
                        return `
                            <tr>
                                <td class="log-date-cell">
                                    <div class="date-display">
                                        <span class="date-day">${new Date(log.date).getDate()}</span>
                                        <span class="date-month">${new Date(log.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                                    </div>
                                </td>
                                <td class="robot-id-cell">
                                    <strong>${robot ? robot.id : log.robotId}</strong>
                                    ${robot ? `<div class="robot-customer">${robot.customer}</div>` : ''}
                                </td>
                                <td class="tasks-cell">
                                    <ul class="tasks-list">
                                        ${log.tasks.map(task => `<li>${task}</li>`).join('')}
                                    </ul>
                                </td>
                                <td class="notes-cell">
                                    ${log.notes ? `<div class="notes-text">${log.notes}</div>` : '<span class="no-notes">—</span>'}
                                </td>
                                <td class="photos-cell">
                                    ${log.photos && log.photos.length > 0 ? `
                                        <div class="photo-thumbnails">
                                            ${log.photos.map((photo, index) => `
                                                <img src="${photo}"
                                                     alt="Photo ${index + 1}"
                                                     class="thumbnail"
                                                     onclick="openPhotoModal('${photo.replace(/'/g, "\\'")}')">
                                            `).join('')}
                                            <span class="photo-count">${log.photos.length} photo${log.photos.length > 1 ? 's' : ''}</span>
                                        </div>
                                    ` : '<span class="no-photos">—</span>'}
                                </td>
                                <td class="actions-cell">
                                    <button class="btn-delete" onclick="deleteLog(${log.id})" title="Delete this log entry">Delete</button>
                                </td>
                            </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Open photo in modal
function openPhotoModal(photoSrc) {
    const modal = document.createElement('div');
    modal.className = 'photo-modal';
    modal.innerHTML = `
        <div class="photo-modal-content">
            <span class="photo-close">&times;</span>
            <img src="${photoSrc}" alt="Full size photo">
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.className === 'photo-close') {
            modal.remove();
        }
    });
}

// ==========================================
// TEAMS WEBHOOK INTEGRATION
// ==========================================

function getWebhookUrl() {
    return localStorage.getItem('teamsWebhookUrl') || '';
}

// ==========================================
// GITHUB CONFIG
// ==========================================

function saveGithubConfig() {
    const repo = document.getElementById('githubRepo').value.trim();
    const token = document.getElementById('githubToken').value.trim();
    const statusEl = document.getElementById('githubStatus');

    if (!repo || !token) {
        statusEl.innerHTML = '<span class="status-error">Please enter both the repo name and token.</span>';
        return;
    }

    localStorage.setItem('githubRepo', repo);
    localStorage.setItem('githubToken', token);
    updateGithubStatusBadge();
    statusEl.innerHTML = '<span class="status-success">GitHub config saved! "Send Now" buttons will now work from GitHub Pages.</span>';
}

function loadGithubConfig() {
    const repoInput = document.getElementById('githubRepo');
    const tokenInput = document.getElementById('githubToken');
    const savedRepo = localStorage.getItem('githubRepo');
    const savedToken = localStorage.getItem('githubToken');
    if (repoInput && savedRepo) repoInput.value = savedRepo;
    if (tokenInput && savedToken) tokenInput.value = savedToken;
    updateGithubStatusBadge();
}

function updateGithubStatusBadge() {
    const badge = document.getElementById('githubConnectionBadge');
    if (!badge) return;
    const repo = localStorage.getItem('githubRepo');
    const token = localStorage.getItem('githubToken');
    if (repo && token) {
        badge.textContent = `🟢 GitHub configured (${repo}) — "Send Now" uses GitHub Actions`;
        badge.className = 'connection-badge badge-connected';
    } else {
        badge.textContent = '🔴 GitHub not configured — "Send Now" will try direct (may hit CORS)';
        badge.className = 'connection-badge badge-disconnected';
    }
}

// Core Teams send — uses GitHub Actions API (server-side, no CORS) when configured,
// falls back to direct fetch for local testing.
function sendToTeams(webhookUrl, message, statusEl, successMsg) {
    const githubRepo = localStorage.getItem('githubRepo');
    const githubToken = localStorage.getItem('githubToken');

    if (githubRepo && githubToken) {
        // Encode message and target URL as base64 so they pass safely through GitHub's workflow_dispatch inputs
        const msgB64 = btoa(unescape(encodeURIComponent(JSON.stringify(message))));
        const urlB64 = btoa(unescape(encodeURIComponent(webhookUrl)));

        if (statusEl) statusEl.innerHTML = '<span class="status-pending">Triggering GitHub Action...</span>';

        fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/send-teams-now.yml/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ref: 'main', inputs: { message_b64: msgB64, webhook_url_b64: urlB64 } })
        })
        .then(res => {
            if (!statusEl) return;
            if (res.status === 204) {
                statusEl.innerHTML = `<span class="status-success">${successMsg} — sent via GitHub Actions. Check Teams in about 30 seconds.</span>`;
            } else {
                res.json().then(data => {
                    statusEl.innerHTML = `<span class="status-error">GitHub API error: ${data.message}. Make sure your token has Actions: Read and write permission.</span>`;
                });
            }
        })
        .catch(err => {
            if (statusEl) statusEl.innerHTML = `<span class="status-error">Error: ${err.message}</span>`;
        });

    } else {
        // No GitHub config — try direct fetch (works locally, may CORS-fail on GitHub Pages)
        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        })
        .then(r => {
            if (!statusEl) return;
            if (r.ok) statusEl.innerHTML = `<span class="status-success">${successMsg}</span>`;
            else r.text().then(t => statusEl.innerHTML = `<span class="status-error">Failed (${r.status}): ${t}</span>`);
        })
        .catch(err => {
            if (statusEl) statusEl.innerHTML = `<span class="status-error">CORS error — add your GitHub repo &amp; token in the GitHub Integration section above. Error: ${err.message}</span>`;
        });
    }
}

// ==========================================
// ROBOT OWNER WEBHOOK MANAGEMENT
// ==========================================

function renderOwnerWebhookList() {
    const el = document.getElementById('ownerWebhookList');
    if (!el) return;

    if (robots.length === 0) {
        el.innerHTML = '<p class="instruction-text">No robots added yet. Add robots in the Overview tab first.</p>';
        return;
    }

    el.innerHTML = `
        <table class="owner-webhook-table">
            <thead>
                <tr>
                    <th>Robot ID</th>
                    <th>Owner</th>
                    <th>Teams Webhook URL</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${robots.map(r => `
                <tr>
                    <td class="owr-id">${r.id}<br><small class="owr-customer">${r.customer}</small></td>
                    <td class="owr-owner">${r.owner || '—'}</td>
                    <td><input type="url" class="owr-input" id="owr-url-${r.id}"
                        value="${r.ownerWebhookUrl || ''}"
                        placeholder="Paste Teams webhook URL..."></td>
                    <td class="owr-actions">
                        <button class="btn-primary btn-sm" onclick="saveOwnerWebhook('${r.id}')">Save</button>
                        <button class="btn-secondary btn-sm" onclick="testOwnerWebhook('${r.id}')">Test</button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

function saveOwnerWebhook(robotId) {
    const input = document.getElementById(`owr-url-${robotId}`);
    if (!input) return;
    const url = input.value.trim();
    const idx = robots.findIndex(r => r.id === robotId);
    if (idx === -1) return;
    robots[idx].ownerWebhookUrl = url;
    saveData();
    const statusEl = document.getElementById('ownerWebhookStatus');
    statusEl.innerHTML = `<span class="status-success">✅ Saved webhook for ${robotId}${url ? '' : ' (cleared)'}</span>`;
    setTimeout(() => { statusEl.innerHTML = ''; }, 3000);
}

function testOwnerWebhook(robotId) {
    const input = document.getElementById(`owr-url-${robotId}`);
    const statusEl = document.getElementById('ownerWebhookStatus');
    const url = input ? input.value.trim() : '';
    if (!url) {
        statusEl.innerHTML = `<span class="status-error">Enter a webhook URL for ${robotId} and click Save first.</span>`;
        return;
    }
    const robot = robots.find(r => r.id === robotId);
    const testMsg = {
        type: "message",
        attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            contentUrl: null,
            content: {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": [
                    { "type": "TextBlock", "size": "Large", "weight": "Bolder", "text": `✅ Test Message — ${robotId}`, "color": "Good" },
                    { "type": "TextBlock", "text": `Hi **${robot ? (robot.owner || robotId) : robotId}** — your robot maintenance reminders are connected! This channel will receive weekly maintenance tasks for **${robotId}**.`, "wrap": true }
                ]
            }
        }]
    };
    statusEl.innerHTML = `<span class="status-pending">Sending test to ${robotId} owner channel...</span>`;
    sendToTeams(url, testMsg, statusEl, `✅ Test sent to ${robotId} owner channel!`);
}

// ==========================================
// DAILY REMINDER ITEM MANAGEMENT
// ==========================================

function renderDailyReminderList() {
    const el = document.getElementById('dailyReminderList');
    if (!el) return;
    if (dailyReminderItems.length === 0) {
        el.innerHTML = '<p class="instruction-text">No items yet. Click &quot;+ Add Item&quot; to add one.</p>';
        return;
    }
    el.innerHTML = dailyReminderItems.map(item => `
        <div class="dr-item" id="dr-item-${item.id}">
            <div class="dr-item-view">
                <div class="dr-item-content">
                    <span class="dr-item-label">☐ ${item.label}</span>
                    ${item.url ? `<a class="dr-item-url" href="${item.url}" target="_blank">🔗 ${item.url}</a>` : ''}
                </div>
                <div class="dr-item-actions">
                    <button class="btn-icon" onclick="editDailyItem('${item.id}')" title="Edit">✏️</button>
                    <button class="btn-icon btn-icon-delete" onclick="deleteDailyItem('${item.id}')" title="Delete">🗑️</button>
                </div>
            </div>
        </div>`).join('');
}

function addDailyItem() {
    const newId = 'dr' + Date.now();
    dailyReminderItems.push({ id: newId, label: '', url: '' });
    saveData();
    renderDailyReminderList();
    editDailyItem(newId);
}

function editDailyItem(id) {
    const item = dailyReminderItems.find(i => i.id === id);
    if (!item) return;
    const el = document.getElementById(`dr-item-${id}`);
    if (!el) return;
    el.innerHTML = `
        <div class="dr-item-edit">
            <input type="text" class="dr-edit-label" value="${item.label}" placeholder="Task description (required)">
            <input type="url" class="dr-edit-url" value="${item.url || ''}" placeholder="Link URL (optional)">
            <div class="dr-edit-actions">
                <button class="btn-primary btn-sm" onclick="saveDailyItemEdit('${id}')">Save</button>
                <button class="btn-secondary btn-sm" onclick="renderDailyReminderList()">Cancel</button>
            </div>
        </div>`;
    el.querySelector('.dr-edit-label').focus();
}

function saveDailyItemEdit(id) {
    const el = document.getElementById(`dr-item-${id}`);
    if (!el) return;
    const label = el.querySelector('.dr-edit-label').value.trim();
    const url = el.querySelector('.dr-edit-url').value.trim();
    if (!label) { el.querySelector('.dr-edit-label').style.border = '1px solid red'; return; }
    const idx = dailyReminderItems.findIndex(i => i.id === id);
    if (idx !== -1) dailyReminderItems[idx] = { ...dailyReminderItems[idx], label, url };
    saveData();
    renderDailyReminderList();
}

function deleteDailyItem(id) {
    if (!confirm('Delete this reminder item?')) return;
    dailyReminderItems = dailyReminderItems.filter(i => i.id !== id);
    saveData();
    renderDailyReminderList();
}

function sendDailyReminder() {
    const statusEl = document.getElementById('manualSendStatus');
    const url = getWebhookUrl();
    if (!url) { statusEl.innerHTML = '<span class="status-error">No webhook URL saved. Set it up in Step 2 above first.</span>'; return; }
    if (dailyReminderItems.length === 0) { statusEl.innerHTML = '<span class="status-error">No daily reminder items configured. Add items in the Daily Reminder Items section.</span>'; return; }

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const bodyItems = [
        { "type": "TextBlock", "size": "Large", "weight": "Bolder", "text": `📋 Daily Checklist — ${dateStr}`, "color": "Accent" },
        { "type": "TextBlock", "text": "Please complete all daily tasks before end of day:", "wrap": true }
    ];
    dailyReminderItems.forEach(item => {
        bodyItems.push({ "type": "TextBlock", "text": `☐  ${item.label}`, "wrap": true });
        if (item.url) bodyItems.push({ "type": "TextBlock", "text": `👉 ${item.url}`, "wrap": true, "color": "Accent" });
    });

    const message = {
        type: "message",
        attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            contentUrl: null,
            content: { "$schema": "http://adaptivecards.io/schemas/adaptive-card.json", "type": "AdaptiveCard", "version": "1.4", "body": bodyItems }
        }]
    };

    statusEl.innerHTML = '<span class="status-pending">Sending daily reminder...</span>';
    sendToTeams(url, message, statusEl, 'Daily reminder sent to Teams!');
}

function buildWeeklyMessageForRobot(robot, dateStr) {
    return {
        type: "message",
        attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            contentUrl: null,
            content: {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": [
                    { "type": "TextBlock", "size": "Large", "weight": "Bolder", "text": `🔧 Weekly Maintenance — ${robot.id} — ${dateStr}`, "color": "Warning" },
                    { "type": "TextBlock", "text": `**${robot.customer}** · ${robot.location}`, "wrap": true },
                    { "type": "TextBlock", "weight": "Bolder", "text": "Weekly Tasks:", "spacing": "Medium" },
                    { "type": "TextBlock", "text": "☐  System wipe down\n☐  Dragons inspected\n☐  Gripper inspected\n☐  IOLink Inspected\n☐  Operator station cleaned", "wrap": true },
                    { "type": "TextBlock", "text": `Responsible: ${robot.owner || '—'}`, "wrap": true, "spacing": "Medium", "isSubtle": true }
                ]
            }
        }]
    };
}

function sendWeeklyReminder() {
    const statusEl = document.getElementById('manualSendStatus');
    const mainUrl = getWebhookUrl();
    if (!mainUrl) { statusEl.innerHTML = '<span class="status-error">No webhook URL saved. Set it up in Step 2 above first.</span>'; return; }

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const robotListText = robots.length > 0
        ? robots.map(r => `• ${r.id} (${r.customer} — ${r.location})`).join('\n')
        : '• No robots added yet';

    // Main channel summary message
    const summaryMessage = {
        type: "message",
        attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            contentUrl: null,
            content: {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": [
                    { "type": "TextBlock", "size": "Large", "weight": "Bolder", "text": `🔧 Weekly Robot Maintenance — ${dateStr}`, "color": "Warning" },
                    { "type": "TextBlock", "text": "Complete these tasks for **each robot** this week:", "wrap": true },
                    { "type": "TextBlock", "weight": "Bolder", "text": "Weekly Tasks:", "spacing": "Medium" },
                    { "type": "TextBlock", "text": "☐  System wipe down\n☐  Dragons inspected\n☐  Gripper inspected\n☐  IOLink Inspected\n☐  Operator station cleaned", "wrap": true },
                    { "type": "TextBlock", "weight": "Bolder", "text": `Robots (${robots.length} total):`, "spacing": "Medium" },
                    { "type": "TextBlock", "text": robotListText, "wrap": true }
                ]
            }
        }]
    };

    statusEl.innerHTML = '<span class="status-pending">Sending weekly reminder...</span>';

    // Send to main channel
    sendToTeams(mainUrl, summaryMessage, statusEl, 'Weekly reminder sent to main channel!');

    // Send per-robot messages to owner webhooks
    const robotsWithWebhooks = robots.filter(r => r.ownerWebhookUrl);
    if (robotsWithWebhooks.length > 0) {
        robotsWithWebhooks.forEach(robot => {
            const msg = buildWeeklyMessageForRobot(robot, dateStr);
            sendToTeams(robot.ownerWebhookUrl, msg, null, null);
        });
        setTimeout(() => {
            statusEl.innerHTML = `<span class="status-success">✅ Weekly reminder sent to main channel + ${robotsWithWebhooks.length} owner channel(s)!</span>`;
        }, 2000);
    }
}

function saveAndTestWebhook() {
    const urlInput = document.getElementById('webhookUrl');
    const statusEl = document.getElementById('webhookStatus');
    const url = urlInput.value.trim();

    if (!url) {
        statusEl.innerHTML = '<span class="status-error">Please paste a webhook URL first.</span>';
        return;
    }

    localStorage.setItem('teamsWebhookUrl', url);
    statusEl.innerHTML = '<span class="status-pending">Sending test message...</span>';

    const testMessage = {
        type: "message",
        attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            contentUrl: null,
            content: {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": [
                    {
                        "type": "TextBlock",
                        "size": "Large",
                        "weight": "Bolder",
                        "text": "Robot Maintenance Tracker - Test Message",
                        "color": "Good"
                    },
                    {
                        "type": "TextBlock",
                        "text": "This is a test message from your Robot Maintenance Tracker. If you see this, the Teams integration is working!",
                        "wrap": true
                    },
                    {
                        "type": "FactSet",
                        "facts": [
                            { "title": "Total Robots:", "value": String(robots.length) },
                            { "title": "Sent at:", "value": new Date().toLocaleString() },
                            { "title": "Status:", "value": "Connection successful" }
                        ]
                    }
                ]
            }
        }]
    };

    sendToTeams(url, testMessage, statusEl, 'Test message sent! Check your Teams channel.');
}

function sendAllAlertsToTeams() {
    const statusEl = document.getElementById('manualSendStatus');
    const url = getWebhookUrl();

    if (!url) {
        statusEl.innerHTML = '<span class="status-error">No webhook URL saved. Set it up in Step 2 above first.</span>';
        return;
    }

    const alerts = getAllMaintenanceAlerts();
    const criticalAlerts = alerts.filter(a => a.statusInfo.status === 'overdue' || a.statusInfo.status === 'due-soon');

    if (criticalAlerts.length === 0 && alerts.length > 0) {
        statusEl.innerHTML = '<span class="status-success">No overdue or due-soon items. All maintenance is on track!</span>';
        return;
    }

    if (alerts.length === 0) {
        statusEl.innerHTML = '<span class="status-error">No robots found. Add robots first.</span>';
        return;
    }

    statusEl.innerHTML = '<span class="status-pending">Sending alerts to Teams...</span>';

    // Build facts for each alert
    const alertRows = criticalAlerts.map(a => ({
        "type": "ColumnSet",
        "columns": [
            { "type": "Column", "width": "auto", "items": [{ "type": "TextBlock", "text": a.statusInfo.status === 'overdue' ? '🔴' : '🟡', "size": "Medium" }] },
            { "type": "Column", "width": "stretch", "items": [
                { "type": "TextBlock", "text": `**${a.robotId}** (${a.customer})`, "wrap": true },
                { "type": "TextBlock", "text": `${a.frequencyLabel} | ${a.statusInfo.label} | Owner: ${a.owner}`, "size": "Small", "color": a.statusInfo.status === 'overdue' ? 'Attention' : 'Warning', "wrap": true }
            ]}
        ]
    }));

    const message = {
        type: "message",
        attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            contentUrl: null,
            content: {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": [
                    {
                        "type": "TextBlock",
                        "size": "Large",
                        "weight": "Bolder",
                        "text": `Maintenance Reminder — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
                    },
                    {
                        "type": "TextBlock",
                        "text": `${criticalAlerts.filter(a => a.statusInfo.status === 'overdue').length} overdue, ${criticalAlerts.filter(a => a.statusInfo.status === 'due-soon').length} due soon`,
                        "color": "Attention",
                        "weight": "Bolder"
                    },
                    ...alertRows
                ]
            }
        }]
    };

    sendToTeams(url, message, statusEl, `Sent ${criticalAlerts.length} alert(s) to Teams!`);
}

// Load saved webhook URL on page load
function loadWebhookUrl() {
    const saved = getWebhookUrl();
    const input = document.getElementById('webhookUrl');
    if (input && saved) input.value = saved;
}

// ==========================================
// EXPORT FOR POWER AUTOMATE
// ==========================================

function exportData() {
    const alerts = getAllMaintenanceAlerts();

    const exportPayload = {
        exportDate: new Date().toISOString(),
        reminderSchedule: {
            reminderTime: "14:00",
            weekly: { days: ["Monday", "Thursday"], note: "Every Monday and Thursday at 2 PM" },
            monthly: { days: ["1st of each month"], note: "1st of every month at 2 PM" },
            quarterly: { days: ["Jan 1", "Apr 1", "Jul 1", "Oct 1"], note: "1st of quarter at 2 PM" },
            semiAnnual: { days: ["Jan 1", "Jul 1"], note: "1st of Jan and Jul at 2 PM" },
            annual: { days: ["Jan 1"], note: "January 1st at 2 PM" }
        },
        robots: robots.map(r => ({
            id: r.id,
            customer: r.customer,
            location: r.location,
            application: r.application,
            owner: r.owner || '',
            ownerEmail: r.ownerEmail || '',
            deploymentDate: r.installDate,
            status: r.status
        })),
        maintenanceAlerts: alerts.map(a => ({
            robotId: a.robotId,
            customer: a.customer,
            owner: a.owner,
            ownerEmail: a.ownerEmail,
            frequency: a.frequencyLabel,
            lastMaintenance: a.lastMaintenance || 'Never',
            nextDueDate: a.nextDue.toISOString().split('T')[0],
            status: a.statusInfo.status,
            statusLabel: a.statusInfo.label,
            daysUntilDue: a.statusInfo.daysUntil,
            tasks: a.tasks
        })),
        recentLogs: maintenanceLogs.slice(-50).map(log => ({
            robotId: log.robotId,
            date: log.date,
            tasks: log.tasks,
            notes: log.notes,
            photoCount: (log.photos || []).length
        }))
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function populateRobotSelects() {
    const selects = [
        document.getElementById('robotScheduleSelect'),
        document.getElementById('robotLogSelect'),
        document.getElementById('logRobotSelect')
    ];
    selects.forEach(select => {
        const currentValue = select.value;
        const isRequired = select.id === 'logRobotSelect';
        select.innerHTML = isRequired ? '' : '<option value="">All Robots</option>';
        robots.forEach(robot => {
            const option = document.createElement('option');
            option.value = robot.id;
            option.textContent = `${robot.id} - ${robot.customer}`;
            select.appendChild(option);
        });
        if (currentValue) select.value = currentValue;
    });
}

function populateOverviewFilters() {
    const robotFilter = document.getElementById('overviewRobotFilter');
    const customerFilter = document.getElementById('overviewCustomerFilter');
    const currentRobot = robotFilter.value;
    const currentCustomer = customerFilter.value;

    robotFilter.innerHTML = '<option value="">All Robots</option>';
    robots.forEach(robot => {
        const option = document.createElement('option');
        option.value = robot.id;
        option.textContent = robot.id;
        robotFilter.appendChild(option);
    });

    const uniqueCustomers = [...new Set(robots.map(r => r.customer))];
    customerFilter.innerHTML = '<option value="">All Customers</option>';
    uniqueCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer;
        option.textContent = customer;
        customerFilter.appendChild(option);
    });

    if (currentRobot) robotFilter.value = currentRobot;
    if (currentCustomer) customerFilter.value = currentCustomer;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Data persistence
function saveData() {
    // Always keep localStorage as backup
    try {
        localStorage.setItem('robots', JSON.stringify(robots));
        localStorage.setItem('maintenanceLogs', JSON.stringify(maintenanceLogs));
        localStorage.setItem('customTasks', JSON.stringify(customTasks));
        localStorage.setItem('dailyReminderItems', JSON.stringify(dailyReminderItems));
    } catch (e) {
        console.error('localStorage save error:', e);
        if (e.name === 'QuotaExceededError') {
            alert('Local storage quota exceeded! Photos will be stored in Supabase only. Connect a Supabase database in the Teams tab.');
        }
    }
    // Save to Supabase if connected (shared database)
    if (supabaseClient) {
        saveDataToSupabase();
    }
}

async function loadData() {
    // Try Supabase first if connected
    if (supabaseClient) {
        try {
            await loadDataFromSupabase();
            const todayStr = new Date().toISOString().split('T')[0];
            let needsSave = false;
            robots.forEach(r => { if (!r.trackingStartDate) { r.trackingStartDate = todayStr; needsSave = true; } });
            if (needsSave) saveData();
            subscribeToRealtime();
            populateRobotSelects();
            populateOverviewFilters();
            return;
        } catch (e) {
            console.error('Supabase load error, falling back to localStorage:', e);
        }
    }

    // Fallback to localStorage
    try {
        const savedRobots = localStorage.getItem('robots');
        const savedLogs = localStorage.getItem('maintenanceLogs');
        const savedTasks = localStorage.getItem('customTasks');

        if (savedRobots) {
            robots = JSON.parse(savedRobots);
            const todayStr = new Date().toISOString().split('T')[0];
            let needsSave = false;
            robots.forEach(r => { if (!r.trackingStartDate) { r.trackingStartDate = todayStr; needsSave = true; } });
            if (needsSave) localStorage.setItem('robots', JSON.stringify(robots));
        }
        if (savedLogs) maintenanceLogs = JSON.parse(savedLogs);
        if (savedTasks) customTasks = JSON.parse(savedTasks);
        const savedDaily = localStorage.getItem('dailyReminderItems');
        dailyReminderItems = (savedDaily && JSON.parse(savedDaily).length > 0) ? JSON.parse(savedDaily) : [...DEFAULT_DAILY_ITEMS];

        populateRobotSelects();
        populateOverviewFilters();
    } catch (e) {
        console.error('Error loading data:', e);
        alert('Error loading saved data. You may need to clear your browser data.');
    }
}

// Debug function
window.debugMaintenanceTracker = function() {
    console.log('=== DEBUG INFO ===');
    console.log('Robots:', robots);
    console.log('Logs:', maintenanceLogs);
    console.log('Custom tasks:', customTasks);

    const robotsSize = (localStorage.getItem('robots') || '').length;
    const logsSize = (localStorage.getItem('maintenanceLogs') || '').length;
    const tasksSize = (localStorage.getItem('customTasks') || '').length;
    const totalSize = (robotsSize + logsSize + tasksSize) / 1024;

    return {
        robots: robots.length,
        logs: maintenanceLogs.length,
        tasks: customTasks.length,
        storageSizeKB: totalSize.toFixed(2)
    };
};

// Clear all data
window.clearAllData = function() {
    if (confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
        localStorage.removeItem('robots');
        localStorage.removeItem('maintenanceLogs');
        localStorage.removeItem('customTasks');
        robots = [];
        maintenanceLogs = [];
        customTasks = [];
        location.reload();
    }
};

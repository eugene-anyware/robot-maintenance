// Data structure
let robots = [];
let maintenanceLogs = [];
let customTasks = [];
let selectedRobotId = null;

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
document.addEventListener('DOMContentLoaded', () => {
    loadData();
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
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === robotModal) robotModal.classList.remove('show');
        if (e.target === logModal) logModal.classList.remove('show');
        if (e.target === taskModal) taskModal.classList.remove('show');
    });
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

// Add new robot
function addRobot() {
    const robot = {
        id: document.getElementById('robotId').value,
        customer: document.getElementById('robotCustomer').value,
        location: document.getElementById('robotLocation').value,
        application: document.getElementById('robotApplication').value,
        owner: document.getElementById('robotOwner').value,
        ownerEmail: document.getElementById('robotOwnerEmail').value,
        installDate: document.getElementById('robotInstallDate').value,
        trackingStartDate: new Date().toISOString().split('T')[0],
        status: 'good'
    };

    robots.push(robot);
    saveData();
    renderRobots();
    populateRobotSelects();
    populateOverviewFilters();
    renderDashboard();

    document.getElementById('robotModal').classList.remove('show');
    document.getElementById('robotForm').reset();
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
        console.log('Processing', photosInput.files.length, 'photos');
        const submitBtn = document.querySelector('#logForm button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Processing photos...';
        submitBtn.disabled = true;

        let photosProcessed = 0;
        Array.from(photosInput.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                log.photos.push(e.target.result);
                photosProcessed++;
                console.log('Photo processed:', photosProcessed, '/', photosInput.files.length);
                submitBtn.textContent = `Processing ${photosProcessed}/${photosInput.files.length} photos...`;
                if (photosProcessed === photosInput.files.length) {
                    console.log('All photos processed, saving log');
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                    finalizeLog();
                }
            };
            reader.onerror = (error) => {
                console.error('Error reading photo:', error);
                photosProcessed++;
                if (photosProcessed === photosInput.files.length) {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                    finalizeLog();
                }
            };
            reader.readAsDataURL(file);
        });
    } else {
        console.log('No photos, saving log directly');
        finalizeLog();
    }
}

// ==========================================
// MAINTENANCE DUE DATE CALCULATIONS
// ==========================================

function getNextDueDate(frequency, lastMaintenanceDate, trackingStartDate) {
    const intervalDays = frequencyDays[frequency] || 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (lastMaintenanceDate) {
        // Next due = last maintenance + interval
        const lastDate = new Date(lastMaintenanceDate);
        const nextDue = new Date(lastDate);
        nextDue.setDate(nextDue.getDate() + intervalDays);
        return nextDue;
    }

    // No maintenance done yet - start counting from when the robot
    // was added to the system (trackingStartDate), not deployment date.
    // This prevents all robots deployed in the past from showing as overdue.
    const startDate = new Date(trackingStartDate || today);
    startDate.setHours(0, 0, 0, 0);
    const nextDue = new Date(startDate);
    nextDue.setDate(nextDue.getDate() + intervalDays);
    return nextDue;
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
    } else if (diffDays <= 7) {
        return { status: 'due-soon', label: diffDays === 0 ? 'Due today!' : `Due in ${diffDays} day(s)`, daysUntil: diffDays, class: 'alert-due-soon' };
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

        // Only track weekly maintenance reminders for now
        const activeFrequencies = ['weekly'];
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
        // Only track weekly maintenance reminders for now
        const activeFrequencies = ['weekly'];
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

    if (robots.length === 0) {
        summaryEl.innerHTML = '';
        alertsEl.innerHTML = `
            <div class="empty-state">
                <h3>No robots added yet</h3>
                <p>Add robots in the Overview tab to see maintenance dashboard</p>
            </div>`;
        return;
    }

    updateRobotStatuses();
    const alerts = getAllMaintenanceAlerts();

    const overdueCount = alerts.filter(a => a.statusInfo.status === 'overdue').length;
    const dueSoonCount = alerts.filter(a => a.statusInfo.status === 'due-soon').length;
    const okCount = alerts.filter(a => a.statusInfo.status === 'ok').length;

    summaryEl.innerHTML = `
        <div class="summary-cards">
            <div class="summary-card summary-overdue">
                <div class="summary-number">${overdueCount}</div>
                <div class="summary-label">Overdue</div>
            </div>
            <div class="summary-card summary-due-soon">
                <div class="summary-number">${dueSoonCount}</div>
                <div class="summary-label">Due Soon (7 days)</div>
            </div>
            <div class="summary-card summary-ok">
                <div class="summary-number">${okCount}</div>
                <div class="summary-label">On Track</div>
            </div>
            <div class="summary-card summary-total">
                <div class="summary-number">${robots.length}</div>
                <div class="summary-label">Total Robots</div>
            </div>
        </div>
    `;

    if (alerts.length === 0) {
        alertsEl.innerHTML = `
            <div class="empty-state">
                <h3>No maintenance alerts</h3>
                <p>All robots are up to date</p>
            </div>`;
        return;
    }

    // Only show overdue and due-soon by default, plus next 10 upcoming
    const criticalAlerts = alerts.filter(a => a.statusInfo.status === 'overdue' || a.statusInfo.status === 'due-soon');
    const upcomingAlerts = alerts.filter(a => a.statusInfo.status === 'ok').slice(0, 10);
    const displayAlerts = [...criticalAlerts, ...upcomingAlerts];

    alertsEl.innerHTML = `
        <div class="alerts-table-container">
            <table class="alerts-table">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Robot</th>
                        <th>Owner</th>
                        <th>Frequency</th>
                        <th>Last Done</th>
                        <th>Next Due</th>
                        <th>Tasks</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayAlerts.map(alert => `
                        <tr class="${alert.statusInfo.class}">
                            <td>
                                <span class="alert-badge ${alert.statusInfo.class}">
                                    ${alert.statusInfo.status === 'overdue' ? 'OVERDUE' : alert.statusInfo.status === 'due-soon' ? 'DUE SOON' : 'OK'}
                                </span>
                            </td>
                            <td>
                                <strong>${alert.robotId}</strong>
                                <div class="robot-customer">${alert.customer}</div>
                            </td>
                            <td>
                                <div>${alert.owner}</div>
                                ${alert.ownerEmail ? `<div class="owner-email">${alert.ownerEmail}</div>` : ''}
                            </td>
                            <td><span class="frequency-tag">${alert.frequencyLabel}</span></td>
                            <td>${alert.lastMaintenance ? formatDate(alert.lastMaintenance) : '<span class="never-done">Never done</span>'}</td>
                            <td>
                                <strong>${formatDate(alert.nextDue)}</strong>
                                <div class="due-detail">${alert.statusInfo.label}</div>
                            </td>
                            <td>
                                <div class="alert-tasks">
                                    ${alert.tasks.slice(0, 3).map(t => `<div class="alert-task-item">${t}</div>`).join('')}
                                    ${alert.tasks.length > 3 ? `<div class="alert-task-more">+${alert.tasks.length - 3} more</div>` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================

function renderRobots() {
    const robotList = document.getElementById('robotList');
    const robotFilter = document.getElementById('overviewRobotFilter').value;
    const customerFilter = document.getElementById('overviewCustomerFilter').value;

    if (robots.length === 0) {
        robotList.innerHTML = `
            <div class="empty-state">
                <h3>No robots added yet</h3>
                <p>Click "Add Robot" to get started</p>
            </div>`;
        return;
    }

    updateRobotStatuses();

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
        const statusLabel = robot.status === 'good' ? 'Up to date' : robot.status === 'due' ? 'Maintenance Due Soon' : 'Maintenance Overdue';
        const daysSinceDeployment = robot.installDate ? Math.floor((new Date() - new Date(robot.installDate)) / (1000*60*60*24)) : '—';

        return `
        <div class="robot-card ${selectedRobotId === robot.id ? 'selected' : ''}" onclick="selectRobot('${robot.id}')">
            <h3>${robot.id}</h3>
            <div class="info">
                <div class="info-row">
                    <span class="label">Customer:</span>
                    <span>${robot.customer}</span>
                </div>
                <div class="info-row">
                    <span class="label">Location:</span>
                    <span>${robot.location}</span>
                </div>
                <div class="info-row">
                    <span class="label">Application:</span>
                    <span>${robot.application}</span>
                </div>
                <div class="info-row">
                    <span class="label">Owner:</span>
                    <span>${robot.owner || '—'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Deployed:</span>
                    <span>${robot.installDate ? formatDate(robot.installDate) : '—'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Days Active:</span>
                    <span>${daysSinceDeployment}</span>
                </div>
            </div>
            <span class="status-badge status-${robot.status}">
                ${statusLabel}
            </span>
        </div>
    `}).join('');

    updateDeleteRobotButton();
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

// Update delete robot button visibility
function updateDeleteRobotButton() {
    const deleteBtn = document.getElementById('deleteRobotBtn');
    if (selectedRobotId) {
        deleteBtn.style.display = 'block';
        deleteBtn.textContent = `Delete "${selectedRobotId}"`;
    } else {
        deleteBtn.style.display = 'none';
    }
}

// Delete robot
function deleteRobot() {
    if (!selectedRobotId) return;
    const robot = robots.find(r => r.id === selectedRobotId);
    if (!robot) return;

    const associatedLogs = maintenanceLogs.filter(log => log.robotId === selectedRobotId);
    let confirmMessage = `Are you sure you want to delete robot "${selectedRobotId}"?`;
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
// EXPORT FOR POWER AUTOMATE
// ==========================================

function exportData() {
    const alerts = getAllMaintenanceAlerts();

    const exportPayload = {
        exportDate: new Date().toISOString(),
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
    try {
        const robotsJson = JSON.stringify(robots);
        const logsJson = JSON.stringify(maintenanceLogs);
        const tasksJson = JSON.stringify(customTasks);

        console.log('Saving data...', 'Robots:', robots.length, 'Logs:', maintenanceLogs.length, 'Tasks:', customTasks.length);

        localStorage.setItem('robots', robotsJson);
        localStorage.setItem('maintenanceLogs', logsJson);
        localStorage.setItem('customTasks', tasksJson);

        const totalSize = (robotsJson.length + logsJson.length + tasksJson.length) / 1024;
        console.log('Data saved. Storage used:', totalSize.toFixed(2), 'KB');
    } catch (e) {
        console.error('Error saving data:', e);
        if (e.name === 'QuotaExceededError') {
            alert('Storage quota exceeded! Try removing some photos or old log entries.');
        }
    }
}

function loadData() {
    try {
        const savedRobots = localStorage.getItem('robots');
        const savedLogs = localStorage.getItem('maintenanceLogs');
        const savedTasks = localStorage.getItem('customTasks');

        console.log('Loading data from localStorage...');

        if (savedRobots) {
            robots = JSON.parse(savedRobots);
            // Backfill trackingStartDate for robots added before this feature
            const todayStr = new Date().toISOString().split('T')[0];
            let needsSave = false;
            robots.forEach(r => {
                if (!r.trackingStartDate) {
                    r.trackingStartDate = todayStr;
                    needsSave = true;
                }
            });
            if (needsSave) {
                localStorage.setItem('robots', JSON.stringify(robots));
                console.log('Backfilled trackingStartDate for existing robots');
            }
            console.log('Loaded robots:', robots.length);
        }
        if (savedLogs) {
            maintenanceLogs = JSON.parse(savedLogs);
            console.log('Loaded logs:', maintenanceLogs.length);
        }
        if (savedTasks) {
            customTasks = JSON.parse(savedTasks);
            console.log('Loaded tasks:', customTasks.length);
        }

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

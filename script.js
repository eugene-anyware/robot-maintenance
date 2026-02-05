// Data structure
let robots = [];
let maintenanceLogs = [];
let customTasks = [];
let selectedRobotId = null;

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
    renderRobots();
    renderSchedule();
    renderLogs();
    renderTaskChecklist();
});

// Tab functionality
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            // Update active states
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabName).classList.add('active');
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

📊 Data in Memory:
• Robots: ${info.robots}
• Maintenance Logs: ${info.logs}
• Custom Tasks: ${info.tasks}

💾 Storage Used: ${info.storageSizeKB} KB

✅ Check the browser console (F12) for detailed information.

${maintenanceLogs.length > 0 ? '\n📋 Recent Logs:\n' + maintenanceLogs.slice(-5).map((log, i) =>
    `${i+1}. Robot: ${log.robotId}, Date: ${log.date}, Tasks: ${log.tasks.length}`
).join('\n') : '⚠️ No logs found in memory!'}
    `;

    alert(debugMessage);

    // Also log to console
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
        installDate: document.getElementById('robotInstallDate').value,
        status: 'good'
    };

    robots.push(robot);
    saveData();
    renderRobots();
    populateRobotSelects();
    populateOverviewFilters();

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

    // Get checked tasks
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

    // Function to finalize log entry
    const finalizeLog = () => {
        maintenanceLogs.push(log);
        saveData();
        renderLogs();
        console.log('Log saved. Total logs:', maintenanceLogs.length);

        // Close modal and reset form AFTER everything is done
        document.getElementById('logModal').classList.remove('show');
        document.getElementById('logForm').reset();
        renderTaskChecklist(); // Reset checkboxes
    };

    // Handle photo uploads (for demo, we'll store as data URLs)
    if (photosInput.files.length > 0) {
        console.log('Processing', photosInput.files.length, 'photos');

        // Show loading message
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

// Render robots
function renderRobots() {
    const robotList = document.getElementById('robotList');
    const robotFilter = document.getElementById('overviewRobotFilter').value;
    const customerFilter = document.getElementById('overviewCustomerFilter').value;

    if (robots.length === 0) {
        robotList.innerHTML = `
            <div class="empty-state">
                <h3>No robots added yet</h3>
                <p>Click "Add Robot" to get started</p>
            </div>
        `;
        return;
    }

    // Apply filters
    let filteredRobots = robots;
    if (robotFilter) {
        filteredRobots = filteredRobots.filter(r => r.id === robotFilter);
    }
    if (customerFilter) {
        filteredRobots = filteredRobots.filter(r => r.customer === customerFilter);
    }

    if (filteredRobots.length === 0) {
        robotList.innerHTML = `
            <div class="empty-state">
                <h3>No robots match the selected filters</h3>
                <p>Try adjusting your filters</p>
            </div>
        `;
        return;
    }

    robotList.innerHTML = filteredRobots.map(robot => `
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
                    <span class="label">Installed:</span>
                    <span>${formatDate(robot.installDate)}</span>
                </div>
            </div>
            <span class="status-badge status-${robot.status}">
                ${robot.status === 'good' ? 'Up to date' : robot.status === 'due' ? 'Maintenance due' : 'Overdue'}
            </span>
        </div>
    `).join('');

    // Show/hide delete button based on selection
    updateDeleteRobotButton();
}

// Render maintenance schedule
function renderSchedule() {
    const scheduleTable = document.getElementById('scheduleTable');

    const frequencyLabels = {
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        quarterly: 'Quarterly (Every 3 Months)',
        semiAnnual: 'Semi-Annual (Every 6 Months)',
        annual: 'Annual (Every 12 Months)',
        biennial: 'Every 2 Years',
        threeYear: 'Every 3 Years',
        other: 'Other Schedules'
    };

    // Merge default schedule with custom tasks
    const mergedSchedule = { ...maintenanceSchedule };

    // Add daily category if there are custom daily tasks
    if (!mergedSchedule.daily) {
        mergedSchedule.daily = [];
    }

    // Add custom tasks to their respective frequency categories
    customTasks.forEach(task => {
        if (!mergedSchedule[task.frequency]) {
            mergedSchedule[task.frequency] = [];
        }
        mergedSchedule[task.frequency].push(task);
    });

    scheduleTable.innerHTML = Object.entries(mergedSchedule)
        .filter(([frequency, tasks]) => tasks.length > 0)
        .map(([frequency, tasks]) => `
        <div class="schedule-section">
            <h3 class="schedule-frequency">${frequencyLabels[frequency]}</h3>
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
        // Deselect if clicking the same robot
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

    // Count associated logs
    const associatedLogs = maintenanceLogs.filter(log => log.robotId === selectedRobotId);

    let confirmMessage = `Are you sure you want to delete robot "${selectedRobotId}"?`;
    if (associatedLogs.length > 0) {
        confirmMessage += `\n\nThis robot has ${associatedLogs.length} maintenance log(s) that will also be deleted.`;
    }
    confirmMessage += '\n\nThis action cannot be undone.';

    if (confirm(confirmMessage)) {
        // Remove robot
        robots = robots.filter(r => r.id !== selectedRobotId);

        // Remove associated logs
        maintenanceLogs = maintenanceLogs.filter(log => log.robotId !== selectedRobotId);

        console.log(`Robot ${selectedRobotId} and ${associatedLogs.length} associated log(s) deleted`);

        selectedRobotId = null;

        saveData();
        renderRobots();
        renderLogs();
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
        console.log(`Log ${logId} deleted`);
    }
}

// Render task checklist for log entry
function renderTaskChecklist() {
    const checklist = document.getElementById('taskChecklist');

    const frequencyLabels = {
        daily: 'Daily Tasks',
        weekly: 'Weekly Tasks',
        monthly: 'Monthly Tasks',
        quarterly: 'Quarterly Tasks',
        semiAnnual: 'Semi-Annual Tasks',
        annual: 'Annual Tasks',
        biennial: 'Biennial Tasks',
        threeYear: 'Every 3 Years',
        other: 'Other Tasks'
    };

    // Merge default schedule with custom tasks
    const mergedSchedule = { ...maintenanceSchedule };

    if (!mergedSchedule.daily) {
        mergedSchedule.daily = [];
    }

    customTasks.forEach(task => {
        if (!mergedSchedule[task.frequency]) {
            mergedSchedule[task.frequency] = [];
        }
        mergedSchedule[task.frequency].push(task);
    });

    checklist.innerHTML = Object.entries(mergedSchedule)
        .filter(([frequency, tasks]) => tasks.length > 0)
        .map(([frequency, tasks]) => `
        <div class="checklist-section">
            <h4>${frequencyLabels[frequency]}</h4>
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
    console.log('Filter value:', robotFilter);

    if (maintenanceLogs.length === 0) {
        logEntries.innerHTML = `
            <div class="empty-state">
                <h3>No maintenance logs yet</h3>
                <p>Click "Add Log Entry" to record maintenance activities</p>
            </div>
        `;
        return;
    }

    // Apply filter
    let filteredLogs = maintenanceLogs;
    if (robotFilter) {
        filteredLogs = maintenanceLogs.filter(log => log.robotId === robotFilter);
        console.log('Filtered logs:', filteredLogs.length);
    }

    if (filteredLogs.length === 0) {
        logEntries.innerHTML = `
            <div class="empty-state">
                <h3>No logs found for selected robot</h3>
                <p>Try selecting a different robot or add new log entries</p>
            </div>
        `;
        return;
    }

    // Sort logs by date (newest first)
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
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    console.log('Logs rendered successfully');
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

// Populate robot select dropdowns
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

// Populate overview filters
function populateOverviewFilters() {
    const robotFilter = document.getElementById('overviewRobotFilter');
    const customerFilter = document.getElementById('overviewCustomerFilter');

    const currentRobot = robotFilter.value;
    const currentCustomer = customerFilter.value;

    // Populate robot filter
    robotFilter.innerHTML = '<option value="">All Robots</option>';
    robots.forEach(robot => {
        const option = document.createElement('option');
        option.value = robot.id;
        option.textContent = robot.id;
        robotFilter.appendChild(option);
    });

    // Populate customer filter with unique customers
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

// Utility functions
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

        console.log('Saving data...');
        console.log('Robots:', robots.length);
        console.log('Logs:', maintenanceLogs.length);
        console.log('Tasks:', customTasks.length);

        localStorage.setItem('robots', robotsJson);
        localStorage.setItem('maintenanceLogs', logsJson);
        localStorage.setItem('customTasks', tasksJson);

        console.log('Data saved successfully!');

        // Log storage size
        const totalSize = (robotsJson.length + logsJson.length + tasksJson.length) / 1024;
        console.log('Total storage used:', totalSize.toFixed(2), 'KB');
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

// Debug function - call this from browser console
window.debugMaintenanceTracker = function() {
    console.log('=== DEBUG INFO ===');
    console.log('Robots in memory:', robots);
    console.log('Logs in memory:', maintenanceLogs);
    console.log('Custom tasks in memory:', customTasks);
    console.log('\n=== LOCALSTORAGE ===');
    console.log('Robots in storage:', localStorage.getItem('robots'));
    console.log('Logs in storage:', localStorage.getItem('maintenanceLogs'));
    console.log('Tasks in storage:', localStorage.getItem('customTasks'));

    // Calculate storage size
    const robotsSize = (localStorage.getItem('robots') || '').length;
    const logsSize = (localStorage.getItem('maintenanceLogs') || '').length;
    const tasksSize = (localStorage.getItem('customTasks') || '').length;
    const totalSize = (robotsSize + logsSize + tasksSize) / 1024;

    console.log('\n=== STORAGE SIZE ===');
    console.log('Total:', totalSize.toFixed(2), 'KB');
    console.log('Robots:', (robotsSize / 1024).toFixed(2), 'KB');
    console.log('Logs:', (logsSize / 1024).toFixed(2), 'KB');
    console.log('Tasks:', (tasksSize / 1024).toFixed(2), 'KB');

    return {
        robots: robots.length,
        logs: maintenanceLogs.length,
        tasks: customTasks.length,
        storageSizeKB: totalSize.toFixed(2)
    };
};

// Clear all data - call this from browser console if needed
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

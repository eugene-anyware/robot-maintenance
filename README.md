# Robot Maintenance Tracker

A web application to track maintenance schedules and logs for your robot fleet.

## Features

### Overview Tab
- View all robots in your fleet
- See customer info, location, application, and installation date
- Status badges showing maintenance status

### Maintenance Schedule Tab
- Organized by frequency:
  - **Weekly Tasks**: System wipe down, Dragons inspected, Gripper inspected, IOLink Inspected, Operator station cleaned
  - **Monthly Tasks**: Pump maintenance, fan filters, gripper inspection, power connectors, lidar cleaning
  - **Quarterly Tasks**: Filter changes, suction cup replacement, fan replacement
  - **Semi-Annual, Annual, Biennial, Every 3 Years**: All other scheduled maintenance

### Maintenance Logs Tab
- Add log entries with a checklist of tasks
- All maintenance tasks organized by frequency for easy selection
- Upload photos of completed work
- Add notes
- Filter logs by robot

## How to Use

### Open the Website
1. Open `index.html` in your browser, or
2. Run a local server:
   ```bash
   cd /home/gladys/data_trials/robot-maintenance
   python3 -m http.server 8000
   ```
   Then visit: http://localhost:8000

### Add a Robot
1. Click "Add Robot" button
2. Enter robot ID, customer, location, application, and installation date
3. Robot appears in the Overview tab

### Log Maintenance
1. Go to "Maintenance Logs" tab
2. Click "Add Log Entry"
3. Select robot and date
4. **Check off completed tasks** from the organized checklist
5. Add notes (optional)
6. Upload photos (optional)
7. Submit

## Changes Made

✅ **Log Entry**: Changed from text area to organized checklist with all maintenance tasks grouped by frequency
✅ **Maintenance Schedule**: Reorganized by frequency (Weekly → Monthly → Quarterly → etc.)
✅ **Overview**: Kept as-is with robot fleet cards

## Data Storage

All data is stored in your browser's localStorage and persists between sessions.

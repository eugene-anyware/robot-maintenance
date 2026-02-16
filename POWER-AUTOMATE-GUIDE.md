# Power Automate - Teams Reminder Setup Guide

This guide walks you through setting up automated Microsoft Teams notifications for robot maintenance reminders using Power Automate and the exported JSON data from the Robot Maintenance Tracker.

---

## Overview

The workflow:
1. **Export** maintenance data from the website (JSON file)
2. **Upload** the JSON file to OneDrive or SharePoint
3. **Power Automate** reads the file on a schedule (daily)
4. **Checks** for overdue or due-soon maintenance
5. **Sends** Teams messages to the robot owners

---

## Step 1: Export Data from the Website

1. Open your Robot Maintenance Tracker website
2. Click the **"Export Data"** button in the header
3. A JSON file will download: `maintenance-export-YYYY-MM-DD.json`
4. Upload this file to a **OneDrive** or **SharePoint** folder
   - Recommended path: `OneDrive > RobotMaintenance > maintenance-data.json`
   - Keep the same filename each time so Power Automate always reads the latest

---

## Step 2: Create the Power Automate Flow

### Open Power Automate
1. Go to [flow.microsoft.com](https://flow.microsoft.com)
2. Click **"+ Create"** > **"Scheduled cloud flow"**
3. Name it: `Robot Maintenance Reminders`
4. Set schedule: **Daily** at **8:00 AM** (or your preferred time)
5. Click **"Create"**

### Add Steps

#### Step 2a: Get File Content
1. Click **"+ New step"**
2. Search for **"OneDrive - Get file content"** (or SharePoint)
3. Select the file: `maintenance-data.json`

#### Step 2b: Parse JSON
1. Click **"+ New step"**
2. Search for **"Data Operations - Parse JSON"**
3. Content: Select the **file content** from the previous step
4. Schema: Click **"Generate from sample"** and paste the following sample:

```json
{
  "exportDate": "2026-02-16T12:00:00.000Z",
  "robots": [
    {
      "id": "ROBOT-001",
      "customer": "Customer A",
      "owner": "John Smith",
      "ownerEmail": "john@company.com",
      "status": "overdue"
    }
  ],
  "maintenanceAlerts": [
    {
      "robotId": "ROBOT-001",
      "customer": "Customer A",
      "owner": "John Smith",
      "ownerEmail": "john@company.com",
      "frequency": "Weekly",
      "lastMaintenance": "2026-01-01",
      "nextDueDate": "2026-01-08",
      "status": "overdue",
      "statusLabel": "Overdue by 5 day(s)",
      "daysUntilDue": -5,
      "tasks": ["System wipe down", "Dragons inspected"]
    }
  ]
}
```

#### Step 2c: Filter for Critical Alerts
1. Click **"+ New step"**
2. Search for **"Data Operations - Filter array"**
3. From: Select `maintenanceAlerts` from Parse JSON
4. Condition: `status` is equal to `overdue` OR `status` is equal to `due-soon`

#### Step 2d: Apply to Each (Send Teams Messages)
1. Click **"+ New step"**
2. Search for **"Apply to each"**
3. Select output from the Filter step
4. Inside the loop, add:

**Option A: Post to a Teams Channel**
1. Add action: **"Microsoft Teams - Post message in a chat or channel"**
2. Post as: Flow bot
3. Post in: Channel
4. Team: Select your team
5. Channel: Select your maintenance channel
6. Message (use dynamic content):

```
🤖 Maintenance Alert: [robotId]

Status: [statusLabel]
Robot: [robotId] ([customer])
Owner: [owner]
Frequency: [frequency]
Last Done: [lastMaintenance]
Next Due: [nextDueDate]

Tasks:
[tasks]

Please complete the required maintenance.
```

**Option B: Send Direct Message to Owner**
1. Add action: **"Microsoft Teams - Post message in a chat or channel"**
2. Post as: Flow bot
3. Post in: Chat with Flow bot
4. Recipient: Use `ownerEmail` from the dynamic content
5. Message: Same as above

---

## Step 3: Automate the Export (Advanced)

To fully automate this without manually exporting, you have two options:

### Option A: Scheduled Manual Export
- Set a daily reminder to click "Export Data" and upload to OneDrive
- Simple but requires manual action

### Option B: Use SharePoint List Instead
Instead of JSON files, create a SharePoint List that mirrors the data:

1. **Create a SharePoint List** called "Robot Maintenance Alerts" with columns:
   - RobotId (Text)
   - Customer (Text)
   - Owner (Text)
   - OwnerEmail (Text)
   - Frequency (Text)
   - LastMaintenance (Date)
   - NextDueDate (Date)
   - Status (Choice: overdue, due-soon, ok)
   - Tasks (Multi-line text)

2. **Update Power Automate** to read from SharePoint List instead of JSON file

3. **Manually update** the SharePoint List periodically, or add a button to the website that pushes data to SharePoint via Microsoft Graph API

---

## Step 4: Test Your Flow

1. Export fresh data from the website
2. Upload to OneDrive/SharePoint
3. Go to your Power Automate flow
4. Click **"Test"** > **"Manually"** > **"Test"**
5. Check your Teams for the messages
6. Verify the correct people received notifications

---

## Example Teams Message Output

```
🤖 Maintenance Alert: ROBOT-001

Status: Overdue by 3 day(s)
Robot: ROBOT-001 (Acme Corp)
Owner: John Smith
Frequency: Weekly
Last Done: Feb 10, 2026
Next Due: Feb 17, 2026

Tasks:
- System wipe down
- Dragons inspected
- Gripper inspected
- IOLink Inspected
- Operator station cleaned

Please complete the required maintenance.
```

---

## Frequency Reference

| Frequency    | Interval  | Description                    |
|-------------|-----------|--------------------------------|
| Daily       | 1 day     | Every day                      |
| Weekly      | 7 days    | Every week                     |
| Monthly     | 30 days   | Every month                    |
| Quarterly   | 90 days   | Every 3 months                 |
| Semi-Annual | 180 days  | Every 6 months                 |
| Annual      | 365 days  | Every year                     |
| Biennial    | 730 days  | Every 2 years                  |
| Every 3 Yrs | 1095 days | Every 3 years                  |
| Other       | ~545 days | Battery (~18 months/500 charges)|

---

## Troubleshooting

- **No messages sent**: Check that the JSON file has alerts with "overdue" or "due-soon" status
- **Wrong recipients**: Verify owner emails match Teams accounts
- **Flow fails**: Check that the JSON file format matches the schema
- **Messages delayed**: Power Automate scheduled flows may have a slight delay (usually within 15 minutes of scheduled time)

---

## Tips

- Export data **before** your scheduled flow runs (e.g., export at 7:30 AM if flow runs at 8:00 AM)
- Create separate flows for **overdue** (urgent) and **due-soon** (reminder) alerts
- Use **Adaptive Cards** in Teams for richer, more interactive messages
- Set up a **weekly summary** flow that posts a dashboard overview every Monday

# Deployment Guide - Robot Maintenance Tracker

## Quick Testing with Coworkers (ngrok)

### 1. Install ngrok
```bash
# Visit https://ngrok.com and sign up for free
# Download ngrok for Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update
sudo apt install ngrok

# Or download directly
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

### 2. Setup ngrok (one-time)
```bash
# Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### 3. Start your local server
```bash
cd /home/gladys/data_trials/robot-maintenance
python3 -m http.server 8000
```

### 4. In a new terminal, start ngrok
```bash
ngrok http 8000
```

You'll get a public URL like: `https://abc123.ngrok.io`
Share this URL with your coworkers! ✅

**Pros:**
- Super fast setup (5 minutes)
- Works from anywhere
- HTTPS included

**Cons:**
- URL changes every time you restart ngrok
- Free tier has session limits
- Only works while your computer is on

---

## Option 2: Local Network Sharing (Same WiFi Only)

### 1. Start the server
```bash
cd /home/gladys/data_trials/robot-maintenance
python3 -m http.server 8000
```

### 2. Find your local IP address
```bash
hostname -I | awk '{print $1}'
# OR
ip addr show | grep "inet " | grep -v 127.0.0.1
```

### 3. Share with coworkers
Give them: `http://YOUR_IP_ADDRESS:8000`
Example: `http://192.168.1.100:8000`

**Pros:**
- Simple, no installation needed
- Free

**Cons:**
- Only works on same WiFi network
- Only works while your computer is on
- No HTTPS

---

## Option 3: Deploy to Free Hosting (Best for Long-term) 🌟

### GitHub Pages (Recommended)

#### 1. Create a GitHub repository
```bash
cd /home/gladys/data_trials/robot-maintenance

# Initialize git (if not already)
git init

# Add all files
git add .
git commit -m "Initial commit - Robot Maintenance Tracker"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/robot-maintenance.git
git branch -M main
git push -u origin main
```

#### 2. Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under "Source", select **main** branch
4. Click **Save**
5. Your site will be live at: `https://YOUR_USERNAME.github.io/robot-maintenance/`

**Pros:**
- Free forever
- Always online
- Easy updates (just push to GitHub)
- Custom domain support

**Cons:**
- Public repository (unless you pay)
- Data stored in browser only (no server-side database)

---

### Netlify (Drag-and-Drop)

#### 1. Visit https://netlify.com and sign up

#### 2. Deploy
- Click "Add new site" → "Deploy manually"
- Drag your `robot-maintenance` folder into the upload area
- Done! You get a URL like: `https://your-site.netlify.app`

**Pros:**
- Easiest deployment (drag-and-drop)
- Free forever
- Always online
- Automatic HTTPS

---

### Vercel

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Deploy
```bash
cd /home/gladys/data_trials/robot-maintenance
vercel

# Follow the prompts
# You'll get a URL like: https://robot-maintenance.vercel.app
```

---

## Option 4: Share Files (Coworkers Run Locally)

### 1. Create a zip file
```bash
cd /home/gladys/data_trials
zip -r robot-maintenance.zip robot-maintenance/
```

### 2. Share the zip file via email/Slack

### 3. They extract and run:
```bash
cd robot-maintenance
python3 -m http.server 8000
# Open http://localhost:8000
```

**Pros:**
- No hosting needed
- Everyone has their own data

**Cons:**
- Everyone needs to run it locally
- Data not shared between users

---

## Recommendation

**For Quick Testing:** Use **ngrok** (Option 1)
**For Long-term Use:** Use **GitHub Pages** or **Netlify** (Option 3)

---

## Important Notes

⚠️ **Data Storage**: This app stores all data in the browser's localStorage. This means:
- Each user has their own separate data
- Data is NOT shared between users
- Data is NOT stored on a server
- Clearing browser data will delete all information

If you need shared data between users, you'll need to add a backend database (more complex setup).

---

## Need Help?

Run the website locally first to test:
```bash
cd /home/gladys/data_trials/robot-maintenance
python3 -m http.server 8000
```

Open: http://localhost:8000

# AWS Connection Troubleshooting Guide

## Problem: "The server is taking too long to respond"

If you're getting a timeout error when trying to access your EC2 instance at `http://YOUR-IP:3000`, follow this step-by-step diagnostic guide.

---

## Step 1: Verify EC2 Instance is Running

1. Go to **AWS Console** → **EC2** → **Instances**
2. Find your instance (e.g., `hangman-server`)
3. Check **Instance State** = `Running` ✅
4. Note your **Public IPv4 address** (e.g., `54.123.45.67`)

**If instance is stopped:**
```bash
# Select instance and click "Instance State" → "Start Instance"
```

---

## Step 2: Check Security Group Configuration

This is **by far the most common issue** for connection timeouts in our experience!

### How to Check:

1. **AWS Console** → **EC2** → **Instances**
2. Select your instance
3. Click **Security** tab
4. Click on the Security Group name (e.g., `hangman-server-sg`)
5. Click **Inbound rules** tab

### Required Inbound Rules:

You MUST have these rules:

| Type       | Protocol | Port Range | Source        | Description           |
|------------|----------|------------|---------------|-----------------------|
| SSH        | TCP      | 22         | My IP         | SSH access            |
| Custom TCP | TCP      | 3000       | 0.0.0.0/0     | Node.js app           |
| Custom TCP | TCP      | 3000       | ::/0          | Node.js app (IPv6)    |

### Fix Missing Port 3000 Rule:

1. Click **Edit inbound rules**
2. Click **Add rule**
3. Configure:
   - **Type:** Custom TCP
   - **Port range:** 3000
   - **Source:** 0.0.0.0/0 (Anywhere IPv4)
   - **Description:** Node.js Hangman Application
4. Click **Add rule** again
5. Configure:
   - **Type:** Custom TCP
   - **Port range:** 3000
   - **Source:** ::/0 (Anywhere IPv6)
   - **Description:** Node.js Hangman Application IPv6
6. Click **Save rules**

⚠️ **CRITICAL:** Without port 3000 open, you will ALWAYS get a timeout!

---

## Step 3: SSH into EC2 and Check Server Status

### Connect to EC2:

```bash
# Replace with your key file and IP
ssh -i "hangman-key.pem" ubuntu@23.22.44.190
```

### Check if Node.js server is running:

```bash
# Check with PM2 (if using PM2)
pm2 status

# OR check with ps
ps aux | grep node

# Check if port 3000 is listening
sudo netstat -tlnp | grep 3000
# OR
sudo ss -tlnp | grep 3000
```

**Expected output:**
```
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
```

**Key point:** It should show `0.0.0.0:3000` NOT `127.0.0.1:3000`

### If server is NOT running:

```bash
cd ~/apps/CLDE-Gruppe-6

# Check if dependencies are installed
ls -la node_modules/  # should show many packages

# If not installed:
npm install

# Start server
npm start
# OR with PM2:
pm2 start server/index.js --name hangman-server
pm2 save
```

### If server IS running but on wrong interface (127.0.0.1):

```bash
# Stop server
pm2 stop hangman-server
# OR press Ctrl+C if running in foreground

# Check .env file
cat .env | grep HOST

# If HOST is not set or set to localhost, fix it:
nano .env
# Make sure this line exists:
HOST=0.0.0.0

# Save (Ctrl+X, Y, Enter) and restart
pm2 restart hangman-server
# OR
npm start
```

---

## Step 4: Check Server Logs

### View logs:

```bash
# With PM2:
pm2 logs hangman-server --lines 50

# OR if running manually:
# Check terminal output where you ran npm start
```

### What to look for:

✅ **Good output:**
```
✅ Server erfolgreich gestartet!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Server läuft auf: 0.0.0.0:3000
📍 Lokal erreichbar: http://localhost:3000
💾 Datenbank: your-rds-endpoint.rds.amazonaws.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Bereit für Verbindungen!
```

❌ **Bad output (database error):**
```
❌ Datenbank-Initialisierung fehlgeschlagen
```

If you see database errors, check the database troubleshooting section below.

---

## Step 5: Check EC2 Firewall (ufw)

Some Ubuntu AMIs have ufw enabled by default:

```bash
# Check firewall status
sudo ufw status

# If active and port 3000 is not allowed:
sudo ufw allow 3000/tcp
sudo ufw reload

# OR disable entirely (only if you trust your security groups):
sudo ufw disable
```

---

## Step 6: Test Connection from EC2 Instance

Test if the server is accessible locally:

```bash
# Test from within EC2
curl http://localhost:3000

# Should return HTML of the index page

# Test health endpoint
curl http://localhost:3000/api/health

# Should return:
# {"status":"OK","timestamp":"...","uptime":123.45}
```

If this works but external access doesn't, the issue is Security Groups (Step 2).

---

## Step 7: Test Connection from Your Computer

### Test with curl:

```bash
# From your local computer (not EC2)
curl -v http://23.22.44.190:3000

# Or test health endpoint
curl http://23.22.44.190:3000/api/health
```

### Test with telnet:

```bash
telnet 23.22.44.190 3000
```

**If connection times out:** Security Group issue (Step 2)
**If connection refused:** Server not running or wrong interface (Step 3)
**If connection succeeds:** Server is accessible! Try browser again.

---

## Step 8: Browser Testing

### Clear browser cache:

1. Press `Ctrl+F5` (or `Cmd+Shift+R` on Mac) to hard refresh
2. Try in incognito/private mode
3. Try a different browser

### Use correct URL:

✅ **Correct:** `http://23.22.44.190:3000` (note: **http** not https)
❌ **Wrong:** `https://23.22.44.190:3000` (will fail - no SSL configured)
❌ **Wrong:** `http://localhost:3000` (only works on EC2 itself)

---

## Common Issues & Solutions

### Issue: "This site can't be reached"

**Cause:** Security Group doesn't allow port 3000
**Fix:** See Step 2 - Add inbound rule for port 3000

### Issue: "Connection refused"

**Cause:** Server not running or crashed
**Fix:** See Step 3 - Start the server

### Issue: "Connection timeout"

**Possible Causes:**
- Security Group issue (most common)
- Wrong IP address
- Server binding to localhost instead of 0.0.0.0
- EC2 firewall blocking

**Fix:** Follow Steps 2, 3, and 5

### Issue: ERR_SSL_PROTOCOL_ERROR

**Cause:** Using `https://` when server doesn't have SSL
**Fix:** Use `http://` instead (or set up SSL - see AWS_DEPLOYMENT.md Part 7)

### Issue: Page loads but Socket.io doesn't connect

**Cause:** CORS or Socket.io configuration issue
**Fix:** Check `.env` file for correct `CLIENT_URL` setting

---

## Database Connection Issues

If server starts but database fails:

### Check RDS Security Group:

1. **AWS Console** → **RDS** → **Databases**
2. Click your database (e.g., `hangman-db`)
3. Click **Connectivity & security** tab
4. Note the **Endpoint** (e.g., `hangman-db.xxx.us-east-1.rds.amazonaws.com`)
5. Click on **VPC security groups**
6. Check **Inbound rules**:
   - **Type:** MySQL/Aurora
   - **Port:** 3306
   - **Source:** EC2 security group OR 0.0.0.0/0 (for testing)

### Test RDS connection from EC2:

```bash
# Install MySQL client if not installed
sudo apt install -y mysql-client

# Test connection (replace with your RDS endpoint)
mysql -h hangman-db.xxx.us-east-1.rds.amazonaws.com -u admin -p

# Enter password when prompted
# If successful, you'll see: mysql>
```

### Check .env configuration:

```bash
cat .env
```

Make sure these are correct:
- `DB_HOST` = Your RDS endpoint (not localhost!)
- `DB_USER` = admin (or your master username)
- `DB_PASSWORD` = Your RDS master password
- `DB_NAME` = hangman_game
- `DB_PORT` = 3306

---

## Quick Diagnostic Checklist

Run through this checklist:

```bash
# On EC2 instance:

# 1. Is server running?
pm2 status
# Expected: hangman-server status = "online"

# 2. Is it listening on 0.0.0.0:3000?
sudo netstat -tlnp | grep 3000
# Expected: 0.0.0.0:3000 (NOT 127.0.0.1:3000)

# 3. Can we access locally?
curl http://localhost:3000/api/health
# Expected: {"status":"OK",...}

# 4. Check server logs
pm2 logs hangman-server --lines 20
# Expected: No errors, "Bereit für Verbindungen!"

# 5. Check .env HOST setting
grep HOST .env
# Expected: HOST=0.0.0.0

# 6. Check firewall
sudo ufw status
# Expected: inactive OR port 3000 allowed

# 7. From your computer:
curl http://YOUR-EC2-IP:3000/api/health
# Expected: {"status":"OK",...}
```

---

## Still Not Working?

### Gather diagnostic info:

```bash
# On EC2, run:
echo "=== PM2 Status ==="
pm2 status

echo "=== Network Listening ==="
sudo netstat -tlnp | grep 3000

echo "=== Server Logs ==="
pm2 logs hangman-server --lines 30

echo "=== Environment ==="
cat .env | grep -v PASSWORD

echo "=== Firewall ==="
sudo ufw status
```

### Check these in AWS Console:

1. EC2 Instance State = Running
2. Public IPv4 address is correct
3. Security Group has port 3000 open to 0.0.0.0/0
4. RDS Security Group has port 3306 open
5. RDS Status = Available

### Get help:

Share the diagnostic info above along with:
- Your EC2 public IP
- Any error messages from browser console (F12 → Console tab)
- Any error messages from server logs

---

## Prevention Tips

To avoid these issues in the future:

1. **Always use 0.0.0.0** in production:
   - Set `HOST=0.0.0.0` in `.env`
   - Never use `localhost` or `127.0.0.1`

2. **Document your Security Groups:**
   - Take screenshots of inbound rules
   - Keep a list of required ports

3. **Use PM2 for process management:**
   - Auto-restart on failure
   - Better logging
   - Startup on reboot

4. **Set up monitoring:**
   - CloudWatch alarms for EC2 health
   - Uptime monitoring service
   - Log aggregation

5. **Use Elastic IP:**
   - Your IP won't change if instance restarts
   - Easier to remember and document

---

## Success Indicators

You've successfully fixed the issue when:

✅ Browser loads `http://YOUR-EC2-IP:3000` without timeout
✅ You see the Hangman landing page
✅ Browser console (F12) shows "✅ Socket verbunden"
✅ You can create/join lobbies
✅ Multiple players can connect
✅ Game works end-to-end

---

**Good luck! 🚀**

If you've followed all steps and still have issues, the problem is likely in the AWS configuration, not the code.

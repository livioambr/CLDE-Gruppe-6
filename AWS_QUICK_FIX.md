# AWS Connection Quick Fix Guide

## 🚨 "Server taking too long to respond" Error

### Fix #1: Check Security Group (Most Common Issue)

1. AWS Console → EC2 → Security Groups
2. Find `hangman-server-sg`
3. Inbound rules → Edit
4. **ADD THIS RULE:**

```
Type:        Custom TCP
Port:        3000
Source:      0.0.0.0/0
Description: Node.js App
```

5. **ADD THIS RULE TOO:**

```
Type:        Custom TCP
Port:        3000
Source:      ::/0
Description: Node.js App IPv6
```

6. Save rules
7. Try again: `http://YOUR-IP:3000`

---

### Fix #2: Check Server is Running

SSH into EC2:
```bash
ssh -i "your-key.pem" ubuntu@YOUR-IP
```

Check status:
```bash
pm2 status
# OR
ps aux | grep node
```

If not running:
```bash
cd ~/apps/CLDE-Gruppe-6
pm2 start server/index.js --name hangman-server
```

---

### Fix #3: Check Server Binding

```bash
sudo netstat -tlnp | grep 3000
```

**Must show:** `0.0.0.0:3000`
**NOT:** `127.0.0.1:3000`

If showing 127.0.0.1, fix .env:
```bash
nano .env
# Add or change:
HOST=0.0.0.0
```

Then restart:
```bash
pm2 restart hangman-server
```

---

### Fix #4: Use Correct URL

✅ **RIGHT:** `http://23.22.44.190:3000`
❌ **WRONG:** `https://23.22.44.190:3000` (no SSL)
❌ **WRONG:** `http://localhost:3000` (only works on EC2)

---

## Test Commands

From EC2:
```bash
# Test locally
curl http://localhost:3000/api/health
```

From your computer:
```bash
# Test remotely
curl http://YOUR-EC2-IP:3000/api/health
```

Both should return:
```json
{"status":"OK","timestamp":"...","uptime":123}
```

---

## Still Not Working?

See full guide: [AWS_TROUBLESHOOTING.md](./AWS_TROUBLESHOOTING.md)

---

## Common Mistakes

1. ❌ Forgot to open port 3000 in Security Group
2. ❌ Using HTTPS instead of HTTP
3. ❌ Server binding to localhost instead of 0.0.0.0
4. ❌ Server not running
5. ❌ Using wrong IP address
6. ❌ Firewall (ufw) blocking port 3000

---

## Success Checklist

When everything works, you should see:

✅ `http://YOUR-IP:3000` loads in browser
✅ Browser console shows "✅ Socket verbunden"
✅ No timeout errors
✅ Can create/join lobbies
✅ Multiple players can connect

---

**Need more help?** Read [AWS_TROUBLESHOOTING.md](./AWS_TROUBLESHOOTING.md)

# AWS Deployment Guide - Hangman Multiplayer

Schritt-für-Schritt Anleitung zum Deployment des Hangman Multiplayer-Spiels auf AWS.

## Übersicht

Diese Anleitung zeigt, wie du die Hangman-Anwendung auf AWS mit folgenden Services deployst:
- **EC2** - Virtual Server für Node.js Backend
- **RDS MySQL** - Relationale Datenbank
- **Security Groups** - Firewall-Regeln
- **Elastic IP** (optional) - Feste IP-Adresse

## Architektur-Diagramm

```
Internet
    │
    ▼
┌─────────────────────────┐
│  AWS EC2 Instance       │
│  - Node.js 22+          │
│  - Express Server       │
│  - Socket.io            │
│  - Port 3000            │
└────────┬────────────────┘
         │
         │ MySQL Protocol (Port 3306)
         ▼
┌─────────────────────────┐
│  AWS RDS MySQL          │
│  - Database: hangman    │
│  - Engine: MySQL 8.0    │
└─────────────────────────┘
```

---

## Teil 1: AWS RDS MySQL Datenbank erstellen

### Schritt 1.1: RDS Instanz starten

1. Gehe zu **AWS Console** → **RDS** → **Create database**
2. Wähle folgende Einstellungen:
   - **Engine type:** MySQL
   - **Engine Version:** MySQL 8.0.35 oder neuer
   - **Templates:** Free tier (für Tests) oder Production
   - **DB instance identifier:** `hangman-db`
   - **Master username:** `admin`
   - **Master password:** Wähle ein sicheres Passwort (z.B. `HangmanDB2024!`)
   - **DB instance class:**
     - Free Tier: `db.t3.micro`
     - Production: `db.t3.small` oder höher
   - **Storage type:** General Purpose SSD (gp2)
   - **Allocated storage:** 20 GB

### Schritt 1.2: Netzwerk-Einstellungen

1. **Virtual Private Cloud (VPC):** Default VPC
2. **Subnet group:** Default
3. **Public access:** **Yes** (für Entwicklung/Tests)
   - ⚠️ **Wichtig:** Für Production sollte dies auf "No" gesetzt werden mit VPC Peering
4. **VPC security group:** Erstelle neue Gruppe `hangman-db-sg`
5. **Availability Zone:** No preference
6. **Database port:** `3306`

### Schritt 1.3: Zusätzliche Konfiguration

1. **Initial database name:** `hangman_game`
2. **DB parameter group:** default.mysql8.0
3. **Backup retention:** 7 days (empfohlen)
4. **Enable automatic backups:** Yes
5. **Enable encryption:** Yes (empfohlen)

### Schritt 1.4: Datenbank erstellen

1. Klicke auf **Create database**
2. Warte 5-10 Minuten bis Status auf **Available** wechselt
3. Notiere dir:
   - **Endpoint:** `hangman-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com`
   - **Port:** `3306`
   - **Master username:** `admin`
   - **Master password:** Dein gewähltes Passwort

### Schritt 1.5: Security Group anpassen

1. Gehe zu **EC2** → **Security Groups**
2. Finde `hangman-db-sg`
3. **Inbound rules** bearbeiten:
   - **Type:** MySQL/Aurora
   - **Protocol:** TCP
   - **Port:** 3306
   - **Source:**
     - Für Entwicklung: `0.0.0.0/0` (alle IPs)
     - Für Production: Security Group der EC2-Instanz

---

## Teil 2: EC2 Instanz erstellen

### Schritt 2.1: EC2 Instanz starten

1. Gehe zu **AWS Console** → **EC2** → **Launch Instance**
2. **Name:** `hangman-server`
3. **AMI:** Ubuntu Server 22.04 LTS (Free tier eligible)
4. **Instance type:**
   - Free Tier: `t2.micro`
   - Production: `t3.small` oder höher
5. **Key pair:** Erstelle neuen Key Pair `hangman-key`
   - Type: RSA
   - Format: `.pem` (für SSH)
   - ⚠️ **Wichtig:** Speichere die `.pem` Datei sicher!

### Schritt 2.2: Netzwerk-Einstellungen

1. **Network settings:**
   - VPC: Default VPC
   - Subnet: No preference
   - **Auto-assign public IP:** Enable
2. **Firewall (Security groups):** Create new `hangman-server-sg`
3. **Inbound Security Group Rules:**
   - **SSH:** Port 22 (Source: My IP)
   - **HTTP:** Port 80 (Source: 0.0.0.0/0)
   - **HTTPS:** Port 443 (Source: 0.0.0.0/0)
   - **Custom TCP:** Port 3000 (Source: 0.0.0.0/0)

### Schritt 2.3: Storage

1. **Root volume:**
   - Size: 8 GB (Free tier) oder 20 GB (Production)
   - Type: gp3
   - Delete on termination: Yes

### Schritt 2.4: Instanz starten

1. Klicke auf **Launch instance**
2. Warte bis Status **Running**
3. Notiere dir:
   - **Public IPv4 address:** `xx.xx.xx.xx`
   - **Public IPv4 DNS:** `ec2-xx-xx-xx-xx.compute-1.amazonaws.com`

---

## Teil 3: Server-Setup auf EC2

### Schritt 3.1: SSH-Verbindung herstellen

**Windows (PowerShell/CMD):**
```bash
# Setze Berechtigungen für Key-Datei
icacls hangman-key.pem /inheritance:r /grant:r "%USERNAME%:R"

# SSH-Verbindung
ssh -i "hangman-key.pem" ubuntu@ec2-xx-xx-xx-xx.compute-1.amazonaws.com
```

**macOS/Linux:**
```bash
# Setze Berechtigungen
chmod 400 hangman-key.pem

# SSH-Verbindung
ssh -i "hangman-key.pem" ubuntu@ec2-xx-xx-xx-xx.compute-1.amazonaws.com
```

### Schritt 3.2: System aktualisieren

```bash
# System-Pakete aktualisieren
sudo apt update && sudo apt upgrade -y
```

### Schritt 3.3: Node.js 22 installieren

```bash
# Node.js Repository hinzufügen
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Node.js installieren
sudo apt install -y nodejs

# Version prüfen
node --version  # sollte v22.x.x zeigen
npm --version
```

### Schritt 3.4: MySQL Client installieren (für Debugging)

```bash
sudo apt install -y mysql-client
```

### Schritt 3.5: Git installieren

```bash
sudo apt install -y git
```

---

## Teil 4: Anwendung deployen

### Schritt 4.1: Repository klonen

```bash
# Erstelle Arbeitsverzeichnis
mkdir -p ~/apps
cd ~/apps

# Clone dein Repository
# Option 1: HTTPS
git clone https://github.com/dein-username/hangman-multiplayer.git

# Option 2: Dateien hochladen via SCP
# Von deinem lokalen Rechner:
# scp -i "hangman-key.pem" -r ./CLDE-Gruppe-6 ubuntu@ec2-xx-xx-xx-xx.compute-1.amazonaws.com:~/apps/
```

### Schritt 4.2: Dependencies installieren

```bash
cd ~/apps/CLDE-Gruppe-6

# Installiere npm Pakete
npm install
```

### Schritt 4.3: Umgebungsvariablen konfigurieren

```bash
# Erstelle .env Datei
nano .env
```

Füge folgende Konfiguration ein (ersetze die Werte):

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# MySQL Database Configuration (AWS RDS)
DB_HOST=hangman-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=HangmanDB2024!
DB_NAME=hangman_game

# CORS Configuration
CLIENT_URL=http://your-ec2-public-ip:3000

# Session Secret (generiere einen zufälligen String)
SESSION_SECRET=your-super-secret-random-string-here

# AWS Region
AWS_REGION=us-east-1
```

**Speichern:** `Ctrl + X` → `Y` → `Enter`

### Schritt 4.4: Datenbankverbindung testen

```bash
# Teste Verbindung zur RDS-Datenbank
mysql -h hangman-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com -u admin -p

# Gib Passwort ein
# Wenn erfolgreich, siehst du: mysql>

# Beende mit:
exit
```

### Schritt 4.5: Anwendung testen

```bash
# Starte Server (Vordergrund)
npm start
```

Du solltest sehen:
```
🚀 Starte Hangman Multiplayer Server...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Initialisiere Datenbank...
✅ MySQL Verbindung erfolgreich
✅ Datenbank und Tabellen erfolgreich erstellt
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 HTTP Server:     http://localhost:3000
🔌 Socket.io:       ws://localhost:3000
💾 Datenbank:       hangman-db.xxx.rds.amazonaws.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Bereit für Verbindungen!
```

### Schritt 4.6: Testen im Browser

**⚠️ WICHTIG:** Nutze die **öffentliche EC2 IP-Adresse**, nicht `localhost`!

Von deinem lokalen Computer (außerhalb AWS):
```
http://your-ec2-public-ip:3000
```

Beispiel: `http://54.123.45.67:3000`

**Warum nicht localhost?**
- `localhost:3000` funktioniert nur **innerhalb** der EC2-Instanz (via SSH)
- Externe Clients müssen die **EC2 Public IPv4 Address** verwenden
- Diese findest du in der AWS Console unter EC2 → Instances → Deine Instanz

**Checkliste wenn Verbindung nicht funktioniert:**
- [ ] Security Group erlaubt Port 3000 von 0.0.0.0/0
- [ ] Server läuft (`pm2 status` oder `ps aux | grep node`)
- [ ] Du verwendest die öffentliche IP, nicht localhost
- [ ] PORT 3000 ist in der .env Datei korrekt gesetzt
- [ ] HOST=0.0.0.0 ist in der .env Datei gesetzt

Wenn alles funktioniert, stoppe den Server: `Ctrl + C`

---

## Teil 5: Production-Setup mit PM2

### Schritt 5.1: PM2 installieren

```bash
sudo npm install -g pm2
```

### Schritt 5.2: Anwendung mit PM2 starten

```bash
cd ~/apps/CLDE-Gruppe-6

# Starte Anwendung
pm2 start server/index.js --name hangman-server

# Status prüfen
pm2 status

# Logs anzeigen
pm2 logs hangman-server

# Stoppen
pm2 stop hangman-server

# Neustarten
pm2 restart hangman-server
```

### Schritt 5.3: Autostart konfigurieren

```bash
# PM2 Startup-Script erstellen
pm2 startup

# Kopiere den angezeigten Befehl und führe ihn aus
# z.B.: sudo env PATH=...

# Speichere aktuelle PM2-Prozesse
pm2 save
```

### Schritt 5.4: PM2 Monitoring (optional)

```bash
# Monitoring Dashboard
pm2 monit

# Web-Dashboard
pm2 web
# Zugriff über: http://your-ec2-ip:9615
```

---

## Teil 6: Nginx Reverse Proxy (optional, empfohlen)

### Schritt 6.1: Nginx installieren

```bash
sudo apt install -y nginx
```

### Schritt 6.2: Nginx konfigurieren

```bash
sudo nano /etc/nginx/sites-available/hangman
```

Füge ein:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # oder EC2 Public DNS

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket Support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Schritt 6.3: Nginx aktivieren

```bash
# Symlink erstellen
sudo ln -s /etc/nginx/sites-available/hangman /etc/nginx/sites-enabled/

# Default-Site deaktivieren
sudo rm /etc/nginx/sites-enabled/default

# Konfiguration testen
sudo nginx -t

# Nginx neu starten
sudo systemctl restart nginx
```

Jetzt erreichbar über: `http://your-ec2-ip` (ohne Port 3000)

---

## Teil 7: Domain & SSL (optional)

### Schritt 7.1: Domain konfigurieren

1. Registriere Domain (z.B. bei Namecheap, GoDaddy)
2. Erstelle **A Record** auf deine EC2 Public IP:
   ```
   Type: A
   Name: @ (oder www)
   Value: your-ec2-public-ip
   TTL: 300
   ```

### Schritt 7.2: SSL mit Let's Encrypt

```bash
# Certbot installieren
sudo apt install -y certbot python3-certbot-nginx

# SSL-Zertifikat erstellen
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-Renewal testen
sudo certbot renew --dry-run
```

Jetzt erreichbar über: `https://your-domain.com`

---

## Teil 8: Monitoring & Wartung

### Logs anzeigen

```bash
# PM2 Logs
pm2 logs hangman-server

# Nginx Logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System Logs
sudo journalctl -u nginx -f
```

### Performance-Monitoring

```bash
# System-Ressourcen
htop

# PM2 Dashboard
pm2 monit
```

### Datenbank-Backup

```bash
# Manuelles Backup
mysqldump -h hangman-db.xxx.rds.amazonaws.com -u admin -p hangman_game > backup_$(date +%Y%m%d).sql

# Automatisches Backup (Cron)
crontab -e

# Füge hinzu (täglich um 2 Uhr morgens):
0 2 * * * mysqldump -h hangman-db.xxx.rds.amazonaws.com -u admin -p'PASSWORD' hangman_game > ~/backups/hangman_$(date +\%Y\%m\%d).sql
```

---

## Troubleshooting

### Problem: Kann nicht auf Port 3000 zugreifen

**Symptome:**
- Browser zeigt "Die Website ist nicht erreichbar" oder "Connection refused"
- Funktioniert nur mit `ssh -L 3000:localhost:3000` Port Forwarding

**Häufigste Ursache:** Server bindet nur an localhost statt 0.0.0.0

**Lösung:**
1. **WICHTIG:** Stelle sicher dass `HOST=0.0.0.0` in deiner `.env` Datei steht:
   ```bash
   nano .env
   # Füge hinzu oder bearbeite:
   HOST=0.0.0.0
   ```
   
2. Prüfe ob Server richtig bindet:
   ```bash
   # Server neu starten
   pm2 restart hangman-server
   
   # Prüfe Logs
   pm2 logs hangman-server --lines 20
   
   # Du solltest sehen: "Listening on: 0.0.0.0:3000"
   ```

3. Prüfe Security Group:
   - EC2 → Security Groups → hangman-server-sg
   - Inbound Rules: Port 3000 offen für 0.0.0.0/0

4. Prüfe ob Server läuft: 
   ```bash
   pm2 status
   netstat -tlnp | grep 3000
   ```

5. Verwende die **öffentliche EC2 IP**, nicht `localhost`:
   ```
   ✅ Richtig: http://54.123.45.67:3000
   ❌ Falsch:  http://localhost:3000
   ```

6. Prüfe Firewall: `sudo ufw status` (sollte inaktiv sein)

### Problem: Datenbank-Verbindungsfehler

**Lösung:**
1. Prüfe RDS Security Group (Port 3306 offen)
2. Teste Verbindung: `mysql -h ENDPOINT -u admin -p`
3. Prüfe .env Datei (Host, User, Password korrekt?)

### Problem: WebSocket-Verbindung schlägt fehl

**Lösung:**
1. Nginx Konfiguration prüfen (WebSocket-Abschnitt)
2. CLIENT_URL in .env auf richtige Domain setzen
3. CORS-Einstellungen prüfen

---

## Kosten-Übersicht (ca.)

**Free Tier (12 Monate):**
- EC2 t2.micro: $0 (750 Stunden/Monat)
- RDS db.t3.micro: $0 (750 Stunden/Monat)
- **Total: $0/Monat**

**Nach Free Tier:**
- EC2 t3.small: ~$15/Monat
- RDS db.t3.small: ~$30/Monat
- **Total: ~$45/Monat**

⚠️ **Wichtig:** Beende Ressourcen wenn nicht verwendet!

---

## Sicherheits-Checkliste

- [ ] RDS nicht öffentlich erreichbar (nur via EC2)
- [ ] SSH nur von deiner IP
- [ ] Starke Passwörter verwenden
- [ ] SSL/TLS aktiviert
- [ ] Regelmäßige Backups
- [ ] Updates installieren (`apt update && apt upgrade`)
- [ ] .env Datei nicht in Git committen
- [ ] CloudWatch Monitoring aktivieren

---

## Nützliche Befehle

```bash
# Server Status
pm2 status
sudo systemctl status nginx

# Server neu starten
pm2 restart hangman-server
sudo systemctl restart nginx

# Updates einspielen
cd ~/apps/CLDE-Gruppe-6
git pull
npm install
pm2 restart hangman-server

# Speicher leeren
pm2 flush

# Prozess-Info
pm2 info hangman-server
```

---

## Support

Bei Problemen:
1. Prüfe Logs: `pm2 logs hangman-server`
2. Teste Datenbank: `mysql -h ENDPOINT -u admin -p`
3. Prüfe Security Groups in AWS Console

**Viel Erfolg mit deinem Deployment! 🚀**

# 🎮 Hangman Multiplayer

Ein Echtzeit-Multiplayer Hangman-Spiel mit Node.js, Socket.io und MySQL für AWS Cloud.

![Hangman Screenshot](https://via.placeholder.com/800x400?text=Hangman+Multiplayer+Game)

## 📋 Features

- **Multiplayer:** Mehrere Spieler können gleichzeitig am selben Wort spielen
- **Sequenzielles Gameplay:** Spieler sind abwechselnd an der Reihe
- **Live Chat:** Echtzeit-Chat während des Spiels
- **Lobby-System:** Erstelle oder trete Lobbies mit 6-stelligem Code bei
- **Responsive Design:** Funktioniert auf Desktop und Mobile
- **Echtzeit-Updates:** Socket.io für synchrone Spieler-Updates
- **AWS-Ready:** Vorbereitet für Deployment auf AWS (EC2 + RDS)

## 🏗️ Architektur

```
Frontend (Vanilla JS)
    ↓ HTTP / WebSocket
Express Server (Node.js)
    ↓ MySQL Protocol
MySQL Database (AWS RDS)
```

### Tech Stack

**Backend:**
- Node.js 22+
- Express 5.1
- Socket.io 4.8
- MySQL2
- UUID für Session-IDs

**Frontend:**
- Vanilla JavaScript (ES6+)
- Socket.io Client
- HTML5 Canvas für Hangman-Zeichnung
- CSS3 mit Responsive Design

**Database:**
- MySQL 8.0
- Tabellen: lobbies, players, game_state, chat_messages, words

## 🚀 Quick Start

### Voraussetzungen

- Node.js 22+ installiert
- MySQL 8.0+ (lokal oder AWS RDS)
- Git

### Installation

1. **Repository klonen**
   ```bash
   git clone <repository-url>
   cd CLDE-Gruppe-6
   ```

2. **Dependencies installieren**
   ```bash
   npm install
   ```

3. **MySQL Datenbank einrichten**

   **Option A: Lokales MySQL**
   ```bash
   # Starte MySQL
   # Datenbank wird automatisch beim ersten Start erstellt
   ```

   **Option B: Docker**
   ```bash
   docker run --name hangman-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=hangman_game -p 3306:3306 -d mysql:8.0
   ```

4. **Umgebungsvariablen konfigurieren**
   ```bash
   # .env Datei ist bereits vorhanden
   # Passe bei Bedarf an (z.B. DB_PASSWORD)
   ```

5. **Server starten**
   ```bash
   npm start
   ```

6. **Öffne Browser**
   ```
   http://localhost:3000
   ```

## 📖 Spielanleitung

### 1. Lobby erstellen oder beitreten

1. Gehe zu `http://localhost:3000`
2. Gib deinen Spielernamen ein
3. **Option A:** Klicke "Neue Session erstellen"
   - Du erhältst einen 6-stelligen Code
   - Teile diesen Code mit anderen Spielern
4. **Option B:** Klicke "Session beitreten"
   - Gib den 6-stelligen Code ein

### 2. Spiel starten

- Der **Host** (Ersteller) kann das Spiel starten
- Warte bis alle Spieler beigetreten sind
- Klicke "Spiel starten"

### 3. Spielen

- Spieler sind **sequenziell** an der Reihe (abwechselnd)
- Wähle einen Buchstaben wenn du dran bist
- Richtige Buchstaben werden im Wort angezeigt
- Falsche Buchstaben lassen den Hangman wachsen
- **Ziel:** Errate das Wort bevor der Hangman komplett ist

### 4. Chat nutzen

- Schreibe Nachrichten im Live-Chat (rechts)
- Kommuniziere mit anderen Spielern
- System-Nachrichten zeigen Spiel-Events an

## 📁 Projekt-Struktur

```
CLDE-Gruppe-6/
├── client/                    # Frontend
│   ├── index.html            # Landing Page
│   ├── seiten/
│   │   ├── lobby.html        # Lobby-System
│   │   └── game.html         # Hauptspiel (3-Spalten-Layout)
│   ├── css/
│   │   ├── styles.css        # Basis-Styles
│   │   ├── game.css          # Spiel-Layout
│   │   └── mobile.css        # Responsive Design
│   └── js/
│       ├── socket-client.js  # Socket.io Client-Wrapper
│       ├── lobby.js          # Lobby-Logik
│       └── game.js           # Spiel-Logik & UI
│
├── server/                    # Backend
│   ├── index.js              # Express Server Entry Point
│   ├── socket-handler.js     # Socket.io Event-Handler
│   ├── services/
│   │   ├── lobby-service.js  # Lobby-Verwaltung
│   │   ├── game-service.js   # Spiel-Logik
│   │   └── chat-service.js   # Chat-Service
│   ├── routes/
│   │   └── lobby.js          # REST API für Lobbies
│   └── db/
│       ├── connection.js     # MySQL Connection Pool
│       └── schema.sql        # Datenbank-Schema
│
├── .env                       # Umgebungsvariablen (nicht committen!)
├── .env.example               # Environment Template
├── package.json               # Dependencies
├── AWS_DEPLOYMENT.md          # AWS Deployment Guide
└── README.md                  # Diese Datei
```

## 🔌 API Dokumentation

### REST API Endpoints

#### POST /api/lobby/create
Erstellt eine neue Lobby.

**Request:**
```json
{
  "playerName": "Spieler1"
}
```

**Response:**
```json
{
  "success": true,
  "lobby": {
    "id": "uuid",
    "code": "ABC123",
    "status": "waiting"
  },
  "player": {
    "id": "uuid",
    "name": "Spieler1",
    "isHost": true
  },
  "sessionId": "uuid"
}
```

#### POST /api/lobby/join
Tritt einer Lobby bei.

**Request:**
```json
{
  "playerName": "Spieler2",
  "lobbyCode": "ABC123"
}
```

### Socket.io Events

#### Client → Server

- `player:join` - Spieler tritt Lobby bei
- `game:start` - Host startet Spiel
- `game:guess` - Spieler rät Buchstaben
- `chat:message` - Sendet Chat-Nachricht
- `game:reset` - Host startet neues Spiel

#### Server → Client

- `player:joined` - Neuer Spieler ist beigetreten
- `player:left` - Spieler hat Lobby verlassen
- `game:started` - Spiel wurde gestartet
- `game:updated` - Spielzustand aktualisiert
- `game:reset` - Spiel wurde zurückgesetzt
- `chat:new-message` - Neue Chat-Nachricht

## 🗄️ Datenbank-Schema

### lobbies
- `id` - UUID (Primary Key)
- `lobby_code` - 6-stelliger Code (Unique)
- `host_player_id` - Host Spieler ID
- `word` - Zu erratenes Wort
- `status` - waiting | playing | finished
- `current_turn_index` - Aktueller Spieler (Index)
- `attempts_left` - Verbleibende Versuche

### players
- `id` - UUID (Primary Key)
- `lobby_id` - Lobby ID (Foreign Key)
- `player_name` - Spielername
- `session_id` - Session ID
- `turn_order` - Reihenfolge (0, 1, 2, ...)
- `is_host` - Boolean

### game_state
- `lobby_id` - Lobby ID (Primary Key)
- `guessed_letters` - Geratene Buchstaben (CSV)
- `incorrect_guesses` - Falsche Buchstaben (CSV)
- `word_progress` - Aktueller Wort-Fortschritt

### chat_messages
- `id` - Auto Increment (Primary Key)
- `lobby_id` - Lobby ID (Foreign Key)
- `player_id` - Spieler ID (Foreign Key)
- `player_name` - Spielername
- `message` - Nachricht
- `message_type` - player | system

## ☁️ AWS Deployment

Detaillierte Schritt-für-Schritt Anleitung findest du in:
**[AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md)**

Kurz-Übersicht:

1. **RDS MySQL erstellen** (siehe Guide)
2. **EC2 Instanz erstellen** mit Node.js 22
3. **Code deployen** via Git oder SCP
4. **Umgebungsvariablen** in `.env` setzen
5. **PM2** für Process Management
6. **Nginx** als Reverse Proxy (optional)
7. **SSL/TLS** mit Let's Encrypt (optional)

## 🛠️ Development

### Lokale Entwicklung

```bash
# Development Server mit Auto-Reload
npm run dev

# Logs anzeigen
npm start | tail -f

# Datenbank zurücksetzen
# Lösche alle Tabellen und starte Server neu
```

### Debugging

```bash
# MySQL CLI
mysql -h localhost -u root -p hangman_game

# Tabellen anzeigen
SHOW TABLES;

# Lobbies anzeigen
SELECT * FROM lobbies;

# Spieler anzeigen
SELECT * FROM players;
```

## 🧪 Testing

```bash
# Backend-Tests (TODO)
npm test

# Manuelle Tests
# 1. Öffne 2 Browser-Tabs
# 2. Erstelle Lobby in Tab 1
# 3. Trete Lobby in Tab 2 bei
# 4. Starte Spiel und teste sequenzielles Gameplay
```

## 🔐 Sicherheit

- **Passwörter:** Niemals in Git committen (.env in .gitignore)
- **SQL Injection:** Prepared Statements werden verwendet
- **XSS:** HTML-Escaping im Chat
- **CORS:** Konfiguriert für Production
- **Rate Limiting:** TODO für Production

## 📝 Roadmap

- [ ] User Authentication
- [ ] Verschiedene Schwierigkeitsstufen
- [ ] Wort-Kategorien wählbar
- [ ] Rangliste/Leaderboard
- [ ] Sound-Effekte
- [ ] Animationen
- [ ] Mobile App (React Native)
- [ ] Internationalisierung (i18n)

## 🤝 Contributing

1. Fork das Repository
2. Erstelle Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to Branch (`git push origin feature/AmazingFeature`)
5. Öffne Pull Request

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE) für Details

## 👥 Autoren

- **CLDE Gruppe 6** - OST Ostschweizer Fachhochschule
- Cloud Development Modul (CLDE)

## 🙏 Acknowledgments

- Node.js & Express Community
- Socket.io Team
- OST Fachhochschule

---

**Viel Spaß beim Spielen! 🎮**

Bei Fragen oder Problemen erstelle ein [Issue](https://github.com/your-repo/issues).

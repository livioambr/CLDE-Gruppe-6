# 🎮 Hangman Multiplayer

Echtzeit-Multiplayer Hangman mit getrenntem Backend (API + Socket.io) und statischem Frontend.

![Hangman Screenshot](https://via.placeholder.com/800x400?text=Hangman+Multiplayer+Game)

## 📋 Features

- **Multiplayer:** Mehrere Spieler gleichzeitig am selben Wort
- **Sequenzielles Gameplay:** Spieler sind abwechselnd an der Reihe
- **Live Chat:** Echtzeit-Chat während des Spiels
- **Lobby-System:** Erstelle/trete mit 6-stelligem Code bei
- **Responsive Design:** Desktop und Mobile
- **Echtzeit-Updates:** Socket.io für synchrone Updates
- **AWS-Ready:** EC2 + RDS tauglich

## 🏗️ Architektur

```
Frontend (statisch, Vanilla JS)
    ↓ HTTP / WebSocket (CORS erlaubt)
Express API + Socket.io (Node.js)
    ↓ MySQL
MySQL Database
```

### Tech Stack

**Backend:** Node.js 22+, Express 5.1, Socket.io 4.8, MySQL2, uuid, dotenv, cors

**Frontend:** Vanilla JS (ESM), Socket.io Client, HTML/CSS

**Database:** MySQL 8.0; Tabellen: lobbies, players, game_state, chat_messages, words

## 🚀 Quick Start (lokal, getrennte Prozesse)

### Voraussetzungen
- Node.js 22+
- MySQL 8.0+ (lokal oder RDS)
- Git

### Schritte
1) Repository klonen
```bash
git clone <repository-url>
cd CLDE-Gruppe-6
```

2) Backend installieren & starten (Port 3000)
```bash
cd backend
npm install
# .env mit DB_* und FRONTEND_ORIGIN setzen, z.B. FRONTEND_ORIGIN=http://localhost:8080
FRONTEND_ORIGIN=http://localhost:8080 npm start
```

3) Frontend installieren & starten (statisch, Port 8080)
```bash
cd ../frontend
npm install
npm start
# In index.html / seiten/*.html sicherstellen:
#   window.SERVER_URL = 'http://localhost:3000'
```

4) Browser öffnen
```
http://localhost:8080
```

## Docker Installation (falls genutzt)

1. Repo klonen
```bash
git clone <repository-url>
cd CLDE-Gruppe-6
```
2. .env setzen (DB_*, FRONTEND_ORIGIN)
3. Stack starten
```bash
docker compose build
docker compose pull
docker compose up -d
```
4. Browser (abhängig von compose-Ports)
```
http://localhost:8080
```

## 📖 Spielanleitung

1. Gehe zu `http://localhost:8080`
2. Namen eingeben
3. **Neue Session:** „Neue Session erstellen" → 6-stelligen Code teilen
4. **Session beitreten:** Code eingeben → Spiel
5. Host kann „Spiel starten" wenn alle bereit sind
6. Abwechselnd Buchstaben raten; Chat rechts nutzen

## 🔌 API Dokumentation (Backend Port 3000)

### REST
- **POST /api/lobby/create** – Lobby anlegen
- **POST /api/lobby/join** – Lobby beitreten
- **POST /api/session/clear** – Session-Cookies serverseitig löschen (Logout)
- **GET  /api/health** – Healthcheck

Requests sollten `credentials: 'include'` nutzen, wenn Cookies/Sessions verwendet werden.

### Socket.io Events

**Client → Server**
- `player:join`
- `player:reconnect`
- `game:start`
- `game:guess`
- `chat:message`
- `game:reset`
- `player:left`
- `host:left`

**Server → Client**
- `player:joined`
- `player:left` (mit Players-Liste, ggf. currentTurnIndex)
- `game:started`
- `game:updated`
- `game:reset`
- `chat:new-message`
- `lobby:closed` ({ reason, lobbyCode })
- `host:disconnected` (Host offline, Lobby bleibt zum Reconnect bestehen)

## 🗄️ Datenbank-Schema (Kurz)
- **lobbies**: id (UUID), lobby_code (unique), host_player_id, word, status, current_turn_index, attempts_left
- **players**: id, lobby_id, player_name, session_id, turn_order, is_host, is_connected
- **game_state**: lobby_id, guessed_letters, incorrect_guesses, word_progress
- **chat_messages**: id, lobby_id, player_id, player_name, message, message_type

## 🛠️ Development

```bash
# Backend (Port 3000, CORS auf Frontend-Origin setzen)
cd backend
FRONTEND_ORIGIN=http://localhost:8080 npm run dev

# Frontend (statisch, Port 8080)
cd ../frontend
npm run dev
```
Hinweise:
- Frontend muss `window.SERVER_URL` auf die Backend-URL setzen (z.B. http://localhost:3000).
- Backend nutzt CORS mit `FRONTEND_ORIGIN`; credentials=true gesetzt.
- Housekeeping löscht alte Chats und inaktive Lobbies periodisch.

## 🧪 Testing (manuell)
- Zwei Browser-Tabs öffnen
- Tab 1: Lobby erstellen, Code kopieren
- Tab 2: Lobby beitreten
- Spiel starten, Züge abwechseln, Chat prüfen
- Host verlassen → `lobby:closed` sollte Clients schließen/redirecten

## 🔐 Sicherheit
- .env nicht committen
- Prepared Statements (mysql2)
- Chat-Escaping gegen XSS (clientseitig beachten)
- CORS streng über `FRONTEND_ORIGIN`
- Rate Limiting für Prod noch ergänzen

## 📝 Roadmap
- [ ] User Authentication
- [ ] Schwierigkeitsgrade
- [ ] Wort-Kategorien
- [ ] Leaderboard
- [ ] Sound/Animationen
- [ ] Mobile App
- [ ] i18n

## 🤝 Contributing
1. Fork
2. Branch (`git checkout -b feature/...`)
3. Commit
4. Push
5. PR

## 📄 Lizenz
MIT License – siehe [LICENSE](LICENSE)

## 👥 Autoren
- **CLDE Gruppe 6** - OST Ostschweizer Fachhochschule
- Cloud Development Modul (CLDE)

---
**Viel Spaß beim Spielen! 🎮**

Bei Fragen oder Problemen erstelle ein Issue.

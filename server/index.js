import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import sessionRouter from './routes/session.js';
import { setupSocketHandlers } from './socket-handler.js';

// ES Module __dirname workaround
import path from 'path';
import { fileURLToPath } from 'url';

// Lade Umgebungsvariablen
import dotenv from 'dotenv';
dotenv.config();

// DB Verbindung
import { initializeDatabase } from './db/connection.js';

// ES Module __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:8080';

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API route to clear HttpOnly session cookie (if present)
app.use('/api/session', sessionRouter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Fallback für SPA - Express 5.x kompatibel
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API Endpoint nicht gefunden' });
  }
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

const server = http.createServer(app);

const io = new IOServer(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.io Setup
setupSocketHandlers(io);

// Server starten
async function startServer() {
  try {
    console.log('🚀 Starte Hangman Multiplayer Server...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Initialisiere Datenbank
    console.log('\n📦 Initialisiere Datenbank...');
    const dbInitialized = await initializeDatabase();

    if (!dbInitialized) {
      console.error('❌ Datenbank-Initialisierung fehlgeschlagen');
      console.error('Stelle sicher, dass:');
      console.error('  1. MySQL Server läuft');
      console.error('  2. .env Datei korrekt konfiguriert ist');
      console.error('  3. Datenbankbenutzer die richtigen Berechtigungen hat');
      process.exit(1);
    }

    server.listen(PORT, () => {
      console.log('\n✅ Server erfolgreich gestartet!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🌐 Server läuft auf: ${FRONTEND_ORIGIN}`);
      console.log(`📍 Lokal erreichbar: http://localhost:${PORT}`);
      console.log(`🔌 Socket.io:        ws://localhost:${PORT}`);
      console.log(`💾 Datenbank:        ${process.env.DB_HOST || 'localhost'}`);
      console.log(`📁 Frontend:         ${path.join(__dirname, '../client')}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('💡 Bereit für Verbindungen!\n');
      if (process.env.NODE_ENV === 'production') {
        console.log('⚠️  Production Mode: Nutze EC2 Public IP oder Domain für externe Verbindungen\n');
      }
    });
  } catch (error) {
    console.error('❌ Fehler beim Starten des Servers:', error);
    process.exit(1);
  }
}

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM empfangen. Server wird heruntergefahren...');
  server.close(() => {
    console.log('✅ Server geschlossen');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT empfangen. Server wird heruntergefahren...');
  server.close(() => {
    console.log('✅ Server geschlossen');
    process.exit(0);
  });
});

// Unhandled Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Starte Server
startServer();

import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import sessionRouter from './routes/session.js';
import lobbyRouter from './routes/lobby.js'; // <-- neu
import { setupSocketHandlers } from './socket-handler.js';

// Lade Umgebungsvariablen
import dotenv from 'dotenv';
dotenv.config();

// DB Verbindung
import { initializeDatabase } from './db/connection.js';
import { cleanupOldMessages } from './services/chat-service.js';
import { cleanupStaleLobbies } from './services/lobby-service.js';

// Entfernte __dirname/Path-Logik - Frontend wird separat gehostet
const app = express();

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://hangman.hipstertech.ch';

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API route to clear HttpOnly session cookie (if present)
app.use('/api/session', sessionRouter);

// mount lobby routes
app.use('/api/lobby', lobbyRouter); // <-- neu

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Do NOT serve frontend from this backend. Frontend is a separate static site.
// Return explicit 404 for non-API routes so clients know to use the static frontend host.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API Endpoint nicht gefunden' });
  }
  return res.status(404).json({
    error: 'Not Found. Frontend is served separately. Configure FRONTEND_ORIGIN to your frontend URL.'
  });
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
      console.log(`📍 Lokal erreichbar: http://localhost:${PORT}`);
      console.log(`🔌 Socket.io:        ws://localhost:${PORT}`);
      console.log(`💾 Datenbank:        ${process.env.DB_HOST || 'localhost'}`);
      console.log(`🌐 Allowed frontend origin: ${FRONTEND_ORIGIN}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('💡 Bereit für Verbindungen!\n');
      if (process.env.NODE_ENV === 'production') {
        console.log('⚠️  Production Mode: Nutze die konfigurierte FRONTEND_ORIGIN für externe Verbindungen\n');
      }

      // Start housekeeping tasks
      startHousekeeping();
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

// Housekeeping - periodic cleanup of old data
function startHousekeeping() {
  console.log('🧹 Housekeeping gestartet');
  
  // Cleanup old chat messages every 6 hours
  setInterval(async () => {
    try {
      console.log('🧹 Starte Chat-Cleanup...');
      await cleanupOldMessages(1); // Delete messages older than 1 day
    } catch (error) {
      console.error('❌ Fehler beim Chat-Cleanup:', error);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  // Cleanup stale lobbies every hour
  setInterval(async () => {
    try {
      console.log('🧹 Starte Lobby-Cleanup...');
      await cleanupStaleLobbies(24); // Delete lobbies inactive for 24+ hours
    } catch (error) {
      console.error('❌ Fehler beim Lobby-Cleanup:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Run initial cleanup after 1 minute
  setTimeout(async () => {
    try {
      console.log('🧹 Initiales Cleanup...');
      await cleanupOldMessages(7);
      await cleanupStaleLobbies(24);
    } catch (error) {
      console.error('❌ Fehler beim initialen Cleanup:', error);
    }
  }, 60 * 1000); // 1 minute
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

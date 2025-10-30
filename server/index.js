import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db/connection.js';
import { setupSocketHandlers } from './socket-handler.js';
import lobbyRoutes from './routes/lobby.js';

// ES Module __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lade Umgebungsvariablen
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statische Dateien (Frontend)
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/lobby', lobbyRoutes);

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

    // Starte HTTP Server
    httpServer.listen(PORT, () => {
      console.log('\n✅ Server erfolgreich gestartet!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🌐 HTTP Server:     http://localhost:${PORT}`);
      console.log(`🔌 Socket.io:       ws://localhost:${PORT}`);
      console.log(`💾 Datenbank:       ${process.env.DB_HOST || 'localhost'}`);
      console.log(`📁 Frontend:        ${path.join(__dirname, '../client')}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('💡 Bereit für Verbindungen!\n');
    });
  } catch (error) {
    console.error('❌ Fehler beim Starten des Servers:', error);
    process.exit(1);
  }
}

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM empfangen. Server wird heruntergefahren...');
  httpServer.close(() => {
    console.log('✅ Server geschlossen');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT empfangen. Server wird heruntergefahren...');
  httpServer.close(() => {
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

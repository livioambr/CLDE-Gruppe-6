import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MySQL Connection Pool Config
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  multipleStatements: true // wichtig für CREATE DATABASE + USE + INSERT etc.
};

let pool = mysql.createPool(poolConfig);

/**
 * Retry-Verbindung: versuche alle 10 Sekunden, bis erfolgreich
 */
async function connectWithRetry() {
  while (true) {
    try {
      const connection = await pool.getConnection();
      console.log('✅ MySQL Verbindung erfolgreich');
      connection.release();
      break;
    } catch (error) {
      console.error('❌ Verbindungsfehler:', error.message);
      console.log('🔁 Neuer Verbindungsversuch in 10 Sekunden...');
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }
  }
}

/**
 * Initialisiert die Datenbank und führt das bestehende schema.sql aus
 */
export async function initializeDatabase() {
  await connectWithRetry();

  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  // temporäre Connection ohne DB, multipleStatements = true
  const connection = await mysql.createConnection({ ...poolConfig, multipleStatements: true });

  try {
    // Schema auf einmal ausführen (inkl. CREATE DATABASE, USE, CREATE TABLE, INSERT)
    await connection.query(schema);
    console.log('✅ Schema erfolgreich ausgeführt');

    // Pool mit DB aus .env neu erstellen
    const dbName = process.env.DB_NAME || 'hangman_game';
    await pool.end();
    pool = mysql.createPool({ ...poolConfig, database: dbName, multipleStatements: true });

    console.log('✅ Datenbank-Initialisierung abgeschlossen');
    return true;
  } catch (err) {
    console.error('❌ Fehler beim Ausführen des Schemas:', err.message);
    return false;
  } finally {
    await connection.end();
  }
}

/**
 * Helper: Query ausführen
 */
export async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('SQL Query Fehler:', error.message);
    throw error;
  }
}

/**
 * Helper: Einzelnes Ergebnis
 */
export async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

/**
 * Pool beim Beenden sauber schließen
 */
process.on('SIGINT', async () => {
  await pool.end();
  console.log('MySQL Connection Pool geschlossen');
  process.exit(0);
});

export default pool;

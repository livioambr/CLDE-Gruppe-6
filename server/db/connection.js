import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MySQL Connection Pool (ohne Database für Initialisierung)
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Pool wird nach DB-Initialisierung mit Database erstellt
let pool = mysql.createPool(poolConfig);

// Datenbankverbindung testen und Schema initialisieren
export async function initializeDatabase() {
  try {
    // Teste Verbindung
    const connection = await pool.getConnection();
    console.log('✅ MySQL Verbindung erfolgreich');

    const dbName = process.env.DB_NAME || 'hangman_game';

    // Prüfe ob Datenbank existiert
    const [databases] = await connection.query(
      `SHOW DATABASES LIKE '${dbName}'`
    );

    if (databases.length === 0) {
      console.log('📝 Erstelle Datenbank und Tabellen...');

      // Lese Schema-Datei
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');

      // Führe Schema-Script aus (Statement für Statement)
      const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        try {
          await connection.query(statement);
        } catch (err) {
          // Ignoriere "already exists" Fehler
          if (!err.message.includes('already exists')) {
            console.error('Fehler bei SQL Statement:', statement.substring(0, 50) + '...');
            throw err;
          }
        }
      }

      console.log('✅ Datenbank und Tabellen erfolgreich erstellt');
    } else {
      console.log('✅ Datenbank existiert bereits');
    }

    connection.release();

    // Recreate pool mit Database-Auswahl
    await pool.end();
    pool = mysql.createPool({
      ...poolConfig,
      database: dbName
    });

    return true;
  } catch (error) {
    console.error('❌ Datenbankfehler:', error.message);
    console.error('Stelle sicher, dass MySQL läuft und die .env Konfiguration korrekt ist');
    return false;
  }
}

// Helper Funktion: Query ausführen
export async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('SQL Query Fehler:', error.message);
    throw error;
  }
}

// Helper Funktion: Einzelnes Ergebnis
export async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

// Verbindung beim Beenden schließen
process.on('SIGINT', async () => {
  await pool.end();
  console.log('MySQL Connection Pool geschlossen');
  process.exit(0);
});

export default pool;

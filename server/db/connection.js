import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

let pool = mysql.createPool(poolConfig);

/**
 * Versucht, die Datenbankverbindung herzustellen — mit Retry-Mechanismus.
 */
async function connectWithRetry() {
  while (true) {
    try {
      const connection = await pool.getConnection();
      console.log('✅ MySQL Verbindung erfolgreich');
      connection.release();
      break; // Erfolg → aus der Schleife raus
    } catch (error) {
      console.error('❌ Verbindungsfehler:', error.message);
      console.log('🔁 Neuer Verbindungsversuch in 10 Sekunden...');
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }
  }
}

/**
 * Initialisiert Datenbank (erstellt DB und Tabellen bei Bedarf)
 */
export async function initializeDatabase() {
  await connectWithRetry(); // Warte bis Verbindung klappt

  const connection = await pool.getConnection();
  const dbName = process.env.DB_NAME || 'hangman_game';

  try {
    const [databases] = await connection.query(
      `SHOW DATABASES LIKE '${dbName}'`
    );

    if (databases.length === 0) {
      console.log('📝 Erstelle Datenbank und Tabellen...');
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');
      const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        try {
          await connection.query(statement);
        } catch (err) {
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

    // Recreate Pool mit ausgewählter Datenbank
    await pool.end();
    pool = mysql.createPool({
      ...poolConfig,
      database: dbName
    });

    return true;
  } catch (error) {
    console.error('❌ Fehler bei der DB-Initialisierung:', error.message);
    return false;
  }
}

export async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('SQL Query Fehler:', error.message);
    throw error;
  }
}

export async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

process.on('SIGINT', async () => {
  await pool.end();
  console.log('MySQL Connection Pool geschlossen');
  process.exit(0);
});

export default pool;

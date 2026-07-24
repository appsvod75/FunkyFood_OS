import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') }); // Try to read from root .env.local first
dotenv.config(); // Then try standard .env

// Detect environment
const isProduction = process.env.NODE_ENV === 'production';

// Configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'restaurante_os',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Enable Date Strings to fix potential timezone weirdness
    dateStrings: true,
    timezone: '-06:00' // El Salvador (UTC-6, no DST)
};

// Force Socket on Linux if localhost (Fixes ECONNREFUSED 127.0.0.1)
if (dbConfig.host === 'localhost' && process.platform === 'linux') {
    console.log('[DB] Using Unix Socket for MySQL Connection...');
    dbConfig.socketPath = '/var/run/mysqld/mysqld.sock';
    delete dbConfig.host; // Remove host to force socket usage
}

const pool = mysql.createPool(dbConfig);

export default pool;

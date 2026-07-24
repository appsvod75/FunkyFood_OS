
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars similar to db.js
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'restaurante_os',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Force Socket on Linux if localhost (Fixes ECONNREFUSED)
if (dbConfig.host === 'localhost' && process.platform === 'linux') {
    console.log('[Migration] Using Unix Socket for MySQL Connection...');
    dbConfig.socketPath = '/var/run/mysqld/mysqld.sock';
    delete dbConfig.host;
}

async function migrate() {
    let conn;
    try {
        console.log('Connecting to database...');
        conn = await mysql.createConnection(dbConfig);
        console.log('Connected.');

        // 1. Add 'type' to 'meats'
        try {
            await conn.query("ALTER TABLE meats ADD COLUMN type VARCHAR(20) DEFAULT 'meat'");
            console.log("Added 'type' column to 'meats'.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'type' column already exists in 'meats'.");
            else throw e;
        }

        // 2. Add 'sort_order' to 'categories'
        try {
            await conn.query("ALTER TABLE categories ADD COLUMN sort_order INT DEFAULT 0");
            console.log("Added 'sort_order' column to 'categories'.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'sort_order' column already exists in 'categories'.");
            else throw e;
        }

        // 3. Add 'requires_masa' to 'products'
        try {
            await conn.query("ALTER TABLE products ADD COLUMN requires_masa BOOLEAN DEFAULT FALSE");
            console.log("Added 'requires_masa' column to 'products'.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'requires_masa' column already exists in 'products'.");
            else throw e;
        }

        // 4. Add 'masa_id' to 'order_items'
        try {
            await conn.query("ALTER TABLE order_items ADD COLUMN masa_id INT NULL");
            console.log("Added 'masa_id' column to 'order_items'.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'masa_id' column already exists in 'order_items'.");
            else throw e;
        }

        console.log('Migration completed successfully.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        if (conn) await conn.end();
    }
}

migrate();

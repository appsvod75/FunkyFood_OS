
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'restaurante_os',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

if (dbConfig.host === 'localhost' && process.platform === 'linux') {
    dbConfig.socketPath = '/var/run/mysqld/mysqld.sock';
    delete dbConfig.host;
}

async function migrate() {
    let conn;
    try {
        console.log('Connecting to database...');
        conn = await mysql.createConnection(dbConfig);
        console.log('Connected.');

        // 1. Add 'is_combo' to 'products'
        try {
            await conn.query("ALTER TABLE products ADD COLUMN is_combo BOOLEAN DEFAULT FALSE");
            console.log("Added 'is_combo' column to 'products'.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'is_combo' column already exists in 'products'.");
            else throw e;
        }

        // 2. Add 'combo_definition' to 'products'
        try {
            await conn.query("ALTER TABLE products ADD COLUMN combo_definition JSON NULL");
            console.log("Added 'combo_definition' column to 'products'.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'combo_definition' column already exists in 'products'.");
            else throw e;
        }

        // 3. Add 'combo_selections' to 'order_items'
        try {
            await conn.query("ALTER TABLE order_items ADD COLUMN combo_selections JSON NULL");
            console.log("Added 'combo_selections' column to 'order_items'.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'combo_selections' column already exists in 'order_items'.");
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

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'restaurante_os'
    };

    // Force Socket on Linux if localhost
    if (dbConfig.host === 'localhost' && process.platform === 'linux') {
        dbConfig.socketPath = '/var/run/mysqld/mysqld.sock';
        delete dbConfig.host;
    }

    const pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();

    try {
        console.log("Starting migration...");

        try {
            await conn.query("ALTER TABLE categories ADD COLUMN is_active TINYINT(1) DEFAULT 1");
            console.log("Added 'is_active' to categories.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'is_active' already exists in categories.");
            else throw e;
        }

        try {
            await conn.query("ALTER TABLE meats ADD COLUMN is_active TINYINT(1) DEFAULT 1");
            console.log("Added 'is_active' to meats.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'is_active' already exists in meats.");
            else throw e;
        }

        try {
            await conn.query("ALTER TABLE products ADD COLUMN is_active TINYINT(1) DEFAULT 1");
            console.log("Added 'is_active' to products.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'is_active' already exists in products.");
            else throw e;
        }

        try {
            await conn.query("ALTER TABLE product_extras ADD COLUMN is_active TINYINT(1) DEFAULT 1");
            console.log("Added 'is_active' to product_extras.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("'is_active' already exists in product_extras.");
            else throw e;
        }

        console.log("Migration finished successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        conn.release();
        await pool.end();
    }
}

migrate();

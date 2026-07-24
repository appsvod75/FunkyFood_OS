import mysql from 'mysql2/promise';

async function migrate() {
    console.log('[MIGRATION] Checking for missing columns in branches table...');

    // Explicit TCP connection to avoid the socketPath logic in db.js
    const conn = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'restaurante_os'
    });
    try {
        const columnsToAdd = [
            { name: 'logo_url', type: 'VARCHAR(500) DEFAULT NULL' },
            { name: 'ticket_width', type: "VARCHAR(20) DEFAULT '80mm'" },
            { name: 'auto_close_time', type: 'TIME DEFAULT NULL' },
            { name: 'auto_close_enabled', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'gemini_api_key', type: 'VARCHAR(500) DEFAULT NULL' }
        ];

        const [existingColumns] = await conn.query('SHOW COLUMNS FROM branches');
        const columnNames = existingColumns.map(c => c.Field);

        for (const col of columnsToAdd) {
            if (!columnNames.includes(col.name)) {
                console.log(`[MIGRATION] Adding column: ${col.name}`);
                await conn.query(`ALTER TABLE branches ADD COLUMN ${col.name} ${col.type}`);
            }
        }
        console.log('[MIGRATION] Branches table is up to date.');
    } catch (err) {
        console.error('[MIGRATION ERROR]', err);
    } finally {
        conn.release();
        process.exit();
    }
}

migrate();

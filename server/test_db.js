import pool from './db.js';

async function test() {
    console.log('Testing DB connection...');
    try {
        const [rows] = await pool.query('SELECT 1 + 1 AS result');
        console.log('Success:', rows);
    } catch (err) {
        console.error('Error:', err.message);
        if (err.message.includes('ENOENT')) {
            console.log('Socket not found. Trying 127.0.0.1...');
        }
    } finally {
        process.exit();
    }
}
test();

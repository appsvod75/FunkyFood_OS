import pool from './server/db.js';

async function migrate() {
    try {
        console.log('Starting migration: Adding manual_discount to orders table...');

        // Use a single query to add the column if it doesn't exist
        const sql = `
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS manual_discount DECIMAL(10,2) DEFAULT 0.00 AFTER discount
        `;

        // Note: IF NOT EXISTS for ADD COLUMN is supported in MariaDB 10.2.12+ 
        // For MySQL, we might need to check if it exists first.

        try {
            await pool.execute('ALTER TABLE orders ADD COLUMN manual_discount DECIMAL(10,2) DEFAULT 0.00 AFTER discount');
            console.log('Column manual_discount added successfully.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column manual_discount already exists.');
            } else {
                throw err;
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();

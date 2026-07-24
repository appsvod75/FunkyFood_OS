import mysql from 'mysql2/promise';

async function migrate() {
    const dbConfig = {
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'restaurante_os',
    };

    try {
        console.log('Starting migration (TCP): Adding manual_discount to orders table...');
        const connection = await mysql.createConnection(dbConfig);

        try {
            await connection.execute('ALTER TABLE orders ADD COLUMN manual_discount DECIMAL(10,2) DEFAULT 0.00 AFTER discount');
            console.log('Column manual_discount added successfully.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column manual_discount already exists.');
            } else {
                throw err;
            }
        }

        await connection.end();
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();

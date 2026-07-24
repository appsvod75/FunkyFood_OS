import pool from './db.js';

async function debug() {
    try {
        console.log('--- Probando Consulta de Popularidad ---');
        const sql = 'SELECT product_id, SUM(quantity) as total_qty FROM order_items JOIN orders ON order_items.order_id = orders.id WHERE orders.status = "completed" AND orders.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY product_id';
        const [results] = await pool.query(sql);
        console.log('Resultados:', results);

        console.log('\n--- Probando Conteos de Estados ---');
        const statusSql = 'SELECT status, COUNT(*) as count FROM orders GROUP BY status';
        const [statuses] = await pool.query(statusSql);
        console.log('Estados en DB:', statuses);

        console.log('\n--- Probando Últimas Ventas ---');
        const lastSalesSql = 'SELECT id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5';
        const [lastSales] = await pool.query(lastSalesSql);
        console.log('Últimos pedidos:', lastSales);

    } catch (e) {
        console.error('Error en debug:', e);
    } finally {
        process.exit();
    }
}

debug();

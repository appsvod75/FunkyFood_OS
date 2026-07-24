import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import routes from './routes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now (adjust for production security)
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

app.use(cors());
app.use(express.json());

// Pass io to routes via middleware
app.use((req, res, next) => {
    req.io = io;
    next();
});

// API Routes
app.use('/api', routes);

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });

    // You can add more socket event listeners here if needed
    // e.g. for specific room joining: socket.join('kitchen');
});

const PORT = process.env.PORT || 3001;


// --- AUTO CLOSE JOB (Moved here to access IO) ---
import pool from './db.js';
import { autoGenerateClosingReport, triggerClosingWebhook } from './utils/closingUtils.js';

// Helper for AutoClose
const query = async (sql, params) => {
    const [rows, fields] = await pool.execute(sql, params);
    return rows;
};

// Check every minute (60,000 ms) for precision and warnings
setInterval(async () => {
    try {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        // Local time string HH:mm
        // Local date YYYY-MM-DD robusto
        const today = now.toLocaleDateString('en-CA'); 
        // Local time string HH:mm robusto
        const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const currentTimeSec = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // 1. Get Branches with Auto Close Enabled
        const branches = await query('SELECT * FROM branches WHERE auto_close_enabled = 1 AND auto_close_time IS NOT NULL');

        for (const branch of branches) {
            // --- WARNING LOGIC ---
            // Calculate minutes between current time and auto_close_time
            const [cHour, cMin] = currentTime.split(':').map(Number);
            const [aHour, aMin] = branch.auto_close_time.split(':').map(Number);

            const currentTotalMins = cHour * 60 + cMin;
            const targetTotalMins = aHour * 60 + aMin;
            const diffMins = targetTotalMins - currentTotalMins;

            // Emit warnings at 30, 10, 5 minutes before
            if (diffMins === 30 || diffMins === 10 || diffMins === 5) {
                const pendingCountRows = await query(
                    'SELECT COUNT(*) as count FROM orders WHERE branch_id = ? AND status != "completed"',
                    [branch.id]
                );
                const pendingCount = pendingCountRows[0].count;

                if (pendingCount > 0) {
                    io.emit('auto_close_warning', {
                        branchId: branch.id,
                        branchName: branch.name,
                        minutesLeft: diffMins,
                        pendingOrders: pendingCount
                    });
                    console.log(`[AutoClose] Warning sent for ${branch.name}: ${diffMins} minutes left.`);
                }
            }

            const lastRunStr = branch.last_auto_close_run 
                ? new Date(branch.last_auto_close_run).toLocaleDateString('en-CA') 
                : null;

            // Run if current time is >= auto_close_time and hasn't run today
            if (currentTime >= branch.auto_close_time.substring(0, 5) && lastRunStr !== today) {
                // LOCK: Intento marcar la sucursal como 'ejecutada hoy' de forma ATÓMICA
                // Esto previene que si hay 2 procesos (PM2 Cluster), ambos envíen el correo.
                const [lockResult] = await pool.execute(
                    'UPDATE branches SET last_auto_close_run = ? WHERE id = ? AND (last_auto_close_run != ? OR last_auto_close_run IS NULL)',
                    [today, branch.id, today]
                );

                if (lockResult.affectedRows === 0) {
                    // Si no afectó ninguna fila, es que otro proceso ya lo hizo hace milisegundos
                    continue; 
                }

                console.log(`[AutoClose] Execution LOCK acquired for ${branch.name}. Starting...`);

                // 1. Buscar Sesión Activa (Turno)
                const [activeSessionRows] = await pool.execute(
                    'SELECT id, DATE_FORMAT(date, "%Y-%m-%d") as date FROM cash_closing_reports WHERE branch_id = ? AND status = "OPEN" ORDER BY id DESC LIMIT 1',
                    [branch.id]
                );

                if (activeSessionRows.length === 0) {
                    console.log(`[AutoClose] No open session found for ${branch.name}. Skipping auto-close logic.`);
                } else {
                    const activeSessionId = activeSessionRows[0].id;
                    const reportDate = activeSessionRows[0].date;

                    // 2. Buscar órdenes pendientes
                    const pendingOrders = await query(
                        'SELECT id, total FROM orders WHERE branch_id = ? AND status != "completed"',
                        [branch.id]
                    );

                    if (pendingOrders.length > 0) {
                        console.log(`[AutoClose] Closing ${pendingOrders.length} orders for session ${activeSessionId}...`);
                        const conn = await pool.getConnection();
                        try {
                            await conn.beginTransaction();

                            for (const order of pendingOrders) {
                                // 1. Calcular balance pendiente
                                const [paymentRows] = await conn.execute(
                                    'SELECT SUM(amount) as total_paid FROM payments WHERE order_id = ?',
                                    [order.id]
                                );
                                const paidSoFar = parseFloat(paymentRows[0].total_paid || 0);
                                const balance = Math.max(0, order.total - paidSoFar);

                                // 2. Forzar limpieza de KDS y asignar sesión
                                await conn.execute(
                                    'UPDATE orders SET status = "completed", kitchen_status = "served", ready_at = IFNULL(ready_at, NOW()), completed_at = NOW(), amount_paid = ?, change_given = 0, cash_report_id = COALESCE(cash_report_id, ?) WHERE id = ?',
                                    [order.total, activeSessionId, order.id]
                                );

                                // 3. Registrar pago solo si hay saldo pendiente
                                if (balance > 0) {
                                    await conn.execute(
                                        'INSERT INTO payments (order_id, method, amount, received_by) VALUES (?, "Efectivo", ?, "Sistema Auto-Close")',
                                        [order.id, balance]
                                    );
                                }
                            }

                            await conn.commit();
                            console.log(`[AutoClose] Closed ${pendingOrders.length} orders for ${branch.name}.`);
                            io.emit('orders_updated');

                        } catch (err) {
                            if (conn) await conn.rollback();
                            console.error(`[AutoClose] Error closing orders for ${branch.name}:`, err);
                        } finally {
                            if (conn) conn.release();
                        }
                    } else {
                        console.log(`[AutoClose] No open orders for ${branch.name}. Proceeding to auto-report.`);
                    }

                    // 3. Generar Reporte y Enviar Correo
                    try {
                        console.log(`[AutoClose] Generating report for ${branch.name} (Date: ${reportDate}, SessionID: ${activeSessionId})`);
                        const report = await autoGenerateClosingReport(branch.id, reportDate, activeSessionId);
                        if (report && (report.totalSales > 0 || report.totalOrders > 0)) {
                            await triggerClosingWebhook(branch.id, report);
                            console.log(`[AutoClose] Automatic email report sent for ${branch.name}.`);
                        } else {
                            console.log(`[AutoClose] No sales to report for ${branch.name}. Email skipped.`);
                        }
                    } catch (reportErr) {
                        console.error(`[AutoClose] Failed to send auto report for ${branch.name}:`, reportErr);
                    }
                }
            }
        }
    } catch (e) {
        console.error('[AutoClose] Job failed:', e);
    }
}, 60000); // 1 minute

// --- FORCE LOGOUT JOB (3:00 AM) ---
// We check every minute to be precise if we are at 03:00 manually, 
// or once per hour. Let's do it like the AutoClose job.
setInterval(async () => {
    try {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        // Global Logout at 03:00 AM
        // We use a simple variable to avoid multiple triggers in the same minute
        if (currentTime === "03:00") {
            console.log(`[ForceLogout] Global Trigger at ${currentTime}...`);
            io.emit('force_logout', { reason: 'daily_reset', time: today });
            console.log('[ForceLogout] Sent logout signal to all clients.');
        }
    } catch (e) {
        console.error('[ForceLogout] Job failed:', e);
    }
}, 60000); // Check every minute

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

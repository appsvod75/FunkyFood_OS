import pool from '../db.js';

/**
 * Helper to run queries directly from the pool
 */
const query = async (sql, params) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
};

/**
 * Triggers the closing webhook for a specific branch
 * @param {number} branchId 
 * @param {object} reportData The report object to send
 */
export async function triggerClosingWebhook(branchId, reportData) {
    try {
        const [branch] = await query('SELECT * FROM branches WHERE id = ?', [branchId]);
        if (branch && branch.closing_webhook_url) {
            console.log(`[CLOSING-UTILS] Triggering Webhook for Branch ${branchId} (${branch.name})...`);
            
            const webhookData = {
                type: 'cash_closing',
                branch: {
                    name: branch.name,
                    address: branch.address,
                    phone: branch.phone
                },
                report: {
                    date: reportData.date,
                    initialCash: reportData.initialCash,
                    totalSales: reportData.totalSales,
                    totalCashIn: reportData.totalCashIn,
                    totalChangeOut: reportData.totalChangeOut,
                    expectedCash: reportData.expectedCash,
                    totalOrders: reportData.totalOrders,
                    totalServiceCharge: reportData.totalServiceCharge,
                    totalCardCommission: reportData.totalCardCommission,
                    summary: reportData.summary
                },
                emails: branch.closing_email // Comma separated emails
            };

            // Non-blocking fetch
            fetch(branch.closing_webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookData)
            }).catch(err => console.error(`[CLOSING-UTILS] Webhook Error (Branch ${branchId}):`, err.message));
            
            return true;
        }
        return false;
    } catch (err) {
        console.error(`[CLOSING-UTILS] Failed to initiate webhook for Branch ${branchId}:`, err);
        return false;
    }
}

/**
 * Automatically generates, saves and summarizes a daily report for a branch.
 * Replicates the logic from CashClosingScreen.tsx in the server.
 * @param {number} branchId 
 * @param {string} date YYYY-MM-DD
 * @param {number|null} reportId Optional ID of the specific session to close
 * @returns {object|null} The generated report or null if no sales found
 */
export async function autoGenerateClosingReport(branchId, date, reportId = null) {
    try {
        console.log(`[CLOSING-UTILS] Auto-generating report for Branch ${branchId} - Date: ${date} - reportId: ${reportId}`);

        // 1. Get all completed orders for this branch and session
        // If we have a reportId, we also fetch orphans (null) that match the branch and the date of the report
        // to catch orders created during sync/network issues in the middle of the night.
        let orders;
        if (reportId) {
            // Fetch session date to look for orphans if needed
            const [sessionInfo] = await query('SELECT DATE_FORMAT(date, "%Y-%m-%d") as date FROM cash_closing_reports WHERE id = ?', [reportId]);
            const sDate = sessionInfo ? sessionInfo.date : date;

            orders = await query(
                `SELECT id, total, status, change_given, service_charge, card_commission 
                 FROM orders 
                 WHERE branch_id = ? 
                 AND (cash_report_id = ? OR (cash_report_id IS NULL AND DATE(created_at) = ?))
                 AND status = "completed"`,
                [branchId, reportId, sDate]
            );
        } else {
            orders = await query(
                'SELECT id, total, status, change_given, service_charge, card_commission FROM orders WHERE branch_id = ? AND DATE(created_at) = ? AND status = "completed"',
                [branchId, date]
            );
        }

        if (orders.length === 0) {
            console.log(`[CLOSING-UTILS] No sales found for Branch ${branchId} (reportId: ${reportId}). Skipping.`);
            return null;
        }

        // 2. Get all payments for these orders
        const orderIds = orders.map(o => o.id);
        const placeholders = orderIds.map(() => '?').join(',');
        const payments = await query(
            `SELECT method, amount FROM payments WHERE order_id IN (${placeholders})`,
            orderIds
        );

        // 3. Calculate Totals (Mirroring Frontend logic)
        let totalSalesRaw = 0;
        let totalServiceCharge = 0;
        let totalCardCommission = 0;
        let totalChangeOut = 0;
        const summaryMap = {};

        orders.forEach(o => {
            totalSalesRaw += parseFloat(o.total || 0);
            totalServiceCharge += parseFloat(o.service_charge || 0);
            totalCardCommission += parseFloat(o.card_commission || 0);
            totalChangeOut += parseFloat(o.change_given || 0);
        });

        payments.forEach(p => {
            const method = p.method || 'Otro';
            if (!summaryMap[method]) summaryMap[method] = 0;
            summaryMap[method] += parseFloat(p.amount || 0);
        });

        // Format summary array and subtract change from Cash
        const summary = Object.entries(summaryMap).map(([method, total]) => ({
            method,
            total: (method.toLowerCase() === 'efectivo') ? total - totalChangeOut : total
        }));

        const totalCashIn = (summaryMap['Efectivo'] || 0) - totalChangeOut;
        
        // Match frontend: Total Sales is the sum of the net method totals (including charges)
        const totalSalesSum = summary.reduce((sum, s) => sum + s.total, 0);

        // 4. Fetch initial_cash from existing report
        let initialCash = 0;
        if (reportId) {
            const [existing] = await query(
                'SELECT initial_cash FROM cash_closing_reports WHERE id = ?',
                [reportId]
            );
            initialCash = existing ? parseFloat(existing.initial_cash) : 0;
        } else {
            const [existing] = await query(
                'SELECT initial_cash FROM cash_closing_reports WHERE branch_id = ? AND date = ?',
                [branchId, date]
            );
            initialCash = existing ? parseFloat(existing.initial_cash) : 0;
        }

        const expectedCash = initialCash + totalCashIn;

        const report = {
            branchId,
            date,
            reportId,
            initialCash,
            totalSales: totalSalesSum,
            totalCashIn,
            totalChangeOut,
            expectedCash,
            totalOrders: orders.length,
            totalServiceCharge,
            totalCardCommission,
            summary: summary,
            createdAt: new Date()
        };

        // 5. Save/Update Report
        if (reportId) {
            await query(`
                UPDATE cash_closing_reports SET
                total_sales = ?, total_cash_in = ?, total_change_out = ?,
                expected_cash = ?, total_orders = ?, summary = ?,
                total_service_charge = ?, total_card_commission = ?,
                status = 'CLOSED', closing_timestamp = NOW(), created_at = NOW()
                WHERE id = ?
            `, [
                totalSalesSum, totalCashIn, totalChangeOut, 
                expectedCash, orders.length, JSON.stringify(summary), 
                totalServiceCharge, totalCardCommission, reportId
            ]);
        } else {
            await query(`
                INSERT INTO cash_closing_reports
                (branch_id, date, initial_cash, total_sales, total_cash_in, total_change_out, expected_cash, total_orders, summary, total_service_charge, total_card_commission)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                initial_cash=VALUES(initial_cash), total_sales=VALUES(total_sales),
                total_cash_in=VALUES(total_cash_in), total_change_out=VALUES(total_change_out),
                expected_cash=VALUES(expected_cash), total_orders=VALUES(total_orders),
                summary=VALUES(summary),
                total_service_charge=VALUES(total_service_charge),
                total_card_commission=VALUES(total_card_commission),
                created_at=NOW()
            `, [
                branchId, date, initialCash, totalSalesSum, totalCashIn, totalChangeOut, 
                expectedCash, orders.length, JSON.stringify(summary), 
                totalServiceCharge, totalCardCommission
            ]);
        }

        return report;
    } catch (err) {
        console.error(`[CLOSING-UTILS] Error auto-generating report for Branch ${branchId}:`, err);
        return null;
    }
}

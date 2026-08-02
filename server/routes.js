import express from 'express';
import { exec } from 'child_process';
import pool from './db.js';
import { sendPushNotification } from './firebase-admin.js';
import { triggerClosingWebhook } from './utils/closingUtils.js';

const router = express.Router();

// Helper to get all rows
const query = async (sql, params) => {
    const [rows, fields] = await pool.execute(sql, params);
    return rows;
};

// --- INVENTORY AUTO-MIGRATIONS ---
(async () => {
    const conn = await pool.getConnection();
    try {
        console.log('[INVENTORY] Checking schema...');
        // 1. inventory_stock
        await conn.query(`
            CREATE TABLE IF NOT EXISTS inventory_stock (
                product_id INT NOT NULL,
                branch_id INT NOT NULL,
                quantity DECIMAL(10, 2) DEFAULT 0,
                min_stock DECIMAL(10, 2) DEFAULT 0,
                average_cost DECIMAL(10, 2) DEFAULT 0,
                PRIMARY KEY (product_id, branch_id),
                FOREIGN KEY (product_id) REFERENCES products(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id)
            )
        `);

        // Safe migration for inventory_stock
        const [stockCols] = await conn.query("SHOW COLUMNS FROM inventory_stock LIKE 'average_cost'");
        if (stockCols.length === 0) {
            console.log('[INVENTORY] Migrating inventory_stock: Adding average_cost...');
            await conn.query("ALTER TABLE inventory_stock ADD COLUMN average_cost DECIMAL(10, 2) DEFAULT 0");
        }

        // 2. inventory_transactions
        await conn.query(`
            CREATE TABLE IF NOT EXISTS inventory_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                branch_id INT NOT NULL,
                transaction_type ENUM('INITIAL', 'PURCHASE', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUB', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT') NOT NULL,
                quantity DECIMAL(10, 2) NOT NULL,
                unit_cost DECIMAL(10, 2) DEFAULT 0,
                previous_stock DECIMAL(10, 2),
                new_stock DECIMAL(10, 2),
                related_branch_id INT DEFAULT NULL,
                reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_id INT,
                order_id VARCHAR(50) NULL,
                INDEX (product_id),
                INDEX (branch_id),
                FOREIGN KEY (product_id) REFERENCES products(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id),
                FOREIGN KEY (related_branch_id) REFERENCES branches(id)
            )
        `);

        // Safe migrations for inventory_transactions
        const [txCols] = await conn.query("SHOW COLUMNS FROM inventory_transactions");
        const txColNames = txCols.map((c) => c.Field);

        if (!txColNames.includes('unit_cost')) await conn.query("ALTER TABLE inventory_transactions ADD COLUMN unit_cost DECIMAL(10, 2) DEFAULT 0");
        if (!txColNames.includes('previous_stock')) await conn.query("ALTER TABLE inventory_transactions ADD COLUMN previous_stock DECIMAL(10, 2)");
        if (!txColNames.includes('new_stock')) await conn.query("ALTER TABLE inventory_transactions ADD COLUMN new_stock DECIMAL(10, 2)");
        if (!txColNames.includes('related_branch_id')) await conn.query("ALTER TABLE inventory_transactions ADD COLUMN related_branch_id INT DEFAULT NULL");
        if (!txColNames.includes('user_id')) await conn.query("ALTER TABLE inventory_transactions ADD COLUMN user_id INT");
        if (!txColNames.includes('order_id')) await conn.query("ALTER TABLE inventory_transactions ADD COLUMN order_id VARCHAR(50) NULL");

        console.log('[INVENTORY] Schema is up to date.');
    } catch (e) {
        console.error('[INVENTORY MIGRATION ERROR]:', e);
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Ensure received_by column exists
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT received_by FROM payments LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
            console.log('Migrating: Adding received_by column...');
            await conn.query("ALTER TABLE payments ADD COLUMN received_by VARCHAR(255) DEFAULT 'Sistema'");
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Ensure delivery columns exist in orders
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT delivery_driver_id FROM orders LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
            console.log('Migrating: Adding delivery columns...');
            try {
                await conn.query("ALTER TABLE orders ADD COLUMN delivery_driver_id INT DEFAULT NULL"); // User ID of driver
                await conn.query("ALTER TABLE orders ADD COLUMN delivery_status VARCHAR(50) DEFAULT 'pending'"); // pending, assigned, delivered
                console.log('Added delivery columns to orders.');
            } catch (alterErr) {
                console.error('Failed to add delivery columns:', alterErr);
            }
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Ensure service_charge and card_commission exist in orders
(async () => {
    const conn = await pool.getConnection();
    try {
        const [cols] = await conn.query("SHOW COLUMNS FROM orders");
        const names = cols.map(c => c.Field);
        if (!names.includes('service_charge')) {
            console.log('Migrating: Adding service_charge to orders...');
            await conn.query("ALTER TABLE orders ADD COLUMN service_charge DECIMAL(10, 2) DEFAULT 0");
        }
        if (!names.includes('card_commission')) {
            console.log('Migrating: Adding card_commission to orders...');
            await conn.query("ALTER TABLE orders ADD COLUMN card_commission DECIMAL(10, 2) DEFAULT 0");
        }
    } catch (e) {
        console.error('Migration failed for orders charges:', e);
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Ensure track_stock column exists in products
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT track_stock FROM products LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
            console.log('Migrating: Adding track_stock column...');
            await conn.query("ALTER TABLE products ADD COLUMN track_stock BOOLEAN DEFAULT FALSE");
            console.log('Added track_stock to products.');
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Add image_url and description to products
(async () => {
    const conn = await pool.getConnection();
    try {
        const [cols] = await conn.query("SHOW COLUMNS FROM products");
        const names = cols.map(c => c.Field);
        if (!names.includes('image_url')) {
            console.log('Migrating: Adding image_url to products...');
            await conn.query("ALTER TABLE products ADD COLUMN image_url VARCHAR(500) DEFAULT NULL");
        }
        if (!names.includes('description')) {
            console.log('Migrating: Adding description to products...');
            await conn.query("ALTER TABLE products ADD COLUMN description TEXT DEFAULT NULL");
        }
    } catch (e) {
        console.error('Migration failed for products enhancements:', e);
    } finally {
        conn.release();
    }
})();

const safeParams = (arr) => arr.map(v => (v === undefined || v === '') ? null : v);

const getElSalvadorDateStr = () => {
    const now = new Date();
    const svOffset = -6 * 60;
    const svDate = new Date(now.getTime() + (now.getTimezoneOffset() + svOffset) * 60 * 1000);
    return svDate.toISOString().split('T')[0];
};

const parseProductJSON = (p) => {
    if (!p) return p;
    try {
        const pid = p.id;

        // 1. Initial Parsing
        if (typeof p.availableExtraIds === 'string') p.availableExtraIds = JSON.parse(p.availableExtraIds || '[]');
        if (typeof p.availableMeatIds === 'string') p.availableMeatIds = JSON.parse(p.availableMeatIds || '[]');
        if (typeof p.comboDefinition === 'string') p.comboDefinition = JSON.parse(p.comboDefinition || 'null');

        // 2. Normalization of Booleans and IDs
        p.categoryId = p.categoryId !== undefined ? p.categoryId : p.category_id;
        p.imageUrl = p.imageUrl !== undefined ? p.imageUrl : p.image_url;
        p.isActive = p.isActive !== undefined ? p.isActive : (p.is_active === 1 || p.is_active === true || p.is_active === undefined || p.is_active === null);
        p.requiresMeat = p.requiresMeat !== undefined ? p.requiresMeat : p.requires_meat === 1;
        p.requiresMasa = p.requiresMasa !== undefined ? p.requiresMasa : p.requires_masa === 1;
        p.trackStock = p.trackStock !== undefined ? p.trackStock : p.track_stock === 1;
        p.isCombo = p.isCombo !== undefined ? (p.isCombo === true || p.isCombo === 1) : p.is_combo === 1;
        
        // ULTIMATE AGNOSTIC MAPPING - Check every possible variant
        const dbVal = p.show_in_kds !== undefined ? p.show_in_kds : 
                     (p.showInKds !== undefined ? p.showInKds : 
                     (p.KDS_FORCE_DEBUG !== undefined ? p.KDS_FORCE_DEBUG : undefined));
        
        // If it's explicitly 0, '0', or false, it's OFF (false). Default to true if undefined/null.
        p.showInKds = !(dbVal === 0 || dbVal === '0' || dbVal === false);
        p.KDS_FORCE_DEBUG = p.showInKds;

        console.log(`[PARSE-DEBUG] P${p.id}: DB_VAL=[${dbVal}] -> FINAL=[${p.showInKds}]`);

        // 3. Robust availableMeatIds Logic
        // IF p.availableMeatIds is already an array but empty, we still check p.available_meats
        // in case the driver parsed the JSON for us into a different key.
        let rawMeat = p.availableMeatIds;
        if (!Array.isArray(rawMeat) || rawMeat.length === 0) {
            rawMeat = p.available_meats || p.available_meat_ids;
        }

        if (rawMeat) {
            try {
                const parsed = typeof rawMeat === 'string' ? JSON.parse(rawMeat) : rawMeat;
                p.availableMeatIds = Array.isArray(parsed) ? parsed.map(id => Number(id)) : [];
            } catch (e) {
                p.availableMeatIds = [];
            }
        } else {
            p.availableMeatIds = [];
        }

        // Final safety check: always an array
        if (!Array.isArray(p.availableMeatIds)) p.availableMeatIds = [];

        // SYNC ALL KEYS for frontend consumption parity
        p.available_meats = p.availableMeatIds;
        p.available_meat_ids = p.availableMeatIds;

        // Force booleans for frontend
        if (typeof p.isActive === 'number') p.isActive = p.isActive === 1;
        if (typeof p.requiresMeat === 'number') p.requiresMeat = p.requiresMeat === 1;
        if (typeof p.requiresMasa === 'number') p.requiresMasa = p.requiresMasa === 1;
        if (typeof p.trackStock === 'number') p.trackStock = p.trackStock === 1;
        if (typeof p.isCombo === 'number') p.isCombo = p.isCombo === 1;

        // Obsolete log removed
    } catch (err) {
        console.error(`[parseProductJSON] Error highlighting P${p.id}:`, err);
    }
    return p;
};

// AUTO-MIGRATION: Create promotions table
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT 1 FROM promotions LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
            console.log('Migrating: Creating promotions table...');
            try {
                await conn.query(`
                    CREATE TABLE promotions(
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(20) NOT NULL,
                start_date DATETIME,
                end_date DATETIME,
                days_of_week JSON,
                start_time TIME,
                end_time TIME,
                discount_type VARCHAR(20),
                discount_value DECIMAL(10, 2),
                target_type VARCHAR(20),
                target_ids JSON,
                trigger_quantity INT,
                combo_items JSON,
                is_active BOOLEAN DEFAULT TRUE,
                priority INT DEFAULT 0
            )
            `);
                console.log('Promotions table created.');
            } catch (createErr) {
                console.error('Failed to create promotions table:', createErr);
            }
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Add birth_date to customers
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT birth_date FROM customers LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
            console.log('Migrating: Adding birth_date to customers...');
            try {
                await conn.query("ALTER TABLE customers ADD COLUMN birth_date DATE NULL");
                console.log('Added birth_date to customers.');
            } catch (alterErr) {
                console.error('Failed to add birth_date:', alterErr);
            }
        }
    } finally {
        conn.release();
    }
})();


// AUTO-MIGRATION: Create customer_feedback table
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT 1 FROM customer_feedback LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
            console.log('Migrating: Creating customer_feedback table...');
            try {
                await conn.query(`
                    CREATE TABLE customer_feedback(
                id INT AUTO_INCREMENT PRIMARY KEY,
                branch_id INT NOT NULL,
                rating INT NOT NULL COMMENT '1-5 Stars',
                comment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(branch_id) REFERENCES branches(id)
            )
            `);
                console.log('Customer feedback table created.');
            } catch (createErr) {
                console.error('Failed to create customer_feedback table:', createErr);
            }
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Create observation_tags table
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT 1 FROM observation_tags LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
            console.log('Migrating: Creating observation_tags table...');
            try {
                await conn.query(`
                    CREATE TABLE observation_tags (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(100) NOT NULL UNIQUE,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                `);
                console.log('observation_tags table created.');
            } catch (createErr) {
                console.error('Failed to create observation_tags table:', createErr);
            }
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Create cash_closing_reports table
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT 1 FROM cash_closing_reports LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
            console.log('Migrating: Creating cash_closing_reports table...');
            try {
                await conn.query(`
                    CREATE TABLE cash_closing_reports(
                id INT AUTO_INCREMENT PRIMARY KEY,
                branch_id INT NOT NULL,
                date DATE NOT NULL,
                initial_cash DECIMAL(10, 2) DEFAULT 0,
                total_sales DECIMAL(10, 2) DEFAULT 0,
                total_cash_in DECIMAL(10, 2) DEFAULT 0,
                total_change_out DECIMAL(10, 2) DEFAULT 0,
                expected_cash DECIMAL(10, 2) DEFAULT 0,
                total_orders INT DEFAULT 0,
                summary JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_branch_date(branch_id, date),
                FOREIGN KEY(branch_id) REFERENCES branches(id)
            )
            `);
                console.log('Cash closing reports table created.');
            } catch (createErr) {
                console.error('Failed to create cash_closing_reports table:', createErr);
            }
        }
    } finally {
        conn.release();
    }

    // Add total_orders column if it doesn't exist (Migration)
    const conn2 = await pool.getConnection();
    try {
        await conn2.query("ALTER TABLE cash_closing_reports ADD COLUMN total_orders INT DEFAULT 0 AFTER expected_cash");
        console.log('Added total_orders column to cash_closing_reports.');
    } catch (e) {
        // Ignore if column already exists
    } finally {
        conn2.release();
    }

    // Add service charge and card commission columns (Migration)
    const conn3 = await pool.getConnection();
    try {
        const [cols] = await conn3.query("SHOW COLUMNS FROM cash_closing_reports");
        const colNames = cols.map(c => c.Field);
        if (!colNames.includes('total_service_charge')) {
            await conn3.query("ALTER TABLE cash_closing_reports ADD COLUMN total_service_charge DECIMAL(10, 2) DEFAULT 0 AFTER total_orders");
        }
        if (!colNames.includes('total_card_commission')) {
            await conn3.query("ALTER TABLE cash_closing_reports ADD COLUMN total_card_commission DECIMAL(10, 2) DEFAULT 0 AFTER total_service_charge");
        }
    } catch (e) {
        console.error('Migration failed for service charge columns:', e);
    } finally {
        conn3.release();
    }
})();

// AUTO-MIGRATION: Add ticket_width to branches
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT ticket_width FROM branches LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
            console.log('Migrating: Adding ticket_width to branches...');
            try {
                await conn.query("ALTER TABLE branches ADD COLUMN ticket_width VARCHAR(10) DEFAULT '80mm'");
                console.log('Added ticket_width to branches.');
            } catch (alterErr) {
                console.error('Failed to add ticket_width:', alterErr);
            }
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Add table_areas and area_id column
(async () => {
    const conn = await pool.getConnection();
    try {
        // 1. Create table_areas
        await conn.query(`
            CREATE TABLE IF NOT EXISTS table_areas(
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                branch_id INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            `);

        // 2. Add area and area_id columns if not exists
        const [tableCols] = await conn.query("SHOW COLUMNS FROM tables");
        const hasArea = tableCols.some(c => c.Field === 'area');
        const hasAreaId = tableCols.some(c => c.Field === 'area_id');

        if (!hasArea) {
            console.log('Migrating: Adding area column to tables...');
            await conn.query("ALTER TABLE tables ADD COLUMN area VARCHAR(50) DEFAULT 'SALÓN'");
        }
        if (!hasAreaId) {
            console.log('Migrating: Adding area_id column to tables...');
            await conn.query("ALTER TABLE tables ADD COLUMN area_id INT NULL");
        }

        // 3. Populate default areas if empty
        const [areas] = await conn.query("SELECT COUNT(*) as count FROM table_areas");
        if (areas[0].count === 0) {
            console.log('Migrating: Populating initial table_areas...');
            await conn.query("INSERT INTO table_areas (name, branch_id) VALUES ('JARDÍN', 1), ('TERRAZA', 1), ('SALÓN', 1)");

            // Assign existing tables to default 'SALÓN'
            await conn.query("UPDATE tables SET area = 'SALÓN' WHERE area IS NULL OR area = ''");
        }

        // 4. Sync area_id based on area name
        console.log('Migrating: Syncing area_id from area name...');
        await conn.query(`
            UPDATE tables t
            JOIN table_areas ta ON t.area = ta.name
            SET t.area_id = ta.id
            WHERE t.area_id IS NULL
            `);

        // 5. Removed destructive migration that overwrote user table names.
        // Sync is already handled in step 4.
    } catch (e) {
        console.error('Migration Error (table_areas/area_id):', e);
    } finally {
        conn.release();
    }
})();


// AUTO-MIGRATION: Update OrderType 'Local' to 'Restaurante'
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("UPDATE orders SET type = 'Restaurante' WHERE type = 'Local'");
        // console.log('Migrated old "Local" orders to "Restaurante".');
    } catch (e) {
        console.error('Failed to migrate order types:', e);
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Add chef field to orders
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT chef FROM orders LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
            console.log('Migrating: Adding chef field to orders...');
            try {
                await conn.query("ALTER TABLE orders ADD COLUMN chef VARCHAR(100) DEFAULT NULL AFTER waiter_id");
                console.log('Added chef field.');
            } catch (alterErr) {
                console.error('Failed to add chef field:', alterErr);
            }
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Create atomic counter table for correlatives
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS order_seq (
                branch_id INT NOT NULL,
                seq_key VARCHAR(100) NOT NULL,
                next_val INT NOT NULL DEFAULT 1,
                PRIMARY KEY (branch_id, seq_key)
            )
        `);
        console.log('Created order_seq table for atomic correlative counter.');
    } catch (e) {
        console.error('Migration failed for order_seq table:', e);
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Add unique index to prevent duplicate correlatives
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("ALTER TABLE orders ADD UNIQUE INDEX idx_unique_corr (branch_id, daily_order_number, cash_report_id)");
        console.log('Added unique index idx_unique_corr on orders(branch_id, daily_order_number, cash_report_id).');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_DUP_KEYNAME') {
            // Index already exists
        } else {
            console.error('Migration failed for unique correlative index:', e);
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Create order_item_audit_logs table
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS order_item_audit_logs(
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                daily_order_number INT,
                customer_name VARCHAR(255),
                branch_id INT NOT NULL,
                item_data JSON NOT NULL,
                deleted_by_user_id INT,
                deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reason VARCHAR(255),
                KEY branch_id(branch_id),
                KEY deleted_by_user_id(deleted_by_user_id)
            ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
        `);
    } catch (e) {
        console.error('Failed to create order_item_audit_logs table:', e);
    } finally {
        conn.release();
    }
})();


// AUTO-MIGRATION: Create sales_goals table AND Update if missing columns
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT 1 FROM sales_goals LIMIT 1");

        // Check for total_work_days column (Added in V2)
        try {
            await conn.query("SELECT total_work_days FROM sales_goals LIMIT 1");
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                console.log('Migrating: Adding total_work_days to sales_goals...');
                await conn.query("ALTER TABLE sales_goals ADD COLUMN total_work_days INT DEFAULT 30");
                console.log('Added total_work_days to sales_goals.');
            }
        }

    } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
            console.log('Migrating: Creating sales_goals table...');
            try {
                await conn.query(`
                    CREATE TABLE sales_goals(
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_id INT NOT NULL,
            month_year VARCHAR(7) NOT NULL,
            target_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
            total_work_days INT DEFAULT 30,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_goal(branch_id, month_year),
            FOREIGN KEY(branch_id) REFERENCES branches(id)
        )
            `);
                console.log('Sales_goals table created.');
            } catch (createErr) {
                console.error('Failed to create sales_goals table:', createErr);
            }
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Create app_config table and migrate Gemini API Key
(async () => {
    const conn = await pool.getConnection();
    try {
        // 1. Create app_config if it doesn't exist
        try {
            await conn.query("SELECT 1 FROM app_config LIMIT 1");
        } catch (e) {
            if (e.code === 'ER_NO_SUCH_TABLE') {
                console.log('Migrating: Creating app_config table...');
                await conn.query(`
                    CREATE TABLE app_config(
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) NOT NULL UNIQUE,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            `);
                console.log('app_config table created.');
            }
        }

        // 2. Migrate Gemini API Key from branches to app_config
        // Check if we already have it in app_config
        const [existingConfig] = await conn.query("SELECT setting_value FROM app_config WHERE setting_key = 'gemini_api_key'");

        if (existingConfig.length === 0) {
            // Not in global config yet, try to find one in branches
            try {
                const [branches] = await conn.query("SELECT gemini_api_key FROM branches WHERE gemini_api_key IS NOT NULL AND gemini_api_key != '' LIMIT 1");
                if (branches.length > 0 && branches[0].gemini_api_key) {
                    console.log('Migrating: Moving Gemini API Key to global config...');
                    await conn.query("INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?)", ['gemini_api_key', branches[0].gemini_api_key]);

                    // Optional: Clear from branches to avoid confusion? 
                    // Better to keep for safety for now, or maybe the user wants to keep it there as fallback?
                    // deciding to leave it in branches but ignore it in code is safer.
                    console.log('Gemini API Key migrated to global config.');
                }
            } catch (err) {
                // accessing branches might fail if column doesn't exist (e.g. fresh install), which is fine
            }
        }

    } catch (err) {
        console.error('Migration Error (app_config):', err);
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Create pending_balances table
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT 1 FROM pending_balances LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
            console.log('Migrating: Creating pending_balances table...');
            try {
                await conn.query(`
                    CREATE TABLE pending_balances(
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                branch_id INT NOT NULL,
                type ENUM('CUSTOMER', 'EMPLOYEE') NOT NULL,
                customer_id INT DEFAULT NULL,
                user_id INT DEFAULT NULL,
                total_amount DECIMAL(10, 2) NOT NULL,
                balance DECIMAL(10, 2) NOT NULL,
                status ENUM('PENDING', 'PAID', 'CANCELLED') DEFAULT 'PENDING',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY(branch_id) REFERENCES branches(id),
                FOREIGN KEY(customer_id) REFERENCES customers(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            `);
                console.log('pending_balances table created.');
            } catch (createErr) {
                console.error('Failed to create pending_balances table:', createErr);
            }
        }
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Add fcm_tokens to users

(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT fcm_tokens FROM users LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
            console.log('Migrating: Adding fcm_tokens to users...');
            try {
                await conn.query("ALTER TABLE users ADD COLUMN fcm_tokens JSON DEFAULT NULL");
                console.log('Added fcm_tokens to users.');
            } catch (alterErr) {
                console.error('Failed to add fcm_tokens:', alterErr);
            }
        }
    } finally {
        conn.release();
    }
})();

// --- AUTH ---
router.post('/login', async (req, res) => {
    const { pin } = req.body;
    try {
        const users = await query('SELECT * FROM users WHERE pin = ? AND is_active = 1', [pin]);
        console.log(`[LOGIN] Attempt PIN: ${pin}, Found: ${users.length} users.`); // Debug log
        if (users.length > 0) {
            const user = users[0];
            // Normalize roles if stored as JSON
            // user.roles is already an object/array if mysql2 casts JSON columns automatically (it usually does)
            // If not, we might need JSON.parse(user.roles). 
            // MySQL2 with 'typeCast' usually handles it, or we check typof.
            if (typeof user.roles === 'string') {
                try { user.roles = JSON.parse(user.roles); } catch (e) { }
            }
            // Map to camelCase for frontend
            user.branchId = user.branch_id;
            res.json(user);
        } else {
            res.status(401).json({ error: 'Invalid PIN' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- FEEDBACK (PUBLIC) ---
router.post('/feedback', async (req, res) => {
    const { branchId, rating, comment } = req.body;
    try {
        const result = await query(
            'INSERT INTO customer_feedback (branch_id, rating, comment) VALUES (?, ?, ?)',
            [branchId || 1, rating, comment]
        );

        // Emit Socket Event
        const newFeedback = {
            id: result.insertId,
            branch_id: branchId || 1,
            rating,
            comment,
            created_at: new Date()
        };
        req.io.emit('new_feedback', newFeedback);

        res.json({ success: true });
    } catch (err) {
        console.error('Feedback Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- FEEDBACK (ADMIN) ---
router.get('/feedback', async (req, res) => {
    try {
        // Simple fetch ordered by date
        const feedback = await query('SELECT * FROM customer_feedback ORDER BY created_at DESC LIMIT 100');
        res.json(feedback);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PUSH NOTIFICATIONS ---
router.post('/push/subscribe', async (req, res) => {
    const { userId, token } = req.body;
    console.log(`[PUSH] Intentando suscribir usuario ${userId} con token: ${token?.substring(0, 10)}...`);

    if (!userId || !token) return res.status(400).json({ error: 'Missing userId or token' });

    try {
        const [user] = await query('SELECT fcm_tokens FROM users WHERE id = ?', [userId]);
        if (!user) {
            console.warn(`[PUSH] Usuario ${userId} no encontrado.`);
            return res.status(404).json({ error: 'User not found' });
        }

        let tokens = [];
        if (user.fcm_tokens) {
            tokens = typeof user.fcm_tokens === 'string' ? JSON.parse(user.fcm_tokens) : user.fcm_tokens;
        }

        if (!tokens.includes(token)) {
            tokens.push(token);
            await query('UPDATE users SET fcm_tokens = ? WHERE id = ?', [JSON.stringify(tokens), userId]);
            console.log(`[PUSH] Token guardado con éxito para usuario ${userId}.`);
        } else {
            console.log(`[PUSH] El token ya existía para el usuario ${userId}.`);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[PUSH] Error en subscribe:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/push/unsubscribe', async (req, res) => {
    const { userId, token } = req.body;
    if (!userId || !token) return res.status(400).json({ error: 'Missing userId or token' });

    try {
        const [user] = await query('SELECT fcm_tokens FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.fcm_tokens) {
            let tokens = typeof user.fcm_tokens === 'string' ? JSON.parse(user.fcm_tokens) : user.fcm_tokens;
            const filtered = tokens.filter(t => t !== token);
            await query('UPDATE users SET fcm_tokens = ? WHERE id = ?', [JSON.stringify(filtered), userId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PROMOTIONS ---
router.get('/promotions', async (req, res) => {
    try {
        const promos = await query('SELECT * FROM promotions WHERE is_active = 1 ORDER BY priority DESC, id DESC');
        // Parse JSON fields
        const parsed = promos.map(p => ({
            ...p,
            days_of_week: typeof p.days_of_week === 'string' ? JSON.parse(p.days_of_week) : p.days_of_week,
            target_ids: typeof p.target_ids === 'string' ? JSON.parse(p.target_ids) : p.target_ids,
            combo_items: typeof p.combo_items === 'string' ? JSON.parse(p.combo_items) : p.combo_items,
            isActive: !!p.is_active
        }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/promotions', async (req, res) => {
    const {
        name, type, start_date, end_date, days_of_week, start_time, end_time,
        discount_type, discount_value, target_type, target_ids,
        trigger_quantity, combo_items, is_active, isActive, priority, id
    } = req.body;

    // Fix: Frontend sends isActive, DB needs is_active.
    // Fix: Frontend sends isActive, DB needs is_active.
    const finalIsActive = is_active !== undefined ? is_active : (isActive !== undefined ? isActive : true);

    const safeJson = (val) => val ? JSON.stringify(val) : null;

    // Fix: Ensure dates are MySQL compatible (YYYY-MM-DD HH:mm:ss)
    // We manually construct the string to PRESERVE the user's local input date/time 
    // instead of converting to UTC (which might shift the day back/forward).
    const formatDate = (d) => {
        if (!d) return null;
        // If d is already just "YYYY-MM-DD", keep it as-is with 00:00:00 to avoid
        // timezone shifts (new Date("YYYY-MM-DD") parses as UTC).
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return `${String(d)} 00:00:00`;

        const date = new Date(d);
        if (isNaN(date.getTime())) return null;

        // Use local time methods
        const pad = (n) => n.toString().padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    try {
        if (id) {
            // Update
            await query(`
                UPDATE promotions SET
        name =?, type =?, start_date =?, end_date =?, days_of_week =?, start_time =?, end_time =?,
            discount_type =?, discount_value =?, target_type =?, target_ids =?,
            trigger_quantity =?, combo_items =?, is_active =?, priority =?
                WHERE id =?
                    `, [
                name, type, formatDate(start_date), formatDate(end_date), safeJson(days_of_week), start_time || null, end_time || null,
                discount_type, discount_value || 0, target_type, safeJson(target_ids),
                trigger_quantity || 0, safeJson(combo_items), finalIsActive ? 1 : 0, priority || 0, id
            ]);
            res.json({ success: true, id });
        } else {
            // Insert
            const result = await query(`
                INSERT INTO promotions(
                        name, type, start_date, end_date, days_of_week, start_time, end_time,
                        discount_type, discount_value, target_type, target_ids,
                        trigger_quantity, combo_items, is_active, priority
                    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                name, type, formatDate(start_date), formatDate(end_date), safeJson(days_of_week), start_time || null, end_time || null,
                discount_type, discount_value || 0, target_type, safeJson(target_ids),
                trigger_quantity || 0, safeJson(combo_items), finalIsActive ? 1 : 0, priority || 0
            ]);
            res.json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error('Promotion Save Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- CATEGORIES ---
router.post('/categories', async (req, res) => {
    const { name, sort_order } = req.body;
    try {
        const result = await query('INSERT INTO categories (name, sort_order, is_active) VALUES (?, ?, 1)', [name, sort_order || 0]);
        const [rows] = await pool.execute('SELECT * FROM categories WHERE id = ?', [result.insertId]);
        const fresh = rows[0];
        req.io.emit('catalog_updated');
        res.json({ ...fresh, isActive: fresh.is_active === 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/categories/:id', async (req, res) => {
    const { name, sort_order, is_active, isActive } = req.body;
    try {
        const current = await query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
        if (current.length === 0) return res.status(404).json({ error: 'Not found' });

        const finalName = name || current[0].name;
        const finalSortOrder = sort_order !== undefined ? sort_order : (current[0].sort_order || 0);
        const finalIsActive = is_active !== undefined ? is_active : (isActive !== undefined ? isActive : current[0].is_active);

        await query('UPDATE categories SET name = ?, sort_order = ?, is_active = ? WHERE id = ?',
            [finalName, finalSortOrder, finalIsActive, req.params.id]);

        req.io.emit('catalog_updated');
        res.json({ success: true, id: req.params.id, name: finalName, isActive: !!finalIsActive });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        await query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MEATS (VARIANTS) ---
router.post('/meats', async (req, res) => {
    const { name, type } = req.body; // type: 'meat' | 'masa'
    try {
        const result = await query('INSERT INTO meats (name, type, is_active) VALUES (?, ?, 1)', [name, type || 'meat']);
        const [rows] = await pool.execute('SELECT * FROM meats WHERE id = ?', [result.insertId]);
        const fresh = rows[0];
        req.io.emit('catalog_updated');
        res.json({ ...fresh, isActive: fresh.is_active === 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/meats/:id', async (req, res) => {
    const { name, type, is_active, isActive } = req.body;
    try {
        // Robust update: preserve existing values if missing in payload
        const current = await query('SELECT * FROM meats WHERE id = ?', [req.params.id]);
        if (current.length === 0) return res.status(404).json({ error: 'Not found' });

        const finalName = name || current[0].name;
        const finalType = type || current[0].type || 'meat';
        const finalIsActive = is_active !== undefined ? is_active : (isActive !== undefined ? isActive : current[0].is_active);

        await query('UPDATE meats SET name = ?, type = ?, is_active = ? WHERE id = ?',
            [finalName, finalType, finalIsActive, req.params.id]);

        req.io.emit('catalog_updated');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/meats/:id', async (req, res) => {
    try {
        await query('DELETE FROM meats WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/promotions/:id', async (req, res) => {
    try {
        await query('UPDATE promotions SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- DATA FETCHING (STARTUP) ---
router.get('/initial-data', async (req, res) => {
    try {
        const start = Date.now();

        // Helper for robust startup - doesn't crash if a table is missing or migrating
        const safeQuery = async (label, sql, params = []) => {
            try {
                const s = Date.now();
                const result = await query(sql, params);
                return result || [];
            } catch (err) {
                console.error(`[INITIAL - DATA] ERROR in ${label}: `, err.message);
                return [];
            }
        };

        // --- CACHED POPULARITY LOGIC ---
        // --- CACHED POPULARITY LOGIC (NON-BLOCKING) ---
        let productPopularity = [];
        const cacheKey = 'product_popularity_cache';
        const cacheTTL = 5 * 60 * 1000; // 5 minutes
        if (!global.appCache) global.appCache = {};

        const now = Date.now();
        const cachedEntry = global.appCache[cacheKey];

        // 1. Always use cached data if available (even if stale), to unblock startup
        if (cachedEntry) {
            productPopularity = cachedEntry.data;
        }

        // 2. Background Refresh if stale or missing
        const isStale = !cachedEntry || (now - cachedEntry.timestamp > cacheTTL);

        if (isStale) {
            // Fire and forget - Update cache in background without awaiting
            safeQuery('product_popularity', 'SELECT product_id, SUM(quantity) as total_qty FROM order_items JOIN orders ON order_items.order_id = orders.id WHERE UPPER(TRIM(orders.status)) = \'COMPLETED\' AND orders.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY product_id')
                .then(data => {
                    global.appCache[cacheKey] = { data: data, timestamp: Date.now() };
                    // Optional: Emit socket event here if we want real-time update
                    console.log(`[POPULARITY] Background Cache updated: ${data.length} items.`);
                })
                .catch(err => console.error('[POPULARITY] Background update failed', err));

            if (!cachedEntry) {
                console.log('[POPULARITY] Initial fetch started in background. Returning empty for now.');
            }
        }

        const { branchId, isSuperAdmin } = req.query;

        let cashReportsSql = 'SELECT *, DATE_FORMAT(date, "%Y-%m-%d") as date FROM cash_closing_reports';
        let cashReportsParams = [];
        
        // SECURITY: If not SuperAdmin, filter strictly.
        if (isSuperAdmin !== 'true') {
            if (branchId) {
                cashReportsSql += ' WHERE branch_id = ?';
                cashReportsParams.push(parseInt(branchId));
            } else {
                // If we don't know who is calling (no branch, no superadmin flag), 
                // we return NOTHING to prevent leakage during initial mount before login.
                cashReportsSql += ' WHERE 1 = 0';
            }
        }
        
        cashReportsSql += ' ORDER BY id DESC LIMIT 100';

        const [
            appConfig,
            branches,
            tables,
            categories,
            meats,
            productExtras,
            products,
            customers,
            users,
            promotions,
            cashClosingReports,
            observationTags
        ] = await Promise.all([
            safeQuery('CONFIG', 'SELECT setting_key, setting_value FROM app_config'),
            safeQuery('BRANCHES', 'SELECT * FROM branches'),
            safeQuery('TABLES', 'SELECT * FROM tables'),
            safeQuery('CATEGORIES', 'SELECT * FROM categories ORDER BY sort_order ASC, name ASC'),
            safeQuery('MEATS', 'SELECT * FROM meats'),
            safeQuery('EXTRAS', 'SELECT * FROM product_extras'),
            safeQuery('PRODUCTS', 'SELECT * FROM products'),
            safeQuery('CUSTOMERS', 'SELECT * FROM customers'),
            safeQuery('USERS', 'SELECT * FROM users'),
            safeQuery('PROMOTIONS', 'SELECT * FROM promotions'),
            safeQuery('CASH_REPORTS', cashReportsSql, cashReportsParams),
            safeQuery('OBS_TAGS', 'SELECT * FROM observation_tags ORDER BY name ASC')
        ]);

        products.forEach(parseProductJSON);
        // Verify integrity (silently)
        const pCheck = products.find(p => String(p.id) === '3');
        if (pCheck) {
            // Internal verification check if needed
        }

        const fetchDone = Date.now();

        const globalSettings = appConfig.reduce((acc, row) => {
            acc[row.setting_key] = row.setting_value;
            return acc;
        }, {});

        console.log(`[INITIAL - DATA] Found ${users.length} active users.`);

        // Map other fields
        tables.forEach(t => {
            t.branchId = t.branch_id;
            t.area = t.area || 'SALÓN';
            t.areaId = t.area_id || 1;
        });

        // Populate customer addresses & Map birthDate (OPTIMIZED O(N+M) + SAFE)
        const addresses = await safeQuery('customer_addresses', 'SELECT * FROM customer_addresses');
        const addressMap = {};
        addresses.forEach(addr => {
            if (!addressMap[addr.customer_id]) addressMap[addr.customer_id] = [];
            addressMap[addr.customer_id].push(addr);
        });

        customers.forEach(c => {
            c.addresses = addressMap[c.id] || [];
            if (c.birth_date) {
                try {
                    c.birthDate = new Date(c.birth_date).toISOString().split('T')[0];
                } catch (e) {
                    c.birthDate = c.birth_date;
                }
            }
        });

        const processingDone = Date.now();
        console.log(`[INITIAL - DATA] Done.Fetch: ${fetchDone - start} ms, Processing: ${processingDone - fetchDone} ms.Total: ${processingDone - start} ms.`);

        // Map branches to camelCase
        // DIAGNOSTIC LOG: Valor real y tipo de dato
        if (products && products.length > 0) {
            const p0 = products[0];
            console.log(`[DB-DEBUG] Producto: ${p0.name}`);
            console.log(`[DB-DEBUG] Valor de show_in_kds: [${p0.show_in_kds}] - Tipo: ${typeof p0.show_in_kds}`);
            console.log(`[DB-DEBUG] Valor de KDS_FORCE_DEBUG: [${p0.KDS_FORCE_DEBUG}]`);
        }

        const mappedBranches = branches.map(b => ({
            ...b,
            isActive: !!b.is_active,
            autoCloseTime: b.auto_close_time,
            autoCloseEnabled: !!b.auto_close_enabled,
            ticketWidth: b.ticket_width,
            gasWebhookUrl: b.gas_webhook_url,
            geminiApiKey: b.gemini_api_key,
            logoUrl: b.logo_url,
            closingWebhookUrl: b.closing_webhook_url,
            closingEmail: b.closing_email
        }));

        // Map users (waiters)
        const mappedUsers = users.map(u => {
            let roles = u.roles;
            if (typeof roles === 'string') {
                try { roles = JSON.parse(roles); } catch (e) { }
            }
            return {
                ...u,
                branchId: u.branch_id,
                isActive: !!u.is_active,
                roles: roles
            };
        });

        // Parse promotions
        const mappedPromotions = promotions.map(p => ({
            ...p,
            days_of_week: typeof p.days_of_week === 'string' ? JSON.parse(p.days_of_week) : p.days_of_week,
            target_ids: typeof p.target_ids === 'string' ? JSON.parse(p.target_ids) : p.target_ids,
            combo_items: typeof p.combo_items === 'string' ? JSON.parse(p.combo_items) : p.combo_items,
            isActive: !!p.is_active
        }));

        // Map product extras
        const mappedProductExtras = productExtras.map(pe => ({
            ...pe,
            isActive: !!pe.is_active
        }));

        // Map categories
        const mappedCategories = categories.map(c => ({
            ...c,
            isActive: c.is_active !== 0
        }));

        // Map meats (Meats & Masas)
        const mappedMeats = meats.map(m => ({
            ...m,
            isActive: m.is_active !== 0
        }));

        // Map products - ONE SINGLE CONSOLIDATED MAPPING
        const mappedProducts = products.map(p => {
            let availableExtras = p.available_extras || p.availableExtraIds;
            if (typeof availableExtras === 'string') {
                try { availableExtras = JSON.parse(availableExtras); } catch (e) { availableExtras = []; }
            }

            let availableMeats = p.available_meats || p.available_meat_ids || p.availableMeatIds;
            if (typeof availableMeats === 'string') {
                try { availableMeats = JSON.parse(availableMeats); } catch (e) { availableMeats = []; }
            }

            return {
                id: p.id,
                name: p.name,
                price: p.price,
                description: p.description ?? null,
                imageUrl: p.imageUrl ?? p.image_url ?? null,
                categoryId: p.category_id,
                requiresMeat: !!p.requires_meat,
                requiresMasa: !!p.requires_masa,
                availableExtraIds: (Array.isArray(availableExtras) ? availableExtras : []).map(id => Number(id)),
                availableMeatIds: (Array.isArray(availableMeats) ? availableMeats : []).map(id => Number(id)),
                isActive: p.is_active !== 0,
                isCombo: !!p.is_combo,
                comboDefinition: typeof p.combo_definition === 'string' ? JSON.parse(p.combo_definition) : (p.combo_definition || null),
                trackStock: !!p.track_stock,
                showInKds: p.showInKds // Use the already parsed value from parseProductJSON
            };
        });

        // Map cash closing reports
        const mappedClosingReports = cashClosingReports.map(r => ({
            ...r,
            branchId: Number(r.branch_id),
            initialCash: parseFloat(r.initial_cash || 0),
            totalSales: parseFloat(r.total_sales || 0),
            totalCashIn: parseFloat(r.total_cash_in || 0),
            totalChangeOut: parseFloat(r.total_change_out || 0),
            expectedCash: parseFloat(r.expected_cash || 0),
            totalOrders: parseInt(r.total_orders || 0),
            summary: typeof r.summary === 'string' ? JSON.parse(r.summary) : (r.summary || []),
            createdAt: r.created_at,
            updates_count: Number(r.updates_count || 0)
        }));

        // Map product popularity to a dictionary { productId: totalQty }
        const productPopularityMap = (productPopularity || []).reduce((acc, row) => {
            acc[row.product_id] = Number(row.total_qty) || 0;
            return acc;
        }, {});

        // DEEP DEBUG LOGS
        try {
            const [totalItems] = await query('SELECT COUNT(*) as count FROM order_items');
            const [totalOrders] = await query('SELECT COUNT(*) as count FROM orders WHERE UPPER(TRIM(status)) = "COMPLETED"');
            console.log(`[POPULARITY - DEBUG] Items in DB: ${totalItems.count}, Completed Orders: ${totalOrders.count} `);
            console.log(`[POPULARITY - DEBUG] Map Items: ${Object.keys(productPopularityMap).length} `);
            if (Object.keys(productPopularityMap).length === 0) {
                console.log(`[POPULARITY - DEBUG] RAW DATA: `, JSON.stringify(productPopularity));
            }
        } catch (e) {
            console.error('[POPULARITY-DEBUG] Error during diagnostics:', e.message);
        }

        // Fetch Table Areas
        const tableAreas = await safeQuery('table_areas', 'SELECT * FROM table_areas');

        res.json({
            cashClosingReports: mappedClosingReports,
            branches: mappedBranches,
            tables,
            tableAreas, // Added dynamic areas
            categories: mappedCategories,
            meats: mappedMeats,
            productExtras: mappedProductExtras,
            products: mappedProducts,
            customers,
            waiters: mappedUsers,
            promotions: mappedPromotions,
            globalSettings,
            productPopularity: productPopularityMap,
            observationTags: observationTags.map(t => ({ ...t, isActive: !!t.is_active }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/product-popularity', async (req, res) => {
    try {
        const cacheKey = 'product_popularity_v4';
        const cacheTTL = 5 * 60 * 1000; // 5 min
        if (!global.appCache) global.appCache = {};

        const now = Date.now();
        if (global.appCache[cacheKey] && (now - global.appCache[cacheKey].timestamp < cacheTTL)) {
            const cachedData = global.appCache[cacheKey].data;
            if (Array.isArray(cachedData)) {
                const mapped = cachedData.reduce((acc, row) => {
                    acc[row.product_id] = Number(row.total_qty) || 0;
                    return acc;
                }, {});
                return res.json(mapped);
            }
            return res.json(cachedData);
        }

        const sql = `
            SELECT product_id, SUM(quantity) as total_qty 
            FROM order_items 
            JOIN orders ON order_items.order_id = orders.id 
            WHERE UPPER(TRIM(orders.status)) = 'COMPLETED' 
              AND orders.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
            GROUP BY product_id
            `;
        const [results] = await pool.query(sql);

        const popularityMap = (results || []).reduce((acc, row) => {
            acc[row.product_id] = Number(row.total_qty) || 0;
            return acc;
        }, {});

        console.log(`[POPULARITY] Cache updated with ${Object.keys(popularityMap).length} items.`);
        global.appCache[cacheKey] = { data: popularityMap, timestamp: now };
        res.json(popularityMap);
    } catch (err) {
        console.error('[POPULARITY-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ORDERS ---
router.get('/orders', async (req, res) => {
    const { branchId, status, startDate, endDate, limit, cashReportId } = req.query;
    try {
        let sql = 'SELECT * FROM orders WHERE 1=1';
        const params = [];
        if (branchId) {
            sql += ' AND branch_id = ?';
            params.push(parseInt(branchId));
        }
        if (cashReportId) {
            sql += ' AND cash_report_id = ?';
            params.push(parseInt(cashReportId));
        }

        // SMART FILTER (Default Load): Show all non-completed, OR completed orders linked to an OPEN session
        // This ensures orders disappear from the "Completed" list once the session is CLOSED.
        if (!status && !startDate && !endDate && !limit) {
            sql += ` AND (o.status != 'completed' OR (o.status = 'completed' AND o.cash_report_id IN (SELECT id FROM cash_closing_reports WHERE status = 'OPEN')))`;
        } else {
            // Apply standard filters if provided
            if (status) { // 'active' or 'completed'
                sql += ' AND status = ?';
                params.push(status);
            }
            if (startDate) {
                sql += ' AND created_at >= ?';
                params.push(startDate + ' 00:00:00');
            }
            if (endDate) {
                sql += ' AND created_at <= ?';
                params.push(endDate + ' 23:59:59');
            }
        }

        // Ordering
        sql += ' ORDER BY created_at DESC';

        if (limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(limit));
        } else if (status === 'completed' && !startDate) {
            // Only limit if looking at history without specific date dates
            sql += ' LIMIT 50';
        }

        const orders = await query(sql, params);


        if (orders.length > 0) {
            const orderIds = orders.map(o => o.id);
            const placeholders = orderIds.map(() => '?').join(',');

            // 1. Get Items
            const items = await query(`SELECT * FROM order_items WHERE order_id IN(${placeholders}) ORDER BY id DESC`, orderIds);

            // 2. Get Extras with Names and Prices
            let extras = [];
            if (items.length > 0) {
                const itemIds = items.map(i => i.id);
                const itemPlaceholders = itemIds.map(() => '?').join(',');
                if (itemIds.length > 0) {
                    extras = await query(
                        `SELECT oie.*, pe.name, pe.price 
                         FROM order_item_extras oie 
                         LEFT JOIN product_extras pe ON oie.extra_id = pe.id 
                         WHERE oie.order_item_id IN(${itemPlaceholders})`,
                        itemIds
                    );
                }
            }

            // 3. Get Payments
            const payments = await query(`SELECT * FROM payments WHERE order_id IN(${placeholders})`, orderIds);

            // 4. Get Customers & Addresses
            let customers = [];
            const customerIds = [...new Set(orders.map(o => o.customer_id).filter(id => id))];
            if (customerIds.length > 0) {
                const customerPlaceholders = customerIds.map(() => '?').join(',');
                customers = await query(`SELECT * FROM customers WHERE id IN(${customerPlaceholders})`, customerIds);

                const addresses = await query(`SELECT * FROM customer_addresses WHERE customer_id IN(${customerPlaceholders})`, customerIds);
                customers.forEach(c => {
                    c.addresses = addresses.filter(a => a.customer_id === c.id);
                });
            }

            // 5. Get Products (Safe Hydration)
            let products = [];
            try {
                const productIds = [...new Set(items.map(i => i.product_id).filter(id => id))];
                if (productIds.length > 0) {
                    const productPlaceholders = productIds.map(() => '?').join(',');
                    products = await query(`SELECT id, name, price, image_url AS imageUrl, description, category_id AS categoryId, requires_meat AS requiresMeat, requires_masa AS requiresMasa, available_extras AS availableExtraIds, is_active AS isActive, is_combo AS isCombo, combo_definition AS comboDefinition, track_stock AS trackStock, available_meats AS availableMeatIds, show_in_kds FROM products WHERE id IN(${productPlaceholders})`, productIds);
                    products.forEach(parseProductJSON);
                }
            } catch (err) {
                console.error("Product hydration failed:", err);
            }

            // Map everything
            orders.forEach(o => {
                o.items = items.filter(i => i.order_id === o.id).map(i => {
                    const myExtras = extras.filter(e => e.order_item_id === i.id).map(e => ({
                        id: e.extra_id,
                        name: e.name || 'Extra Eliminado/Desc.',
                        price: e.price !== null ? parseFloat(e.price) : 0
                    }));
                    const product = products.find(p => p.id === i.product_id);
                    return {
                        ...i,
                        total: parseFloat(i.total),
                        completed: !!i.completed,
                        extras: myExtras,
                        productId: i.product_id,
                        meatId: i.meat_id,
                        masaId: i.masa_id,
                        product: product ? {
                            id: product.id,
                            name: product.name,
                            price: parseFloat(product.price),
                            categoryId: product.category_id
                        } : { name: 'Producto Desconocido' }
                    };
                });

                // Attach Customer
                if (o.customer_id) {
                    const c = customers.find(cust => cust.id === o.customer_id);
                    if (c) {
                        o.customer = {
                            id: c.id,
                            name: c.name,
                            phone: c.phone,
                            email: c.email,
                            notes: c.notes,
                            addresses: c.addresses || []
                        };
                    }
                }

                // Map camelCase
                o.branchId = o.branch_id;
                o.createdAt = o.created_at;
                o.kitchenStatus = o.kitchen_status;
                o.dailyOrderNumber = o.daily_order_number;
                o.deliveryFee = parseFloat(o.delivery_fee || 0);
                o.total = parseFloat(o.total);
                o.amountPaid = parseFloat(o.amount_paid || 0);
                o.serviceCharge = parseFloat(o.service_charge || 0);
                o.cardCommission = parseFloat(o.card_commission || 0);
                o.deliveryDriverId = o.delivery_driver_id;
                o.deliveryStatus = o.delivery_status || 'pending';
                o.deliveryAddressId = o.delivery_address_id;
                o.changeGiven = parseFloat(o.change_given || 0);

                // Hydrate deliveryAddress object
                if (o.deliveryAddressId && o.customer?.addresses) {
                    o.deliveryAddress = o.customer.addresses.find(a => a.id === o.deliveryAddressId);
                }

                // Payments
                o.payments = payments.filter(p => p.order_id === o.id).map(p => ({
                    ...p,
                    amount: parseFloat(p.amount),
                    receivedBy: p.received_by
                }));
            });
        }

        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- GLOBAL HISTORY ENDPOINT ---
router.get('/orders/history', async (req, res) => {
    try {
        const { startDate, endDate, search, limit = 50, offset = 0, branchId, includeActive = 'false', cashReportId, isSuperAdmin } = req.query;
        let sql = '';
        const params = [];

        // Base SELECT for both valid queries
        const baseSelect = `
            SELECT o.*, c.name as customer_name, c.phone as customer_phone, w.name as waiter_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN users w ON o.waiter_id = w.id
            WHERE 1 = 1
            `;

        const statusFilter = includeActive === 'true'
            ? "(o.status IN ('completed', 'active') OR o.delivery_status = 'delivered')"
            : "(o.status = 'completed' OR o.delivery_status = 'delivered')";

        if (search) {
            // --- COMPLEX SEARCH QUERY ---
            const searchTerm = `%${search}%`;
            sql = baseSelect;

            if (branchId) {
                sql += ' AND o.branch_id = ?';
                params.push(parseInt(branchId));
            }
            if (cashReportId) {
                sql += ' AND o.cash_report_id = ?';
                params.push(parseInt(cashReportId));
            } else if (startDate && endDate) {
                // Precise day filtering: from 00:00:00 of start to 23:59:59 of end
                sql += ' AND o.created_at >= ? AND o.created_at <= ?';
                params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
            }

            sql += ` AND ${statusFilter} AND (
                o.id LIKE ? OR 
                o.daily_order_number LIKE ? OR
                c.name LIKE ? OR 
                c.phone LIKE ?
            )`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);

            sql += ' ORDER BY o.created_at DESC LIMIT ' + parseInt(limit) + ' OFFSET ' + parseInt(offset);

        } else {
            // --- SIMPLE QUERY (NOW WITH JOINS) ---
            sql = baseSelect + ` AND ${statusFilter}`;

            if (branchId) {
                sql += ' AND o.branch_id = ?';
                params.push(parseInt(branchId));
            }
            if (cashReportId) {
                sql += ' AND o.cash_report_id = ?';
                params.push(parseInt(cashReportId));
            } else if (startDate && endDate) {
                sql += ' AND o.created_at >= ? AND o.created_at <= ?';
                params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
            }

            sql += ' ORDER BY o.created_at DESC LIMIT ' + parseInt(limit) + ' OFFSET ' + parseInt(offset);
        }

        const orders = await query(sql, params);

        // Fetch details for these orders (Items, Payments)
        // Similar hydration as GET /orders but maybe lighter?
        // Cloning NEEDS full details (items, meat, extras). 
        if (orders.length > 0) {
            const orderIds = orders.map(o => o.id);
            const placeholders = orderIds.map(() => '?').join(',');

            // Items
            const items = await query(`SELECT * FROM order_items WHERE order_id IN(${placeholders}) ORDER BY id DESC`, orderIds);

            // Extras
            let extras = [];
            if (items.length > 0) {
                const itemIds = items.map(i => i.id);
                if (itemIds.length > 0) {
                    const itemPlaces = itemIds.map(() => '?').join(',');
                    extras = await query(`SELECT * FROM order_item_extras WHERE order_item_id IN(${itemPlaces})`, itemIds);
                }
            }

            // Fetch Product Extras Catalog to map names/prices
            let productExtrasCatalog = [];
            if (extras.length > 0) {
                const extraIds = [...new Set(extras.map(e => e.extra_id))];
                if (extraIds.length > 0) {
                    const extraPlaces = extraIds.map(() => '?').join(',');
                    productExtrasCatalog = await query(`SELECT * FROM product_extras WHERE id IN(${extraPlaces})`, extraIds);
                }
            }

            // Payments
            const payments = await query(`SELECT * FROM payments WHERE order_id IN(${placeholders})`, orderIds);

            // Customers
            const customerIds = [...new Set(orders.map(o => o.customer_id).filter(id => id))];
            let customers = [];
            if (customerIds.length > 0) {
                const custPlaces = customerIds.map(() => '?').join(',');
                customers = await query(`SELECT * FROM customers WHERE id IN(${custPlaces})`, customerIds);
            }

            // Products
            const productIds = [...new Set(items.map(i => i.product_id))];
            let products = [];
            if (productIds.length > 0) {
                const prodPlaces = productIds.map(() => '?').join(',');
                products = await query(`SELECT id, name, price, image_url AS imageUrl, description, category_id AS categoryId, requires_meat AS requiresMeat, requires_masa AS requiresMasa, available_extras AS availableExtraIds, is_active AS isActive, is_combo AS isCombo, combo_definition AS comboDefinition, track_stock AS trackStock, available_meats AS availableMeatIds, show_in_kds FROM products WHERE id IN(${prodPlaces})`, productIds);
                products.forEach(parseProductJSON);
            }


            // Map it all
            orders.forEach(o => {
                o.items = items.filter(i => i.order_id === o.id).map(i => {
                    const myExtras = extras.filter(e => e.order_item_id === i.id).map(e => ({
                        id: e.extra_id,
                        name: e.name || 'Extra Eliminado',
                        price: e.price !== null ? parseFloat(e.price) : 0
                    }));
                    const product = products.find(p => p.id === i.product_id);
                    return {
                        ...i,
                        total: parseFloat(i.total),
                        completed: !!i.completed,
                        extras: myExtras,
                        productId: i.product_id,
                        meatId: i.meat_id,
                        product: product ? {
                            ...product,
                            price: parseFloat(product.price),
                            categoryId: product.category_id
                        } : undefined
                    };
                });

                if (o.customer_id) {
                    const c = customers.find(cust => cust.id === o.customer_id);
                    if (c) {
                        o.customer = {
                            id: c.id,
                            name: c.name,
                            phone: c.phone,
                            email: c.email,
                            notes: c.notes || ''
                        };
                    }
                }

                // Map Waiter
                if (o.waiter_id) {
                    o.waiter = {
                        id: o.waiter_id,
                        name: o.waiter_name || 'Mesero'
                    };
                }

                o.branchId = o.branch_id;
                o.createdAt = o.created_at;
                o.kitchenStatus = o.kitchen_status;
                o.dailyOrderNumber = o.daily_order_number;
                o.deliveryFee = parseFloat(o.delivery_fee || 0);
                o.total = parseFloat(o.total);
                o.amountPaid = parseFloat(o.amount_paid || 0);
                o.changeGiven = parseFloat(o.change_given || 0);
                o.serviceCharge = parseFloat(o.service_charge || 0);
                o.cardCommission = parseFloat(o.card_commission || 0);
                o.discount = parseFloat(o.discount || 0); // Fix crash
                o.deliveryDriverId = o.delivery_driver_id ? Number(o.delivery_driver_id) : null; // Fix report mapping

                o.payments = payments.filter(p => p.order_id === o.id).map(p => ({
                    ...p,
                    amount: parseFloat(p.amount),
                    receivedBy: p.received_by
                }));

                // Calculate amountPaid if DB is 0 but payments exist
                if (o.amountPaid === 0 && o.payments.length > 0) {
                    o.amountPaid = o.payments.reduce((sum, p) => sum + p.amount, 0);
                    // Also estimate change given? Usually Total - Paid. 
                    // But if amountPaid is calculated, Change = AmountPaid - Total.
                    o.changeGiven = Math.max(0, o.amountPaid - o.total);
                }
            });
        }

        res.json(orders);
    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- TABLE AREAS ---
router.get('/table-areas', async (req, res) => {
    try {
        const areas = await query('SELECT * FROM table_areas ORDER BY name ASC');
        res.json(areas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/table-areas', async (req, res) => {
    const { id, name, branch_id } = req.body;
    try {
        if (id) {
            await query('UPDATE table_areas SET name = ?, branch_id = ? WHERE id = ?', [name.toUpperCase(), branch_id || 1, id]);
            res.json({ id, name: name.toUpperCase(), branch_id: branch_id || 1 });
        } else {
            const result = await query('INSERT INTO table_areas (name, branch_id) VALUES (?, ?)', [name.toUpperCase(), branch_id || 1]);
            res.json({ id: result.insertId, name: name.toUpperCase(), branch_id: branch_id || 1 });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/table-areas/:id', async (req, res) => {
    try {
        await query('DELETE FROM table_areas WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SPECIALIZED DELIVERY HISTORY (For DeliveryDashboard) ---
router.get('/delivery/history', async (req, res) => {
    try {
        const { startDate, endDate, branchId } = req.query;
        let sql = "SELECT * FROM orders WHERE type = 'Delivery' AND (status = 'completed' OR delivery_status = 'delivered')";
        const params = [];

        if (branchId) {
            sql += ' AND branch_id = ?';
            params.push(parseInt(branchId));
        }

        if (startDate && endDate) {
            sql += ' AND created_at BETWEEN DATE_SUB(?, INTERVAL 1 DAY) AND DATE_ADD(?, INTERVAL 1 DAY)';
            params.push(startDate, `${endDate} 23: 59: 59`);
        }

        sql += ' ORDER BY created_at DESC LIMIT 100';

        const orders = await query(sql, params);

        if (orders.length > 0) {
            const orderIds = orders.map(o => o.id);
            const placeholders = orderIds.map(() => '?').join(',');

            // 1. Items
            const items = await query(`SELECT * FROM order_items WHERE order_id IN(${placeholders}) ORDER BY id DESC`, orderIds);

            // 2. Extras with Names and Prices
            let extras = [];
            if (items.length > 0) {
                const itemIds = items.map(i => i.id);
                const itemPlaceholders = itemIds.map(() => '?').join(',');
                extras = await query(
                    `SELECT oie.*, pe.name, pe.price 
                     FROM order_item_extras oie 
                     LEFT JOIN product_extras pe ON oie.extra_id = pe.id 
                     WHERE oie.order_item_id IN(${itemPlaceholders})`,
                    itemIds
                );
            }

            // 3. Meats
            const meats = await query('SELECT * FROM meats');

            // 4. Products
            let products = [];
            const productIds = [...new Set(items.map(i => i.product_id).filter(id => id))];
            if (productIds.length > 0) {
                const productPlaceholders = productIds.map(() => '?').join(',');
                products = await query(`SELECT id, name, price, image_url AS imageUrl, description, category_id AS categoryId, requires_meat AS requiresMeat, requires_masa AS requiresMasa, available_extras AS availableExtraIds, is_active AS isActive, is_combo AS isCombo, combo_definition AS comboDefinition, track_stock AS trackStock, available_meats AS availableMeatIds, show_in_kds FROM products WHERE id IN(${productPlaceholders})`, productIds);
                products.forEach(parseProductJSON);
            }

            // 5. Customers & Addresses
            const customerIds = [...new Set(orders.map(o => o.customer_id).filter(id => id))];
            let customers = [];
            if (customerIds.length > 0) {
                const custPlaces = customerIds.map(() => '?').join(',');
                customers = await query(`SELECT * FROM customers WHERE id IN(${custPlaces})`, customerIds);

                const addresses = await query(`SELECT * FROM customer_addresses WHERE customer_id IN(${custPlaces})`, customerIds);
                customers.forEach(c => {
                    c.addresses = addresses.filter(a => a.customer_id === c.id);
                });
            }

            orders.forEach(o => {
                // Map items with full hydration
                o.items = items.filter(i => i.order_id === o.id).map(i => {
                    const myExtras = extras.filter(e => e.order_item_id === i.id).map(e => ({
                        id: e.extra_id,
                        name: e.name || 'Extra Eliminado/Desc.',
                        price: e.price !== null ? parseFloat(e.price) : 0
                    }));
                    const product = products.find(p => p.id === i.product_id);
                    const meat = meats.find(m => m.id === i.meat_id);

                    return {
                        ...i,
                        total: parseFloat(i.total),
                        productId: i.product_id,
                        meatId: i.meat_id,
                        notes: i.observations, // Map observations to notes for frontend consistency
                        comboSelections: typeof i.combo_selections === 'string' ? JSON.parse(i.combo_selections) : i.combo_selections,
                        meat: meat ? { id: meat.id, name: meat.name } : null,
                        product: product ? {
                            id: product.id,
                            name: product.name,
                            price: parseFloat(product.price),
                            categoryId: product.category_id
                        } : { name: 'Producto Desconocido' },
                        productName: product ? product.name : 'Producto Desconocido' // Direct productName for easier display
                    };
                });

                if (o.customer_id) {
                    const c = customers.find(cust => cust.id === o.customer_id);
                    if (c) {
                        o.customer = {
                            id: c.id,
                            name: c.name,
                            phone: c.phone,
                            addresses: c.addresses || []
                        };
                    }
                }
                // CamelCase
                o.branchId = o.branch_id;
                o.createdAt = o.created_at;
                o.deliveryStatus = o.delivery_status;
                o.deliveryDriverId = o.delivery_driver_id;
                o.total = parseFloat(o.total);
                o.deliveryFee = parseFloat(o.delivery_fee || 0);
                o.dailyOrderNumber = o.daily_order_number;
                o.deliveryAddressId = o.delivery_address_id;
                o.changeGiven = parseFloat(o.change_given || 0);

                // Hydrate deliveryAddress object
                if (o.deliveryAddressId && o.customer?.addresses) {
                    o.deliveryAddress = o.customer.addresses.find(a => a.id === o.deliveryAddressId);
                }
            });
        }

        res.json(orders);
    } catch (err) {
        console.error(err);
        if (conn) await conn.rollback();
        res.status(500).json({ error: err.message, sqlMessage: err.sqlMessage }); // detailed error
    }
});

router.post('/orders', async (req, res) => {
    const order = req.body;
    console.log(`[POST / orders] Recibido: ID = ${order.id}, Tipo = ${order.type}, Branch = ${order.branchId} `);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // --- 1. ASIGNAR SESIÓN DE CAJA ACTIVA (Turno) ---
        // Si viene un cashReportId explícito (redigitación), usarlo directamente
        let cashReportId = null;
        let sessionDate = null;
        if (order.cashReportId) {
            cashReportId = order.cashReportId;
            console.log(`[POST /orders] 🔴 Redigitación: Orden ${order.id} vinculada a sesión ${cashReportId} (forzado)`);
        } else {
            // Buscamos la sesión OPEN de HOY (evita confundir con redigitación pasada)
            let [activeSessionRows] = await conn.execute(
                'SELECT id, date FROM cash_closing_reports WHERE branch_id = ? AND status = "OPEN" AND date = CURDATE() ORDER BY id DESC LIMIT 1',
                [order.branchId || 1]
            );

            // Si no hay sesión de hoy, buscar cualquier OPEN (cross-midnight: la sesión de ayer sigue abierta)
            if (activeSessionRows.length === 0) {
                [activeSessionRows] = await conn.execute(
                    'SELECT id, date FROM cash_closing_reports WHERE branch_id = ? AND status = "OPEN" ORDER BY id DESC LIMIT 1',
                    [order.branchId || 1]
                );
            }

            cashReportId = activeSessionRows.length > 0 ? activeSessionRows[0].id : null;
            sessionDate = activeSessionRows.length > 0 ? activeSessionRows[0].date : null;

            if (!cashReportId) {
                console.warn(`[POST /orders] ⚠️ No se encontró sesión OPEN para branch ${order.branchId}. La orden ${order.id} quedará huérfana temporalmente.`);
            } else {
                console.log(`[POST /orders] ✅ Orden ${order.id} vinculada a sesión ${cashReportId} (Fecha sesión: ${sessionDate})`);
            }
        }

        // --- 2. CALCULAR CORRELATIVO (Contador Atómico vía order_seq) ---
        // Usa INSERT ... ON DUPLICATE KEY UPDATE que es atómico en MySQL.
        // Esto elimina el race condition del SELECT MAX + FOR UPDATE.
        const seqKey = cashReportId ? `session_${cashReportId}` : `date_${getElSalvadorDateStr()}`;
        await conn.execute(
            `INSERT INTO order_seq (branch_id, seq_key, next_val) VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE next_val = next_val + 1`,
            [order.branchId || 1, seqKey]
        );
        const [seqRows] = await conn.execute(
            'SELECT next_val FROM order_seq WHERE branch_id = ? AND seq_key = ?',
            [order.branchId || 1, seqKey]
        );
        const nextDailyOrderNumber = seqRows[0].next_val;

        // Insert Order
        await conn.execute(
            `INSERT INTO orders(id, branch_id, daily_order_number, type, status, kitchen_status, subtotal, tax, discount, manual_discount, delivery_fee, total, created_at, waiter_id, table_id, customer_id, delivery_address_id, amount_paid, change_given, delivery_driver_id, delivery_status, chef, cash_report_id)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order.id,
                order.branchId,
                nextDailyOrderNumber,
                order.type,
                order.status || 'active',
                order.kitchenStatus || null,
                order.subtotal || 0,
                order.tax || 0,
                order.discount || 0,
                order.manualDiscount || 0,
                order.deliveryFee || 0,
                order.total || 0,
                new Date(order.createdAt),
                order.waiterId || (order.waiter ? order.waiter.id : null),
                order.tableId || (order.table ? order.table.id : null),
                order.customerId || (order.customer ? order.customer.id : null),
                order.deliveryAddressId || (order.deliveryAddress ? order.deliveryAddress.id : null),
                order.amountPaid || 0,
                order.changeGiven || 0,
                order.deliveryDriverId || null,
                order.deliveryStatus || 'pending',
                order.chef || null,
                cashReportId
            ]
        );

        // Insert Items
        for (const item of order.items) {
            await conn.execute(
                `INSERT INTO order_items(id, order_id, product_id, quantity, meat_id, masa_id, total, observations, completed, combo_selections)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [item.id, order.id, item.product.id, item.quantity, item.meat ? item.meat.id : null, item.masaId || (item.masa ? item.masa.id : null), item.total || 0, item.observations || null, item.completed ? 1 : 0, JSON.stringify(item.comboSelections || null)]
            );

            // Insert Extras
            if (item.extras && Array.isArray(item.extras) && item.extras.length > 0) {
                for (const extra of item.extras) {
                    await conn.execute(
                        `INSERT INTO order_item_extras(order_item_id, extra_id) VALUES(?, ?)`,
                        [item.id, extra.id || extra]
                    );
                }
            }
        }
        console.log(`[PUT - TRACE] 3. Items sincronizados.`);

        // 4. Handle Pending Balances (Credit / Employee)
        const creditPayments = order.payments?.filter(p => p.method === 'Crédito' || p.method === 'Empleado') || [];
        for (const p of creditPayments) {
            await conn.execute(
                `INSERT INTO pending_balances(order_id, branch_id, type, customer_id, user_id, total_amount, balance, status)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    order.id,
                    order.branchId,
                    p.method === 'Crédito' ? 'CUSTOMER' : 'EMPLOYEE',
                    p.method === 'Crédito' ? (order.customerId || (order.customer ? order.customer.id : null)) : null,
                    p.method === 'Empleado' ? (p.userId || null) : null,
                    p.amount,
                    p.amount,
                    'PENDING'
                ]
            );
        }

        await conn.commit();
        console.log(`[PUT - TRACE] 4. Transacción confirmada(COMMIT).`);

        // Notify via Socket
        // IMPORTANT: Emit the order with the CORRECT server-generated dailyOrderNumber
        const finalOrder = { ...order, dailyOrderNumber: nextDailyOrderNumber };
        req.io.emit('new_order', finalOrder); // Broadcast to all (kitchen, other waiters)

        // --- PUSH NOTIFICATION FOR DELIVERY DRIVERS (Instant) ---
        const lowerType = (order.type || '').toLowerCase();
        console.log(`[PUSH - POST - DEBUG] Tipo detectado: ${order.type} (Normalizado: ${lowerType})`);
        if (lowerType === 'delivery') {
            console.log(`[PUSH - POST] Detectada orden de delivery: ${order.id}. Iniciando notificación...`);
            (async () => {
                try {
                    const bId = order.branch_id || order.branchId;
                    console.log(`[PUSH - POST] Buscando repartidores para Branch: ${bId} `);

                    // Query using JSON_CONTAINS for robust role checking
                    const drivers = await query(
                        "SELECT id, name, fcm_tokens, roles FROM users WHERE branch_id = ? AND is_active = 1 AND (JSON_CONTAINS(roles, '\"Repartidor\"') OR JSON_CONTAINS(roles, '\"repartidor\"')) AND fcm_tokens IS NOT NULL",
                        [bId]
                    );

                    console.log(`[PUSH] Repartidores encontrados: ${drivers.length} `);

                    let tokens = [];
                    drivers.forEach(d => {
                        let t = d.fcm_tokens;
                        if (typeof t === 'string' && t !== '') {
                            try { t = JSON.parse(t); } catch (e) { t = [t]; }
                        }
                        if (Array.isArray(t)) {
                            console.log(`[PUSH] User ${d.id} (${d.name}): ${t.length} tokens`);
                            tokens = tokens.concat(t.filter(tk => typeof tk === 'string' && tk.length > 20));
                        }
                    });

                    if (tokens.length > 0) {
                        const orderNum = String(nextDailyOrderNumber).padStart(3, '0');
                        await sendPushNotification(tokens, `🔥 ¡NUEVO ENVÍO!`, `Orden #${orderNum} lista para ser tomada. 🛵💨`, {
                            orderId: order.id,
                            type: 'delivery_new',
                            url: '/delivery',
                            click_action: '/delivery'
                        }, [
                            { action: 'open_app', title: '🚀 VER PEDIDO' }
                        ], pool);
                        console.log(`[PUSH] Firebase Result: `, 'Success ✅');
                    } else {
                        console.log('[PUSH] No active drivers with tokens found.');
                    }
                } catch (pushErr) {
                    console.error('[PUSH ERROR] Instant delivery notification failed:', pushErr);
                }
            })();
        }

        res.status(201).json({ message: 'Order created', dailyOrderNumber: nextDailyOrderNumber });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

router.put('/orders/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // DEBUG: Log updates
    console.log(`[PUT / orders / ${id}] Payload received: `, JSON.stringify(updates));

    if (updates.items) {
        console.log(`[PUT / orders / ${id}] Items count: ${updates.items.length} `);
        updates.items.forEach((item, idx) => {
            console.log(`  Item ${idx} (${item.product?.name || item.id}): Extras = ${JSON.stringify(item.extras)} `);
        });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 0. Ensure order is linked to an active session if it's currently orphan
        const [currentOrder] = await conn.execute('SELECT branch_id, cash_report_id FROM orders WHERE id = ?', [id]);
        if (currentOrder.length > 0 && !currentOrder[0].cash_report_id) {
            const branchId = updates.branchId || currentOrder[0].branch_id || 1;
            let [activeSessionRows] = await conn.execute(
                'SELECT id FROM cash_closing_reports WHERE branch_id = ? AND status = "OPEN" AND date = CURDATE() ORDER BY id DESC LIMIT 1',
                [branchId]
            );

            // Cross-midnight: si no hay sesión de hoy, buscar cualquier OPEN
            if (activeSessionRows.length === 0) {
                [activeSessionRows] = await conn.execute(
                    'SELECT id FROM cash_closing_reports WHERE branch_id = ? AND status = "OPEN" ORDER BY id DESC LIMIT 1',
                    [branchId]
                );
            }

            if (activeSessionRows.length > 0) {
                updates.cashReportId = activeSessionRows[0].id;
                console.log(`[PUT /orders/${id}] 🔗 Vinculando orden huérfana a sesión ${updates.cashReportId}`);
            } else {
                console.warn(`[PUT /orders/${id}] ⚠️ Sigue sin haber sesión OPEN para branch ${branchId}.`);
            }
        }

        // 1. Update Order Fields (Status, Totals, etc)
        const fields = [];
        const values = [];

        // Allow updating standard fields
        if (updates.type) { fields.push('type = ?'); values.push(updates.type); }
        if (updates.status) { fields.push('status = ?'); values.push(updates.status); }
        if (updates.kitchenStatus) {
            fields.push('kitchen_status = ?');
            values.push(updates.kitchenStatus);

            if (updates.kitchenStatus === 'ready') {
                fields.push('ready_at = NOW()');
                // Force update even if status hasn't changed to trigger socket
                fields.push('updated_at = NOW()');
            }
        }
        if (updates.deliveryDriverId !== undefined) { fields.push('delivery_driver_id = ?'); values.push(updates.deliveryDriverId); }
        if (updates.deliveryStatus !== undefined) { fields.push('delivery_status = ?'); values.push(updates.deliveryStatus); }
        if (updates.chef !== undefined) { fields.push('chef = ?'); values.push(updates.chef); }

        // Handle both flat IDs and objects (Frontend sends objects for customer, table, waiter)
        const customerId = updates.customerId || updates.customer?.id;
        if (customerId !== undefined) { fields.push('customer_id = ?'); values.push(customerId); }

        const tableId = updates.tableId || updates.table?.id;
        if (tableId !== undefined) { fields.push('table_id = ?'); values.push(tableId); }

        const waiterId = updates.waiterId || updates.waiter?.id;
        if (waiterId !== undefined) { fields.push('waiter_id = ?'); values.push(waiterId); }

        const deliveryAddressId = updates.deliveryAddressId || updates.deliveryAddress?.id;
        if (deliveryAddressId !== undefined) { fields.push('delivery_address_id = ?'); values.push(deliveryAddressId); }

        // Allow updating totals (Frontend calculates these)
        if (updates.total !== undefined && updates.total !== null) { fields.push('total = ?'); values.push(updates.total); }
        if (updates.subtotal !== undefined) { fields.push('subtotal = ?'); values.push(updates.subtotal); }
        if (updates.tax !== undefined) { fields.push('tax = ?'); values.push(updates.tax); }
        if (updates.discount !== undefined) { fields.push('discount = ?'); values.push(updates.discount); }
        if (updates.manualDiscount !== undefined) { fields.push('manual_discount = ?'); values.push(updates.manualDiscount); }
        if (updates.deliveryFee !== undefined) { fields.push('delivery_fee = ?'); values.push(updates.deliveryFee); }
        if (updates.serviceCharge !== undefined) { fields.push('service_charge = ?'); values.push(updates.serviceCharge); }
        if (updates.cardCommission !== undefined) { fields.push('card_commission = ?'); values.push(updates.cardCommission); }
        if (updates.completedAt !== undefined) {
            const val = updates.completedAt ? new Date(updates.completedAt) : null;
            fields.push('completed_at = ?');
            values.push(val);
        }
        if (updates.amountPaid !== undefined) { fields.push('amount_paid = ?'); values.push(updates.amountPaid); }
        if (updates.changeGiven !== undefined) { fields.push('change_given = ?'); values.push(updates.changeGiven); }
        if (updates.cashReportId !== undefined) { fields.push('cash_report_id = ?'); values.push(updates.cashReportId); }

        if (fields.length > 0) {
            values.push(id);
            console.log(`[PUT - TRACE] 1. Actualizando tabla orders...`);
            await conn.execute(`UPDATE orders SET ${fields.join(', ')} WHERE id = ? `, values);
            console.log(`[PUT - TRACE] 2. Tabla orders actualizada.`);
        }

        // 2. Sync Items (If provided) - Full Replace Strategy
        if (updates.items && Array.isArray(updates.items)) {
            // A. Delete existing extras (via cascade usually, but manual is safer if FK naming varies)
            // Actually constraint fk_items_order ON DELETE CASCADE handles items deletion, 
            // but we need to delete items first.
            // However, fetching IDs to delete specific extras is slow. 
            // Easiest: DELETE FROM order_items WHERE order_id = ?
            // The extras attached to these items will be deleted by ON DELETE CASCADE in `order_item_extras`.
            await conn.execute('DELETE FROM order_items WHERE order_id = ?', [id]);

            // B. Insert New Items
            for (const item of updates.items) {
                await conn.execute(
                    `INSERT INTO order_items(id, order_id, product_id, quantity, meat_id, masa_id, total, observations, completed, combo_selections)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        item.id,
                        id,
                        item.product.id || item.productId, // Handle both object and flattened ID
                        item.quantity,
                        item.meat ? item.meat.id : (item.meatId || null),
                        item.masaId || (item.masa ? item.masa.id : null),
                        item.total,
                        item.observations || null,
                        item.completed ? 1 : 0,
                        JSON.stringify(item.comboSelections || null)
                    ]
                );

                // C. Insert Extras for this Item
                if (item.extras && Array.isArray(item.extras) && item.extras.length > 0) {
                    for (const extra of item.extras) {
                        await conn.execute(
                            `INSERT INTO order_item_extras(order_item_id, extra_id) VALUES(?, ?)`,
                            [item.id, extra.id || extra]
                        );
                    }
                }
            }
        }

        // 3. Sync Payments (If provided)
        if (updates.payments && Array.isArray(updates.payments) && updates.payments.length > 0) {
            // For now, we only add new payments, or we could replace all. 
            // Safest for POS is usually append-only or replace-all. 
            // Let's replace ALL payments to ensure sync with frontend state.
            await conn.execute('DELETE FROM payments WHERE order_id = ?', [id]);

            for (const p of updates.payments) {
                await conn.execute(
                    'INSERT INTO payments (order_id, method, amount, received_by) VALUES (?, ?, ?, ?)',
                    [id, p.method, p.amount, p.receivedBy || null]
                );
            }
        }

        // 4. Handle Pending Balances
        const creditPayments = (updates.payments || []).filter(p => p.method === 'Crédito' || p.method === 'Empleado');
        // Clear existing if any for this order and replace (simple strategy)
        await conn.execute('DELETE FROM pending_balances WHERE order_id = ? AND status = "PENDING"', [id]);

        for (const p of creditPayments) {
            await conn.execute(
                `INSERT INTO pending_balances(order_id, branch_id, type, customer_id, user_id, total_amount, balance, status)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    updates.branchId || updates.branch_id || (await query('SELECT branch_id FROM orders WHERE id = ?', [id]))[0].branch_id,
                    p.method === 'Crédito' ? 'CUSTOMER' : 'EMPLOYEE',
                    p.method === 'Crédito' ? (updates.customerId || updates.customer?.id || (await query('SELECT customer_id FROM orders WHERE id = ?', [id]))[0].customer_id) : null,
                    p.method === 'Empleado' ? (p.userId || null) : null,
                    p.amount,
                    p.amount,
                    'PENDING'
                ]
            );
        }

        // --- STOCK DEDUCTION LOGIC ---
        if (updates.status === 'completed') {
            console.log(`[INVENTORY] Processing deduction for completed order: ${id} `);
            // Fetch items with categories to filter "Bebidas"
            // Fetch items to check for both Bebidas and Combos
            const [itemsToDeduct] = await conn.execute(`
                SELECT oi.product_id, oi.quantity, p.category_id, c.name as category_name, oi.id as item_id, oi.order_id, oi.combo_selections, p.is_combo, p.track_stock
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                JOIN categories c ON p.category_id = c.id
                WHERE oi.order_id = ?
            `, [id]);

            const branchId = updates.branchId || (await conn.execute('SELECT branch_id FROM orders WHERE id = ?', [id]))[0][0].branch_id;

            for (const item of itemsToDeduct) {
                let productsToProcess = [];

                // STRATEGY:
                // 1. If it's a COMBO, deduct the selected components.
                // 2. If it's a BEVERAGE (and not a combo), deduct the item itself.
                if (item.is_combo) {
                    if (item.combo_selections) {
                        try {
                            const selections = typeof item.combo_selections === 'string' ? JSON.parse(item.combo_selections) : item.combo_selections;
                            if (Array.isArray(selections)) {
                                const candidates = selections.map(s => ({
                                    pid: s.productId,
                                    qty: parseFloat(s.quantity) * parseFloat(item.quantity)
                                }));
                                const uniquePids = [...new Set(candidates.map(c => Number(c.pid)))];
                                if (uniquePids.length > 0) {
                                    const placeholders = uniquePids.map(() => '?').join(',');
                                    const [compProducts] = await conn.execute(`SELECT id, track_stock FROM products WHERE id IN (${placeholders})`, uniquePids);
                                    const trackMap = new Map(compProducts.map(p => [p.id, !!p.track_stock]));
                                    candidates.forEach(c => {
                                        if (trackMap.get(c.pid)) productsToProcess.push(c);
                                    });
                                }
                            }
                        } catch (e) {
                            console.error(`[INVENTORY - ERROR] Failed to parse combo selections for item ${item.item_id}`, e);
                        }
                    }
                } else if (item.track_stock) {
                    productsToProcess.push({
                        pid: item.product_id,
                        qty: parseFloat(item.quantity)
                    });
                }

                // Execute Deduction for identified products
                for (const target of productsToProcess) {
                    // 1. Get current stock
                    const [stockStatus] = await conn.execute(
                        'SELECT quantity FROM inventory_stock WHERE product_id = ? AND branch_id = ? FOR UPDATE',
                        [target.pid, branchId]
                    );

                    const previousStock = stockStatus.length > 0 ? parseFloat(stockStatus[0].quantity) : 0;
                    const newStock = previousStock - target.qty;

                    // 2. Update stock
                    if (stockStatus.length > 0) {
                        await conn.execute(
                            'UPDATE inventory_stock SET quantity = ? WHERE product_id = ? AND branch_id = ?',
                            [newStock, target.pid, branchId]
                        );
                    } else {
                        await conn.execute(
                            'INSERT INTO inventory_stock (product_id, branch_id, quantity) VALUES (?, ?, ?)',
                            [target.pid, branchId, newStock]
                        );
                    }

                    // 3. Log transaction
                    await conn.execute(`
                        INSERT INTO inventory_transactions
            (product_id, branch_id, transaction_type, quantity, previous_stock, new_stock, order_id, reason, user_id)
        VALUES(?, ?, 'SALE', ?, ?, ?, ?, ?, ?)
                    `, [target.pid, branchId, target.qty, previousStock, newStock, id, `Venta - Orden #${id} ${item.is_combo ? '(Combo Component)' : ''} `, updates.userId || null]);
                }
            }
        }

        await conn.commit();

        // Emit socket immediately to unblock UI
        const updatedOrder = { ...updates, id };
        req.io.emit('order_updated', updatedOrder);

        // --- PUSH NOTIFICATIONS (Background) ---
        (async () => {
            console.log(`[PUSH - DEBUG] Iniciando hilo de fondo para orden: ${id} `);
            console.log(`[PUSH - DEBUG] updates.type actual: ${updates.type} `);
            console.log(`[PUSH - DEBUG] updates.kitchenStatus actual: ${updates.kitchenStatus} `);

            // 1. Check for NEW delivery notification (When type is assigned or updated to delivery)
            try {
                const [dbOrder] = await query('SELECT branch_id, type, daily_order_number, delivery_driver_id FROM orders WHERE id = ?', [id]);
                const lowerOrderType = (dbOrder?.type || '').toLowerCase();
                console.log(`[PUSH - PUT - DEBUG] dbOrder.type: ${dbOrder?.type} (Normalizado: ${lowerOrderType})`);

                if (dbOrder && lowerOrderType === 'delivery' && !dbOrder.delivery_driver_id) {
                    console.log(`[PUSH - NEW] Detectada orden de repartidor sin asignar: ${id}. Enviando alerta inicial...`);
                    const bId = dbOrder.branch_id;
                    const orderNum = String(dbOrder.daily_order_number || '???').padStart(3, '0');

                    const drivers = await query(
                        "SELECT id, name, fcm_tokens, roles FROM users WHERE branch_id = ? AND is_active = 1 AND (JSON_CONTAINS(roles, '\"Repartidor\"') OR JSON_CONTAINS(roles, '\"repartidor\"')) AND fcm_tokens IS NOT NULL",
                        [bId]
                    );

                    let tokens = [];
                    drivers.forEach(d => {
                        let t = d.fcm_tokens;
                        if (typeof t === 'string' && t !== '') {
                            try { t = JSON.parse(t); } catch (e) { t = [t]; }
                        }
                        if (Array.isArray(t)) {
                            tokens = tokens.concat(t.filter(tk => typeof tk === 'string' && tk.length > 20));
                        }
                    });

                    if (tokens.length > 0) {
                        await sendPushNotification(tokens, `🔥 ¡NUEVO ENVÍO!`, `Orden #${orderNum} lista para ser tomada. 🛵💨`, {
                            orderId: id,
                            type: 'delivery_new',
                            url: '/delivery',
                            click_action: '/delivery'
                        }, [
                            { action: 'open_app', title: '🚀 VER PEDIDO' }
                        ], pool);
                        console.log(`[PUSH - NEW] Alerta enviada a ${tokens.length} tokens.`);
                    }
                }
            } catch (err) {
                console.error('[PUSH ERROR] NEW delivery notification failed in PUT:', err);
            }

            // 2. Check for READY notification (Status changed to ready)
            if (updates.kitchenStatus === 'ready') {
                try {
                    console.log(`[PUSH - READY] Analizando orden ${id} para notificación de listo...`);
                    const [orderInfo] = await query(
                        'SELECT type, branch_id, waiter_id, daily_order_number, table_id FROM orders WHERE id = ?',
                        [id]
                    );

                    if (!orderInfo) return;
                    const orderNum = String(orderInfo.daily_order_number || '???').padStart(3, '0');
                    const lowerInfoType = (orderInfo.type || '').toLowerCase();
                    console.log(`[PUSH - READY - DEBUG] orderInfo.type: ${orderInfo.type} (Normalizado: ${lowerInfoType})`);

                    if (lowerInfoType === 'delivery') {
                        // Notify ALL active Drivers in this branch
                        console.log(`[PUSH - READY] Notificando repartidores de Branch: ${orderInfo.branch_id} `);
                        const drivers = await query(
                            "SELECT id, name, fcm_tokens, roles FROM users WHERE branch_id = ? AND is_active = 1 AND (JSON_CONTAINS(roles, '\"Repartidor\"') OR JSON_CONTAINS(roles, '\"repartidor\"')) AND fcm_tokens IS NOT NULL",
                            [orderInfo.branch_id]
                        );

                        let tokens = [];
                        drivers.forEach(d => {
                            let t = d.fcm_tokens;
                            if (typeof t === 'string' && t !== '') {
                                try { t = JSON.parse(t); } catch (e) { t = [t]; }
                            }
                            if (Array.isArray(t)) {
                                tokens = tokens.concat(t.filter(tk => typeof tk === 'string' && tk.length > 20));
                            }
                        });

                        if (tokens.length > 0) {
                            await sendPushNotification(tokens, `🛵 ¡REPARTO LISTO!`, `Orden #${orderNum} lista para entregar.`, {
                                orderId: id,
                                type: 'delivery_ready',
                                url: '/delivery'
                            }, pool);
                        }
                    } else if (orderInfo.waiter_id) {
                        // Notify the Waiter (Local/Pickup)
                        const [waiter] = await query('SELECT fcm_tokens FROM users WHERE id = ?', [orderInfo.waiter_id]);
                        if (waiter && waiter.fcm_tokens) {
                            let tokens = [];
                            try {
                                tokens = typeof waiter.fcm_tokens === 'string' ? JSON.parse(waiter.fcm_tokens) : waiter.fcm_tokens;
                            } catch (e) { tokens = [waiter.fcm_tokens]; }

                            if (Array.isArray(tokens) && tokens.length > 0) {
                                // Resolve table name if possible
                                let mesaInfo = 'N/A';
                                if (orderInfo.table_id) {
                                    const [table] = await query('SELECT name FROM tables WHERE id = ?', [orderInfo.table_id]);
                                    if (table) mesaInfo = table.name;
                                }

                                await sendPushNotification(tokens, `🍳 ¡PEDIDO LISTO!`, `Orden #${orderNum} de Mesa ${mesaInfo} está lista para servir.`, {
                                    orderId: id,
                                    type: 'order_ready',
                                    url: '/order/' + id
                                }, pool);
                            }
                        }
                    }
                } catch (pushErr) {
                    console.error('[PUSH ERROR] PUT ready notification failed:', pushErr);
                }
            } else {
                console.log(`[PUSH - DEBUG] No se envía notificación porque status no es 'ready'(es: ${updates.kitchenStatus})`);
            }
            console.log(`[PUSH - DEBUG] Hilo de fondo finalizado para: ${id} `);
        })();

        res.json({ success: true });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error(`[PUT / orders / ${id}]Error: `, err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

router.delete('/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { userId, reason } = req.body; // Expect userId to identify who deleted it, even in DELETE body

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Fetch Order Data for Audit
        const [orders] = await conn.execute('SELECT * FROM orders WHERE id = ?', [id]);
        if (orders.length === 0) {
            conn.release();
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orders[0];

        const [items] = await conn.execute('SELECT * FROM order_items WHERE order_id = ? ORDER BY id DESC', [id]);
        const [payments] = await conn.execute('SELECT * FROM payments WHERE order_id = ?', [id]);

        // Fetch Customer Data if exists
        let customer = null;
        if (order.customer_id) {
            const [customers] = await conn.execute('SELECT * FROM customers WHERE id = ?', [order.customer_id]);
            if (customers.length > 0) {
                customer = customers[0];
            }
        }

        const fullOrderData = {
            ...order,
            items,
            payments,
            customer // Attach full customer object
        };

        // 2. Insert into Audit Log
        await conn.execute(
            'INSERT INTO order_audit_logs (order_id, branch_id, order_data, deleted_by_user_id, reason) VALUES (?, ?, ?, ?, ?)',
            [id, order.branch_id, JSON.stringify(fullOrderData), userId || null, reason || null]
        );

        // 3. Delete (Existing logic)
        await conn.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
        await conn.execute('DELETE FROM payments WHERE order_id = ?', [id]);
        await conn.execute('DELETE FROM orders WHERE id = ?', [id]);

        await conn.commit();

        req.io.emit('order_deleted', { id });
        res.json({ message: 'Deleted and Audited' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});


// Log Individual Item Deletion (Admin authorization required in frontend)
router.post('/orders/:id/log-item-deletion', async (req, res) => {
    const { id } = req.params;
    const { branchId, dailyOrderNumber, customerName, itemData, userId, reason } = req.body;

    try {
        await query(
            'INSERT INTO order_item_audit_logs (order_id, branch_id, daily_order_number, customer_name, item_data, deleted_by_user_id, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, branchId, dailyOrderNumber, customerName, JSON.stringify(itemData), userId, reason || 'Eliminación manual del carrito']
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Audit Log Error (Item Deletion):', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/audit-logs', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Use UNION ALL to combine order deletions and item deletions
        let sql = `
        SELECT
        'ORDER' as log_type,
            al.id,
            al.order_id,
            al.branch_id,
            al.order_data as data,
            al.deleted_by_user_id,
            al.reason,
            al.deleted_at,
            u.name as deleted_by_name,
            b.name as branch_name,
            NULL as customer_name,
            NULL as daily_order_number
            FROM order_audit_logs al
            LEFT JOIN users u ON al.deleted_by_user_id = u.id
            LEFT JOIN branches b ON al.branch_id = b.id
            
            UNION ALL

        SELECT
        'ITEM' as log_type,
            ail.id,
            ail.order_id,
            ail.branch_id,
            ail.item_data as data,
            ail.deleted_by_user_id,
            ail.reason,
            ail.deleted_at,
            u.name as deleted_by_name,
            b.name as branch_name,
            ail.customer_name,
            ail.daily_order_number
            FROM order_item_audit_logs ail
            LEFT JOIN users u ON ail.deleted_by_user_id = u.id
            LEFT JOIN branches b ON ail.branch_id = b.id
            `;

        // Wrap for filtering and sorting
        let finalSql = `SELECT * FROM(${sql}) as combined WHERE 1 = 1`;
        const params = [];

        if (startDate && endDate) {
            finalSql += ' AND deleted_at BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        finalSql += ' ORDER BY deleted_at DESC LIMIT 100';

        const logs = await query(finalSql, params);

        // Parse JSON data
        const parsedLogs = logs.map(log => ({
            ...log,
            data: typeof log.data === 'string' ? JSON.parse(log.data) : log.data
        }));

        res.json(parsedLogs);
    } catch (err) {
        console.error('Audit Log Fetch Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- REPORTS / ANALYTICS ---
router.get('/reports/chef-performance', async (req, res) => {
    const { branchId, startDate, endDate } = req.query;
    try {
        let sql = `
        SELECT
        chef as chefName,
            COUNT(*) as totalOrders,
            AVG(TIMESTAMPDIFF(SECOND, created_at, ready_at)) as avgPrepTimeSeconds
            FROM orders
            WHERE chef IS NOT NULL AND ready_at IS NOT NULL
        `;
        const params = [];

        if (branchId) {
            sql += ' AND branch_id = ?';
            params.push(branchId);
        }
        if (startDate) {
            sql += ' AND created_at >= ?';
            params.push(startDate + ' 00:00:00');
        }
        if (endDate) {
            sql += ' AND created_at <= ?';
            params.push(endDate + ' 23:59:59');
        }

        sql += ' GROUP BY chef ORDER BY totalOrders DESC';

        const stats = await query(sql, params);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- BRANCHES ---
router.post('/branches', async (req, res) => {
    const { name, address, phone, gasWebhookUrl, isActive, ticketWidth, logoUrl, closingWebhookUrl, closingEmail } = req.body;
    try {
        const result = await query(
            'INSERT INTO branches (name, address, phone, gas_webhook_url, is_active, ticket_width, logo_url, closing_webhook_url, closing_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, address, phone, gasWebhookUrl, isActive ? 1 : 0, ticketWidth || '80mm', logoUrl || null, closingWebhookUrl || null, closingEmail || null]
        );
        res.json({ id: result.insertId, name, address, phone, gasWebhookUrl, isActive, ticketWidth, logoUrl, closingWebhookUrl, closingEmail });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/branches/:id', async (req, res) => {
    const { id } = req.params;
    const { name, address, phone, gasWebhookUrl, geminiApiKey, isActive, autoCloseTime, autoCloseEnabled, ticketWidth, logoUrl, closingWebhookUrl, closingEmail } = req.body;
    try {
        // Fix: Convert undefined to null for mysql2
        const safe = (val) => val === undefined ? null : val;

        // Note: We are keeping gemini_api_key and gas_webhook_url here for now to avoid breaking legacy, 
        // but frontend now saves them to app_config. We should probably NOT overwrite them if they are undefined 
        // (which means frontend didn't send them). 
        // However, the current query OVERWRITES them. 
        // Let's make the query dynamic to only update provided fields? 
        // Or simpler: just ensure we don't crash with undefined. 
        // AND add logo_url which was missing!

        // Dynamic Update approach is safer here to support partial updates
        let fields = [];
        let params = [];

        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (address !== undefined) { fields.push('address = ?'); params.push(address); }
        if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
        if (logoUrl !== undefined) { fields.push('logo_url = ?'); params.push(logoUrl); }

        // Only update these if provided (legacy support)
        if (gasWebhookUrl !== undefined) { fields.push('gas_webhook_url = ?'); params.push(gasWebhookUrl); }
        if (geminiApiKey !== undefined) { fields.push('gemini_api_key = ?'); params.push(geminiApiKey); }

        if (isActive !== undefined) { fields.push('is_active = ?'); params.push(isActive ? 1 : 0); }
        if (autoCloseTime !== undefined) { fields.push('auto_close_time = ?'); params.push(autoCloseTime || null); }
        if (autoCloseEnabled !== undefined) { fields.push('auto_close_enabled = ?'); params.push(autoCloseEnabled ? 1 : 0); }
        if (ticketWidth !== undefined) { fields.push('ticket_width = ?'); params.push(ticketWidth || '80mm'); }
        if (closingWebhookUrl !== undefined) { fields.push('closing_webhook_url = ?'); params.push(closingWebhookUrl || null); }
        if (closingEmail !== undefined) { fields.push('closing_email = ?'); params.push(closingEmail || null); }

        if (fields.length === 0) return res.json({ message: 'No changes' });

        params.push(id);

        await query(`UPDATE branches SET ${fields.join(', ')} WHERE id = ? `, params);

        res.json({ message: 'Updated' });
    } catch (err) {
        console.error('Update Branch Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/branches/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM branches WHERE id = ?', [id]);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- USERS ---
router.post('/users', async (req, res) => {
    const { name, username, pin, roles, branchId, isActive } = req.body;
    try {
        // PIN Uniqueness Check
        const existing = await query('SELECT id, name FROM users WHERE pin = ? AND is_active = 1', [pin]);
        if (existing.length > 0) {
            return res.status(400).json({ error: `El PIN ya está en uso por: ${existing[0].name} ` });
        }

        const result = await query(
            'INSERT INTO users (name, username, pin, roles, branch_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            [name, username, pin, JSON.stringify(roles), branchId, isActive ? 1 : 0]
        );
        res.json({ id: result.insertId, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, pin, roles, branchId, isActive } = req.body;

    console.log(`[PUT / users / ${id}]Payload: `, req.body);

    try {
        // 1. Fetch current user to merge values (Robust Partial Update)
        const [current] = await query('SELECT * FROM users WHERE id = ?', [id]);
        if (!current) return res.status(404).json({ error: 'User not found' });

        // 2. PIN Uniqueness Check (if PIN is being changed or user is being reactivated)
        const finalPin = pin || current.pin;
        const finalIsActive = isActive !== undefined ? (isActive ? 1 : 0) : (current.is_active !== undefined ? current.is_active : 1);

        if (finalIsActive === 1) {
            const existing = await query('SELECT id, name FROM users WHERE pin = ? AND is_active = 1 AND id != ?', [finalPin, id]);
            if (existing.length > 0) {
                return res.status(400).json({ error: `El PIN ya lo tiene: ${existing[0].name} ` });
            }
        }

        const finalName = name || current.name;
        const finalUsername = username || current.username;
        const finalRoles = roles ? JSON.stringify(roles) : current.roles;
        const finalBranchId = branchId !== undefined ? branchId : current.branch_id;

        await query(
            'UPDATE users SET name = ?, username = ?, pin = ?, roles = ?, branch_id = ?, is_active = ? WHERE id = ?',
            [finalName, finalUsername, finalPin, finalRoles, finalBranchId, finalIsActive, id]
        );
        res.json({ message: 'Updated', id });
    } catch (err) {
        console.error('Update User Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// --- PRODUCT EXTRAS ---

router.post('/product_extras', async (req, res) => {
    const { name, price } = req.body;
    try {
        const result = await query('INSERT INTO product_extras (name, price) VALUES (?, ?)', [name, price]);
        res.json({ id: result.insertId, name, price });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/product_extras/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price } = req.body;
    try {
        await query('UPDATE product_extras SET name = ?, price = ? WHERE id = ?', [name, price, id]);
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/product_extras/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM product_extras WHERE id = ?', [id]);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// AUTO-MIGRATION: Add available_meats to products
(async () => {
    const conn = await pool.getConnection();
    try {
        const [columns] = await conn.query('SHOW COLUMNS FROM products');
        const names = columns.map(c => c.Field);
        if (!names.includes('available_meats')) {
            console.log('Migrating: Adding available_meats to products...');
            await conn.query('ALTER TABLE products ADD COLUMN available_meats JSON DEFAULT NULL');
            console.log('Added available_meats to products.');
        }
    } catch (e) {
        console.error('Products available_meats migration failed:', e);
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Add settings columns to branches
(async () => {
    const conn = await pool.getConnection();
    try {
        const columns = [
            { name: 'logo_url', type: 'VARCHAR(500) DEFAULT NULL' },
            { name: 'ticket_width', type: 'VARCHAR(20) DEFAULT "80mm"' },
            { name: 'auto_close_time', type: 'TIME DEFAULT NULL' },
            { name: 'auto_close_enabled', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'gemini_api_key', type: 'VARCHAR(500) DEFAULT NULL' },
            { name: 'closing_webhook_url', type: 'TEXT DEFAULT NULL' },
            { name: 'closing_email', type: 'TEXT DEFAULT NULL' }
        ];

        const [existing] = await conn.query('SHOW COLUMNS FROM branches');
        const names = existing.map(c => c.Field);

        for (const col of columns) {
            if (!names.includes(col.name)) {
                console.log(`Migrating: Adding ${col.name} to branches...`);
                try {
                    await conn.query(`ALTER TABLE branches ADD COLUMN ${col.name} ${col.type} `);
                    console.log(`Added ${col.name} to branches.`);
                } catch (err) {
                    console.error(`Failed to add ${col.name}: `, err);
                }
            }
        }
    } catch (e) {
        console.error('Branches auto-migration failed:', e);
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Add global_store_name to app_config
(async () => {
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query("SELECT 1 FROM app_config WHERE setting_key = 'global_store_name'");
        if (rows.length === 0) {
            console.log('Migrating: Adding global_store_name to app_config...');
            await conn.query("INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?)", ['global_store_name', 'RESTAURANTE']);
        }

        // Add global_logo_url
        const [logoRows] = await conn.query("SELECT 1 FROM app_config WHERE setting_key = 'global_logo_url'");
        if (logoRows.length === 0) {
            console.log('Migrating: Adding global_logo_url to app_config...');
            await conn.query("INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?)", ['global_logo_url', '']);
        }

        // Add commission and service charge settings
        const settingsToEnsure = [
            { key: 'enable_commission', value: '0' },
            { key: 'commission_percentage', value: '5.00' },
            { key: 'enable_service_charge', value: '0' },
            { key: 'service_charge_percentage', value: '10.00' }
        ];

        for (const s of settingsToEnsure) {
            const [sRows] = await conn.query("SELECT 1 FROM app_config WHERE setting_key = ?", [s.key]);
            if (sRows.length === 0) {
                console.log(`Migrating: Adding ${s.key} to app_config...`);
                await conn.query("INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?)", [s.key, s.value]);
            }
        }
    } catch (e) {
        // Table might not exist yet if this runs before the app_config creator, which is fine
    } finally {
        conn.release();
    }
})();

// AUTO-MIGRATION: Payment Control settings
(async () => {
    const conn = await pool.getConnection();
    try {
        const [dueDateRows] = await conn.query("SELECT 1 FROM app_config WHERE setting_key = 'payment_due_date'");
        if (dueDateRows.length === 0) {
            console.log('Migrating: Adding payment_due_date to app_config...');
            await conn.query("INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?)", ['payment_due_date', '']);
        }

        const [pendingRows] = await conn.query("SELECT 1 FROM app_config WHERE setting_key = 'payment_pending'");
        if (pendingRows.length === 0) {
            console.log('Migrating: Adding payment_pending to app_config...');
            await conn.query("INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?)", ['payment_pending', '0']);
        }

        const [graceRows] = await conn.query("SELECT 1 FROM app_config WHERE setting_key = 'payment_grace_days'");
        if (graceRows.length === 0) {
            console.log('Migrating: Adding payment_grace_days to app_config...');
            await conn.query("INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?)", ['payment_grace_days', '3']);
        }
    } catch (e) {
        // Table might not exist yet
    } finally {
        conn.release();
    }
})();

// Calculate next payment due date from day-of-month (1-31)
const getNextDueDate = (dayOfMonth) => {
    const d = parseInt(dayOfMonth, 10);
    if (isNaN(d) || d < 1 || d > 31) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    const daysInThisMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
    const targetDay = Math.min(d, daysInThisMonth);
    let due = new Date(thisYear, thisMonth, targetDay);
    if (due <= now) {
        const nextMonth = thisMonth + 1;
        const nextYear = nextMonth === 12 ? thisYear + 1 : thisYear;
        const nextMonthIndex = nextMonth % 12;
        const daysInNextMonth = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
        due = new Date(nextYear, nextMonthIndex, Math.min(d, daysInNextMonth));
    }
    return due.toISOString().split('T')[0];
};

// Helper to auto-set payment_pending = '1' when within 5 days of due date
const autoSetPaymentPending = async () => {
    let conn;
    try {
        conn = await pool.getConnection();

        const [rows] = await conn.execute(
            "SELECT setting_value FROM app_config WHERE setting_key = 'payment_due_date'"
        );
        const [pendingRows] = await conn.execute(
            "SELECT setting_value FROM app_config WHERE setting_key = 'payment_pending'"
        );

        const dayOfMonth = rows[0]?.setting_value;
        const currentPending = pendingRows[0]?.setting_value;

        if (dayOfMonth && currentPending === '0') {
            const nextDueDate = getNextDueDate(dayOfMonth);
            if (nextDueDate) {
                const [result] = await conn.execute(
                    "SELECT CURDATE() BETWEEN DATE_SUB(?, INTERVAL 5 DAY) AND ? as should_auto_set",
                    [nextDueDate, nextDueDate]
                );
                if (result[0]?.should_auto_set) {
                    console.log(`[PAYMENT] Auto-setting payment_pending to 1 (next due: ${nextDueDate})`);
                    await conn.execute(
                        "UPDATE app_config SET setting_value = '1' WHERE setting_key = 'payment_pending'"
                    );
                }
            }
        }
    } catch (e) {
        // silently ignore - table may not exist yet
    } finally {
        if (conn) conn.release();
    }
};

// Run auto-set on startup
setTimeout(autoSetPaymentPending, 2000);

// --- AI UTILS ---

/**
 * Robust AI calls with retry and fallback logic.
 * Tries Flash first, then Pro if Flash fails repeatedly or is overloaded.
 */
async function callGeminiWithFallback(prompt, apiKey) {
    const models = ['gemini-flash-latest', 'gemini-1.5-pro-latest'];
    const maxRetries = 2; // Per model
    const baseDelay = 1000;

    for (const model of models) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[AI] Calling ${model} (Attempt ${attempt + 1})...`);
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });

                const data = await response.json();

                if (data.error) {
                    // Check for rate limits (429) or overloaded (503)
                    const isRetryable = data.error.code === 429 || data.error.code === 503 || data.error.status === 'UNAVAILABLE';
                    if (isRetryable && attempt < maxRetries) {
                        const delay = baseDelay * Math.pow(2, attempt);
                        console.warn(`[AI] ${model} overloaded/limited. Retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    throw new Error(data.error.message || 'Gemini API Error');
                }

                const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!rawText) throw new Error('No response from AI');

                return rawText;

            } catch (err) {
                console.error(`[AI] Error with ${model} on attempt ${attempt + 1}:`, err.message);

                // If this was the last attempt of the last model, throw the error
                if (attempt === maxRetries && model === models[models.length - 1]) {
                    throw err;
                }

                // If we have retries left for this model, wait and retry
                if (attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // Last attempt for this model failed, loop will continue to next model
                    console.warn(`[AI] ${model} failed after all retries. Switching to fallback model if available...`);
                }
            }
        }
    }
}

// --- AI PARSER ENDPOINT ---
router.post('/ai/parse-order', async (req, res) => {
    const { text } = req.body; // Removed branchId requirement for Config
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const conn = await pool.getConnection();
    try {
        // 1. Fetch Config & Context
        const [config] = await conn.execute("SELECT setting_value FROM app_config WHERE setting_key = 'gemini_api_key'");
        const apiKey = config[0]?.setting_value;

        if (!apiKey) return res.status(400).json({ error: 'Gemini API Key not configured globally (Master Settings)' });

        const [products] = await conn.execute('SELECT id, name, category_id, requires_meat, requires_masa FROM products WHERE is_active = 1');
        const [meats] = await conn.execute('SELECT id, name, type FROM meats WHERE is_active = 1');
        const [extras] = await conn.execute('SELECT id, name, price FROM product_extras WHERE is_active = 1');

        // 2. Construct Prompt
        const menuContext = JSON.stringify({
            products: products.map(p => ({ id: p.id, name: p.name, requires_meat: !!p.requires_meat, requires_masa: !!p.requires_masa })),
            meats: meats.filter(m => !m.type || m.type === 'meat').map(m => ({ id: m.id, name: m.name })),
            masas: meats.filter(m => m.type === 'masa').map(m => ({ id: m.id, name: m.name })),
            extras: extras.map(e => ({ id: e.id, name: e.name }))
        });

        const prompt = `
            You are an order parser.
            CONTEXT: Here is the restaurant menu JSON: ${menuContext}
            USER TEXT: "${text}"

        TASK:
        1. Extract the customer name and address if present.
            2. Extract the customer PHONE number if present(format as digits).
            3. Extract the customer EMAIL address if present.
            4. Extract items.For each item:
        - Find the BEST MATCH "productId" from the menu.
               - IMPORTANT: If the user specifies a meat(e.g. "Tacos de Pastor"), map "Tacos" to productId and "Pastor" to meatId.
               - IMPORTANT: If the user specifies a masa / dough type(e.g. "Pupusa de Arroz"), map "Arroz" to masaId.
               - Map extras to "extras" array(ids).
               - Capture quantity.
            
            OUTPUT JSON ONLY(No markdown):
        {
            "customerName": "...",
                "customerPhone": "...",
                    "customerEmail": "...",
                        "address": "...",
                            "items": [
                                { "productId": 123, "quantity": 1, "meatId": 456, "masaId": 789, "extraIds": [12], "note": "sin cebolla" }
                            ]
        }
        `;

        // 3. Call Gemini API with Fallback and Retry
        const rawText = await callGeminiWithFallback(prompt, apiKey);

        // Cleanup JSON (remove markdown code blocks if present)
        // Cleanup JSON (remove markdown code blocks if present)
        let jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        // Robust extraction: Find the outer-most JSON object to ignore pre/post text
        const firstOpen = jsonStr.indexOf('{');
        const lastClose = jsonStr.lastIndexOf('}');

        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
        }

        const result = JSON.parse(jsonStr);

        res.json(result);

    } catch (err) {
        console.error('AI Parse Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// --- CUSTOMERS ---

// Endpoint for Passive GPS Address Capture
router.post('/customers/:id/gps_address', async (req, res) => {
    const { id } = req.params;
    const { latitude, longitude, addressId } = req.body;

    if (!latitude || !longitude) return res.status(400).json({ error: 'Lat/Lng required' });

    const conn = await pool.getConnection();
    try {
        // 1. If addressId is provided, try to update that specific address first
        if (addressId) {
            const [updateResult] = await conn.execute(
                'UPDATE customer_addresses SET latitude = ?, longitude = ? WHERE id = ? AND customer_id = ?',
                [latitude, longitude, addressId, id]
            );

            if (updateResult.affectedRows > 0) {
                req.io.emit('customers_updated');
                return res.json({ message: 'Address GPS updated', status: 'updated', id: addressId });
            }
        }

        // 2. Fallback: Fetch existing addresses to avoid duplicates near the same spot
        const [addresses] = await conn.execute(
            'SELECT * FROM customer_addresses WHERE customer_id = ?',
            [id]
        );

        // 2. Haversine Distance Helper
        const toRad = (val) => val * Math.PI / 180;
        const calcDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371e3; // metres
            const φ1 = toRad(lat1);
            const φ2 = toRad(lat2);
            const Δφ = toRad(lat2 - lat1);
            const Δλ = toRad(lon2 - lon1);

            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        let isDuplicate = false;
        for (const addr of addresses) {
            if (addr.latitude && addr.longitude) {
                const dist = calcDistance(latitude, longitude, addr.latitude, addr.longitude);
                if (dist < 30) { // 30 meters
                    isDuplicate = true;
                    break;
                }
            }
        }

        if (isDuplicate) {
            return res.json({ message: 'Location already exists (within 30m)', status: 'duplicate' });
        }

        // 3. Create New Address with numbering
        const dateStr = new Date().toLocaleDateString('es-ES');

        // Count how many GPS addresses already exist for this customer TODAY to get the next number
        const [existingGPS] = await conn.execute(
            'SELECT COUNT(*) as count FROM customer_addresses WHERE customer_id = ? AND street LIKE ?',
            [id, `📍 Ubicación GPS (${dateStr})%`]
        );
        const nextNum = (existingGPS[0].count || 0) + 1;

        const addrId = `gps-${Date.now()}`;
        const streetName = `📍 Ubicación GPS (${dateStr}) # ${nextNum}`;

        await conn.execute(
            'INSERT INTO customer_addresses (id, customer_id, street, city, details, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [addrId, id, streetName, 'San Salvador', 'Capturada en Entrega', latitude, longitude]
        );

        req.io.emit('customers_updated');
        res.json({ message: 'GPS Address Saved', id: addrId, street: streetName, status: 'created' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// --- PENDING BALANCES (ACCOUNTS RECEIVABLE) ---
router.get('/pending-balances', async (req, res) => {
    try {
        const { branchId, status, type, search, startDate, endDate } = req.query;
        let sql = `
            SELECT 
                pb.*,
                c.name as customer_name,
                u.name as user_name,
                o.daily_order_number
            FROM pending_balances pb
            LEFT JOIN customers c ON pb.customer_id = c.id
            LEFT JOIN users u ON pb.user_id = u.id
            LEFT JOIN orders o ON pb.order_id = o.id
            WHERE 1=1
        `;
        const params = [];

        if (branchId) { sql += ' AND pb.branch_id = ?'; params.push(branchId); }
        if (status) { sql += ' AND pb.status = ?'; params.push(status); } else { sql += ' AND pb.status = "PENDING"'; }
        if (type) { sql += ' AND pb.type = ?'; params.push(type); }

        if (search) {
            sql += ' AND (c.name LIKE ? OR u.name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (startDate) { sql += ' AND pb.created_at >= ?'; params.push(startDate + ' 00:00:00'); }
        if (endDate) { sql += ' AND pb.created_at <= ?'; params.push(endDate + ' 23:59:59'); }

        sql += ' ORDER BY pb.created_at DESC';
        const rows = await query(sql, params);

        // Normalize for frontend
        const normalized = rows.map(r => ({
            ...r,
            orderId: r.order_id,
            branchId: r.branch_id,
            customerId: r.customer_id,
            userId: r.user_id,
            totalAmount: parseFloat(r.total_amount),
            balance: parseFloat(r.balance),
            createdAt: r.created_at,
            customerName: r.customer_name,
            userName: r.user_name,
            dailyOrderNumber: r.daily_order_number
        }));

        res.json(normalized);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/pending-balances/:id/pay', async (req, res) => {
    const { id } = req.params;
    const { amount, method } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.execute('SELECT * FROM pending_balances WHERE id = ? FOR UPDATE', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Balance not found' });

        const balance = rows[0];
        const newBalance = Math.max(0, parseFloat(balance.balance) - parseFloat(amount));
        const newStatus = newBalance <= 0 ? 'PAID' : 'PENDING';

        await conn.execute(
            'UPDATE pending_balances SET balance = ?, status = ? WHERE id = ?',
            [newBalance, newStatus, id]
        );

        await conn.commit();
        res.json({ success: true, newBalance });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// --- CUSTOMERS ---
router.get('/customers', async (req, res) => {
    const { search } = req.query;
    try {
        let sql = 'SELECT * FROM customers';
        const params = [];

        if (search) {
            sql += ' WHERE name LIKE ? OR phone LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        } else {
            // Limit unrelated results if no search to avoid huge dumps (though initial-data does it)
            // But usually this endpoint is for search.
            sql += ' LIMIT 100';
        }

        const customers = await query(sql, params);

        // Populate addresses
        if (customers.length > 0) {
            const customerIds = customers.map(c => c.id);
            // Placeholders for IN clause
            const placeholders = customerIds.map(() => '?').join(',');
            const addresses = await query(`SELECT * FROM customer_addresses WHERE customer_id IN (${placeholders})`, customerIds);

            customers.forEach(c => {
                c.addresses = addresses.filter(a => a.customer_id === c.id);
                // Map camelCase for frontend consistency if needed, but StartScreen expects snake_case from initial-data?
                // Wait, initial-data maps fields? No, it passes row data. 
                // But Types define camelCase?
                // Step 675: `customers.forEach(c => c.addresses = ...)` in initial-data.
                // It does NOT map snake to camel for birth_date in initial-data LOGIC, but it maps it in `if (c.birth_date)`.
                // My API should behave like initial-data output.
                // Addresses table has `street`, `city`... 
                // Address type in frontend expects `customerId`? YES.
                // Address table has `customer_id`.
                c.addresses.forEach(a => a.customerId = a.customer_id);
            });
        }

        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/customers', async (req, res) => {
    const { name, phone, email, addresses, birthDate } = req.body;
    const conn = await pool.getConnection(); // Use transaction for robustness
    try {
        await conn.beginTransaction();



        let customerId;
        // Strict normalization
        const nName = name || 'SIN NOMBRE';
        const nPhone = phone || '';
        const nEmail = email || null;
        const nBirth = (typeof birthDate === 'string' && birthDate.trim() !== '') ? birthDate : null;

        try {
            const [result] = await conn.execute(
                'INSERT INTO customers (name, phone, email, birth_date) VALUES (?, ?, ?, ?)',
                safeParams([nName, nPhone, nEmail, nBirth])
            );
            customerId = result.insertId;
        } catch (dbErr) {
            // If the column really doesn't exist, we fallback
            if (dbErr.code === 'ER_BAD_FIELD_ERROR') {
                const [result] = await conn.execute(
                    'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
                    safeParams([nName, nPhone, nEmail])
                );
                customerId = result.insertId;
            } else {
                throw dbErr;
            }
        }

        const savedAddresses = [];
        if (addresses && Array.isArray(addresses)) {
            for (const addr of addresses) {
                const addrId = addr.id || `addr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                await conn.execute(
                    'INSERT INTO customer_addresses (id, customer_id, street, city, details, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    safeParams([addrId, customerId, addr.street, addr.city || 'San Salvador', addr.details || '', addr.latitude, addr.longitude])
                );
                savedAddresses.push({ ...addr, id: addrId, customerId });
            }
        }

        await conn.commit();

        const newCustomer = { id: customerId, name, phone, email, birthDate, addresses: savedAddresses };
        req.io.emit('customers_updated'); // Broadcast update
        res.json(newCustomer);
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Route to update customer and their addresses
router.put('/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { name, phone, email, addresses, birthDate } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();



        // Strict normalization
        const nName = name || 'SIN NOMBRE';
        const nPhone = phone || '';
        const nEmail = email || null;
        const nBirth = (typeof birthDate === 'string' && birthDate.trim() !== '') ? birthDate : null;

        try {
            await conn.execute(
                'UPDATE customers SET name = ?, phone = ?, email = ?, birth_date = ? WHERE id = ?',
                safeParams([nName, nPhone, nEmail, nBirth, id])
            );
        } catch (dbErr) {
            if (dbErr.code === 'ER_BAD_FIELD_ERROR') {
                await conn.execute(
                    'UPDATE customers SET name = ?, phone = ?, email = ? WHERE id = ?',
                    safeParams([nName, nPhone, nEmail, id])
                );
            } else {
                throw dbErr;
            }
        }

        // 2. Update Addresses (Replace All Strategy)
        if (addresses && Array.isArray(addresses)) {
            await conn.execute('DELETE FROM customer_addresses WHERE customer_id = ?', [id]);

            for (const addr of addresses) {
                // Ensure ID exists
                const addrId = addr.id || `addr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                await conn.execute(
                    'INSERT INTO customer_addresses (id, customer_id, street, city, details, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    safeParams([addrId, id, addr.street, addr.city || 'San Salvador', addr.details || '', addr.latitude, addr.longitude])
                );
            }
        }

        await conn.commit();
        req.io.emit('customers_updated');
        res.json({ id, name, phone, email, birthDate, addresses });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

router.delete('/customers/:id', async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM customer_addresses WHERE customer_id = ?', [id]);
        await conn.execute('DELETE FROM customers WHERE id = ?', [id]);
        await conn.commit();

        req.io.emit('customers_updated');
        res.json({ message: 'Deleted' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// --- PRODUCTS [VER: KDS-FIX-3] ---
router.post('/products', async (req, res) => {
    const b = req.body;
    const name = b.name;
    const price = b.price;
    const categoryId = b.categoryId || b.category_id;
    const requiresMeat = (b.requiresMeat !== undefined) ? b.requiresMeat : b.requires_meat;
    const requiresMasa = (b.requiresMasa !== undefined) ? b.requiresMasa : b.requires_masa;
    const availableExtras = b.availableExtraIds || b.available_extras;
    const isActive = (b.isActive !== undefined) ? b.isActive : b.is_active;
    const isCombo = (b.isCombo !== undefined) ? b.isCombo : b.is_combo;
    const comboDefinition = b.comboDefinition || b.combo_definition;
    const trackStock = (b.trackStock !== undefined) ? b.trackStock : b.track_stock;
    const imageUrl = b.imageUrl || b.image_url;
    const description = b.description;
    const availableMeatIds = b.availableMeatIds || b.available_meats;
    const showInKds = (b.showInKds !== undefined) ? b.showInKds : b.show_in_kds;
    console.log('[ProductCreate] Valor RECIBIDO showInKds:', showInKds, 'Tipo:', typeof showInKds);

    try {
        const result = await query(
            'INSERT INTO products (name, price, category_id, requires_meat, requires_masa, available_extras, is_active, is_combo, combo_definition, track_stock, image_url, description, available_meats, show_in_kds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                name,
                price,
                categoryId,
                requiresMeat ? 1 : 0,
                requiresMasa ? 1 : 0,
                JSON.stringify(availableExtras || []),
                isActive !== false ? 1 : 0,
                isCombo ? 1 : 0,
                JSON.stringify(comboDefinition || null),
                trackStock ? 1 : 0,
                imageUrl || null,
                description || null,
                JSON.stringify(availableMeatIds || []),
                showInKds !== false ? 1 : 0
            ]
        );
        console.log('[ProductCreate] Created with ID:', result.insertId);
        req.io.emit('catalog_updated');

        // Fetch the fresh product to return it normalized
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [result.insertId]);
        const fresh = rows[0];
        parseProductJSON(fresh);
        console.log('[Product] Final JSON to send:', JSON.stringify(fresh));
        res.json(fresh);
    } catch (err) {
        console.error('[ProductCreate Error]:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/products/:id', async (req, res) => {
    const { id } = req.params;
    const b = req.body;
    console.log('[ProductUpdate] Body for ID ' + id + ':', JSON.stringify(b));

    // Robust mapping to catch both camelCase and snake_case
    const name = b.name;
    const price = b.price;
    const categoryId = b.categoryId || b.category_id;
    const requiresMeat = (b.requiresMeat !== undefined) ? b.requiresMeat : b.requires_meat;
    const requiresMasa = (b.requiresMasa !== undefined) ? b.requiresMasa : b.requires_masa;
    const availableExtras = b.availableExtraIds || b.available_extras || b.available_extra_ids;
    const isActive = (b.isActive !== undefined) ? b.isActive : b.is_active;
    const isCombo = (b.isCombo !== undefined) ? b.isCombo : b.is_combo;
    const comboDefinition = b.comboDefinition || b.combo_definition;
    const trackStock = (b.trackStock !== undefined) ? b.trackStock : b.track_stock;
    const imageUrl = b.imageUrl || b.image_url;
    const description = b.description;
    const availableMeatIds = b.availableMeatIds || b.available_meats || b.available_meat_ids;
    const showInKds = (b.showInKds !== undefined) ? b.showInKds : b.show_in_kds;
    console.log('[ProductUpdate] Valor RECIBIDO showInKds:', showInKds, 'Tipo:', typeof showInKds);


    try {
        const sqlParams = [
            name,
            price,
            categoryId,
            requiresMeat ? 1 : 0,
            requiresMasa ? 1 : 0,
            JSON.stringify(availableExtras || []),
            isActive !== false ? 1 : 0,
            isCombo ? 1 : 0,
            JSON.stringify(comboDefinition || null),
            trackStock ? 1 : 0,
            imageUrl || null,
            description || null,
            JSON.stringify(availableMeatIds || []),
            showInKds !== false ? 1 : 0,
            Number(id)
        ];
        console.log('[ProductUpdate] Final SQL Params:', sqlParams);
        const result = await query(
            'UPDATE products SET name = ?, price = ?, category_id = ?, requires_meat = ?, requires_masa = ?, available_extras = ?, is_active = ?, is_combo = ?, combo_definition = ?, track_stock = ?, image_url = ?, description = ?, available_meats = ?, show_in_kds = ? WHERE id = ?',
            sqlParams
        );

        // Fetch the fresh product to return it normalized
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);
        const fresh = rows[0];
        
        parseProductJSON(fresh);
        console.log('[Product] Final JSON to send:', JSON.stringify(fresh));
        res.json(fresh);

        // Emit AFTER response to ensure client starts fetch AFTER this transaction is complete
        setTimeout(() => req.io.emit('catalog_updated'), 100);
    } catch (err) {
        console.error('[ProductUpdate Error]:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM products WHERE id = ?', [id]);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- TABLES ---
router.post('/tables', async (req, res) => {
    const { name, area, areaId, branchId } = req.body;
    try {
        const result = await query('INSERT INTO tables (name, area, area_id, branch_id) VALUES (?, ?, ?, ?)', [name, area || 'SALÓN', areaId || 1, branchId || 1]);
        res.json({ id: result.insertId, name, area: area || 'SALÓN', areaId: areaId || 1, branchId: branchId || 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/tables/:id', async (req, res) => {
    const { id } = req.params;
    const { name, area, areaId, branchId } = req.body;
    try {
        await query('UPDATE tables SET name = ?, area = ?, area_id = ?, branch_id = ? WHERE id = ?', [name, area || 'SALÓN', areaId || 1, branchId || 1, id]);
        res.json({ id: Number(id), name, area: area || 'SALÓN', areaId: areaId || 1, branchId: branchId || 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/tables/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM tables WHERE id = ?', [id]);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DEBUG ENDPOINT (Remove later)
router.get('/debug-autoclose', async (req, res) => {
    try {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        const branches = await query('SELECT * FROM branches');

        res.json({
            serverTimeRaw: now.toString(),
            serverTimeISO: now.toISOString(),
            calculatedCurrentTime: currentTime,
            calculatedToday: today,
            branches: branches.map(b => ({
                name: b.name,
                autoCloseEnabled: b.auto_close_enabled,
                autoCloseTime: b.auto_close_time,
                lastRun: b.last_auto_close_run,
                willRun: (b.auto_close_enabled && b.auto_close_time && currentTime >= b.auto_close_time) ? 'YES' : 'NO'
            }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- SALES PROJECTIONS ---
router.post('/sales/goals', async (req, res) => {
    const { branchId, monthYear, targetAmount, totalWorkDays, manualSales, manualDays } = req.body;
    try {
        await query(`
            INSERT INTO sales_goals (branch_id, month_year, target_amount, total_work_days, manual_sales, manual_days)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                target_amount = VALUES(target_amount),
                total_work_days = VALUES(total_work_days),
                manual_sales = VALUES(manual_sales),
                manual_days = VALUES(manual_days)
        `, [branchId || 1, monthYear, targetAmount, totalWorkDays || 30, manualSales || null, manualDays || null]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET list of goals for history/list view
router.get('/sales/goals', async (req, res) => {
    const { branchId } = req.query;
    try {
        const goals = await query(`
            SELECT 
                sg.id, 
                sg.month_year, 
                sg.target_amount, 
                sg.total_work_days,
                sg.manual_sales,
                sg.manual_days,
                COALESCE(sg.manual_sales, 0) + COALESCE(SUM(o.total - o.manual_discount), 0) as current_sales,
                COALESCE(sg.manual_days, 0) + COUNT(DISTINCT DATE(o.created_at)) as days_with_sales
            FROM sales_goals sg
            LEFT JOIN orders o ON 
                o.status = 'completed' AND 
                o.branch_id = sg.branch_id AND 
                DATE_FORMAT(o.created_at, '%Y-%m') = sg.month_year
            WHERE sg.branch_id = ? 
            GROUP BY sg.id, sg.month_year, sg.target_amount, sg.total_work_days, sg.manual_sales, sg.manual_days
            ORDER BY sg.month_year DESC
        `, [branchId || 1]);
        res.json(goals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/sales/projection', async (req, res) => {
    const { branchId, monthYear } = req.query; // monthYear optional, default current (local server time)
    const targetBranch = branchId || 1;

    try {
        // Determine dates based on monthYear string or current date
        const now = new Date();
        // If monthYear is provided, parse it 'YYYY-MM', else use current year/month
        let year, month;

        if (monthYear) {
            const parts = monthYear.split('-');
            year = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1; // 0-indexed
        } else {
            year = now.getFullYear();
            month = now.getMonth();
        }

        const pad = (n) => n.toString().padStart(2, '0');
        const currentMonthStr = `${year}-${pad(month + 1)}`;

        // Start of month: 1st day 00:00:00
        const startOfMonthDate = new Date(year, month, 1);
        const startOfMonth = `${year}-${pad(month + 1)}-01 00:00:00`;

        // Start of NEXT month (for query upper bound <)
        const nextMonthDate = new Date(year, month + 1, 1);
        const endOfMonthQuery = `${nextMonthDate.getFullYear()}-${pad(nextMonthDate.getMonth() + 1)}-01 00:00:00`;

        // 1. Get Goal, Work Days & Manual Data
        const goals = await query('SELECT target_amount, total_work_days, manual_sales, manual_days FROM sales_goals WHERE branch_id = ? AND month_year = ?', [targetBranch, currentMonthStr]);
        const targetAmount = goals.length > 0 ? parseFloat(goals[0].target_amount) : 0;
        const totalWorkDays = goals.length > 0 ? (goals[0].total_work_days || 30) : 30;
        const manualSales = goals.length > 0 ? goals[0].manual_sales : null;
        const manualDays = goals.length > 0 ? goals[0].manual_days : null;

        // 2. Get Total Sales
        const sales = await query(`
            SELECT 
                SUM(total - manual_discount) as total_sales
            FROM orders 
            WHERE branch_id = ? 
            AND status = 'completed'
            AND created_at >= ? 
            AND created_at < ?
        `, [targetBranch, startOfMonth, endOfMonthQuery]);

        const actualSalesResult = sales[0].total_sales ? parseFloat(sales[0].total_sales) : 0;
        const currentSales = (parseFloat(manualSales || 0)) + actualSalesResult;

        // 3. Calculate Projection (Linear based on ELAPSED DAYS vs WORK DAYS if configured)
        // Ideally: We need "Elapsed Work Days". For now, we use "Elapsed Calendar Days" but scaled to the "Total Work Days" ratio if needed.
        // SIMPLIFICATION: User enters "Total Work Days" (e.g., 26). 
        // We assume sales happen on work days. 
        // Projection = (CurrentSales / ElapsedCalendarDays) * TotalCalendarDays -- WRONG if we want to use Work Days.

        // Better Logic:
        // Projection = (CurrentSales / ElapsedDays) * DaysInMonth (Standard Calendar Projection)
        // OR
        // Projection = (CurrentSales / ElapsedDays) * TotalWorkDays (If we assume only work days matter? No, that's complex without knowing holidays).

        // Let's stick to CALENDAR DAYS for the projection math to keep it robust (since we don't track holidays), 
        // BUT we return 'totalWorkDays' so the Frontend can display "Daily Goal = Target / TotalWorkDays"
        // This is usually what restaurant owners want: "I need to sell $X per working day".

        const lastDayOfMonth = new Date(year, month + 1, 0).getDate(); // e.g. 30 or 31
        const viewingCurrentMonth = now.getFullYear() === year && now.getMonth() === month;

        let projection = currentSales; // Default if month ended
        let elapsedDays = lastDayOfMonth;

        if (viewingCurrentMonth) {
            elapsedDays = now.getDate(); // e.g. 15th
            const daysToProject = Math.max(1, elapsedDays);
            const dailyAverage = currentSales / daysToProject; // Real Daily Speed
            projection = dailyAverage * lastDayOfMonth; // Simple linear projection (assuming open 7 days/week for simplicity of projection)
            // If they modify Work Days, it mostly affects the "Required Daily Average" KPI, not necessarily the linear projection unless we filter closed days.
        }

        // 4. Daily Data for Chart
        const dailyData = await query(`
             SELECT 
                DAY(created_at) as day,
                SUM(total - manual_discount) as total
             FROM orders
             WHERE branch_id = ?
             AND status = 'completed'
             AND created_at >= ?
             AND created_at < ?
             GROUP BY DAY(created_at)
             ORDER BY day ASC
        `, [targetBranch, startOfMonth, endOfMonthQuery]);

        res.json({
            monthYear: currentMonthStr,
            targetAmount,
            totalWorkDays,
            currentSales,
            projection,
            daysInMonth: lastDayOfMonth,
            elapsedDays,
            dailySales: dailyData,
            manualSales,
            manualDays
        });

    } catch (err) {
        console.error('Projection Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- NOTIFY DELIVERY ---
router.post('/orders/:id/notify_delivery', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM orders WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

        const order = rows[0];
        // Fetch customer/table for notification details
        const [custRows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [order.customer_id]);
        const customer = custRows[0] || null;

        const payload = {
            dailyOrderNumber: order.daily_order_number,
            customerName: customer ? customer.name : 'Cliente',
            type: order.type
        };

        req.io.emit('delivery_notification', payload);

        // --- PUSH NOTIFICATION (Alert Resend) ---
        console.log(`[Realert-DEBUG] Solicitud de realerta recibida para Order ID: ${id}. Tipo: ${order.type}`);

        const lowerType = (order.type || '').toLowerCase();
        if (lowerType === 'delivery') {
            (async () => {
                try {
                    const bId = order.branch_id || order.branchId;
                    console.log(`[Realert-DEBUG] Buscando repartidores para Branch: ${bId}`);

                    const drivers = await query(
                        "SELECT id, name, fcm_tokens, roles FROM users WHERE branch_id = ? AND is_active = 1 AND (JSON_CONTAINS(roles, '\"Repartidor\"') OR JSON_CONTAINS(roles, '\"repartidor\"')) AND fcm_tokens IS NOT NULL",
                        [bId]
                    );

                    console.log(`[Realert-DEBUG] Repartidores encontrados en DB: ${drivers.length}`);

                    let tokens = [];
                    drivers.forEach(d => {
                        let t = d.fcm_tokens;
                        if (typeof t === 'string' && t !== '') {
                            try { t = JSON.parse(t); } catch (e) { t = [t]; }
                        }
                        if (Array.isArray(t)) {
                            const validTokens = t.filter(tk => typeof tk === 'string' && tk.length > 20);
                            console.log(`[Realert-DEBUG] User ${d.id} (${d.name}): ${t.length} tokens raw, ${validTokens.length} validos.`);
                            tokens = tokens.concat(validTokens);
                        }
                    });

                    console.log(`[Realert-DEBUG] Total tokens a notificar: ${tokens.length}`);

                    if (tokens.length > 0) {
                        const orderNum = String(order.daily_order_number || '???').padStart(3, '0');
                        // TEXTOS ACTUALIZADOS: Más urgencia y emojis llamativos
                        const title = order.delivery_driver_id
                            ? `🔔 RECORDATORIO DE ENTREGA`
                            : `🔥 ¡PEDIDO EN ESPERA!`;

                        const body = order.delivery_driver_id
                            ? `Orden #${orderNum} asignada a ti. ¡En marcha! 🛵`
                            : `Orden #${orderNum} necesita repartidor urgente. 🛵💨`;

                        console.log(`[Realert-DEBUG] Enviando notificación... Título: ${title}`);

                        const pushResult = await sendPushNotification(tokens, title, body, {
                            orderId: id,
                            type: 'delivery_alert',
                            url: '/delivery',
                            click_action: '/delivery'
                        }, [
                            { action: 'open_app', title: '🚀 VER PEDIDO' }
                        ], pool);
                        console.log(`[Realert-DEBUG] Firebase Result:`, pushResult ? 'Success ✅' : 'Failed ❌');
                    } else {
                        console.log('[Realert-DEBUG] ⚠️ No hay tokens válidos para enviar.');
                    }
                } catch (pushErr) {
                    console.error('[Realert-ERROR] Falló el reenvío:', pushErr);
                }
            })();
        } else {
            console.log(`[Realert-DEBUG] No es delivery. Tipo era: ${order.type}`);
        }

        res.json({ success: true, message: 'Notification sent' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- OBSERVATION TAGS ---
router.get('/observation-tags', async (req, res) => {
    try {
        const tags = await query('SELECT * FROM observation_tags WHERE is_active = 1 ORDER BY name ASC');
        res.json(tags);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/admin/observation-tags', async (req, res) => {
    try {
        const tags = await query('SELECT * FROM observation_tags ORDER BY name ASC');
        res.json(tags);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/observation-tags', async (req, res) => {
    const { name, is_active } = req.body;
    try {
        const result = await query(
            'INSERT INTO observation_tags (name, is_active) VALUES (?, ?) ON DUPLICATE KEY UPDATE is_active = ?',
            [name.toUpperCase(), is_active !== undefined ? is_active : 1, is_active !== undefined ? is_active : 1]
        );
        const finalId = result.insertId || null;
        const finalName = name.toUpperCase();
        const finalIsActive = is_active !== undefined ? is_active : 1;

        console.log('[ObservationTagCreate] Created/Updated with ID:', finalId);
        req.io.emit('catalog_updated');

        res.json({
            id: finalId,
            name: finalName,
            is_active: finalIsActive,
            isActive: !!finalIsActive,
            success: true
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/observation-tags/:id', async (req, res) => {
    const { id } = req.params;
    const { name, is_active, isActive } = req.body;
    try {
        const current = await query('SELECT * FROM observation_tags WHERE id = ?', [id]);
        if (current.length === 0) return res.status(404).json({ error: 'Not found' });

        const finalName = (name || current[0].name).toUpperCase();
        const finalIsActive = is_active !== undefined ? is_active : (isActive !== undefined ? isActive : current[0].is_active);

        await query(
            'UPDATE observation_tags SET name = ?, is_active = ? WHERE id = ?',
            [finalName, finalIsActive ? 1 : 0, id]
        );
        res.json({ success: true, id, name: finalName, isActive: !!finalIsActive });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/observation-tags/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM observation_tags WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- GLOBAL SETTINGS ---
router.get('/settings', async (req, res) => {
    try {
        // Auto-set payment_pending if needed before returning
        await autoSetPaymentPending();

        const rows = await query('SELECT setting_key, setting_value FROM app_config');
        // Convert to object { gemini_api_key: "..." }
        const settings = rows.reduce((acc, row) => {
            acc[row.setting_key] = row.setting_value;
            return acc;
        }, {});
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/settings', async (req, res) => {
    const settings = req.body; // { gemini_api_key: "..." }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const keys = Object.keys(settings);
        for (const key of keys) {
            const value = settings[key];
            // Upsert
            await conn.query(`
                INSERT INTO app_config (setting_key, setting_value) 
                VALUES (?, ?) 
                ON DUPLICATE KEY UPDATE setting_value = ?
            `, [key, value, value]);
        }
        await conn.commit();
        res.json({ success: true, message: 'Settings saved' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// --- CASH CLOSING REPORTS ---
router.put('/cash-closing/:id/date', async (req, res) => {
    const { id } = req.params;
    const { newDate, branchId } = req.body;

    try {
        const [reports] = await pool.execute(
            'SELECT * FROM cash_closing_reports WHERE id = ?',
            [id]
        );
        if (reports.length === 0) {
            return res.status(404).json({ error: 'Reporte no encontrado.' });
        }

        const reportBranch = branchId || reports[0].branch_id;

        const [existing] = await pool.execute(
            'SELECT id FROM cash_closing_reports WHERE branch_id = ? AND date = ? AND id != ? LIMIT 1',
            [reportBranch, newDate, id]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: `Ya existe un reporte para la fecha ${newDate} en esta sucursal.` });
        }

        await pool.execute(
            'UPDATE cash_closing_reports SET date = ? WHERE id = ?',
            [newDate, id]
        );

        await pool.execute(
            'UPDATE orders SET cash_report_id = ? WHERE branch_id = ? AND DATE(created_at) = ? AND (cash_report_id IS NULL OR cash_report_id NOT IN (SELECT id FROM cash_closing_reports))',
            [id, reportBranch, newDate]
        );

        const [updatedRows] = await pool.execute(
            'SELECT *, DATE_FORMAT(date, "%Y-%m-%d") as date FROM cash_closing_reports WHERE id = ?',
            [id]
        );
        const row = updatedRows[0];
        const updatedReport = {
            id: row.id,
            branchId: Number(row.branch_id),
            date: row.date,
            initialCash: parseFloat(row.initial_cash || 0),
            totalSales: parseFloat(row.total_sales || 0),
            totalCashIn: parseFloat(row.total_cash_in || 0),
            totalChangeOut: parseFloat(row.total_change_out || 0),
            expectedCash: parseFloat(row.expected_cash || 0),
            totalOrders: parseInt(row.total_orders || 0),
            summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : (row.summary || []),
            totalServiceCharge: parseFloat(row.total_service_charge || 0),
            totalCardCommission: parseFloat(row.total_card_commission || 0),
            status: row.status,
            createdAt: row.created_at
        };

        req.io.emit('data_updated');
        res.json({ ...updatedReport, success: true, message: 'Fecha actualizada correctamente.' });
    } catch (err) {
        console.error('[PUT /cash-closing/:id/date] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/cash-closing/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [reports] = await pool.execute(
            'SELECT * FROM cash_closing_reports WHERE id = ?',
            [id]
        );
        if (reports.length === 0) {
            return res.status(404).json({ error: 'Reporte no encontrado.' });
        }

        const report = reports[0];
        if (report.status !== 'OPEN') {
            return res.status(400).json({ error: 'Solo se pueden eliminar sesiones abiertas (OPEN).' });
        }

        const [orders] = await pool.execute(
            'SELECT COUNT(*) as count FROM orders WHERE cash_report_id = ?',
            [id]
        );
        if (orders[0].count > 0) {
            return res.status(400).json({ error: `No se puede eliminar: la sesión tiene ${orders[0].count} órdenes vinculadas.` });
        }

        await pool.execute('DELETE FROM cash_closing_reports WHERE id = ?', [id]);
        req.io.emit('data_updated');
        res.json({ success: true, message: 'Sesión de caja eliminada correctamente.' });
    } catch (err) {
        console.error('[DELETE /cash-closing/:id] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/cash-closing', async (req, res) => {
    const { id, branchId, date, initialCash, totalSales, totalCashIn, totalChangeOut, expectedCash, totalOrders, summary, totalServiceCharge, totalCardCommission, shouldSendEmail, status } = req.body;
    
    const getElSalvadorDate = () => {
        const now = new Date();
        const svOffset = -6 * 60;
        const localDate = new Date(now.getTime() + (now.getTimezoneOffset() - svOffset) * 60 * 1000);
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayElSalvador = getElSalvadorDate();
    let reportDate = date || todayElSalvador;

    if (reportDate > todayElSalvador) {
        reportDate = todayElSalvador;
    }

    try {
        // Si viene un ID, es una actualización de un reporte existente (CLOSED o OPEN)
        if (id) {
            const reportStatus = status || (totalSales > 0 ? 'CLOSED' : 'OPEN');
            const isClosing = reportStatus === 'CLOSED';

            await pool.execute(`
                UPDATE cash_closing_reports SET
                total_sales = ?, total_cash_in = ?, total_change_out = ?,
                expected_cash = ?, total_orders = ?, summary = ?,
                total_service_charge = ?, total_card_commission = ?,
                initial_cash = ?, status = ?
                ${isClosing ? ', closing_timestamp = NOW()' : ''}
                WHERE id = ?
            `, [
                totalSales, totalCashIn, totalChangeOut, 
                expectedCash, totalOrders || 0, JSON.stringify(summary), 
                totalServiceCharge || 0, totalCardCommission || 0,
                initialCash, reportStatus, id
            ]);

            // Trigger Webhook if shouldSendEmail is true (si es un cierre o re-envío)
            if (shouldSendEmail !== false) {
                triggerClosingWebhook(branchId, {
                    date,
                    initialCash,
                    totalSales,
                    totalCashIn,
                    totalChangeOut,
                    expectedCash,
                    totalOrders,
                    totalServiceCharge,
                    totalCardCommission,
                    summary
                }).catch(err => console.error('[POST /cash-closing] Webhook Error:', err));
            }

            const [updatedRows] = await pool.execute('SELECT *, DATE_FORMAT(date, "%Y-%m-%d") as date FROM cash_closing_reports WHERE id = ?', [id]);
            const row = updatedRows[0];
            const updatedReport = {
                id: row.id,
                branchId: Number(row.branch_id),
                date: row.date,
                initialCash: parseFloat(row.initial_cash || 0),
                totalSales: parseFloat(row.total_sales || 0),
                totalCashIn: parseFloat(row.total_cash_in || 0),
                totalChangeOut: parseFloat(row.total_change_out || 0),
                expectedCash: parseFloat(row.expected_cash || 0),
                totalOrders: parseInt(row.total_orders || 0),
                summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : (row.summary || []),
                totalServiceCharge: parseFloat(row.total_service_charge || 0),
                totalCardCommission: parseFloat(row.total_card_commission || 0),
                status: row.status,
                createdAt: row.created_at
            };

            req.io.emit('data_updated');
            return res.json({ ...updatedReport, success: true, message: 'Reporte actualizado correctamente.' });
        }

        const reportStatus = status || (totalSales > 0 ? 'CLOSED' : 'OPEN');

        if (reportStatus === 'OPEN') {
            // APERTURA: Verificar si ya hay una abierta para esta misma fecha
            const [openSessions] = await pool.execute(
                'SELECT id FROM cash_closing_reports WHERE branch_id = ? AND status = "OPEN" AND date = ? LIMIT 1',
                [branchId, reportDate]
            );

            if (openSessions.length > 0) {
                const existingId = openSessions[0].id;
                // ACTUALIZACIÓN: Si ya hay una abierta, actualizamos el monto inicial con el nuevo valor
                // Esto previene que si olvidaron cerrar ayer, el monto de hoy se ignore.
                await pool.execute(
                    'UPDATE cash_closing_reports SET initial_cash = ?, date = ? WHERE id = ?',
                    [initialCash, reportDate, existingId]
                );

                // --- VINCULACIÓN DE HUÉRFANOS (En actualización) ---
                await pool.execute(
                    'UPDATE orders SET cash_report_id = ? WHERE branch_id = ? AND DATE(created_at) = ? AND (cash_report_id IS NULL OR cash_report_id NOT IN (SELECT id FROM cash_closing_reports))',
                    [existingId, branchId, reportDate]
                );

                const [updatedRows] = await pool.execute('SELECT *, DATE_FORMAT(date, "%Y-%m-%d") as date FROM cash_closing_reports WHERE id = ?', [existingId]);
                const row = updatedRows[0];
                const updatedReport = {
                    id: row.id,
                    branchId: Number(row.branch_id),
                    date: row.date,
                    initialCash: parseFloat(row.initial_cash || 0),
                    totalSales: parseFloat(row.total_sales || 0),
                    totalCashIn: parseFloat(row.total_cash_in || 0),
                    totalChangeOut: parseFloat(row.total_change_out || 0),
                    expectedCash: parseFloat(row.expected_cash || 0),
                    totalOrders: parseInt(row.total_orders || 0),
                    summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : (row.summary || []),
                    totalServiceCharge: parseFloat(row.total_service_charge || 0),
                    totalCardCommission: parseFloat(row.total_card_commission || 0),
                    status: row.status,
                    createdAt: row.created_at
                };
                req.io.emit('data_updated');
                return res.json({ ...updatedReport, success: true, message: 'Sesión existente actualizada.' });
            }

            // Crear nueva sesión. 
            const [result] = await pool.execute(`
                INSERT INTO cash_closing_reports 
                (branch_id, date, initial_cash, total_sales, total_cash_in, total_change_out, expected_cash, total_orders, summary, total_service_charge, total_card_commission, status, opening_timestamp)
                VALUES (?, ?, ?, 0, 0, 0, ?, 0, '[]', 0, 0, 'OPEN', NOW())
            `, [branchId, reportDate, initialCash, initialCash]);

            const [newRows] = await pool.execute('SELECT *, DATE_FORMAT(date, "%Y-%m-%d") as date FROM cash_closing_reports WHERE id = ?', [result.insertId]);
            const nRow = newRows[0];
            const currentReportId = nRow.id;

            // --- VINCULACIÓN DE HUÉRFANOS ---
            // Si es una apertura retroactiva, buscamos órdenes de esa fecha y sucursal para vincularlas a esta nueva caja
            await pool.execute(
                'UPDATE orders SET cash_report_id = ? WHERE branch_id = ? AND DATE(created_at) = ? AND (cash_report_id IS NULL OR cash_report_id NOT IN (SELECT id FROM cash_closing_reports))',
                [currentReportId, branchId, reportDate]
            );

            const newReport = {
                id: nRow.id,
                branchId: Number(nRow.branch_id),
                date: nRow.date,
                initialCash: parseFloat(nRow.initial_cash || 0),
                totalSales: parseFloat(nRow.total_sales || 0),
                totalCashIn: parseFloat(nRow.total_cash_in || 0),
                totalChangeOut: parseFloat(nRow.total_change_out || 0),
                expectedCash: parseFloat(nRow.expected_cash || 0),
                totalOrders: parseInt(nRow.total_orders || 0),
                summary: typeof nRow.summary === 'string' ? JSON.parse(nRow.summary) : (nRow.summary || []),
                totalServiceCharge: parseFloat(nRow.total_service_charge || 0),
                totalCardCommission: parseFloat(nRow.total_card_commission || 0),
                status: nRow.status,
                createdAt: nRow.created_at
            };

            req.io.emit('data_updated');
            return res.json({ ...newReport, success: true });

        } else {
            // CIERRE: Buscar la sesión abierta para esta sucursal (por fecha si está disponible)
            let closeSql = 'SELECT id FROM cash_closing_reports WHERE branch_id = ? AND status = "OPEN"';
            let closeParams = [branchId];
            if (reportDate) {
                closeSql += ' AND date = ?';
                closeParams.push(reportDate);
            }
            closeSql += ' ORDER BY id DESC LIMIT 1';
            const [openSessions] = await pool.execute(closeSql, closeParams);

            if (openSessions.length === 0) {
                return res.status(404).json({ error: 'No hay ninguna sesión abierta para cerrar.' });
            }

            const targetId = openSessions[0].id;

            await pool.execute(`
                UPDATE cash_closing_reports SET
                total_sales = ?, total_cash_in = ?, total_change_out = ?,
                expected_cash = ?, total_orders = ?, summary = ?,
                total_service_charge = ?, total_card_commission = ?,
                status = 'CLOSED', closing_timestamp = NOW(), created_at = NOW()
                WHERE id = ?
            `, [
                totalSales, totalCashIn, totalChangeOut, 
                expectedCash, totalOrders || 0, JSON.stringify(summary), 
                totalServiceCharge || 0, totalCardCommission || 0, targetId
            ]);

            // Trigger Webhook if configured for the branch AND shouldSendEmail is true
            if (shouldSendEmail !== false) {
                triggerClosingWebhook(branchId, {
                    date,
                    initialCash,
                    totalSales,
                    totalCashIn,
                    totalChangeOut,
                    expectedCash,
                    totalOrders,
                    totalServiceCharge,
                    totalCardCommission,
                    summary
                }).catch(err => console.error('[POST /cash-closing] Webhook Error:', err));
            }

            // Devolver el reporte completo actualizado (como en la rama OPEN)
            const [updatedRows] = await pool.execute('SELECT *, DATE_FORMAT(date, "%Y-%m-%d") as date FROM cash_closing_reports WHERE id = ?', [targetId]);
            const row = updatedRows[0];
            const closedReport = {
                id: row.id,
                branchId: Number(row.branch_id),
                date: row.date,
                initialCash: parseFloat(row.initial_cash || 0),
                totalSales: parseFloat(row.total_sales || 0),
                totalCashIn: parseFloat(row.total_cash_in || 0),
                totalChangeOut: parseFloat(row.total_change_out || 0),
                expectedCash: parseFloat(row.expected_cash || 0),
                totalOrders: parseInt(row.total_orders || 0),
                summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : (row.summary || []),
                totalServiceCharge: parseFloat(row.total_service_charge || 0),
                totalCardCommission: parseFloat(row.total_card_commission || 0),
                status: row.status,
                createdAt: row.created_at
            };

            req.io.emit('data_updated');
            return res.json({ ...closedReport, success: true });
        }
    } catch (err) {
        console.error('[POST /cash-closing] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- INVENTORY ENDPOINTS ---
router.get('/inventory', async (req, res) => {
    try {
        const sql = `
            SELECT 
                p.id as productId,
                p.name as productName,
                p.price as sellingPrice,
                p.category_id as categoryId,
                c.name as categoryName,
                COALESCE(s.quantity, 0) as quantity,
                COALESCE(s.min_stock, 0) as minStock,
                COALESCE(s.average_cost, 0) as averageCost,
                s.branch_id as branchId,
                b.name as branchName
            FROM products p
            JOIN categories c ON p.category_id = c.id
            LEFT JOIN inventory_stock s ON p.id = s.product_id
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE p.track_stock = TRUE OR s.quantity IS NOT NULL
            ORDER BY c.name, p.name
        `;
        const inventory = await query(sql);
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/inventory/availability', async (req, res) => {
    const { branchId, excludeOrderId } = req.query;
    try {
        if (!branchId) return res.status(400).json({ error: 'branchId required' });

        // 1. Get Physical Stock
        const stock = await query('SELECT product_id, quantity FROM inventory_stock WHERE branch_id = ?', [branchId]);

        // 2. Get Reserved Stock (Open Orders)
        // Status: pending, kitchen*, ready, delivery* (Accepted but not completed)
        // We exclude 'completed' and 'cancelled'
        // CRITICAL: Exclude the current order (excludeOrderId) to prevent double counting on frontend (Backend Reserved + Frontend Local Cart)
        let reservedQuery = `
            SELECT oi.product_id, SUM(oi.quantity) as reserved_qty, oi.combo_selections, p.is_combo
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.branch_id = ? 
            AND o.status NOT IN ('completed', 'cancelled')
        `;

        const queryParams = [branchId];

        if (excludeOrderId) {
            reservedQuery += ` AND o.id != ?`;
            queryParams.push(excludeOrderId);
        }

        reservedQuery += ` GROUP BY oi.product_id, oi.combo_selections, p.is_combo`;

        const reserved = await query(reservedQuery, queryParams);

        const availabilityMap = {};

        // Initialize with physical stock
        stock.forEach(s => {
            availabilityMap[s.product_id] = parseFloat(s.quantity);
        });

        // Subtract Reserved
        for (const r of reserved) {
            const qty = parseFloat(r.reserved_qty);

            if (r.is_combo && r.combo_selections) {
                // Deduct combo components
                try {
                    const selections = typeof r.combo_selections === 'string' ? JSON.parse(r.combo_selections) : r.combo_selections;
                    if (Array.isArray(selections)) {
                        const candidates = selections.map(s => ({
                            pid: Number(s.productId),
                            qty: parseFloat(s.quantity) * qty
                        }));
                        const uniquePids = [...new Set(candidates.map(c => c.pid))];
                        if (uniquePids.length > 0) {
                            const placeholders = uniquePids.map(() => '?').join(',');
                            const compRows = await query(`SELECT id, track_stock FROM products WHERE id IN (${placeholders})`, uniquePids);
                            const trackMap = new Map(compRows.map(p => [p.id, !!p.track_stock]));
                            candidates.forEach(c => {
                                if (!trackMap.get(c.pid)) return;
                                const compId = c.pid;
                                const compQty = c.qty;
                                if (availabilityMap[compId] !== undefined) {
                                    availabilityMap[compId] -= compQty;
                                } else {
                                    // If track stock mainly for components but not initialized (e.g. 0 stock), init it
                                    availabilityMap[compId] = (availabilityMap[compId] || 0) - compQty;
                                }
                            });
                        }
                    }
                } catch (e) { console.error('Error parsing combo reserved:', e); }
            } else {
                // Normal Product
                if (availabilityMap[r.product_id] !== undefined) {
                    availabilityMap[r.product_id] -= qty;
                } else {
                    availabilityMap[r.product_id] = (availabilityMap[r.product_id] || 0) - qty;
                }
            }
        }

        res.json(availabilityMap);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/inventory/adjust', async (req, res) => {
    const { productId, branchId, type, quantity, reason, unitCost, relatedBranchId, userId } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Get current stock and cost
        const [rows] = await conn.execute(
            'SELECT quantity, average_cost FROM inventory_stock WHERE product_id = ? AND branch_id = ? FOR UPDATE',
            [productId, branchId]
        );

        const previousStock = rows.length > 0 ? parseFloat(rows[0].quantity) : 0;
        const previousAvgCost = rows.length > 0 ? parseFloat(rows[0].average_cost || 0) : 0;

        let adjustment = parseFloat(quantity);
        const costToApply = parseFloat(unitCost || 0);

        if (['ADJUSTMENT_SUB', 'TRANSFER_OUT', 'SALE'].includes(type)) {
            adjustment = -adjustment;
        }

        const newStock = previousStock + adjustment;

        // Calculate new average cost (only for positive entries)
        let newAvgCost = previousAvgCost;
        if (['PURCHASE', 'ADJUSTMENT_ADD', 'INITIAL'].includes(type) && costToApply > 0) {
            if (previousStock + parseFloat(quantity) > 0) {
                // If stock was negative or zero, this is effectively a new valuation or a weighted average
                if (previousStock <= 0) {
                    newAvgCost = costToApply;
                } else {
                    newAvgCost = ((previousStock * previousAvgCost) + (parseFloat(quantity) * costToApply)) / (previousStock + parseFloat(quantity));
                }
            } else {
                newAvgCost = costToApply;
            }
        }

        // 2. Upsert stock
        if (rows.length > 0) {
            await conn.execute(
                'UPDATE inventory_stock SET quantity = ?, average_cost = ? WHERE product_id = ? AND branch_id = ?',
                [newStock, newAvgCost, productId, branchId]
            );
        } else {
            await conn.execute(
                'INSERT INTO inventory_stock (product_id, branch_id, quantity, average_cost) VALUES (?, ?, ?, ?)',
                [productId, branchId, newStock, newAvgCost]
            );
        }

        // 3. Log transaction
        await conn.execute(`
            INSERT INTO inventory_transactions 
            (product_id, branch_id, transaction_type, quantity, unit_cost, previous_stock, new_stock, reason, user_id, related_branch_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            productId,
            branchId,
            type,
            Math.abs(parseFloat(quantity)),
            costToApply,
            previousStock,
            newStock,
            reason,
            userId || null,
            relatedBranchId || null || null
        ]);

        await conn.commit();
        res.json({ success: true, newStock, newAvgCost });
    } catch (err) {
        await conn.rollback();
        console.error('[INVENTORY-ADJUST-ERROR]', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

router.get('/inventory/kardex/:productId', async (req, res) => {
    const { productId } = req.params;
    const { branchId } = req.query;
    try {
        let sql = `
            SELECT
        it.id,
            it.product_id as productId,
            it.branch_id as branchId,
            it.transaction_type as transactionType,
            it.quantity,
            it.unit_cost as unitCost,
            it.previous_stock as previousStock,
            it.new_stock as newStock,
            it.related_branch_id as relatedBranchId,
            it.reason,
            it.created_at as createdAt,
            it.user_id as userId,
            it.order_id as orderId,
            u.username as userName
            FROM inventory_transactions it
            LEFT JOIN users u ON it.user_id = u.id
            WHERE it.product_id = ?
            `;
        const params = [productId];

        if (branchId) {
            sql += ' AND it.branch_id = ?';
            params.push(branchId);
        }

        sql += ' ORDER BY it.created_at DESC LIMIT 100';

        const history = await query(sql, params);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- GET CASH SESSIONS FOR A BRANCH + DATE RANGE ---
router.get('/admin/cash-sessions', async (req, res) => {
    const { branchId, startDate, endDate } = req.query;
    if (!branchId || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing branchId, startDate, endDate' });
    }
    try {
        const sessions = await query(
            `SELECT id, DATE_FORMAT(date, '%Y-%m-%d') as date,
            opening_timestamp, closing_timestamp, status,
            initial_cash, total_sales, total_orders
            FROM cash_closing_reports
            WHERE branch_id = ? AND date >= ? AND date <= ?
            ORDER BY opening_timestamp ASC`,
            [parseInt(branchId), startDate, endDate]
        );
        res.json(sessions);
    } catch (err) {
        console.error('[CASH-SESSIONS ERROR]:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- GET OPEN CASH SESSIONS FOR REDIGITATION (PAST DATES) ---
router.get('/admin/redigitate-sessions', async (req, res) => {
    const { branchId } = req.query;
    if (!branchId) {
        return res.status(400).json({ error: 'Missing branchId' });
    }
    try {
        const sessions = await query(
            `SELECT id, DATE_FORMAT(date, '%Y-%m-%d') as date,
            opening_timestamp, initial_cash, total_sales, total_orders
            FROM cash_closing_reports
            WHERE branch_id = ? AND status = 'OPEN' AND date < CURDATE()
            ORDER BY date DESC, opening_timestamp DESC`,
            [parseInt(branchId)]
        );
        res.json(sessions);
    } catch (err) {
        console.error('[REDIGITATE-SESSIONS ERROR]:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- DATA CLEARING ENDPOINT (SUPERADMIN ONLY) ---
router.post('/admin/clear-data', async (req, res) => {
    const { type, pin, userId, branchId, startDate, endDate, cashReportIds } = req.body;

    if (!type || !pin || !userId) {
        return res.status(400).json({ error: 'Missing required parameters (type, pin, userId)' });
    }

    try {
        // 1. Verify if user is SuperAdmin and PIN is correct
        const [user] = await query(
            "SELECT pin, roles FROM users WHERE id = ?",
            [userId]
        );

        if (!user) return res.status(404).json({ error: 'User not found' });

        let roles = user.roles;
        if (typeof roles === 'string') {
            try { roles = JSON.parse(roles); } catch (e) { roles = [roles]; }
        }

        const isSuperAdmin = Array.isArray(roles) && roles.some(r => r.toLowerCase() === 'superadmin');
        if (!isSuperAdmin) {
            return res.status(403).json({ error: 'Only SuperAdmin can perform data clearing' });
        }

        if (String(user.pin) !== String(pin)) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        const conn = await pool.getConnection();
        try {
            await conn.query("SET FOREIGN_KEY_CHECKS = 0");

            if (type === 'SALES' || type === 'ALL') {
                if (type === 'SALES' && cashReportIds && Array.isArray(cashReportIds) && cashReportIds.length > 0) {
                    console.log(`[CLEAR-DATA] Targeted Sales deletion: ${cashReportIds.length} session(s) - IDs: ${JSON.stringify(cashReportIds)}`);
                    const ids = cashReportIds.map(Number).filter(id => !isNaN(id));
                    console.log(`[CLEAR-DATA] Parsed numeric IDs: ${JSON.stringify(ids)}`);
                    if (ids.length === 0) {
                        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
                        throw new Error('Invalid cashReportIds');
                    }
                    const placeholders = ids.map(() => '?').join(',');

                    // Get order IDs linked to these cash sessions
                    const [ordersToDelete] = await conn.query(
                        `SELECT id, cash_report_id FROM orders WHERE cash_report_id IN (${placeholders})`,
                        ids
                    );
                    const orderIds = ordersToDelete.map(o => o.id);
                    console.log(`[CLEAR-DATA] Found ${orderIds.length} order(s) linked to these sessions`);

                    if (orderIds.length > 0) {
                        const orderPlaceholders = orderIds.map(() => '?').join(',');
                        await conn.query(`DELETE FROM order_item_extras WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id IN (${orderPlaceholders}))`, orderIds);
                        await conn.query(`DELETE FROM order_items WHERE order_id IN (${orderPlaceholders})`, orderIds);
                        await conn.query(`DELETE FROM payments WHERE order_id IN (${orderPlaceholders})`, orderIds);
                        await conn.query(`DELETE FROM order_audit_logs WHERE order_id IN (${orderPlaceholders})`, orderIds);
                        await conn.query(`DELETE FROM pending_balances WHERE order_id IN (${orderPlaceholders})`, orderIds);
                        await conn.query(`DELETE FROM orders WHERE id IN (${orderPlaceholders})`, orderIds);
                        console.log(`[CLEAR-DATA] Deleted ${orderIds.length} order(s) successfully`);
                    } else {
                        // DIAGNÓSTICO: buscar por qué no se encontraron órdenes
                        console.warn(`[CLEAR-DATA] ⚠️ NO se encontraron órdenes con cash_report_id IN (${ids.join(',')})`);

                        const [sessionsExist] = await conn.query(
                            `SELECT id, date, status FROM cash_closing_reports WHERE id IN (${placeholders})`,
                            ids
                        );
                        console.log(`[CLEAR-DATA] Sesiones objetivo en DB: ${JSON.stringify(sessionsExist)}`);

                        const [distinctIds] = await conn.query(
                            `SELECT cash_report_id, COUNT(*) as count FROM orders WHERE cash_report_id IS NOT NULL GROUP BY cash_report_id ORDER BY cash_report_id LIMIT 30`
                        );
                        console.log(`[CLEAR-DATA] Distribución de cash_report_id en orders: ${JSON.stringify(distinctIds)}`);

                        const [colInfo] = await conn.query(
                            `SELECT DATA_TYPE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'cash_report_id'`
                        );
                        console.log(`[CLEAR-DATA] Info columna cash_report_id: ${JSON.stringify(colInfo)}`);
                    }

                    await conn.query(`DELETE FROM cash_closing_reports WHERE id IN (${placeholders})`, ids);
                    console.log(`[CLEAR-DATA] Deleted ${ids.length} cash session(s)`);
                } else {
                    console.log(`[CLEAR-DATA] Full truncate Sales Data (Type: ${type})...`);
                    await conn.query("TRUNCATE TABLE order_item_extras");
                    await conn.query("TRUNCATE TABLE order_items");
                    await conn.query("TRUNCATE TABLE payments");
                    await conn.query("TRUNCATE TABLE order_audit_logs");
                    await conn.query("TRUNCATE TABLE pending_balances");
                    await conn.query("TRUNCATE TABLE cash_closing_reports");
                    await conn.query("TRUNCATE TABLE orders");
                }
            }

            if (type === 'INVENTORY' || type === 'ALL') {
                console.log(`[CLEAR-DATA] Clearing Inventory Data (Type: ${type})...`);
                await conn.query("TRUNCATE TABLE inventory_transactions");
                await conn.query("TRUNCATE TABLE inventory_stock");
            }

            if (type === 'ALL') {
                console.log(`[CLEAR-DATA] Clearing Sales Goals (Type: ALL)...`);
                await conn.query("TRUNCATE TABLE sales_goals");
            }

            await conn.query("SET FOREIGN_KEY_CHECKS = 1");

            // --- NOTIFY ALL CLIENTS VIA SOCKET ---
            if (type === 'SALES' || type === 'ALL') {
                req.io.emit('orders_updated');
            }
            if (type === 'INVENTORY' || type === 'ALL') {
                req.io.emit('catalog_updated');
            }

            res.json({ success: true, message: `Data clearing (${type}) successful` });
        } catch (dbErr) {
            await conn.query("SET FOREIGN_KEY_CHECKS = 1");
            throw dbErr;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('[CLEAR-DATA ERROR]:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- FORCE RELOAD: Notify all connected clients to update immediately ---
router.post('/admin/trigger-update', (req, res) => {
    try {
        const io = req.io;
        if (!io) return res.status(500).json({ error: 'Socket.io not available' });
        io.emit('force_reload');
        console.log('[UPDATE] force_reload emitted to all clients.');
        res.json({ status: 'ok', message: 'force_reload emitted to all clients' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- BACKUP DATABASE ---
router.get('/admin/backup-database', async (req, res) => {
    try {
        const host = process.env.DB_HOST || 'localhost';
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASSWORD || '';
        const database = process.env.DB_NAME || 'restaurante_os';
        const isLocal = host === 'localhost' && process.platform === 'linux';
        const socket = '/var/run/mysqld/mysqld.sock';

        let connectionOpts = `--user=${user} --password=${password}`;
        if (isLocal) {
            connectionOpts += ` --socket=${socket}`;
        } else {
            connectionOpts += ` --host=${host}`;
        }

        const cmd = `mysqldump ${connectionOpts} --single-transaction --routines --triggers ${database}`;

        const now = new Date();
        const svOffset = -6 * 60;
        const svDate = new Date(now.getTime() + (now.getTimezoneOffset() - svOffset) * 60 * 1000);
        const dateStr = `${svDate.getFullYear()}-${String(svDate.getMonth() + 1).padStart(2, '0')}-${String(svDate.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(svDate.getHours()).padStart(2, '0')}-${String(svDate.getMinutes()).padStart(2, '0')}`;

        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename="backup_${dateStr}_${timeStr}.sql"`);

        const dump = exec(cmd, { timeout: 120000 });
        let stderrBuf = '';
        let hasError = false;

        dump.stderr.on('data', (chunk) => { stderrBuf += chunk.toString(); });

        dump.stdout.on('error', () => { hasError = true; });

        dump.stdout.pipe(res);

        dump.on('error', (err) => {
            console.error('[BACKUP] exec error:', err);
            hasError = true;
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Error al ejecutar mysqldump: ' + err.message });
            }
            res.end();
        });

        dump.on('close', (code) => {
            if (code !== 0) {
                console.error('[BACKUP] Exit code:', code, 'stderr:', stderrBuf);
                if (!res.headersSent) {
                    return res.status(500).json({ error: 'mysqldump falló (código ' + code + '): ' + stderrBuf });
                }
            }
            res.end();
        });
    } catch (err) {
        console.error('[BACKUP] Error:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: err.message });
        }
        res.end();
    }
});

export default router;

// --- MIGRATIONS ---
router.get('/migrate-discount', async (req, res) => {
    try {
        console.log('[MIGRATION] Running manual_discount migration...');
        await pool.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS manual_discount DECIMAL(10,2) DEFAULT 0.00 AFTER discount');
        console.log('[MIGRATION] Migration successful.');
        res.json({ status: 'success', message: 'manual_discount column added' });
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            return res.json({ status: 'success', message: 'Column already exists' });
        }
        console.error('[MIGRATION-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

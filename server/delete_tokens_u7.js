import pool from './db.js';

async function deleteTokens() {
    try {
        console.log('--- Iniciando limpieza de tokens para el usuario 7 ---');

        // Verificamos antes de borrar
        const [rows] = await pool.execute('SELECT id, name, fcm_tokens FROM users WHERE id = ?', [7]);

        if (rows.length === 0) {
            console.log('Error: No se encontró al usuario con ID 7.');
            process.exit(0);
        }

        console.log(`Usuario encontrado: ${rows[0].name}`);
        console.log('Tokens actuales:', rows[0].fcm_tokens);

        // Actualizamos a NULL
        const [result] = await pool.execute('UPDATE users SET fcm_tokens = NULL WHERE id = ?', [7]);

        console.log('Resultado:', result.affectedRows > 0 ? '✅ Tokens borrados exitosamente.' : '⚠️ No se realizaron cambios.');

    } catch (error) {
        console.error('❌ Error al intentar borrar los tokens:', error.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

deleteTokens();

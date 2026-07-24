
import pool from './db.js';

async function checkModels() {
    try {
        const [rows] = await pool.execute("SELECT setting_value FROM app_config WHERE setting_key = 'gemini_api_key'");
        const apiKey = rows[0]?.setting_value;

        if (!apiKey) {
            console.log("No API Key found in DB");
            process.exit(1);
        }

        console.log("API Key found (masked):", apiKey.substring(0, 5) + "...");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("API Error:", data.error);
        } else {
            console.log("Available Models:");
            const models = data.models || [];
            models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
        }

    } catch (e) {
        console.error("Script Error:", e);
    } finally {
        pool.end();
    }
}

checkModels();

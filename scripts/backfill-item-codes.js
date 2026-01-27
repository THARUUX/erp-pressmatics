const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_press'
};

async function backfill() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 1. Fetch settings
        const [settingsRows] = await connection.execute("SELECT * FROM settings WHERE setting_key IN ('item_code_template', 'next_item_code_seq')");
        const settings = {};
        settingsRows.forEach(r => settings[r.setting_key] = r.setting_value);

        const template = settings.item_code_template || 'INV-{0000}';
        let seq = parseInt(settings.next_item_code_seq || '1');

        console.log(`Starting backfill with Template: ${template}, Next Seq: ${seq}`);

        // 2. Fetch items without codes
        const [items] = await connection.execute("SELECT * FROM inventory_items WHERE item_code IS NULL OR item_code = '' ORDER BY id ASC");

        console.log(`Found ${items.length} items to backfill.`);

        for (const item of items) {
            let item_code;
            let isUnique = false;

            // Loop to find a unique code to ensure we don't crash on existing manual codes
            while (!isUnique) {
                const paddedSeq = String(seq).padStart(4, '0');
                item_code = template
                    .replace('{0000}', paddedSeq)
                    .replace('{SEQ}', seq)
                    .replace('{CAT}', (item.category || 'UNK').substring(0, 3).toUpperCase());

                // Check if this code exists (e.g. manually entered)
                const [existing] = await connection.execute("SELECT id FROM inventory_items WHERE item_code = ?", [item_code]);

                if (existing.length === 0) {
                    isUnique = true;
                } else {
                    console.log(`Code ${item_code} already exists, skipping sequence.`);
                }
                seq++; // Increment for next attempt/item
            }

            console.log(`Assigning ${item_code} to Item ID ${item.id}`);
            await connection.execute("UPDATE inventory_items SET item_code = ? WHERE id = ?", [item_code, item.id]);
        }

        // 3. Update settings with new sequence
        await connection.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'next_item_code_seq'", [seq]);
        console.log(`Backfill complete. updated next_item_code_seq to ${seq}`);

    } catch (error) {
        console.error('Backfill failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

backfill();

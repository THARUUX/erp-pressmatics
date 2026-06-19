/**
 * Diagnostic script: finds and fixes duplicate quotation_item_details rows.
 * Run: node scripts/fix-duplicate-details.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000'),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    });

    console.log('Connected ✓\n');

    // 1. Find items that have duplicate component_names within the same quotation_item_id
    const [dupes] = await conn.execute(`
        SELECT quotation_item_id, component_name, COUNT(*) as count
        FROM quotation_item_details
        GROUP BY quotation_item_id, component_name
        HAVING COUNT(*) > 1
        ORDER BY quotation_item_id
    `);

    if (dupes.length === 0) {
        console.log('✅ No duplicate details found — the data is clean.');
        await conn.end();
        return;
    }

    console.log(`⚠️  Found ${dupes.length} duplicate group(s):\n`);
    dupes.forEach(d => {
        console.log(`  Item ID ${d.quotation_item_id} → "${d.component_name}" appears ${d.count}x`);
    });

    // 2. For each duplicate group, keep the HIGHEST id (most recent insert) and delete the older ones
    console.log('\nCleaning up duplicates (keeping latest row per group)...');

    for (const dupe of dupes) {
        const [rows] = await conn.execute(
            `SELECT id FROM quotation_item_details 
             WHERE quotation_item_id = ? AND component_name = ?
             ORDER BY id DESC`,
            [dupe.quotation_item_id, dupe.component_name]
        );

        // Keep the first (highest id), delete the rest
        const keepId = rows[0].id;
        const deleteIds = rows.slice(1).map(r => r.id);

        for (const delId of deleteIds) {
            // Delete orphaned finishings first
            await conn.execute(
                'DELETE FROM quotation_item_finishings WHERE quotation_item_detail_id = ?',
                [delId]
            );
            await conn.execute(
                'DELETE FROM quotation_item_details WHERE id = ?',
                [delId]
            );
            console.log(`  Deleted stale detail id=${delId} (kept id=${keepId})`);
        }
    }

    // 3. Also check for orphaned finishings (finishings whose detail no longer exists)
    const [orphanedFinishings] = await conn.execute(`
        SELECT qif.id 
        FROM quotation_item_finishings qif
        LEFT JOIN quotation_item_details qid ON qif.quotation_item_detail_id = qid.id
        WHERE qif.quotation_item_detail_id IS NOT NULL AND qid.id IS NULL
    `);

    if (orphanedFinishings.length > 0) {
        console.log(`\n⚠️  Found ${orphanedFinishings.length} orphaned finishing row(s) — cleaning up...`);
        for (const f of orphanedFinishings) {
            await conn.execute('DELETE FROM quotation_item_finishings WHERE id = ?', [f.id]);
        }
        console.log('  Orphaned finishings deleted.');
    }

    console.log('\n✅ Cleanup complete.');
    await conn.end();
}

run().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});

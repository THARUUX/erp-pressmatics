import mysql from 'mysql2/promise';
import 'dotenv/config';
import fs from 'fs';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
});

async function main() {
  try {
    const ids = {
      'ST-1220': 4290087,
      'ST-1240': 4320093
    };

    const result = {};

    // Describe quotation_item_sfg_lines
    try {
      const [cols] = await pool.query('DESCRIBE quotation_item_sfg_lines');
      console.log('quotation_item_sfg_lines columns:', cols.map(c => `${c.Field} (${c.Type})`));
    } catch (e) {
      console.error('Could not describe quotation_item_sfg_lines', e);
    }

    for (const [code, id] of Object.entries(ids)) {
      result[code] = { id };

      // Helper function to query a table and handle missing columns safely
      const queryTable = async (tableName) => {
        try {
          const [columns] = await pool.query(`DESCRIBE \`${tableName}\``);
          const hasQuotationItemId = columns.some(c => c.Field === 'quotation_item_id');
          const hasItemId = columns.some(c => c.Field === 'item_id');
          
          if (hasQuotationItemId) {
            const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE quotation_item_id = ?`, [id]);
            return rows;
          } else if (hasItemId) {
            const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE item_id = ?`, [id]);
            return rows;
          } else {
            // Let's check if there is parent_id or estimation_id or similar
            const hasParentId = columns.some(c => c.Field === 'parent_id');
            if (hasParentId) {
              const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE parent_id = ?`, [id]);
              return rows;
            }
          }
        } catch (err) {
          console.error(`Error querying ${tableName} for ${code}:`, err.message);
        }
        return [];
      };

      // quotation_items
      const [qItems] = await pool.query('SELECT * FROM quotation_items WHERE id = ?', [id]);
      result[code].item = qItems[0];

      // quotation_item_details
      result[code].details = await queryTable('quotation_item_details');

      // quotation_item_finishings
      result[code].finishings = await queryTable('quotation_item_finishings');

      // quotation_item_sfg_lines
      result[code].sfg_lines = await queryTable('quotation_item_sfg_lines');

      // quotation_item_services
      result[code].services = await queryTable('quotation_item_services');
    }

    fs.writeFileSync('scratch/item_comparison.json', JSON.stringify(result, null, 2));
    console.log('Comparison JSON written to scratch/item_comparison.json');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();

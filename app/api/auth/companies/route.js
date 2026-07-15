import { NextResponse } from 'next/server';
import { pool1, pool2 } from '@/lib/db';

export async function GET() {
  try {
    let name1 = 'Pressmatics Co. 1';
    let name2 = 'Pressmatics Co. 2';

    try {
      const [rows] = await pool1.execute("SELECT setting_value FROM settings WHERE setting_key = 'company_name' LIMIT 1");
      if (rows.length > 0 && rows[0].setting_value) {
        name1 = rows[0].setting_value;
      }
    } catch (e) {
      console.error('Failed to fetch Company 1 name from DB:', e.message);
    }

    try {
      const [rows] = await pool2.execute("SELECT setting_value FROM settings WHERE setting_key = 'company_name' LIMIT 1");
      if (rows.length > 0 && rows[0].setting_value) {
        name2 = rows[0].setting_value;
      }
    } catch (e) {
      console.error('Failed to fetch Company 2 name from DB:', e.message);
    }

    return NextResponse.json({ company1: name1, company2: name2 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

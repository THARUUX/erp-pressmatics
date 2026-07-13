import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [settingRows] = await pool.execute(
            `SELECT setting_key, setting_value FROM settings
             WHERE setting_key IN ('company_name','company_logo','company_tagline','company_phone','company_email','company_address')`
        );
        const brand = {};
        settingRows.forEach(r => { brand[r.setting_key] = r.setting_value; });
        return NextResponse.json(brand);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

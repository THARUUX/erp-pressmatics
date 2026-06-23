import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [orders] = await pool.execute(
            'SELECT so.id, so.code, so.status, so.delivery_date, so.order_date, so.customer_name FROM sales_orders so WHERE so.id = ?',
            [id]
        );
        if (!orders.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const [tasks] = await pool.execute(
            'SELECT * FROM job_tasks WHERE sales_order_id = ? ORDER BY display_order ASC, id ASC',
            [id]
        );

        // Fetch company branding from settings
        const [settingRows] = await pool.execute(
            "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('company_name','company_logo','company_address','company_tagline','company_phone','company_email')"
        );
        const brand = {};
        settingRows.forEach(r => { brand[r.setting_key] = r.setting_value; });

        return NextResponse.json({ order: orders[0], tasks, brand });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

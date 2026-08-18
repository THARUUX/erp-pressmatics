import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function ensureTables() {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS quality_inspections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sales_order_id INT NULL,
                sales_order_code VARCHAR(100) NULL,
                customer_name VARCHAR(255) NULL,
                item_name VARCHAR(255) NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Passed',
                sample_size INT DEFAULT 1,
                passed_qty INT DEFAULT 0,
                failed_qty INT DEFAULT 0,
                defect_category VARCHAR(100) NULL,
                inspector_name VARCHAR(255) NULL,
                notes TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS packing_boxes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sales_order_id INT NULL,
                sales_order_code VARCHAR(100) NULL,
                customer_name VARCHAR(255) NULL,
                item_name VARCHAR(255) NULL,
                box_number INT NOT NULL DEFAULT 1,
                total_boxes INT NOT NULL DEFAULT 1,
                quantity INT NOT NULL DEFAULT 1,
                weight_kg DECIMAL(10,2) DEFAULT 0.00,
                package_type VARCHAR(50) DEFAULT 'Box',
                notes TEXT NULL,
                packed_by VARCHAR(255) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (e) {
        console.error('[Quality & Packing] Table init warning:', e.message);
    }
}

export async function GET(req) {
    try {
        await ensureTables();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';

        // Query sales orders for QC & Packing
        let orderQuery = `
            SELECT 
                so.id, 
                so.code, 
                so.customer_name, 
                so.status, 
                so.created_at,
                COALESCE(
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id),
                    (SELECT GROUP_CONCAT(DISTINCT jt.name SEPARATOR ' · ') FROM job_tasks jt WHERE jt.sales_order_id = so.id),
                    'Printed Item'
                ) AS estimation_names
            FROM sales_orders so
            WHERE so.status NOT IN ('cancelled', 'draft')
        `;
        const params = [];

        if (search) {
            const q = `%${search}%`;
            orderQuery += ` AND (
                so.code LIKE ? OR 
                so.customer_name LIKE ? OR 
                so.job_notes LIKE ? OR
                EXISTS (
                    SELECT 1 FROM quotation_line_items qli
                    JOIN quotation_items qi ON qli.quotation_item_id = qi.id
                    WHERE qli.quotation_id = so.quotation_id AND qi.estimation_name LIKE ?
                ) OR
                EXISTS (
                    SELECT 1 FROM job_tasks jt
                    WHERE jt.sales_order_id = so.id AND (jt.name LIKE ? OR jt.description LIKE ?)
                )
            )`;
            params.push(q, q, q, q, q, q);
        }

        orderQuery += ` ORDER BY so.id DESC LIMIT 200`;

        const [orders] = await pool.execute(orderQuery, params);

        // Fetch QC Inspections
        const [inspections] = await pool.execute(`
            SELECT * FROM quality_inspections ORDER BY created_at DESC LIMIT 500
        `);

        // Fetch Packing Boxes
        const [boxes] = await pool.execute(`
            SELECT * FROM packing_boxes ORDER BY sales_order_id DESC, box_number ASC LIMIT 1000
        `);

        return NextResponse.json({
            success: true,
            orders,
            inspections,
            boxes,
        });
    } catch (error) {
        console.error('Fetch Quality Packing Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch quality packing data' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await ensureTables();
        const body = await req.json();
        const {
            sales_order_id,
            sales_order_code,
            customer_name,
            item_name,
            status = 'Passed',
            sample_size = 1,
            passed_qty = 0,
            failed_qty = 0,
            defect_category = null,
            inspector_name = 'Inspector',
            notes = '',
        } = body;

        if (!sales_order_id) {
            return NextResponse.json({ error: 'sales_order_id is required' }, { status: 400 });
        }

        const [result] = await pool.execute(`
            INSERT INTO quality_inspections (
                sales_order_id, sales_order_code, customer_name, item_name,
                status, sample_size, passed_qty, failed_qty, defect_category, inspector_name, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            sales_order_id,
            sales_order_code || '',
            customer_name || '',
            item_name || 'Printed Item',
            status,
            sample_size,
            passed_qty,
            failed_qty,
            defect_category || null,
            inspector_name || 'Operator',
            notes || ''
        ]);

        return NextResponse.json({
            success: true,
            message: 'Quality inspection record created',
            inspectionId: result.insertId,
        });
    } catch (error) {
        console.error('Create Quality Inspection Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create quality inspection' }, { status: 500 });
    }
}

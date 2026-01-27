import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name, type, sheet_factor, speed, speed_unit, plate_id } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        await pool.execute(
            'UPDATE machines SET name = ?, type = ?, sheet_factor = ?, speed = ?, speed_unit = ?, plate_id = ? WHERE id = ?',
            [name, type, parseFloat(sheet_factor) || 1.0, parseInt(speed) || 0, speed_unit || 'Sheets/Hr', plate_id || null, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update machine' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute('DELETE FROM machines WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Machine Error:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return NextResponse.json({ error: 'Cannot delete: This machine is used in finishings or other records.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to delete machine' }, { status: 500 });
    }
}

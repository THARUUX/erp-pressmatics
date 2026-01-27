import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const { name, unit_cost } = await req.json();

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        await pool.execute(
            'UPDATE plates SET name = ?, unit_cost = ? WHERE id = ?',
            [name, parseFloat(unit_cost) || 0, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update plate' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        // Check usage before delete? For now simple delete.
        // If used in machines, Set NULL? Or restrict?
        // Let's safe delete by updating machines first if needed, but DB FK wasn't strictly enforced with constraints in migration (I added column only).
        // Actually I should probably check if machine uses it.
        // But for MVP simple delete is okay, machine will just have invalid ID (or I should set it to NULL).

        await pool.execute('UPDATE machines SET plate_id = NULL WHERE plate_id = ?', [id]);
        await pool.execute('DELETE FROM plates WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete plate' }, { status: 500 });
    }
}

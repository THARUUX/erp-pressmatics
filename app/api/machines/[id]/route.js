import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const {
            name, type, sheet_factor, speed, speed_unit, plate_id,
            digital_price_max, digital_price_medium, digital_price_min,
            assigned_employee_id, assigned_team_id,
            assigned_employee_ids, assigned_team_ids,
            make_ready_minutes, setup_minutes_per_plate, shift_limit
        } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        let empIds = Array.isArray(assigned_employee_ids) ? assigned_employee_ids.map(i => parseInt(i)).filter(Boolean) : [];
        if (empIds.length === 0 && assigned_employee_id) empIds = [parseInt(assigned_employee_id)];

        let teamIds = Array.isArray(assigned_team_ids) ? assigned_team_ids.map(i => parseInt(i)).filter(Boolean) : [];
        if (teamIds.length === 0 && assigned_team_id) teamIds = [parseInt(assigned_team_id)];

        const singleEmpId = empIds[0] || null;
        const singleTeamId = teamIds[0] || null;

        await pool.execute(
            `UPDATE machines SET
               name=?, type=?, sheet_factor=?, speed=?, speed_unit=?, plate_id=?,
               digital_price_max=?, digital_price_medium=?, digital_price_min=?,
               assigned_employee_id=?, assigned_team_id=?,
               assigned_employee_ids=?, assigned_team_ids=?,
               make_ready_minutes=?, setup_minutes_per_plate=?, shift_limit=?
             WHERE id=?`,
            [
                name,
                type,
                parseFloat(sheet_factor) || 1.0,
                parseInt(speed) || 0,
                speed_unit || 'Sheets/Hr',
                plate_id || null,
                parseFloat(digital_price_max)    || 0,
                parseFloat(digital_price_medium) || 0,
                parseFloat(digital_price_min)    || 0,
                singleEmpId,
                singleTeamId,
                JSON.stringify(empIds),
                JSON.stringify(teamIds),
                parseInt(make_ready_minutes) || 0,
                parseInt(setup_minutes_per_plate) || 0,
                shift_limit !== undefined && shift_limit !== '' ? parseInt(shift_limit) : 8,
                id
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update Machine Error:', error);
        return NextResponse.json({ error: 'Failed to update machine: ' + error.message }, { status: 500 });
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

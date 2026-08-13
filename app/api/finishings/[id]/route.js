import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const {
            name, unit_cost, is_machine, machine_id, cost_unit, variants, speed, speed_unit,
            assigned_employee_id, assigned_team_id, assigned_employee_ids, assigned_team_ids,
            assigned_helper_ids, is_common
        } = await req.json();

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        let empIds = Array.isArray(assigned_employee_ids) ? assigned_employee_ids.map(i => parseInt(i)).filter(Boolean) : [];
        if (empIds.length === 0 && assigned_employee_id) empIds = [parseInt(assigned_employee_id)];

        let teamIds = Array.isArray(assigned_team_ids) ? assigned_team_ids.map(i => parseInt(i)).filter(Boolean) : [];
        if (teamIds.length === 0 && assigned_team_id) teamIds = [parseInt(assigned_team_id)];

        let helperIds = Array.isArray(assigned_helper_ids) ? assigned_helper_ids.map(i => parseInt(i)).filter(Boolean) : [];

        const singleEmpId = empIds[0] || null;
        const singleTeamId = teamIds[0] || null;

        await pool.execute(
            `UPDATE finishings SET
               name = ?, unit_cost = ?, is_machine = ?, machine_id = ?, cost_unit = ?, speed = ?, speed_unit = ?,
               assigned_employee_id = ?, assigned_team_id = ?, assigned_employee_ids = ?, assigned_team_ids = ?, assigned_helper_ids = ?, is_common = ?
             WHERE id = ?`,
            [
                name,
                parseFloat(unit_cost) || 0,
                is_machine ? 1 : 0,
                machine_id || null,
                cost_unit || 'Unit',
                speed ? parseFloat(speed) : null,
                speed_unit || 'Sheets/Hr',
                singleEmpId,
                singleTeamId,
                JSON.stringify(empIds),
                JSON.stringify(teamIds),
                JSON.stringify(helperIds),
                is_common ? 1 : 0,
                id
            ]
        );

        // Update Variants: Delete existing and re-insert
        await pool.execute('DELETE FROM finishing_variants WHERE finishing_id = ?', [id]);

        if (variants && Array.isArray(variants) && variants.length > 0) {
            for (const v of variants) {
                if (v.name) {
                    await pool.execute(
                        'INSERT INTO finishing_variants (finishing_id, name, unit_cost) VALUES (?, ?, ?)',
                        [id, v.name, parseFloat(v.unit_cost) || 0]
                    );
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("error", error);
        return NextResponse.json({ error: 'Failed to update finishing: ' + error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute('DELETE FROM finishings WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete finishing' }, { status: 500 });
    }
}

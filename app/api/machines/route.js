import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT m.*,
                   p.name  AS plate_name,
                   p.unit_cost AS plate_cost
            FROM machines m
            LEFT JOIN inventory_items p ON m.plate_id = p.id
            ORDER BY m.name ASC
        `);

        const [employees] = await pool.execute(`SELECT id, name, job_title FROM employees`);
        const [teams] = await pool.execute(`SELECT id, name, color FROM teams`);

        const empMap = new Map(employees.map(e => [e.id, e]));
        const teamMap = new Map(teams.map(t => [t.id, t]));

        const result = rows.map(m => {
            let empIds = [];
            if (m.assigned_employee_ids) {
                try {
                    empIds = typeof m.assigned_employee_ids === 'string' ? JSON.parse(m.assigned_employee_ids) : m.assigned_employee_ids;
                } catch { empIds = []; }
            }
            if (!Array.isArray(empIds) || empIds.length === 0) {
                if (m.assigned_employee_id) empIds = [parseInt(m.assigned_employee_id)];
                else empIds = [];
            }

            let teamIds = [];
            if (m.assigned_team_ids) {
                try {
                    teamIds = typeof m.assigned_team_ids === 'string' ? JSON.parse(m.assigned_team_ids) : m.assigned_team_ids;
                } catch { teamIds = []; }
            }
            if (!Array.isArray(teamIds) || teamIds.length === 0) {
                if (m.assigned_team_id) teamIds = [parseInt(m.assigned_team_id)];
                else teamIds = [];
            }

            let helperIds = [];
            if (m.assigned_helper_ids) {
                try {
                    helperIds = typeof m.assigned_helper_ids === 'string' ? JSON.parse(m.assigned_helper_ids) : m.assigned_helper_ids;
                } catch { helperIds = []; }
            }
            if (!Array.isArray(helperIds)) {
                helperIds = [];
            }

            const assignedEmployees = empIds.map(id => empMap.get(parseInt(id))).filter(Boolean);
            const assignedTeams = teamIds.map(id => teamMap.get(parseInt(id))).filter(Boolean);
            const assignedHelpers = helperIds.map(id => empMap.get(parseInt(id))).filter(Boolean);

            const assigned_employee_name = assignedEmployees.map(e => e.name).join(', ') || null;
            const assigned_team_name = assignedTeams.map(t => t.name).join(', ') || null;
            const assigned_helper_name = assignedHelpers.map(e => e.name).join(', ') || null;

            return {
                ...m,
                assigned_employee_ids: empIds,
                assigned_team_ids: teamIds,
                assigned_helper_ids: helperIds,
                assigned_employee_id: empIds[0] || null,
                assigned_team_id: teamIds[0] || null,
                assigned_employees: assignedEmployees,
                assigned_teams: assignedTeams,
                assigned_helpers: assignedHelpers,
                assigned_employee_name,
                assigned_team_name,
                assigned_helper_name,
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Fetch machines error:', error);
        return NextResponse.json({ error: 'Failed to fetch machines' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const {
            name, type, sheet_factor, speed, speed_unit, plate_id,
            digital_price_max, digital_price_medium, digital_price_min,
            assigned_employee_id, assigned_team_id,
            assigned_employee_ids, assigned_team_ids, assigned_helper_ids,
            make_ready_minutes, setup_minutes_per_plate, shift_limit
        } = body;

        let empIds = Array.isArray(assigned_employee_ids) ? assigned_employee_ids.map(id => parseInt(id)).filter(Boolean) : [];
        if (empIds.length === 0 && assigned_employee_id) empIds = [parseInt(assigned_employee_id)];

        let teamIds = Array.isArray(assigned_team_ids) ? assigned_team_ids.map(id => parseInt(id)).filter(Boolean) : [];
        if (teamIds.length === 0 && assigned_team_id) teamIds = [parseInt(assigned_team_id)];

        let helperIds = Array.isArray(assigned_helper_ids) ? assigned_helper_ids.map(id => parseInt(id)).filter(Boolean) : [];

        const singleEmpId = empIds[0] || null;
        const singleTeamId = teamIds[0] || null;

        await pool.execute(
            `INSERT INTO machines
             (name, type, sheet_factor, speed, speed_unit, plate_id,
              digital_price_max, digital_price_medium, digital_price_min,
              assigned_employee_id, assigned_team_id,
              assigned_employee_ids, assigned_team_ids, assigned_helper_ids,
              make_ready_minutes, setup_minutes_per_plate, shift_limit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                type,
                sheet_factor || 1.0,
                speed || 0,
                speed_unit || 'Sheets/Hr',
                plate_id || null,
                parseFloat(digital_price_max)    || 0,
                parseFloat(digital_price_medium) || 0,
                parseFloat(digital_price_min)    || 0,
                singleEmpId,
                singleTeamId,
                JSON.stringify(empIds),
                JSON.stringify(teamIds),
                JSON.stringify(helperIds),
                parseInt(make_ready_minutes) || 0,
                parseInt(setup_minutes_per_plate) || 0,
                shift_limit !== undefined && shift_limit !== '' ? parseInt(shift_limit) : 8
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Add Machine Error:', error);
        return NextResponse.json({ error: 'Failed to add machine: ' + error.message }, { status: 500 });
    }
}

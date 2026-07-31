import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [finishings] = await pool.execute(`
            SELECT f.*,
                   m.name as machine_name,
                   m.speed as machine_speed_val,
                   m.speed_unit as machine_speed_unit_val,
                   m.assigned_employee_ids as machine_employee_ids,
                   m.assigned_team_ids as machine_team_ids,
                   m.assigned_employee_id as machine_employee_id,
                   m.assigned_team_id as machine_team_id,
                   m.assigned_helper_ids as machine_helper_ids
            FROM finishings f 
            LEFT JOIN machines m ON f.machine_id = m.id 
            ORDER BY f.name ASC
        `);

        // Fetch variants for all finishings
        const [variants] = await pool.execute('SELECT * FROM finishing_variants ORDER BY unit_cost ASC');

        const [employees] = await pool.execute(`SELECT id, name, job_title FROM employees`);
        const [teams] = await pool.execute(`SELECT id, name, color FROM teams`);

        const empMap = new Map(employees.map(e => [e.id, e]));
        const teamMap = new Map(teams.map(t => [t.id, t]));

        const result = finishings.map(f => {
            const isMachine = f.is_machine === 1;
            const effectiveSpeed = isMachine ? f.machine_speed_val : f.speed;
            const effectiveUnit = isMachine ? f.machine_speed_unit_val : f.speed_unit;

            let empIds = [];
            let teamIds = [];
            let helperIds = [];

            if (isMachine && f.machine_id) {
                // Inherit from machine
                if (f.machine_employee_ids) {
                    try { empIds = typeof f.machine_employee_ids === 'string' ? JSON.parse(f.machine_employee_ids) : f.machine_employee_ids; } catch { empIds = []; }
                }
                if (!Array.isArray(empIds) || empIds.length === 0) {
                    if (f.machine_employee_id) empIds = [parseInt(f.machine_employee_id)];
                }

                if (f.machine_team_ids) {
                    try { teamIds = typeof f.machine_team_ids === 'string' ? JSON.parse(f.machine_team_ids) : f.machine_team_ids; } catch { teamIds = []; }
                }
                if (!Array.isArray(teamIds) || teamIds.length === 0) {
                    if (f.machine_team_id) teamIds = [parseInt(f.machine_team_id)];
                }

                if (f.machine_helper_ids) {
                    try { helperIds = typeof f.machine_helper_ids === 'string' ? JSON.parse(f.machine_helper_ids) : f.machine_helper_ids; } catch { helperIds = []; }
                }
            } else {
                // Manual finishing - read from finishing record
                if (f.assigned_employee_ids) {
                    try { empIds = typeof f.assigned_employee_ids === 'string' ? JSON.parse(f.assigned_employee_ids) : f.assigned_employee_ids; } catch { empIds = []; }
                }
                if (!Array.isArray(empIds) || empIds.length === 0) {
                    if (f.assigned_employee_id) empIds = [parseInt(f.assigned_employee_id)];
                }

                if (f.assigned_team_ids) {
                    try { teamIds = typeof f.assigned_team_ids === 'string' ? JSON.parse(f.assigned_team_ids) : f.assigned_team_ids; } catch { teamIds = []; }
                }
                if (!Array.isArray(teamIds) || teamIds.length === 0) {
                    if (f.assigned_team_id) teamIds = [parseInt(f.assigned_team_id)];
                }

                if (f.assigned_helper_ids) {
                    try { helperIds = typeof f.assigned_helper_ids === 'string' ? JSON.parse(f.assigned_helper_ids) : f.assigned_helper_ids; } catch { helperIds = []; }
                }
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
                ...f,
                speed: effectiveSpeed,
                speed_unit: effectiveUnit,
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
                variants: variants.filter(v => v.finishing_id === f.id)
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Fetch finishings error:', error);
        return NextResponse.json({ error: 'Failed to fetch finishings' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const {
            name, unit_cost, is_machine, machine_id, cost_unit, variants, speed, speed_unit,
            assigned_employee_id, assigned_team_id, assigned_employee_ids, assigned_team_ids,
            assigned_helper_ids
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

        const [result] = await pool.execute(
            `INSERT INTO finishings
             (name, unit_cost, is_machine, machine_id, cost_unit, speed, speed_unit,
              assigned_employee_id, assigned_team_id, assigned_employee_ids, assigned_team_ids, assigned_helper_ids)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                JSON.stringify(helperIds)
            ]
        );

        const newId = result.insertId;

        // Insert Variants if any
        if (variants && Array.isArray(variants) && variants.length > 0) {
            for (const v of variants) {
                if (v.name) {
                    await pool.execute(
                        'INSERT INTO finishing_variants (finishing_id, name, unit_cost) VALUES (?, ?, ?)',
                        [newId, v.name, parseFloat(v.unit_cost) || 0]
                    );
                }
            }
        }

        return NextResponse.json({ id: newId, success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to add finishing' }, { status: 500 });
    }
}

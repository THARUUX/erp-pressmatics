import { NextResponse } from 'next/server';
import pool, { pool1, pool2 } from '@/lib/db';

const DEFAULT_FACTORY_DEPOT = {
    lat: 6.9271,
    lng: 79.8612,
    name: 'Colombo Factory Depot'
};

async function upsertSetting(targetPool, key, value) {
    try {
        const [updateRes] = await targetPool.execute(
            `UPDATE settings SET setting_value = ? WHERE setting_key = ?`,
            [value, key]
        );
        if (updateRes.affectedRows === 0) {
            await targetPool.execute(
                `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)`,
                [key, value]
            );
        }
    } catch (e) {
        // Retry with ON DUPLICATE KEY UPDATE as fallback
        try {
            await targetPool.execute(
                `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`,
                [key, value, value]
            );
        } catch (err) {
            console.error('Upsert setting failed for pool:', err);
        }
    }
}

export async function GET() {
    try {
        // Try active pool first
        let [rows] = await pool.execute(
            `SELECT setting_value FROM settings WHERE setting_key = 'factory_depot_location'`
        );

        // Fallback to pool1 if active pool has no row
        if (!rows || rows.length === 0) {
            [rows] = await pool1.execute(
                `SELECT setting_value FROM settings WHERE setting_key = 'factory_depot_location'`
            );
        }

        // Fallback to pool2 if pool1 has no row
        if (!rows || rows.length === 0) {
            [rows] = await pool2.execute(
                `SELECT setting_value FROM settings WHERE setting_key = 'factory_depot_location'`
            );
        }

        if (rows && rows.length > 0 && rows[0].setting_value) {
            try {
                const parsed = JSON.parse(rows[0].setting_value);
                return NextResponse.json({
                    lat: parseFloat(parsed.lat) || DEFAULT_FACTORY_DEPOT.lat,
                    lng: parseFloat(parsed.lng) || DEFAULT_FACTORY_DEPOT.lng,
                    name: parsed.name || DEFAULT_FACTORY_DEPOT.name
                });
            } catch (e) {
                console.error('Error parsing factory_depot_location json:', e);
            }
        }

        return NextResponse.json(DEFAULT_FACTORY_DEPOT);
    } catch (error) {
        console.error('Error fetching factory depot location:', error);
        return NextResponse.json(DEFAULT_FACTORY_DEPOT);
    }
}

export async function PUT(req) {
    try {
        const body = await req.json();
        const { lat, lng, name } = body;

        if (lat === undefined || lat === null || lng === undefined || lng === null) {
            return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
        }

        const depotData = {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            name: name || 'Colombo Factory Depot'
        };

        const jsonString = JSON.stringify(depotData);

        // Save to active pool, pool1, AND pool2 simultaneously to guarantee persistence across all tenant environments
        await Promise.all([
            upsertSetting(pool, 'factory_depot_location', jsonString),
            upsertSetting(pool1, 'factory_depot_location', jsonString),
            upsertSetting(pool2, 'factory_depot_location', jsonString)
        ]);

        return NextResponse.json({ success: true, location: depotData });
    } catch (error) {
        console.error('Error saving factory depot location:', error);
        return NextResponse.json({ error: 'Failed to save factory depot location' }, { status: 500 });
    }
}

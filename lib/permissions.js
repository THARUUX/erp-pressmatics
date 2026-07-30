import pool from './db';

export const DEFAULT_ROLE_PERMISSIONS = {
    admin: {
        access_dashboard: true,
        access_sales: true,
        access_production: true,
        access_hr: true,
        access_inventory: true,
        access_system: true
    },
    manager: {
        access_dashboard: true,
        access_sales: true,
        access_production: true,
        access_hr: true,
        access_inventory: true,
        access_system: false
    },
    operator: {
        access_dashboard: true,
        access_sales: false,
        access_production: true,
        access_hr: false,
        access_inventory: false,
        access_system: false
    }
};

export const ROUTE_PERMISSIONS = {
    '/dashboard/users': 'access_system',
    '/dashboard/settings': 'access_system',
    '/dashboard/system-info': 'access_system',
    '/dashboard/whatsapp': 'access_system',
    '/dashboard/billing': 'access_system',
    '/dashboard/employees': 'access_hr',
    '/dashboard/attendance': 'access_hr',
    '/dashboard/payroll': 'access_hr',
    '/dashboard/inventory': 'access_inventory',
    '/dashboard/suppliers': 'access_inventory',
    '/dashboard/customers': 'access_sales',
    '/dashboard/quotations': 'access_sales',
    '/dashboard/sales-orders': 'access_sales',
    '/dashboard/invoices': 'access_sales',
    '/dashboard/estimations': 'access_production',
    '/dashboard/items': 'access_production',
    '/dashboard/services': 'access_production',
    '/dashboard/job-planning': 'access_production',
    '/dashboard/analytics': 'access_dashboard',
    '/dashboard/competitor-analysis': 'access_dashboard',
};

export async function getRolePermissions(role) {
    try {
        const [rows] = await pool.execute(
            "SELECT setting_value FROM settings WHERE setting_key = 'role_permissions'"
        );
        if (rows.length === 0) {
            return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.operator;
        }
        const permissions = JSON.parse(rows[0].setting_value);
        return permissions[role] || DEFAULT_ROLE_PERMISSIONS[role] || {
            access_dashboard: false,
            access_sales: false,
            access_production: false,
            access_hr: false,
            access_inventory: false,
            access_system: false
        };
    } catch (e) {
        console.error('Error fetching role permissions:', e);
        return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.operator;
    }
}

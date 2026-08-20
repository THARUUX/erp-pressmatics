import { cacheFetch, memoryCache } from '../cache.js';

export class ResourceRepository {
    /**
     * Fetches and caches the list of all machines.
     * @param {import('mysql2/promise').Pool} pool MySQL connection pool
     * @returns {Promise<Array>} List of machines
     */
    static async getMachines(pool) {
        return cacheFetch('resources:machines', 300, async () => {
            const [machines] = await pool.execute('SELECT * FROM machines ORDER BY name ASC');
            return machines;
        });
    }

    /**
     * Fetches and caches the list of finishing operations.
     * @param {import('mysql2/promise').Pool} pool MySQL connection pool
     * @returns {Promise<Array>} List of finishings
     */
    static async getFinishings(pool) {
        return cacheFetch('resources:finishings', 300, async () => {
            const [finishings] = await pool.execute(
                'SELECT * FROM finishings WHERE machine_id IS NULL OR is_machine = 0 ORDER BY name ASC'
            );
            return finishings;
        });
    }

    /**
     * Fetches and caches the list of employees.
     * @param {import('mysql2/promise').Pool} pool MySQL connection pool
     * @returns {Promise<Array>} List of employees
     */
    static async getEmployees(pool) {
        return cacheFetch('resources:employees', 300, async () => {
            const [employees] = await pool.execute('SELECT id, name FROM employees ORDER BY name ASC');
            return employees;
        });
    }

    /**
     * Fetches and caches the list of teams.
     * @param {import('mysql2/promise').Pool} pool MySQL connection pool
     * @returns {Promise<Array>} List of teams
     */
    static async getTeams(pool) {
        return cacheFetch('resources:teams', 300, async () => {
            const [teams] = await pool.execute('SELECT id, name FROM teams ORDER BY name ASC');
            return teams;
        });
    }

    /**
     * Clears all cached resource datasets.
     */
    static invalidateResources() {
        memoryCache.invalidatePrefix('resources:');
    }
}

export default ResourceRepository;

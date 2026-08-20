/**
 * High-Performance In-Memory Cache with TTL & Invalidation Support
 */

class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Gets a cached item if not expired.
     * @param {string} key Cache key
     * @returns {*|null} Cached item value or null
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }

        this.hits++;
        return entry.value;
    }

    /**
     * Stores an item in the cache with a specified TTL.
     * @param {string} key Cache key
     * @param {*} value Data to cache
     * @param {number} ttlSeconds Expiration in seconds (default: 300 / 5 minutes)
     */
    set(key, value, ttlSeconds = 300) {
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        this.cache.set(key, { value, expiresAt });
    }

    /**
     * Deletes a specific cache key.
     * @param {string} key Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clears cache entries starting with a specific prefix.
     * @param {string} prefix Key prefix
     */
    invalidatePrefix(prefix) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clears all cache entries.
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Returns cache performance statistics.
     */
    getStats() {
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRatio: (this.hits + this.misses) > 0 ? (this.hits / (this.hits + this.misses)).toFixed(2) : '0.00'
        };
    }
}

// Global cache instance across Node runtime
export const memoryCache = globalThis.__erp_memoryCache || new MemoryCache();
if (process.env.NODE_ENV !== 'production') {
    globalThis.__erp_memoryCache = memoryCache;
}

/**
 * Fetch wrapper that returns cached result if available, or executes fetcherFn and caches result.
 * @param {string} key Cache key
 * @param {number} ttlSeconds Expiration in seconds
 * @param {Function} fetcherFn Async data fetcher function
 * @returns {Promise<*>} Result data
 */
export async function cacheFetch(key, ttlSeconds, fetcherFn) {
    const cached = memoryCache.get(key);
    if (cached !== null) {
        return cached;
    }

    const data = await fetcherFn();
    if (data !== undefined && data !== null) {
        memoryCache.set(key, data, ttlSeconds);
    }
    return data;
}

export default memoryCache;

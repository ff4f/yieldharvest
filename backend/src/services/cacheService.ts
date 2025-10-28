import { logger } from '../utils/logger';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export interface CacheConfig {
  defaultTtl?: number; // Default TTL in milliseconds
  maxSize?: number; // Maximum number of entries
  cleanupInterval?: number; // Cleanup interval in milliseconds
}

export class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTtl: number;
  private maxSize: number;
  private cleanupInterval: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    this.defaultTtl = config.defaultTtl || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = config.maxSize || 1000; // 1000 entries max
    this.cleanupInterval = config.cleanupInterval || 60 * 1000; // 1 minute cleanup

    // Start cleanup timer
    this.startCleanup();
  }

  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const actualTtl = ttl || this.defaultTtl;
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: actualTtl,
    };

    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
    logger.debug(`Cache SET: ${key} (TTL: ${actualTtl}ms)`);
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns The cached value or undefined if not found/expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.debug(`Cache MISS: ${key}`);
      return undefined;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      logger.debug(`Cache EXPIRED: ${key}`);
      return undefined;
    }

    logger.debug(`Cache HIT: ${key}`);
    return entry.data as T;
  }

  /**
   * Check if a key exists and is not expired
   * @param key - Cache key
   * @returns True if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   * @param key - Cache key
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      logger.debug(`Cache DELETE: ${key}`);
    }
    return result;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug(`Cache CLEAR: ${size} entries removed`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    defaultTtl: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      defaultTtl: this.defaultTtl,
    };
  }

  /**
   * Get or set a value using a factory function
   * @param key - Cache key
   * @param factory - Function to generate the value if not cached
   * @param ttl - Time to live in milliseconds (optional)
   * @returns The cached or newly generated value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== undefined) {
      return cached;
    }

    logger.debug(`Cache FACTORY: ${key}`);
    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Evict the oldest entry from the cache
   */
  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug(`Cache EVICT: ${oldestKey}`);
    }
  }

  /**
   * Start the cleanup timer to remove expired entries
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug(`Cache CLEANUP: ${removedCount} expired entries removed`);
    }
  }

  /**
   * Stop the cleanup timer and clear the cache
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      delete this.cleanupTimer;
    }
    this.clear();
    logger.debug('Cache destroyed');
  }
}

// Cache instances for different data types
export const mirrorNodeCache = new InMemoryCache({
  defaultTtl: 2 * 60 * 1000, // 2 minutes for Mirror Node data
  maxSize: 500,
  cleanupInterval: 30 * 1000, // 30 seconds cleanup
});

export const nftCache = new InMemoryCache({
  defaultTtl: 5 * 60 * 1000, // 5 minutes for NFT data (less frequent changes)
  maxSize: 1000,
  cleanupInterval: 60 * 1000, // 1 minute cleanup
});

export const hcsCache = new InMemoryCache({
  defaultTtl: 1 * 60 * 1000, // 1 minute for HCS messages (more frequent updates)
  maxSize: 200,
  cleanupInterval: 30 * 1000, // 30 seconds cleanup
});

// Utility functions for generating cache keys
export const CacheKeys = {
  // New cache keys for enhanced Mirror Node service
  NFT_INFO: 'nft_info',
  HCS_MESSAGES: 'hcs_messages',
  ACCOUNT_INFO: 'account_info',
  TRANSACTION_INFO: 'transaction_info',
  NETWORK_STATS: 'network_stats',
  DASHBOARD_METRICS: 'dashboard_metrics',

  // Legacy cache keys for backward compatibility
  nftsByToken: (tokenId: string, limit: number, order: string) => 
    `nfts:${tokenId}:${limit}:${order}`,

  nftBySerial: (tokenId: string, serialNumber: number) => 
    `nft:${tokenId}:${serialNumber}`,

  hcsMessages: (topicId: string, limit: number, order: string) => 
    `hcs:${topicId}:${limit}:${order}`,

  invoiceMessages: (topicId: string, tokenId?: string, limit?: number) => 
    `invoice_msgs:${topicId}:${tokenId || 'all'}:${limit || 100}`,

  transaction: (transactionId: string) => 
    `tx:${transactionId}`,

  fileInfo: (fileId: string) => 
    `file:${fileId}`,
};

// Cache management service
export class CacheService {
  static getCacheStats() {
    return {
      mirrorNode: mirrorNodeCache.getStats(),
      nft: nftCache.getStats(),
      hcs: hcsCache.getStats(),
    };
  }

  static clearAllCaches(): void {
    mirrorNodeCache.destroy();
    nftCache.destroy();
    hcsCache.destroy();
    logger.info('All caches cleared and destroyed');
  }

  static clearCacheByPattern(pattern: string): number {
    let deletedCount = 0;
    const caches = [mirrorNodeCache, nftCache, hcsCache];
    
    for (const cache of caches) {
      const keys = Array.from((cache as any).cache.keys()) as string[];
      const matchingKeys = keys.filter((key: string) => key.includes(pattern));
      
      for (const key of matchingKeys) {
        cache.delete(key);
        deletedCount++;
      }
    }
    
    logger.info(`Cleared ${deletedCount} cache entries matching pattern: ${pattern}`);
    return deletedCount;
  }

  static logCacheStats(): void {
    const stats = this.getCacheStats();
    logger.info('Cache Statistics:', JSON.stringify(stats));
  }
}
/**
 * Workbook 缓存管理器
 * 缓存已解析的工作簿，避免重复解析
 */

export class WorkbookCache {
  /**
   * @param {number} [maxSize=3] - 最大缓存数量
   */
  constructor(maxSize = 3) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 获取缓存
   * @param {string} fileId - 文件 ID
   * @returns {any|null} 缓存数据或 null
   */
  get(fileId) {
    const entry = this.cache.get(fileId);
    if (entry) {
      entry.lastAccessed = Date.now();
      this.stats.hits++;
      console.log(`[Cache] Hit for ${fileId.substring(0, 30)}...`);
      return entry.data;
    }
    this.stats.misses++;
    return null;
  }

  /**
   * 设置缓存
   * @param {string} fileId - 文件 ID
   * @param {any} data - 缓存数据
   */
  set(fileId, data) {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.cache.set(fileId, {
      data,
      lastAccessed: Date.now()
    });
    console.log(`[Cache] Stored ${fileId.substring(0, 30)}..., size: ${this.cache.size}`);
  }

  /**
   * LRU 淘汰
   * @private
   */
  evictLRU() {
    let oldest = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldest = key;
        oldestTime = entry.lastAccessed;
      }
    }
    if (oldest) {
      console.log(`[Cache] Evicting ${oldest.substring(0, 30)}...`);
      this.cache.delete(oldest);
    }
  }

  /**
   * 获取统计信息
   * @returns {{hits: number, misses: number, hitRate: string}}
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(1) + '%' : 'N/A',
      size: this.cache.size
    };
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 获取缓存大小
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }
}

export default WorkbookCache;

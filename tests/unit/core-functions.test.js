/**
 * 核心功能单元测试
 * 测试 excel.html 中的核心处理函数
 */

// ═══════════════════════════════════════════════════════════════
// 模拟全局 XLSX 对象
// ═══════════════════════════════════════════════════════════════

const mockXLSX = {
  utils: {
    decode_range: (ref) => {
      if (!ref || ref === 'A1') return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      const match = ref.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      if (match) {
        const colToNum = (col) => col.charCodeAt(0) - 65;
        return {
          s: { r: parseInt(match[2]) - 1, c: colToNum(match[1]) },
          e: { r: parseInt(match[4]) - 1, c: colToNum(match[3]) }
        };
      }
      return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    },
    encode_cell: ({ r, c }) => {
      const col = String.fromCharCode(65 + c);
      return `${col}${r + 1}`;
    },
    encode_range: ({ s, e }) => `${mockXLSX.utils.encode_cell(s)}:${mockXLSX.utils.encode_cell(e)}`,
    sheet_to_json: (ws, opts) => {
      if (!ws['!ref']) return [];
      const range = mockXLSX.utils.decode_range(ws['!ref']);
      const result = [];
      for (let r = range.s.r; r <= range.e.r; r++) {
        const row = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = mockXLSX.utils.encode_cell({ r, c });
          row.push(ws[addr]?.v);
        }
        result.push(row);
      }
      return result;
    },
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    aoa_to_sheet: (data) => {
      const ws = {};
      data.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell !== undefined && cell !== null && cell !== '') {
            const addr = mockXLSX.utils.encode_cell({ r, c });
            ws[addr] = { v: cell, t: typeof cell === 'number' ? 'n' : 's' };
          }
        });
      });
      if (data.length > 0) {
        const maxCol = Math.max(...data.map(r => r.length)) - 1;
        ws['!ref'] = `A1:${mockXLSX.utils.encode_cell({ r: data.length - 1, c: maxCol })}`;
      }
      return ws;
    },
    book_append_sheet: (wb, ws, name) => {
      wb.SheetNames.push(name);
      wb.Sheets[name] = ws;
    }
  },
  read: (data, opts) => mockWorkbook,
  write: (wb, opts) => new Uint8Array([1, 2, 3, 4, 5])
};

let mockWorkbook = { SheetNames: [], Sheets: {} };

// ═══════════════════════════════════════════════════════════════
// 被测函数（从 excel.html 提取的核心逻辑）
// ═══════════════════════════════════════════════════════════════

// 深拷贝单元格
function deepCopyCell(cell) {
  if (!cell) return undefined;
  try {
    var copy = JSON.parse(JSON.stringify(cell));
    if (cell.v !== undefined && cell.v !== null && typeof cell.v === 'number' && copy.v === null) {
      copy.v = 0;
    }
    return copy;
  } catch (e) {
    var result = {};
    for (var key in cell) {
      if (cell.hasOwnProperty(key) && typeof cell[key] !== 'function') {
        result[key] = cell[key];
      }
    }
    return result;
  }
}

// 调整范围引用
function adjustRangeReference(rangeStr, rowsToKeep) {
  try {
    var match = rangeStr.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) return rangeStr;
    var startRowNum = parseInt(match[2]) - 1;
    var endRowNum = parseInt(match[4]) - 1;
    var startIdx = rowsToKeep.indexOf(startRowNum);
    var endIdx = rowsToKeep.indexOf(endRowNum);
    if (startIdx === -1 || endIdx === -1) return null;
    return match[1] + (startIdx + 1) + ':' + match[3] + (endIdx + 1);
  } catch (e) {
    return rangeStr;
  }
}

// 验证 Excel 魔术字节
async function validateExcelFileByMagicBytes(file) {
  return new Promise((resolve) => {
    const reader = {
      onload: null,
      onerror: null,
      readAsArrayBuffer: function(blob) {
        setTimeout(() => {
          if (this.onload) {
            // 模拟 XLSX 文件 (PK开头)
            this.onload({ target: { result: new Uint8Array([0x50, 0x4B, 0x03, 0x04]).buffer } });
          }
        }, 0);
      }
    };
    
    reader.onload = function(e) {
      const arr = new Uint8Array(e.target.result);
      if (arr[0] === 0x50 && arr[1] === 0x4B) {
        resolve(true);
        return;
      }
      if (arr[0] === 0xD0 && arr[1] === 0xCF && 
          arr[2] === 0x11 && arr[3] === 0xE0) {
        resolve(true);
        return;
      }
      resolve(false);
    };
    reader.onerror = function() {
      resolve(false);
    };
    reader.readAsArrayBuffer(file);
  });
}

// 工作簿缓存类
class WorkbookCache {
  constructor(maxSize = 3) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.stats = { hits: 0, misses: 0 };
  }
  get(fileId) {
    const entry = this.cache.get(fileId);
    if (entry) {
      entry.lastAccessed = Date.now();
      this.stats.hits++;
      return entry.data;
    }
    this.stats.misses++;
    return null;
  }
  set(fileId, data) {
    if (this.cache.size >= this.maxSize) this.evictLRU();
    this.cache.set(fileId, { data, lastAccessed: Date.now() });
  }
  evictLRU() {
    let oldest = null, oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldest = key;
        oldestTime = entry.lastAccessed;
      }
    }
    if (oldest) this.cache.delete(oldest);
  }
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return { ...this.stats, hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(1) + '%' : 'N/A' };
  }
}

// 文件名处理函数
function sanitizeFileName(fileName, existingNames = []) {
  // 替换非法字符
  let sanitized = fileName.replace(/[<>"/\\|?*]/g, '_');
  // 限制长度
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  // 处理重复
  let finalName = sanitized;
  let counter = 1;
  while (existingNames.includes(finalName)) {
    finalName = `${sanitized}_${String(counter).padStart(2, '0')}`;
    counter++;
  }
  return finalName;
}

// ═══════════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════════

describe('Core Functions Unit Tests', () => {
  
  // ─────────────────────────────────────────────────────────────
  // deepCopyCell
  // ─────────────────────────────────────────────────────────────
  describe('deepCopyCell', () => {
    test('should return undefined for null input', () => {
      expect(deepCopyCell(null)).toBeUndefined();
    });

    test('should return undefined for undefined input', () => {
      expect(deepCopyCell(undefined)).toBeUndefined();
    });

    test('should deep copy cell object', () => {
      const cell = { v: 'test', t: 's', s: { font: { bold: true } } };
      const copy = deepCopyCell(cell);
      expect(copy).toEqual(cell);
      expect(copy).not.toBe(cell);
      expect(copy.s).not.toBe(cell.s);
    });

    test('should handle NaN values', () => {
      const cell = { v: NaN, t: 'n' };
      const copy = deepCopyCell(cell);
      expect(copy.v).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // adjustRangeReference
  // ─────────────────────────────────────────────────────────────
  describe('adjustRangeReference', () => {
    test('should return original for invalid format', () => {
      expect(adjustRangeReference('invalid', [0, 1, 2])).toBe('invalid');
    });

    test('should adjust range with valid rows', () => {
      const result = adjustRangeReference('A1:B5', [0, 2, 4]);
      expect(result).toBe('A1:B3');
    });

    test('should return null if rows not in keep list', () => {
      const result = adjustRangeReference('A10:B20', [0, 1, 2]);
      expect(result).toBeNull();
    });

    test('should handle single cell range', () => {
      const result = adjustRangeReference('A1:A1', [0]);
      expect(result).toBe('A1:A1');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // WorkbookCache
  // ─────────────────────────────────────────────────────────────
  describe('WorkbookCache', () => {
    test('should store and retrieve data', () => {
      const cache = new WorkbookCache();
      const data = { test: 'data' };
      cache.set('file1', data);
      expect(cache.get('file1')).toEqual(data);
    });

    test('should return null for missing data', () => {
      const cache = new WorkbookCache();
      expect(cache.get('missing')).toBeNull();
    });

    test('should evict LRU when full', () => {
      const cache = new WorkbookCache(2);
      cache.set('file1', { data: 1 });
      cache.set('file2', { data: 2 });
      cache.get('file1'); // Access file1 to make it more recent
      cache.set('file3', { data: 3 }); // Should evict file2
      
      expect(cache.get('file1')).not.toBeNull();
      expect(cache.get('file2')).toBeNull();
      expect(cache.get('file3')).not.toBeNull();
    });

    test('should track hit rate', () => {
      const cache = new WorkbookCache();
      cache.set('file1', { data: 1 });
      cache.get('file1'); // hit
      cache.get('file2'); // miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('50.0%');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // sanitizeFileName
  // ─────────────────────────────────────────────────────────────
  describe('sanitizeFileName', () => {
    test('should keep valid file name', () => {
      expect(sanitizeFileName('test.xlsx')).toBe('test.xlsx');
    });

    test('should replace illegal characters', () => {
      expect(sanitizeFileName('test<>.xlsx')).toBe('test__.xlsx');
      expect(sanitizeFileName('test|?*.xlsx')).toBe('test___.xlsx');
    });

    test('should handle duplicates', () => {
      const existing = ['test.xlsx'];
      expect(sanitizeFileName('test.xlsx', existing)).toBe('test_01.xlsx');
    });

    test('should handle multiple duplicates', () => {
      const existing = ['test.xlsx', 'test_01.xlsx', 'test_02.xlsx'];
      expect(sanitizeFileName('test.xlsx', existing)).toBe('test_03.xlsx');
    });

    test('should truncate long names', () => {
      const longName = 'a'.repeat(150) + '.xlsx';
      expect(sanitizeFileName(longName).length).toBeLessThanOrEqual(100);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 导出供浏览器使用
// ═══════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    deepCopyCell,
    adjustRangeReference,
    WorkbookCache,
    sanitizeFileName
  };
}

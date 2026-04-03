/**
 * Excel 工具函数单元测试
 * 测试 src/utils/excel-utils.js 中的核心函数
 */

import {
  getWorkbookSheetCount,
  isWorksheetEffectivelyEmpty,
  validateHeaderConsistency,
  deepCopyCell,
  cloneWorksheet,
  parseExcelFile,
  convertWorkbookToXlsxFormat,
  getSheetStructureSignature,
  getMaxColumnCount,
  downloadWorkbook
} from '../../src/utils/excel-utils.js';

import { XLSX_READ_OPTIONS, XLSX_WRITE_OPTIONS } from '../../src/core/constants.js';

// ═══════════════════════════════════════════════════════════════
// 测试工具函数
// ═══════════════════════════════════════════════════════════════

function createMockWorkbook(sheetNames = ['Sheet1']) {
  return {
    SheetNames: sheetNames,
    Sheets: sheetNames.reduce((acc, name) => {
      acc[name] = createMockWorksheet();
      return acc;
    }, {})
  };
}

function createMockWorksheet(data = [['A', 'B'], [1, 2]]) {
  const ws = {};
  data.forEach((row, r) => {
    row.forEach((cell, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = { v: cell, t: typeof cell === 'number' ? 'n' : 's' };
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: data.length - 1, c: data[0].length - 1 }
  });
  return ws;
}

function createEmptyWorksheet() {
  return { '!ref': undefined };
}

// ═══════════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════════

describe('Excel Utils Unit Tests', () => {
  
  // ─────────────────────────────────────────────────────────────
  // getWorkbookSheetCount
  // ─────────────────────────────────────────────────────────────
  describe('getWorkbookSheetCount', () => {
    test('should return 0 for null workbook', () => {
      expect(getWorkbookSheetCount(null)).toBe(0);
    });

    test('should return 0 for undefined workbook', () => {
      expect(getWorkbookSheetCount(undefined)).toBe(0);
    });

    test('should return 0 for workbook without SheetNames', () => {
      expect(getWorkbookSheetCount({})).toBe(0);
    });

    test('should return correct count for single sheet', () => {
      const wb = createMockWorkbook(['Sheet1']);
      expect(getWorkbookSheetCount(wb)).toBe(1);
    });

    test('should return correct count for multiple sheets', () => {
      const wb = createMockWorkbook(['Sheet1', 'Sheet2', 'Sheet3']);
      expect(getWorkbookSheetCount(wb)).toBe(3);
    });

    test('should return 0 for empty SheetNames array', () => {
      const wb = createMockWorkbook([]);
      expect(getWorkbookSheetCount(wb)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // isWorksheetEffectivelyEmpty
  // ─────────────────────────────────────────────────────────────
  describe('isWorksheetEffectivelyEmpty', () => {
    test('should return true for null worksheet', () => {
      expect(isWorksheetEffectivelyEmpty(null)).toBe(true);
    });

    test('should return true for undefined worksheet', () => {
      expect(isWorksheetEffectivelyEmpty(undefined)).toBe(true);
    });

    test('should return true for worksheet without !ref', () => {
      expect(isWorksheetEffectivelyEmpty({})).toBe(true);
    });

    test('should return true for empty worksheet', () => {
      const ws = createEmptyWorksheet();
      expect(isWorksheetEffectivelyEmpty(ws)).toBe(true);
    });

    test('should return false for worksheet with data', () => {
      const ws = createMockWorksheet([['A', 'B'], [1, 2]]);
      expect(isWorksheetEffectivelyEmpty(ws)).toBe(false);
    });

    test('should return true for worksheet with only empty strings', () => {
      const ws = createMockWorksheet([['', ''], ['', '']]);
      expect(isWorksheetEffectivelyEmpty(ws)).toBe(true);
    });

    test('should return true for worksheet with only null values', () => {
      const ws = createMockWorksheet([[null, null], [null, null]]);
      expect(isWorksheetEffectivelyEmpty(ws)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // validateHeaderConsistency
  // ─────────────────────────────────────────────────────────────
  describe('validateHeaderConsistency', () => {
    test('should return empty array for identical headers', () => {
      const baseline = [['Name', 'Age'], ['姓名', '年龄']];
      const current = [['Name', 'Age'], ['姓名', '年龄']];
      expect(validateHeaderConsistency(baseline, current, 2)).toEqual([]);
    });

    test('should detect length mismatch', () => {
      const baseline = [['Name', 'Age', 'Gender']];
      const current = [['Name', 'Age']];
      const result = validateHeaderConsistency(baseline, current, 1);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('length');
    });

    test('should detect content mismatch', () => {
      const baseline = [['Name', 'Age']];
      const current = [['Name', 'Gender']];
      const result = validateHeaderConsistency(baseline, current, 1);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('content');
      expect(result[0].expected).toBe('Age');
      expect(result[0].actual).toBe('Gender');
    });

    test('should handle empty header rows', () => {
      expect(validateHeaderConsistency([], [], 0)).toEqual([]);
    });

    test('should detect multiple mismatches', () => {
      const baseline = [['A', 'B', 'C'], ['D', 'E', 'F']];
      const current = [['A', 'X', 'C'], ['D', 'Y', 'F']];
      const result = validateHeaderConsistency(baseline, current, 2);
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // deepCopyCell
  // ─────────────────────────────────────────────────────────────
  describe('deepCopyCell', () => {
    test('should return undefined for null cell', () => {
      expect(deepCopyCell(null)).toBeNull();
    });

    test('should return undefined for undefined cell', () => {
      expect(deepCopyCell(undefined)).toBeUndefined();
    });

    test('should return primitive value as-is', () => {
      expect(deepCopyCell('test')).toBe('test');
      expect(deepCopyCell(123)).toBe(123);
    });

    test('should create a copy of cell object', () => {
      const cell = { v: 'test', t: 's', s: { font: { bold: true } } };
      const copy = deepCopyCell(cell);
      expect(copy).toEqual(cell);
      expect(copy).not.toBe(cell);
    });

    test('should handle cell with array value', () => {
      const cell = { v: [1, 2, 3], t: 'a' };
      const copy = deepCopyCell(cell);
      expect(copy.v).toEqual([1, 2, 3]);
      expect(copy.v).not.toBe(cell.v);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getMaxColumnCount
  // ─────────────────────────────────────────────────────────────
  describe('getMaxColumnCount', () => {
    test('should return 0 for empty array', () => {
      expect(getMaxColumnCount([])).toBe(0);
    });

    test('should return correct max for uniform rows', () => {
      const rows = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
      expect(getMaxColumnCount(rows)).toBe(3);
    });

    test('should return correct max for varying row lengths', () => {
      const rows = [[1], [1, 2], [1, 2, 3, 4]];
      expect(getMaxColumnCount(rows)).toBe(4);
    });

    test('should handle non-array row elements', () => {
      const rows = [[1, 2], null, [1, 2, 3]];
      expect(getMaxColumnCount(rows)).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getSheetStructureSignature
  // ─────────────────────────────────────────────────────────────
  describe('getSheetStructureSignature', () => {
    test('should generate consistent signature for same data', () => {
      const rows = [['A', 'B'], ['C', 'D']];
      const sig1 = getSheetStructureSignature(rows, 1);
      const sig2 = getSheetStructureSignature(rows, 1);
      expect(sig1).toBe(sig2);
    });

    test('should generate different signatures for different data', () => {
      const rows1 = [['A', 'B']];
      const rows2 = [['A', 'C']];
      const sig1 = getSheetStructureSignature(rows1, 1);
      const sig2 = getSheetStructureSignature(rows2, 1);
      expect(sig1).not.toBe(sig2);
    });

    test('should handle zero header rows', () => {
      const rows = [['A', 'B']];
      const sig = getSheetStructureSignature(rows, 0);
      expect(sig).toBe('{"headerRows":0}');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // convertWorkbookToXlsxFormat
  // ─────────────────────────────────────────────────────────────
  describe('convertWorkbookToXlsxFormat', () => {
    test('should preserve sheet names', () => {
      const wb = createMockWorkbook(['Sheet1', 'Sheet2']);
      const converted = convertWorkbookToXlsxFormat(wb);
      expect(converted.SheetNames).toEqual(['Sheet1', 'Sheet2']);
    });

    test('should create new Sheets object', () => {
      const wb = createMockWorkbook(['Sheet1']);
      const converted = convertWorkbookToXlsxFormat(wb);
      expect(converted.Sheets).toBeDefined();
      expect(converted.Sheets).not.toBe(wb.Sheets);
    });

    test('should copy worksheet data', () => {
      const wb = createMockWorkbook(['Sheet1']);
      const converted = convertWorkbookToXlsxFormat(wb);
      expect(converted.Sheets['Sheet1']['!ref']).toBe(wb.Sheets['Sheet1']['!ref']);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 运行测试
// ═══════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  window.runExcelUtilsTests = () => {
    console.log('Running Excel Utils Tests...');
    // 测试将在浏览器环境中通过 Jest 或类似框架运行
  };
}

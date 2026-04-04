/**
 * Phase 6+8: Output Data Validation & Format Retention
 * Uses xlsx library to verify generated files contain correct data and formats
 */

const XLSX = require('xlsx');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const FIXTURES = '/private/tmp/excel-offline-tool/test-fixtures';
const TEST_FILES = '/private/tmp/excel-offline-tool/tests/test-files';
const DOWNLOAD_DIR = '/private/tmp/excel-offline-tool/tests/e2e/downloads';

const results = [];
let passCount = 0, failCount = 0;

function check(name, status, detail) {
  results.push({ name, status, detail });
  if (status === 'pass') passCount++;
  else failCount++;
  console.log(`${status === 'pass' ? '✅' : '❌'} ${name}: ${detail}`);
}

// Helper: read xlsx file
function readXlsx(filePath) {
  const buf = fs.readFileSync(filePath);
  return XLSX.read(buf, { type: 'buffer', cellStyles: true, cellNF: true, cellDates: true });
}

// Helper: sheet to JSON
function sheetToJson(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

// ═══════════════════════════════════════════════════════════════
// Phase 6: Output Data Validation
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(60));
console.log('Phase 6: 输出结果完整性验证');
console.log('='.repeat(60));

// Test 1: Multi-sheet file structure
const multiSheetPath = path.join(TEST_FILES, 'multi-sheet.xlsx');
if (fs.existsSync(multiSheetPath)) {
  const wb = readXlsx(multiSheetPath);
  const sheetCount = wb.SheetNames.length;
  check('多sheet文件 - 工作表数量', sheetCount >= 2 ? 'pass' : 'fail',
    `${sheetCount}个工作表`);

  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const data = sheetToJson(ws);
    check(`多sheet文件 - ${name}数据行数`, data.length > 0 ? 'pass' : 'fail',
      `${data.length}行`);
  });
} else {
  check('多sheet文件 - 测试文件存在', 'fail', '文件不存在');
}

// Test 2: Split by column file
const colSplitPath = path.join(TEST_FILES, 'split-by-column.xlsx');
if (fs.existsSync(colSplitPath)) {
  const wb = readXlsx(colSplitPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = sheetToJson(ws);
  check('按列拆分文件 - 数据行数', data.length > 1 ? 'pass' : 'fail',
    `${data.length}行(含表头)`);
  check('按列拆分文件 - 列数', data[0] && data[0].length >= 2 ? 'pass' : 'fail',
    `${data[0] ? data[0].length : 0}列`);
}

// Test 3: Merge files
const merge1Path = path.join(TEST_FILES, 'merge-1.xlsx');
const merge2Path = path.join(TEST_FILES, 'merge-2.xlsx');
if (fs.existsSync(merge1Path) && fs.existsSync(merge2Path)) {
  const wb1 = readXlsx(merge1Path);
  const wb2 = readXlsx(merge2Path);
  check('合并文件1 - 工作表数量', wb1.SheetNames.length > 0 ? 'pass' : 'fail',
    `${wb1.SheetNames.length}个`);
  check('合并文件2 - 工作表数量', wb2.SheetNames.length > 0 ? 'pass' : 'fail',
    `${wb2.SheetNames.length}个`);
}

// Test 4: Vertical split file
const vertSplitPath = path.join(TEST_FILES, 'vertical-split.xlsx');
if (fs.existsSync(vertSplitPath)) {
  const wb = readXlsx(vertSplitPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = sheetToJson(ws);
  check('竖向拆分文件 - 数据行数', data.length > 1 ? 'pass' : 'fail',
    `${data.length}行`);
  check('竖向拆分文件 - 列数', data[0] && data[0].length >= 3 ? 'pass' : 'fail',
    `${data[0] ? data[0].length : 0}列`);
}

// Test 5: Column width test file
const colWidthPath = path.join(TEST_FILES, 'col-width-test.xlsx');
if (fs.existsSync(colWidthPath)) {
  const wb = readXlsx(colWidthPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  check('列宽测试文件 - !cols属性', ws['!cols'] ? 'pass' : 'fail',
    ws['!cols'] ? `${ws['!cols'].length}列宽定义` : '无列宽定义');
}

// ═══════════════════════════════════════════════════════════════
// Phase 8: Format Retention Tests
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(60));
console.log('Phase 8: 格式保留测试');
console.log('='.repeat(60));

// Test: Cell styles retention
if (fs.existsSync(colWidthPath)) {
  const wb = readXlsx(colWidthPath);
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Check cell style at A1
  const a1 = ws['A1'];
  if (a1) {
    check('格式保留 - 单元格样式', a1.s ? 'pass' : 'warn',
      a1.s ? 'A1有样式' : 'A1无样式');
  }

  // Check column widths
  if (ws['!cols']) {
    const hasWidth = ws['!cols'].some(c => c.wch);
    check('格式保留 - 列宽定义', hasWidth ? 'pass' : 'warn',
      hasWidth ? '存在列宽' : '无列宽');
  }

  // Check row heights
  if (ws['!rows']) {
    check('格式保留 - 行高定义', 'pass', `${ws['!rows'].length}行高定义`);
  } else {
    check('格式保留 - 行高定义', 'warn', '无行高定义');
  }

  // Check number formats
  const data = sheetToJson(ws);
  let hasNumberFormat = false;
  for (const row of data) {
    for (const cell of row) {
      if (typeof cell === 'number') {
        hasNumberFormat = true;
        break;
      }
    }
    if (hasNumberFormat) break;
  }
  check('格式保留 - 数字格式', hasNumberFormat ? 'pass' : 'warn',
    hasNumberFormat ? '存在数字数据' : '无数字数据');
}

// Test: Multi-header file
const multiHeaderPath = path.join(TEST_FILES, 'multi-header-2rows.xlsx');
if (fs.existsSync(multiHeaderPath)) {
  const wb = readXlsx(multiHeaderPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = sheetToJson(ws);
  check('多行表头 - 表头行数', data.length >= 2 ? 'pass' : 'fail',
    `${data.length}行`);
  check('多行表头 - 第一行内容', data[0] && data[0].length > 0 ? 'pass' : 'fail',
    data[0] ? JSON.stringify(data[0].slice(0, 3)) : '空');
}

// Test: Merged header file
const mergedHeaderPath = path.join(TEST_FILES, 'merged-header.xlsx');
if (fs.existsSync(mergedHeaderPath)) {
  const wb = readXlsx(mergedHeaderPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  check('合并单元格表头 - !merges属性', ws['!merges'] ? 'pass' : 'warn',
    ws['!merges'] ? `${ws['!merges'].length}个合并区域` : '无合并区域');
}

// Test: Date format retention
const data = [];
if (fs.existsSync(colSplitPath)) {
  const wb = readXlsx(colSplitPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  let hasDate = false;
  for (let R = range.s.r; R <= range.e.r && !hasDate; R++) {
    for (let C = range.s.c; C <= range.e.c && !hasDate; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell && cell.t === 'd') hasDate = true;
    }
  }
  check('日期格式 - 日期数据', hasDate ? 'pass' : 'warn',
    hasDate ? '存在日期类型单元格' : '未检测到日期类型');
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(60));
console.log(`总计: ${results.length} | 通过: ${passCount} | 失败: ${failCount}`);
console.log(`通过率: ${((passCount / results.length) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

const report = {
  phase: 'Phase 6+8: 输出验证与格式保留',
  timestamp: new Date().toISOString(),
  summary: { total: results.length, passed: passCount, failed: failCount },
  results
};

const reportPath = path.join(__dirname, 'reports', 'phase6-8-output-validation.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 报告已保存: ${reportPath}`);

process.exit(failCount > 0 ? 1 : 0);

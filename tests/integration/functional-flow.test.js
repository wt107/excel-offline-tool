/**
 * 集成测试 - 功能流程测试
 * 测试完整的功能流程和数据流
 */

// ═══════════════════════════════════════════════════════════════
// 集成测试配置
// ═══════════════════════════════════════════════════════════════

const TEST_CONFIG = {
  fixturesDir: '../fixtures',
  outputDir: '../outputs',
  timeouts: {
    short: 1000,
    medium: 5000,
    long: 30000
  }
};

// ═══════════════════════════════════════════════════════════════
// 模拟数据和工具
// ═══════════════════════════════════════════════════════════════

// 创建测试工作簿
function createTestWorkbook(sheets) {
  const workbook = {
    SheetNames: [],
    Sheets: {}
  };
  
  sheets.forEach(({ name, data }) => {
    workbook.SheetNames.push(name);
    workbook.Sheets[name] = createTestWorksheet(data);
  });
  
  return workbook;
}

function createTestWorksheet(data) {
  const ws = {};
  data.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell !== undefined && cell !== null && cell !== '') {
        const addr = encodeCell(r, c);
        ws[addr] = { v: cell, t: typeof cell === 'number' ? 'n' : 's' };
      }
    });
  });
  
  if (data.length > 0) {
    const maxCol = Math.max(...data.map(r => r.length)) - 1;
    ws['!ref'] = `A1:${encodeCell(data.length - 1, maxCol)}`;
  }
  
  // 添加列宽信息
  ws['!cols'] = data[0]?.map(() => ({ wch: 10 })) || [];
  
  return ws;
}

function encodeCell(r, c) {
  const col = String.fromCharCode(65 + c);
  return `${col}${r + 1}`;
}

// ═══════════════════════════════════════════════════════════════
// 核心功能模拟
// ═══════════════════════════════════════════════════════════════

// 模拟工作表拆分功能
function splitBySheets(workbook, selectedSheets) {
  const results = [];
  const usedNames = [];
  
  selectedSheets.forEach(sheetName => {
    const newWb = {
      SheetNames: [sheetName],
      Sheets: { [sheetName]: deepCopyWorksheet(workbook.Sheets[sheetName]) }
    };
    
    let fileName = sanitizeFileName(`${workbook.fileName}_${sheetName}.xlsx`, usedNames);
    usedNames.push(fileName);
    
    results.push({
      name: fileName,
      sheetName: sheetName,
      workbook: newWb
    });
  });
  
  return results;
}

// 模拟横向列拆分功能
function splitByColumnHorizontal(worksheet, splitColumn, headerRows = 1) {
  const jsonData = worksheetToJson(worksheet);
  const headers = jsonData.slice(0, headerRows);
  const dataRows = jsonData.slice(headerRows);
  
  // 按列值分组
  const groups = {};
  dataRows.forEach(row => {
    const value = row[splitColumn];
    const key = (value !== undefined && value !== null && String(value).trim() !== '')
      ? String(value)
      : '[空值]';
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  
  // 生成结果文件
  const results = [];
  const usedNames = [];
  
  Object.keys(groups).forEach(key => {
    const sheetData = [...headers, ...groups[key]];
    const newWs = jsonToWorksheet(sheetData);
    const newWb = {
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: newWs }
    };
    
    let fileName = sanitizeFileName(`split_${key}.xlsx`, usedNames);
    usedNames.push(fileName);
    
    results.push({
      name: fileName,
      groupKey: key,
      rowCount: groups[key].length,
      workbook: newWb
    });
  });
  
  return {
    results,
    totalGroups: Object.keys(groups).length,
    totalRows: dataRows.length
  };
}

// 模拟竖向列拆分功能
function splitByColumnVertical(worksheet, keyColumns, dataColumns, headerRows = 1) {
  const jsonData = worksheetToJson(worksheet);
  const headers = jsonData.slice(0, headerRows);
  const dataRows = jsonData.slice(headerRows);
  const results = [];
  const usedNames = [];
  
  dataColumns.forEach(dataCol => {
    const sheetData = headers.map(header => {
      const newRow = [];
      keyColumns.forEach(kc => newRow.push(header[kc]));
      newRow.push(header[dataCol]);
      return newRow;
    });
    
    dataRows.forEach(row => {
      const newRow = [];
      keyColumns.forEach(kc => newRow.push(row[kc]));
      newRow.push(row[dataCol]);
      sheetData.push(newRow);
    });
    
    const newWs = jsonToWorksheet(sheetData);
    const colHeader = headers[0]?.[dataCol] || `列${dataCol + 1}`;
    
    let fileName = sanitizeFileName(`split_${colHeader}.xlsx`, usedNames);
    usedNames.push(fileName);
    
    results.push({
      name: fileName,
      columnName: colHeader,
      workbook: { SheetNames: ['Sheet1'], Sheets: { Sheet1: newWs } }
    });
  });
  
  return results;
}

// 模拟多文件合并功能
function mergeFiles(files, selectedSheets) {
  const mergedWb = {
    SheetNames: [],
    Sheets: {}
  };
  
  const usedNames = [];
  
  selectedSheets.forEach(key => {
    const [fileIndex, sheetName] = parseSelectionKey(key);
    const file = files[fileIndex];
    const worksheet = file.workbook.Sheets[sheetName];
    
    let uniqueName = getUniqueSheetName(usedNames, `${file.name}-${sheetName}`);
    usedNames.push(uniqueName);
    
    mergedWb.SheetNames.push(uniqueName);
    mergedWb.Sheets[uniqueName] = deepCopyWorksheet(worksheet);
  });
  
  return mergedWb;
}

// 模拟工作表数据合并功能
function mergeSheetData(files, selectedSheets, headerRows = 1) {
  let mergedData = [];
  let baselineHeaders = null;
  let firstSheet = true;
  
  selectedSheets.forEach(key => {
    const [fileIndex, sheetName] = parseSelectionKey(key);
    const file = files[fileIndex];
    const ws = file.workbook.Sheets[sheetName];
    const jsonData = worksheetToJson(ws);
    
    if (firstSheet) {
      baselineHeaders = jsonData.slice(0, headerRows);
      const headerRowsWithSource = jsonData.slice(0, headerRows).map((row, idx) => 
        idx === 0 ? ['来源文件', ...row] : ['', ...row]
      );
      const dataRowsWithSource = jsonData.slice(headerRows).map(row => 
        [`${file.name}-${sheetName}`, ...row]
      );
      mergedData = [...headerRowsWithSource, ...dataRowsWithSource];
      firstSheet = false;
    } else {
      // 验证表头一致性
      const currentHeaders = jsonData.slice(0, headerRows);
      if (!headersEqual(baselineHeaders, currentHeaders)) {
        throw new Error(`表头不一致: ${sheetName}`);
      }
      
      jsonData.slice(headerRows).forEach(row => {
        mergedData.push([`${file.name}-${sheetName}`, ...row]);
      });
    }
  });
  
  return {
    SheetNames: ['合并结果'],
    Sheets: { '合并结果': jsonToWorksheet(mergedData) }
  };
}

// 辅助函数
function deepCopyWorksheet(ws) {
  const newWs = {};
  for (const key in ws) {
    if (ws.hasOwnProperty(key)) {
      newWs[key] = JSON.parse(JSON.stringify(ws[key]));
    }
  }
  return newWs;
}

function worksheetToJson(ws) {
  if (!ws['!ref']) return [];
  const range = decodeRange(ws['!ref']);
  const result = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = encodeCell(r, c);
      row.push(ws[addr]?.v);
    }
    result.push(row);
  }
  return result;
}

function jsonToWorksheet(data) {
  const ws = {};
  data.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell !== undefined && cell !== null) {
        ws[encodeCell(r, c)] = { v: cell, t: typeof cell === 'string' && cell === '' ? 's' : typeof cell === 'number' ? 'n' : 's' };
      }
    });
  });
  if (data.length > 0) {
    const maxCol = Math.max(...data.map(r => r.length)) - 1;
    ws['!ref'] = `A1:${encodeCell(data.length - 1, maxCol)}`;
  }
  return ws;
}

function decodeRange(ref) {
  const match = ref.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
  if (!match) return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  return {
    s: { r: parseInt(match[2]) - 1, c: match[1].charCodeAt(0) - 65 },
    e: { r: parseInt(match[4]) - 1, c: match[3].charCodeAt(0) - 65 }
  };
}

function sanitizeFileName(name, usedNames) {
  let sanitized = name.replace(/[<>"/\\|?*]/g, '_');
  if (sanitized.length > 100) sanitized = sanitized.substring(0, 100);
  
  let final = sanitized;
  let counter = 1;
  while (usedNames.includes(final)) {
    final = `${sanitized}_${String(counter).padStart(2, '0')}`;
    counter++;
  }
  return final;
}

function getUniqueSheetName(existing, desired) {
  if (!existing.includes(desired)) return desired;
  let counter = 1;
  let name = `${desired}_01`;
  while (existing.includes(name)) {
    counter++;
    name = `${desired}_${String(counter).padStart(2, '0')}`;
  }
  return name;
}

function parseSelectionKey(key) {
  const separator = '::';
  const idx = key.indexOf(separator);
  return [
    parseInt(key.slice(0, idx)),
    decodeURIComponent(key.slice(idx + separator.length))
  ];
}

function headersEqual(h1, h2) {
  if (h1.length !== h2.length) return false;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i].length !== h2[i].length) return false;
    for (let j = 0; j < h1[i].length; j++) {
      if (String(h1[i][j] || '') !== String(h2[i][j] || '')) return false;
    }
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════════

describe('集成测试 - 功能流程', () => {
  
  // ─────────────────────────────────────────────────────────────
  // 工作表拆分流程
  // ─────────────────────────────────────────────────────────────
  describe('按工作表拆分流程', () => {
    test('应正确拆分多工作表文件', () => {
      const workbook = createTestWorkbook([
        { name: 'Sheet1', data: [['A', 'B'], [1, 2]] },
        { name: 'Sheet2', data: [['C', 'D'], [3, 4]] },
        { name: 'Sheet3', data: [['E', 'F'], [5, 6]] }
      ]);
      workbook.fileName = 'test';
      
      const results = splitBySheets(workbook, ['Sheet1', 'Sheet2', 'Sheet3']);
      
      expect(results).toHaveLength(3);
      expect(results[0].sheetName).toBe('Sheet1');
      expect(results[1].sheetName).toBe('Sheet2');
      expect(results[2].sheetName).toBe('Sheet3');
    });

    test('应处理重名工作表', () => {
      const workbook = createTestWorkbook([
        { name: 'Sheet1', data: [['A']] },
        { name: 'Sheet1', data: [['B']] }
      ]);
      workbook.fileName = 'test';
      
      const results = splitBySheets(workbook, ['Sheet1']);
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toContain('test');
    });

    test('空工作表应被跳过', () => {
      const workbook = createTestWorkbook([
        { name: 'Sheet1', data: [['A', 'B'], [1, 2]] },
        { name: 'EmptySheet', data: [] }
      ]);
      workbook.fileName = 'test';
      
      const results = splitBySheets(workbook, ['Sheet1']);
      
      expect(results).toHaveLength(1);
      expect(results[0].sheetName).toBe('Sheet1');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 横向列拆分流程
  // ─────────────────────────────────────────────────────────────
  describe('按列拆分（横向）流程', () => {
    test('应按列值正确分组', () => {
      const ws = createTestWorksheet([
        ['部门', '姓名', '销售额'],
        ['销售部', '张三', 100],
        ['技术部', '李四', 200],
        ['销售部', '王五', 150],
        ['技术部', '赵六', 300]
      ]);
      
      const result = splitByColumnHorizontal(ws, 0, 1); // 按第一列（部门）拆分
      
      expect(result.totalGroups).toBe(2);
      expect(result.totalRows).toBe(4);
      expect(result.results).toHaveLength(2);
      
      const salesGroup = result.results.find(r => r.groupKey === '销售部');
      const techGroup = result.results.find(r => r.groupKey === '技术部');
      
      expect(salesGroup.rowCount).toBe(2);
      expect(techGroup.rowCount).toBe(2);
    });

    test('应将空值归类到[空值]组', () => {
      const ws = createTestWorksheet([
        ['部门', '姓名'],
        ['销售部', '张三'],
        ['', '李四'],
        [null, '王五'],
        [undefined, '赵六']
      ]);
      
      const result = splitByColumnHorizontal(ws, 0, 1);
      
      const emptyGroup = result.results.find(r => r.groupKey === '[空值]');
      expect(emptyGroup).toBeDefined();
      expect(emptyGroup.rowCount).toBe(3);
    });

    test('应保留多行表头', () => {
      const ws = createTestWorksheet([
        ['部门', '部门', '姓名', '销售额'],
        ['Dept', 'Type', 'Name', 'Amount'],
        ['销售部', 'A', '张三', 100]
      ]);
      
      const result = splitByColumnHorizontal(ws, 0, 2);
      
      expect(result.results[0].workbook.Sheets.Sheet1['A1'].v).toBe('部门');
      expect(result.results[0].workbook.Sheets.Sheet1['A2'].v).toBe('Dept');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 竖向列拆分流程
  // ─────────────────────────────────────────────────────────────
  describe('按列拆分（竖向）流程', () => {
    test('应为每个数据列生成独立文件', () => {
      const ws = createTestWorksheet([
        ['姓名', '1月销量', '2月销量', '3月销量'],
        ['张三', 100, 120, 130],
        ['李四', 80, 90, 100]
      ]);
      
      const results = splitByColumnVertical(ws, [0], [1, 2, 3], 1);
      
      expect(results).toHaveLength(3);
      expect(results[0].columnName).toBe('1月销量');
      expect(results[1].columnName).toBe('2月销量');
      expect(results[2].columnName).toBe('3月销量');
    });

    test('每个文件应包含固定列和对应数据列', () => {
      const ws = createTestWorksheet([
        ['姓名', '部门', '1月销量', '2月销量'],
        ['张三', '销售', 100, 120],
        ['李四', '技术', 80, 90]
      ]);
      
      const results = splitByColumnVertical(ws, [0, 1], [2, 3], 1);
      
      // 检查第一个结果文件的数据结构
      const firstResult = results[0];
      const sheetData = worksheetToJson(firstResult.workbook.Sheets.Sheet1);
      
      // 应有3列：姓名、部门、1月销量
      expect(sheetData[0]).toHaveLength(3);
      expect(sheetData[0][0]).toBe('姓名');
      expect(sheetData[0][1]).toBe('部门');
      expect(sheetData[0][2]).toBe('1月销量');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 多文件合并流程
  // ─────────────────────────────────────────────────────────────
  describe('多文件合并流程', () => {
    test('应合并多个文件的工作表', () => {
      const files = [
        {
          name: 'file1.xlsx',
          workbook: createTestWorkbook([
            { name: 'Sheet1', data: [['A', 'B'], [1, 2]] },
            { name: 'Sheet2', data: [['C', 'D'], [3, 4]] }
          ])
        },
        {
          name: 'file2.xlsx',
          workbook: createTestWorkbook([
            { name: 'Sheet1', data: [['E', 'F'], [5, 6]] }
          ])
        }
      ];
      
      const selectedSheets = [
        '0::Sheet1',
        '0::Sheet2',
        '1::Sheet1'
      ];
      
      const merged = mergeFiles(files, selectedSheets);
      
      expect(merged.SheetNames).toHaveLength(3);
    });

    test('应处理同名工作表', () => {
      const files = [
        { name: 'file1.xlsx', workbook: createTestWorkbook([{ name: 'Sheet1', data: [['A']] }]) },
        { name: 'file2.xlsx', workbook: createTestWorkbook([{ name: 'Sheet1', data: [['B']] }]) }
      ];
      
      const selectedSheets = ['0::Sheet1', '1::Sheet1'];
      const merged = mergeFiles(files, selectedSheets);
      
      expect(merged.SheetNames[0]).toBe('file1.xlsx-Sheet1');
      expect(merged.SheetNames[1]).toBe('file2.xlsx-Sheet1');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 工作表数据合并流程
  // ─────────────────────────────────────────────────────────────
  describe('工作表数据合并流程', () => {
    test('应合并多个工作表的数据', () => {
      const files = [
        {
          name: 'file1.xlsx',
          workbook: createTestWorkbook([{
            name: 'Sheet1',
            data: [['姓名', '销售额'], ['张三', 100], ['李四', 200]]
          }])
        },
        {
          name: 'file2.xlsx',
          workbook: createTestWorkbook([{
            name: 'Sheet1',
            data: [['姓名', '销售额'], ['王五', 150]]
          }])
        }
      ];
      
      const selectedSheets = ['0::Sheet1', '1::Sheet1'];
      const merged = mergeSheetData(files, selectedSheets, 1);
      
      const sheetData = worksheetToJson(merged.Sheets['合并结果']);
      
      // 应有表头 + 3 行数据 + 来源列
      expect(sheetData).toHaveLength(4);
      expect(sheetData[0][0]).toBe('来源文件');
    });

    test('不一致的表头应报错', () => {
      const files = [
        {
          name: 'file1.xlsx',
          workbook: createTestWorkbook([{
            name: 'Sheet1',
            data: [['姓名', '销售额']]
          }])
        },
        {
          name: 'file2.xlsx',
          workbook: createTestWorkbook([{
            name: 'Sheet1',
            data: [['姓名', '金额']] // 不同的列名
          }])
        }
      ];
      
      expect(() => {
        mergeSheetData(files, ['0::Sheet1', '1::Sheet1'], 1);
      }).toThrow('表头不一致');
    });

    test('应保留多行表头', () => {
      const files = [
        {
          name: 'file1.xlsx',
          workbook: createTestWorkbook([{
            name: 'Sheet1',
            data: [
              ['部门', '部门', '销售额'],
              ['Dept', 'Type', 'Amount'],
              ['销售', 'A', 100]
            ]
          }])
        }
      ];
      
      const merged = mergeSheetData(files, ['0::Sheet1'], 2);
      const sheetData = worksheetToJson(merged.Sheets['合并结果']);
      
      expect(sheetData[0][0]).toBe('来源文件');
      expect(sheetData[1][0]).toBe(''); // 第二行表头的来源列应为空
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 边界情况测试
  // ─────────────────────────────────────────────────────────────
  describe('边界情况处理', () => {
    test('空文件应正确处理', () => {
      const workbook = createTestWorkbook([{ name: 'Sheet1', data: [] }]);
      workbook.fileName = 'empty';
      
      const results = splitBySheets(workbook, ['Sheet1']);
      
      expect(results).toHaveLength(1);
    });

    test('单列数据应正确处理', () => {
      const ws = createTestWorksheet([['A'], [1], [2], [3]]);
      const result = splitByColumnHorizontal(ws, 0, 1);
      
      expect(result.results).toHaveLength(3);
    });

    test('单行数据应正确处理', () => {
      const ws = createTestWorksheet([['A', 'B', 'C']]);
      const result = splitByColumnHorizontal(ws, 0, 1);
      
      expect(result.totalRows).toBe(0);
    });

    test('特殊字符文件名应正确处理', () => {
      const workbook = createTestWorkbook([{ name: 'Sheet<1>', data: [['A']] }]);
      workbook.fileName = 'test';
      
      const results = splitBySheets(workbook, ['Sheet<1>']);
      
      expect(results[0].name).not.toContain('<');
      expect(results[0].name).not.toContain('>');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════

module.exports = {
  createTestWorkbook,
  createTestWorksheet,
  splitBySheets,
  splitByColumnHorizontal,
  splitByColumnVertical,
  mergeFiles,
  mergeSheetData
};

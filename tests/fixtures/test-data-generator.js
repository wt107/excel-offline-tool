/**
 * 测试数据生成器
 * 生成各种测试用的 Excel 数据
 */

// ═══════════════════════════════════════════════════════════════
// 测试数据模板
// ═══════════════════════════════════════════════════════════════

const TestDataTemplates = {
  // 标准销售数据
  salesData: {
    headers: ['部门', '姓名', '月份', '销售额', '提成'],
    rows: [
      ['销售部', '张三', '1月', 15000, 1500],
      ['销售部', '李四', '1月', 20000, 2000],
      ['技术部', '王五', '1月', 0, 0],
      ['技术部', '赵六', '1月', 0, 0],
      ['销售部', '张三', '2月', 18000, 1800],
      ['销售部', '李四', '2月', 22000, 2200],
      ['技术部', '王五', '2月', 0, 0],
      ['技术部', '赵六', '2月', 0, 0],
    ]
  },

  // 员工信息数据
  employeeData: {
    headers: ['工号', '姓名', '部门', '职位', '入职日期', '薪资'],
    rows: [
      ['E001', '张三', '销售部', '销售经理', '2020-01-15', 15000],
      ['E002', '李四', '销售部', '销售代表', '2021-03-20', 8000],
      ['E003', '王五', '技术部', '高级工程师', '2019-06-10', 20000],
      ['E004', '赵六', '技术部', '工程师', '2022-01-05', 12000],
      ['E005', '孙七', '人事部', 'HR经理', '2018-09-01', 18000],
    ]
  },

  // 多行表头数据
  multiHeaderData: {
    headers: [
      ['', '', '第一季度', '第一季度', '第二季度', '第二季度'],
      ['部门', '姓名', '1月', '2月', '4月', '5月']
    ],
    rows: [
      ['销售部', '张三', 100, 120, 110, 130],
      ['销售部', '李四', 90, 110, 100, 120],
      ['技术部', '王五', 80, 90, 85, 95],
    ]
  },

  // 包含空值的数据
  dataWithEmpty: {
    headers: ['类别', '项目', '数值', '备注'],
    rows: [
      ['A', '项目1', 100, '正常'],
      ['A', '', 200, ''],
      ['', '项目3', 150, ''],
      ['B', '项目4', '', '缺失'],
      [null, '项目5', 300, ''],
    ]
  },

  // 大数据集（用于性能测试）
  largeData: {
    generate: (rowCount) => {
      const rows = [];
      for (let i = 0; i < rowCount; i++) {
        rows.push([
          `类别${i % 10}`,
          `项目${i}`,
          Math.floor(Math.random() * 10000),
          `备注${i % 5}`
        ]);
      }
      return {
        headers: ['类别', '项目', '数值', '备注'],
        rows
      };
    }
  },

  // 多工作表数据
  multiSheetData: {
    sheets: [
      { name: '销售数据', headers: ['日期', '销售额'], rows: [['2024-01-01', 1000], ['2024-01-02', 2000]] },
      { name: '库存数据', headers: ['产品', '数量'], rows: [['产品A', 100], ['产品B', 200]] },
      { name: '客户数据', headers: ['客户', '等级'], rows: [['客户X', 'A'], ['客户Y', 'B']] },
    ]
  },

  // 特殊字符数据
  specialCharsData: {
    headers: ['名称', '描述', '<特殊>', '|管道|'],
    rows: [
      ['测试<1>', '描述1', '值1', '值2'],
      ['测试|2|', '描述2', '值3', '值4'],
      ['测试/3/', '描述3', '值5', '值6'],
    ]
  },

  // 日期格式数据
  dateData: {
    headers: ['日期', '时间', '日期时间'],
    rows: [
      ['2024-01-15', '09:30', '2024-01-15 09:30:00'],
      ['2024-02-20', '14:45', '2024-02-20 14:45:00'],
      ['2024-03-25', '18:00', '2024-03-25 18:00:00'],
    ]
  },

  // 数字格式数据
  numberData: {
    headers: ['整数', '小数', '百分比', '货币'],
    rows: [
      [1000, 1234.5678, 0.15, 9999.99],
      [2000, 9876.5432, 0.25, 8888.88],
      [3000, 5555.5555, 0.50, 7777.77],
    ]
  }
};

// ═══════════════════════════════════════════════════════════════
// 测试数据生成函数
// ═══════════════════════════════════════════════════════════════

function generateTestData(type, options = {}) {
  const template = TestDataTemplates[type];
  
  if (!template) {
    throw new Error(`Unknown test data type: ${type}`);
  }

  if (type === 'largeData' && template.generate) {
    const rowCount = options.rowCount || 1000;
    return template.generate(rowCount);
  }

  if (type === 'multiSheetData') {
    return template.sheets;
  }

  if (type === 'multiHeaderData') {
    return {
      headers: template.headers,
      rows: template.rows
    };
  }

  return {
    headers: template.headers,
    rows: template.rows
  };
}

// 生成工作簿对象
function generateWorkbook(type, options = {}) {
  const data = generateTestData(type, options);
  
  if (Array.isArray(data)) {
    // 多工作表
    return {
      SheetNames: data.map(s => s.name),
      Sheets: data.reduce((acc, sheet) => {
        acc[sheet.name] = createWorksheetFromData(sheet.headers, sheet.rows);
        return acc;
      }, {})
    };
  }
  
  // 单工作表
  const ws = createWorksheetFromData(data.headers, data.rows);
  return {
    SheetNames: ['Sheet1'],
    Sheets: { Sheet1: ws }
  };
}

// 创建工作表
function createWorksheetFromData(headers, rows) {
  const ws = {};
  
  // 写入表头
  if (Array.isArray(headers[0])) {
    // 多行表头
    headers.forEach((headerRow, r) => {
      headerRow.forEach((cell, c) => {
        if (cell) {
          ws[encodeCell(r, c)] = { v: cell, t: 's' };
        }
      });
    });
    // 数据从表头行数后开始
    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell !== undefined && cell !== null && cell !== '') {
          ws[encodeCell(r + headers.length, c)] = { 
            v: cell, 
            t: typeof cell === 'number' ? 'n' : 's' 
          };
        }
      });
    });
  } else {
    // 单行表头
    headers.forEach((cell, c) => {
      ws[encodeCell(0, c)] = { v: cell, t: 's' };
    });
    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell !== undefined && cell !== null && cell !== '') {
          ws[encodeCell(r + 1, c)] = { 
            v: cell, 
            t: typeof cell === 'number' ? 'n' : 's' 
          };
        }
      });
    });
  }
  
  // 设置范围
  const maxRow = Array.isArray(headers[0]) ? headers.length + rows.length : 1 + rows.length;
  const maxCol = Math.max(
    ...rows.map(r => r.length),
    Array.isArray(headers[0]) ? Math.max(...headers.map(h => h.length)) : headers.length
  ) - 1;
  ws['!ref'] = `A1:${encodeCell(maxRow - 1, maxCol)}`;
  
  // 添加列宽
  ws['!cols'] = Array(maxCol + 1).fill({ wch: 15 });
  
  return ws;
}

function encodeCell(r, c) {
  const col = c < 26 ? String.fromCharCode(65 + c) : 
              String.fromCharCode(64 + Math.floor(c / 26)) + String.fromCharCode(65 + (c % 26));
  return `${col}${r + 1}`;
}

// ═══════════════════════════════════════════════════════════════
// 测试场景定义
// ═══════════════════════════════════════════════════════════════

const TestScenarios = {
  // 场景1: 按工作表拆分 - 标准情况
  'split-sheet-standard': {
    type: 'multiSheetData',
    options: {},
    expected: {
      sheetCount: 3,
      allSheetsSelected: true
    }
  },

  // 场景2: 按列拆分（横向）- 标准情况
  'split-column-horizontal': {
    type: 'salesData',
    options: {},
    splitColumn: 0, // 按部门拆分
    expected: {
      groups: 2, // 销售部和技术部
      totalRows: 8
    }
  },

  // 场景3: 按列拆分（横向）- 包含空值
  'split-column-with-empty': {
    type: 'dataWithEmpty',
    options: {},
    splitColumn: 0,
    expected: {
      groups: 3, // A, B, [空值]
      emptyGroupExists: true
    }
  },

  // 场景4: 按列拆分（竖向）- 标准情况
  'split-column-vertical': {
    type: 'salesData',
    options: {},
    keyColumns: [0, 1], // 部门、姓名
    dataColumns: [2, 3, 4], // 月份、销售额、提成
    expected: {
      fileCount: 3,
      columnsPerFile: 3 // 2个固定列 + 1个数据列
    }
  },

  // 场景5: 多文件合并
  'merge-files': {
    files: [
      { type: 'salesData', options: {} },
      { type: 'employeeData', options: {} }
    ],
    expected: {
      totalSheets: 2
    }
  },

  // 场景6: 工作表数据合并
  'merge-sheet-data': {
    files: [
      { type: 'salesData', options: {} }
    ],
    expected: {
      hasSourceColumn: true,
      headerRows: 1
    }
  },

  // 场景7: 性能测试 - 大数据集
  'performance-large': {
    type: 'largeData',
    options: { rowCount: 10000 },
    expected: {
      processingTime: 30000, // 30秒内完成
      memoryLimit: 100 * 1024 * 1024 // 100MB
    }
  },

  // 场景8: 特殊字符处理
  'special-characters': {
    type: 'specialCharsData',
    options: {},
    expected: {
      sanitized: true
    }
  },

  // 场景9: 多行表头
  'multi-header': {
    type: 'multiHeaderData',
    options: {},
    headerRows: 2,
    expected: {
      preserved: true
    }
  },

  // 场景10: 边界情况 - 空文件
  'boundary-empty': {
    type: 'salesData',
    options: {},
    emptyRows: true,
    expected: {
      handled: true
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// 验证函数
// ═══════════════════════════════════════════════════════════════

function validateTestResult(scenarioName, result) {
  const scenario = TestScenarios[scenarioName];
  if (!scenario) {
    return { valid: false, error: 'Unknown scenario' };
  }

  const validations = [];

  // 根据场景类型进行验证
  switch (scenarioName) {
    case 'split-sheet-standard':
      if (result.sheetCount !== scenario.expected.sheetCount) {
        validations.push(`期望 ${scenario.expected.sheetCount} 个工作表，实际 ${result.sheetCount}`);
      }
      break;

    case 'split-column-horizontal':
      if (result.groups !== scenario.expected.groups) {
        validations.push(`期望 ${scenario.expected.groups} 个分组，实际 ${result.groups}`);
      }
      break;

    case 'split-column-vertical':
      if (result.fileCount !== scenario.expected.fileCount) {
        validations.push(`期望 ${scenario.expected.fileCount} 个文件，实际 ${result.fileCount}`);
      }
      break;

    case 'performance-large':
      if (result.processingTime > scenario.expected.processingTime) {
        validations.push(`处理时间 ${result.processingTime}ms 超过限制 ${scenario.expected.processingTime}ms`);
      }
      break;
  }

  return {
    valid: validations.length === 0,
    errors: validations
  };
}

// ═══════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TestDataTemplates,
    TestScenarios,
    generateTestData,
    generateWorkbook,
    createWorksheetFromData,
    validateTestResult
  };
}

// 浏览器环境
if (typeof window !== 'undefined') {
  window.TestDataGenerator = {
    TestDataTemplates,
    TestScenarios,
    generateTestData,
    generateWorkbook,
    createWorksheetFromData,
    validateTestResult
  };
}

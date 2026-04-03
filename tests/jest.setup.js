/**
 * Jest 测试设置
 */

// 模拟 XLSX 全局对象
global.XLSX = {
  utils: {
    decode_range: (ref) => {
      if (!ref || ref === 'A1') return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      const match = ref.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      if (match) {
        const colToNum = (col) => {
          let num = 0;
          for (let i = 0; i < col.length; i++) {
            num = num * 26 + (col.charCodeAt(i) - 64);
          }
          return num - 1;
        };
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
    encode_range: ({ s, e }) => {
      const encodeCell = ({ r, c }) => String.fromCharCode(65 + c) + (r + 1);
      return `${encodeCell(s)}:${encodeCell(e)}`;
    },
    sheet_to_json: (ws, opts) => {
      if (!ws['!ref']) return [];
      const range = global.XLSX.utils.decode_range(ws['!ref']);
      const result = [];
      for (let r = range.s.r; r <= range.e.r; r++) {
        const row = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = global.XLSX.utils.encode_cell({ r, c });
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
            const addr = global.XLSX.utils.encode_cell({ r, c });
            ws[addr] = { v: cell, t: typeof cell === 'number' ? 'n' : 's' };
          }
        });
      });
      if (data.length > 0) {
        const maxCol = Math.max(...data.map(r => r.length)) - 1;
        ws['!ref'] = `A1:${global.XLSX.utils.encode_cell({ r: data.length - 1, c: maxCol })}`;
      }
      return ws;
    },
    book_append_sheet: (wb, ws, name) => {
      wb.SheetNames.push(name);
      wb.Sheets[name] = ws;
    }
  },
  read: (data, opts) => ({
    SheetNames: ['Sheet1'],
    Sheets: {
      Sheet1: {
        '!ref': 'A1:B2',
        'A1': { v: 'Header1', t: 's' },
        'B1': { v: 'Header2', t: 's' },
        'A2': { v: 1, t: 'n' },
        'B2': { v: 2, t: 'n' }
      }
    }
  }),
  write: (wb, opts) => new Uint8Array([1, 2, 3, 4, 5])
};

// 模拟 JSZip
global.JSZip = class {
  constructor() {
    this.files = {};
  }
  file(name, data) {
    this.files[name] = data;
    return this;
  }
  async generateAsync(opts) {
    return new Blob([JSON.stringify(this.files)], { type: 'application/zip' });
  }
};

// 模拟 FileReader
global.FileReader = class {
  readAsArrayBuffer(file) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: new ArrayBuffer(8) } });
      }
    }, 0);
  }
};

// 模拟 Blob
global.Blob = class {
  constructor(parts, opts) {
    this.parts = parts;
    this.type = opts?.type || '';
    this.size = parts.reduce((sum, p) => sum + (p.length || p.byteLength || 0), 0);
  }
};

// 模拟 URL
global.URL = {
  createObjectURL: () => 'blob:test',
  revokeObjectURL: () => {}
};

// 模拟 document
global.document = {
  createElement: (tag) => ({
    tagName: tag,
    style: {},
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: () => {},
    removeChild: () => {},
    click: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    getElementsByClassName: () => [],
    textContent: ''
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  readyState: 'complete'
};

// 模拟 window
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { href: '' },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  }
};

// 模拟 Worker
global.Worker = class {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(data) {
    // 模拟异步响应
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: { type: 'complete', result: {} }
        });
      }
    }, 10);
  }
  terminate() {}
};

// 模拟 performance
global.performance = {
  now: () => Date.now()
};

// 控制台清理
console.debug = () => {};

// 全局测试工具
global.TestUtils = {
  // 创建模拟工作簿
  createMockWorkbook: (sheets = ['Sheet1']) => ({
    SheetNames: sheets,
    Sheets: sheets.reduce((acc, name) => {
      acc[name] = global.TestUtils.createMockWorksheet();
      return acc;
    }, {})
  }),

  // 创建模拟工作表
  createMockWorksheet: (data = [['A', 'B'], [1, 2]]) => {
    const ws = {};
    data.forEach((row, r) => {
      row.forEach((cell, c) => {
        const addr = global.XLSX.utils.encode_cell({ r, c });
        ws[addr] = { v: cell, t: typeof cell === 'number' ? 'n' : 's' };
      });
    });
    ws['!ref'] = global.XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: data.length - 1, c: data[0].length - 1 }
    });
    return ws;
  },

  // 创建模拟文件
  createMockFile: (name = 'test.xlsx', size = 1024, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') => ({
    name,
    size,
    type,
    slice: () => ({})
  }),

  // 等待
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

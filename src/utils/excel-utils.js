/**
 * Excel 处理工具函数
 * Excel 离线工具 - Excel 相关操作
 */

import { XLSX_READ_OPTIONS, XLSX_WRITE_OPTIONS } from '../core/constants.js';

/**
 * 获取工作簿中的工作表数量
 * @param {Object} workbook - XLSX 工作簿对象
 * @returns {number} 工作表数量
 */
export function getWorkbookSheetCount(workbook) {
  return workbook?.SheetNames?.length || 0;
}

/**
 * 检查工作表是否为空（无有效数据）
 * @param {Object} worksheet - XLSX 工作表对象
 * @returns {boolean} 是否为空
 */
export function isWorksheetEffectivelyEmpty(worksheet) {
  if (!worksheet || !worksheet['!ref']) return true;

  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  return jsonData.every(row =>
    Array.isArray(row) && row.every(cell =>
      cell === undefined || cell === null || cell === ''
    )
  );
}

/**
 * 验证表头一致性
 * @param {Array[]} baselineRows - 基准表头行
 * @param {Array[]} currentRows - 当前表头行
 * @param {number} headerRows - 表头行数
 * @returns {Object[]} 不匹配项列表
 */
export function validateHeaderConsistency(baselineRows, currentRows, headerRows) {
  const mismatches = [];

  for (let i = 0; i < headerRows; i++) {
    const baseline = baselineRows[i] || [];
    const current = currentRows[i] || [];

    if (baseline.length !== current.length) {
      mismatches.push({
        row: i + 1,
        type: 'length',
        baseline: baseline.length,
        current: current.length
      });
      continue;
    }

    for (let j = 0; j < baseline.length; j++) {
      if (String(baseline[j] || '') !== String(current[j] || '')) {
        mismatches.push({
          row: i + 1,
          col: j + 1,
          type: 'content',
          baseline: baseline[j],
          current: current[j]
        });
      }
    }
  }

  return mismatches;
}

/**
 * 优化的单元格拷贝
 * 单元格只有简单属性，浅拷贝即可
 * @param {Object} cell - 单元格对象
 * @returns {Object} 拷贝后的单元格
 */
export function deepCopyCell(cell) {
  if (!cell || typeof cell !== 'object') {
    return cell;
  }

  if (Array.isArray(cell)) {
    return cell.slice();
  }

  return { ...cell };
}

/**
 * 克隆工作表
 * @param {Object} worksheet - 源工作表
 * @returns {Object} 克隆的工作表
 */
export function cloneWorksheet(worksheet) {
  const newWorksheet = {};
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  // 复制单元格
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (worksheet[addr]) {
        newWorksheet[addr] = deepCopyCell(worksheet[addr]);
      }
    }
  }

  // 复制范围定义
  newWorksheet['!ref'] = worksheet['!ref'];

  // 复制合并单元格
  if (worksheet['!merges']) {
    newWorksheet['!merges'] = worksheet['!merges'].map(m => ({
      s: { r: m.s.r, c: m.s.c },
      e: { r: m.e.r, c: m.e.c }
    }));
  }

  // 复制其他属性
  ['!cols', '!rows', '!protect', '!autofilter', '!dataValidation'].forEach(prop => {
    if (worksheet[prop]) {
      newWorksheet[prop] = deepCopyCell(worksheet[prop]);
    }
  });

  return newWorksheet;
}

/**
 * 解析 Excel 文件
 * @param {File} file - 文件对象
 * @returns {Promise<{workbook: Object, isConverted: boolean}>} 解析结果
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, XLSX_READ_OPTIONS);
        resolve({ workbook, isConverted: false });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 转换 XLS 工作簿为 XLSX 格式
 * @param {Object} sourceWorkbook - 源工作簿
 * @returns {Object} 转换后的工作簿
 */
export function convertWorkbookToXlsxFormat(sourceWorkbook) {
  const newWorkbook = {
    SheetNames: [...sourceWorkbook.SheetNames],
    Sheets: {}
  };

  for (const sheetName of sourceWorkbook.SheetNames) {
    newWorkbook.Sheets[sheetName] = cloneWorksheet(sourceWorkbook.Sheets[sheetName]);
  }

  return newWorkbook;
}

/**
 * 获取工作表结构签名（用于比较）
 * @param {Array[]} rows - 行数据
 * @param {number} headerRows - 表头行数
 * @returns {string} 结构签名
 */
export function getSheetStructureSignature(rows, headerRows) {
  const headerData = rows.slice(0, headerRows);
  const columnCount = rows.reduce((max, row) =>
    Math.max(max, Array.isArray(row) ? row.length : 0), 0
  );

  return JSON.stringify({
    headers: headerData,
    columnCount,
    headerRows
  });
}

/**
 * 获取最大列数
 * @param {Array[]} rows - 行数组
 * @returns {number} 最大列数
 */
export function getMaxColumnCount(rows) {
  return rows.reduce((max, row) =>
    Math.max(max, Array.isArray(row) ? row.length : 0), 0
  );
}

/**
 * 创建工作簿下载
 * @param {Object} workbook - XLSX 工作簿
 * @param {string} fileName - 文件名
 */
export function downloadWorkbook(workbook, fileName) {
  const buffer = XLSX.write(workbook, XLSX_WRITE_OPTIONS);
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

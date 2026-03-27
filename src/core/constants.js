/**
 * 配置常量集中管理
 * Excel 离线工具 - 核心配置
 */

// ═══════════════════════════════════════════════════════════════
// 文件限制
// ═══════════════════════════════════════════════════════════════
export const FILE_LIMITS = {
  MAX_SINGLE_FILE_BYTES: 20 * 1024 * 1024,  // 20MB 软限制
  HARD_LIMIT_FILE_BYTES: 50 * 1024 * 1024,   // 50MB 硬限制
  MAX_TOTAL_FILE_BYTES: 100 * 1024 * 1024,   // 100MB 总限制
  MAX_FILE_COUNT: 50,
  MAX_SHEET_COUNT: 200,
  MAX_UNIQUE_VALUES: 500,
};

// ═══════════════════════════════════════════════════════════════
// XLSX 配置
// ═══════════════════════════════════════════════════════════════
export const XLSX_READ_OPTIONS = {
  type: 'array',
  cellStyles: true,
  cellNF: true,
  cellDates: true,
  cellFormula: true,
  cellHTML: false,
  cellText: false
};

export const XLSX_WRITE_OPTIONS = {
  type: 'array',
  bookType: 'xlsx',
  cellStyles: true,
  compression: true
};

// ═══════════════════════════════════════════════════════════════
// UI 配置
// ═══════════════════════════════════════════════════════════════
export const UI_CONFIG = {
  WORKER_FILE_SIZE_THRESHOLD: 5 * 1024 * 1024,  // 5MB
  PROGRESS_UPDATE_INTERVAL: 200,  // ms
  CACHE_SIZE: 3,
  MAX_NAME_LENGTH: 200,
};

// ═══════════════════════════════════════════════════════════════
// 错误消息
// ═══════════════════════════════════════════════════════════════
export const ERROR_MESSAGES = {
  INVALID_FILE_TYPE: '请上传Excel文件（.xlsx或.xls格式）',
  FILE_TOO_LARGE: (size) => `文件过大（${size}），超过硬性限制`,
  EMPTY_WORKSHEET: '工作表为空',
  NO_DATA_ROWS: '数据行数不足',
  PARSE_ERROR: (msg) => `文件解析失败: ${msg}`,
};

// ═══════════════════════════════════════════════════════════════
// 支持的文件类型
// ═══════════════════════════════════════════════════════════════
export const SUPPORTED_FILE_TYPES = ['.xlsx', '.xls'];

// ═══════════════════════════════════════════════════════════════
// 默认配置
// ═══════════════════════════════════════════════════════════════
export const DEFAULTS = {
  HEADER_ROWS: 1,
  SHEET_NAME: 'Sheet1',
  OUTPUT_FILE_SUFFIX: '_处理结果',
};

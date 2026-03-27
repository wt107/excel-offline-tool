/**
 * Excel 离线工具 - 主入口模块
 * 整合所有模块，提供统一的 API
 */

// ═══════════════════════════════════════════════════════════════
// 核心模块
// ═══════════════════════════════════════════════════════════════
export {
  FILE_LIMITS,
  XLSX_READ_OPTIONS,
  XLSX_WRITE_OPTIONS,
  UI_CONFIG,
  ERROR_MESSAGES,
  SUPPORTED_FILE_TYPES,
  DEFAULTS
} from './core/constants.js';

export { WorkerPool } from './core/worker-pool.js';
export { WorkbookCache } from './core/workbook-cache.js';

// ═══════════════════════════════════════════════════════════════
// 工具模块
// ═══════════════════════════════════════════════════════════════
export * as DomUtils from './utils/dom-utils.js';
export * as FileUtils from './utils/file-utils.js';
export * as ExcelUtils from './utils/excel-utils.js';

// ═══════════════════════════════════════════════════════════════
// 版本信息
// ═══════════════════════════════════════════════════════════════
export const VERSION = '2.0.0';
export const BUILD_DATE = '2025-03-27';

// ═══════════════════════════════════════════════════════════════
// 初始化函数
// ═══════════════════════════════════════════════════════════════
export function initializeApp() {
  console.log(`[ExcelTool] Version ${VERSION} initialized`);
}

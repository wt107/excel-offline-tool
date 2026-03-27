# Phase 2: 代码结构优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 3684 行的单文件重构为模块化结构，提升可维护性

**Architecture:** 分层架构 - core/ + utils/ + ui/ 三层分离

**Tech Stack:** ES6 Modules (IIFE bundle 输出)

---

## 准备工作

### Task 0: 创建隔离工作区

**Files:**
- Use: `superpowers:using-git-worktrees`

- [ ] **Step 1: 创建 worktree 和分支**

```bash
cd /tmp/excel-offline-tool
git worktree add .worktrees/code-structure -b feature/code-structure
cd .worktrees/code-structure
```

- [ ] **Step 2: 验证基线测试通过**

```bash
# 打开 excel.html 验证基本功能正常
```

---

## Task 1: 提取配置常量

**Files:**
- Create: `src/core/constants.js`
- Modify: `excel.html` (删除分散的常量定义)

**依赖:** 无

- [ ] **Step 1: 创建 constants.js**

```javascript
/**
 * 配置常量集中管理
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
};
```

- [ ] **Step 2: 创建目录结构**

```bash
mkdir -p src/core src/utils src/ui
touch src/core/constants.js
```

- [ ] **Step 3: 在 excel.html 中导入常量**

找到常量定义位置 (约 893 行附近)，替换为:

```html
<!-- 在 head 中加载模块 -->
<script type="module">
  import {
    FILE_LIMITS,
    XLSX_READ_OPTIONS,
    XLSX_WRITE_OPTIONS,
    UI_CONFIG,
    ERROR_MESSAGES
  } from './src/core/constants.js';

  // 暴露到全局以供非模块代码使用
  window.AppConstants = {
    FILE_LIMITS,
    XLSX_READ_OPTIONS,
    XLSX_WRITE_OPTIONS,
    UI_CONFIG,
    ERROR_MESSAGES
  };
</script>
```

- [ ] **Step 4: 删除 excel.html 中的重复常量定义**

删除以下行:
```javascript
const MAX_SINGLE_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILE_COUNT = 50;
const MAX_SHEET_COUNT = 200;
const HARD_LIMIT_FILE_BYTES = 50 * 1024 * 1024;
```

替换使用处:
```javascript
// 原: if (file.size > MAX_SINGLE_FILE_BYTES)
// 新:
if (file.size > AppConstants.FILE_LIMITS.MAX_SINGLE_FILE_BYTES)
```

- [ ] **Step 5: 测试验证**

```bash
# 1. 打开 excel.html
# 2. 检查 Console 无错误
# 3. 测试文件上传功能
# 4. 验证常量值正确
```

- [ ] **Step 6: 提交更改**

```bash
git add -A
git commit -m "refactor: extract constants to src/core/constants.js

- Create centralized constants file
- Export FILE_LIMITS, XLSX options, UI_CONFIG
- Update excel.html to import constants
- Remove duplicate constant definitions"
```

---

## Task 2: 提取 DOM 工具函数

**Files:**
- Create: `src/utils/dom-utils.js`
- Modify: `excel.html` (删除已提取的函数)

**依赖:** Task 1 (常量)

- [ ] **Step 1: 创建 dom-utils.js**

```javascript
/**
 * DOM 操作工具函数
 */

import { ERROR_MESSAGES } from '../core/constants.js';

/**
 * 转义 HTML 特殊字符
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 创建 Toast 提示
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * 显示加载遮罩
 */
export function showLoading(text) {
  const loading = document.getElementById('loading');
  const loadingText = document.getElementById('loadingText');
  const progressBarFill = document.getElementById('progressBarFill');

  if (loading) loading.style.display = 'flex';
  if (loadingText) loadingText.textContent = text || '处理中...';
  if (progressBarFill) progressBarFill.style.width = '0%';

  document.getElementById('resultSummary')?.style.display = 'none';
  document.getElementById('fileListCard')?.style.display = 'none';
  document.getElementById('downloadBtn')?.style.display = 'none';
}

/**
 * 隐藏加载遮罩
 */
export function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

/**
 * 更新进度条
 */
export function updateProgress(percent, text) {
  const progressBarFill = document.getElementById('progressBarFill');
  const loadingText = document.getElementById('loadingText');

  if (progressBarFill) progressBarFill.style.width = percent + '%';
  if (text && loadingText) loadingText.textContent = text;
}

/**
 * 节流函数 - 限制执行频率
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
```

- [ ] **Step 2: 更新 excel.html 导入**

在之前的 module 脚本中添加:
```javascript
import * as DomUtils from './src/utils/dom-utils.js';
window.DomUtils = DomUtils;
```

- [ ] **Step 3: 替换 excel.html 中的函数调用**

搜索并替换:
```javascript
// showLoading(text)  ->  DomUtils.showLoading(text)
// hideLoading()      ->  DomUtils.hideLoading()
// updateProgress(p,t)->  DomUtils.updateProgress(p,t)
// escapeHtml(text)   ->  DomUtils.escapeHtml(text)
// showToast(msg,type)->  DomUtils.showToast(msg,type)
```

- [ ] **Step 4: 删除原函数定义**

从 excel.html 中删除:
- `function showLoading(text)`
- `function hideLoading()`
- `function updateProgress(percent, text)`
- `function escapeHtml(text)`
- `function showToast(message, type)`

- [ ] **Step 5: 测试验证**

```bash
# 1. 打开 excel.html
# 2. 测试上传文件 - 观察 loading 和进度条
# 3. 测试 Toast 提示
# 4. 检查无 undefined 错误
```

- [ ] **Step 6: 提交更改**

```bash
git add -A
git commit -m "refactor: extract DOM utilities to src/utils/dom-utils.js

- Create dom-utils.js with common DOM functions
- Export showLoading, hideLoading, updateProgress
- Export escapeHtml, showToast, throttle
- Update excel.html to use imported functions"
```

---

## Task 3: 提取文件工具函数

**Files:**
- Create: `src/utils/file-utils.js`
- Modify: `excel.html`

**依赖:** Task 1

- [ ] **Step 1: 创建 file-utils.js**

```javascript
/**
 * 文件操作工具函数
 */

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 清理文件名中的非法字符
 */
export function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/**
 * 生成唯一文件名
 */
export function ensureUniqueFileName(fileName, existingNames = []) {
  if (!existingNames.includes(fileName)) {
    return fileName;
  }

  const ext = fileName.lastIndexOf('.');
  const base = ext > -1 ? fileName.slice(0, ext) : fileName;
  const extension = ext > -1 ? fileName.slice(ext) : '';

  let counter = 1;
  let newName = `${base}_${counter}${extension}`;

  while (existingNames.includes(newName)) {
    counter++;
    newName = `${base}_${counter}${extension}`;
  }

  return newName;
}

/**
 * 生成文件唯一标识
 */
export function getFileId(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

/**
 * 获取基础文件名（不含扩展名）
 */
export function getBaseFileName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '');
}

/**
 * 生成时间戳字符串
 */
export function getTimestampString() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
```

- [ ] **Step 2: 更新导入和替换调用**

```javascript
import * as FileUtils from './src/utils/file-utils.js';
window.FileUtils = FileUtils;
```

替换调用:
```javascript
// formatFileSize(bytes)     -> FileUtils.formatFileSize(bytes)
// sanitizeFileName(name)    -> FileUtils.sanitizeFileName(name)
// ensureUniqueFileName(...) -> FileUtils.ensureUniqueFileName(...)
// getFileId(file)           -> FileUtils.getFileId(file)
// getBaseFileName(name)     -> FileUtils.getBaseFileName(name)
// getTimestampString()      -> FileUtils.getTimestampString()
```

- [ ] **Step 3: 删除原函数并提交**

```bash
git add -A
git commit -m "refactor: extract file utilities to src/utils/file-utils.js

- Add formatFileSize, sanitizeFileName, ensureUniqueFileName
- Add getFileId, getBaseFileName, getTimestampString
- Update excel.html imports and usage"
```

---

## Task 4: 提取 Excel 工具函数

**Files:**
- Create: `src/utils/excel-utils.js`
- Modify: `excel.html`

**依赖:** Task 1

- [ ] **Step 1: 创建 excel-utils.js**

```javascript
/**
 * Excel 处理工具函数
 */

import { XLSX_READ_OPTIONS, XLSX_WRITE_OPTIONS } from '../core/constants.js';

/**
 * 获取工作簿中的工作表数量
 */
export function getWorkbookSheetCount(workbook) {
  return workbook?.SheetNames?.length || 0;
}

/**
 * 检查工作表是否为空
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

  // 复制属性
  newWorksheet['!ref'] = worksheet['!ref'];

  if (worksheet['!merges']) {
    newWorksheet['!merges'] = worksheet['!merges'].map(m => ({
      s: { r: m.s.r, c: m.s.c },
      e: { r: m.e.r, c: m.e.c }
    }));
  }

  ['!cols', '!rows', '!protect', '!autofilter'].forEach(prop => {
    if (worksheet[prop]) {
      newWorksheet[prop] = deepCopyCell(worksheet[prop]);
    }
  });

  return newWorksheet;
}

/**
 * 解析 Excel 文件
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
```

- [ ] **Step 2: 更新导入和替换**

```javascript
import * as ExcelUtils from './src/utils/excel-utils.js';
window.ExcelUtils = ExcelUtils;
```

- [ ] **Step 3: 提交更改**

```bash
git add -A
git commit -m "refactor: extract Excel utilities to src/utils/excel-utils.js

- Add getWorkbookSheetCount, isWorksheetEffectivelyEmpty
- Add validateHeaderConsistency, deepCopyCell, cloneWorksheet
- Add parseExcelFile async function
- Update excel.html to use module imports"
```

---

## Task 5: 提取 Worker Pool 和 Cache

**Files:**
- Create: `src/core/worker-pool.js`
- Create: `src/core/workbook-cache.js`
- Modify: `excel.html`

**依赖:** Task 1

- [ ] **Step 1: 创建 worker-pool.js**

将 `excel.html` 中的 `WorkerPool` 类移动到独立文件。

- [ ] **Step 2: 创建 workbook-cache.js**

将 `WorkbookCache` 类移动到独立文件。

- [ ] **Step 3: 更新 excel.html**

```javascript
import { WorkerPool } from './src/core/worker-pool.js';
import { WorkbookCache } from './src/core/workbook-cache.js';
window.WorkerPool = WorkerPool;
window.WorkbookCache = WorkbookCache;
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "refactor: extract WorkerPool and WorkbookCache to core modules

- Move WorkerPool class to src/core/worker-pool.js
- Move WorkbookCache class to src/core/workbook-cache.js
- Update excel.html imports"
```

---

## Task 6: 清理主文件

**Files:**
- Modify: `excel.html`

**依赖:** Task 1-5

- [ ] **Step 1: 删除已迁移的代码**

从 `excel.html` 中删除:
1. WorkerPool 类定义
2. WorkbookCache 类定义
3. fastCopyCell 函数定义 (已移到 excel-utils.js)
4. initializeWorkerPool 函数 (简化后保留)

- [ ] **Step 2: 简化 initializeApp**

```javascript
function initializeApp() {
  // 初始化 Worker Pool
  initializeWorkerPool();

  // 获取DOM元素
  uploadArea = document.getElementById('uploadArea');
  fileInput = document.getElementById('fileInput');

  // 验证元素
  if (!uploadArea || !fileInput) {
    alert('页面初始化失败：关键元素未找到');
    return;
  }

  // 绑定事件
  setupEventListeners();

  console.log('[App] 初始化完成');
}
```

- [ ] **Step 3: 验证文件大小**

```bash
wc -l excel.html
# 目标: < 2000 行 (从 3684 减少到约 1500)
```

- [ ] **Step 4: 功能测试**

```bash
# 完整功能测试:
# 1. 文件上传
# 2. 工作表拆分
# 3. 列拆分
# 4. 文件合并
# 5. 下载结果
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: clean up excel.html after module extraction

- Remove migrated class and function definitions
- Simplify initializeApp function
- Update imports and global references
- File size: 3684 -> ~1500 lines"
```

---

## 最终验证

### Task 7: 代码质量检查

- [ ] **Step 1: 统计代码指标**

```bash
# 统计总行数
echo "Total lines:"
find src -name "*.js" -exec wc -l {} + | tail -1

# 统计函数数
echo "Function count:"
grep -r "^export function\|^export async function\|^export class" src/ | wc -l

# 检查循环依赖
echo "Module structure:"
find src -name "*.js" | head -10
```

- [ ] **Step 2: 浏览器兼容性测试**

```bash
# 测试浏览器:
# 1. Chrome (最新版)
# 2. Edge (最新版)
# 3. 检查 Console 无错误
# 4. 验证所有功能正常
```

- [ ] **Step 3: 代码审查报告**

创建 `docs/superpowers/CODE_REVIEW_REPORT_PHASE2.md`

---

## 完成提交

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "refactor(phase2): complete code structure optimization

Major changes:
- Extract constants to src/core/constants.js
- Extract DOM utils to src/utils/dom-utils.js
- Extract file utils to src/utils/file-utils.js
- Extract Excel utils to src/utils/excel-utils.js
- Extract WorkerPool to src/core/worker-pool.js
- Extract WorkbookCache to src/core/workbook-cache.js
- Reduce excel.html from 3684 to ~1500 lines
- Improve code maintainability and testability

Stats:
- Modules: 0 -> 6
- excel.html lines: 3684 -> ~1500
- Global variables: 395 -> <50"
```

---

## 下一步

Phase 2 完成后，使用 `superpowers:finishing-a-development-branch` 决定:
1. 合并到 main
2. 继续 Phase 3 (工程化改进 - 添加测试)
3. 创建 PR

---

**Plan Complete - Ready for Implementation**

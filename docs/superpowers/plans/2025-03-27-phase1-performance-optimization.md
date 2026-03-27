# Phase 1: 关键性能优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决关键性能瓶颈，使大文件处理不阻塞 UI，提升用户体验

**Architecture:** 引入 Web Worker 处理 Excel 操作，优化数据缓存和深拷贝

**Tech Stack:** JavaScript, Web Workers, SheetJS

---

## 准备工作

### Task 0: 创建隔离工作区

**Files:**
- Use: `superpowers:using-git-worktrees`

- [ ] **Step 1: 验证 .worktrees 目录**

检查并确认工作目录:
```bash
cd /tmp/excel-offline-tool
git worktree add .worktrees/perf-optimization -b feature/perf-optimization
cd .worktrees/perf-optimization
```

- [ ] **Step 2: 验证基线测试通过**

```bash
# 打开 excel.html 在浏览器中验证基本功能正常
# 无自动化测试，手动验证
```

---

## Task 1: 创建 Web Worker 框架

**Files:**
- Create: `workers/excel-processor.worker.js`
- Modify: `excel.html` (添加 Worker 初始化代码)

- [ ] **Step 1: 创建 Worker 文件结构**

```javascript
// workers/excel-processor.worker.js
importScripts('../lib/xlsx.bundle.js');

const XLSX_READ_OPTIONS = {
  type: 'array',
  cellStyles: true,
  cellNF: true,
  cellDates: true,
  cellFormula: true,
};

const XLSX_WRITE_OPTIONS = {
  type: 'array',
  bookType: 'xlsx',
  cellStyles: true,
};

self.onmessage = function(e) {
  const { id, action, data } = e.data;

  try {
    switch(action) {
      case 'parse':
        handleParse(id, data);
        break;
      case 'generate':
        handleGenerate(id, data);
        break;
      case 'splitSheet':
        handleSplitSheet(id, data);
        break;
      default:
        self.postMessage({
          id,
          error: `Unknown action: ${action}`
        });
    }
  } catch (error) {
    self.postMessage({
      id,
      error: error.message,
      stack: error.stack
    });
  }
};

function handleParse(id, data) {
  self.postMessage({ id, type: 'progress', percent: 10, text: '正在解析文件结构...' });

  const workbook = XLSX.read(data.array, XLSX_READ_OPTIONS);

  // 序列化工作簿以便传输
  const serialized = {
    SheetNames: workbook.SheetNames,
    Sheets: {}
  };

  // 只传输必要的数据，减少内存占用
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    serialized.Sheets[sheetName] = sheet;
  }

  self.postMessage({ id, type: 'complete', result: serialized });
}

function handleGenerate(id, data) {
  self.postMessage({ id, type: 'progress', percent: 50, text: '正在生成文件...' });

  const buffer = XLSX.write(data.workbook, XLSX_WRITE_OPTIONS);

  // Transfer ownership to main thread to avoid copy
  self.postMessage({
    id,
    type: 'complete',
    result: buffer
  }, [buffer]);
}

function handleSplitSheet(id, data) {
  // 在 Worker 中处理拆分，避免阻塞主线程
  const { workbook, sheetName, options } = data;
  // ... 实现拆分逻辑
}
```

- [ ] **Step 2: 创建 Worker Pool 管理器**

在 `excel.html` 中添加 (在 `<script>` 标签开始处):

```javascript
// Worker Pool 管理器
class WorkerPool {
  constructor(scriptUrl, poolSize = 2) {
    this.scriptUrl = scriptUrl;
    this.poolSize = poolSize;
    this.workers = [];
    this.queue = [];
    this.taskId = 0;
    this.pendingTasks = new Map();

    this.initialize();
  }

  initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker();
    }
  }

  createWorker() {
    const worker = new Worker(this.scriptUrl);
    worker.busy = false;
    worker.onmessage = (e) => this.handleMessage(e, worker);
    worker.onerror = (e) => this.handleError(e, worker);
    this.workers.push(worker);
  }

  handleMessage(e, worker) {
    const { id, type, result, error, percent, text } = e.data;
    const task = this.pendingTasks.get(id);

    if (!task) return;

    if (type === 'progress' && task.onProgress) {
      task.onProgress(percent, text);
    } else if (type === 'complete') {
      worker.busy = false;
      this.pendingTasks.delete(id);
      task.resolve(result);
      this.processQueue();
    } else if (error) {
      worker.busy = false;
      this.pendingTasks.delete(id);
      task.reject(new Error(error));
      this.processQueue();
    }
  }

  handleError(e, worker) {
    console.error('Worker error:', e);
    // 重启 worker
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      worker.terminate();
      this.workers[index] = this.createWorker();
    }
  }

  execute(action, data, onProgress) {
    return new Promise((resolve, reject) => {
      const id = ++this.taskId;
      this.pendingTasks.set(id, { resolve, reject, onProgress });
      this.queue.push({ id, action, data });
      this.processQueue();
    });
  }

  processQueue() {
    while (this.queue.length > 0) {
      const availableWorker = this.workers.find(w => !w.busy);
      if (!availableWorker) break;

      const { id, action, data } = this.queue.shift();
      availableWorker.busy = true;
      availableWorker.postMessage({ id, action, data });
    }
  }

  terminate() {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
  }
}

// 全局 Worker Pool 实例
let excelWorkerPool = null;

function initializeWorkerPool() {
  try {
    excelWorkerPool = new WorkerPool('workers/excel-processor.worker.js', 2);
    console.log('[Performance] Worker pool initialized');
  } catch (e) {
    console.warn('[Performance] Worker not supported, falling back to main thread');
  }
}
```

- [ ] **Step 3: 修改文件解析逻辑使用 Worker**

找到 `handleSplitFile` 函数中的 FileReader onload 部分，替换为:

```javascript
reader.onload = async function(e) {
  try {
    const data = new Uint8Array(e.target.result);

    let workbook;

    // 大文件使用 Worker 处理
    if (excelWorkerPool && file.size > 5 * 1024 * 1024) {
      showToast('文件较大，正在使用后台处理...', 'info');
      workbook = await excelWorkerPool.execute('parse', { array: data },
        (percent, text) => updateProgress(percent, text)
      );
    } else {
      // 小文件保持原有处理
      const rawWorkbook = XLSX.read(data, XLSX_READ_OPTIONS);
      if (isXlsFile) {
        workbook = convertWorkbookToXlsxFormat(rawWorkbook);
      } else {
        workbook = rawWorkbook;
      }
    }

    // ... 后续逻辑保持不变
  } catch (error) {
    console.error('文件解析错误:', error);
    showToast('文件解析失败: ' + error.message, 'error');
  }
};
```

- [ ] **Step 4: 在 initializeApp 中初始化 Worker Pool**

```javascript
function initializeApp() {
  initializeWorkerPool(); // 添加这一行
  // ... 其余代码保持不变
}
```

- [ ] **Step 5: 运行测试验证 Worker 正常工作**

```bash
# 手动测试步骤:
# 1. 打开 excel.html
# 2. 打开 DevTools Console
# 3. 应看到 "[Performance] Worker pool initialized"
# 4. 上传 >5MB 文件
# 5. 验证 UI 不卡顿，进度条正常更新
```

---

## Task 2: 优化数据缓存

**Files:**
- Modify: `excel.html` (添加缓存管理器)

- [ ] **Step 1: 添加 WorkbookCache 类**

在 Worker Pool 代码后添加:

```javascript
// Workbook 缓存管理器 - 避免重复解析
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
      console.log(`[Cache] Hit for ${fileId}`);
      return entry.data;
    }
    this.stats.misses++;
    return null;
  }

  set(fileId, data) {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.cache.set(fileId, {
      data,
      lastAccessed: Date.now(),
      size: this.estimateSize(data)
    });
    console.log(`[Cache] Stored ${fileId}, cache size: ${this.cache.size}`);
  }

  evictLRU() {
    let oldest = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldest = key;
        oldestTime = entry.lastAccessed;
      }
    }
    if (oldest) {
      console.log(`[Cache] Evicting ${oldest}`);
      this.cache.delete(oldest);
    }
  }

  estimateSize(data) {
    // 粗略估计内存占用
    return JSON.stringify(data).length * 2; // UTF-16 估算
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(1) + '%' : 'N/A',
      size: this.cache.size
    };
  }

  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }
}

// 全局缓存实例
const workbookCache = new WorkbookCache(3);
```

- [ ] **Step 2: 在文件解析中使用缓存**

修改 `parseExcelFile` 函数:

```javascript
async function parseExcelFile(file) {
  const fileId = file.name + '-' + file.size + '-' + file.lastModified;

  // 检查缓存
  const cached = workbookCache.get(fileId);
  if (cached) {
    showToast('使用缓存数据', 'info');
    return { workbook: cached, isCached: true };
  }

  // 原有解析逻辑...
  const result = await new Promise((resolve, reject) => {
    // ... FileReader 逻辑
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, XLSX_READ_OPTIONS);
        resolve({ workbook, isConverted: false });
      } catch (error) {
        reject(error);
      }
    };
  });

  // 存入缓存
  workbookCache.set(fileId, result.workbook);

  return result;
}
```

- [ ] **Step 3: 缓存 sheet_to_json 结果**

在 `displayColumns` 等频繁调用处:

```javascript
// 在函数开始处添加
const jsonCacheKey = sheetName + '-' + (workbook.Sheets[sheetName]['!ref'] || '');
if (!window._jsonCache) window._jsonCache = new Map();

let jsonData = window._jsonCache.get(jsonCacheKey);
if (!jsonData) {
  jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  window._jsonCache.set(jsonCacheKey, jsonData);
  console.log(`[Cache] Cached JSON data for ${sheetName}`);
}
```

- [ ] **Step 4: 添加内存清理机制**

```javascript
function clearWorkbookCache() {
  workbookCache.clear();
  window._jsonCache?.clear();

  // 强制垃圾回收提示 (Chrome)
  if (window.gc) {
    window.gc();
  }

  console.log('[Memory] Cache cleared');
}

// 在文件处理完成后清理
function finishProcessing() {
  // ... 原有逻辑

  // 延迟清理缓存，避免立即重新加载时缓存失效
  setTimeout(() => {
    clearWorkbookCache();
  }, 60000); // 1分钟后清理
}
```

- [ ] **Step 5: 验证缓存命中率**

```javascript
// 在 console 中运行测试:
console.log(workbookCache.getStats());
// 应该显示命中率统计
```

---

## Task 3: 优化深拷贝性能

**Files:**
- Modify: `excel.html` (替换 deepCopyCell 实现)

- [ ] **Step 1: 替换 deepCopyCell 为快速版本**

找到原有的 `deepCopyCell` 函数，替换为:

```javascript
/**
 * 优化的单元格拷贝 - 使用结构化克隆或浅拷贝
 * 单元格对象只有简单属性，无需递归深拷贝
 */
function deepCopyCell(cell) {
  if (!cell || typeof cell !== 'object') {
    return cell;
  }

  // 简单对象直接返回副本
  if (Array.isArray(cell)) {
    return cell.slice();
  }

  // 对于大多数单元格，浅拷贝已足够
  // 单元格属性都是原始值 (t, v, f, s 等)
  return { ...cell };
}

/**
 * 批量单元格拷贝 - 比逐个拷贝更高效
 */
function batchCopyCells(cells) {
  if (Array.isArray(cells)) {
    return cells.map(deepCopyCell);
  }

  if (typeof cells === 'object' && cells !== null) {
    const result = {};
    for (const [key, cell] of Object.entries(cells)) {
      result[key] = deepCopyCell(cell);
    }
    return result;
  }

  return cells;
}

/**
 * 使用结构化克隆 API (如果可用) - 最快的大对象拷贝
 */
function structuredCloneCell(cell) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(cell);
    } catch (e) {
      // 降级到手动拷贝
    }
  }
  return deepCopyCell(cell);
}
```

- [ ] **Step 2: 优化 cloneWorksheet 函数**

替换 `cloneWorksheet` 函数:

```javascript
function cloneWorksheet(worksheet) {
  const newWorksheet = {};

  // 使用 Object.assign 批量拷贝比逐个字段快
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  // 批量处理单元格，减少循环开销
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      if (cell) {
        newWorksheet[cellAddress] = deepCopyCell(cell);
      }
    }
  }

  // 处理合并区域
  if (worksheet['!merges']) {
    newWorksheet['!merges'] = worksheet['!merges'].map(m => ({
      s: { r: m.s.r, c: m.s.c },
      e: { r: m.e.r, c: m.e.c }
    }));

    // 拷贝合并区域内的单元格
    for (const merge of worksheet['!merges']) {
      for (let mr = merge.s.r; mr <= merge.e.r; mr++) {
        for (let mc = merge.s.c; mc <= merge.e.c; mc++) {
          const addr = XLSX.utils.encode_cell({ r: mr, c: mc });
          if (worksheet[addr] && !newWorksheet[addr]) {
            newWorksheet[addr] = deepCopyCell(worksheet[addr]);
          }
        }
      }
    }
  }

  // 复制属性
  newWorksheet['!ref'] = worksheet['!ref'];
  copyWorksheetProperties(worksheet, newWorksheet, {});

  return newWorksheet;
}
```

- [ ] **Step 3: 添加性能测量**

```javascript
function measureCopyPerformance() {
  // 创建一个大型测试工作表
  const testSheet = {};
  for (let i = 0; i < 10000; i++) {
    testSheet[XLSX.utils.encode_cell({ r: i, c: 0 })] = { v: i, t: 'n' };
  }
  testSheet['!ref'] = 'A1:A10000';

  // 测试旧方法
  console.time('Old deepCopy');
  const oldCopy = {};
  // 模拟旧方法...
  console.timeEnd('Old deepCopy');

  // 测试新方法
  console.time('New fastCopy');
  const newCopy = cloneWorksheet(testSheet);
  console.timeEnd('New fastCopy');
}

// 运行测试
measureCopyPerformance();
```

---

## Task 4: 优化大文件 UI 响应

**Files:**
- Modify: `excel.html` (添加分片处理和进度更新)

- [ ] **Step 1: 添加分片处理机制**

```javascript
/**
 * 分批处理大型数据集，避免阻塞 UI
 */
async function processInBatches(items, batchSize, processFn, onProgress) {
  const results = [];
  const total = items.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // 处理当前批次
    const batchResults = await Promise.all(
      batch.map(item => processFn(item))
    );
    results.push(...batchResults);

    // 报告进度
    if (onProgress) {
      const percent = Math.round((i + batch.length) / total * 100);
      onProgress(percent);
    }

    // 让出主线程，更新 UI
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return results;
}

// 使用示例: 竖向拆分大文件
async function processVerticalSplitLargeFile(dataColIndices, worksheet, options) {
  return processInBatches(
    dataColIndices,
    10, // 每批处理 10 个列
    async (colIndex) => {
      // 处理单个列
      return generateSingleColumnFile(colIndex, worksheet, options);
    },
    (percent) => updateProgress(10 + percent * 0.8, '正在生成文件...')
  );
}
```

- [ ] **Step 2: 使用 requestAnimationFrame 优化进度更新**

```javascript
function throttleProgressUpdate(callback, minInterval = 100) {
  let lastUpdate = 0;
  let pendingUpdate = null;

  return function(percent, text) {
    const now = Date.now();

    if (now - lastUpdate >= minInterval) {
      lastUpdate = now;
      callback(percent, text);
    } else if (!pendingUpdate) {
      pendingUpdate = requestAnimationFrame(() => {
        pendingUpdate = null;
        lastUpdate = Date.now();
        callback(percent, text);
      });
    }
  };
}

// 应用到现有的 updateProgress
const throttledUpdateProgress = throttleProgressUpdate(updateProgress, 200);
```

---

## 验证与测试

### Task 5: 性能基准测试

- [ ] **Step 1: 创建性能测试脚本**

添加在页面加载后的测试代码:

```javascript
async function runPerformanceBenchmarks() {
  console.log('=== Performance Benchmarks ===');

  // 测试 1: 深拷贝性能
  console.log('\n1. Deep Copy Performance:');
  measureCopyPerformance();

  // 测试 2: 缓存命中率
  console.log('\n2. Cache Stats:');
  console.log(workbookCache.getStats());

  // 测试 3: Worker 可用性
  console.log('\n3. Worker Support:');
  console.log('Worker Pool available:', !!excelWorkerPool);

  console.log('\n=== Benchmarks Complete ===');
}

// 在 initializeApp 结束时调用
setTimeout(runPerformanceBenchmarks, 1000);
```

- [ ] **Step 2: 手动功能验证**

| 测试项 | 步骤 | 预期结果 |
|--------|------|----------|
| Worker 初始化 | 打开页面，查看 Console | 看到 "Worker pool initialized" |
| 小文件处理 | 上传 <5MB 文件 | 正常处理，不使用 Worker |
| 大文件处理 | 上传 >5MB 文件 | 使用 Worker，UI 不卡顿 |
| 缓存命中 | 重复上传同一文件 | 显示 "使用缓存数据" |
| 进度更新 | 处理大文件 | 进度条平滑更新 |

---

## 提交

- [ ] **Step 3: 提交更改**

```bash
git add -A
git commit -m "perf: Phase 1 - 关键性能优化

- 添加 Web Worker 处理大文件，避免 UI 阻塞
- 实现 Workbook 缓存，减少重复解析
- 优化深拷贝算法，使用浅拷贝替代递归
- 添加分片处理机制，提升大文件处理流畅度

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 下一步

Phase 1 完成后，使用 `superpowers:finishing-a-development-branch` 决定:
1. 合并到 main
2. 继续 Phase 2 (代码结构优化)
3. 创建 PR 进行代码审查

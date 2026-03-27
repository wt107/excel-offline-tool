# Excel 离线工具 - 代码审查与性能优化设计文档

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan after this design is approved.

**Goal:** 通过代码审查识别关键问题，实施性能优化，提升代码质量和用户体验

**Architecture:** 渐进式优化策略，先解决关键性能瓶颈，再重构代码结构，最后添加自动化测试

**Tech Stack:** 原生 JavaScript, SheetJS (xlsx), JSZip, Web Workers (新增)

---

## 1. 项目现状分析

### 1.1 项目结构
```
excel-offline-tool/
├── excel.html          # 主文件 (3517行, 151KB) - 单文件实现所有功能
├── lib/
│   ├── xlsx.bundle.js      # 425KB - SheetJS 样式支持版本
│   ├── xlsx.full.min.js    # 882KB - SheetJS 完整版 (未使用)
│   └── jszip.min.js        # 98KB - ZIP 处理
└── test-fixtures/      # 测试样本文件
```

### 1.2 核心功能
- 按工作表拆分
- 按列拆分（横向）
- 按列拆分（竖向）
- 多文件合并
- 工作表数据合并

---

## 2. 代码审查发现的问题

### 2.1 架构/结构问题 (严重)

| 问题 | 影响 | 优先级 |
|------|------|--------|
| **单文件过大** (3517行) | 可维护性差，代码冲突风险高 | P0 |
| **全局命名空间污染** | 变量冲突风险，难以测试 | P1 |
| **无模块化** | 代码复用困难，依赖关系混乱 | P1 |
| **混合关注点** (UI + 业务逻辑 + 数据处理) | 难以单元测试，代码重复 | P1 |

### 2.2 性能问题 (严重)

| 问题 | 影响 | 优先级 |
|------|------|--------|
| **主线程处理大文件** | UI 卡顿，浏览器无响应 | P0 |
| **重复 sheet_to_json 调用** | 冗余计算，内存浪费 | P0 |
| **同步深拷贝单元格** | 大文件处理极慢 | P0 |
| **内存泄漏** (workbook 长期引用) | 大文件处理后内存不释放 | P1 |
| **无流式处理** | 大 ZIP 文件内存溢出风险 | P1 |

### 2.3 代码质量问题 (中等)

| 问题 | 影响 | 优先级 |
|------|------|--------|
| **重复代码** (deepCopyCell, cloneWorksheet 等) | 维护困难，bug 风险 | P2 |
| **不一致的错误处理** | 用户体验差，调试困难 | P2 |
| **魔法数字分散** | 配置难以统一管理 | P2 |
| **DOM 操作分散** | 难以维护，性能差 | P2 |

### 2.4 安全性问题 (低)

- XSS 风险: `innerHTML` 使用未充分转义 (已部分处理)
- 文件类型验证依赖扩展名，已添加魔术字节验证

---

## 3. 优化方案

### 3.1 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **A: 渐进式优化** | 风险低，可逐步验证 | 时间稍长 | ✅ 推荐 |
| **B: 全面重构** | 架构最佳 | 风险高，可能引入 bug | ❌ 不推荐 |
| **C: 仅修关键性能** | 快速见效 | 技术债务积累 | ⚠️ 临时方案 |

### 3.2 选定方案: 渐进式优化 (A)

**阶段 1: 关键性能优化** (立即见效)
- Web Worker 处理大文件
- 缓存 sheet_to_json 结果
- 优化深拷贝逻辑

**阶段 2: 代码结构优化** (可维护性)
- 提取配置常量
- 模块化工具函数
- 统一错误处理

**阶段 3: 工程化改进** (长期质量)
- 添加自动化测试
- 性能监控
- 代码分割

---

## 4. 详细设计

### 4.1 阶段 1: 关键性能优化

#### 4.1.1 Web Worker 集成

**Worker 文件 (`workers/excel-processor.worker.js`):**
```javascript
// 处理 Excel 解析和生成，不阻塞主线程
self.onmessage = function(e) {
  const { action, data } = e.data;
  switch(action) {
    case 'parse':
      const workbook = XLSX.read(data.array, { type: 'array', ... });
      self.postMessage({ type: 'parsed', workbook });
      break;
    case 'generate':
      const buffer = XLSX.write(data.workbook, { type: 'array', ... });
      self.postMessage({ type: 'generated', buffer }, [buffer]);
      break;
  }
};
```

**主线程通信:**
```javascript
const worker = new Worker('workers/excel-processor.worker.js');
worker.postMessage({ action: 'parse', data: { array: uint8Array } });
worker.onmessage = (e) => {
  if (e.data.type === 'parsed') {
    // 更新 UI
  }
};
```

#### 4.1.2 数据缓存策略

**Workbook Cache Manager:**
```javascript
class WorkbookCache {
  constructor(maxSize = 3) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(fileId) {
    const entry = this.cache.get(fileId);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.data;
    }
    return null;
  }

  set(fileId, data) {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.cache.set(fileId, { data, lastAccessed: Date.now() });
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
    if (oldest) this.cache.delete(oldest);
  }
}
```

#### 4.1.3 深拷贝优化

**原始代码 (慢):**
```javascript
function deepCopyCell(cell) {
  if (!cell || typeof cell !== 'object') return cell;
  const copy = {};
  for (let key in cell) {
    if (cell.hasOwnProperty(key) && typeof cell[key] !== 'function') {
      copy[key] = deepCopyCell(cell[key]); // 递归
    }
  }
  return copy;
}
```

**优化版本:**
```javascript
function fastCopyCell(cell) {
  if (!cell || typeof cell !== 'object') return cell;
  // 单元格只有简单属性，使用浅拷贝即可
  return { ...cell };
}

// 对于大批量拷贝，使用结构化克隆
function batchCopyCells(cells) {
  return structuredClone(cells); // 浏览器原生，性能更好
}
```

### 4.2 阶段 2: 代码结构优化

#### 4.2.1 配置集中化

**config/constants.js:**
```javascript
export const FILE_LIMITS = {
  MAX_SINGLE_FILE_BYTES: 20 * 1024 * 1024,  // 20MB 软限制
  HARD_LIMIT_FILE_BYTES: 50 * 1024 * 1024,   // 50MB 硬限制
  MAX_TOTAL_FILE_BYTES: 100 * 1024 * 1024,   // 100MB 总限制
  MAX_FILE_COUNT: 50,
  MAX_SHEET_COUNT: 200,
  MAX_UNIQUE_VALUES: 500,
};

export const XLSX_READ_OPTIONS = {
  type: 'array',
  cellStyles: true,
  cellNF: true,
  cellDates: true,
};

export const XLSX_WRITE_OPTIONS = {
  type: 'array',
  bookType: 'xlsx',
  cellStyles: true,
};
```

#### 4.2.2 工具函数模块化

**utils/file-utils.js:**
```javascript
export function formatFileSize(bytes) { ... }
export function sanitizeFileName(name) { ... }
export function ensureUniqueFileName(name, existing) { ... }
```

**utils/excel-utils.js:**
```javascript
export function getWorkbookSheetCount(workbook) { ... }
export function isWorksheetEffectivelyEmpty(worksheet) { ... }
export function validateHeaderConsistency(baseline, current, headerRows) { ... }
```

**utils/dom-utils.js:**
```javascript
export function escapeHtml(text) { ... }
export function showToast(message, type = 'info') { ... }
export function updateProgress(percent, text) { ... }
```

### 4.3 阶段 3: 工程化改进

#### 4.3.1 自动化测试

**tests/unit/excel-utils.test.js:**
```javascript
describe('Excel Utils', () => {
  test('getWorkbookSheetCount returns correct count', () => {
    const mockWorkbook = { SheetNames: ['Sheet1', 'Sheet2'] };
    expect(getWorkbookSheetCount(mockWorkbook)).toBe(2);
  });

  test('formatFileSize formats correctly', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
  });
});
```

**tests/integration/file-processing.test.js:**
```javascript
describe('File Processing Integration', () => {
  test('processes 10MB file within 5 seconds', async () => {
    const start = performance.now();
    await processFile(largeFileFixture);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5000);
  });
});
```

#### 4.3.2 性能监控

**utils/performance-monitor.js:**
```javascript
export class PerformanceMonitor {
  static measure(name, fn) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    return result;
  }

  static async measureAsync(name, fn) {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    return result;
  }
}
```

---

## 5. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Web Worker 兼容性问题 | 低 | 高 | 降级到主线程处理 |
| 重构引入 bug | 中 | 中 | 渐进式修改，每步测试 |
| 性能优化效果不达预期 | 低 | 中 | 基准测试对比 |
| 大文件内存溢出 | 中 | 高 | 流式处理 + 分批处理 |

---

## 6. 成功标准

### 6.1 性能指标

| 指标 | 当前 | 目标 | 测量方法 |
|------|------|------|----------|
| 20MB 文件解析时间 | ~5s | <3s | console.time |
| 50MB 文件解析时间 | 浏览器卡死 | <10s | console.time |
| UI 阻塞时间 | 数秒 | <100ms | Performance API |
| 内存峰值 | 无上限 | <500MB | Chrome DevTools |

### 6.2 代码质量指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 单文件行数 | 3517 | <500 |
| 代码重复率 | ~30% | <10% |
| 测试覆盖率 | 0% | >60% |
| 全局变量数 | 50+ | <10 |

---

## 7. 设计批准

此设计文档经过以下审查：

- [x] 项目上下文已探索
- [x] 问题已识别和分类
- [x] 方案已对比和选择
- [x] 详细设计已制定
- [x] 风险评估已完成
- [x] 成功标准已定义

**下一步:** 使用 superpowers:writing-plans 创建详细实现计划

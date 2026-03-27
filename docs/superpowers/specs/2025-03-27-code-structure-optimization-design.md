# Excel 离线工具 - 代码结构优化设计文档 (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan after this design is approved.

**Goal:** 将 3684 行的单文件拆分为模块化结构，提升可维护性和测试性

**Architecture:** 分层架构 - 核心层、工具层、UI层分离

**Tech Stack:** ES6 Modules (IIFE fallback), 原生 JavaScript

---

## 1. 当前代码结构问题分析

### 1.1 规模问题

| 指标 | 当前值 | 目标值 | 问题 |
|------|--------|--------|------|
| 总行数 | 3684 行 | <500 行/文件 | 单文件过大 |
| 函数数 | 82 个 | <20 个/文件 | 职责不清晰 |
| 全局变量 | 395 个 | <20 个 | 命名空间污染 |
| 代码重复 | ~15% | <5% | 维护困难 |

### 1.2 架构问题

```
当前结构 (混乱):
┌─────────────────────────────────────┐
│           excel.html (3684行)        │
│  ┌─────────┬─────────┬───────────┐  │
│  │  UI逻辑  │ 工具函数 │ Excel处理 │  │
│  │  事件处理 │ 文件操作 │ 工作表操作 │ │
│  │  DOM操作 │ 验证函数 │ 数据处理  │  │
│  └─────────┴─────────┴───────────┘  │
│           全部混在一起               │
└─────────────────────────────────────┘
```

### 1.3 具体问题

1. **无模块化边界**
   - UI 渲染逻辑与业务逻辑混合
   - 文件处理与 DOM 操作耦合
   - 工具函数分散各处

2. **全局状态管理混乱**
   - `workbook`, `uploadedFiles`, `generatedFiles` 等全局变量
   - 状态修改逻辑分散在多个函数中
   - 难以追踪状态变化

3. **代码重复**
   - 深拷贝逻辑多处实现
   - 文件验证逻辑重复
   - 错误处理模式不一致

4. **测试困难**
   - 无单元测试
   - 函数间强耦合
   - 依赖浏览器环境

---

## 2. 优化方案

### 2.1 目标架构

```
优化后结构 (清晰):
┌──────────────────────────────────────────────────┐
│              excel.html (入口文件, ~200行)        │
│              - 页面结构                          │
│              - 初始化脚本                        │
└──────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   core/      │ │   utils/     │ │   ui/        │
│              │ │              │ │              │
│ • workbook   │ │ • file       │ │ • components │
│ • processor  │ │ • excel      │ │ • handlers   │
│ • cache      │ │ • validators │ │ • renderers  │
│ • constants  │ │ • dom        │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 2.2 模块划分

```
src/
├── core/
│   ├── constants.js       # 配置常量集中管理
│   ├── workbook-cache.js  # Workbook 缓存管理
│   ├── processor.js       # Excel 处理核心逻辑
│   └── state.js           # 全局状态管理
├── utils/
│   ├── file-utils.js      # 文件操作工具
│   ├── excel-utils.js     # Excel 相关工具
│   ├── dom-utils.js       # DOM 操作工具
│   └── validators.js      # 验证函数
├── ui/
│   ├── components.js      # UI 组件
│   ├── handlers.js        # 事件处理器
│   └── renderers.js       # 渲染函数
└── workers/
    └── excel-processor.worker.js  # (已存在)
```

---

## 3. 详细设计

### 3.1 核心层 (core/)

#### constants.js
```javascript
// 文件限制
export const FILE_LIMITS = {
  MAX_SINGLE_FILE_BYTES: 20 * 1024 * 1024,
  HARD_LIMIT_FILE_BYTES: 50 * 1024 * 1024,
  MAX_TOTAL_FILE_BYTES: 100 * 1024 * 1024,
  MAX_FILE_COUNT: 50,
  MAX_SHEET_COUNT: 200,
  MAX_UNIQUE_VALUES: 500,
};

// XLSX 配置
export const XLSX_READ_OPTIONS = { ... };
export const XLSX_WRITE_OPTIONS = { ... };

// UI 配置
export const UI_CONFIG = {
  WORKER_FILE_SIZE_THRESHOLD: 5 * 1024 * 1024,
  PROGRESS_UPDATE_INTERVAL: 200,
  CACHE_SIZE: 3,
};
```

#### state.js
```javascript
// 状态管理模块
class AppState {
  constructor() {
    this.state = {
      workbook: null,
      uploadedFiles: [],
      generatedFiles: [],
      currentMode: 'split-sheet',
      selectedSheets: new Set(),
      isProcessing: false,
    };
    this.listeners = new Map();
  }

  get(key) { return this.state[key]; }
  set(key, value) {
    this.state[key] = value;
    this.notify(key, value);
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
  }

  notify(key, value) {
    const callbacks = this.listeners.get(key) || [];
    callbacks.forEach(cb => cb(value));
  }
}

export const appState = new AppState();
```

### 3.2 工具层 (utils/)

#### file-utils.js
```javascript
export function formatFileSize(bytes) { ... }
export function sanitizeFileName(name) { ... }
export function ensureUniqueFileName(name, existingNames) { ... }
export function getFileId(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}
```

#### excel-utils.js
```javascript
export function getWorkbookSheetCount(workbook) { ... }
export function isWorksheetEffectivelyEmpty(worksheet) { ... }
export function validateHeaderConsistency(baseline, current, headerRows) { ... }
export function deepCopyCell(cell) { ... }
export function cloneWorksheet(worksheet) { ... }
```

### 3.3 UI 层 (ui/)

#### components.js
```javascript
export function createToast(message, type = 'info') { ... }
export function createProgressBar(percent, text) { ... }
export function createSheetList(sheets, options) { ... }
```

---

## 4. 迁移策略

### 4.1 渐进式迁移 (推荐)

```
步骤 1: 提取常量 (低风险)
   ├─ 将分散的常量移到 constants.js
   └─ 验证页面功能正常

步骤 2: 提取工具函数 (低风险)
   ├─ file-utils.js
   ├─ excel-utils.js
   └─ dom-utils.js

步骤 3: 重构状态管理 (中风险)
   ├─ 引入 AppState
   ├─ 逐步替换全局变量
   └─ 添加状态订阅

步骤 4: 分离 UI 层 (中风险)
   ├─ 提取渲染函数
   ├─ 提取事件处理器
   └─ 验证事件绑定

步骤 5: 清理主文件 (高风险)
   ├─ 删除已迁移的代码
   ├─ 统一入口
   └─ 全面测试
```

### 4.2 兼容性处理

由于项目是纯 HTML 文件，使用 ES6 Modules 需要处理兼容性：

```html
<!-- 方案 A: 使用 ES6 Modules -->
<script type="module" src="src/app.js"></script>

<!-- 方案 B: 使用 IIFE 打包 (推荐，兼容性更好) -->
<script src="dist/app.bundle.js"></script>
```

**推荐方案 B** - 保持单文件部署便利性：
- 开发时：模块化源码
- 构建时：Rollup 打包为单文件
- 部署时：继续使用单个 HTML

---

## 5. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 重构引入 bug | 中 | 高 | 每步测试，渐进迁移 |
| 模块加载失败 | 低 | 高 | IIFE 打包，兼容处理 |
| 性能下降 | 低 | 中 | 基准测试对比 |
| 浏览器兼容性 | 低 | 高 | 保持 ES5 兼容 |

---

## 6. 成功标准

### 6.1 结构指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 单文件最大行数 | 3684 | <500 |
| 单个模块函数数 | 82 | <20 |
| 全局变量数 | 395 | <20 |
| 模块数量 | 0 | 8+ |

### 6.2 质量指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 代码重复率 | ~15% | <5% |
| 圈复杂度 (平均) | 8+ | <5 |
| 函数长度 (平均) | 45行 | <20行 |
| 可测试函数比例 | 0% | >80% |

---

## 7. 设计批准

**审查清单:**
- [x] 代码结构问题已识别
- [x] 目标架构已设计
- [x] 模块划分已确定
- [x] 迁移策略已规划
- [x] 风险评估已完成
- [x] 成功标准已定义

**下一步:** 使用 superpowers:writing-plans 创建 Phase 2 实现计划

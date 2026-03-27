# Excel 离线工具 - Phase 2.5 模块集成设计

> **Goal:** 更新 excel.html 使用 ES6 模块，完成代码结构优化

---

## 1. 当前问题

### 1.1 excel.html 现状
- **行数:** ~3684 行
- **结构:** 内联脚本，未使用模块
- **问题:** 与提取的模块重复定义

### 1.2 需要解决的问题
1. 函数重复定义 (原函数 + 模块导出)
2. 全局变量过多
3. 未使用已提取的模块
4. 代码仍然难以维护

---

## 2. 集成方案

### 2.1 目标架构

```html
<!DOCTYPE html>
<html>
<head>
  <!-- 1. 加载外部库 -->
  <script src="lib/xlsx.bundle.js"></script>
  <script src="lib/jszip.min.js"></script>

  <!-- 2. 模块导入 -->
  <script type="module" src="src/app.js"></script>

  <!-- 3. 主应用脚本 -->
  <script type="module">
    import { initializeApp } from './src/app.js';
    document.addEventListener('DOMContentLoaded', initializeApp);
  </script>
</head>
<body>...</body>
</html>
```

### 2.2 渐进式迁移策略

```
Step 1: 保留原函数，添加模块导入
Step 2: 逐步替换函数调用
Step 3: 删除原函数定义
Step 4: 清理全局变量
```

### 2.3 兼容性方案

由于直接使用 ES6 模块可能破坏现有功能，采用 **IIFE + 模块** 混合方案：

```javascript
// 方案: 创建一个加载器脚本
// src/loader.js
(async function() {
  // 动态导入模块
  const modules = await import('./app.js');

  // 暴露到全局，供内联脚本使用
  window.ExcelTool = modules;

  // 初始化
  modules.initializeApp();
})();
```

---

## 3. 具体变更

### 3.1 更新 excel.html

在 `<head>` 中添加：

```html
<!-- 模块加载器 -->
<script type="module">
  import * as ExcelTool from './src/app.js';
  window.ExcelTool = ExcelTool;

  // 延迟初始化，等待 DOM 就绪
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ExcelTool.initializeApp?.());
  } else {
    ExcelTool.initializeApp?.();
  }
</script>
```

### 3.2 简化全局变量

当前全局变量：
```javascript
let workbook = null;
let uploadedFiles = [];
let generatedFiles = [];
let currentMode = 'split-sheet';
// ... 更多
```

优化后：
```javascript
// 使用状态管理器
const appState = new AppState();
```

### 3.3 删除重复代码

删除已迁移到模块的函数：
- ✅ WorkerPool 类 → 使用 `ExcelTool.WorkerPool`
- ✅ WorkbookCache 类 → 使用 `ExcelTool.WorkbookCache`
- ✅ dom-utils 函数 → 使用 `ExcelTool.DomUtils`
- ✅ file-utils 函数 → 使用 `ExcelTool.FileUtils`
- ✅ excel-utils 函数 → 使用 `ExcelTool.ExcelUtils`

---

## 4. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 模块加载失败 | 低 | 高 | 添加降级处理，保留原代码 |
| 浏览器不支持 | 低 | 高 | 使用 type="module"，现代浏览器支持 |
| 功能破坏 | 中 | 高 | 渐进式替换，每步测试 |

---

## 5. 成功标准

- [ ] excel.html 使用模块导入
- [ ] 删除重复代码 > 500 行
- [ ] 全局变量 < 50 个
- [ ] 功能完全正常

---

**Next:** 使用 superpowers:writing-plans 创建 Phase 2.5 实现计划

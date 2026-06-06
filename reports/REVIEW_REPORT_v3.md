# Excel 离线工具 — 第三轮审核报告

> 审核日期：2026-06-05
> E2E 测试：60/60 全部通过 ✅
> 方法：逐函数代码审查 + 逻辑推演 + 边界条件验证
> 原则：只报告有精确行号和复现路径的真 Bug

---

## 确认的真 Bug

### 🔴 Bug-A：`switchMode()` 中 5 个事件监听器每次切换模式重复绑定

**位置**：L3064-3077（`switchMode` 函数内部）

**代码**：
```javascript
// L3064 — 这一行有 removeEventListener，✅ 正确
document.getElementById('smartMergeRemoveDuplicates').addEventListener('change', function() {  // L3064 ❌
    toggleDedupColumnsSection();
});
document.getElementById('smartMergeDedupSelectAll').addEventListener('click', function() {      // L3067 ❌
    setAllDedupColumns(true);
});
document.getElementById('smartMergeDedupDeselectAll').addEventListener('click', function() {    // L3070 ❌
    setAllDedupColumns(false);
});
document.getElementById('dataPreviewClose').addEventListener('click', closeDataPreview);        // L3073 ❌
document.getElementById('dataPreviewModal').addEventListener('click', function(e) {             // L3074 ❌
    if (e.target.id === 'dataPreviewModal') closeDataPreview();
});
```

**问题**：`switchMode()` 每次被调用都会给这 5 个元素重新添加事件监听器，但没有先 `removeEventListener`。由于使用的是匿名函数（L3064/3067/3070/3074），即使想 `removeEventListener` 也无法匹配（匿名函数每次创建新引用）。只有 `closeDataPreview`（L3073）传的是命名函数引用，可以用 `removeEventListener`，但代码中没有做。

**影响**：
- 用户切换模式 N 次后，去重 checkbox 的 change 事件触发 N 次 `toggleDedupColumnsSection()`
- 预览关闭按钮点击一次执行 N 次 `closeDataPreview()`
- 内存泄漏（事件处理函数闭包持有 DOM 引用）

**复现路径**：
1. 打开工具，默认在 split-sheet 模式
2. 点击"智能合并大师"（第 1 次 switchMode）→ 1 次绑定
3. 点击"按工作表拆分"（第 2 次 switchMode）→ 2 次绑定
4. 点击"智能合并大师"（第 3 次 switchMode）→ 3 次绑定
5. 勾选"整行去重" checkbox → `toggleDedupColumnsSection()` 执行 3 次
6. 点击预览关闭按钮 → `closeDataPreview()` 执行 3 次

**修复方案**：将这 5 个 `addEventListener` 移到 `initializeApp()` 或 `DOMContentLoaded` 中，只绑定一次。与 L3061-3063 的 `smartMergeMode` 事件不同，这 5 个事件不依赖模式切换，全局只需绑定一次。

---

### 🔴 Bug-B：`dataPreviewModal` HTML 跨越 `</body></html>` 标签，关键子元素在文档外

**位置**：L9283-9297

**代码结构**：
```html
    </script>                          <!-- L9282: 脚本结束 -->
    <div id="dataPreviewModal" ...>    <!-- L9283: 模态框开始 ✓ -->
        <div ...>                      <!-- L9284: 内容容器 ✓ -->
            <div ...>标题栏</div>       <!-- L9285-9288 ✓ -->
            <div id="dataPreviewSheetTabs" ...></div>  <!-- L9289 ✓ -->
</body>                                <!-- L9290: body 结束 -->
</html>                                <!-- L9291: html 结束 -->
                                       <!-- ⬇ 以下在文档外 ⬇ -->
            <div style="padding:20px;overflow:auto;flex:1;">  <!-- L9293 -->
                <p id="dataPreviewHint" ...></p>               <!-- L9294 ❌ 在 </html> 外 -->
                <table id="dataPreviewTable" ...></table>       <!-- L9295 ❌ 在 </html> 外 -->
            </div>                                               <!-- L9296 -->
        </div>                                                   <!-- L9297 -->
    </div>                                                       <!-- L9298 (隐含) -->
```

**问题**：
1. 整个 `dataPreviewModal` 在 `</script>` 之后，不在 `<body>` 内
2. `</body></html>` 被插在了模态框 HTML 的中间（在 SheetTabs 之后、Hint+Table 之前）
3. 关键元素 `dataPreviewHint`（L9294）和 `dataPreviewTable`（L9295）在 `</html>` 之后

**影响**：
- Chrome/Edge 的容错机制通常会修复这种 HTML 错误，但行为不可靠
- Firefox 对 `</html>` 之后的内容解析更严格，可能不渲染 `dataPreviewTable`
- JS 代码中 `document.getElementById('dataPreviewTable')`（L9200、L9223）可能返回 `null`
- 如果 `dataPreviewTable` 返回 `null`，L9223 的 `table.innerHTML = html` 会抛出 TypeError

**复现路径**：
1. 上传 2 个 Excel 文件（合并模式）
2. 点击某个文件的"👁 预览"按钮
3. 在 Firefox 中：预览弹窗可能显示但表格区域为空，控制台报 `Cannot set property 'innerHTML' of null`
4. 在 Chrome 中：由于容错机制，可能正常显示

**修复方案**：将 L9283-9298 的全部 `dataPreviewModal` HTML 移到 `<body>` 结束标签之前（L9290 之前）。

---

### 🟠 Bug-C：`performSmartMerge()` 中残留 3 个空 JSDoc 注释块

**位置**：L6595-6597

**代码**：
```javascript
async function performSmartMerge() {
    if (isProcessing) {
        showToast('正在处理中，请稍候...', 'warning');
        return;
    }

/** 根据去重复选框状态显示/隐藏列选择区域 */     // L6595 ← 空注释

/** 刷新去重列列表（从第一个选中的工作表获取列名） */ // L6597 ← 空注释

/** 全选/取消全选去重列 */                         // L6599 ← 空注释

    isProcessing = true;                           // L6601 实际逻辑开始
```

**问题**：上轮审核中 Bug-3（三个辅助函数被错误嵌入 `performSmartMerge` 内部）已修复——函数已移到外部。但残留了 3 个空 JSDoc 注释块在 `performSmartMerge` 的函数体内，位于 `if (isProcessing) { return; }` 和 `isProcessing = true;` 之间。

**影响**：
- 不影响功能（注释不会执行）
- 但 `isProcessing` 检查和 `isProcessing = true` 之间有 3 行空注释，如果有人认为 `isProcessing = true` 是紧接着 `return` 的，会误判逻辑流
- 代码阅读者可能困惑为什么函数开头有一段"文档注释"

**修复方案**：删除 L6595-6599 的 3 行空注释。

---

## 代码质量观察（非 Bug，但值得记录）

| # | 观察 | 说明 |
|---|------|------|
| O-1 | `renderPreviewSheet` 中 `ri === 0` 判断表头行 | L9235 — 只把第 1 行渲染为 `<th>`，多行表头场景下其余表头行会被渲染为 `<td>`，视觉区分不准确 |
| O-2 | `performSummaryMerge` 硬编码取第一个文件列名 | L7073 — 列名始终来自 `uploadedFiles[0]`，如果用户未选中第一个文件的工作表，列名可能与实际数据不匹配 |
| O-3 | 合并时 `sheet_to_json` 重建数据会丢失公式 | 所有合并模式（`performSheetDataMerge`、`performSmartMerge`）使用 `sheet_to_json` → 手动写入单元格，公式字段 `f` 丢失。这是已知限制，但 UI 没有明确提示用户 |
| O-4 | `performSmartMerge` 模式 B 中 Sheet 名使用归一化后的名称 | L6900 — `safeName` 基于 `gName`（归一化后的小写名称），不是原始 Sheet 名。用户看到的输出 Sheet 名可能是小写的，与原始不符 |

---

## 上轮 Bug 修复验证

| 上轮 Bug | 修复状态 | 验证结果 |
|----------|---------|---------|
| Bug-1 `resetTool` 重复绑定事件 | ✅ 已修复 | L2995-3027 中 `resetTool` 不再包含任何 `addEventListener` |
| Bug-2 `collectCurrentTemplateConfig` 重复绑定事件 | ✅ 已修复 | L3184-3213 中不再包含 `addEventListener` |
| Bug-3 `performSmartMerge` 结构混乱 | ⚠️ 部分修复 | 函数已移出，但残留 3 个空注释（Bug-C） |
| Bug-4 `showMergePreview` 被截断 | ✅ 已修复 | L9113-9193 函数完整 |
| Bug-5 `dataPreviewModal` HTML 位置 | ❌ 未修复 | 仍然在 `</script>` 之后，且 `</body></html>` 被插在模态框中间（Bug-B） |
| Bug-6 单位换算错误 | ✅ 已修复 | L3369 现在用 `/10000` |
| Bug-7 布尔值处理 | ✅ 已修复 | 三处都加了 `typeof === 'boolean'` 分支 |

---

*报告结束*

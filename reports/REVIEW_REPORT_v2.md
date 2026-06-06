# Excel 离线工具 — 二次审核报告

> 审核日期：2026-06-05
> 审核方式：逐行代码审查 + E2E 测试 + 多视角推演
> E2E 测试结果：**60/60 全部通过** ✅
> 审核重点：**只确认真 Bug，每个 Bug 附带行号和复现路径**

---

## 一、确认的真 Bug 清单

### 🔴 Bug-1：`resetTool()` 中混入 `addEventListener`，每次重置重复绑定事件

**位置**：L2999-3002

**代码**：
```javascript
function resetTool() {
    if (processingAbortController) processingAbortController.abort();
    try {
        activeObjectURLs.forEach(function(url) { try { URL.revokeObjectURL(url); } catch(e) {} });
    document.getElementById('dataPreviewClose').addEventListener('click', closeDataPreview);  // ← BUG
    document.getElementById('dataPreviewModal').addEventListener('click', function(e) {       // ← BUG
        if (e.target.id === 'dataPreviewModal') closeDataPreview();
    });
        activeObjectURLs.length = 0;
```

**问题**：`dataPreviewClose` 和 `dataPreviewModal` 的事件监听器被放在 `resetTool()` 的 `try` 块内部，每次用户点击"重新开始"都会再次绑定。N 次重置后，一个 click 事件会触发 N 次 `closeDataPreview()`。

**影响**：内存泄漏 + 行为异常（关闭预览时可能多次执行）。

**复现路径**：
1. 上传文件 → 拆分 → 重新开始（触发 resetTool）→ 重新开始 → 上传文件 → 拆分
2. 此时 `dataPreviewClose` 的 click 事件有 3 个监听器（1 次初始 + 2 次 resetTool）
3. 点击关闭按钮，`closeDataPreview()` 执行 3 次

**修复**：将 L2999-3002 的 `addEventListener` 移到 `initializeApp()` 或 `DOMContentLoaded` 中，只绑定一次。

---

### 🔴 Bug-2：`collectCurrentTemplateConfig()` 中混入 `addEventListener`，每次保存模板重复绑定事件

**位置**：L3188-3196

**代码**：
```javascript
function collectCurrentTemplateConfig() {
    var config = { ... };
    headerInputs.forEach(function(id) { ... });
    document.getElementById('smartMergeRemoveDuplicates').addEventListener('change', function() {  // ← BUG
        toggleDedupColumnsSection();
    });
    document.getElementById('smartMergeDedupSelectAll').addEventListener('click', function() {     // ← BUG
        setAllDedupColumns(true);
    });
    document.getElementById('smartMergeDedupDeselectAll').addEventListener('click', function() {   // ← BUG
        setAllDedupColumns(false);
    });
```

**问题**：`collectCurrentTemplateConfig()` 是收集配置的纯函数，但内部混入了 3 个 `addEventListener`。每次保存模板（`saveTemplate()` → `collectCurrentTemplateConfig()`）都会重复绑定。

**影响**：N 次保存模板后，checkbox 的 change 事件触发 N 次 `toggleDedupColumnsSection()`。

**复现路径**：
1. 切换到智能合并模式
2. 保存模板 → 保存模板 → 保存模板（3 次）
3. 勾选"整行去重"checkbox
4. `toggleDedupColumnsSection()` 执行 4 次（1 次初始 + 3 次保存模板触发）

**修复**：将 L3188-3196 的 `addEventListener` 移到 `switchMode('smart-merge')` 或 `DOMContentLoaded` 中。

---

### 🔴 Bug-3：`performSmartMerge()` 函数体被截断，3 个辅助函数被错误嵌入

**位置**：L6530-6594

**代码**：
```javascript
async function performSmartMerge() {
    if (isProcessing) {
        showToast('正在处理中，请稍候...', 'warning');
        return;
    }
    // ← 函数在此处没有闭合大括号！

/** 根据去重复选框状态显示/隐藏列选择区域 */
function toggleDedupColumnsSection() { ... }  // ← 被嵌入 performSmartMerge 内部

/** 刷新去重列列表 */
function refreshDedupColumnsList() { ... }     // ← 被嵌入 performSmartMerge 内部

/** 全选/取消全选去重列 */
function setAllDedupColumns(checked) { ... }   // ← 被嵌入 performSmartMerge 内部

    isProcessing = true;                        // ← performSmartMerge 的真正逻辑从这里才开始
    processingAbortController = new AbortController();
    ...
```

**问题**：`performSmartMerge` 的函数体被截断，3 个辅助函数被意外嵌入了 `performSmartMerge` 的作用域内。虽然 JS 中函数声明会被提升（hoisting），在当前 IIFE 闭包内仍然可访问，但：
1. `performSmartMerge` 的函数签名和实际代码不匹配，违反直觉
2. 如果有人通过 `typeof performSmartMerge` 检查，它仍然是 `function`，但实际可执行性取决于代码如何被解析
3. 代码可读性极差，后续维护者可能误删除或误移动

**影响**：功能上可能仍可工作（函数声明提升），但这是一个严重的代码组织错误，极易在后续修改时引入真 Bug。

**修复**：将 `toggleDedupColumnsSection`、`refreshDedupColumnsList`、`setAllDedupColumns` 移到 `performSmartMerge` 之外，作为独立函数。

---

### 🔴 Bug-4：`showMergePreview()` 函数被 `showDataPreview()` 截断，函数体不完整

**位置**：L9104-9125 vs L9126

**代码**：
```javascript
function showMergePreview() {                              // L9104
    const el = document.getElementById('mergePreview');
    const content = document.getElementById('mergePreviewContent');
    if (!el || !content) return;
    if (currentMode !== 'merge-sheet') { el.style.display = 'none'; return; }
    const headerRows = ...;
    let totalSheets = 0;
    ...
    const sortedKeys = getSortedSelectedSheets();
    for (const key of sortedKeys) {
        const parsed = parseMergeSelectionKey(key);
        const file = uploadedFiles[parsed.fileIndex];       // L9125 — showMergePreview 的 for 循环在此处被截断！
function showDataPreview(fileIndex) {                        // L9126 — 新函数意外插入！
    ...
```

**问题**：`showMergePreview()` 函数的 for 循环在 L9125 处被 `showDataPreview` 函数截断。`showMergePreview` 的剩余代码（L9186-9241）变成了孤立代码，游离在任何函数之外。

**影响**：
1. **`showMergePreview` 调用必定报错** — 函数在 for 循环中间被截断，语法不完整
2. **L9186-9241 的孤立代码**：`if (!file) continue;` 不在任何函数内，如果是严格模式会报错；非严格模式下 `continue` 也会报 `Illegal continue statement` 语法错误
3. **`showDataPreview`、`renderPreviewSheet`、`closeDataPreview` 这三个函数虽然定义在错误位置，但由于函数声明提升，仍可被调用**

**复现路径**：
1. 上传 2 个文件
2. 切换到 merge-sheet 模式
3. 选择要合并的 Sheet
4. 观察：合并预览区域不会显示任何信息（因为 `showMergePreview` 函数不完整，调用时 JS 引擎会抛出 SyntaxError 或 ReferenceError）

**修复**：
1. 将 `showDataPreview`、`renderPreviewSheet`、`closeDataPreview` 三个函数移到 `showMergePreview` 之外
2. 将 L9186-9241 的孤立代码合并回 `showMergePreview` 的 for 循环内
3. 确保 `showMergePreview` 的 for 循环完整闭合

---

### 🔴 Bug-5：`dataPreviewModal` HTML 放在 `</body></html>` 之后

**位置**：L9273

**代码**：
```html
</body>
</html>

    <div id="dataPreviewModal" style="display:none;position:fixed;...">  ← 在 </html> 之后！
```

**问题**：`dataPreviewModal` 的 DOM 元素被放在了 `</body>` 和 `</html>` 标签之后。HTML5 规范中，`</html>` 之后的内容会被浏览器的错误恢复机制尝试解析，但行为不可预测：
- Chrome/Edge：通常会将其移入 `<body>` 内（容错处理）
- Firefox：可能不渲染
- Safari：行为不确定

**影响**：数据预览弹窗在某些浏览器中可能不显示。

**修复**：将 `dataPreviewModal` 的 HTML 移到 `<body>` 结束标签之前。

---

### 🟠 Bug-6：`checkCellCountWarning` 单位换算错误——"万"显示为"百万"

**位置**：L3369

**代码**：
```javascript
var cellCountMB = (totalCells / 1000000).toFixed(0);
addBoundaryWarning(warnings, '总单元格数约 ' + cellCountMB + ' 万（超过 200 万建议上限）...');
```

**问题**：`totalCells / 1000000` 得到的是"百万"单位，但提示文字写的是"万"。例如：
- `totalCells = 2,500,000`
- `2,500,000 / 1,000,000 = 2.5`
- `toFixed(0)` = `"3"`
- 提示："总单元格数约 3 万" — 但实际是 250 万！

**正确换算**：应该是 `totalCells / 10000`（万），或者改为"百万"单位。

**修复**：
```javascript
var cellCountWan = (totalCells / 10000).toFixed(0);
addBoundaryWarning(warnings, '总单元格数约 ' + cellCountWan + ' 万（超过 200 万建议上限）...');
```

---

### 🟠 Bug-7：合并时布尔值 `false` 被转为字符串 `"false"`，空字符串被丢弃

**位置**：L6285-6289（performSheetDataMerge）、L6686-6690（performSmartMerge 模式A）、L6856-6862（performSmartMerge 模式B）

**代码**（以 L6285-6289 为例）：
```javascript
if (typeof sdm_val === 'number') {
    mergedWs[sdm_cellAddr] = { t: 'n', v: sdm_val };
} else if (sdm_val !== undefined && sdm_val !== null && sdm_val !== '') {
    mergedWs[sdm_cellAddr] = { t: 's', v: String(sdm_val) };
}
```

**问题**：
1. **布尔值 `false`**：`typeof false !== 'number'` 为 true，进入第二个分支 → `String(false)` = `"false"` → 单元格显示 "false" 而非 FALSE
2. **布尔值 `true`**：同理，显示 "true" 而非 TRUE
3. **空字符串 `''`**：`sdm_val !== ''` 为 false → 被跳过，不写入单元格 → 丢失空字符串语义

**修复**：
```javascript
if (typeof sdm_val === 'number') {
    mergedWs[sdm_cellAddr] = { t: 'n', v: sdm_val };
} else if (typeof sdm_val === 'boolean') {
    mergedWs[sdm_cellAddr] = { t: 'b', v: sdm_val };
} else if (sdm_val !== undefined && sdm_val !== null) {
    mergedWs[sdm_cellAddr] = { t: 's', v: String(sdm_val) };
}
```

---

## 二、代码质量观察（非 Bug，但值得关注）

| # | 观察 | 位置 | 说明 |
|---|------|------|------|
| Q-1 | `performSmartMerge` 中 `isProcessing` 检查和 `isProcessing = true` 之间插入了 3 个函数定义 | L6530-6595 | 虽然 JS 函数声明提升使功能不受影响，但代码结构混乱，强烈建议重构 |
| Q-2 | `.style.display` 直接操作仍有约 30 处 | 各处理函数 | `generateSplitFiles`、`performMerge`、`performSmartMerge` 等核心函数仍用 `.style.display` 而非 `csShow/csHide` |
| Q-3 | `renderPreviewSheet` 中 `ri === 0` 判断表头行不够精确 | L9166 | 如果 `headerRows > 1`，只有第 1 行被渲染为 `<th>`，其余表头行被渲染为 `<td>` |
| Q-4 | 孤立代码 L9186-9241 中的 `continue` 语句不在循环内 | L9186 | 如果 `showMergePreview` 被修复，这些代码应该回到 for 循环内部 |
| Q-5 | `showDataPreview` 每次点击预览按钮都会为每个 Sheet 添加 click 监听器 | L9140-9148 | 多次点击预览后，Sheet 切换按钮的事件监听器会累积 |

---

## 三、E2E 测试覆盖缺口

以下场景没有被现有 60 个 E2E 测试覆盖，但存在 Bug 风险：

| 缺口 | 模式 | 说明 |
|------|------|------|
| `showMergePreview` 调用 | merge-sheet | 由于 Bug-4，此函数实际不可用，但没有测试覆盖到 |
| 布尔值单元格 | 全局 | 合并含 TRUE/FALSE 值的 Excel 文件后验证输出 |
| `resetTool` 重复操作 | 全局 | 多次"重新开始"后事件绑定累积 |
| 保存模板后去重 UI | smart-merge | 保存模板 3 次后勾选去重复选框，验证不重复触发 |
| 数据预览弹窗 | 全局 | 新增的数据预览功能没有 E2E 测试 |

---

## 四、修复优先级

| 优先级 | Bug | 风险 | 修复难度 |
|--------|-----|------|---------|
| 🔴 P0 | Bug-4 `showMergePreview` 被截断 | 函数调用报错，合并预览功能完全失效 | 中 — 需拆分函数+重组代码 |
| 🔴 P0 | Bug-5 模态框 HTML 在 `</html>` 之外 | 部分浏览器数据预览不显示 | 低 — 移动 HTML 位置 |
| 🔴 P0 | Bug-1 `resetTool` 重复绑定事件 | 内存泄漏+行为异常 | 低 — 移动 addEventListener |
| 🟠 P1 | Bug-2 `collectCurrentTemplateConfig` 重复绑定事件 | 多次保存模板后行为异常 | 低 — 移动 addEventListener |
| 🟠 P1 | Bug-6 单位换算错误 | 用户被误导（显示 3 万实际 250 万） | 极低 — 改一个除数 |
| 🟠 P1 | Bug-7 布尔值和空字符串处理错误 | 合并后数据失真 | 低 — 增加 boolean 类型判断 |
| 🟡 P2 | Bug-3 `performSmartMerge` 结构混乱 | 当前不影响功能，但维护风险高 | 中 — 需重构函数位置 |

---

*报告结束*

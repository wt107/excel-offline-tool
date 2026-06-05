# Bug修复计划：excel.html 已确认缺陷修复

## TL;DR

> **Quick Summary**: 修复两轮AI评测中已验证的19项已确认缺陷，覆盖数据级错误（来源列漂移、僵尸UI、31字符越界）到代码质量改进。保持单文件交付，不拆分。
>
> **Deliverables**:
> - 修复5个P0级bug（数据完整性/功能无效）
> - 修复9个P1级bug（功能正确性/边界处理）
> - 修复5个P2级改进（代码质量/可维护性）
> - 追加自测用例（T123-T135）
> - 全部修复通过现有自测 + 新增自测
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: 无严格依赖链，大部分可并行

---

## Context

### Original Request

用户收到两份AI评测报告，经我逐行验证后确认以下待修复项：

### Bug清单验证状态

```
通过验证 28/29 项 | 1项分析不成立 | 准确率 83%+
```

**不合格项（不修复）**:
- Defect-20: shiftFormulaRefs 正则边界 — 分析错误，逻辑正确

**P0 数据级/功能级错误**（5项）:
| Bug | 位置 | 问题 |
|-----|------|------|
| Bug-1 来源列漂移 | L5206-5207 | 合并时来源列位置随maxColumns变化，数据错位 |
| Bug-3 preserveStyles | L1196 | 复选框无任何JS代码读取，完全无效 |
| Bug-9 31字符越界 | L2776-2786 | 截断到31后加后缀>31，违反Excel限制 |
| Bug-4 sort原地修改 | L1901 | Array.sort()修改调用方原数组 |
| Bug-6 重复showToast | L4593-4594 | 完全重复代码行 |

**P1 功能正确性**（9项）| 见下方TODOs

**P2 代码质量**（5项）| 见下方TODOs

### 已验证的现有测试体系
- **内嵌自测**: T01-T122 (122项)，覆盖核心函数、边界条件、回归场景
- **Playwright E2E**: 8个spec，覆盖全部5种模式
- **触发方式**: `?selftest=1` URL参数

---

## Work Objectives

### Core Objective
修复excel.html中所有已确认的19项缺陷，不改变现有功能行为，保持单文件交付。

### Definition of Done
- [ ] 所有P0 bug修复且通过自测
- [ ] 所有P1 bug修复且通过自测  
- [ ] 新增自测用例 T123-T135 全部通过
- [ ] 现有 T01-T122 自测全部通过
- [ ] 手动打开 `?selftest=1` 显示全部通过

### Must Have
- Bug-1来源列漂移必须修复（数据完整性问题）
- Bug-3 preserveStyles必须处理（不能留僵尸UI）
- Bug-9 31字符越界必须修复（违反Excel规范）
- 现有所有T01-T122自测必须仍然通过
- 保持单文件HTML交付

### Must NOT Have (Guardrails)
- 不要拆分excel.html为多文件
- 不要重构架构（仅修复bug，不改变函数签名/整体结构）
- 不要改变现有功能行为（仅修复bug）
- 不要删除现有自测用例
- 不要引入新外部依赖

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (T01-T122 + 8 E2E specs)
- **Automated tests**: Tests-after (追加T123-T135到自测系统)
- **Framework**: 内建自测系统 + Playwright E2E

### QA Policy
每个任务必须包含：
1. 修改后的代码与现有自测的兼容性验证
2. 涉及新行为的，追加自测用例
3. 人工在浏览器中打开 `?selftest=1` 验证全部通过

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (8 tasks - P0全部 + P1微修复):
├── Task 1: Bug-1 来源列漂移 [关键修复]
├── Task 2: Bug-3 preserveStyles 处理
├── Task 3: Bug-9 getUniqueSheetName 31字符越界
├── Task 4: Bug-4 columnsToKeep.sort 原地修改
├── Task 5: Bug-6 重复 showToast 删除
├── Task 6: Defect-7 getHeaderRowCount fallback
├── Task 7: Defect-12 beforeunload 逻辑
└── Task 8: Defect-17 slideIn 类缺失

Wave 2 (7 tasks - P1主要修复):
├── Task 9: Bug-2 downloadAllFiles URL管理
├── Task 10: Bug-5 performFileMerge 清空DOM
├── Task 11: Defect-10 displayName 匹配key
├── Task 12: Defect-13 WorkbookCache 未清理
├── Task 13: Defect-16 cloneWorksheet 降级路径
├── Task 14: Defect-18 style.display 混用
└── Task 15: Defect-11 escapeHtml 正斜杠

Wave 3 (4 tasks - P2 + 测试):
├── Task 16: Defect-14 checkMemoryUsage
├── Task 17: Struct-26 清理修复标记噪声
├── Task 18: Struct-27 重命名 _i 变量
└── Task 19: 追加自测用例 T123-T135

Wave FINAL (4 parallel reviews):
├── F1: Plan Compliance Audit (oracle)
├── F2: 代码质量审查 (unspecified-high)
├── F3: 完整自测执行 + 证据 (quick)
└── F4: 范围一致性检查 (deep)
```

Critical Path: 无严格依赖链

---

## TODOs

- [ ] 1. **Bug-1: 修复来源列位置漂移（performSheetDataMerge）**

  **What to do**:
  - 定位 L5206-5207 `performSheetDataMerge` 的 else 分支
  - 当前代码：
    ```javascript
    maxColumns = Math.max(maxColumns, getMaxColumnCount(sdm_json));
    var sourceColIdx2 = maxColumns;
    ```
  - 问题：`sourceColIdx2` 在每次迭代中随 `maxColumns` 变化，导致不同文件的来源列位置不一致
  - 修复：在 baseline 处理时（L5181）预先计算出**最终**来源列位置，存储为 `fixedSourceColIdx`，后续所有追加都使用这个固定位置
  - 具体修改：
    1. 在 baseline 初始化时：遍历所有文件计算 `maxColumns` 最大值（或将 `sourceColIdx` 和 `sourceColIdx2` 统一为同一个固定值）
    2. 更简洁的方案：在 else 分支**不重新计算** `sourceColIdx2 = maxColumns`，改为使用 baseline 中的 `sourceColIdx`。但需注意 baseline 初始化时 `sourceColIdx = Math.max(maxColumns, srcColCount)`，这个值已经考虑了第一个文件的列数
    3. 修正后的 else 分支应为：记录一个 `fixedSourceCol = sourceColIdx`（第一次迭代设定的值），else 分支用这个固定值
  - 还要处理列扩展问题：如果后续文件列数多于 baseline，需要先扩展 `mergedWs` 中已有行的列范围

  **Must NOT do**:
  - 不要改变已有行的数据内容
  - 不要改变 `generateSplitFiles` 等其他函数

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`（非典型，但此修复需要精确的数据操作能力，且有竞品分析经验）
  - **Skills**: []（不需要额外技能）
  - Reason: 此修复涉及数据合并逻辑的精确推演和修改

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-8)
  - **Blocks**: Task 19（自测追加依赖于fix完成）
  - **Blocked By**: None (can start immediately)

  **References**:
  - `excel.html:5173-5198` - Baseline分支代码，固定sourceColIdx
  - `excel.html:5206-5224` - else分支代码，sourceColIdx2随maxColumns变化
  - `excel.html:5148-5151` - 函数局部变量声明

  **Acceptance Criteria**:
  - [ ] 验证：构造文件A（3列）和文件B（5列）合并，检查来源列在同一列
  - [ ] 验证：构造文件A（5列）和文件B（3列）合并，来源列在同一列

  **QA Scenarios**:
  ```
  Scenario: 不同列数文件合并，来源列位置统一
    Tool: interactive_bash (浏览器打开excel.html)
    Preconditions: 准备好两个xlsx文件，一个3列+1个5列数据
    Steps:
      1. 打开excel.html，选择"工作表数据合并"模式
      2. 上传文件A（3列）和文件B（5列）
      3. 全选工作表，点击生成
      4. 下载生成的合并文件
    Expected Result: 来源列在所有行中位于同一列
    Evidence: .omo/evidence/task-1-source-column-consistency.png
  ```

  **Evidence to Capture**:
  - [ ] 修改前后的代码diff截图
  - [ ] 合并结果文件中来源列在同一列的验证

  **Commit**: YES
  - Message: `fix: 修复performSheetDataMerge来源列位置漂移bug`
  - Files: `excel.html`

---

- [ ] 2. **Bug-3: 处理 preserveStyles 僵尸复选框**

  **What to do**:
  - **方案（用户确认）**: 从HTML中删除preserveStyles复选框及其label和hint文本
    - 原因：跨工作簿合并时保留格式需要处理样式索引冲突，该功能从未实现也不易正确实现
    - 影响：不影响任何功能，仅删除一个从未起作用的UI元素

  **Must NOT do**:
  - 不要影响现有的样式剥离逻辑
  - 不要破坏现有的跨工作簿安全性（不保留样式索引）

  **Recommended Agent Profile**:
  - **Category**: `quick`（简单删除或简单实现）
  - **Skills**: []（不需要额外技能）
  - Reason: 无论是删除UI还是实现功能，都是范围明确的修改

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-8)
  - **Blocks**: None
  - **Blocked By**: None (can start immediately)

  **References**:
  - `excel.html:1195-1198` - preserveStyles checkbox的HTML代码
  - `excel.html:1455-1504` - deepCopyCell的stripStyle/stripAllStyles选项
  - `excel.html:6383-6388` - T118测试用例，测试stripStyle行为

  **Acceptance Criteria**:
  - [ ] 复选框被移除或功能被正确实现
  - [ ] 所有现有自测仍然通过

  **QA Scenarios**:
  ```
  Scenario: preserveStyles复选框不可见（Option A）
    Tool: interactive_bash
    Preconditions: 打开excel.html
    Steps:
      1. 打开excel.html
      2. 选择"工作表数据合并"模式
      3. 查看 step3 配置区域
    Expected Result: "保留单元格格式"复选框不存在
    Evidence: .omo/evidence/task-2-no-preserveStyles-checkbox.png
  ```

  **Evidence to Capture**:
  - [ ] 复选框被移除或功能实现的截图

  **Commit**: YES（与Task 1同组或单独）
  - Message: `fix: 移除preserveStyles僵尸UI复选框`
  - Files: `excel.html`

---

- [ ] 3. **Bug-9: 修复 getUniqueSheetName 31字符越界**

  **What to do**:
  - 定位 L2776-2788 `getUniqueSheetName` 函数
  - 问题：如果 `name` 被截断到31字符（L2777），后续 `name + '_' + counter` 必然超过31字符
  - 修复：在截断时预留后缀空间，例如后缀 `_99` 需要3个字符，应截断到28字符
    ```javascript
    if (name.length > 31) {
        name = name.substring(0, 28); // 预留3字符给后缀 "_99"
    }
    ```
    或用更精确的方式：`name = name.substring(0, 31 - suffixMaxLength)`
  - 同时确保 `Date.now()` fallback（L2788）也符合31字符限制

  **Must NOT do**:
  - 不要改变函数的返回值类型或签名
  - 不要影响无冲突时的正常路径（L2781直接返回name）

  **Recommended Agent Profile**:
  - **Category**: `quick`（单函数逻辑修复）
  - **Skills**: []
  - Reason: 范围极小，逻辑清晰的单行修改

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4-8)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:2771-2789` - 完整函数代码
  - Excel规范：Sheet名最大31字符

  **Acceptance Criteria**:
  - [ ] `getUniqueSheetName(['abc...29chars...'], 'abc...29chars...', 0)` 调用结果不超过31字符
  - [ ] `getUniqueSheetName(['a'], 'a' + 'x'.repeat(30), 0)` 调用结果不超过31字符

  **QA Scenarios**:
  ```
  Scenario: 超长Sheet名截断后不超过31字符
    Tool: Bash (Node.js)
    Preconditions: excel.html已修改
    Steps:
      1. 在浏览器打开 excel.html?selftest=1
      2. 检查自测中新增的测试用例结果
    Expected Result: 新测试用例通过
    Evidence: .omo/evidence/task-3-sheetname-length.png
  ```

  **Evidence to Capture**:
  - [ ] 修复后的函数代码
  - [ ] 自测通过

  **Commit**: YES
  - Message: `fix: 修复getUniqueSheetName 31字符截断后越界`
  - Files: `excel.html`

---

- [ ] 4. **Bug-4: 修复 columnsToKeep.sort 原地修改**

  **What to do**:
  - 定位 L1901 `copyWorksheetByDeletion` 函数
  - 当前代码：
    ```javascript
    colsToProcess = columnsToKeep.sort(function(a, b) { return a - b; });
    ```
  - `Array.prototype.sort()` 是 in-place 操作，修改 `columnsToKeep` 原数组
  - 修复：先克隆再排序
    ```javascript
    colsToProcess = columnsToKeep.slice().sort(function(a, b) { return a - b; });
    ```

  **Must NOT do**:
  - 不要改变排序逻辑本身

  **Recommended Agent Profile**:
  - **Category**: `quick`（一行代码修改）
  - **Skills**: []
  - Reason: 最小化修改

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-8)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:1898-1907` - 上下文代码

  **Acceptance Criteria**:
  - [ ] 代码修改正确（`.sort()` 前加 `.slice()`）
  - [ ] 所有现有自测通过

  **QA Scenarios**:
  ```
  Scenario: columnsToKeep不被原地修改
    Tool: 无需单独测试（通过自测覆盖）
    Preconditions: 修复后
    Steps:
      1. 运行自测 T01-T122
    Expected Result: 全部通过
    Evidence: .omo/evidence/task-4-selftest-pass.png
  ```

  **Evidence to Capture**:
  - [ ] 修改前后的代码diff

  **Commit**: YES（与Task 3同组）
  - Message: `fix: 修复columnsToKeep.sort原地修改调用方数组`
  - Files: `excel.html`

---

- [ ] 5. **Bug-6: 删除重复 showToast 调用**

  **What to do**:
  - 定位 L4593-4594
  - 删除重复的第二行 `showToast(...)`
  - 注意检查周围代码，确保没有其他逻辑依赖这个重复调用

  **Must NOT do**:
  - 不要删除第一行showToast（这是正确的调用）

  **Recommended Agent Profile**:
  - **Category**: `quick`（删除一行重复代码）
  - **Skills**: []
  - Reason: 最简单的修改

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:4593-4594` - 重复代码

  **Acceptance Criteria**:
  - [ ] 重复行被删除
  - [ ] 所有自测通过

  **Evidence to Capture**:
  - [ ] 修复后的代码片段

  **Commit**: YES（与Task 4同组）
  - Message: `fix: 删除重复的showToast调用`
  - Files: `excel.html`

---

- [ ] 6. **Defect-7: 修复 getHeaderRowCount fallback 参数**

  **What to do**:
  - 定位 L2613-2618 `getHeaderRowCount` 函数
  - 当前代码：当 `rawValue <= 0` 时硬编码返回 `1`，忽略 `fallback` 参数
  - 修复：将硬编码 `return 1` 改为 `return fallback`
  - 函数签名为 `function getHeaderRowCount(inputId, fallback = 1)`，默认值已经是1，所以对现有调用无影响

  **Must NOT do**:
  - 不要改变函数的默认行为（因为 fallback 默认值为1，行为不变）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 极小修改

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:2613-2622` - 完整函数

  **Acceptance Criteria**:
  - [ ] 调用 `getHeaderRowCount('id', 0)` 时返回0而非1
  - [ ] 默认调用 `getHeaderRowCount('id')` 仍返回1

  **Evidence to Capture**:
  - [ ] 修改前后的代码diff

  **Commit**: YES（与Task 5同组）
  - Message: `fix: 修复getHeaderRowCount忽略fallback参数`
  - Files: `excel.html`

---

- [ ] 7. **Defect-12: 修复 beforeunload 逻辑不准确**

  **What to do**:
  - 定位 L2437-2444 beforeunload 事件处理
  - 问题：`generatedFiles.length > 0` 在下载完成后仍为 true，导致已下载的用户仍被提示"未保存"
  - 修复：增加 `hasDownloaded` 标志控制
    ```javascript
    // 在全局状态区添加：
    let hasDownloaded = false;
    
    // 在 beforeunload 检查中添加：
    if (workbook || uploadedFiles.length > 0 || (generatedFiles.length > 0 && !hasDownloaded)) { ... }
    
    // 在 downloadAllFiles 末尾设置：
    hasDownloaded = true;
    
    // 在 resetTool 中重置：
    hasDownloaded = false;
    ```

  **Must NOT do**:
  - 不要完全移除 beforeunload 提示（对于未下载的用户仍有价值）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 清晰的逻辑修复

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:2437-2444` - beforeunload处理
  - `excel.html:6636-6649` - downloadAllFiles函数

  **Acceptance Criteria**:
  - [ ] 下载完成后关闭页面不再提示
  - [ ] 未下载时关闭页面仍提示
  - [ ] 重置后重新生成但不下载，关闭页面仍提示

  **QA Scenarios**:
  ```
  Scenario: 下载后关闭页面无提示
    Tool: 仅在浏览器中手动验证
    Preconditions: 修复后
    Steps:
      1. 处理一个文件并下载
      2. 关闭标签页
    Expected Result: 无"未保存数据"提示
  ```

  **Evidence to Capture**:
  - [ ] 修改前后的代码diff

  **Commit**: YES（与Task 6同组）
  - Message: `fix: 修复beforeunload下载后仍提示的问题`
  - Files: `excel.html`

---

- [ ] 8. **Defect-17: 添加 slideIn CSS 类或修正 progressToast 动画**

  **What to do**:
  - 定位 L3153 `progressToast.classList.add('slideIn')` 和 CSS 动画
  - 问题：CSS中有 `@keyframes slideIn`（L465）但没有 `.slideIn` 类
  - 修复方式A（推荐）：添加 CSS 类 `.slideIn` 引用已有动画
    ```css
    .slideIn {
        animation: slideIn 0.3s ease;
    }
    ```
  - 修复方式B：直接删除 L3153 的 `classList.add('slideIn')`（如果动画效果不重要）

  **Must NOT do**:
  - 不要破坏已有的 `.toast` 类动画（L445使用内联 `animation: slideIn 0.3s ease`）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: CSS单行添加或JS单行删除

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:465` - @keyframes slideIn 定义
  - `excel.html:445` - toast默认动画
  - `excel.html:3153` - classList.add('slideIn')

  **Acceptance Criteria**:
  - [ ] 动画类被正确添加或classList.add被移除
  - [ ] 所有自测通过

  **Evidence to Capture**:
  - [ ] 修改后的CSS代码

  **Commit**: YES（与Task 7同组）
  - Message: `fix: 添加缺失的.slideIn CSS类定义`
  - Files: `excel.html`

---

- [ ] 9. **Bug-2: 修复 downloadAllFiles ObjectURL 管理**

  **What to do**:
  - 定位 L6636-6649 `downloadAllFiles` 函数
  - 问题：`URL.createObjectURL(blob)` 创建的URL未加入 `activeObjectURLs`，resetTool或批量管理时无法跟踪
  - 修复：
    1. 在 `createObjectURL` 后 `activeObjectURLs.push(url)`
    2. 在 setTimeout 回调中，revoke后从 `activeObjectURLs` 移除
    3. 将 setTimeout 的 timer 加入 `pendingRevokeTimers`
  - 参考已经存在的管理模式（L2562-2565 resetTool 中的清理方式）

  **Must NOT do**:
  - 不要改变下载功能本身（blob创建、a标签点击等逻辑保持不变）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 逻辑清晰，参考现有模式的添加

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 10-15)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:6636-6649` - downloadAllFiles函数
  - `excel.html:1359,2562-2565` - activeObjectURLs管理和resetTool清理模式

  **Acceptance Criteria**:
  - [ ] downloadAllFiles创建的URL加入activeObjectURLs
  - [ ] setTimeout revoke后正确从activeObjectURLs移除
  - [ ] resetTool能正确清理这些URL

  **QA Scenarios**:
  ```
  Scenario: resetTool清理downloadAllFiles创建的URL
    Tool: Browser + console
    Preconditions: 修复后
    Steps:
      1. 处理一个文件
      2. 点击下载
      3. 立即点击"重新开始"
    Expected Result: URL被立即释放，下载链接不再有效
    Evidence: .omo/evidence/task-9-url-management.png
  ```

  **Evidence to Capture**:
  - [ ] 修改后的代码

  **Commit**: YES
  - Message: `fix: 修复downloadAllFiles未纳入activeObjectURLs管理`
  - Files: `excel.html`

---

- [ ] 10. **Bug-5: 修复 performFileMerge 清空DOM导致状态断裂**

  **What to do**:
  - 定位 L5119-5132 `resetTool` 函数（已被 `performFileMerge` 调用？需要确认是 `performFileMerge` 还是 `resetTool`）
  - 实际代码位置：`resetTool()` L2560-2574 清空了多个DOM元素和输入值
  - 问题影响：用户从结果页（step4）点"上一步"回到step3，DOM已被清空导致不一致
  - 修复思路：
    1. `resetTool` 不清空DOM元素内容（仅重置状态变量）
    2. 或：将DOM清空逻辑移到新的 `resetUI()` 函数中，只在真正的"重置"（confirmResetTool）时调用
    3. 或：确保回到step3时能重新渲染（已有 `displayMergeSheetSelection()` 等渲染函数）
  - 最佳方案：`resetTool` 应该只重置状态，不操作DOM。DOM清理由 `confirmResetTool` 和 `switchMode` 负责

  **Must NOT do**:
  - 不要完全移除DOM清空逻辑（切换模式时仍需清理界面）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: 需要理解resetTool的多处调用场景

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:2560-2574` - resetTool函数
  - `excel.html:6621-6625` - confirmResetTool调用resetTool
  - `excel.html:6584-6589` - switchMode调用resetTool

  **Acceptance Criteria**:
  - [ ] "上一步"后能看到之前上传的文件和配置
  - [ ] "重置"功能仍然能清理UI
  - [ ] 切换模式时UI能正确切换

  **Evidence to Capture**:
  - [ ] 修改后的代码

  **Commit**: YES
  - Message: `fix: 修复resetTool清空DOM导致步骤导航状态丢失`
  - Files: `excel.html`

---

- [ ] 11. **Defect-10: 修复 displayName 匹配 key 失败**

  **What to do**:
  - 定位 L5002 `phase4OutputManagement` 函数
  - 问题：`f.displayName === key` 中，`displayName` 是经 `sanitizeFileName` 处理过的（替换了特殊字符为_），而 `key` 是原始分组值
  - 修复方式A：修改 key 的生成方式，也对 key 做 `sanitizeFileName` 处理
  - 修复方式B（推荐）：在 `generatedFiles.push` 时将 `displayName` 和 `key` 统一，确保匹配逻辑可用
  - 最简单：检查 `phase4OutputManagement` 函数的实际用途。如果它只用于调试日志（L5004 `DEBUG && console.log`），且不影响功能，考虑移除这个验证块或修正匹配逻辑

  **Must NOT do**:
  - 不要破坏文件生成路径的 displayName 用途

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 单一匹配逻辑修复

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:4998-5006` - phase4OutputManagement验证逻辑
  - `excel.html:2719-2738` - sanitizeFileName函数
  - `excel.html:4545` - displayName生成位置

  **Acceptance Criteria**:
  - [ ] `displayName` 和 `key` 的匹配逻辑不再因文件名特殊字符而失败
  - [ ] 所有自测通过

  **Evidence to Capture**:
  - [ ] 修改后的代码diff

  **Commit**: YES（与Task 9同组）
  - Message: `fix: 修复displayName与key匹配因sanitizeFileName导致的失败`
  - Files: `excel.html`

---

- [ ] 12. **Defect-13: resetTool 中清理 WorkbookCache**

  **What to do**:
  - 定位 L2560 `resetTool` 函数
  - 问题：`workbookCache.clear()` 方法已存在（L2324-2327）但 `resetTool` 中未调用
  - 修复：在 `resetTool` 末尾或合适位置添加 `workbookCache.clear()`
  ```javascript
  function resetTool() {
      // ...existing code...
      workbookCache.clear();  // 添加：清理Workbook缓存
  }
  ```

  **Must NOT do**:
  - 不要在非重置场景（如切换模式）调用 `workbookCache.clear()`，这会导致重复解析

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 单行添加

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:2560-2574` - resetTool
  - `excel.html:2324-2327` - workbookCache.clear()方法
  - `excel.html:2341` - workbookCache实例化

  **Acceptance Criteria**:
  - [ ] resetTool调用后workbookCache被清空
  - [ ] 自测T13/T87（WorkbookCache相关）仍然通过

  **Evidence to Capture**:
  - [ ] 修改后的代码

  **Commit**: YES（与Task 10同组）
  - Message: `fix: resetTool中清理WorkbookCache，防止缓存假命中`
  - Files: `excel.html`

---

- [ ] 13. **Defect-16: 修复 cloneWorksheet 降级路径丢失非标准 ! 属性**

  **What to do**:
  - 定位 L3228-3234 `cloneWorksheet` 降级路径
  - 问题：`if (key.startsWith('!')) continue;` 跳过所有 `!` 属性，随后只手动添加 `!ref`
  - 修复：将降级路径改为显式复制所有 `!` 属性（除 `!ref` 已手动处理外）
  ```javascript
  // 降级路径
  const newWorksheet = {};
  for (var key in worksheet) {
      if (key.startsWith('!')) {
          // 保留所有!元数据属性
          if (key === '!ref') continue; // !ref稍后单独处理
          try { newWorksheet[key] = JSON.parse(JSON.stringify(worksheet[key])); }
          catch(e) { newWorksheet[key] = worksheet[key]; }
          continue;
      }
      if (worksheet.hasOwnProperty(key)) {
          newWorksheet[key] = deepCopyCell(worksheet[key]);
      }
  }
  newWorksheet['!ref'] = worksheet['!ref'];
  ```

  **Must NOT do**:
  - 不要修改主路径（cloneWorksheetCustom），它已正确处理

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: 需要理解SheetJS元数据属性

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:3220-3243` - cloneWorksheet完整函数

  **Acceptance Criteria**:
  - [ ] 降级路径仍正确复制所有单元格
  - [ ] 降级路径保留 `!merges`, `!cols`, `!rows`, `!fullref` 等元数据
  - [ ] 所有自测通过

  **Evidence to Capture**:
  - [ ] 修改后的代码

  **Commit**: YES（与Task 11同组）
  - Message: `fix: 修复cloneWorksheet降级路径丢失非标准!元数据属性`
  - Files: `excel.html`

---

- [ ] 14. **Defect-18: 统一 style.display 改为 CSP-safe 类切换**

  **What to do**:
  - 定位 L6691 `applySplitSheetFilter` 函数
  - 当前代码：`noMatchHint.style.display = (splitSheetSearchKeyword && visibleCount === 0) ? 'block' : 'none';`
  - 修复：改为使用项目中已有的 CSP-safe 工具类
  ```javascript
  // 替换为：
  if (splitSheetSearchKeyword && visibleCount === 0) {
      csShow(noMatchHint);
  } else {
      csHide(noMatchHint);
  }
  ```

  **Must NOT do**:
  - 不要改变搜索过滤逻辑本身

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 简单替换

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:6688-6693` - applySplitSheetFilter
  - `excel.html:2344-2368` - csShow/csHide函数定义

  **Acceptance Criteria**:
  - [ ] 搜索无匹配时正确显示"未找到"提示
  - [ ] 搜索有匹配时正确隐藏提示

  **Evidence to Capture**:
  - [ ] 修改后的代码

  **Commit**: YES（与Task 12同组）
  - Message: `fix: 统一style.display为CSP-safe的csShow/csHide`
  - Files: `excel.html`

---

- [ ] 15. **Defect-11: 删除 escapeHtml 中多余的正斜杠转义**

  **What to do**:
  - 定位 L2632 `escapeHtml` 函数
  - 问题：`replace(/\//g, '&#x2F;')` 在当前代码路径中不需要（所有插入都是通过 textContent 而非 innerHTML）
  - 修复：删除这一行，或将转义简化为只转义必要的字符（& < > " '）
  ```javascript
  function escapeHtml(text) {
      if (typeof text !== 'string') return text;
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                 .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
                 .replace(/'/g, '&#39;');
  }
  ```

  **Must NOT do**:
  - 不要删除其他必需的转义字符

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 删除一行

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:2627-2633` - escapeHtml函数

  **Acceptance Criteria**:
  - [ ] 函数仍然正确转义 & < > " '
  - [ ] 所有自测通过

  **Evidence to Capture**:
  - [ ] 修改后的代码

  **Commit**: YES（与Task 13同组）
  - Message: `refactor: 移除escapeHtml中多余的正斜杠转义`
  - Files: `excel.html`

---

- [ ] 16. **Defect-14: 重命名 checkMemoryUsage 或扩展其功能**

  **What to do**:
  - 定位 L6627-6634 `checkMemoryUsage` 函数
  - 问题：函数名暗示检查内存，实际只管理 ObjectURL 数量
  - 修复方式A（推荐）：重命名为 `pruneObjectURLs` 或 `cleanExpiredObjectURLs`，更准确地反映其功能
  - 修复方式B：实际添加内存检查（检查 `uploadedFiles` 数量和大小），并在接近限制时提示用户

  **Must NOT do**:
  - 不要移除 ObjectURL 管理功能

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 重命名或小幅扩展

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 17-19)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:6627-6634` - checkMemoryUsage
  - `excel.html:6636-6649` - downloadAllFiles中调用了checkMemoryUsage

  **Acceptance Criteria**:
  - [ ] 函数被正确重命名或扩展
  - [ ] 所有调用点使用新名称
  - [ ] 所有自测通过

  **Evidence to Capture**:
  - [ ] 修改后的代码

  **Commit**: YES
  - Message: `refactor: 重命名checkMemoryUsage为pruneObjectURLs以准确反映功能`
  - Files: `excel.html`

---

- [ ] 17. **Struct-26: 清理 P1/P2/T05/T06/T08 等修复标记注释噪音**

  **What to do**:
  - 在全文中搜索并清理以下模式的修复标记注释：
    - `// P1修复：`、`// P2修复：`、`// P3修复：` 等
    - `// T05修复：`、`// T06修复：`、`// T08修复：` 等
  - 对于有实际解释价值的注释，保留内容但去掉 `PX修复：` 前缀
  - 对于纯粹标记性注释（如 `// P1修复：删除重复索引`），直接删除
  - 需要检查的典型位置：
    - L688: `// P1修复：搜索结果为空时显示"未找到匹配"提示`
    - L2449, 2627, 2637, 3152, 3448, 3456等
    - 很多T*修复标记在测试代码中
  - 注意：不要删除功能注释或JSDoc

  **Must NOT do**:
  - 不要删除有实际解释价值的注释内容
  - 不要删除 JSDoc 注释
  - 不要修改代码逻辑

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: 需要逐行审查每个标记，判断是否可删除

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - 全文搜索 `// P\d修复`、`// T\d{2}修复` 定位所有标记

  **Acceptance Criteria**:
  - [ ] 删除或清理所有 P1/P2/P3/Txx 修复标记
  - [ ] 没有错误删除功能注释
  - [ ] 代码仍然可读

  **Evidence to Capture**:
  - [ ] 清理前后对比

  **Commit**: YES
  - Message: `refactor: 清理代码中的P1/P2/P3/Txx修复标记注释噪音`
  - Files: `excel.html`

---

- [ ] 18. **Struct-27: 重命名 _i 变量名为有意义的名称**

  **What to do**:
  - 查找并重命名所有 `_i[0-9]+` 模式的变量名：
    - `_i3127` → `si` 或 `sheetIndex`
    - `_i4679` → `ri` 或 `rowIdx`
    - `_i4726` → `fi` 或 `fileIdx`
    - `_i4740` → `si` 或 `sheetIdx`
    - `_i4777` → `idx` 或 `index`
    - `_i4821` → `gi` 或 `groupIdx`
    - `_i4841` → `ki` 或 `keyIdx`
  - 注意：确保不要重命名其他含 `_i` 的正常变量名
  - 每次替换后检查上下文，确保新名称不与作用域内的其他变量冲突

  **Must NOT do**:
  - 不要重命名不是 `_i\d+` 模式的变量
  - 不要改变代码逻辑

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: 7个变量需要逐个检查上下文

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html` 全文搜索 `_i\d{4,}` 定位所有变量

  **Acceptance Criteria**:
  - [ ] 所有 `_i` 变量被重命名
  - [ ] 没有引入变量名冲突
  - [ ] 所有自测通过

  **Evidence to Capture**:
  - [ ] 重命名列表对照

  **Commit**: YES（与Task 17同组）
  - Message: `refactor: 重命名_i数字变量名为有意义的名称`
  - Files: `excel.html`

---

- [ ] 19. **追加自测用例 T123-T135**

  **What to do**:
  - 在现有自测系统末尾（T122之后）追加新的测试用例：
  - **T123**: 来源列位置一致性测试 — 构造2个不同列数的合并，验证来源列在同一位置
  - **T124**: getUniqueSheetName 31字符限制测试 — 超长sheet名截断后<=31字符
  - **T125**: getHeaderRowCount fallback参数测试 — 传入0应返回fallback值
  - **T126**: columnsToKeep不被原地修改测试 — 调用sort后原数组不变
  - **T127**: sanitizeFileName displayName匹配测试
  - **T128**: WorkbookCache reset清理测试 — reset后cache为空
  - **T129**: cloneWorksheet降级路径保留!属性测试 — 构造异常触发降级路径
  - **T130**: escapeHtml 不转义非必要字符测试 — 正斜杠不被转义
  - **T131**: scrollWidth测试（如果有）
  - **T132-T135**: 回归测试 — 确保已有功能不被破坏
  - 格式遵循现有自测风格（`try { ... if (condition) pass('Txxx desc'); else fail(...) } catch(e) { fail(...) }`）
  - 编号从T123开始，确保与T122连续

  **Must NOT do**:
  - 不要删除或修改现有测试用例 T01-T122
  - 不要在测试中依赖外部服务

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 自测系统已成熟，追加用例模式固定

  **Parallelization**:
  - **Can Run In Parallel**: YES（但依赖Tasks 1-15完成，因为测试针对修复后的行为）
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Tasks 1-15

  **References**:
  - `excel.html:5259-6506` - 现有自测系统
  - `excel.html:5283-5295` - 自测使用的工具函数列表
  - 现有测试模式：T01-T122

  **Acceptance Criteria**:
  - [ ] T123-T135 全部定义并实现
  - [ ] `.omo/plans/fix-confirmed-bugs.md?selftest=1` 显示所有新测试通过
  - [ ] 现有 T01-T122 仍然全部通过
  - [ ] 没有重复的测试编号

  **QA Scenarios**:
  ```
  Scenario: 全部自测通过
    Tool: interactive_bash (浏览器)
    Preconditions: 所有修复已完成
    Steps:
      1. 在浏览器中打开 excel.html?selftest=1
      2. 等待自测完成
      3. 检查底部面板的测试结果
    Expected Result: "全部通过" 包含 T01-T135
    Evidence: .omo/evidence/task-19-all-tests-pass.png
  ```

  **Evidence to Capture**:
  - [ ] 自测面板截图显示 T123-T135 全部通过
  - [ ] 自测面板截图显示 T01-T122 仍然全部通过

  **Commit**: YES
  - Message: `test: 追加自测用例T123-T135覆盖已修复bug的回归测试`
  - Files: `excel.html`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each P0/P1 bug: verify fix exists (read file around the line). For each Must NOT Have: search codebase for forbidden patterns — reject with file:line if found.
  Output: `P0 [N/N] | P1 [N/N] | P2 [N/N] | Must NOT Have [N/N] | VERDICT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `grep -n 'P\d修复\|T\d{2}修复\|_i\d{4,}' excel.html` to verify clean comments and variable names. Check for any introduced regressions.
  Output: `Fix markers [N remaining] | _i vars [N remaining] | VERDICT`

- [ ] F3. **Full Self-Test Run** — `quick`
  Execute ALL self-tests via `?selftest=1`. Verify T01-T135 all pass. Capture screenshot.
  Output: `T01-T122 [N/N pass] | T123-T135 [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each TODO: read "What to do", read actual diff (git diff). Verify 1:1 — nothing beyond spec was changed.
  Output: `Tasks [N/N compliant] | Unaccounted changes [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1-8**: Group into shared commits by wave
  - Commit 1: `fix: P0 bug修复集` (Tasks 1,3,4,5,6,7,8)
  - Commit 2: `fix: 移除preserveStyles僵尸UI复选框` (Task 2)
- **9-15**: Group into shared commits
  - Commit 3: `fix: P1 bug修复集` (Tasks 9,10,11,12,13,14)
  - Commit 4: `refactor: 移除escapeHtml多余正斜杠转义` (Task 15)
- **16-19**: Separate commits
  - Commit 5: `refactor: 重命名checkMemoryUsage` (Task 16)
  - Commit 6: `refactor: 清理修复标记注释噪音` (Task 17)
  - Commit 7: `refactor: 重命名_i变量` (Task 18)
  - Commit 8: `test: 追加T123-T135` (Task 19)

---

## Success Criteria

### Verification Commands
```bash
# 验证自测全部通过
# 在浏览器中打开: excel.html?selftest=1
# 预期: T01-T135 全部通过, 无失败
```

### Final Checklist
- [ ] 全部5个P0 bug修复完成
- [ ] 全部9个P1 bug修复完成
- [ ] 全部5个P2改进完成
- [ ] T123-T135 自测用例全部通过
- [ ] T01-T122 自测用例仍全部通过
- [ ] 未引入新的 `P\d修复` 标记或 `_i\d+` 变量
- [ ] 浏览器中完整走通5种模式各一次（可选人工验证）

---

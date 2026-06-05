# Excel 离线工具 v2.0 — 实施计划

## TL;DR

> **Quick Summary**: 在 6757 行单 HTML 文件中修复 19 个已知缺陷、加入 Time-Slicing 防 UI 卡死、新增按行数拆分模式、重构智能合并大师、改进输出体验，4-4.5 天完成。
>
> **Deliverables**:
> - `excel.html` — 缺陷修复 + Time-Slicing + 新功能
> - `DESIGN.md` — 修正 3 个格式问题（重复行、清单描述不符）
> - `.omo/evidence/` — 每个任务的 QA 证据
>
> **Estimated Effort**: Medium (4-4.5 天)
> **Parallel Execution**: YES — 多波次并行
> **Critical Path**: T0.4 → T1.1 → T1.2 → T2.2 → T2.4 → T4.3 → F1-F4

---

## Context

### Original Request
实现 Excel 离线工具 v2.0：修 bug → Time-Slicing → 新功能（按行数拆分、智能合并）→ 输出体验改进 → 全面回测。

### Interview Summary
**Key Discussions** (已在 DESIGN.md 中经过多轮迭代确认):
- 架构：单 HTML + Vanilla JS + Time-Slicing（无 Worker，无 Vue3，无构建工具）
- 5 个模式（4 拆分 + 1 合并），删除旧的 merge-file/merge-sheet
- 智能合并分模式A（全量追加单Sheet）+ 模式B（按名称归类多Sheet）
- 按行数拆分作为独立模式
- 输出支持 ZIP / 单文件多Sheet（模式三强制 ZIP）
- 命名规则支持 7 个模板变量
- 去重仅用于合并模式
- Time-Slicing chunkSize 参数化（Sheet级10/行级500/单元格级1000）
- 内存管理：处理完立即释放引用，大文件自动降级仅数据模式
- 19 个已知缺陷按 P0/P1/P2 分类修复

**Design Document**: `DESIGN.md` (1041 行，包含完整架构、模式规格、缺陷清单、实施计划、风险清单)

**Remaining DESIGN.md Issues** (T0.0 will fix):
1. Day3 任务表有重复行（L938-940 重复 L934-936）— 删除后 3 行
2. 待确认清单第8项实施顺序与实际 Day 安排不一致 — 修正描述
3. Day 标注为 6 个天块但总工时 4-4.5 天 — 整理标注一致

---

## Work Objectives

### Core Objective
实现 Excel 离线工具 v2.0：修复所有已知缺陷，引入 Time-Slicing 机制防止大文件 UI 卡死，新增按行数拆分模式和智能合并大师，改进输出体验，在不破坏现有功能的前提下完成升级。

### Concrete Deliverables
- `excel.html` — 单 HTML 完整升级版
- `DESIGN.md` — 格式问题修正
- 全部回测通过（内置自测 T01-T120+ + Playwright E2E）

### Definition of Done
- [ ] 全部 19 个缺陷已修复，自测通过
- [ ] Time-Slicing 在 5 个模式的大循环中生效
- [ ] 按行数拆分模式完整可用
- [ ] 智能合并大师（模式A+模式B+去重）完整可用
- [ ] 输出体验功能（ZIP/单文件切换、命名模板、处理模式、单元格预警）完整
- [ ] 全部回测通过（内置测试 + Playwright + 大文件性能）
- [ ] 无回归：现有 26+164 测试全部通过

### Must Have
- Day0 先修 bug 再上新功能，不混合
- Time-Slicing 用 setTimeout（非 Worker）主线程切片
- 保留格式模式下用 `copyWorksheetByDeletion` 而非 `aoa_to_sheet`
- 来源列位置（`SOURCE_COL_IDX`）在所有文件合并前预先扫描确定
- JSZip `generateAsync` 内部回调拆分为多步 await
- 每个任务完成后立即运行 QA 场景并保存证据

### Must NOT Have (Guardrails)
- 不引入 Web Worker、Vue/React、Webpack/Vite 等构建工具
- 不引入 Tailwind CDN（避免 +1.5MB）
- 不修改现有模式的行为（merge-file/merge-sheet 可删除但替换为 smart-merge）
- 不在 Day0 额外添加新功能
- 不自作主张修改 nonce/CSP（装饰性，不在本计划范围）
- 不批量替换代码：每改一处用 `git diff` 审查
- 不添加额外文档文件（DESIGN.md 已足够）
- 拆分的模式三（split-column-vertical）强制 ZIP，不提供单文件多Sheet

---

## Design Document Reference

> 完整设计细节在 `DESIGN.md`，本计划只包含可执行任务定义。
> 每个任务引用 DESIGN.md 的对应章节，实施时须对照阅读。

| 任务 | DESIGN.md 参考 |
|------|---------------|
| T0.0 | §七（待确认清单）、§六 Day3（重复行） |
| T0.1-T0.3 | §5.0（已知缺陷清单） |
| T0.4 | §5.1（回测分层） |
| T1.1 | §1.3（Time-Slicing）、§1.4（内存管理） |
| T1.2 | §2.5（按行数拆分） |
| T2.1 | §2.6（智能合并大师界面） |
| T2.2-T2.5 | §2.6（模式A/模式B/去重/归一化） |
| T3.1-T3.4 | §三（全局功能规格） |
| T4.1-T4.4 | §五（回测总计划） |

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (built-in self-test T01-T120+)
- **Automated tests**: Tests-after (existing tests + new Playwright tests)
- **Primary verification**: Agent-Executed QA Scenarios for every task

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Bug fixes**: Run self-tests (`excel.html#self-test`), verify specific bug scenario
- **Time-Slicing**: Open browser, process large dataset, verify UI doesn't freeze
- **New features**: Manual interaction via tmux/Playwright
- **Regression**: Run full test suite

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Day0 — sequential by necessity):
├── T0.0: Fix DESIGN.md formatting issues [quick]
├── T0.1: Fix P0 bugs (3 items) [unspecified-high]
├── T0.2: Fix P1 bugs (12 items) [unspecified-high]
├── T0.3: Fix P2 bugs (3 items) [quick]
└── T0.4: Run full regression test suite [quick]

Wave 1 (Day1 — single focus):
└── T1.1: Time-Slicing infrastructure [deep]

Wave 2 (Day2 — max parallelism):
├── T1.2: New split-rows mode [unspecified-high]
└── T2.1: Merge config panel refactor [unspecified-high]

Wave 3 (Day3 — sequential chain):
├── T2.2: Merge Mode A (append) [deep]
├── T2.3: Merge Mode B (group by name) [unspecified-high]
├── T2.4: Dedup algorithm [deep]
└── T2.5: Sheet name normalization [quick]

Wave 4 (Day4 — all parallel):
├── T3.1: Output format toggle [quick]
├── T3.2: Naming template [quick]
├── T3.3: Processing mode switch [quick]
└── T3.4: Cell count warning [quick]

Wave 5 (Day5 — sequential):
├── T4.1: New Playwright tests [unspecified-high]
├── T4.2: Large file performance test [quick]
├── T4.3: Full regression test [quick]
└── T4.4: Self-test async compatibility [quick]

Wave FINAL (parallel review):
├── F1: Plan compliance audit [oracle]
├── F2: Code quality review [unspecified-high]
├── F3: Real manual QA [unspecified-high]
└── F4: Scope fidelity check [deep]
```

### Dependency Matrix
- **T0.0-T0.4**: Sequential chain (each depends on previous)
- **T1.1**: Depends on T0.4 — blocks T1.2, T2.1
- **T1.2**: Depends on T1.1 — no downstream blockers
- **T2.1**: Depends on T1.1 — blocks T2.2
- **T2.2**: Depends on T2.1 — blocks T2.3, T2.4
- **T2.3**: Depends on T2.2 — soft dependency (can parallelize with T2.4)
- **T2.4**: Depends on T2.2 — soft dependency
- **T2.5**: Depends on T2.2 — can run in parallel with T2.3/T2.4
- **T3.1-T3.4**: All depend on T2.5 — no dependencies among themselves (fully parallel)
- **T4.1-T4.4**: All depend on T3.x — T4.3 depends on T4.1
- **F1-F4**: All depend on all T4.x — fully parallel

---

## TODOs

- [ ] 1. **T0.0 — 修正 DESIGN.md 格式问题**

  **What to do**:
  - 修复第 3 个问题：
    1. 删除 Day3 任务表中重复的行（当前 L938-940 重复 L934-936），保留第 934-937 行（T2.2-T2.5 各一行）
    2. 修正待确认清单第8项（L1039）：将 `Day0 → Day1(TS+split-rows) → Day2(智能合并) → Day3(输出体验) → Day4(回测)` 改为 `Day0(缺陷修复) → Day1(TS底座) → Day2(split-rows+面板) → Day3(智能合并核心) → Day4(输出体验) → Day5(收尾回测)`
    3. 整理总工期标注：当前是 6 个天块（Day0-Day5）但总工时 4-4.5 天，在总工期行加备注 `（Day0/Day2/Day4 为半天块）`

  **Must NOT do**:
  - 不改 DESIGN.md 的任何技术内容，仅修格式

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: T0.1, T0.2, T0.3, T0.4
  - **Blocked By**: None

  **References**:
  - `DESIGN.md:934-940` — 重复行区域
  - `DESIGN.md:1039` — 待确认清单第8项

  **Acceptance Criteria**:
  - [ ] Day3 任务表无重复行（T2.2-T2.5 各出现一次）
  - [ ] 待确认清单第8项描述与实际 Day 安排一致
  - [ ] 总工期行注明半天块

  **QA Scenarios**:
  ```
  Scenario: Verify DESIGN.md formatting fixes
    Tool: Bash (grep + wc -l checks)
    Steps:
      1. grep "T2.2 模式A" DESIGN.md | wc -l → 1 (no duplicates)
      2. grep "T2.3 模式B" DESIGN.md | wc -l → 1
      3. grep "T2.4 去重算法" DESIGN.md | wc -l → 1
      4. grep "实施顺序" DESIGN.md → matches actual Day0-Day5 schedule
    Expected Result: No duplicates, matching schedule
    Evidence: .omo/evidence/task-T0.0-design-fixes.txt
  ```

  **Evidence to Capture**:
  - [ ] task-T0.0-design-fixes.txt — 验证输出

  **Commit**: YES
  - Message: `docs: Fix DESIGN.md formatting (duplicate rows, checklist description)`
  - Files: `DESIGN.md`

- [ ] 2. **T0.1 — 修复 P0 缺陷（3 项）**

  **What to do**:
  修复 3 个 P0（数据级错误）缺陷：

  **Bug-1: 来源列漂移（`performSheetDataMerge` L5206-5207）**
  - 当前问题：迭代中动态确定 `SOURCE_COL_IDX` 导致不同列数的文件来源列位置不一致
  - 修复方案：在处理循环前预先扫描所有文件，确定 `maxColumns`，将 `SOURCE_COL_IDX` 固定在 `maxColumns` 位置
  - 验证：合并 3 个列数不同的文件（2列+5列+3列），来源列始终在最后一列

  **Bug-3: `preserveStyles` 复选框僵尸UI**
  - 当前问题：HTML 中有 `preserveStyles` 复选框，但 JS 中 `XLSX_READ_OPTIONS.cellStyles` 硬编码为 `true`，复选框不生效
  - 修复方案：在 Step 3 添加真正的处理模式开关（保留格式/仅数据），动态注入 SheetJS 读取参数
  - 或：删除无意义复选框，统一走全局处理模式配置

  **Bug-9: `getUniqueSheetName` 31字符截断后加后缀越界**
  - 当前问题：Sheet 名截断到 31 字符后添加 `_1` `_2` 后缀导致总长度超过 31 字符
  - 修复方案：截断时预留后缀空间（最大 4 字符 `_NN`），确保最终长度 ≤ 31

  **Must NOT do**:
  - 不额外修改无关代码
  - 不改现有自测逻辑

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`（各缺陷涉及 SheetJS 内部结构和跨函数调用链）
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: NO（各 bug 独立但都在同一 HTML 中，避免冲突）
  - **Blocks**: T0.2, T0.3, T0.4
  - **Blocked By**: T0.0

  **References**:
  - `DESIGN.md:831` — Bug-1 详情
  - `DESIGN.md:832` — Bug-3 详情
  - `DESIGN.md:833` — Bug-9 详情
  - `excel.html` 中搜索 `performSheetDataMerge`, `preserveStyles`, `getUniqueSheetName`

  **Acceptance Criteria**:
  - [ ] Bug-1: 合并不同列数文件，来源列始终在最后固定位置
  - [ ] Bug-3: 处理模式开关真实生效，`cellStyles` 参数随用户选择变化
  - [ ] Bug-9: Sheet 名截断后总长度 ≤ 31 字符
  - [ ] 自测 T01-T120+ 全部通过

  **QA Scenarios**:
  ```
  Scenario: Bug-1 source column position fixed
    Tool: interactive_bash (open browser, use tool)
    Preconditions: Fresh build
    Steps:
      1. Upload 3 files with different column counts (2, 5, 3)
      2. Enable "来源列" option
      3. Merge in Mode A
      4. Verify source column is always the last column
    Expected Result: Source column at fixed position = maxColumns, no drift
    Evidence: .omo/evidence/task-T0.1-bug1-fixed.txt

  Scenario: Bug-3 processing mode switch
    Tool: interactive_bash
    Preconditions: Fresh build
    Steps:
      1. Select "仅数据" mode
      2. Upload file with styles
      3. Process and verify output has no styles
      4. Switch to "保留格式" and verify styles are preserved
    Expected Result: Mode switch actually affects output
    Evidence: .omo/evidence/task-T0.1-bug3-fixed.txt

  Scenario: Bug-9 sheet name truncation
    Tool: Bash (grep source code for fix)
    Steps:
      1. Find getUniqueSheetName function
      2. Verify truncation reserves space for suffix
    Expected Result: Length check: base_name_len + suffix_len ≤ 31
    Evidence: .omo/evidence/task-T0.1-bug9-fixed.txt
  ```

  **Evidence to Capture**:
  - [ ] task-T0.1-bug1-fixed.txt
  - [ ] task-T0.1-bug3-fixed.txt
  - [ ] task-T0.1-bug9-fixed.txt

  **Commit**: YES (with T0.2, T0.3 as group)
  - Message: `fix: Resolve P0 and P1 defects, clean up P2 code smells (19 items)`
  - Files: `excel.html`
  - Pre-commit: Run self-test suite

- [ ] 3. **T0.2 — 修复 P1 缺陷（12 项）**

  **What to do**:
  修复 12 个 P1（功能正确性）缺陷：

  1. **Bug-2**: `downloadAllFiles` ObjectURL 未释放 → 改用 `URL.revokeObjectURL()`
  2. **Bug-4**: `columnsToKeep.sort` 原地修改调用方数组 → `columnsToKeep.slice().sort()`
  3. **Bug-5**: `performFileMerge` 清空 DOM 导致"上一步"状态断裂 → 改用显示/隐藏切换
  4. **Bug-6**: 重复 `showToast` 调用 → 去重或合并提示
  5. **Defect-7**: `getHeaderRowCount` fallback 参数无效 → 确保 fallback 返回有效值
  6. **Defect-10**: `displayName` 与 `key` 匹配失败 → 修复匹配逻辑
  7. **Defect-11**: `escapeHtml` 多余正斜杠转义 → 移除不必要转义
  8. **Defect-12**: `beforeunload` 下载后仍提示 → 下载完成清除标记
  9. **Defect-13**: `resetTool` 未清 `WorkbookCache` → 显式释放缓存
  10. **Defect-16**: `cloneWorksheet` 降级路径丢失 `!` 属性 → 完整复制 `!` 前缀属性
  11. **Defect-17**: `slideIn` CSS 类不存在 → 添加对应 CSS 或移除无效引用
  12. **Defect-18**: `style.display` 混用 → 统一 CSP-safe CSS 类切换

  **Must NOT do**:
  - 每改完一个立即 git diff 审查，不批量替换
  - 如某修复导致自测失败，单独回滚，不阻塞其他修复

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`（涉及 DOM 操作、SheetJS 内部结构、多个函数调用链）
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: NO（同一文件中的顺序修复）
  - **Blocks**: T0.3, T0.4
  - **Blocked By**: T0.1

  **References**:
  - `DESIGN.md:838-851` — 12 个 P1 缺陷详情
  - `excel.html` 搜索各缺陷对应函数名

  **Acceptance Criteria**:
  - [ ] 每个 bug 的修复方案已在代码中实施
  - [ ] 自测 T01-T120+ 全部通过
  - [ ] 未引入新问题

  **QA Scenarios**:
  ```
  Scenario: Verify all P1 fixes
    Tool: Bash (grep + code review)
    Steps:
      1. For each of 12 bugs, grep source to verify fix pattern present
      2. Run self-test suite
    Expected Result: All 12 fixes identifiable in code, tests pass
    Evidence: .omo/evidence/task-T0.2-p1-fixes.txt
  ```

  **Evidence to Capture**:
  - [ ] task-T0.2-p1-fixes.txt

  **Commit**: YES (grouped with T0.1, T0.3)

- [ ] 4. **T0.3 — 修复 P2 缺陷（3 项）**

  **What to do**:
  修复 3 个 P2（代码质量）缺陷:

  1. **Defect-14**: `checkMemoryUsage` 名不副实 → 重命名或修正实现
  2. **Struct-26**: P1/P2/Txx 修复标记注释噪音 → 清理过时修复标记，保留有意义的注释
  3. **Struct-27**: `_i4679` 等垃圾变量名 → 重命名为语义化变量名

  **Must NOT do**:
  - 不改代码逻辑，仅清理代码质量

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Blocks**: T0.4
  - **Blocked By**: 3

  **References**:
  - `DESIGN.md:856-858` — 3 个 P2 缺陷详情

  **Acceptance Criteria**:
  - [ ] 3 个代码质量项已清理
  - [ ] 自测全部通过

  **QA Scenarios**:
  ```
  Scenario: Verify P2 fixes
    Tool: Bash (grep code)
    Steps:
      1. grep "checkMemoryUsage" → should be renamed or corrected
      2. grep "_i[0-9]" → should be replaced with semantic names
    Expected Result: Code quality improvements applied
    Evidence: .omo/evidence/task-4-p2-fixes.txt
  ```

  **Evidence to Capture**:
  - [ ] task-4-p2-fixes.txt

  **Commit**: YES (grouped with 2, 3)

- [ ] 5. **T0.4 — 运行全部测试，确认基线干净**

  **What to do**:
  运行全部现有测试，确认所有在 Day0 的修复不破坏现有功能:
  - 内置自测系统 T01-T120+
  - Playwright E2E 测试（如存在）

  在 `excel.html` 中触发自测，记录结果。
  如果任何测试失败，定位到是哪个 bug 修复导致的，回滚该修复，单独处理。

  **Must NOT do**:
  - 不自作主张修改测试
  - 如自测大面积失败，按回退机制处理（不阻塞，回滚后单独排查）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Blocks**: 6 (T1.1)
  - **Blocked By**: 4

  **References**:
  - `DESIGN.md:862-878` — 回测分层
  - `excel.html#self-test` — 内置自测入口

  **Acceptance Criteria**:
  - [ ] 内置自测 T01-T120+ 全部 passed
  - [ ] Playwright 测试全部通过
  - [ ] 测试结果记录到 `.omo/evidence/`

  **QA Scenarios**:
  ```
  Scenario: Run full regression after Day0 fixes
    Tool: Bash (open excel.html, trigger self-test, capture output)
    Steps:
      1. Open excel.html
      2. Navigate to self-test section
      3. Run all tests
      4. Capture pass/fail counts
    Expected Result: 0 failures
    Evidence: .omo/evidence/task-5-regression.txt
  ```

  **Evidence to Capture**:
  - [ ] task-5-regression.txt

  **Commit**: NO (squashed with Day0 commit)

- [ ] 6. **T1.1 — Time-Slicing 底座（processWithYielding）**

  **What to do**:
  在现有大循环中加入 `setTimeout` 切片，防止大文件处理时 UI 卡死:

  1. 创建 `processWithYielding(items, processFn, onProgress, options)` 通用函数
     - `CHUNK_SIZE` 参数化：Sheet级10，行级500，单元格级1000
     - `YIELD_MS` 参数化：默认 16ms
     - 每处理完一个 chunk，`await new Promise(r => setTimeout(r, YIELD_MS))`

  2. 扫描全部 6757 行代码，找出所有大循环位置并改造:
     - `splitSheet` 逐 Sheet 循环 → 用 `processWithYielding`
     - `splitByColumn` 逐行分组 → 用 `processWithYielding`
     - `mergeAppend` 逐文件 → 用 `processWithYielding`
     - JSZip `generateAsync` 内部回调 → 拆分为多步 `await`

  3. 每个 async 函数的调用链需要同步改造:
     - 调用方需 `await` 处理函数
     - 确保 `onProgress` 回调更新 UI

  4. 更新 `AppState.currentTimer` 以支持取消操作

  **Must NOT do**:
  - 不引入 Web Worker
  - 不改动同步调用链以外的不必要代码
  - 不改变处理逻辑，仅增加切片

  **Recommended Agent Profile**:
  - **Category**: `deep`（需在 6757 行中逐一识别所有大循环位置，理解 SheetJS/JSZip 内部回调结构）
  - **Skills**: none

  **Parallelization**:
  - **Blocks**: 7, 8 (T1.2, T2.1)
  - **Blocked By**: 5

  **References**:
  - `DESIGN.md:45-72` — Time-Slicing 机制设计
  - `DESIGN.md:74-97` — 内存管理策略
  - `DESIGN.md:190-247` — splitSheet async 示例
  - `excel.html` 搜索 `for.*sheet`, `for.*row`, `forEach` 等大循环模式

  **Acceptance Criteria**:
  - [ ] `processWithYielding` 函数创建，参数可调
  - [ ] split-sheet、split-column、split-vertical、split-rows、smart-merge 全部改造为 async + Time-Slicing
  - [ ] JSZip `generateAsync` 回调已切片
  - [ ] 取消操作通过 `currentTimer` 支持
  - [ ] 所有现有自测通过

  **QA Scenarios**:
  ```
  Scenario: Time-Slicing doesn't break basic functionality
    Tool: interactive_bash (open browser, test all modes)
    Steps:
      1. Upload small file (100 rows, 3 sheets)
      2. Test split-sheet → should work as before
      3. Test split-column → should work as before
      4. Test split-vertical → should work as before
      5. Test smart-merge → should work as before
    Expected Result: All modes process correctly
    Evidence: .omo/evidence/task-6-ts-basic.txt

  Scenario: Large file doesn't freeze UI
    Tool: interactive_bash (open browser, process large file)
    Steps:
      1. Generate 50000-row test file
      2. Start processing (split-rows, 1000 per chunk)
      3. Try to click UI elements during processing
    Expected Result: UI remains responsive during chunk breaks
    Evidence: .omo/evidence/task-6-ts-large.txt
  ```

  **Evidence to Capture**:
  - [ ] task-6-ts-basic.txt
  - [ ] task-6-ts-large.txt

  **Commit**: YES
  - Message: `perf: Add Time-Slicing via setTimeout to all processing loops`
  - Files: `excel.html`
  - Pre-commit: `bun test` (Playwright)

- [ ] 7. **T1.2 — 新增 split-rows 模式（按行数拆分）**

  **What to do**:
  新增第4个拆分模式"按行数拆分":

  **HTML 结构**（找到现有模式选择区，增加第4个模式入口）:
  - 在模式选择面板增加 "📄 按行数拆分" 按钮
  - 新增 `div.mode-split-rows` 区域（Step 2-4）
  - Step 3 配置项：每 N 行一份（数字输入）、表头行数、输出格式、命名模板、处理模式

  **JS 事件绑定**:
  - 模式切换时显示 `mode-split-rows` 面板
  - 步骤导航（Step 1→2→3→4）
  - 配置收集 → 调用处理函数

  **处理函数**:
  - `splitByRows(data, options)` 实现
  - 保留格式模式下：用 `copyWorksheetByDeletion` 策略（复制原工作表，删除非本分组的行）
  - 仅数据模式下：可用 `aoa_to_sheet` 重建

  **Must NOT do**:
  - 不破坏现有模式切换逻辑
  - 不重构现有模式选择面板结构

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`（全栈：HTML + CSS + JS 绑定 + SheetJS 操作）
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 8 - T2.1)
  - **Parallel Group**: Wave 2 (with T2.1)
  - **Blocks**: none
  - **Blocked By**: 6

  **References**:
  - `DESIGN.md:402-447` — split-rows 完整规格
  - `DESIGN.md:420-434` — 伪代码逻辑
  - `DESIGN.md:436` — 保留格式模式用 `copyWorksheetByDeletion`
  - `excel.html` 中搜索现有模式实现（如 `mode-split-sheet`）作为模式

  **Acceptance Criteria**:
  - [ ] 模式选择面板显示"按行数拆分"入口
  - [ ] 按行数拆分的 Step 2-4 完整流程可用
  - [ ] 配置项（每N行、表头行数、输出格式、命名模板、处理模式）全部生效
  - [ ] TR-01 到 TR-05 测试全部通过
  - [ ] 自测不报错

  **QA Scenarios**:
  ```
  Scenario: Split by rows basic
    Tool: interactive_bash (open browser, use tool)
    Preconditions: Open excel.html
    Steps:
      1. Select "按行数拆分" mode
      2. Upload file with 100 rows
      3. Set "每 30 行一份"
      4. Process
      5. Verify: 4 output files (30+30+30+10 rows)
    Expected Result: Correct splitting
    Evidence: .omo/evidence/task-7-split-rows-basic.txt

  Scenario: Split by rows exact division
    Tool: interactive_bash
    Steps:
      1. 10 rows, 每 5 行一份
      2. Process
      3. Verify: 2 files, each with 5 data rows + header
    Expected Result: Exact division works
    Evidence: .omo/evidence/task-7-split-rows-exact.txt
  ```

  **Evidence to Capture**:
  - [ ] task-7-split-rows-basic.txt
  - [ ] task-7-split-rows-exact.txt

  **Commit**: YES
  - Message: `feat: Add split-by-rows mode with worksheet deletion strategy`
  - Files: `excel.html`

- [ ] 8. **T2.1 — 重构合并配置面板（动态显示/隐藏）**

  **What to do**:
  重构智能合并大师的配置面板，使其动态适应模式A和模式B的不同配置需求:

  1. 合并方式选择：单选按钮（模式A：全量纵向追加 / 模式B：按名称归类）
  2. 切换合并方式时，动态显示/隐藏相关配置项：
     - 两种模式共享：表头行数、去重选项、来源列选项、处理模式
     - 模式A特有：无需额外
     - 模式B特有：无需额外（但输出自动多Sheet）
  3. 工作表选择区域优化：按文件视图 / 按名称视图 切换
  4. 搜索过滤：在大量工作表列表中快速定位
  5. 添加来源文件标记列的复选框

  **Must NOT do**:
  - 不改动合并处理逻辑（T2.2 和 T2.3 中处理）
  - 不清理现有合并代码（保留旧函数直到 T2.2 替换）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`（DOM 操作 + 事件绑定复杂交互）
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 7 - T1.2)
  - **Parallel Group**: Wave 2 (with T1.2)
  - **Blocks**: 9 (T2.2)
  - **Blocked By**: 6

  **References**:
  - `DESIGN.md:456-492` — 合并面板界面设计
  - `DESIGN.md:494-503` — 配置项表格
  - `excel.html` 搜索现有 merge 面板代码

  **Acceptance Criteria**:
  - [ ] 模式A/模式B 切换时配置面板动态调整
  - [ ] 工作表列表支持按文件/按名称视图切换
  - [ ] 搜索过滤功能可用
  - [ ] 来源列标记复选框可用

  **QA Scenarios**:
  ```
  Scenario: Merge panel mode switching
    Tool: interactive_bash (open browser, use tool)
    Steps:
      1. Select "智能合并大师" mode
      2. Toggle between 模式A and 模式B
      3. Verify relevant config shown/hidden
    Expected Result: Dynamic config panel
    Evidence: .omo/evidence/task-8-panel-switch.txt

  Scenario: Workspace view switching
    Tool: interactive_bash
    Steps:
      1. Upload 3 files with various sheet names
      2. Switch between "按文件视图" and "按名称视图"
    Expected Result: Sheet grouping toggles correctly
    Evidence: .omo/evidence/task-8-panel-views.txt
  ```

  **Evidence to Capture**:
  - [ ] task-8-panel-switch.txt
  - [ ] task-8-panel-views.txt

  **Commit**: YES
  - Message: `feat: Refactor merge config panel with dynamic mode switching`
  - Files: `excel.html`

- [ ] 9. **T2.2 — 模式A：全量纵向追加（来源列固定）**

  **What to do**:
  实现智能合并大师的模式A（全量纵向追加）：

  1. 核心函数 `mergeAppend(files, options)` 实现:
     - 预先扫描所有文件，确定 `maxColumns`（所有文件中列数的最大值）
     - `SOURCE_COL_IDX = maxColumns` 固定位置，迭代中不漂移
     - 处理每个文件：
       - 提取表头行 + 数据行
       - 第一份为 baseline，验证后续文件的表头一致性
       - 表头不一致时跳过该文件并提示
     - 每行补齐到 `maxColumns` 宽度
     - 在 `SOURCE_COL_IDX` 位置写入来源标记
     - 表头行来源列位置写入"来源文件"

  2. **样式断层修复（保留格式模式下）**:
     - `fillNewColumnStyles(worksheet, newColIndex, baselineColIndex)` 实现
     - 新拓展的列自动复制最邻近有效单元格的基准样式
     - 使用 `structuredClone()` 复制样式对象

  3. 继承 T1.1 的 Time-Slicing，逐文件切片

  **Must NOT do**:
  - SOURCE_COL_IDX 不允许迭代中修改
  - 不假设来源列在末尾

  **Recommended Agent Profile**:
  - **Category**: `deep`（涉及 SheetJS 内部 worksheet 结构、样式克隆、列对齐算法）
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: 10, 11, 12 (T2.3, T2.4, T2.5)
  - **Blocked By**: 8

  **References**:
  - `DESIGN.md:505-580` — 模式A完整伪代码 + 样式断层修复
  - `DESIGN.md:554-573` — `fillNewColumnStyles` 实现
  - `DESIGN.md:645-656` — TM-A01 到 TM-A06 测试用例

  **Acceptance Criteria**:
  - [ ] `mergeAppend` 函数已实现
  - [ ] 预先扫描所有文件确定 `maxColumns`，`SOURCE_COL_IDX` 固定
  - [ ] 表头不一致的文件被跳过并提示
  - [ ] 来源标记列在所有输出行中正确
  - [ ] 样式断层修复正确（保留格式模式下）
  - [ ] TM-A01 到 TM-A06 全部通过

  **QA Scenarios**:
  ```
  Scenario: Mode A basic append
    Tool: interactive_bash
    Preconditions: Open excel.html, smart-merge mode, 模式A
    Steps:
      1. Upload 2 files, each with 1 sheet, same structure (3 cols)
      2. Merge
      3. Verify: single sheet output, 2x data rows stacked
    Expected Result: Data stacked correctly
    Evidence: .omo/evidence/task-9-modeA-basic.txt

  Scenario: Mode A different column counts
    Tool: interactive_bash
    Steps:
      1. Upload 3 files with different columns (2, 5, 3)
      2. Merge with source column enabled
      3. Verify: output has maxColumns=5, source column at col 4 (0-indexed)
    Expected Result: Source column fixed at maxColumns position
    Evidence: .omo/evidence/task-9-modeA-diffcols.txt

  Scenario: Mode A header mismatch
    Tool: interactive_bash
    Steps:
      1. Upload 2 files with different headers
      2. Merge
      3. Verify: mismatched file skipped with warning
    Expected Result: Graceful skip with message
    Evidence: .omo/evidence/task-9-modeA-mismatch.txt
  ```

  **Evidence to Capture**:
  - [ ] task-9-modeA-basic.txt
  - [ ] task-9-modeA-diffcols.txt
  - [ ] task-9-modeA-mismatch.txt

  **Commit**: NO (group with 10, 11, 12)

- [ ] 10. **T2.3 — 模式B：按名称归类合并**

  **What to do**:
  实现智能合并大师的模式B（按工作表名称归类）：

  1. 核心函数 `mergeBySheetName(files, options)` 实现:
     - Sheet 名归一化（trim、大小写不敏感）在 T2.5 实现，本任务先不做归一化
     - Map 分组：`sheetName → [{file, data}, ...]`
     - 每组内部复用 T2.2 的 `mergeAppend` 逻辑
     - 输出：每个分组为一个 Sheet 的多 Sheet 工作簿
  2. 超长 Sheet 名（>31字符）自动截断，预留后缀空间
  3. 部分文件缺少某 Sheet 时，只合并存在的文件数据

  **Must NOT do**:
  - 不重复实现 mergeAppend 逻辑（复用 T2.2）
  - 不在此任务中做 Sheet 名归一化（T2.5 做）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`（逻辑相对直接，Map 分组 + 复用）
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 11 - T2.4)
  - **Parallel Group**: Wave 3b (with T2.4)
  - **Blocks**: none
  - **Blocked By**: 9

  **References**:
  - `DESIGN.md:583-604` — 模式B完整伪代码
  - `DESIGN.md:656` — TM-B01 到 TM-B04 测试用例
  - `DESIGN.md:505-580` — mergeAppend 复用目标

  **Acceptance Criteria**:
  - [ ] `mergeBySheetName` 函数已实现
  - [ ] Map 分组正确：同名 Sheet 合并到同一组
  - [ ] 每组内部正确复用 mergeAppend 逻辑
  - [ ] 超长 Sheet 名自动截断
  - [ ] TM-B01 到 TM-B04 全部通过

  **QA Scenarios**:
  ```
  Scenario: Mode B group by name
    Tool: interactive_bash
    Steps:
      1. Upload 3 files: each has [Sheet1, Sheet2]
      2. Select 模式B
      3. Merge
      4. Verify: output has 2 sheets, each contains 3x data merged
    Expected Result: Correct grouping and merging
    Evidence: .omo/evidence/task-10-modeB-basic.txt

  Scenario: Mode B missing sheets
    Tool: interactive_bash
    Steps:
      1. File A: [Sales, Report]; File B: [Sales, Data]; File C: [Sales]
      2. Merge in 模式B
      3. Verify: Sheet[Sales] has 3 files data, Sheet[Report] has 1 file
    Expected Result: Partial merge works
    Evidence: .omo/evidence/task-10-modeB-partial.txt
  ```

  **Evidence to Capture**:
  - [ ] task-10-modeB-basic.txt
  - [ ] task-10-modeB-partial.txt

  **Commit**: NO (group with 9, 11, 12)

- [ ] 11. **T2.4 — 去重算法（精确排除来源列）**

  **What to do**:
  实现合并模式中的去重功能：

  1. **整行去重**: `removeDuplicates(rows, options)`
     - 精确排除来源列：`key = [...row.slice(0, sourceIdx), ...row.slice(sourceIdx + 1)]`
     - 不假设来源列在末尾
     - 用 `JSON.stringify` + `Set` 判断重复
     - 保留表头行，仅去重数据行

  2. **按指定列去重**:
     - `key = duplicateColumns.map(c => row[c]).join('\x00')`
     - 同列值只保留第一行

  3. 集成到 mergeAppend 中：
     - 在 `options.removeDuplicates = true` 时调用
     - 去重在合并所有数据后进行
     - 支持模式A和模式B（模式B每组内部独立去重）

  **Must NOT do**:
  - 不假设来源列在行末尾
  - 不改动非去重相关逻辑

  **Recommended Agent Profile**:
  - **Category**: `deep`（涉及精确的 slice 逻辑、Set 去重、与 mergeAppend 的集成）
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 10 - T2.3)
  - **Parallel Group**: Wave 3b (with T2.3)
  - **Blocks**: none
  - **Blocked By**: 9

  **References**:
  - `DESIGN.md:607-641` — 去重算法完整伪代码
  - `DESIGN.md:645-656` — TM-A04, TM-A05, TM-B04 测试用例

  **Acceptance Criteria**:
  - [ ] `removeDuplicates` 函数已实现
  - [ ] 整行去重正确排除来源列（不假设位置）
  - [ ] 按列去重正确
  - [ ] 集成到 mergeAppend 中
  - [ ] TM-A04, TM-A05, TM-B04 通过

  **QA Scenarios**:
  ```
  Scenario: Full row dedup with source column excluded
    Tool: interactive_bash
    Steps:
      1. Upload 2 identical files (same 3 rows, same data)
      2. Enable dedup (整行去重)
      3. Merge in 模式A
      4. Verify: only 1 copy of each data row remains
    Expected Result: Duplicates removed
    Evidence: .omo/evidence/task-11-dedup-full.txt

  Scenario: Dedup by specific column
    Tool: interactive_bash
    Steps:
      1. Upload file with rows: [Alice, 100], [Bob, 200], [Alice, 150]
      2. Enable dedup by "姓名" column
      3. Verify: Alice row appears only once (first occurrence)
    Expected Result: Column-based dedup works
    Evidence: .omo/evidence/task-11-dedup-column.txt
  ```

  **Evidence to Capture**:
  - [ ] task-11-dedup-full.txt
  - [ ] task-11-dedup-column.txt

  **Commit**: NO (group with 9, 10, 12)

- [ ] 12. **T2.5 — Sheet 名归一化**

  **What to do**:
  实现 Sheet 名称归一化，避免因细微差异导致同名 Sheet 被分成不同组：

  1. Trim 前后空格
  2. 大小写不敏感比较（如"销售数据"和"销售数据 "视为相同）
  3. 全角空格 → 半角空格（U+3000 → U+0020）
  4. 连续空格折叠为单个空格
  5. 用于模式B的 Map 分组 key
  6. 原始 Sheet 名保留用于输出，仅分组 key 使用归一化后的名称

  **Must NOT do**:
  - 不修改原始 Sheet 名（仅影响分组 key）
  - 不过度清洗（保留有意义字符）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 10, 11)
  - **Parallel Group**: Wave 3b (with T2.3, T2.4)
  - **Blocks**: 13 (T3.1)
  - **Blocked By**: 9

  **References**:
  - `DESIGN.md:937` — T2.5 说明

  **Acceptance Criteria**:
  - [ ] Sheet 名前导/后随空格已 trim
  - [ ] 大小写差异不影响分组
  - [ ] 全角空格归一化
  - [ ] 自测通过

  **QA Scenarios**:
  ```
  Scenario: Sheet name normalization
    Tool: Bash (grep test or unit test)
    Steps:
      1. Test: normalizeSheetName(" 销售数据 ") → "销售数据"
      2. Test: normalizeSheetName("sales DATA") equals normalizeSheetName("Sales Data")
      3. Test: normalizeSheetName("A　B") → "A B" (full-width space)
    Expected Result: Normalization works correctly
    Evidence: .omo/evidence/task-12-normalization.txt
  ```

  **Evidence to Capture**:
  - [ ] task-12-normalization.txt

  **Commit**: NO (group with 9, 10, 11)

- [ ] 13. **T3.1 — 输出格式选项（ZIP / 单文件多Sheet）**

  **What to do**:
  在 split-sheet、split-column、split-rows 模式中增加输出格式切换：

  1. Step 3 增加输出格式单选按钮（ZIP / 单文件多Sheet）
  2. split-vertical 模式强制 ZIP（禁用单文件多Sheet选项）
  3. smart-merge 本身输出单文件，不提供此选项
  4. ZIP 路径：用 JSZip 打包所有 xlsx 文件
  5. 单文件多Sheet 路径：新建 workbook，每个输出 Sheet 逐一 append

  **Must NOT do**:
  - 不改变已有模式的默认行为（默认 ZIP）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 14, 15, 16)
  - **Parallel Group**: Wave 4 (with T3.2, T3.3, T3.4)
  - **Blocks**: none
  - **Blocked By**: 12

  **References**:
  - `DESIGN.md:745-753` — 输出格式规格表
  - `DESIGN.md:229-246` — splitSheet 中的两种输出路径

  **Acceptance Criteria**:
  - [ ] split-sheet、split-column、split-rows 支持 ZIP/单文件切换
  - [ ] split-vertical 强制 ZIP（单文件选项隐藏/禁用）
  - [ ] smart-merge 不显示此选项
  - [ ] 自测通过

  **QA Scenarios**:
  ```
  Scenario: Output format toggle visible
    Tool: interactive_bash
    Steps:
      1. Enter split-sheet mode
      2. Step 3 → verify output format radio buttons visible
      3. Select "单文件多Sheet" → process → verify single xlsx output
    Expected Result: Toggle works
    Evidence: .omo/evidence/task-13-format-toggle.txt

  Scenario: split-vertical forced ZIP
    Tool: interactive_bash
    Steps:
      1. Enter split-vertical mode
      2. Step 3 → verify "单文件多Sheet" is disabled/hidden
    Expected Result: Correct restriction
    Evidence: .omo/evidence/task-13-vertical-zip.txt
  ```

  **Evidence to Capture**:
  - [ ] task-13-format-toggle.txt
  - [ ] task-13-vertical-zip.txt

  **Commit**: YES (group with 14, 15, 16 as single Day4 commit)
  - Message: `feat: Add output format options, naming templates, processing mode, cell warning`
  - Files: `excel.html`

- [ ] 14. **T3.2 — 自定义命名规则**

  **What to do**:
  实现全局命名模板系统：

  1. `applyNamingTemplate(template, vars)` 函数：
     - 支持 7 个模板变量：`{original}` `{sheet}` `{value}` `{column}` `{index}` `{date}` `{time}`
     - `{index}` 自动补零到 2 位
  2. `sanitizeFileName(name)` 函数：
     - 移除非法文件名字符：`\0 \r \n < > : " / \ | ? *`
     - 空结果保底为"未命名"
  3. 每个模式有不同的默认模板
  4. Step 3 增加自定义命名模板输入框

  **Must NOT do**:
  - 不引入正则之外的复杂 sanitize 逻辑

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 13, 15, 16)
  - **Parallel Group**: Wave 4 (with T3.1, T3.3, T3.4)
  - **Blocks**: none
  - **Blocked By**: 12

  **References**:
  - `DESIGN.md:703-743` — 命名规则完整规格
  - `DESIGN.md:717-722` — 各模式默认模板

  **Acceptance Criteria**:
  - [ ] 7 个模板变量全部支持
  - [ ] 非法文件名字符已清洗
  - [ ] 空结果保底"未命名"
  - [ ] 每个模式有不同默认模板
  - [ ] 自测通过

  **QA Scenarios**:
  ```
  Scenario: Naming template with all variables
    Tool: Bash (unit test or grep)
    Steps:
      1. applyNamingTemplate("{original}_{sheet}_{value}_{column}_{index}_{date}_{time}", vars)
      2. Verify each variable is replaced correctly
    Expected Result: All 7 variables work
    Evidence: .omo/evidence/task-14-naming.txt

  Scenario: File name sanitization
    Tool: Bash
    Steps:
      1. sanitizeFileName("test: file/name?") → "test_ file_name_"
      2. sanitizeFileName("  ") → "未命名"
    Expected Result: Dangerous chars replaced, empty fallback
    Evidence: .omo/evidence/task-14-sanitize.txt
  ```

  **Evidence to Capture**:
  - [ ] task-14-naming.txt
  - [ ] task-14-sanitize.txt

  **Commit**: YES (group with 13, 15, 16)

- [ ] 15. **T3.3 — 处理模式开关（保留格式 / 仅数据）**

  **What to do**:
  在 Step 1 全局配置中增加处理模式开关，并在 Step 3 支持模式级覆盖：

  1. Step 1：处理模式 [保留格式 ▼] 全局默认配置
  2. Step 3 模式级：处理模式 [跟随全局 ▼] 默认选项，展开后可选保留格式/仅数据
  3. 注入 SheetJS 优化参数：
     - 仅数据模式：`cellStyles: false, cellFormula: false, cellNF: false, cellDates: false`
     - 保留格式模式：全部为 true
  4. 各模式处理函数读取 `config.processingMode` 参数

  **Must NOT do**:
  - 不引入额外依赖

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 13, 14, 16)
  - **Parallel Group**: Wave 4 (with T3.1, T3.2, T3.4)
  - **Blocks**: none
  - **Blocked By**: 12

  **References**:
  - `DESIGN.md:985-998` — 处理模式开关位置统一说明
  - `DESIGN.md:660-677` — 处理模式规格

  **Acceptance Criteria**:
  - [ ] Step 1 全局处理模式选择器可用
  - [ ] Step 3 模式级处理模式默认"跟随全局"，可覆盖
  - [ ] SheetJS 参数随模式切换正确注入
  - [ ] 自测通过

  **QA Scenarios**:
  ```
  Scenario: Processing mode global toggle
    Tool: interactive_bash
    Steps:
      1. 全局选择"仅数据"
      2. 进入 split-sheet mode
      3. Step 3 默认显示"跟随全局"
      4. 处理 → 验证输出无样式
    Expected Result: Global setting flows through
    Evidence: .omo/evidence/task-15-mode-global.txt

  Scenario: Processing mode override
    Tool: interactive_bash
    Steps:
      1. 全局"仅数据"，Step 3 改为"保留格式"
      2. 处理 → 验证样式保留
    Expected Result: Per-mode override works
    Evidence: .omo/evidence/task-15-mode-override.txt
  ```

  **Evidence to Capture**:
  - [ ] task-15-mode-global.txt
  - [ ] task-15-mode-override.txt

  **Commit**: YES (group with 13, 14, 16)

- [ ] 16. **T3.4 — 单元格数预警**

  **What to do**:
  实现单元格数自动检查与预警：

  1. `checkCellCountWarning(workbook)` 函数：
     - 遍历所有 Sheet，根据 `!ref` 计算行列数
     - 200万单元格为预警阈值
     - `!ref` 缺失时单独标记"无法计算"
  2. 上传文件后自动触发检查
  3. 低于阈值静默通过
  4. 超过阈值时显示警告消息 + 建议切换到"仅数据"模式

  **Must NOT do**:
  - 不阻止用户操作（仅警告，不强制）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 13, 14, 15)
  - **Parallel Group**: Wave 4 (with T3.1, T3.2, T3.3)
  - **Blocks**: none
  - **Blocked By**: 12

  **References**:
  - `DESIGN.md:678-701` — 单元格预警规格

  **Acceptance Criteria**:
  - [ ] 上传文件后自动计算单元格数
  - [ ] 超过 200 万时显示警告
  - [ ] `!ref` 缺失时正确显示"无法计算"
  - [ ] 不阻塞用户操作

  **QA Scenarios**:
  ```
  Scenario: Cell count warning triggers
    Tool: interactive_bash
    Steps:
      1. Upload file with >2M cells (or mock the count)
      2. Verify warning message appears
      3. Verify user can still proceed
    Expected Result: Warning shown, not blocked
    Evidence: .omo/evidence/task-16-cell-warning.txt

  Scenario: Cell count below threshold
    Tool: interactive_bash
    Steps:
      1. Upload small file
      2. Verify no warning shown
    Expected Result: Silent pass
    Evidence: .omo/evidence/task-16-cell-ok.txt
  ```

  **Evidence to Capture**:
  - [ ] task-16-cell-warning.txt
  - [ ] task-16-cell-ok.txt

  **Commit**: YES (group with 13, 14, 15)

- [ ] 17. **T4.1 — 新增 Playwright 测试（15+ 用例）**

  **What to do**:
  为 v2.0 新增功能编写 Playwright E2E 测试：

  1. split-rows 模式测试（3 个）：
     - TR-01: 1000 行，每 300 行一份 → 4 份
     - TR-02: 刚好整除
     - TR-04: 输出单文件多Sheet
  2. smart-merge 模式A 测试（4 个）：
     - TM-A01: 2 文件基础追加
     - TM-A02: 不同列数（2+5+3）
     - TM-A04: 整行去重
     - TM-A06: 来源列标记
  3. smart-merge 模式B 测试（2 个）：
     - TM-B01: 同名 Sheet 归类
     - TM-B04: 去重
  4. 全局功能测试（3 个）：
     - 处理模式切换
     - 输出格式切换
     - 单元格预警

  **Must NOT do**:
  - 不修改现有测试
  - 不编写需要手动确认的测试

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Blocks**: 19 (T4.3 依赖新增测试)
  - **Blocked By**: 16

  **References**:
  - `DESIGN.md:880-890` — 各模式回测清单
  - `excel.html` 现有 Playwright 测试作为模式参考

  **Acceptance Criteria**:
  - [ ] 15+ 个新 Playwright 测试全部编写完成
  - [ ] 所有新测试通过
  - [ ] 未破坏现有测试

  **QA Scenarios**:
  ```
  Scenario: Run new Playwright tests
    Tool: Bash
    Steps:
      1. bun test (or equivalent Playwright runner)
      2. Capture output
    Expected Result: 15+ new tests, all pass
    Evidence: .omo/evidence/task-17-playwright.txt
  ```

  **Evidence to Capture**:
  - [ ] task-17-playwright.txt

  **Commit**: YES (group with 18, 19, 20)
  - Message: `test: Add 15+ Playwright tests for v2.0 features; verify all pass`
  - Files: (test files)
  - Pre-commit: `bun test`

- [ ] 18. **T4.2 — 大文件性能测试**

  **What to do**:
  验证 Time-Slicing 在大文件场景下的效果：

  1. 测试数据：生成 100000 行 × 10 列的测试文件（使用 `xlsx` CLI 或内置测试数据生成函数；若无可编写简单的 Node.js 脚本 `scripts/generate-test-xlsx.mjs`）
  2. 测试 split-rows（每 10000 行一份）:
     - 记录总处理时间
     - 验证 UI 在数据处理阶段不卡死
     - 确认 XLSX.read() 解析阶段仍会卡顿（预期行为）
  3. 检查内存占用 < 300MB
  4. 结果记录到性能基准表

  **Must NOT do**:
  - 不修改生产代码

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 17, 20)
  - **Parallel Group**: Wave 5b (with T4.1, T4.4)
  - **Blocks**: none
  - **Blocked By**: 16

  **References**:
  - `DESIGN.md:893-900` — 性能基准表

  **Acceptance Criteria**:
  - [ ] 10万行文件处理完成
  - [ ] 总时间 < 60 秒
  - [ ] UI 不崩溃
  - [ ] 内存 < 300MB

  **QA Scenarios**:
  ```
  Scenario: Performance benchmark
    Tool: Bash (generate test file + time processing)
    Steps:
      1. Generate 100000-row xlsx
      2. Process with split-rows (10000 per chunk)
      3. Measure: total time, memory, UI responsiveness
    Expected Result: < 60s, < 300MB, UI responsive
    Evidence: .omo/evidence/task-18-perf.txt
  ```

  **Evidence to Capture**:
  - [ ] task-18-perf.txt

  **Commit**: YES (group with 17, 19, 20)

- [ ] 19. **T4.3 — 回测所有现有功能**

  **What to do**:
  全面回测，确保 v2.0 不破坏任何现有功能：

  1. 运行内置自测系统全部用例（T01-T120+）
  2. 运行全部 Playwright 测试（原有 + 新增）
  3. 逐项检查各模式基础功能正常
  4. 检查旧 merge-file/merge-sheet 是否被正确替换

  **Must NOT do**:
  - 不修改测试用例
  - 不"选择性通过"失败测试

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Blocks**: none
  - **Blocked By**: 17, 18

  **References**:
  - `DESIGN.md:862-878` — 回测分层
  - `DESIGN.md:880-890` — 各模式回测清单

  **Acceptance Criteria**:
  - [ ] 内置自测全部通过
  - [ ] Playwright 测试全部通过
  - [ ] 各模式基础功能正常
  - [ ] 无回归

  **QA Scenarios**:
  ```
  Scenario: Full regression
    Tool: Bash
    Steps:
      1. Run all built-in tests
      2. Run all Playwright tests
      3. Capture pass/fail counts
    Expected Result: 0 failures across all test suites
    Evidence: .omo/evidence/task-19-regression.txt
  ```

  **Evidence to Capture**:
  - [ ] task-19-regression.txt

  **Commit**: YES (group with 17, 18, 20)

- [ ] 20. **T4.4 — 自测系统与 async 兼容性验证**

  **What to do**:
  验证自测系统与 v2.0 async 改造的兼容性：

  1. 确认因 T1.1 改造而变成 async 的函数（`splitByColumn` 等）在自测框架中能正常调用
  2. 自测框架需要 `await` async 函数的测试结果
  3. 修复任何因同步→async 变化导致的测试失败
  4. 确认自测不影响普通用户操作

  **Must NOT do**:
  - 不重构自测框架

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (with 17, 18)
  - **Parallel Group**: Wave 5b (with T4.1, T4.2)
  - **Blocks**: none
  - **Blocked By**: 16

  **References**:
  - `excel.html` 搜索自测系统代码（~5.9 区域）
  - `DESIGN.md:810-812` — 自测系统位置

  **Acceptance Criteria**:
  - [ ] 所有 async 函数在自测框架中正常调用
  - [ ] 自测全部通过
  - [ ] 自测 UI 正常

  **QA Scenarios**:
  ```
  Scenario: Async compatibility
    Tool: interactive_bash
    Steps:
      1. Run self-test suite
      2. Check all tests pass, especially ones calling async functions
    Expected Result: All tests pass with async compatibility
    Evidence: .omo/evidence/task-20-async-compat.txt
  ```

  **Evidence to Capture**:
  - [ ] task-20-async-compat.txt

  **Commit**: YES (group with 17, 18, 19)

---

## Final Verification Wave

> 4 个审查代理并行运行。全部通过后呈现结果给用户，等待明确批准后方可完成。

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.omo/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run lint checks. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (`git log/diff`). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Group | Tasks | Message | Files | Pre-commit |
|-------|-------|---------|-------|------------|
| G1 | 1 | `docs: Fix DESIGN.md formatting (duplicate rows, checklist description)` | `DESIGN.md` | — |
| G2 | 2-5 | `fix: Resolve P0/P1/P2 defects (19 items)` | `excel.html` | Run self-test |
| G3 | 6 | `perf: Add Time-Slicing via setTimeout to all processing loops` | `excel.html` | `bun test` |
| G4 | 7 | `feat: Add split-by-rows mode with worksheet deletion strategy` | `excel.html` | — |
| G5 | 8 | `feat: Refactor merge config panel with dynamic mode switching` | `excel.html` | — |
| G6 | 9-12 | `feat: Implement smart-merge engine (Mode A/B + dedup + normalization)` | `excel.html` | — |
| G7 | 13-16 | `feat: Add output format options, naming templates, processing mode, cell warning` | `excel.html` | — |
| G8 | 17-20 | `test: Add 15+ Playwright tests; verify full regression passes` | `excel.html` + test files | `bun test` |
| G9 | F1-F4 | `chore: Final verification sign-off` | — | — |

---

## Success Criteria

### Verification Commands
```bash
# Built-in self-test
open excel.html → navigate to self-test → run all

# Playwright E2E
bun test  # or npx playwright test

# Manual verification
# Open excel.html, test each of 5 modes
```

### Final Checklist
- [ ] Day0: 19 个缺陷全部修复，自测通过
- [ ] Day1: Time-Slicing 在 5 个模式中大循环生效，UI 不卡死
- [ ] Day2: split-rows 模式完整可用，合并面板动态切换
- [ ] Day3: 智能合并大师（模式A+模式B+去重+归一化）完整可用
- [ ] Day4: 输出体验功能（格式切换+命名模板+模式开关+单元格预警）完整
- [ ] Day5: Playwright 15+ 新测试通过，10万行性能达标，全面回归零失败
- [ ] 全部 F1-F4 验证通过
- [ ] 总工期 ≤ 4.5 天

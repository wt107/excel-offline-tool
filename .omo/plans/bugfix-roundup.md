# Bugfix Roundup — 综合修复计划

## TL;DR

> **Quick Summary**: 修复 Claude Code + KIMI 两份外部测试报告确认的所有真实 Bug（12 项 P0-P1 + 2 项 P2），修复后全量回测 58 个 Playwright 测试。
>
> **Deliverables**:
> - `excel.html` — 修复 DOM 结构、可选链兼容性、内存泄漏、状态残留、性能缺陷、无障碍等 9 个 Bug
> - `README.md` — 统一版本号
> - `test/specs/10-p4-supplementary.spec.js` — 补充 right join + split-column 单文件测试
>
> **Estimated Effort**: Medium (1-2 days)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: T1 (DOM fix) → T2-T10 (code fixes) → T11 (tests) → F1-F4 (verification)

---

## Context

### Original Request
> "全面修复，然后回测，我再去找不同的测试"

### Confirmed Bug List (from cross-validation of Claude + KIMI reports)

| # | 问题 | 来源 | 级别 | 位置 |
|---|------|------|------|------|
| 1 | `dataJoinOptions` DOM 在 `.container` 外 → 数据匹配 UI 不可见 | 两边均指出 | **P0** | excel.html:1535 |
| 2 | `?.` 可选链 4 处 → Chrome 49-79 崩溃 | Claude | P1 | excel.html:5226,6243,6851,7087 |
| 3 | ObjectURL 下载后未追踪释放 → 内存泄漏 | Claude | P1 | excel.html:8744-8763 |
| 4 | resetTool 未清空 `verticalKeyColumns`/`selectedVerticalColumns` → 状态残留 | 两边均指出 | P1 | excel.html:2973-2995 |
| 5 | right join O(n×m) 嵌套循环 → 大数据假死 | KIMI | P1 | excel.html:7184-7212 |
| 6 | 数据不一致仅 `console.warn` → 用户可下载损坏文件 | Claude | P1 | phase4OutputManagement |
| 7 | WorkbookCache 生产日志 | Claude | P1 | WorkbookCache 类 |
| 8 | `escapeHtml` 缺反引号转义 | KIMI | P1 | excel.html:3047-3051 |
| 9 | 竖向拆分 `min="1"` 与提示"0表示无表头"矛盾 | KIMI | P1 | excel.html:1272 |
| 10 | `maxDataRows` 输入框无 `max` 上限 | KIMI | P1 | excel.html:1151 |
| 11 | 版本号 v1.5.0 vs v2.0 不一致 | KIMI | P1 | excel.html:1076, README.md |
| 12 | uploadArea 缺键盘 Enter/Space 事件 | Claude | P1 | excel.html:~1115 |
| 13 | `summaryHeaderRows min="1"` 与其他模式不一致 | KIMI | P2 | excel.html:1464 |
| 14 | 缺少 right join + split-column 单文件测试覆盖 | KIMI | P2 | test/ |

### False Positives (NOT Fixing)
- T57 `formatFileSize` 期望值: 代码返回 `'0 Bytes'`, 自测期望 `'0 Bytes'`, **完全一致**
- 快速双击 `step3Next`: 每个 `performXxx` 顶部已检查 `isProcessing`, JS 事件循环保证串行, **防护有效**
- `confirm()` 改自定义弹窗: UX 优化项, 不算 Bug, 留到 UI 重构时

### Metis Review
- 无阻塞性问题。需求明确，范围清晰，所有 Bug 已通过源代码验证确认。

---

## Work Objectives

### Core Objective
修复所有经交叉验证确认的真实 Bug，确保 58 个已有 Playwright 测试全部通过。

### Concrete Deliverables
- `excel.html` — 12 项代码/DOM/无障碍修复
- `README.md` — 版本号统一
- `test/specs/10-p4-supplementary.spec.js` — 新增 2 个测试用例

### Definition of Done
- [ ] `npx playwright test` → 60 tests pass (58 老 + 2 新)
- [ ] 所有 12 个 P0-P1 Bug 已修复确认
- [ ] 不存在因本次改动引入的新 Bug 或测试失败

### Must Have
- 所有 P0-P1 bug 修复
- 全量测试通过

### Must NOT Have (Guardrails)
- 不改动 && 现有测试逻辑 / 不破坏已有功能
- 不引入新特性（纯修复，不新增功能）
- 不改动 false positive 项（T57、双击防护、confirm）

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (Playwright)
- **Automated tests**: Tests-after (run full suite after fixes)
- **Framework**: Playwright (chromium only)

### QA Policy
Each task MUST include agent-executed verification. After ALL fixes, run:
```bash
cd test && npx playwright test --reporter=list
```
Expected: 60 passed (or 58 if P2 tests not added)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (excel.html P0 + P1 fixes — non-overlapping regions, parallel-safe):
├── T1: dataJoinOptions DOM fix (P0) [quick]
├── T2: `?.` optional chaining fix (4 occurrences) [quick]
├── T3: ObjectURL tracking fix [quick]
├── T4: resetTool vertical state + right join Set optimization + data inconsistency blocking [quick]
├── T5: HTML attribute fixes (min/max) + escapeHtml + WorkbookCache logs + uploadArea [quick]
└── T6: Version number consistency [quick]

Wave 2 (test coverage):
└── T7: Supplementary tests (right join + split-column single file) [unspecified-low]

Wave FINAL (4 parallel reviews, then user okay):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality & build check (unspecified-high)
├── F3: Full test suite run (unspecified-high)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1 → T2→T6 (parallel) → T7 → F1-F4 → user okay
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 6 (Wave 1)
```

---

## TODOs

- [ ] 1. Fix `dataJoinOptions` DOM position (P0)

  **What to do**:
  - Move `<div id="dataJoinOptions" class="cs-hidden">...</div>` block (lines 1535-1559) from outside `.container` to inside `id="step3"` → `.card` → alongside other option panels (e.g., after `summaryMergeOptions` closing `</div>` around line 1487)
  - Properly close the step4 div at line 1532, then check that lines 1533-1534 are not orphaned `</div>` closes
  - Ensure the HTML structure is: `.step-content#step3 > .card > ...tab panels... > dataJoinOptions`

  **Must NOT do**:
  - Do NOT change any JS logic (panel show/hide is already handled by `csShow`/`csHide`)
  - Do NOT remove or break any other option panel

  **Recommended Agent Profile**:
  - Category: `quick`
  - Reason: Simple HTML structure fix, one block move

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:1525-1559` — Current broken location, outside `.container`
  - `excel.html:1392-1487` — Target insertion point (after `summaryMergeOptions`, before step3 button-group)

  **Acceptance Criteria**:
  - [ ] `dataJoinOptions` div is inside `.step-content#step3 > .card` div
  - [ ] No orphaned closing `</div>` tags
  - [ ] Switch to data-join mode → upload 2 files → click step3 → see data join config panel in card

  **QA Scenarios**:
  ```
  Scenario: Data-join UI visible in step3
    Tool: Playwright
    Steps:
      1. Navigate to excel.html
      2. Click data-join mode button
      3. Upload simple-merge-a.xlsx and simple-merge-b.xlsx
      4. Click step1Next
      5. Select all sheets in step2
      6. Click step3Next
      7. Assert: dataJoinOptions panel is visible and contains "匹配类型" and "内连接" text
    Expected Result: Data join configuration is visible inside the step3 card area
    Evidence: .omo/evidence/task-1-data-join-ui.png
  ```

  **Commit**: YES
  - Message: `fix: move dataJoinOptions inside step3 card to fix invisible UI`
  - Files: `excel.html`
  - Pre-commit: `npx eslint --no-eslintrc` (skip if no eslint config)

---

- [ ] 2. Fix `?.` optional chaining (4 occurrences, Chrome 49-79 compat) (P1)

  **What to do**:
  Replace all 4 `?.` optional chaining expressions with compatible fallback pattern:
  1. Line 5226: `document.querySelector('input[name="splitSheetOutputFormat"]:checked')?.value || 'zip'`
     → `var el = document.querySelector(...); var val = el ? el.value : 'zip';`
  2. Line 6243: `document.querySelector('input[name="mergeSheetSortOrder"]:checked')?.value || 'asc'`
  3. Line 6851: `document.querySelector('input[name="summaryMethod"]:checked')?.value || 'sum'`
  4. Line 7087: `document.querySelector('input[name="joinType"]:checked')?.value || 'inner'`

  Pattern: `var xEl = document.querySelector('...'); var x = xEl ? xEl.value : 'default';`

  **Must NOT do**:
  - Do NOT change any other `?.` usage (check all before/after to confirm only 4 exist)
  - Do NOT change non-`?.` logic

  **Recommended Agent Profile**:
  - Category: `quick`
  - Reason: 4 simple line changes, clear pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:5226` — splitSheetOutputFormat
  - `excel.html:6243` — mergeSheetSortOrder
  - `excel.html:6851` — summaryMethod
  - `excel.html:7087` — joinType

  **Acceptance Criteria**:
  - [ ] Zero `?.` remaining in `excel.html` (grep -n '\?\.' should return no matches)
  - [ ] Each replacement uses compatible pattern `el ? el.value : 'default'`
  - [ ] No functionality change

  **QA Scenarios**:
  ```
  Scenario: No syntax error from optional chaining
    Tool: Bash
    Steps:
      1. Run: grep -n '\?\.' excel.html | grep -v '//' | grep -v '.md'
      2. Assert: output is empty (0 matches)
    Expected Result: No optional chaining operators remain in JS code
    Evidence: .omo/evidence/task-2-no-optional-chaining.txt

  Scenario: Compatibility test
    Tool: Playwright (run full suite)
    Steps:
      1. Run: npx playwright test
      2. Assert: all tests pass
    Expected Result: No regression from the change
  ```

  **Commit**: Group with T1
  - Message: `fix: resolve 12 confirmed bugs from external AI test reports`
  - Files: `excel.html`

---

- [ ] 3. Fix ObjectURL download tracking (memory leak) (P1)

  **What to do**:
  In `downloadAllFiles()` (line 8744), after creating `var url = URL.createObjectURL(blob)`:
  - Add `activeObjectURLs.push(url);` to track the new URL
  - Add a delayed `revokeObjectURL` using `setTimeout`:
    ```javascript
    var timer = setTimeout(function() {
        try { URL.revokeObjectURL(url); } catch(e) {}
        var idx = activeObjectURLs.indexOf(url);
        if (idx !== -1) activeObjectURLs.splice(idx, 1);
    }, 60000); // revoke after 60 seconds
    pendingRevokeTimers.push(timer);
    ```

  **Must NOT do**:
  - Do NOT change the existing cleanup logic (lines 8749-8755) — it's correct
  - Do NOT use `const`/`let` style if surrounding code uses `var`

  **Recommended Agent Profile**:
  - Category: `quick`
  - Reason: Small, focused change to one function

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:8744-8764` — downloadAllFiles function
  - `excel.html:8749-8755` — Existing cleanup (correct, keep)
  - `excel.html:~2680` — `activeObjectURLs` and `pendingRevokeTimers` declarations

  **Acceptance Criteria**:
  - [ ] `activeObjectURLs.push(url)` added after `URL.createObjectURL(blob)`
  - [ ] `setTimeout` with `URL.revokeObjectURL(url)` added
  - [ ] Timer pushed to `pendingRevokeTimers`

  **QA Scenarios**:
  ```
  Scenario: ObjectURL tracked after download
    Tool: Playwright
    Steps:
      1. Open excel.html, select split-sheet mode
      2. Upload basic-3sheets.xlsx, go through steps
      3. Click download
      4. Evaluate: activeObjectURLs.length > 0
    Expected Result: At least 1 URL is tracked after download
    Evidence: .omo/evidence/task-3-objecturl-tracked.txt
  ```

  **Commit**: Group with T1

---

- [ ] 4. Fix resetTool state + right join optimization + data inconsistency blocking (P1)

  **What to do**:
  Three fixes in one task (same file, adjacent functions):

  **4a. resetTool** (line 2973): Add after line 2992:
  ```javascript
  verticalKeyColumns = [];
  selectedVerticalColumns = [];
  ```

  **4b. right join O(n×m)** (line 7184): Before the right-join loop, build a left-key Set:
  ```javascript
  // Before line 7184, add:
  var leftKeySet = new Set();
  for (let li = 0; li < leftData.length; li++) {
      var lk = String(leftData[li][leftKeyCol] !== undefined && leftData[li][leftKeyCol] !== null ? leftData[li][leftKeyCol] : '');
      leftKeySet.add(lk);
  }
  ```
  Then replace lines 7192-7196 (nested loop):
  ```javascript
  // Replace:
  let foundInLeft = false;
  for (let li = 0; li < leftData.length; li++) {
      const lk = ...;
      if (lk === key) { foundInLeft = true; break; }
  }
  // With:
  var foundInLeft = leftKeySet.has(key);
  ```

  **4c. Data inconsistency block** (phase4OutputManagement): Where the `console.warn` is, add after it:
  ```javascript
  showToast('数据不一致：拆分前后数据总量不匹配，下载可能包含损坏文件', 'error');
  return; // block download
  ```
  or throw to the catch block.

  **Must NOT do**:
  - Do NOT change inner join / left join logic (they already use rightIndex, which is correct)
  - Do NOT remove the `console.warn` — keep it for debugging

  **Recommended Agent Profile**:
  - Category: `quick`
  - Reason: Three small, independent edits

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T1-3, T5-6)
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:2973-2995` — resetTool function
  - `excel.html:7184-7212` — right join nested loop
  - `excel.html:phase4OutputManagement` — data consistency check

  **Acceptance Criteria**:
  - [ ] resetTool() clears verticalKeyColumns and selectedVerticalColumns
  - [ ] Right join uses Set lookup instead of nested loop
  - [ ] Data inconsistency shows error toast and blocks download

  **QA Scenarios**: (tested via full regression suite)

  **Commit**: Group with T1

---

- [ ] 5. Fix HTML attributes + escapeHtml + WorkbookCache + uploadArea (P1)

  **What to do**:
  Five small fixes:

  **5a. Vertical split headerRows min** (line 1272): Change `min="1"` to `min="0"`

  **5b. maxDataRows max attribute** (line 1151): Add `max="1000000"`

  **5c. summaryHeaderRows min** (line 1464): Change `min="1"` to `min="0"` (P2, unify with other modes)

  **5d. escapeHtml backtick** (line 3049-3051): Add `.replace(/`/g, '&#96;')`

  **5e. WorkbookCache remove console.log** (class around line 2683): Replace `console.log(...)` with nothing (remove or comment out). Keep `console.warn` for the JSON fallback.

  **5f. uploadArea keyboard handler**: In `initializeApp()`, add:
  ```javascript
  uploadArea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInput.click();
      }
  });
  ```

  **Must NOT do**:
  - Do NOT change the hint text — just change min/max attributes
  - Do NOT remove `console.warn` — only remove `console.log`

  **Recommended Agent Profile**:
  - Category: `quick`
  - Reason: 6 trivial attribute/line changes

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:1272` — splitVerticalHeaderRows
  - `excel.html:1151` — maxDataRows
  - `excel.html:1464` — summaryHeaderRows
  - `excel.html:3047-3052` — escapeHtml
  - `excel.html:~2683+` — WorkbookCache class
  - `excel.html:initializeApp` — for uploadArea keydown

  **Acceptance Criteria**:
  - [ ] splitVerticalHeaderRows min="0"
  - [ ] maxDataRows max="1000000"
  - [ ] summaryHeaderRows min="0"
  - [ ] escapeHtml now escapes backtick
  - [ ] WorkbookCache has no console.log (only console.warn for errors)
  - [ ] uploadArea: Tab→Enter opens file dialog

  **QA Scenarios**:
  ```
  Scenario: Verify HTML attributes
    Tool: Playwright
    Steps:
      1. Navigate to excel.html
      2. Switch to split-column-vertical mode
      3. Check splitVerticalHeaderRows min attribute is "0"
    Expected Result: min="0"
    Evidence: .omo/evidence/task-5-attributes.txt
  ```

  **Commit**: Group with T1

---

- [ ] 6. Fix version number consistency (P1)

  **What to do**:
  Unify version across all files to `v1.5.0`:
  - `excel.html:1076` — if version string present in title or header comment
  - `README.md:8` — already v1.5.0 per our earlier read
  - `DESIGN.md:1` — change from v2.0 to v1.5.0 (if file exists)
  - `test/` spec files — check for v2.0 references

  **Must NOT do**:
  - Do NOT decide on the final version number unilaterally — ask user if unsure

  **Recommended Agent Profile**:
  - Category: `quick`
  - Reason: Simple string replacements

  **Parallelization**:
  - **Can Run In Parallel**: YES (separate file from excel.html)
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `excel.html:1076` or near there
  - `README.md:8`
  - `DESIGN.md` (if exists)
  - `test/specs/*.js`

  **Decision**: Bump to v1.5.1 (post-fix version increment).

  1. `excel.html` title tag: change "v1.5.0" → "v1.5.1"
  2. `README.md`: if version mentioned, bump to v1.5.1
  3. `DESIGN.md` line 1: change "v2.0" → "v1.5.1"

  **Commit**: Group with T1

---

- [ ] 7. Supplementary tests (right join + split-column single file) (P2)

  **What to do**:
  Add to `test/specs/10-p4-supplementary.spec.js`:
  1. **DJ-03**: Right join test — upload 2 files, select right join, verify result includes right-only rows
  2. **SC-01**: split-column single file mode — upload a file, switch to single file output, verify download is `.xlsx` not `.zip`

  **Must NOT do**:
  - Do NOT modify existing tests
  - Do NOT add test infrastructure or new dependencies

  **Recommended Agent Profile**:
  - Category: `unspecified-low`
  - Reason: Follow existing test patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (separate file)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Wave 1 (need fixed code for accurate testing)

  **References**:
  - `test/specs/10-p4-supplementary.spec.js:DJ-01, DJ-02` — Pattern for data-join tests
  - `test/specs/10-p4-supplementary.spec.js:EF-01~03` — Pattern for export format tests
  - `test/helpers/common.js` — Test helpers

  **Acceptance Criteria**:
  - [ ] DJ-03 tests right join with correct matching
  - [ ] SC-01 tests split-column single file output extension
  - [ ] Both pass when run as part of full suite

  **QA Scenarios**:
  ```
  Scenario: Right join test passes
    Tool: Bash
    Steps:
      1. Run: cd test && npx playwright test specs/10-p4-supplementary.spec.js --reporter=list -g "DJ-03"
      2. Assert: test passes
    Expected Result: Right join test passes
  ```

  **Commit**: YES (separate)
  - Message: `test: add right join and split-column single-file coverage`
  - Files: `test/specs/10-p4-supplementary.spec.js`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (grep for specific patterns, check file structure). For each "Must NOT Have": search for forbidden patterns (false positive items unchanged). Check evidence files exist in .omo/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality & Build Check** — `unspecified-high`
  Run `npx playwright test` (full suite). Verify all 58+ tests pass. Check no obviously broken JS (syntax errors).
  Output: `Test suite: [N/N passed] | VERDICT`

- [ ] F3. **Real QA — Full test suite run** — `unspecified-high`
  Start from clean git state. Apply all changes. Run `npx playwright test --reporter=list`. Count results.
  Output: `Tests: [N passed / N total] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was fixed (no missing), nothing beyond spec was changed (no creep). Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `fix: resolve 12 confirmed bugs from external AI test reports` — `excel.html`, `README.md`
- **2**: `test: add right join and split-column single-file coverage` — `test/specs/10-p4-supplementary.spec.js`

---

## Success Criteria

### Verification Commands
```bash
cd test && npx playwright test --reporter=list
# Expected: 60 passed (58 existing + 2 new)
```

### Final Checklist
- [ ] All 12 P0-P1 bugs fixed
- [ ] No false positive items changed
- [ ] Full test suite passes (58+ tests)
- [ ] git diff shows only intended changes

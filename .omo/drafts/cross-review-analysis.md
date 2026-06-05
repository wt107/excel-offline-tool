# 跨报告交叉验证分析

## 已修复的（v1.5.1 已落地）

| 报告来源 | 编号 | 问题 | 修复证据 |
|---------|------|------|---------|
| KIMI | P0-1 | dataJoinOptions DOM位置 | L1487-1511挪入step3 |
| KIMI | P1-2 | right join O(n×m) | Set索引优化 L7195 |
| KIMI | P1-3 | 缺右连接测试 | DJ-03 已添加 |
| KIMI | P1-6 | resetTool未清verticalKeyColumns | L2996-2997 |
| KIMI | P1-7 | escapeHtml缺反引号 | L3051 |
| KIMI | P2-3 | 缺单文件模式测试 | SC-01 已添加 |
| KIMI | P1-8 | inner join退化为full outer | L7193 已改 `joinType === 'right'` |
| KIMI | P2-4 | AbortController未启用 | L2974-2977 resetTool调用abort |
| Claude | P1-1 | 版本号不一致 | title v1.5.1, DESIGN.md v1.5.1 |
| Claude | P1-4 | splitVerticalHeaderRows min=0 矛盾 | 已改 min="0" |
| Claude | P1-5 | maxDataRows max=1000000 | 已设置 |

## 仍需修复的（按影响面排序）

| 优先级 | 编号 | 问题 | 影响 | 预计时间 | 类型 |
|--------|------|------|------|---------|------|
| P1 | P1-9 | resetTool 漏清6个全局变量（splitReport/selectedSheetForColumn/originalFileType/isXlsFile/lastMergeStatistics/lastSkippedSheets） | 状态残留，统计信息混乱 | 5min | 状态泄漏 |
| P1 | P1-10 | 自测 modes 数组仅5个缺4个（split-rows/smart-merge/summary-merge/data-join） | 模式按钮被误删不自知 | 2min | 测试覆盖 |
| P1 | P1-11 | 模式B Sheet名截断没用 getUniqueSheetName，重名冲突 | Excel打开异常或数据丢失 | 5min | 数据正确性 |
| P2 | P0-1 | onSmartMergeModeChange IIFE作用域不可达 | 模式A/B切换描述不更新 | 5min | UX |
| P2 | P1-12 | data-join 空匹配抛异常而非输出空文件 | 用户无法确认真无匹配 vs 配置错误 | 10min | 业务逻辑 |
| P2 | P2-5 | split-rows 始终用 aoa_to_sheet，保留格式模式也丢样式 | 与保留格式选择矛盾 | 30min | 功能 |
| P2 | P2-8 | getEffectiveProcessingMode 缺 summary-merge/data-join | 未来加处理模式UI易遗漏 | 2min | 配置 |
| P2 | P2-10 | split-rows 合并单元格偏移 `srpHeaderRows + srpStart - srpHeaderRows` 可化简 | 可读性差 | 2min | 可读性 |
| P3 | P2-9 | 移动端9按钮溢出 | 手机用户需大量滚动 | 30min | UX |
| P3 | P2-6 | 模式B 数据追加同步无Time-Slicing | 大文件合并UI假死 | 15min | 性能 |
| P3 | P2-7 | data-join/summary-merge 只取第一个Sheet | 多Sheet用户无法选Sheet | 60min | 功能限制 |

## 不需要修的（假阳 / 设计如此）

- **P2-8 缺失 mapping 实际影响**：summary-merge/data-join 当前没有处理模式UI，所以 fallthrough 到默认值是正确的
- **A1 DESIGN.md 脱节**：文档需要更新，但功能代码没问题
- **A2 单HTML可维护性**：重构要长期规划，不是 bug

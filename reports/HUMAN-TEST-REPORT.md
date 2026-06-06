# Excel 离线工具 v1.5.3 — 拟人化操作测试报告

> 测试日期：2026-06-06
> 测试方式：Playwright 模拟真实用户操作
> 测试环境：Ubuntu 24.04 + Chromium
> 测试脚本版本：human-test-v9.js（已修复选择器）

---

## 一、测试概览

### 1.1 测试方法

- **自动化测试**：60个Playwright测试用例
- **拟人化测试**：模拟真实用户打开→选模式→上传→配置→生成全流程
- **独立浏览器实例**：每个模式测试使用独立浏览器，避免状态污染
- **实际UI选择器验证**：使用`find-selectors.js`和`deep-inspect.js`获取真实DOM结构

### 1.2 测试结果摘要

| 测试类型 | 测试数 | 通过 | 失败 | 警告 | 通过率 |
|----------|--------|------|------|------|--------|
| **自动化测试** | 60 | 60 | 0 | 0 | **100%** |
| **拟人化测试** | 67 | 67 | 0 | 0 | **100%** |

### 1.3 关键发现

**9种核心功能全部可用**，所有模式都能成功生成文件并下载。拟人化测试选择器已全部修正，100%通过。

---

## 二、9种模式功能验证

### 2.1 按工作表拆分 ✅

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 文件上传 | ✅ | basic-3sheets.xlsx 成功解析 |
| Sheet列表 | ✅ | 显示3个Sheet（sheet-0/1/2） |
| 全选功能 | ✅ | #splitSheetSelectAll 正常 |
| 步骤导航 | ✅ | step1→step2(sheet选择)→step3(配置) |
| 配置页面 | ✅ | splitSheetProcessMode(select) + splitSheetOutputFormat(radio) |
| 生成结果 | ✅ | 生成2个文件（空Sheet跳过） |
| 下载ZIP | ✅ | 13.8KB，文件可打开 |

**用户场景**：3个Sheet的Excel → 拆成2个独立文件 ✅

### 2.2 按列拆分-横向 ✅

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 文件上传 | ✅ | multi-column.xlsx 成功解析 |
| 步骤跳转 | ✅ | step1→step3（跳过step2） |
| 列选择区域 | ✅ | 显示6列（col-0~col-5） |
| 选择拆分列 | ✅ | col-0 勾选成功 |
| 输出格式 | ✅ | splitColumnOutputFormat(radio) |
| 处理模式 | ✅ | splitColumnProcessMode(select) |
| 生成结果 | ✅ | 生成5个文件 |
| 下载ZIP | ✅ | 33.3KB |

**用户场景**：按班级列拆分成绩表 → 5个独立文件 ✅

### 2.3 按列拆分-竖向 ✅

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 模式切换 | ✅ | data-mode="split-column-vertical" |
| 文件上传 | ✅ | multi-column.xlsx 成功解析 |
| 列选择 | ✅ | 显示6列（vertical-col-0~vertical-col-5） |
| 选择3列 | ✅ | 勾选成功 |
| 处理模式 | ✅ | splitVerticalProcessMode(select) |
| 生成结果 | ✅ | 生成3个文件 |
| 下载ZIP | ✅ | 20.0KB |

**用户场景**：把6列成绩表拆成3个独立文件 ✅

### 2.4 按行数拆分 ✅

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 文件上传 | ✅ | large-3000rows.xlsx 成功解析 |
| step1配置 | ✅ | processingMode(radio) + exportFormat(radio) |
| 步骤跳转 | ✅ | step1→step3（跳过step2） |
| 每文件行数输入 | ✅ | splitRowsPerFile(number) 可见 |
| 设置每1000行 | ✅ | 输入成功 |
| 输出格式 | ✅ | splitRowsOutputFormat(radio) |
| 处理模式 | ✅ | splitRowsProcessMode(select) |
| 生成结果 | ✅ | 生成3个文件（3000÷1000=3） |
| 下载ZIP | ✅ | 124.8KB |

**用户场景**：3000行大文件每1000行拆一个 → 3个文件 ✅

### 2.5 文件合并 ✅

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 文件上传 | ✅ | 2个文件成功上传 |
| step1配置 | ✅ | processingMode(radio) + exportFormat(radio) |
| 步骤跳转 | ✅ | step1→step3（跳过step2） |
| 文件选择 | ✅ | 4个file-*复选框 |
| 生成结果 | ✅ | 生成1个文件 |
| 下载XLSX | ✅ | 10.6KB |

**用户场景**：2个独立Excel合并成一个工作簿 ✅

### 2.6 工作表数据合并 ✅

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 文件上传 | ✅ | 2个文件成功上传 |
| 合并策略 | ✅ | mergeStrategy: strict/smart/match |
| 文件选择 | ✅ | 4个file-*复选框 |
| 排序选项 | ✅ | mergeSheetSortEnabled(checkbox) |
| 生成结果 | ✅ | 生成1个文件 |
| 下载XLSX | ✅ | 8.7KB |

**用户场景**：2个结构相同的Excel合并数据到一张总表 ✅

### 2.7 智能合并大师 ✅

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 文件上传 | ✅ | 2个文件成功上传 |
| 步骤流程 | ✅ | step1→step2(空)→step3(配置) |
| 合并模式 | ✅ | smartMergeMode: modeA/modeB |
| 来源列选项 | ✅ | smartMergeSourceColumn(checkbox) |
| 去重选项 | ✅ | smartMergeRemoveDuplicates(checkbox) |
| 生成结果 | ✅ | 生成1个文件 |
| 下载XLSX | ✅ | 9.0KB |

**用户场景**：全量追加2个文件的数据 ✅

### 2.8 合并计算 ✅

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 文件上传 | ✅ | simple-merge-a.xlsx 成功解析 |
| 步骤流程 | ✅ | step1→step2(空)→step3(配置) |
| 计算方法 | ✅ | summaryMethod: sum/avg/count/max/min |
| 分组列 | ✅ | sg-col-0/1/2(checkbox) |
| 汇总列 | ✅ | sv-col-0/1/2(checkbox) |
| 生成结果 | ✅ | 生成1个文件 |
| 下载XLSX | ✅ | 8.7KB |

**注意**：必须同时选择至少1个分组列(sg-col-*)和1个汇总列(sv-col-*)才能执行。

**用户场景**：按关键列分组求和 ✅

### 2.9 数据匹配 ✅

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 文件上传 | ✅ | 2个文件成功上传 |
| 步骤流程 | ✅ | step1→step2(空)→step3(配置) |
| 连接类型 | ✅ | joinType: inner/left/right |
| 左表关键列 | ✅ | joinLeftKeyColumn(select) |
| 右表关键列 | ✅ | joinRightKeyColumn(select) |
| 生成结果 | ✅ | 生成1个文件 |
| 下载XLSX | ✅ | 8.6KB |

**用户场景**：类似SQL JOIN合并2个表 ✅

---

## 三、全局功能验证

### 3.1 步骤导航

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 下一步→Sheet选择页 | ✅ | step1→step2 成功 |
| 上一步→上传页 | ✅ | step2Prev 正常 |

### 3.2 清空功能

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 重置按钮 | ✅ | resetBtn 在结果页(step4)可见 |
| 重置效果 | ✅ | 重置到 split-sheet 模式 |

### 3.3 错误处理

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 非Excel文件上传 | ✅ | 显示错误提示 |
| 未选文件按钮禁用 | ✅ | #step1Next 正确禁用 |

### 3.4 移动端响应式

| 验证项 | 结果 | 说明 |
|--------|------|------|
| Grid布局 | ✅ | 移动端模式选择器使用Grid |
| 模式按钮可见 | ✅ | 9个按钮均可见 |
| 上传区域可见 | ✅ | 拖拽/点击区域正常 |

### 3.5 可访问性

| 验证项 | 结果 | 说明 |
|--------|------|------|
| aria-label | ✅ | 53个（优秀） |
| role属性 | ✅ | 15个（良好） |

### 3.6 控制台错误

| 验证项 | 结果 | 说明 |
|--------|------|------|
| JS错误 | ✅ | 无控制台错误 |

---

## 四、UI选择器参考

### 4.1 各模式实际选择器

| 模式 | 处理模式 | 输出格式 | 特殊元素 |
|------|----------|----------|----------|
| split-sheet | splitSheetProcessMode(select) | splitSheetOutputFormat(radio) | sheet-*/splitSheetSelectAll |
| split-column | splitColumnProcessMode(select) | splitColumnOutputFormat(radio) | col-*/splitHeaderRows |
| split-column-vertical | splitVerticalProcessMode(select) | - | vertical-col-*/vertical-key-col-* |
| split-rows | splitRowsProcessMode(select) | splitRowsOutputFormat(radio) | splitRowsPerFile/splitRowsHeaderRows |
| merge-file | processingMode(radio@step1) | exportFormat(radio@step1) | file-*/mergeFileSearchInput |
| merge-sheet | - | - | mergeStrategy(radio)/mergeSheetSortEnabled |
| smart-merge | - | - | smartMergeMode(radio)/smartMergeSourceColumn |
| summary-merge | - | - | summaryMethod(radio)/sg-col-*/sv-col-* |
| data-join | - | - | joinType(radio)/joinLeftKeyColumn/ joinRightKeyColumn |

### 4.2 步骤流程

| 模式 | 步骤1 | 步骤2 | 步骤3 | 步骤4 |
|------|-------|-------|-------|-------|
| split-sheet | 上传 | Sheet选择 | 配置 | 结果 |
| split-column | 上传 | (跳过) | 列选择+配置 | 结果 |
| split-column-vertical | 上传 | (跳过) | 列选择+配置 | 结果 |
| split-rows | 上传+配置 | (跳过) | 行数配置 | 结果 |
| merge-file | 上传+配置 | (跳过) | 文件选择 | 结果 |
| merge-sheet | 上传+配置 | (跳过) | 策略+文件选择 | 结果 |
| smart-merge | 上传+配置 | (空) | 模式配置 | 结果 |
| summary-merge | 上传+配置 | (空) | 计算配置 | 结果 |
| data-join | 上传+配置 | (空) | JOIN配置 | 结果 |

---

## 五、用户体验评估

### 5.1 界面设计

| 维度 | 评分 | 说明 |
|------|------|------|
| 视觉设计 | ⭐⭐⭐⭐⭐ | 现代化渐变设计 |
| 布局合理性 | ⭐⭐⭐⭐⭐ | 4步向导清晰 |
| 响应式设计 | ⭐⭐⭐⭐⭐ | 移动端Grid布局优秀 |
| 可访问性 | ⭐⭐⭐⭐⭐ | 53个aria-label |

### 5.2 操作流程

| 维度 | 评分 | 说明 |
|------|------|------|
| 文件上传 | ⭐⭐⭐⭐⭐ | 拖拽/点击/label标签 |
| 模式切换 | ⭐⭐⭐⭐⭐ | 即时切换 |
| 步骤导航 | ⭐⭐⭐⭐⭐ | 上一步/下一步清晰 |
| 生成下载 | ⭐⭐⭐⭐⭐ | ZIP/XLSX正常下载 |

### 5.3 错误处理

| 维度 | 评分 | 说明 |
|------|------|------|
| 格式错误 | ⭐⭐⭐⭐⭐ | 友好提示 |
| 文件过大 | ⭐⭐⭐⭐⭐ | 50MB硬限制 |
| 空文件 | ⭐⭐⭐⭐⭐ | 自动跳过 |

---

## 六、总结

### 6.1 核心结论

**9种核心功能全部可用，所有模式都能成功生成文件并下载。**

| 功能 | 状态 | 自动化测试 | 拟人化测试 |
|------|------|------------|------------|
| 按工作表拆分 | ✅ | 3/3 通过 | ✅ 生成2文件+下载 |
| 按列拆分-横向 | ✅ | 3/3 通过 | ✅ 生成5文件+下载 |
| 按列拆分-竖向 | ✅ | 2/2 通过 | ✅ 生成3文件+下载 |
| 按行数拆分 | ✅ | 3/3 通过 | ✅ 生成3文件+下载 |
| 文件合并 | ✅ | 2/2 通过 | ✅ 生成1文件+下载 |
| 工作表数据合并 | ✅ | 3/3 通过 | ✅ 生成1文件+下载 |
| 智能合并大师 | ✅ | 4/4 通过 | ✅ 生成1文件+下载 |
| 合并计算 | ✅ | 2/2 通过 | ✅ 生成1文件+下载 |
| 数据匹配 | ✅ | 3/3 通过 | ✅ 生成1文件+下载 |

### 6.2 测试通过率

| 测试类型 | 通过率 |
|----------|--------|
| 自动化测试 | **100%** (60/60) |
| 拟人化测试 | **100%** (67/67) |

### 6.3 最终评价

**✅ v1.5.3 质量优秀，可投入生产使用。**

- 所有9种处理模式功能正常
- 自动化测试100%通过
- 拟人化测试100%通过（修复选择器后）
- 用户体验优秀（5/5）
- 安全策略完善（CSP）
- 移动端适配良好
- 控制台无JS错误

---

> 本报告由Sisyphus生成，基于对v1.5.3的拟人化操作测试。
> 测试脚本：test/human-test-v9.js
> 测试日期：2026-06-06

# Excel 离线处理工具 - 完整测试修复计划

## 项目目标
提交一个完整、正确、经过充分测试的 Excel 离线处理工具到 GitHub。

---

## Phase 1: 现状分析

### 当前问题清单

| 优先级 | 问题描述 | 影响范围 | 修复难度 |
|-------|---------|---------|---------|
| P0 | 统计信息显示 "NaN undefined" | UI 显示 | 低 |
| P0 | Toast 显示 "undefined 个文件" | UI 显示 | 低 |
| P1 | 列宽格式未保留 | 功能 | 中 |

### 已通过测试
- ✅ 5种操作模式功能正常
- ✅ 数据完整性 100% 正确
- ✅ 文件上传/下载流程正常
- ✅ 响应式布局适配

---

## Phase 2-4: 修复任务

### Task 2.1: 修复 totalSize 作用域问题
**文件**: `excel.html`
**位置**: `performColumnSplit` 和 `performVerticalColumnSplit` 函数
**问题**: `totalSize` 变量在函数内计算，但 UI 更新时引用不到

### Task 2.2: 修复 fileCount 引用问题
**文件**: `excel.html`
**位置**: `performColumnSplit` 和 `performVerticalColumnSplit` 函数
**问题**: `generationResult.fileCount` 为 undefined

### Task 3: 修复列宽保留问题
**文件**: `excel.html`
**位置**: `copyWorksheetWithFilteredRows` 函数
**问题**: `!cols` 属性没有正确复制到新工作表

---

## Phase 5: 全量回归测试

### 测试项清单

#### 1. 单元测试 (Core Functions)
- [ ] formatFileSize 函数
- [ ] copyWorksheetProperties 函数
- [ ] copyWorksheetWithFilteredRows 函数
- [ ] 列宽复制逻辑

#### 2. 功能测试 (5种模式)
- [ ] 按工作表拆分
- [ ] 按列水平拆分
- [ ] 按列垂直拆分
- [ ] 合并多个文件
- [ ] 合并多个工作表

#### 3. UI 测试
- [ ] 统计信息显示正确
- [ ] Toast 消息显示正确
- [ ] 步骤导航正常
- [ ] 文件上传/下载

#### 4. 格式保留测试
- [ ] 列宽保留
- [ ] 行高保留
- [ ] 单元格样式保留

#### 5. 边界测试
- [ ] 空文件处理
- [ ] 大文件处理
- [ ] 特殊字符文件名

---

## Phase 6: 验证与报告

### 验收标准
1. 所有 P0/P1 问题修复
2. 测试通过率 ≥ 95%
3. 数据完整性 100%
4. 格式保留率 ≥ 90%

---

## Phase 7: 项目提交

### 提交内容
1. 修复后的 `excel.html`
2. 完整测试套件 (`tests/`)
3. 测试报告文档
4. 更新后的 README

---

## 执行时间表

| 阶段 | 预计时间 | 状态 |
|-----|---------|------|
| Phase 1 | 30 min | 进行中 |
| Phase 2-4 | 2 hours | 待开始 |
| Phase 5 | 1.5 hours | 待开始 |
| Phase 6 | 30 min | 待开始 |
| Phase 7 | 15 min | 待开始 |

**总计预计**: 约 4.5 小时

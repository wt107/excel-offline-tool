# Excel 离线工具 - 自动化测试套件

基于 Playwright 的端到端自动化测试，覆盖全部 9 种处理模式。

---

## 目录结构

```
test/
├── package.json              # 依赖与脚本
├── playwright.config.js      # Playwright 配置
├── server.js                 # 轻量级静态服务器（零依赖）
├── README.md                 # 本文件
├── scripts/
│   ├── generate-test-data.js # 测试数据生成器
│   └── clean.js              # 清理测试产物
├── helpers/
│   └── common.js             # 公共工具函数（页面操作封装）
├── specs/
│   ├── 00-selftest.spec.js           # 内置自测系统验证
│   ├── 01-split-sheet.spec.js        # 按工作表拆分
│   ├── 02-split-column.spec.js       # 按列拆分(横向)
│   ├── 03-split-vertical.spec.js     # 按列拆分(竖向)
│   ├── 04-merge-file.spec.js         # 文件合并
│   ├── 05-merge-sheet.spec.js        # 工作表数据合并
│   ├── 06-large-file.spec.js         # 大文件与性能测试
│   ├── 07-formula.spec.js            # 公式处理验证
│   ├── 08-v2-features.spec.js        # v2 新功能（smart-merge、排序、导出格式等）
│   ├── 09-p4-large-data.spec.js      # 大数据量与最大行数截断
│   ├── 10-p4-supplementary.spec.js   # 补充功能（footerRows、summary-merge、data-join、模板等）
│   └── merge-bug1.spec.js            # Bug-1 修复回归验证
├── test-data/                # 生成的测试Excel文件（首次运行自动生成）
└── test-downloads/           # 测试下载临时目录（.gitignore 忽略）
```

---

## 快速开始

### 1. 安装（首次）

```bash
cd test
npm run setup
```

这会自动执行 `npm install` + 安装 Chromium 浏览器。

### 2. 生成测试数据

```bash
npm run generate
```

在 `test-data/` 下生成测试所需的 Excel 文件。

### 3. 运行全部测试

```bash
npm test
```

### 4. 查看测试报告

```bash
npm run report
```

---

## 单独运行某个模式

```bash
npm run test:selftest          # 仅自测系统
npm run test:split-sheet       # 仅按工作表拆分
npm run test:split-column      # 仅按列拆分(横向)
npm run test:split-vertical    # 仅按列拆分(竖向)
npm run test:merge-file        # 仅文件合并
npm run test:merge-sheet       # 仅工作表数据合并
```

---

## 有头模式（可视化调试）

```bash
npm run test:headed            # 弹出浏览器窗口
npm run test:ui                # Playwright UI 模式
```

---

## 测试数据说明

| 文件名 | 特征 | 用途 |
|--------|------|------|
| basic-3sheets.xlsx | 3个Sheet(含1个空表) | 按工作表拆分、文件合并 |
| merged-cells.xlsx | 合并单元格+分类列 | 按列拆分(横向) |
| case-sensitive.xlsx | Apple/apple大小写冲突 | 文件名去重验证 |
| multi-column.xlsx | 6列成绩表 | 按列拆分(竖向) |
| simple-merge-a/b.xlsx | 2个结构相同的文件 | 工作表数据合并、数据匹配 |
| special-chars.xlsx | 拆分列含 \/:*?"<> | 文件名安全处理 |
| formula.xlsx | 含公式列 | 强制重算标记验证 |
| large-3000rows.xlsx | 3000行大文件 | 时间片分片+性能 |
| bug1-merge-2cols.xlsx | 2列数据 | Bug-1 回归验证 |
| bug1-merge-5cols.xlsx | 5列数据 | Bug-1 回归验证 |
| empty-cells.xlsx | 空单元格 | 空值处理验证 |
| zero-cells.xlsx | 含0值单元格 | 零值保留验证 |

---

## 项目升级时如何更新测试

1. **新增功能**：在 `specs/` 下新建 `xx-xxx.spec.js`，编号递增
2. **新增测试数据**：在 `scripts/generate-test-data.js` 末尾追加生成逻辑
3. **UI 变更**：更新 `helpers/common.js` 中的选择器和操作函数
4. **版本号同步**：更新 `package.json` 中的 `version` 字段

---

## 故障排除

| 问题 | 解决 |
|------|------|
| `Error: browserType.launch` | 运行 `npx playwright install chromium` |
| 端口 3077 被占用 | 修改 `playwright.config.js` 和 `server.js` 中的端口号 |
| 测试超时 | 在 `playwright.config.js` 中增大 `timeout` 值 |
| 找不到测试数据 | 先运行 `npm run generate` |

# Excel 离线工具测试套件

本项目包含完整的测试体系，用于验证 Excel 离线工具的功能、性能和兼容性。

## 📁 测试结构

```
tests/
├── unit/                    # 单元测试
│   ├── excel-utils.test.js  # Excel 工具函数测试
│   └── core-functions.test.js # 核心功能测试
├── integration/             # 集成测试
│   └── functional-flow.test.js # 功能流程测试
├── e2e/                     # 端到端测试
│   ├── specs/
│   │   └── excel-tool.spec.js # Playwright E2E 测试
│   └── playwright.config.js   # Playwright 配置
├── fixtures/                # 测试数据
│   ├── test-data-generator.js # 测试数据生成器
│   └── *.xlsx, *.xls        # 测试用 Excel 文件
├── reports/                 # 测试报告输出
├── run-tests.js             # 简单测试运行器
└── package.json             # 依赖配置
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd tests
npm install
```

### 2. 安装 Playwright（用于 E2E 测试）

```bash
npm run playwright:install
npm run playwright:install-deps  # 安装浏览器依赖（可选）
```

### 3. 运行测试

```bash
# 运行所有测试（不含 E2E）
npm test

# 仅运行单元测试
npm run test:unit

# 仅运行集成测试
npm run test:integration

# 运行 E2E 测试
npm run test:e2e

# 运行 E2E 测试（UI 模式）
npm run test:e2e:ui

# 运行所有测试（含 E2E）
npm run test:all

# 使用简单测试运行器（不依赖 Jest）
npm run test:simple
```

## 📊 测试类型

### 1. 后台测试（单元测试）

测试核心工具函数和业务逻辑：

- **Excel 工具函数** (`excel-utils.test.js`)
  - 工作表解析
  - 单元格拷贝
  - 表头验证
  - 格式转换

- **核心功能** (`core-functions.test.js`)
  - 工作簿缓存
  - 文件名处理
  - 范围引用调整

### 2. 集成测试

测试完整的功能流程：

- 按工作表拆分流程
- 按列拆分（横向）流程
- 按列拆分（竖向）流程
- 多文件合并流程
- 工作表数据合并流程
- 边界情况处理

### 3. 前台测试（E2E 测试）

使用 Playwright 测试用户界面交互：

- 页面加载和初始化
- 模式切换
- 文件上传
- 工作表选择
- 列选择
- 文件下载
- 重置功能
- 错误处理
- 性能测试

## 🧪 测试数据

测试数据生成器 (`fixtures/test-data-generator.js`) 提供多种测试场景：

- 标准销售数据
- 员工信息数据
- 多行表头数据
- 包含空值的数据
- 大数据集（性能测试）
- 多工作表数据
- 特殊字符数据
- 日期格式数据
- 数字格式数据

## 📈 测试报告

测试报告会自动生成到 `reports/` 目录：

```
reports/
├── test-results.json       # JSON 格式结果
├── test-report.html        # HTML 格式报告
├── coverage/               # 代码覆盖率报告
│   ├── lcov-report/
│   └── coverage.json
└── playwright-report/      # Playwright 报告
```

查看报告：

```bash
npm run report
```

然后访问 http://localhost:3000

## 🔧 配置说明

### Jest 配置 (`package.json`)

```json
{
  "jest": {
    "testEnvironment": "jsdom",
    "collectCoverageFrom": [
      "../src/**/*.js",
      "../excel.html"
    ]
  }
}
```

### Playwright 配置 (`e2e/playwright.config.js`)

- 支持 Chrome、Firefox、Safari
- 支持移动端测试（Pixel 5、iPhone 12）
- 自动截图和视频录制（失败时）
- HTML 和 JSON 报告

## 📋 测试覆盖范围

### 功能测试

- [x] 按工作表拆分
- [x] 按列拆分（横向）
- [x] 按列拆分（竖向）
- [x] 多文件合并
- [x] 工作表数据合并

### 文件格式测试

- [x] XLSX 格式
- [x] XLS 格式（旧版 Excel）
- [x] 文件格式验证
- [x] 大文件处理

### 边界测试

- [x] 空文件
- [x] 空工作表
- [x] 空值处理
- [x] 重名处理
- [x] 特殊字符
- [x] 文件大小限制

### 性能测试

- [x] 文件解析速度
- [x] 大数据集处理
- [x] 多工作表渲染
- [x] 内存使用

### 兼容性测试

- [x] Chrome
- [x] Firefox
- [x] Safari
- [x] Edge
- [x] 移动端浏览器

## 🐛 调试

### 调试单元测试

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### 调试 E2E 测试

```bash
npm run test:e2e:debug
```

### 查看测试日志

```bash
DEBUG=pw:api npm run test:e2e
```

## 📝 添加新测试

### 添加单元测试

在 `unit/` 目录创建新的 `.test.js` 文件：

```javascript
describe('新功能测试', () => {
  test('应该...', () => {
    expect(result).toBe(expected);
  });
});
```

### 添加集成测试

在 `integration/` 目录添加测试用例：

```javascript
describe('新流程测试', () => {
  test('完整流程', () => {
    // 准备数据
    // 执行操作
    // 验证结果
  });
});
```

### 添加 E2E 测试

在 `e2e/specs/` 目录添加测试：

```javascript
test('用户场景', async ({ page }) => {
  const excelPage = new ExcelToolPage(page);
  await excelPage.goto();
  // 执行操作
  // 验证结果
});
```

## 🔗 相关文档

- [PRD.md](../PRD.md) - 产品需求文档
- [开发计划.md](../开发计划.md) - 开发计划
- [验收报告.md](../验收报告.md) - 验收标准

## 📞 问题反馈

如有测试相关问题，请提交 Issue 或联系开发团队。

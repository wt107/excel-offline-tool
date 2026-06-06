# Excel 离线浏览器工具 v1.5.3

纯前端 Excel 拆分与合并工具，无需安装、无需上传服务器，浏览器直接打开即用。

## 功能

| 功能 | 说明 |
|-----|------|
| 按工作表拆分 | 多工作表 Excel → 多个独立文件 |
| 按列拆分（横向） | 按指定列值分组拆分 |
| 按列拆分（竖向） | 多列拆为多个文件 |
| 按行数拆分 | 每 N 行拆分为一个文件 |
| 文件合并 | 多个 Excel → 一个工作簿 |
| 工作表数据合并 | 多工作表数据 → 一张总表 |
| 智能合并 | 模式A 全量追加（支持按列去重）/ 模式B 按名称归类 |
| 数据预览 | 上传文件后预览前50行数据 |
| 合并计算 | 按关键列分组汇总（求和/计数/平均值） |
| 数据匹配 | 类似 SQL JOIN（内连接 / 左连接 / 右连接） |

## 快速开始

**方式一**：下载 Releases ZIP 包，解压后双击 `excel.html`

**方式二**：
```bash
git clone https://github.com/wt107/excel-offline-tool.git
cd excel-offline-tool
open excel.html
```

**方式三**：手动下载以下文件，保持目录结构后打开 `excel.html`
```
excel-offline-tool/
├── excel.html
└── lib/
    ├── jszip.min.js
    └── xlsx.full.min.js
```

## 使用流程

选择模式 → 上传文件 → 配置选项 → 生成 → 下载

## 支持格式

| 格式 | 读取 | 写入 |
|------|:----:|:----:|
| .xlsx | ✅ | ✅ |
| .xls | ✅ | ❌ |
| .csv | - | ✅ |
| .zip | - | ✅ |

## 已知限制

| 限制 | 说明 |
|------|------|
| 合并后公式不保留 | 合并操作（merge-sheet / smart-merge 模式A）使用 `sheet_to_json` 重建数据，公式 `f` 属性丢失，仅保留计算值。这是 SheetJS 库的设计限制 |
| 无撤销/历史记录 | 本工具定位为一次性离线处理工具，不保留操作历史。误操作请重新上传文件处理 |
| 单文件架构 | 故意保持为单 HTML 文件（零构建依赖、双击即用），不拆分为模块化项目 |

## 隐私

所有数据仅在本地浏览器处理，不上传任何服务器。

## 技术栈

- HTML5 + CSS3 + JavaScript（纯原生，无框架）
- [SheetJS](https://github.com/SheetJS/sheetjs) v0.18.5 — Excel 处理
- [JSZip](https://github.com/Stuk/jszip) v3.10.1 — ZIP 生成

## 测试

```bash
cd test
npm run setup    # 首次安装
npm run generate # 生成测试数据
npm test         # 运行全部测试
```

## 许可证

[MIT](LICENSE) © 2026

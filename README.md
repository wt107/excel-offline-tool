# Excel 离线浏览器工具

纯前端 Excel 拆分与合并工具，无需安装、无需上传服务器，浏览器直接打开即用。

## 功能

| 功能 | 说明 |
|-----|------|
| 按工作表拆分 | 多工作表 Excel → 多个独立文件 |
| 按列拆分（横向） | 按指定列值分组拆分 |
| 按列拆分（竖向） | 多列拆为多个文件 |
| 文件合并 | 多个 Excel → 一个工作簿 |
| 工作表数据合并 | 多工作表数据 → 一张总表 |

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
| .zip | - | ✅ |

## 隐私

所有数据仅在本地浏览器处理，不上传任何服务器。

## 技术栈

- HTML5 + CSS3 + JavaScript（纯原生，无框架）
- [SheetJS](https://github.com/SheetJS/sheetjs) v0.18.5 — Excel 处理
- [JSZip](https://github.com/Stuk/jszip) — ZIP 生成

## 许可证

[MIT](LICENSE) © 2026

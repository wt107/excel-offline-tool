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

1. 选择模式 → 2. 上传文件 → 3. 配置选项 → 4. 生成 → 5. 下载

## 支持格式

| 格式 | 读取 | 写入 |
|------|:----:|:----:|
| .xlsx | ✅ | ✅ |
| .xls | ✅ | ❌ |
| .zip | - | ✅ |

## 限制

- 单文件 20MB / 总计 100MB / 最多 50 个文件 / 200 个工作表
- 推荐浏览器：Chrome、Edge（兼容 Win7 旧版 Chrome）

## 隐私

所有数据仅在本地浏览器处理，不上传任何服务器。

---

## 自测系统

内置 122 项自测（T01-T122），覆盖核心函数、边界条件、安全防护。

触发方式：`excel.html?selftest=1`

| 范围 | 测试项 |
|------|--------|
| 核心函数存在性 | T01-T18 |
| deepCopyCell 边缘（NaN/Infinity/stripStyle） | T19-T23, T110-T116 |
| 格式属性克隆（合并/CF/DV/超链接） | T24-T61 |
| 工作表操作（拆分/合并/文件名/内存） | T62-T109 |
| 性能与安全（stripAllStyles/precloned/公式偏移/联合范围/指纹） | T110-T122 |

---

## 架构决策

### ADR-001: deepCopyCell 双层 stripStyle

- `stripStyle`：仅删数字型 s（样式索引），保留对象型 s（内联样式）— 同工作簿操作用
- `stripAllStyles`：删全部 s — 跨工作簿合并用，防止对象型 s 绕过样式表共享致 OOM
- 用户可通过"保留单元格格式"开关选择；追加表公式始终转静态值（见 ADR-003）

### ADR-002: NaN 标记为 #NUM!

NaN 不能归零（财务假账风险）也不能静默消失（公式链断裂）。设 `t='e', w='#NUM!'` 在 Excel 中显示为错误，保留错误信号。Infinity 降级为 9.999E+307 保留数学方向性。

### ADR-003: 后续表公式策略

merge-sheet 追加表行号偏移到合并总表新位置，仅做列偏移会导致公式引用错误行（如 `=B5*C5` 偏移列后仍引用第5行而非实际追加行）。决策：后续表**始终剥离公式保留计算值**，无论 preserveStyles 开关。基准表做列偏移+1。

### ADR-004: 缓存 key 加入内容指纹

同名同大小同时间戳的不同文件会假命中。缓存 key 追加文件前 8KB 的 djb2 哈希，先读文件再判缓存。

---

## 待改进项

| # | 优先级 | 说明 |
|---|:------:|------|
| 1 | 高 | 后续表公式行偏移 — 当前剥离公式保留计算值，需实现 `shiftFormulaRefs` 行偏移能力 |
| 2 | 高 | 后续表 CF/DV 合并 — 当前仅保留基准表 CF/DV，后续表被丢弃 |
| 3 | 中 | cloneWorksheetCustom 按需拷贝 — 只拷贝 rowsToKeep 范围内单元格，降低内存 |
| 4 | 低 | Playwright 测试数据依赖 — CI 需集成测试文件生成步骤 |

---

## 版本历史

### v1.5.0 (2026-05-28)

**数据安全**：NaN→#NUM! 错误标记 | Infinity 降级 | `t='e'` 单元格保留原始值

**公式处理**：新增 `shiftFormulaRefs` 列偏移（基准表自动+1）| 后续表一律剥离公式保留计算值 | `$` 绝对列/跨Sheet引用正确处理

**性能**：Map O(1) 替代所有核心路径 indexOf O(n²) | precloned 参数消除列拆分 N 次 full-clone OOM 峰值 | stripAllStyles 防止大量合并时对象型 s OOM

**正确性**：联合范围（空格分隔 sqref）递归处理 | CF/DV 行范围扩展到合并总行数（仅相对行号）| LRU 缓存追加内容指纹防假命中 | ObjectURL 安全回收防下载中断 | !views 清理防元数据损坏 | 表头校验 trim 容错

**兼容性**：核心路径 11 处 forEach+箭头→传统 for | for...of / spread 全部消除 | loadingOverlay 防 XSS

**自测**：53→122 项（新增 T110-T122 覆盖 stripAllStyles/precloned/公式偏移/联合范围/内容指纹）

### v1.4.0 (2026-05-20)

**核心**：`cloneWorksheetCustom` 深拷贝策略（内存降 60%+）| 行级时间片防 UI 假死 | Map 查找优化 | 强制重算标记 `fullCalcOnLoad` | 单 Sheet 失败不中断 | 合并图层警告 | 冻结窗格清理 | headerRows 边界校验

**修复**：样式索引错乱 | 函数重复定义 | 绝对引用格式 | 文件名大小写去重 | 合并单元格花括号错配 | Object.assign 浅拷贝引用共享 | dataValidation 偏移遍历

**自测**：新增 T14-T18（53 项）

### v1.3.1 (2026-04-14)

新增"复制后删除"策略 | WorkbookCache 缓存系统 | 内置自测 53 项 | 内存管理机制

---

## 技术栈

- HTML5 + CSS3 + JavaScript（纯原生，无框架）
- [SheetJS](https://github.com/SheetJS/sheetjs) v0.18.5 — Excel 处理
- [JSZip](https://github.com/Stuk/jszip) — ZIP 生成

## 许可证

[MIT](LICENSE) © 2026

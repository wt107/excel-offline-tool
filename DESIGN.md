# Excel 离线工具 v2.0 — 完整技术设计文档

> 本文档涵盖架构设计、功能规格、实现细节、回测计划、性能基准。
> 用户确认后，按此文档逐条实施。

---

## 一、架构设计（已确认）

### 1.1 技术选型（锁定）

| 技术 | 选择 | 理由 |
|------|------|------|
| UI 框架 | Vanilla JS（不引入 Vue/React） | 纯手工维护单 HTML，零构建依赖 |
| 样式 | 现有内联 CSS | 保持现状，不引入 Tailwind CDN（避免 +1.5MB） |
| Excel 解析 | SheetJS v0.18.5 | 功能完整，内嵌为文本块 |
| ZIP 生成 | JSZip v3.10.1 | 功能完整，内嵌为文本块 |
| 大文件处理 | 主线程 Time-Slicing（setTimeout） | 每 500 行让出 16ms，UI 不卡死 |
| 构建工具 | 无 | 纯手工维护，不引入 Webpack/Vite |

### 1.2 单 HTML 架构（保持现状，优化大文件处理）

```
┌─────────────────────────────────────────────────────────────┐
│                    excel.html（单文件）                       │
├─────────────────────────────────────────────────────────────┤
│  区域A：HTML 结构                                              │
│  └── 约 1200 行，5 个模式入口、4 步向导、配置面板              │
├─────────────────────────────────────────────────────────────┤
│  区域B：CSS 样式                                               │
│  └── 约 500 行，内联样式，零外部依赖                           │
├─────────────────────────────────────────────────────────────┤
│  区域C：JS 逻辑（Vanilla JS）                                  │
│  ├── 工具函数（cloneWorksheet、validateHeader、sanitize 等）   │
│  ├── UI 交互（模式切换、步骤导航、文件上传、事件绑定）         │
│  ├── 处理引擎（split / merge / export）                       │
│  │   └── 大文件循环中嵌入 Time-Slicing（setTimeout 切片）      │
│  ├── 全局配置（命名规则、处理模式、预警阈值）                  │
│  └── 自测系统（T01-T120+）                                     │
└─────────────────────────────────────────────────────────────┘
```

> **CSP 备注**：当前 HTML 中 `<script nonce="excel-offline-2026">` 的 nonce 为装饰性标注。由于本工具为纯离线单机使用（双击打开，无服务器），实际 CSP 策略由浏览器默认行为控制，不影响功能。`nonce` 和 `'unsafe-inline'` 的清理属于代码整洁度优化，不在本计划优先级内。

### 1.3 大文件 Time-Slicing 机制

**不引入 Web Worker**，在现有主线程代码中加入时间片轮转：

```javascript
// 通用时间片轮转函数
async function processWithYielding(items, processFn, onProgress, options = {}) {
    const CHUNK_SIZE = options.chunkSize || 500;  // 可调：Sheet级操作 10，行级操作 500
    const YIELD_MS = options.yieldMs || 16;       // 可调：16ms ≈ 1 帧
    const total = items.length;
    
    for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = items.slice(i, Math.min(i + CHUNK_SIZE, total));
        for (const item of chunk) {
            processFn(item);
        }
        onProgress(Math.min(i + CHUNK_SIZE, total), total);
        if (i + CHUNK_SIZE < total) {
            await new Promise(r => setTimeout(r, YIELD_MS));
        }
    }
}

// 参数选择指南：
// - Sheet 级操作（cloneWorksheet、XLSX.write）：chunkSize=10，单次耗时 50-200ms
// - 行级操作（数据遍历、去重）：chunkSize=500，单次耗时 <5ms
// - 单元格级操作（样式填充）：chunkSize=1000，单次耗时 <1ms
```

### 1.4 内存管理策略（主线程）

```javascript
// 处理完一个 Sheet/文件后，立即释放引用
function releaseWorkbook(workbook) {
    for (const sheetName of workbook.SheetNames) {
        workbook.Sheets[sheetName] = null;
    }
    workbook.SheetNames = null;
    workbook.Sheets = null;
}

// 大文件自动降级到"仅数据"模式
function autoSwitchToDataOnlyMode(cellCount) {
    const WARNING_CELL_COUNT = 2_000_000;
    if (cellCount > WARNING_CELL_COUNT) {
        return {
            mode: 'data-only',
            reason: `检测到 ${(cellCount/10000).toFixed(1)} 万单元格，自动切换`,
            readOptions: { cellStyles: false, cellFormula: false, cellNF: false, cellDates: false }
        };
    }
    return { mode: 'full', readOptions: {} };
}
```

### 1.5 状态管理（主线程）

```javascript
const AppState = {
    // 当前步骤
    currentStep: 1,           // 1 | 2 | 3 | 4
    
    // 当前模式
    currentMode: 'split-sheet', // 'split-sheet' | 'split-column' | 
                                // 'split-vertical' | 'split-rows' |
                                // 'smart-merge'
    
    // 上传的文件
    uploadedFiles: [],        // [{ name, size, type, buffer, workbook }]
    
    // 用户选择
    selectedSheets: new Set(),           // split-sheet / merge 模式
    selectedColumns: new Set(),          // split-column 模式
    selectedKeyColumns: new Set(),       // split-vertical 模式
    selectedDataColumns: new Set(),      // split-vertical 模式
    
    // 配置
    config: {
        headerRows: 1,               // 表头行数
        footerRows: 0,               // 底部行数（新增）
        processingMode: 'full',      // 'full' | 'data-only'
        outputFormat: 'zip',         // 'zip' | 'single-workbook'
        namingTemplate: '{original}_{sheet}', // 命名模板
        rowChunkSize: 1000,          // 按行数拆分的每份行数
        removeDuplicates: false,     // 是否去重
        duplicateMode: 'row',        // 'row' | 'column'
        duplicateColumns: [],        // 去重依据列
    },
    
    // 运行状态
    isProcessing: false,
    currentTimer: null,      // 当前 Time-Slicing 计时器引用（用于取消）
    
    // 输出
    generatedFiles: [],       // [{ name, blob, size }]
    outputBlob: null,         // 最终下载用的 Blob
};
```

---

## 二、功能规格（6 个模式）

### 2.1 模式总览

```
┌────────────────────────────────────────────────────────────────┐
│                        模式选择面板                              │
├────────────────────────────────────────────────────────────────┤
│  📑 按工作表拆分    │  📋 按列拆分(横向)   │  📊 按列拆分(竖向)  │
├────────────────────────────────────────────────────────────────┤
│  📄 按行数拆分      │  📁 智能合并大师                           │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 模式一：按工作表拆分（split-sheet）

**功能描述**：将单个 Excel 文件的多个工作表拆分为独立的文件。

**输入**：单个 Excel 文件（.xlsx/.xls/.xlsm）

**步骤流程**：
```
Step 1: 上传文件
   ↓
Step 2: 显示工作表列表，用户勾选要拆分的
   ↓
Step 3: [配置选项]
   ├── 输出格式：(•) ZIP ( ) 单文件多Sheet
   └── 命名模板：{原文件名}_{工作表名}
   ↓
Step 4: 处理 → 下载
```

**Step 3 配置项**：

| 配置项 | 类型 | 默认值 | 选项 | 说明 |
|--------|------|--------|------|------|
| 工作表选择 | 多选复选框 | 无 | 文件内所有 Sheet | 全选/取消全选 |
| 输出格式 | 单选 | ZIP | ZIP / 单文件多Sheet | 新增 |
| 命名模板 | 文本输入 | `{original}_{sheet}` | — | 新增 |
| 处理模式 | 单选 | 保留格式 | 保留格式 / 仅数据 | 新增 |

**处理逻辑**：

```javascript
// Split-Sheet 模式处理（主线程 Time-Slicing）
async function splitSheet(fileBuffer, selectedSheets, config, onProgress) {
    // 1. 解析文件（同步阻塞，约 3-5 秒对大文件）
    const workbook = XLSX.read(fileBuffer, {
        type: 'array',
        cellStyles: config.processingMode !== 'data-only',
        cellNF: config.processingMode !== 'data-only',
        cellFormulas: config.processingMode !== 'data-only',
        cellDates: config.processingMode !== 'data-only'
    });
    
    // 2. 逐 Sheet 处理（Time-Slicing 切片）
    const generated = [];
    
    await processWithYielding(selectedSheets, (sheetName, index) => {
        const worksheet = workbook.Sheets[sheetName];
        
        if (config.processingMode === 'data-only') {
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            worksheet = XLSX.utils.aoa_to_sheet(json);
        }
        
        const newWb = XLSX.utils.book_new();
        const cloned = cloneWorksheet(worksheet, {
            stripStyle: config.processingMode === 'data-only'
        });
        XLSX.utils.book_append_sheet(newWb, cloned, sheetName);
        
        const buffer = XLSX.write(newWb, { bookType: 'xlsx', type: 'array' });
        const fileName = applyNamingTemplate(config.namingTemplate, {
            original: config.originalFileName,
            sheet: sheetName,
            index: index + 1
        });
        
        generated.push({ name: fileName + '.xlsx', buffer });
    }, onProgress, { chunkSize: 10, yieldMs: 16 });
    
    // 3. 输出
    if (config.outputFormat === 'zip') {
        const zip = new JSZip();
        for (const file of generated) {
            zip.file(file.name, file.buffer);
        }
        const zipBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
        return { blob: zipBuffer, fileCount: generated.length };
    } else {
        // 单文件多 Sheet
        const newWb = XLSX.utils.book_new();
        for (const file of generated) {
            const wb = XLSX.read(file.buffer, { type: 'array' });
            XLSX.utils.book_append_sheet(newWb, wb.Sheets[wb.SheetNames[0]], file.name.replace('.xlsx', ''));
        }
        const buffer = XLSX.write(newWb, { bookType: 'xlsx', type: 'arraybuffer' });
        return { blob: buffer, fileCount: generated.length };
    }
}
```

**输出**：
- ZIP 格式：`{原文件名}_{时间戳}.zip`，内含多个 xlsx
- 单文件多 Sheet 格式：`{原文件名}_{时间戳}.xlsx`

**回测计划**：

| 测试ID | 场景 | 输入 | 预期结果 |
|--------|------|------|---------|
| TS-01 | 基础拆分 | 3-Sheet 文件，全选 | ZIP 内含 3 个 xlsx，每个保留原 Sheet 名 |
| TS-02 | 部分选择 | 5-Sheet 文件，选 2 个 | ZIP 内含 2 个 xlsx |
| TS-03 | 空表跳过 | 含 1 个空 Sheet | ZIP 不含空表，提示"已跳过 1 个空工作表" |
| TS-04 | 输出单文件多Sheet | 3-Sheet 文件，选"单文件多Sheet" | 输出 1 个 xlsx，内含 3 个 Sheet |
| TS-05 | 仅数据模式 | 含样式文件，选"仅数据" | 输出文件无样式，仅保留值 |
| TS-06 | 自定义命名 | 命名模板 `{original}_({sheet})_{index}` | 文件名符合模板规则 |
| TS-07 | 公式保留 | 含公式文件，选"保留格式" | 公式 f 属性保留 |
| TS-08 | 大文件 | 3000 行 × 6 列 | 10 秒内完成，不崩溃 |

---

### 2.3 模式二：按列拆分横向（split-column）

**功能描述**：按指定列的值分组，将行拆分到不同文件。

**输入**：单个 Excel 文件

**步骤流程**：
```
Step 1: 上传文件
   ↓
Step 3: 
   ├── 配置表头行数
   ├── 选择要拆分的工作表（多 Sheet 文件）
   ├── 选择拆分依据列
   ├── 输出格式：(•) ZIP ( ) 单文件多Sheet
   └── 命名模板
   ↓
Step 4: 处理 → 下载
```

**Step 3 配置项**：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 表头行数 | 数字 | 1 | 0-10 |
| 拆分工作表 | 单选 | 第一个 Sheet | 多 Sheet 文件需选择 |
| 拆分依据列 | 多选复选框 | 无 | 按列值分组（支持多列组合） |
| 输出格式 | 单选 | ZIP | ZIP / 单文件多Sheet |
| 命名模板 | 文本 | `{original}_{value}` | 可用变量：{original} {value} {index} {date} |
| 处理模式 | 单选 | 保留格式 | 保留格式 / 仅数据 |
| 保留底部行 | 数字 | 0 | 新增：每份保留底部 N 行（如合计行） |

**处理逻辑**：

```javascript
// 核心算法
function splitByColumn(workbook, options) {
    const { sheetName, splitColumns, headerRows, footerRows, processingMode } = options;
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // 提取表头
    const headers = data.slice(0, headerRows);
    
    // 提取底部行（如果配置了 footerRows）
    const footerStart = data.length - footerRows;
    const footers = footerRows > 0 ? data.slice(footerStart) : [];
    
    // 数据行（排除表头和底部）
    const dataRows = data.slice(headerRows, footerRows > 0 ? footerStart : data.length);
    
    // 按列值分组
    const groups = new Map();
    for (const row of dataRows) {
        const key = splitColumns.map(c => row[c] ?? '').join('\x00');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }
    
    // 每组生成一个文件
    const results = [];
    let index = 1;
    for (const [key, rows] of groups) {
        const groupData = [...headers, ...rows, ...footers];
        const newWs = XLSX.utils.aoa_to_sheet(groupData);
        
        if (processingMode === 'full') {
            // 复制原 worksheet 的格式，然后删除不属于该组的行
            // （使用现有的 copyWorksheetByDeletion 策略）
        }
        
        results.push({
            name: applyNamingTemplate(options.namingTemplate, {
                original: options.originalFileName,
                value: key.replace(/\x00/g, '_'),
                index: index++,
                date: formatDate(new Date())
            }),
            worksheet: newWs
        });
    }
    
    return results;
}
```

**输出**：
- ZIP：`{原文件名}_{时间戳}.zip`
- 单文件多 Sheet：`{原文件名}_{时间戳}.xlsx`（每个 Sheet = 一个分组）

**回测计划**：

| 测试ID | 场景 | 预期结果 |
|--------|------|---------|
| TC-01 | 单列拆分，3 个不同值 | 3 个文件，每个含对应数据 |
| TC-02 | 多列组合拆分 | 按组合值分组，如"华东_上海" |
| TC-03 | 保留底部行 | 每份文件含表头 + 数据 + 合计行 |
| TC-04 | 含合并单元格 | 合并单元格区域正确保留 |
| TC-05 | 特殊字符列值 | 文件名安全处理（sanitizeFileName）|
| TC-06 | 输出单文件多Sheet | 1 个 xlsx，Sheet 名 = 列值 |
| TC-07 | 空值分组 | 空值作为独立分组"(空)" |

---

### 2.4 模式三：按列拆分竖向（split-column-vertical）

**功能描述**：为每个选中的数据列生成独立文件，每个文件包含固定表头列 + 一个数据列。

> **输出限制**：此模式**强制 ZIP 输出**，不提供"单文件多Sheet"选项。原因是每个输出文件仅含 1-2 列数据，若放入同一文件的不同 Sheet，用户需要在 Sheet 间来回切换查看，体验极差。

**输入**：单个 Excel 文件

**Step 3 配置项**：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 表头行数 | 数字 | 1 | 1-10（最小为1） |
| 固定表头列 | 多选 | 无 | 每个文件都包含的标识列 |
| 数据列 | 多选 | 无 | 全选/取消全选支持 |
| 输出格式 | 单选 | ZIP | ZIP / 单文件多Sheet |
| 命名模板 | 文本 | `{original}_{column}` | {column} = 数据列名 |
| 处理模式 | 单选 | 保留格式 | 保留格式 / 仅数据 |

**回测计划**：

| 测试ID | 场景 | 预期结果 |
|--------|------|---------|
| TV-01 | 固定2列 + 数据3列 | 3 个文件，每个含固定列 + 1 数据列 |
| TV-02 | 全选数据列 | 文件数 = 数据列数 |
| TV-03 | 输出单文件多Sheet | 1 个 xlsx，Sheet 名 = 数据列名 |

---

### 2.5 模式四：按行数拆分（split-rows）【新增】

**功能描述**：将大表按固定行数切分为多个文件/Sheet，每份都带上表头行。

**输入**：单个 Excel 文件

**Step 3 配置项**：

| 配置项 | 类型 | 默认值 | 范围 | 说明 |
|--------|------|--------|------|------|
| 每 N 行一份 | 数字 | 1000 | 1-100000 | 每份的数据行数（不含表头） |
| 表头行数 | 数字 | 1 | 1-10 | 每份都复制表头 |
| 输出格式 | 单选 | ZIP | ZIP / 单文件多Sheet | — |
| 命名模板 | 文本 | `{original}_P{index}` | — | P{index} = 第几份 |
| 处理模式 | 单选 | 保留格式 | 保留格式 / 仅数据 | — |

**处理逻辑**：

```javascript
function splitByRows(data, options) {
    const { chunkSize, headerRows } = options;
    const headers = data.slice(0, headerRows);
    const dataRows = data.slice(headerRows);
    
    const chunks = [];
    for (let i = 0; i < dataRows.length; i += chunkSize) {
        const chunk = dataRows.slice(i, i + chunkSize);
        chunks.push([...headers, ...chunk]);
    }
    
    return chunks;
}
```

> **保留格式模式**：上述伪代码使用 `aoa_to_sheet` 重建数据会丢失样式。在"保留格式"模式下，实现时应使用 `copyWorksheetByDeletion`：先完整复制源工作表，再删除不属于当前分组的行，从而保留所有单元格样式、条件格式和合并单元格。

**回测计划**：

| 测试ID | 场景 | 预期结果 |
|--------|------|---------|
| TR-01 | 1000 行，每 300 行一份 | 4 份（300+300+300+100） |
| TR-02 | 刚好整除 | 10 行，每 5 行一份 → 2 份，每份 5 行数据 |
| TR-03 | 表头 2 行 | 每份都复制 2 行表头 |
| TR-04 | 输出单文件多Sheet | 1 个 xlsx，Sheet 名 = P01, P02... |
| TR-05 | 大数据量 | 10 万行，每 1 万行一份 → 10 份，不崩溃 |

---

### 2.6 模式五：智能合并大师（smart-merge）【重构】

**功能描述**：替代现有的 `merge-file` 和 `merge-sheet`，统一为智能合并大师，提供两种合并行为。

**输入**：多个 Excel 文件

**界面设计**：

```
┌─────────────────────────────────────────────────────────────┐
│  智能合并大师                                                │
│  ─────────────────                                           │
│  合并方式：                                                   │
│  (•) 全量纵向追加 — 所有选中的工作表数据合并为一张表          │
│      （表头一致的工作表，数据纵向堆叠）                        │
│                                                              │
│  ( ) 按工作表名称归类 — 同名工作表的数据合并到各自Sheet中     │
│      （如：12个文件都有[南京]Sheet → 输出3个Sheet：[南京]融合12个月）│
│                                                              │
│  ─────────────────                                           │
│  全局配置：                                                   │
│  表头行数：[ 1 ]                                             │
│  [☑] 去除重复数据                                            │
│      (•) 整行完全相同                                        │
│      ( ) 按指定列判断：[ 姓名 ▼ ] [ 工号 ▼ ]                 │
│  [☑] 添加来源文件标记列                                       │
│                                                              │
│  ─────────────────                                           │
│  工作表选择（自动识别到以下同名工作表组）：                      │
│  ┌─────────────────────────────────────────┐                │
│  │ 📁 销售数据（在 3 个文件中发现）         │                │
│  │   [☑] 文件A-销售数据                     │                │
│  │   [☑] 文件B-销售数据                     │                │
│  │   [☑] 文件C-销售数据                     │                │
│  │                                          │                │
│  │ 📁 Sheet2（在 2 个文件中发现）           │                │
│  │   [☑] 文件A-Sheet2                       │                │
│  │   [☑] 文件B-Sheet2                       │                │
│  └─────────────────────────────────────────┘                │
│                                                              │
│  [搜索过滤...]  [按文件视图] [按名称视图]                     │
└─────────────────────────────────────────────────────────────┘
```

**Step 3 配置项**：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 合并方式 | 单选 | 全量纵向追加 | 全量追加 / 按名称归类 |
| 表头行数 | 数字 | 1 | 0-10 |
| 去除重复 | 复选框 | 否 | 新增 |
| 判重方式 | 单选 | 整行相同 | 整行相同 / 按指定列（多选） |
| 来源列 | 复选框 | 是 | 自动添加"来源文件"列 |
| 处理模式 | 单选 | 保留格式 | 保留格式 / 仅数据 |

**模式A：全量纵向追加（单Sheet输出）**

```javascript
function mergeAppend(files, options) {
    // 【修复 Bug-1】来源列位置在第一次迭代时固定为 max(所有文件列数)+1
    // 预先扫描所有文件，确定最大列数和来源列固定位置
    let maxColumnsOverall = 0;
    for (const { data } of files) {
        maxColumnsOverall = Math.max(maxColumnsOverall, getMaxColumnCount(data));
    }
    const SOURCE_COL_IDX = maxColumnsOverall;  // 固定位置，不再漂移
    
    let baselineHeaders = null;
    let allRows = [];
    
    for (let i = 0; i < files.length; i++) {
        const { file, sheetName, data } = files[i];
        const headerRows = data.slice(0, options.headerRows);
        const bodyRows = data.slice(options.headerRows);
        
        if (i === 0) {
            baselineHeaders = headerRows;
            allRows.push(...headerRows);
        } else {
            // 验证表头一致性（Bug-1 修复：使用 < 而非 !== 检查列数）
            const validation = validateHeaderConsistency(baselineHeaders, headerRows, options.headerRows);
            if (!validation.valid) {
                postWarning(`跳过 ${file.name}-${sheetName}: ${validation.reason}`);
                continue;
            }
        }
        
        // 写入数据行 + 来源标记（始终在固定位置）
        for (const row of bodyRows) {
            const paddedRow = [...row];
            while (paddedRow.length <= SOURCE_COL_IDX) paddedRow.push('');
            paddedRow[SOURCE_COL_IDX] = `${file.name}-${sheetName}`;
            allRows.push(paddedRow);
        }
    }
    
    // 添加来源列表头（在固定位置）
    for (let h = 0; h < options.headerRows; h++) {
        while (allRows[h].length <= SOURCE_COL_IDX) allRows[h].push('');
        allRows[h][SOURCE_COL_IDX] = h === 0 ? '来源文件' : '';
    }
    
    

**样式断层修复（保留格式模式下）**：

当新文件列数多于 baseline 时，新拓展的列自动复制最邻近有效单元格的基准样式：

```javascript
function fillNewColumnStyles(worksheet, newColIndex, baselineColIndex) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let r = range.s.r; r <= range.e.r; r++) {
        const sourceAddr = XLSX.utils.encode_cell({ r, c: baselineColIndex });
        const targetAddr = XLSX.utils.encode_cell({ r, c: newColIndex });
        if (worksheet[sourceAddr] && worksheet[sourceAddr].s) {
            worksheet[targetAddr] = worksheet[targetAddr] || { t: 's', v: '' };
            worksheet[targetAddr].s = structuredClone(worksheet[sourceAddr].s);
        }
    }
}
```

> 仅在"保留格式"模式下执行，"仅数据"模式下不处理样式。

// 去重（如果开启）
    if (options.removeDuplicates) {
        allRows = removeDuplicates(allRows, options);
    }
    
    return XLSX.utils.aoa_to_sheet(allRows);
}
```

**模式B：按工作表名称归类（多Sheet输出）**

```javascript
function mergeBySheetName(files, options) {
    // 1. 按 Sheet 名分组
    const groups = new Map(); // sheetName -> [{file, data}, ...]
    
    for (const { file, sheetName, data } of files) {
        if (!groups.has(sheetName)) groups.set(sheetName, []);
        groups.get(sheetName).push({ file, data });
    }
    
    // 2. 每个组内部用模式A的逻辑合并
    const resultWorkbook = XLSX.utils.book_new();
    
    for (const [sheetName, groupFiles] of groups) {
        const mergedSheet = mergeAppend(groupFiles, options);
        XLSX.utils.book_append_sheet(resultWorkbook, mergedSheet, sheetName);
    }
    
    return resultWorkbook;
}
```

**去重算法**：

```javascript
function removeDuplicates(rows, options) {
    const headers = rows.slice(0, options.headerRows);
    const dataRows = rows.slice(options.headerRows);
    
    let uniqueRows;
    if (options.duplicateMode === 'row') {
        // 整行去重（精确排除来源列，不假设来源列在末尾）
        const seen = new Set();
        const sourceIdx = options.sourceColumnIndex;  // 来源列固定位置
        uniqueRows = dataRows.filter(row => {
            const key = JSON.stringify([
                ...row.slice(0, sourceIdx),
                ...row.slice(sourceIdx + 1)
            ]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    } else {
        // 按指定列去重
        const seen = new Set();
        uniqueRows = dataRows.filter(row => {
            const key = options.duplicateColumns.map(c => row[c]).join('\x00');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
    
    return [...headers, ...uniqueRows];
}
```

**回测计划**：

| 测试ID | 模式 | 场景 | 预期结果 |
|--------|------|------|---------|
| TM-A01 | A | 2个文件，各1个Sheet，结构相同 | 单Sheet，所有数据纵向堆叠 |
| TM-A02 | A | 3个文件，列数不同（2列+5列+3列）| 最大5列，缺失列留空，来源列在最右 |
| TM-A03 | A | 表头内容不一致 | 跳过不一致的文件，提示原因 |
| TM-A04 | A | 开启整行去重，2行完全相同 | 结果中只保留1行 |
| TM-A05 | A | 开启按列去重（按"姓名"） | 同姓名只保留第一行 |
| TM-A06 | A | 开启来源列 | 每行最后一列为"文件名-Sheet名" |
| TM-B01 | B | 3个文件，都有[南京][北京]Sheet | 输出2个Sheet：[南京]融合3文件，[北京]融合3文件 |
| TM-B02 | B | 部分文件缺少某Sheet | 该Sheet只合并存在的文件数据 |
| TM-B03 | B | Sheet名超过31字符 | 自动截断，不报错 |
| TM-B04 | B | 开启去重 | 每个Sheet内部独立去重 |

---

## 三、全局功能规格

### 3.1 处理模式开关（Step 1 全局配置）

```
┌─────────────────────────────────────────┐
│  处理模式                                │
│  (•) 保留完整格式                        │
│      保留样式、公式、合并单元格（处理较慢）│
│  ( ) 仅处理数据                          │
│      只读写单元格值，不保留格式（速度极快）│
└─────────────────────────────────────────┘
```

**实现**：
- `cloneWorksheet` 增加 `stripStyle: true/false` 参数
- `data-only` 模式下：使用 `sheet_to_json` → `aoa_to_sheet` 重建，不复制任何格式

### 3.2 单元格数预警（全局）

```javascript
function checkCellCountWarning(workbook) {
    let totalCells = 0;
    for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const rows = range.e.r - range.s.r + 1;
        const cols = range.e.c - range.s.c + 1;
        totalCells += rows * cols;
    }
    
    const WARNING_THRESHOLD = 2_000_000; // 200万单元格
    if (totalCells > WARNING_THRESHOLD) {
        return {
            level: 'warning',
            message: `检测到 ${(totalCells/10000).toFixed(1)} 万单元格，建议切换到"仅处理数据"模式以提升速度`,
            cellCount: totalCells
        };
    }
    return null;
}
```

### 3.3 自定义命名规则（全局）

**可用模板变量**：

| 变量 | 说明 | 示例 |
|------|------|------|
| `{original}` | 原文件名（无扩展名） | `销售报表` |
| `{sheet}` | 工作表名 | `华东区` |
| `{value}` | 拆分列值 | `上海` |
| `{column}` | 数据列名 | `销售额` |
| `{index}` | 序号（01, 02...） | `03` |
| `{date}` | 当前日期（YYYYMMDD） | `20240603` |
| `{time}` | 当前时间（HHMMSS） | `143052` |

**默认模板**：
- split-sheet: `{original}_{sheet}`
- split-column: `{original}_{value}`
- split-vertical: `{original}_{column}`
- split-rows: `{original}_P{index}`
- smart-merge: `合并结果_{date}`

**实现**：
```javascript
function applyNamingTemplate(template, vars) {
    let result = template
        .replace(/{original}/g, vars.original || '')
        .replace(/{sheet}/g, vars.sheet || '')
        .replace(/{value}/g, vars.value || '')
        .replace(/{column}/g, vars.column || '')
        .replace(/{index}/g, String(vars.index || 1).padStart(2, '0'))
        .replace(/{date}/g, formatDate(new Date(), 'YYYYMMDD'))
        .replace(/{time}/g, formatDate(new Date(), 'HHMMSS'));
    return sanitizeFileName(result.trim());
}

function sanitizeFileName(name) {
    return String(name)
        .replace(/[\x00-\x1f\r\n<>:"/\\|?*]/g, '_')
        .trim() || '未命名';
}
```

### 3.4 输出格式选项（全局）

| 模式 | ZIP | 单文件多Sheet | 默认 |
|------|-----|--------------|------|
| split-sheet | ✅ | ✅ | ZIP |
| split-column | ✅ | ✅ | ZIP |
| split-vertical | ✅ | ❌ 禁用 | ZIP |
| split-rows | ✅ | ✅ | ZIP |
| smart-merge | ❌（本身就是单文件） | — | 单文件 |

---

## 四、代码结构（单 HTML 内部分区）

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Excel 离线工具</title>
    <style>
        /* ========== 区域1：全局样式 ========== */
        /* 约 500 行 CSS */
    </style>
</head>
<body>
    <!-- ========== 区域2：HTML 结构 ========== -->
    <!-- 约 1200 行 HTML -->

    <!-- ========== 区域3：主线程逻辑（唯一执行区域） ========== -->
    <script nonce="excel-offline-2026">
    (function() {
        'use strict';

        // ===== 5.1 常量与配置 =====
        const CONFIG = {
            HARD_LIMIT_FILE_BYTES: 50 * 1024 * 1024,  // 50MB
            SOFT_LIMIT_FILE_BYTES: 20 * 1024 * 1024,  // 20MB
            WARNING_CELL_COUNT: 2_000_000,             // 200万单元格
            MAX_SHEET_NAME_LENGTH: 31,
            UI_YIELD_DELAY_SMALL: 10,
            UI_YIELD_DELAY_MEDIUM: 50,
            UI_YIELD_DELAY_LARGE: 200,
        };

        // ===== 5.2 处理引擎入口 =====
        // ...

        // ===== 5.3 状态管理 =====
        // ...

        // ===== 5.4 工具函数 =====
        // cloneWorksheet, validateHeaderConsistency, sanitizeFileName, etc.

        // ===== 5.5 UI 交互 =====
        // 模式切换、步骤导航、文件上传、事件绑定

        // ===== 5.6 拆分处理（含 Time-Slicing 切片） =====
        // split-sheet, split-column, split-vertical, split-rows

        // ===== 5.7 合并处理（含 Time-Slicing 切片） =====
        // smart-merge

        // ===== 5.8 导出与下载 =====

        // ===== 5.9 自测系统 =====
        // T01-T99+

    })();
    </script>
</body>
</html>
```

---

## 五、回测总计划

### 5.0 已知缺陷清单（19 项，Day0 集中修复）

> **选项 A 确认**：本计划 Day0 先集中修复 P0+P1 缺陷，再实施新功能。新功能设计已避免继承相同 bug。

#### 🔴 P0 — 数据级错误（3 项，必须先修）

| # | 缺陷 | 位置 | 影响 | 修复方案 |
|---|------|------|------|---------|
| Bug-1 | 来源列漂移 | `performSheetDataMerge` L5206-5207 | 合并不同列数文件时数据错位 | 预先扫描所有文件确定 `maxColumns`，来源列固定在 `maxColumns` 位置 |
| Bug-3 | `preserveStyles` 复选框僵尸UI | HTML 配置面板 / JS 读取逻辑 | 用户勾选"保留格式"实际不生效（`XLSX_READ_OPTIONS.cellStyles` 硬编码 `true`，无动态读取） | 移除无意义的复选框，或在 Step 3 添加真正生效的"处理模式"开关（保留格式/仅数据）并注入 `XLSX.read()` 参数 |
| Bug-9 | `getUniqueSheetName` 31字符截断后加后缀越界 | `getUniqueSheetName` | 超出 Excel 31字符 Sheet 名限制，生成非法文件名 | 截断时预留后缀空间，确保最终长度 ≤ 31 |

#### 🟠 P1 — 功能正确性（12 项，应修）

| # | 缺陷 | 影响 | 修复方案 |
|---|------|------|---------|
| Bug-2 | `downloadAllFiles` ObjectURL 未纳入管理 | 内存泄漏 | 统一用 `URL.revokeObjectURL()` 释放 |
| Bug-4 | `columnsToKeep.sort` 原地修改调用方数组 | 副作用污染 | 改为 `columnsToKeep.slice().sort()` |
| Bug-5 | `performFileMerge` 清空 DOM 导致"上一步"状态断裂 | 导航失效 | 不直接清空 DOM，使用显示/隐藏切换 |
| Bug-6 | 重复 `showToast` 调用 | 消息轰炸 | 去重或合并提示 |
| Defect-7 | `getHeaderRowCount` fallback 参数形同虚设 | 异常处理失效 | 确保 fallback 路径返回有效值 |
| Defect-10 | `displayName` 与 `key` 匹配失败 | 配置不生效 | 修复匹配逻辑 |
| Defect-11 | `escapeHtml` 多余正斜杠转义 | 性能/正确性 | 移除不必要的正斜杠转义 |
| Defect-12 | `beforeunload` 下载后仍提示 | 误拦截 | 下载完成后清除 beforeunload 标记 |
| Defect-13 | `resetTool` 未清 `WorkbookCache` | 内存泄漏 | `resetTool` 中显式释放缓存 |
| Defect-16 | `cloneWorksheet` 降级路径丢失 `!` 属性 | 格式丢失（条件格式/合并单元格等） | 降级路径完整复制 `!` 前缀属性 |
| Defect-17 | `slideIn` CSS 类不存在 | 动画失效 | 添加对应 CSS 类或移除无效引用 |
| Defect-18 | `style.display` 混用 | CSP 违规 | 统一使用 CSP-safe 的 CSS 类切换 |

#### 🟡 P2 — 代码质量（3 项，顺带修）

| # | 缺陷 | 影响 | 修复方案 |
|---|------|------|---------|
| Defect-14 | `checkMemoryUsage` 名不副实 | 误导性命名 | 重命名或修正实现 |
| Struct-26 | P1/P2/Txx 修复标记注释噪音 | 可读性 | 清理过时修复标记，保留有意义注释 |
| Struct-27 | `_i4679` 等垃圾变量名 | 维护困难 | 重命名为语义化变量名 |

---

### 5.1 回测分层

```
Layer 1: 内置自测（T01-T120+）
  ├── 单元函数测试（T01-T60）
  └── 集成场景测试（T61-T120）

Layer 2: Playwright E2E（40+ 测试）
  ├── 基础功能（8 specs × 3 tests）
  ├── 边界情况（5 specs × 4 tests）
  └── 性能基准（2 specs × 2 tests）

Layer 3: 手动验收
  ├── 大文件测试（10万行）
  ├── 复杂格式测试（公式/样式/合并单元格）
  └── 跨浏览器测试（Chrome/Edge/Firefox）
```

### 5.2 各模式回测清单

| 模式 | 测试数 | 关键场景 |
|------|--------|---------|
| split-sheet | 8 | 基础拆分、部分选择、空表跳过、单文件多Sheet、仅数据模式、自定义命名、公式保留、大文件 |
| split-column | 7 | 单列拆分、多列组合、保留底部行、合并单元格、特殊字符、单文件多Sheet、空值分组 |
| split-vertical | 3 | 基础提取、全选、单文件多Sheet |
| split-rows | 5 | 整除、非整除、多行表头、单文件多Sheet、大数据量 |
| smart-merge-A | 6 | 基础追加、不同列数、表头不一致、整行去重、按列去重、来源列 |
| smart-merge-B | 4 | 同名合并、部分缺失、超长Sheet名、去重 |
| 全局功能 | 6 | 处理模式切换、单元格预警、命名模板、ZIP/单文件切换、仅数据速度、TS不卡UI |

### 5.3 性能基准

| 场景 | 当前基准 | 目标（Time-Slicing后） | 测试数据 |
|------|---------|-----------------|---------|
| 解析 50MB 文件 | 主线程卡死 3-5 秒 | XLSX.read() 仍为同步阻塞 3-5 秒；Time-Slicing 在数据处理阶段生效 | 50MB xlsx |
| 拆分 3000 行 | 8-9 秒 | 8-9 秒（不变） | 3000×6 |
| 拆分 10 万行 | 未测试，可能崩溃 | < 60 秒，不崩溃 | 100000×10 |
| 合并 5 个文件 | 未测试 | < 15 秒 | 5×1000 行 |
| 内存占用 | 可能 > 500MB | < 300MB | 50MB 文件 |

---

## 六、实施计划（3-3.5 天）

### Day 0（0.5-1 天）：缺陷修复先行

| 任务 | 工时 | 说明 |
|------|------|------|
| T0.1 修复 P0 缺陷（Bug-1/3/9） | 0.25d | 来源列固定、preserveStyles 复选框、31字符越界 |
| T0.2 修复 P1 缺陷（Bug-2/4/5/6 + Defect-7/10/11/12/13/16/17/18） | 0.5-1d | 12个缺陷逐一修复 + 自测回归。Defect-16 cloneWorksheet降级路径涉及SheetJS内部结构；Bug-5 resetTool涉及多处DOM调用点；Defect-12 beforeunload需理解用户操作流程 |
| T0.3 修复 P2 缺陷（Defect-14 + Struct-26/27） | 0.1d | 命名清理、注释清理 |
| T0.4 运行全部 26+164 测试，确认基线干净 | 0.1d | 现有测试全部通过 |

### Day 1（0.5 天）：Time-Slicing 底座

| 任务 | 工时 | 说明 |
|------|------|------|
| T1.1 在现有大循环中加入 `setTimeout` 切片 | 0.5d | `processWithYielding` 通用函数；扫描全部 6757 行代码找出所有大循环位置；JSZip `generateAsync` 回调中也需切片；参数可调（Sheet级10/行级500/单元格级1000） |

> **T1.1 单独 0.5d 原因**：需在 6757 行代码中逐一识别大循环位置（split-sheet逐Sheet、split-column逐行分组、merge逐文件、JSZip打包），逐一改造并回归测试。

### Day 2（0.5 天）：按行数拆分 + 智能合并大师前置

| 任务 | 工时 | 说明 |
|------|------|------|
| T1.2 新增 `split-rows` 模式（按行数拆分） | 0.25d | HTML结构+事件绑定+步骤导航；保留格式模式下用 `copyWorksheetByDeletion` 删行而非 `aoa_to_sheet` |
| T2.1 重构合并配置面板（动态显示/隐藏） | 0.25d | 模式A/B 切换、去重选项、来源列选项 |

### Day 3（1 天）：智能合并大师核心

| 任务 | 工时 | 说明 |
|------|------|------|
| T2.2 模式A：全量纵向追加（来源列固定） | 0.3d | 预先扫描所有文件确定 `maxColumns`，`SOURCE_COL_IDX` 固定不漂移 |
| T2.3 模式B：按名称归类合并 | 0.25d | Map 分组 + 每组内部复用模式A逻辑 |
| T2.4 去重算法（精确排除来源列） | 0.25d | `...row.slice(0, sourceIdx), ...row.slice(sourceIdx + 1)` |
| T2.5 Sheet名归一化 | 0.2d |  trimming + 大小写不敏感 + 全角空格归一化，避免"销售数据"和"销售数据 "分成两组 |

### Day 4（0.5 天）：输出体验

| 任务 | 工时 | 说明 |
|------|------|------|
| T3.1 输出格式选项（ZIP / 单文件多Sheet） | 0.15d | split-sheet/split-column/split-rows 支持切换；模式三强制 ZIP |
| T3.2 自定义命名规则（safeGenerateName） | 0.15d | 6 个模板变量 + 强力清洗 |
| T3.3 处理模式开关（保留格式 / 仅数据） | 0.1d | 注入 SheetJS 优化参数（`cellStyles: false` 等） |
| T3.4 单元格数预警 | 0.1d | 200万单元格软限制；`!ref` 缺失时单独标记"无法计算" |

### Day 5（0.5-1 天）：收尾与全面回测

| 任务 | 工时 | 说明 |
|------|------|------|
| T4.1 新增 Playwright 测试（15+ 用例） | 0.3-0.5d | 每个测试平均 20-30 分钟撰写+调试 |
| T4.2 大文件性能测试（10万行） | 0.1d | 验证 Time-Slicing 在数据处理阶段不卡 UI；确认 XLSX.read() 解析阶段仍卡顿 |
| T4.3 回测所有现有功能（26+164） | 0.15d | 全部通过 |
| T4.4 自测系统与 async 兼容性验证 | 0.1d | 确认 `splitByColumn` 等函数变 async 后自测框架正常 |

**总工期：4-4.5 天**（含 6 个天块，其中 Day0/Day2/Day4 为半天块）

---

## 六（附）. 风险清单与回退机制

### 已知风险

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| `XLSX.read()` 解析 50MB 文件卡 UI 3-5 秒 | 用户以为浏览器崩溃 | 解析前显示"正在读取文件，大文件可能需要几秒..."进度提示 |
| JSZip `generateAsync` 内部回调同步 | Time-Slicing 插不进去 | 已在 T1.1 中识别，将打包逻辑拆分为多步 `await` |
| Day0 修 19 个 bug 导致 T01-T122 行为变化 | 自测大面积失败 | Day0.4 专门安排自测回归，失败即停，不进入 Day1 |
| T2.2 合并模式A 的 `SOURCE_COL_IDX` 仍有漂移 | Bug-1 复发 | 代码审查时重点检查：必须预先扫描所有文件，不允许迭代中修改 |
| 开发者对 6757 行代码熟悉度不足 | 改到不该改的地方 | 每改一处用 `git diff` 审查，不批量替换 |

### 回退机制

- **Day0 失败**：如果 19 个 bug 中任一修复导致现有测试失败，git 回滚该修复，单独处理，不阻塞其他 bug
- **T1.1 失败**：如果 Time-Slicing 改造导致自测大面积失败，回滚 T1.1，保持现有同步逻辑，先交付其他功能
- **T2.x 失败**：如果合并重构过于复杂，保留现有 merge-file/merge-sheet，仅新增 split-rows 和输出体验功能
- **MVP 可砍边界**：若时间不足，砍 Day4（输出体验）和 T2.5（Sheet名归一化），保 Day0-Day3 核心功能

---

### 处理模式开关位置统一说明

为避免 Step 1 全局配置与 Step 3 模式级配置冲突：

```
Step 1（全局默认）：处理模式 [保留格式 ▼]
                        ↓
Step 3（模式级）：处理模式 [跟随全局 ▼] ← 默认选项
                  展开后可选：保留格式 / 仅数据
```

- 模式级默认"跟随全局"，减少用户困惑
- 用户明确修改模式级后才覆盖全局设置
- 界面只显示一个开关（模式级），全局设置作为默认值注入

---

### 任务依赖关系

```
Day0 ─────────────────────────────────────────────┐
  ├── T0.1(P0修复) ──→ T0.2(P1修复) ──→ T0.3(P2修复) ──→ T0.4(自测回归)
  │                      │                                │
  │                      ▼                                │
  │              [全部通过才能进入 Day1] ◄────────────────┘
  │
Day1 ──→ T1.1(Time-Slicing底座)
  │
Day2 ──→ T1.2(split-rows) ──→ T2.1(合并面板重构)
  │                              │
  │                              ▼
Day3 ─────────────────────→ T2.2(模式A) ──→ T2.3(模式B) ──→ T2.4(去重) ──→ T2.5(归一化)
  │
Day4 ──→ T3.1(输出格式) ──→ T3.2(命名规则) ──→ T3.3(处理模式) ──→ T3.4(单元格预警)
  │
Day5 ──→ T4.1(新测试) ──→ T4.2(性能测试) ──→ T4.3(回归测试) ──→ T4.4(async兼容)
```

- **硬依赖**：T0.4 全部通过 → Day1；T1.1 完成 → T1.2；T2.1 完成 → T2.2
- **软依赖**：T2.2 和 T2.3 可并行开发（不同函数），T3.x 各任务无依赖可并行

---

## 七、待确认清单

请对以下 8 项逐一确认（回复"确认"或"修改"+意见）：

1. [ ] **架构**：单 HTML + Vanilla JS + Time-Slicing（无 Worker，无 Vue3，无构建工具）
2. [ ] **模式数量**：5 个模式（4 拆分 + 1 合并），删除旧的 merge-file/merge-sheet
3. [ ] **智能合并**：模式A（全量追加单Sheet）+ 模式B（按名称归类多Sheet）
4. [ ] **按行数拆分**：作为独立模式，与 split-sheet/split-column 并列
5. [ ] **输出格式**：拆分模式支持 ZIP / 单文件多Sheet（模式三强制 ZIP）
6. [ ] **命名规则**：支持 {original} {sheet} {value} {column} {index} {date} 变量
7. [ ] **去重**：仅用于合并模式，支持整行去重和按指定列去重
8. [ ] **实施顺序**：Day0(缺陷修复) → Day1(TS底座) → Day2(split-rows+合并面板) → Day3(智能合并核心) → Day4(输出体验) → Day5(全面回测)

全部确认后，我立即按此文档逐条实施。

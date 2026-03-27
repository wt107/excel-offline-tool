/**
 * Excel Processor Web Worker
 * 在后台线程处理大文件，避免阻塞主线程 UI
 */

// 导入 SheetJS (需要在主线程中加载后再初始化 Worker)
// 注意：由于 importScripts 需要同步加载，我们在主线程通过 Blob URL 方式创建 Worker

// Worker 配置
const XLSX_READ_OPTIONS = {
    type: 'array',
    cellStyles: true,
    cellNF: true,
    cellDates: true,
    cellFormula: true,
    cellHTML: false,
    cellText: false
};

const XLSX_WRITE_OPTIONS = {
    type: 'array',
    bookType: 'xlsx',
    cellStyles: true,
    compression: true
};

// 任务 ID 计数器
let taskIdCounter = 0;

/**
 * 处理解析任务
 */
function handleParse(data) {
    self.postMessage({
        type: 'progress',
        percent: 10,
        text: '正在解析文件结构...'
    });

    const startTime = performance.now();

    // 使用 SheetJS 解析
    const workbook = XLSX.read(data.array, XLSX_READ_OPTIONS);

    const parseTime = performance.now() - startTime;

    self.postMessage({
        type: 'progress',
        percent: 50,
        text: `解析完成，耗时 ${parseTime.toFixed(0)}ms`
    });

    // 序列化工作簿以便传输回主线程
    // 只传输必要数据，减少内存占用
    const serialized = {
        SheetNames: workbook.SheetNames,
        Sheets: {},
        _processingTime: parseTime,
        _sheetCount: workbook.SheetNames.length
    };

    // 复制工作表数据
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        // 深拷贝工作表，避免引用问题
        serialized.Sheets[sheetName] = JSON.parse(JSON.stringify(sheet));
    }

    self.postMessage({
        type: 'complete',
        result: serialized,
        metrics: {
            parseTime,
            sheetCount: workbook.SheetNames.length
        }
    });
}

/**
 * 处理生成任务
 */
function handleGenerate(data) {
    self.postMessage({
        type: 'progress',
        percent: 60,
        text: '正在生成 Excel 文件...'
    });

    const startTime = performance.now();

    // 重建工作簿对象
    const workbook = {
        SheetNames: data.workbook.SheetNames,
        Sheets: data.workbook.Sheets
    };

    // 生成文件
    const buffer = XLSX.write(workbook, XLSX_WRITE_OPTIONS);

    const writeTime = performance.now() - startTime;

    // 使用 Transferable Objects 传输，避免内存复制
    self.postMessage({
        type: 'complete',
        result: buffer,
        metrics: {
            writeTime,
            size: buffer.byteLength
        }
    }, [buffer]);
}

/**
 * 处理拆分任务
 */
function handleSplitSheet(data) {
    const { workbook, sheetName, splitColumn, options } = data;

    self.postMessage({
        type: 'progress',
        percent: 20,
        text: '正在分析数据...'
    });

    const worksheet = workbook.Sheets[sheetName];

    // 转换为 JSON 便于处理
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length === 0) {
        throw new Error('工作表为空');
    }

    const headerRows = options.headerRows || 1;
    const headers = jsonData.slice(0, headerRows);
    const dataRows = jsonData.slice(headerRows);

    self.postMessage({
        type: 'progress',
        percent: 40,
        text: '正在分组数据...'
    });

    // 按列值分组
    const groups = {};
    dataRows.forEach((row, index) => {
        const value = row[splitColumn];
        const key = (value !== undefined && value !== null && String(value).trim() !== '')
            ? String(value)
            : '[空值]';

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(row);
    });

    self.postMessage({
        type: 'progress',
        percent: 60,
        text: `找到 ${Object.keys(groups).length} 个唯一值，正在生成文件...`
    });

    // 生成结果文件
    const results = [];
    const groupKeys = Object.keys(groups);
    const totalGroups = groupKeys.length;

    groupKeys.forEach((key, index) => {
        const rows = groups[key];
        const newWorkbook = XLSX.utils.book_new();

        // 合并表头和数据
        const sheetData = [...headers, ...rows];
        const newWorksheet = XLSX.utils.aoa_to_sheet(sheetData);

        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);

        const buffer = XLSX.write(newWorkbook, XLSX_WRITE_OPTIONS);

        results.push({
            key,
            buffer,
            rowCount: rows.length
        });

        // 报告进度
        const percent = 60 + Math.round((index + 1) / totalGroups * 35);
        self.postMessage({
            type: 'progress',
            percent,
            text: `已生成 ${index + 1}/${totalGroups} 个文件...`
        });
    });

    self.postMessage({
        type: 'complete',
        result: {
            groups: results,
            totalGroups: totalGroups,
            totalRows: dataRows.length
        }
    });
}

/**
 * 快速单元格拷贝 - 避免递归
 */
function fastCopyCell(cell) {
    if (!cell || typeof cell !== 'object') {
        return cell;
    }

    if (Array.isArray(cell)) {
        return cell.slice();
    }

    // 单元格只有简单属性，浅拷贝即可
    return { ...cell };
}

/**
 * 处理性能测试任务
 */
function handleBenchmark() {
    // 创建测试数据
    const testSheet = {};
    const rowCount = 10000;

    for (let i = 0; i < rowCount; i++) {
        testSheet[XLSX.utils.encode_cell({ r: i, c: 0 })] = { v: i, t: 'n' };
        testSheet[XLSX.utils.encode_cell({ r: i, c: 1 })] = { v: `Data ${i}`, t: 's' };
    }

    testSheet['!ref'] = `A1:B${rowCount}`;

    // 测试拷贝性能
    const start = performance.now();

    const newSheet = {};
    for (let i = 0; i < rowCount; i++) {
        const addr1 = XLSX.utils.encode_cell({ r: i, c: 0 });
        const addr2 = XLSX.utils.encode_cell({ r: i, c: 1 });
        newSheet[addr1] = fastCopyCell(testSheet[addr1]);
        newSheet[addr2] = fastCopyCell(testSheet[addr2]);
    }

    const duration = performance.now() - start;

    self.postMessage({
        type: 'complete',
        result: {
            rowCount,
            duration,
            rate: (rowCount * 2 / (duration / 1000)).toFixed(0)
        }
    });
}

// 主消息处理器
self.onmessage = function(e) {
    const { id, action, data } = e.data;

    try {
        switch(action) {
            case 'parse':
                handleParse(data);
                break;
            case 'generate':
                handleGenerate(data);
                break;
            case 'splitSheet':
                handleSplitSheet(data);
                break;
            case 'benchmark':
                handleBenchmark();
                break;
            default:
                self.postMessage({
                    type: 'error',
                    error: `Unknown action: ${action}`
                });
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message,
            stack: error.stack
        });
    }
};

// 通知主线程 Worker 已就绪
self.postMessage({
    type: 'ready',
    supportedActions: ['parse', 'generate', 'splitSheet', 'benchmark']
});

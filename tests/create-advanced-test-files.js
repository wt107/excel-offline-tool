/**
 * 创建高级测试文件
 * 包含合并单元格、多行表头等复杂场景
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const TEST_FILES_DIR = path.join(__dirname, 'test-files');

// 确保目录存在
if (!fs.existsSync(TEST_FILES_DIR)) {
    fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
}

console.log('创建高级测试文件...\n');

// 1. 创建合并单元格表头文件
function createMergedHeaderFile() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['产品', '销售额', '', '', '利润', ''],  // 第1行：跨列标题
        ['产品', 'Q1', 'Q2', 'Q3', 'Q1', 'Q2'],  // 第2行：实际列名
        ['产品A', 100, 200, 300, 10, 20],
        ['产品B', 150, 250, 350, 15, 25],
        ['产品C', 200, 300, 400, 20, 30]
    ]);

    // 设置合并单元格
    // B1:D1 - 销售额跨3列
    // E1:F1 - 利润跨2列
    ws['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },  // B1:D1
        { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } }   // E1:F1
    ];

    // 设置列宽
    ws['!cols'] = [
        { wch: 12 },  // 产品
        { wch: 10 },  // Q1
        { wch: 10 },  // Q2
        { wch: 10 },  // Q3
        { wch: 10 },  // 利润Q1
        { wch: 10 }   // 利润Q2
    ];

    XLSX.utils.book_append_sheet(wb, ws, '销售数据');
    
    const filePath = path.join(TEST_FILES_DIR, 'merged-header.xlsx');
    XLSX.writeFile(wb, filePath);
    console.log('✅ 创建: merged-header.xlsx (合并单元格表头)');
    return filePath;
}

// 2. 创建2行表头文件
function createMultiHeader2RowsFile() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['部门', '', '第一季度', '第一季度', '第二季度', '第二季度'],
        ['姓名', '类别', '1月', '2月', '4月', '5月'],
        ['张三', '销售部', 100, 120, 110, 130],
        ['李四', '销售部', 90, 110, 100, 120],
        ['王五', '技术部', 80, 90, 85, 95],
        ['赵六', '技术部', 85, 95, 90, 100]
    ]);

    // 设置合并单元格（跨列的类别）
    ws['!merges'] = [
        { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },  // 第一季度
        { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } }   // 第二季度
    ];

    ws['!cols'] = [
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, '业绩统计');
    
    const filePath = path.join(TEST_FILES_DIR, 'multi-header-2rows.xlsx');
    XLSX.writeFile(wb, filePath);
    console.log('✅ 创建: multi-header-2rows.xlsx (2行表头)');
    return filePath;
}

// 3. 创建3行表头文件
function createMultiHeader3RowsFile() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['', '', '2024年', '', ''],           // 第1行：年度
        ['', '基本信息', '第一季度', '第二季度', '第三季度'],  // 第2行：季度
        ['姓名', '部门', '1月', '4月', '7月'],  // 第3行：月份
        ['张三', '销售部', 100, 150, 200],
        ['李四', '销售部', 120, 160, 220],
        ['王五', '技术部', 90, 140, 190]
    ]);

    // 设置合并单元格
    ws['!merges'] = [
        { s: { r: 0, c: 2 }, e: { r: 0, c: 4 } },  // 2024年跨3列
        { s: { r: 1, c: 2 }, e: { r: 1, c: 2 } },  // 第一季度（实际需要跨1列，但这里简化）
    ];

    ws['!cols'] = [
        { wch: 10 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, '季度数据');
    
    const filePath = path.join(TEST_FILES_DIR, 'multi-header-3rows.xlsx');
    XLSX.writeFile(wb, filePath);
    console.log('✅ 创建: multi-header-3rows.xlsx (3行表头)');
    return filePath;
}

// 4. 创建用于竖向拆分的合并单元格文件
function createVerticalSplitWithMergeFile() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['基本信息', '', '销售额', '利润'],  // 第1行：合并单元格标题
        ['部门', '姓名', '金额', '金额'],     // 第2行：列名
        ['销售部', '张三', 100, 20],
        ['销售部', '李四', 200, 40],
        ['技术部', '王五', 150, 30],
        ['技术部', '赵六', 250, 50]
    ]);

    // 设置合并单元格
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },  // 基本信息跨2列
    ];

    ws['!cols'] = [
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, '数据');
    
    const filePath = path.join(TEST_FILES_DIR, 'vertical-split-with-merge.xlsx');
    XLSX.writeFile(wb, filePath);
    console.log('✅ 创建: vertical-split-with-merge.xlsx (竖向拆分+合并)');
    return filePath;
}

// 5. 创建用于合并文件的多行表头文件1
function createMergeHeaderFile1() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['部门', '', '第一季度', '第二季度'],
        ['姓名', '类别', '1月', '4月'],
        ['张三', '销售部', 100, 150],
        ['李四', '销售部', 120, 160]
    ]);

    ws['!merges'] = [
        { s: { r: 0, c: 2 }, e: { r: 0, c: 2 } },
        { s: { r: 0, c: 3 }, e: { r: 0, c: 3 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, '数据');
    
    const filePath = path.join(TEST_FILES_DIR, 'merge-header-1.xlsx');
    XLSX.writeFile(wb, filePath);
    console.log('✅ 创建: merge-header-1.xlsx (合并文件测试1)');
    return filePath;
}

// 6. 创建用于合并文件的多行表头文件2
function createMergeHeaderFile2() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['部门', '', '第一季度', '第二季度'],
        ['姓名', '类别', '1月', '4月'],
        ['王五', '技术部', 90, 140],
        ['赵六', '技术部', 110, 150]
    ]);

    ws['!merges'] = [
        { s: { r: 0, c: 2 }, e: { r: 0, c: 2 } },
        { s: { r: 0, c: 3 }, e: { r: 0, c: 3 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, '数据');
    
    const filePath = path.join(TEST_FILES_DIR, 'merge-header-2.xlsx');
    XLSX.writeFile(wb, filePath);
    console.log('✅ 创建: merge-header-2.xlsx (合并文件测试2)');
    return filePath;
}

// 7. 验证文件结构
function verifyFile(filePath, description) {
    const wb = XLSX.readFile(filePath, { cellStyles: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    
    console.log(`\n📄 ${description}`);
    console.log(`   文件: ${path.basename(filePath)}`);
    console.log(`   范围: ${ws['!ref']}`);
    console.log(`   合并单元格: ${ws['!merges'] ? ws['!merges'].length : 0} 个`);
    if (ws['!merges']) {
        ws['!merges'].forEach((m, i) => {
            console.log(`     [${i+1}] ${XLSX.utils.encode_cell(m.s)}:${XLSX.utils.encode_cell(m.e)}`);
        });
    }
    console.log(`   列宽: ${ws['!cols'] ? ws['!cols'].length : 0} 列`);
}

// 执行创建
console.log('='.repeat(60));
console.log('高级测试文件创建工具');
console.log('='.repeat(60));

createMergedHeaderFile();
createMultiHeader2RowsFile();
createMultiHeader3RowsFile();
createVerticalSplitWithMergeFile();
createMergeHeaderFile1();
createMergeHeaderFile2();

console.log('\n' + '='.repeat(60));
console.log('文件验证');
console.log('='.repeat(60));

verifyFile(path.join(TEST_FILES_DIR, 'merged-header.xlsx'), '合并单元格表头');
verifyFile(path.join(TEST_FILES_DIR, 'multi-header-2rows.xlsx'), '2行表头');
verifyFile(path.join(TEST_FILES_DIR, 'multi-header-3rows.xlsx'), '3行表头');
verifyFile(path.join(TEST_FILES_DIR, 'vertical-split-with-merge.xlsx'), '竖向拆分+合并');
verifyFile(path.join(TEST_FILES_DIR, 'merge-header-1.xlsx'), '合并文件测试1');
verifyFile(path.join(TEST_FILES_DIR, 'merge-header-2.xlsx'), '合并文件测试2');

console.log('\n✅ 所有测试文件创建完成！');

/**
 * 修复验证测试
 * 验证以下修复是否生效：
 * 1. 统计信息显示问题 (NaN undefined) - 修复：添加 await 和防御性代码
 * 2. Toast 显示问题 (undefined 个文件) - 修复：同上
 * 3. 列宽格式保留问题 - 待进一步检查
 */

const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 创建带列宽的测试文件
function createTestFileWithColWidths() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
        ['姓名', '部门', '销售额', '日期'],
        ['张三', '销售部', 15000, '2024-01-01'],
        ['李四', '技术部', 20000, '2024-01-02'],
        ['王五', '销售部', 18000, '2024-01-03'],
        ['赵六', '技术部', 22000, '2024-01-04']
    ]);
    
    // 设置列宽
    ws['!cols'] = [
        { wch: 15 },  // 姓名 - 较宽
        { wch: 20 },  // 部门 - 更宽
        { wch: 12 },  // 销售额
        { wch: 15 }   // 日期
    ];
    
    // 设置行高
    ws['!rows'] = [
        { hpt: 30 },  // 表头行高
        { hpt: 20 },
        { hpt: 20 },
        { hpt: 20 },
        { hpt: 20 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, '销售数据');
    
    const filePath = path.join(__dirname, 'test-files', 'col-width-test.xlsx');
    XLSX.writeFile(wb, filePath);
    console.log('✓ 创建带列宽的测试文件:', filePath);
    return filePath;
}

async function runFixVerification() {
    console.log('='.repeat(60));
    console.log('Excel 离线工具 - 修复验证测试');
    console.log('='.repeat(60));
    
    const testFile = createTestFileWithColWidths();
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    
    // 收集控制台消息
    const consoleMessages = [];
    page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    
    try {
        // 1. 打开页面
        console.log('\n[测试 1/3] 打开应用页面...');
        await page.goto('http://localhost:8080/excel.html', { waitUntil: 'networkidle' });
        await page.waitForSelector('.mode-btn', { timeout: 10000 });
        console.log('✓ 页面加载成功');
        
        // 2. 测试按列水平拆分 - 验证统计信息显示
        console.log('\n[测试 2/3] 按列水平拆分 - 验证统计信息显示...');
        
        // 选择模式
        await page.click('[data-mode="split-column"]');
        await page.waitForTimeout(500);
        
        // 上传文件
        const input = await page.locator('#fileInput');
        await input.setInputFiles(testFile);
        await page.waitForTimeout(1000);
        
        // 等待工作表选择
        await page.waitForSelector('.sheet-item', { timeout: 10000 });
        await page.click('.sheet-item');
        await page.waitForTimeout(500);
        
        // 点击下一步
        await page.click('#step2 .btn-primary');
        await page.waitForTimeout(1000);
        
        // 选择拆分列（部门列）
        await page.waitForSelector('#splitColumn', { timeout: 10000 });
        await page.selectOption('#splitColumn', '部门');
        await page.waitForTimeout(500);
        
        // 点击生成按钮
        await page.click('#generateBtn');
        
        // 等待处理完成 - 检查结果统计
        await page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
        
        // 验证统计信息
        const totalFiles = await page.locator('#totalFiles').textContent();
        const totalSize = await page.locator('#totalSize').textContent();
        
        console.log('  生成文件数:', totalFiles);
        console.log('  总大小:', totalSize);
        
        // 验证没有 "undefined" 或 "NaN"
        const hasUndefined = totalFiles.includes('undefined') || totalSize.includes('undefined');
        const hasNaN = totalSize.includes('NaN');
        
        if (hasUndefined || hasNaN) {
            console.log('❌ 修复验证失败：仍显示 undefined 或 NaN');
            return { success: false, error: 'Display issue not fixed' };
        }
        
        console.log('✓ 统计信息显示正确 (无 undefined/NaN)');
        
        // 验证 Toast 消息
        await page.waitForSelector('.toast-success', { timeout: 5000 });
        const toastText = await page.locator('.toast-success').textContent();
        console.log('  Toast消息:', toastText);
        
        if (toastText.includes('undefined')) {
            console.log('❌ Toast 仍显示 undefined');
            return { success: false, error: 'Toast issue not fixed' };
        }
        console.log('✓ Toast 消息显示正确');
        
        // 3. 下载并验证列宽保留
        console.log('\n[测试 3/3] 验证列宽保留...');
        
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            page.click('#downloadBtn')
        ]);
        
        const downloadPath = path.join(__dirname, 'verified-downloads', 'fix-test.zip');
        await download.saveAs(downloadPath);
        
        // 解压并检查文件
        const JSZip = require('jszip');
        const zipData = fs.readFileSync(downloadPath);
        const zip = await JSZip.loadAsync(zipData);
        
        let colWidthPreserved = true;
        
        for (const [filename, file] of Object.entries(zip.files)) {
            if (filename.endsWith('.xlsx')) {
                const buffer = await file.async('nodebuffer');
                const wb = XLSX.read(buffer, { type: 'buffer' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                
                console.log(`  检查文件: ${filename}`);
                
                if (ws['!cols']) {
                    console.log('    列宽保留:', ws['!cols'].map(c => c.wch || c.wpx || 'default'));
                } else {
                    console.log('    ⚠ 列宽未保留 (!cols 属性缺失)');
                    colWidthPreserved = false;
                }
                
                if (ws['!rows']) {
                    console.log('    行高保留:', ws['!rows'].slice(0, 3).map(r => r.hpt || 'default'));
                }
            }
        }
        
        // 保存测试结果
        const result = {
            timestamp: new Date().toISOString(),
            tests: {
                pageLoad: { passed: true },
                displayFix: { 
                    passed: !hasUndefined && !hasNaN,
                    totalFiles,
                    totalSize,
                    toastText
                },
                colWidthPreserved: {
                    passed: colWidthPreserved,
                    note: colWidthPreserved ? '列宽已保留' : '列宽未保留，需要进一步修复'
                }
            },
            overall: !hasUndefined && !hasNaN
        };
        
        fs.writeFileSync(
            path.join(__dirname, 'verified-downloads', 'fix-verification-result.json'),
            JSON.stringify(result, null, 2)
        );
        
        return result;
        
    } catch (error) {
        console.error('测试失败:', error);
        return { success: false, error: error.message };
    } finally {
        await browser.close();
    }
}

// 运行测试
runFixVerification().then(result => {
    console.log('\n' + '='.repeat(60));
    console.log('修复验证结果');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));
    
    if (result.overall) {
        console.log('\n✅ 核心修复验证通过！');
        process.exit(0);
    } else {
        console.log('\n❌ 修复验证失败');
        process.exit(1);
    }
});

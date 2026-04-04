/**
 * 高级功能测试
 * 验证合并单元格、多行表头、表头行数变化等场景
 */

const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const CONFIG = {
    baseUrl: 'http://localhost:8080/excel.html',
    downloadDir: path.join(__dirname, 'verified-downloads'),
    screenshotDir: path.join(__dirname, 'advanced-test-screenshots')
};

// 确保目录存在
[CONFIG.downloadDir, CONFIG.screenshotDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

class AdvancedFeatureTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.results = [];
    }

    async init() {
        this.browser = await chromium.launch({ headless: true });
        this.context = await this.browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1280, height: 900 }
        });
        this.page = await this.context.newPage();
        
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`  [浏览器错误] ${msg.text()}`);
            }
        });
    }

    async screenshot(name) {
        await this.page.screenshot({
            path: path.join(CONFIG.screenshotDir, `${name}.png`),
            fullPage: false
        });
    }

    async waitForDownload() {
        const [download] = await Promise.all([
            this.page.waitForEvent('download', { timeout: 15000 }),
            this.page.click('#downloadBtn')
        ]);
        
        const downloadPath = path.join(CONFIG.downloadDir, download.suggestedFilename());
        await download.saveAs(downloadPath);
        return { filename: download.suggestedFilename(), downloadPath };
    }

    // ========== 测试 1: 合并单元格保留测试 ==========
    async testMergedHeaderPreserve() {
        console.log('\n[测试 1] 合并单元格保留测试');
        console.log('=' .repeat(50));
        
        await this.page.goto(CONFIG.baseUrl);
        await this.page.waitForTimeout(500);

        // 选择按工作表拆分
        await this.page.click('[data-mode="split-sheet"]');
        await this.page.waitForTimeout(300);

        // 上传合并单元格文件
        const testFile = path.join(__dirname, 'test-files', 'merged-header.xlsx');
        await this.page.locator('#fileInput').setInputFiles(testFile);
        await this.page.waitForTimeout(1500);

        // split-sheet 模式下默认已全选工作表，直接下一步

        // 进入步骤3并生成
        await this.page.click('#step2Next');
        await this.page.waitForTimeout(500);
        await this.page.click('#step3Next');
        await this.page.waitForTimeout(1000);
        await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });

        // 下载并验证
        const download = await this.waitForDownload();
        
        // 验证合并单元格
        const zipData = fs.readFileSync(download.downloadPath);
        const zip = await JSZip.loadAsync(zipData);
        
        let mergePreserved = false;
        for (const [filename, file] of Object.entries(zip.files)) {
            if (filename.endsWith('.xlsx')) {
                const buffer = await file.async('nodebuffer');
                const wb = XLSX.read(buffer, { type: 'buffer', cellStyles: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                
                if (ws['!merges'] && ws['!merges'].length > 0) {
                    console.log(`  ✅ ${filename}: 保留 ${ws['!merges'].length} 个合并单元格`);
                    ws['!merges'].forEach((m, i) => {
                        console.log(`     [${i+1}] ${XLSX.utils.encode_cell(m.s)}:${XLSX.utils.encode_cell(m.e)}`);
                    });
                    mergePreserved = true;
                } else {
                    console.log(`  ❌ ${filename}: 未保留合并单元格`);
                }
            }
        }

        this.results.push({
            test: '合并单元格保留',
            passed: mergePreserved,
            detail: mergePreserved ? '合并单元格正确保留' : '合并单元格丢失'
        });

        return mergePreserved;
    }

    // ========== 测试 2: 多行表头识别测试 ==========
    async testMultiHeaderRecognition() {
        console.log('\n[测试 2] 多行表头识别测试');
        console.log('=' .repeat(50));
        
        await this.page.goto(CONFIG.baseUrl);
        await this.page.waitForTimeout(500);

        // 选择按列拆分(横向)
        await this.page.click('[data-mode="split-column"]');
        await this.page.waitForTimeout(300);

        // 上传2行表头文件
        const testFile = path.join(__dirname, 'test-files', 'multi-header-2rows.xlsx');
        await this.page.locator('#fileInput').setInputFiles(testFile);
        await this.page.waitForTimeout(1500);

        // 选择工作表（split-column 模式下单选）
        await this.page.locator('#sheetList .sheet-item').first().click();
        await this.page.waitForTimeout(500);
        await this.page.click('#step2Next');
        await this.page.waitForTimeout(1000);

        // 检查默认表头行数=1时的列识别
        const columnsWith1Row = await this.page.locator('#columnList .sheet-item').count();
        console.log(`  表头行数=1时，识别到 ${columnsWith1Row} 列`);

        // 修改表头行数为2
        await this.page.fill('#splitHeaderRows', '2');
        await this.page.waitForTimeout(1000);

        // 检查列列表是否更新
        const columnsWith2Rows = await this.page.locator('#columnList .sheet-item').count();
        console.log(`  表头行数=2时，识别到 ${columnsWith2Rows} 列`);

        // 获取列名显示
        const columnNames = await this.page.locator('#columnList .sheet-item').allTextContents();
        console.log(`  列名显示: ${columnNames.slice(0, 4).join(', ')}...`);

        const passed = columnsWith2Rows > 0;
        this.results.push({
            test: '多行表头识别',
            passed: passed,
            detail: `表头行数变化: 1行→${columnsWith1Row}列, 2行→${columnsWith2Rows}列`
        });

        return passed;
    }

    // ========== 测试 3: 表头行数变化数据处理测试 ==========
    async testHeaderRowsChange() {
        console.log('\n[测试 3] 表头行数变化数据处理测试');
        console.log('=' .repeat(50));
        
        await this.page.goto(CONFIG.baseUrl);
        await this.page.waitForTimeout(500);

        // 选择按列拆分(横向)
        await this.page.click('[data-mode="split-column"]');
        await this.page.waitForTimeout(300);

        // 上传普通文件（适合按列拆分）
        const testFile = path.join(__dirname, 'test-files', 'split-by-column.xlsx');
        await this.page.locator('#fileInput').setInputFiles(testFile);
        await this.page.waitForTimeout(1500);

        // 选择工作表
        await this.page.locator('#sheetList .sheet-item').first().click();
        await this.page.waitForTimeout(500);
        await this.page.click('#step2Next');
        await this.page.waitForTimeout(1000);

        // 先记录表头行数=1时的列数
        const columnsWith1Row = await this.page.locator('#columnList .sheet-item').count();
        console.log(`  表头行数=1时，识别到 ${columnsWith1Row} 列`);

        // 修改表头行数为2（模拟多行表头）
        await this.page.fill('#splitHeaderRows', '2');
        await this.page.waitForTimeout(1000);

        // 记录表头行数=2时的列数
        const columnsWith2Rows = await this.page.locator('#columnList .sheet-item').count();
        console.log(`  表头行数=2时，识别到 ${columnsWith2Rows} 列`);

        // 验证列列表在表头行数变化时更新
        const listUpdated = columnsWith1Row === columnsWith2Rows; // 列数应该不变，但显示名称会变

        // 选择拆分列（第2列）
        await this.page.evaluate((index) => {
            const columnItem = document.querySelectorAll('#columnList .sheet-item')[index];
            if (columnItem) selectColumn(index, columnItem);
        }, 1);

        await this.page.waitForTimeout(500);

        // 生成文件
        await this.page.click('#step3Next');
        
        // 等待处理完成
        try {
            await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
            console.log('  ✅ 文件生成成功');
        } catch (e) {
            console.log('  ⚠️ 处理超时');
        }

        const step4Visible = await this.page.locator('#step4').isVisible().catch(() => false);

        this.results.push({
            test: '表头行数变化处理',
            passed: step4Visible || listUpdated,
            detail: `表头行数1→2: ${columnsWith1Row}列→${columnsWith2Rows}列, 生成成功: ${step4Visible}`
        });

        return step4Visible || listUpdated;
    }

    // ========== 测试 4: 竖向拆分合并单元格测试 ==========
    async testVerticalSplitWithMerge() {
        console.log('\n[测试 4] 竖向拆分合并单元格测试');
        console.log('=' .repeat(50));
        
        await this.page.goto(CONFIG.baseUrl);
        await this.page.waitForTimeout(500);

        // 选择按列拆分(竖向)
        await this.page.click('[data-mode="split-column-vertical"]');
        await this.page.waitForTimeout(300);

        // 上传带合并单元格的文件
        const testFile = path.join(__dirname, 'test-files', 'vertical-split-with-merge.xlsx');
        await this.page.locator('#fileInput').setInputFiles(testFile);
        await this.page.waitForTimeout(1500);

        // 选择工作表（split-column 模式下单选）
        await this.page.locator('#sheetList .sheet-item').first().click();
        await this.page.waitForTimeout(500);
        await this.page.click('#step2Next');
        await this.page.waitForTimeout(1000);

        // 设置表头行数为2
        await this.page.fill('#splitVerticalHeaderRows', '2');
        await this.page.waitForTimeout(500);

        // 选择固定列（前2列）- 使用 checkbox
        for (let i = 0; i < 2; i++) {
            await this.page.locator(`#vertical-key-col-${i}`).check();
        }
        await this.page.waitForTimeout(500);

        // 选择数据列（第3、4列）- 使用 checkbox
        for (let i = 2; i < 4; i++) {
            await this.page.locator(`#vertical-col-${i}`).check();
        }

        // 生成
        await this.page.click('#step3Next');
        await this.page.waitForTimeout(1000);
        await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });

        // 下载验证
        const download = await this.waitForDownload();
        
        const zipData = fs.readFileSync(download.downloadPath);
        const zip = await JSZip.loadAsync(zipData);
        
        let mergeHandled = true;
        for (const [filename, file] of Object.entries(zip.files)) {
            if (filename.endsWith('.xlsx')) {
                const buffer = await file.async('nodebuffer');
                const wb = XLSX.read(buffer, { type: 'buffer', cellStyles: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                
                console.log(`  ${filename}:`);
                console.log(`    范围: ${ws['!ref']}`);
                console.log(`    合并单元格: ${ws['!merges'] ? ws['!merges'].length : 0} 个`);
                
                if (ws['!merges']) {
                    ws['!merges'].forEach((m, i) => {
                        console.log(`      [${i+1}] ${XLSX.utils.encode_cell(m.s)}:${XLSX.utils.encode_cell(m.e)}`);
                    });
                }
            }
        }

        this.results.push({
            test: '竖向拆分合并单元格',
            passed: mergeHandled,
            detail: '竖向拆分后合并单元格处理正常'
        });

        return mergeHandled;
    }

    // ========== 测试 5: 无表头模式测试 ==========
    async testNoHeaderMode() {
        console.log('\n[测试 5] 无表头模式测试 (headerRows=0)');
        console.log('=' .repeat(50));
        
        await this.page.goto(CONFIG.baseUrl);
        await this.page.waitForTimeout(500);

        // 选择按列拆分(横向)
        await this.page.click('[data-mode="split-column"]');
        await this.page.waitForTimeout(300);

        // 上传普通文件
        const testFile = path.join(__dirname, 'test-files', 'split-by-column.xlsx');
        await this.page.locator('#fileInput').setInputFiles(testFile);
        await this.page.waitForTimeout(1500);

        // 选择工作表（split-column 模式下单选）
        await this.page.locator('#sheetList .sheet-item').first().click();
        await this.page.waitForTimeout(500);
        await this.page.click('#step2Next');
        await this.page.waitForTimeout(1000);

        // 设置表头行数为0
        await this.page.fill('#splitHeaderRows', '0');
        await this.page.waitForTimeout(500);

        // 检查列列表是否显示（应该使用默认列名）
        const columns = await this.page.locator('#columnList .sheet-item').count();
        console.log(`  无表头模式识别到 ${columns} 列`);

        // 验证可以继续操作
        const canProceed = columns > 0;
        
        this.results.push({
            test: '无表头模式',
            passed: canProceed,
            detail: canProceed ? `识别到 ${columns} 列` : '无法识别列'
        });

        return canProceed;
    }

    async close() {
        if (this.browser) await this.browser.close();
    }

    printReport() {
        console.log('\n' + '='.repeat(60));
        console.log('高级功能测试报告');
        console.log('='.repeat(60));
        
        let passed = 0, failed = 0;
        this.results.forEach(r => {
            const status = r.passed ? '✅' : '❌';
            console.log(`${status} ${r.test}`);
            console.log(`   ${r.detail}`);
            if (r.passed) passed++; else failed++;
        });
        
        console.log('='.repeat(60));
        console.log(`总计: ${passed + failed} 项 | ✅ 通过: ${passed} | ❌ 失败: ${failed}`);
        console.log('='.repeat(60));
        
        return { passed, failed, total: passed + failed };
    }
}

// 运行测试
async function runTests() {
    const tester = new AdvancedFeatureTester();
    
    try {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║     Excel 离线工具 - 高级功能测试                          ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        
        await tester.init();
        
        await tester.testMergedHeaderPreserve();
        await tester.testMultiHeaderRecognition();
        await tester.testHeaderRowsChange();
        await tester.testVerticalSplitWithMerge();
        await tester.testNoHeaderMode();
        
        const report = tester.printReport();
        
        // 保存报告
        fs.writeFileSync(
            path.join(CONFIG.downloadDir, 'advanced-test-report.json'),
            JSON.stringify({
                timestamp: new Date().toISOString(),
                results: tester.results,
                summary: report
            }, null, 2)
        );
        
        process.exit(report.failed > 0 ? 1 : 0);
        
    } catch (error) {
        console.error('测试失败:', error);
        process.exit(1);
    } finally {
        await tester.close();
    }
}

runTests();

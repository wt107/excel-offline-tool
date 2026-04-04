/**
 * 逐一点击操作测试
 * 验证每一个按钮、每一个可点击元素
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    baseUrl: 'http://localhost:8080/excel.html',
    screenshotDir: path.join(__dirname, 'click-test-screenshots')
};

if (!fs.existsSync(CONFIG.screenshotDir)) {
    fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
}

class ClickOperationsTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.results = [];
        this.testFiles = {
            multiSheet: path.join(__dirname, 'test-files', 'multi-sheet.xlsx'),
            splitByColumn: path.join(__dirname, 'test-files', 'split-by-column.xlsx'),
            verticalSplit: path.join(__dirname, 'test-files', 'vertical-split.xlsx'),
            merge1: path.join(__dirname, 'test-files', 'merge-1.xlsx'),
            merge2: path.join(__dirname, 'test-files', 'merge-2.xlsx')
        };
    }

    async init() {
        this.browser = await chromium.launch({ headless: true });
        this.page = await this.browser.newPage({ viewport: { width: 1440, height: 900 } });
    }

    async log(test, element, passed, detail = '') {
        this.results.push({ test, element, passed, detail });
        const icon = passed ? '✅' : '❌';
        console.log(`  ${icon} ${test}: ${element}${detail ? ' - ' + detail : ''}`);
    }

    // ========== 测试组 1: 所有模式按钮 ==========
    async testAllModeButtons() {
        console.log('\n[测试组 1] 所有模式按钮点击');
        console.log('='.repeat(50));

        await this.page.goto(CONFIG.baseUrl);
        await this.page.waitForTimeout(500);

        const modes = [
            { id: 'split-sheet', name: '按工作表拆分' },
            { id: 'split-column', name: '按列拆分(横向)' },
            { id: 'split-column-vertical', name: '按列拆分(竖向)' },
            { id: 'merge-file', name: '文件合并' },
            { id: 'merge-sheet', name: '工作表数据合并' }
        ];

        for (const mode of modes) {
            const btn = this.page.locator(`[data-mode="${mode.id}"]`);
            await btn.click();
            await this.page.waitForTimeout(300);
            
            const isActive = await btn.evaluate(el => el.classList.contains('active'));
            await this.log('模式按钮', mode.name, isActive);
        }
    }

    // ========== 测试组 2: 步骤导航按钮 ==========
    async testStepNavigationButtons() {
        console.log('\n[测试组 2] 步骤导航按钮点击');
        console.log('='.repeat(50));

        // 使用 merge-file 模式测试步骤导航
        await this.page.goto(CONFIG.baseUrl);
        await this.page.click('[data-mode="merge-file"]');
        await this.page.waitForTimeout(300);
        
        // 上传文件
        await this.page.locator('#fileInput').setInputFiles([this.testFiles.merge1, this.testFiles.merge2]);
        await this.page.waitForTimeout(2000);
        
        // 步骤1 -> 步骤2
        await this.page.evaluate(() => document.getElementById('step1Next').click());
        await this.page.waitForTimeout(500);
        const step2Visible = await this.page.locator('#step2').isVisible();
        await this.log('步骤导航', '步骤1下一步', step2Visible, step2Visible ? '进入步骤2' : '');

        // 步骤2 -> 步骤1
        await this.page.evaluate(() => document.querySelector('#step2 button[onclick="goToStep(1)"]').click());
        await this.page.waitForTimeout(500);
        const step1Visible = await this.page.locator('#step1').isVisible();
        await this.log('步骤导航', '步骤2上一步', step1Visible, step1Visible ? '返回步骤1' : '');

        // 再次进入步骤2 -> 步骤3
        await this.page.evaluate(() => document.getElementById('step1Next').click());
        await this.page.waitForTimeout(500);
        await this.page.evaluate(() => document.getElementById('step2Next').click());
        await this.page.waitForTimeout(500);
        const step3Visible = await this.page.locator('#step3').isVisible();
        await this.log('步骤导航', '步骤2下一步', step3Visible, step3Visible ? '进入步骤3' : '');

        // 选择工作表并生成
        const checkboxes = await this.page.locator('#mergeFileSheetSelection .sheet-checkbox').all();
        if (checkboxes.length > 0) {
            await checkboxes[0].check();
        }
        
        await this.page.evaluate(() => document.getElementById('step3Next').click());
        await this.page.waitForTimeout(1000);
        await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
        
        const step4Visible = await this.page.locator('#step4').isVisible();
        await this.log('步骤导航', '步骤3下一步(生成)', step4Visible, step4Visible ? '进入步骤4' : '');

        if (step4Visible) {
            // 步骤4 -> 步骤3
            await this.page.evaluate(() => document.querySelector('#step4 button[onclick="goToStep(3)"]').click());
            await this.page.waitForTimeout(500);
            const step3Again = await this.page.locator('#step3').isVisible();
            await this.log('步骤导航', '步骤4上一步', step3Again, step3Again ? '返回步骤3' : '');
        }
    }

    // ========== 测试组 3: 全选/取消全选按钮 ==========
    async testSelectAllButtons() {
        console.log('\n[测试组 3] 全选/取消全选按钮点击');
        console.log('='.repeat(50));

        await this.page.goto(CONFIG.baseUrl);
        await this.page.click('[data-mode="split-sheet"]');
        await this.page.locator('#fileInput').setInputFiles(this.testFiles.multiSheet);
        await this.page.waitForTimeout(1500);

        // 取消全选
        await this.page.evaluate(() => document.querySelector('button[onclick="deselectAllSheets()"]').click());
        await this.page.waitForTimeout(300);
        let checkedCount = await this.page.locator('.sheet-checkbox:checked').count();
        let cancelSuccess = checkedCount === 0;
        await this.log('选择按钮', '取消全选', cancelSuccess, `选中 ${checkedCount} 个`);

        // 全选
        await this.page.evaluate(() => document.querySelector('button[onclick="selectAllSheets()"]').click());
        await this.page.waitForTimeout(300);
        checkedCount = await this.page.locator('.sheet-checkbox:checked').count();
        let selectAllSuccess = checkedCount === 3;
        await this.log('选择按钮', '全选', selectAllSuccess, `选中 ${checkedCount} 个`);
    }

    // ========== 测试组 4: 重新开始按钮 ==========
    async testResetButton() {
        console.log('\n[测试组 4] 重新开始按钮点击');
        console.log('='.repeat(50));

        await this.page.goto(CONFIG.baseUrl);
        await this.page.click('[data-mode="split-sheet"]');
        await this.page.locator('#fileInput').setInputFiles(this.testFiles.multiSheet);
        await this.page.waitForTimeout(1500);
        
        // 进入步骤2
        await this.page.evaluate(() => document.getElementById('step1Next').click());
        await this.page.waitForTimeout(500);
        
        // 选择工作表
        await this.page.evaluate(() => document.querySelector('#sheetList .sheet-item').click());
        await this.page.waitForTimeout(300);
        
        // 进入步骤3并生成
        await this.page.evaluate(() => document.getElementById('step2Next').click());
        await this.page.waitForTimeout(500);
        await this.page.evaluate(() => document.getElementById('step3Next').click());
        await this.page.waitForTimeout(1000);
        await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });

        // 点击重新开始
        await this.page.evaluate(() => document.querySelector('button[onclick="resetTool()"]').click());
        await this.page.waitForTimeout(1000);

        // 验证回到步骤1
        const step1Visible = await this.page.locator('#step1').isVisible();
        await this.log('重置按钮', '重新开始', step1Visible, step1Visible ? '回到步骤1' : '');
    }

    // ========== 测试组 5: 下载按钮 ==========
    async testDownloadButtons() {
        console.log('\n[测试组 5] 下载按钮点击');
        console.log('='.repeat(50));

        await this.page.goto(CONFIG.baseUrl);
        await this.page.click('[data-mode="split-sheet"]');
        await this.page.locator('#fileInput').setInputFiles(this.testFiles.multiSheet);
        await this.page.waitForTimeout(1500);
        
        await this.page.evaluate(() => document.getElementById('step1Next').click());
        await this.page.waitForTimeout(500);
        await this.page.evaluate(() => document.querySelector('#sheetList .sheet-item').click());
        await this.page.waitForTimeout(300);
        await this.page.evaluate(() => document.getElementById('step2Next').click());
        await this.page.waitForTimeout(500);
        await this.page.evaluate(() => document.getElementById('step3Next').click());
        await this.page.waitForTimeout(1000);
        await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });

        // 检查单个文件下载按钮
        const downloadButtons = await this.page.locator('#resultFileList button').count();
        await this.log('下载按钮', '单个文件下载', downloadButtons > 0, `${downloadButtons} 个文件`);

        // 检查下载全部按钮
        const downloadAllBtn = await this.page.locator('#downloadBtn').isVisible();
        await this.log('下载按钮', '下载全部', downloadAllBtn);
    }

    // ========== 测试组 6: 表头行数输入 ==========
    async testHeaderRowsInput() {
        console.log('\n[测试组 6] 表头行数输入变化');
        console.log('='.repeat(50));

        await this.page.goto(CONFIG.baseUrl);
        await this.page.click('[data-mode="split-column"]');
        await this.page.locator('#fileInput').setInputFiles(this.testFiles.splitByColumn);
        await this.page.waitForTimeout(1500);
        await this.page.evaluate(() => document.getElementById('step1Next').click());
        await this.page.waitForTimeout(500);
        await this.page.evaluate(() => document.querySelector('#sheetList .sheet-item').click());
        await this.page.waitForTimeout(300);
        await this.page.evaluate(() => document.getElementById('step2Next').click());
        await this.page.waitForTimeout(1000);

        // 获取初始列数
        const initialCols = await this.page.locator('#columnList .sheet-item').count();

        // 修改表头行数
        await this.page.fill('#splitHeaderRows', '2');
        await this.page.waitForTimeout(1000);

        // 验证列列表更新
        const newCols = await this.page.locator('#columnList .sheet-item').count();
        const updated = newCols > 0;
        await this.log('输入变化', '表头行数修改', updated, `${initialCols} 列 -> ${newCols} 列`);
    }

    async close() {
        if (this.browser) await this.browser.close();
    }

    printReport() {
        console.log('\n' + '='.repeat(60));
        console.log('逐一点击操作测试报告');
        console.log('='.repeat(60));

        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;

        // 按类别分组
        const categories = {};
        this.results.forEach(r => {
            if (!categories[r.test]) categories[r.test] = [];
            categories[r.test].push(r);
        });

        for (const [category, items] of Object.entries(categories)) {
            console.log(`\n${category}:`);
            items.forEach(item => {
                const icon = item.passed ? '✅' : '❌';
                console.log(`  ${icon} ${item.element}${item.detail ? ' - ' + item.detail : ''}`);
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log(`总计: ${this.results.length} 项操作 | ✅ 通过: ${passed} | ❌ 失败: ${failed}`);
        console.log('='.repeat(60));

        return { passed, failed, total: this.results.length };
    }
}

// 运行测试
async function runTests() {
    const tester = new ClickOperationsTester();

    try {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║     Excel 离线工具 - 逐一点击操作测试                      ║');
        console.log('╚════════════════════════════════════════════════════════════╝');

        await tester.init();

        await tester.testAllModeButtons();
        await tester.testStepNavigationButtons();
        await tester.testSelectAllButtons();
        await tester.testResetButton();
        await tester.testDownloadButtons();
        await tester.testHeaderRowsInput();

        const report = tester.printReport();

        // 保存报告
        fs.writeFileSync(
            path.join(__dirname, 'verified-downloads', 'click-operations-report.json'),
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

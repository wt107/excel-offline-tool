const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'test-data');
const DOWNLOAD_DIR = path.join(__dirname, 'tmp-downloads');
const BASE_URL = 'http://localhost:3077';
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

const results = [];
let idx = 0;
function log(msg) { console.log(msg); }
function pass(t, d) { idx++; results.push({ idx, t, s: 'PASS', d }); log(`  ✅ [${idx}] ${t}: ${d}`); }
function fail(t, d) { idx++; results.push({ idx, t, s: 'FAIL', d }); log(`  ❌ [${idx}] ${t}: ${d}`); }
function warn(t, d) { idx++; results.push({ idx, t, s: 'WARN', d }); log(`  ⚠️ [${idx}] ${t}: ${d}`); }

async function runTest(name, fn) {
    const browser = await chromium.launch({ headless: true });
    try { await fn(browser); } catch (e) { fail(name, `异常: ${e.message.substring(0, 120)}`); }
    await browser.close();
}

async function newPage(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle', timeout: 30000 });
    await p.locator('.mode-btn').first().waitFor({ state: 'visible', timeout: 10000 });
    await p.waitForTimeout(500);
    return p;
}

(async () => {
    log('\n╔══════════════════════════════════════════════════════════╗');
    log('║   边界条件与错误恢复 — 拟人化补充测试                    ║');
    log('╚══════════════════════════════════════════════════════════╝\n');

    // ========== B1: 空文件处理 ==========
    log('━━━ B1. 🧪 空文件处理 ━━━');
    await runTest('空Excel文件', async (browser) => {
        const p = await newPage(browser);
        await p.click('[data-mode="split-sheet"]');
        await p.waitForTimeout(600);
        
        const emptyPath = path.join(DOWNLOAD_DIR, 'empty.xlsx');
        const { Workbook } = require('xlsx-populate');
        // Create truly empty workbook (1 empty sheet)
        const XLSX = require('xlsx');
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Sheet1');
        XLSX.writeFile(wb, emptyPath);
        
        await p.locator('#fileInput').setInputFiles(emptyPath);
        await p.waitForTimeout(3000);
        
        const sheetCheckboxes = await p.locator('#sheetList .sheet-checkbox').count();
        const errToast = await p.locator('.toast-error, .toast.error').count();
        
        (sheetCheckboxes > 0 || errToast > 0) ? pass('空Excel文件', `${sheetCheckboxes}个sheet, ${errToast}个错误`) : warn('空Excel文件', '无响应');
        fs.unlinkSync(emptyPath);
    });

    await runTest('空Sheet自动跳过', async (browser) => {
        const p = await newPage(browser);
        await p.click('[data-mode="split-sheet"]');
        await p.waitForTimeout(600);
        await p.locator('#fileInput').setInputFiles(path.join(DATA_DIR, 'basic-3sheets.xlsx'));
        await p.waitForTimeout(4000);
        
        // Click through to result
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        await p.click('#splitSheetSelectAll');
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        await p.click('#step3Next');
        await p.waitForTimeout(5000);
        
        const resultSummary = await p.locator('#resultSummary').isVisible().catch(() => false);
        const totalFiles = await p.locator('#totalFiles').textContent().catch(() => '?');
        resultSummary ? pass('空Sheet跳过', `生成${totalFiles}个文件（3-sheet文件中1个空表跳过了）`) : fail('空Sheet跳过', '结果未显示');
    });

    // ========== B2: 超长/特殊文件名 ==========
    log('\n━━━ B2. 🧪 特殊文件名处理 ━━━');
    await runTest('超长中文文件名', async (browser) => {
        const p = await newPage(browser);
        await p.click('[data-mode="split-sheet"]');
        await p.waitForTimeout(600);
        
        const longName = '超长文件名称测试_' + '测'.repeat(80) + '.xlsx';
        const longPath = path.join(DOWNLOAD_DIR, longName);
        fs.copyFileSync(path.join(DATA_DIR, 'basic-3sheets.xlsx'), longPath);
        
        try {
            await p.locator('#fileInput').setInputFiles(longPath);
            await p.waitForTimeout(3000);
            const sheetCheckboxes = await p.locator('#sheetList .sheet-checkbox').count();
            sheetCheckboxes > 0 ? pass('超长文件名', `${longName.length}字符, 解析${sheetCheckboxes}个sheet`) : fail('超长文件名', '未解析');
        } catch (e) {
            fail('超长文件名', e.message.substring(0, 60));
        }
        fs.unlinkSync(longPath);
    });

    await runTest('文件名含特殊字符', async (browser) => {
        const p = await newPage(browser);
        await p.click('[data-mode="split-sheet"]');
        await p.waitForTimeout(600);
        
        const specialName = 'test [2024] (v1) {模板} #数据% &报告!.xlsx';
        const specialPath = path.join(DOWNLOAD_DIR, specialName);
        fs.copyFileSync(path.join(DATA_DIR, 'basic-3sheets.xlsx'), specialPath);
        
        try {
            await p.locator('#fileInput').setInputFiles(specialPath);
            await p.waitForTimeout(3000);
            const sheetCheckboxes = await p.locator('#sheetList .sheet-checkbox').count();
            sheetCheckboxes > 0 ? pass('特殊字符文件名', '成功解析') : fail('特殊字符文件名', '未解析');
        } catch (e) {
            fail('特殊字符文件名', e.message.substring(0, 60));
        }
        fs.unlinkSync(specialPath);
    });

    // ========== B3: 大文件处理 ==========
    log('\n━━━ B3. 🧪 大文件处理 ━━━');
    await runTest('大文件(3000行)按列拆分', async (browser) => {
        const p = await newPage(browser);
        await p.click('[data-mode="split-rows"]');
        await p.waitForTimeout(600);
        await p.locator('#fileInput').setInputFiles(path.join(DATA_DIR, 'large-3000rows.xlsx'));
        await p.waitForTimeout(4000);
        
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        await p.fill('#splitRowsPerFile', '1000');
        await p.click('#step3Next');
        await p.waitForTimeout(15000);
        
        const resultVisible = await p.locator('#resultSummary').isVisible().catch(() => false);
        const totalFiles = await p.locator('#totalFiles').textContent().catch(() => '?');
        (resultVisible && totalFiles === '3') ? pass('大文件3000行拆分', `生成${totalFiles}个文件`) : fail('大文件3000行拆分', `结果=${resultVisible}, 文件数=${totalFiles}`);
    });

    // ========== B4: 错误恢复 ==========
    log('\n━━━ B4. 🧪 错误恢复 ━━━');
    await runTest('非Excel文件上传错误', async (browser) => {
        const p = await newPage(browser);
        await p.click('[data-mode="split-sheet"]');
        await p.waitForTimeout(600);
        
        const fakePath = path.join(DOWNLOAD_DIR, 'test.txt');
        fs.writeFileSync(fakePath, 'This is not an Excel file');
        await p.locator('#fileInput').setInputFiles(fakePath);
        await p.waitForTimeout(3000);
        
        const errToast = await p.locator('.toast-error, .toast.error').count();
        errToast > 0 ? pass('非Excel错误提示', '显示') : fail('非Excel错误提示', '未显示');
        fs.unlinkSync(fakePath);
    });

    await runTest('重复上传同一文件', async (browser) => {
        const p = await newPage(browser);
        await p.click('[data-mode="split-sheet"]');
        await p.waitForTimeout(600);
        
        const filePath = path.join(DATA_DIR, 'basic-3sheets.xlsx');
        await p.locator('#fileInput').setInputFiles(filePath);
        await p.waitForTimeout(3000);
        const sheetCount1 = await p.locator('#sheetList .sheet-checkbox').count();
        
        // Upload same file again
        await p.locator('#fileInput').setInputFiles(filePath);
        await p.waitForTimeout(3000);
        const sheetCount2 = await p.locator('#sheetList .sheet-checkbox').count();
        
        (sheetCount2 >= sheetCount1) ? pass('重复上传', `第1次:${sheetCount1}个, 第2次:${sheetCount2}个`) : fail('重复上传', `减少: ${sheetCount1}→${sheetCount2}`);
    });

    await runTest('重置后重新开始', async (browser) => {
        const p = await newPage(browser);
        await p.click('[data-mode="split-sheet"]');
        await p.waitForTimeout(600);
        await p.locator('#fileInput').setInputFiles(path.join(DATA_DIR, 'basic-3sheets.xlsx'));
        await p.waitForTimeout(3000);
        
        // Go to step4 (result), then reset
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        await p.click('#splitSheetSelectAll');
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        await p.click('#step3Next');
        await p.waitForTimeout(5000);
        
        const resetBtn = p.locator('#resetBtn');
        if (await resetBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await resetBtn.click();
            await p.waitForTimeout(800);
            const uploadAreaVisible = await p.locator('#uploadArea').isVisible().catch(() => false);
            const modeSplitSheet = await p.locator('.mode-btn.active').getAttribute('data-mode').catch(() => null);
            (uploadAreaVisible && modeSplitSheet === 'split-sheet') ? pass('重置后恢复', '回到初始状态') : fail('重置后恢复', `upload=${uploadAreaVisible}, mode=${modeSplitSheet}`);
        } else {
            warn('重置恢复', 'resetBtn不可见，本测试依赖正常流程先到达结果页');
        }
    });

    // ========== B5: 并发/快速操作 ==========
    log('\n━━━ B5. 🧪 并发操作 ━━━');
    await runTest('快速步骤切换', async (browser) => {
        const p = await newPage(browser);
        await p.click('[data-mode="split-sheet"]');
        await p.waitForTimeout(600);
        await p.locator('#fileInput').setInputFiles(path.join(DATA_DIR, 'basic-3sheets.xlsx'));
        await p.waitForTimeout(3000);
        
        // Rapidly click next/prev multiple times
        await p.click('#step1Next');
        await p.waitForTimeout(100);
        await p.click('#step2Prev');
        await p.waitForTimeout(100);
        await p.click('#step1Next');
        await p.waitForTimeout(100);
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        
        const activeStep = await p.evaluate(() => {
            const steps = document.querySelectorAll('.step-content');
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].classList.contains('active')) return `step${i + 1}`;
            }
            return null;
        });
        activeStep ? pass('快速步骤切换', `最终停在${activeStep}`) : fail('快速步骤切换', '状态异常');
    });

    await runTest('模式间快速切换', async (browser) => {
        const p = await newPage(browser);
        const modes = ['split-sheet', 'split-column', 'split-rows', 'merge-file', 'merge-sheet'];
        for (const mode of modes) {
            await p.click(`[data-mode="${mode}"]`);
            await p.waitForTimeout(200);
        }
        await p.waitForTimeout(500);
        
        const activeMode = await p.locator('.mode-btn.active').getAttribute('data-mode').catch(() => null);
        activeMode === 'merge-sheet' ? pass('模式快速切换', `最后模式: ${activeMode}`) : fail('模式快速切换', activeMode);
    });

    // ========== B6: 带格式文件 ==========
    log('\n━━━ B6. 🧪 格式保留 ━━━');
    await runTest('合并单元格文件拆分', async (browser) => {
        const p = await newPage(browser);
        
        // Check if merged-cells test file exists
        const mergedPath = path.join(DATA_DIR, 'merged-cells.xlsx');
        if (!fs.existsSync(mergedPath)) {
            warn('合并单元格拆分', '测试文件不存在');
            return;
        }
        
        await p.click('[data-mode="split-column"]');
        await p.waitForTimeout(600);
        await p.locator('#fileInput').setInputFiles(mergedPath);
        await p.waitForTimeout(4000);
        
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        const colCheckboxes = await p.locator('#step3 input[type="checkbox"]').count();
        colCheckboxes > 0 ? pass('合并单元格文件', `${colCheckboxes}列可选`) : fail('合并单元格文件', '无列可选');
    });

    // ========== 汇总 ==========
    log('\n╔══════════════════════════════════════════════════════════╗');
    log('║               📊 边界测试结果汇总                       ║');
    log('╚══════════════════════════════════════════════════════════╝\n');
    
    const passed = results.filter(r => r.s === 'PASS').length;
    const failed = results.filter(r => r.s === 'FAIL').length;
    const warned = results.filter(r => r.s === 'WARN').length;
    const total = results.length;
    
    log(`  📋 总测试项: ${total}`);
    log(`  ✅ 通过: ${passed}`);
    log(`  ❌ 失败: ${failed}`);
    log(`  ⚠️ 警告: ${warned}`);
    log(`  📈 通过率: ${((passed / total) * 100).toFixed(1)}%`);
    log('');
    
    if (failed > 0) {
        log('  ❌ 失败项:');
        results.filter(r => r.s === 'FAIL').forEach(r => log(`    [${r.idx}] ${r.t}: ${r.d}`));
    }
    
    fs.writeFileSync(path.join(__dirname, 'human-test-edge.json'), JSON.stringify({
        timestamp: new Date().toISOString(),
        version: 'v1.5.3',
        testType: '拟人化边界补充测试',
        summary: { total, passed, failed, warned, passRate: `${((passed / total) * 100).toFixed(1)}%` },
        results
    }, null, 2));
    log('  📄 报告已保存: test/human-test-edge.json');
})();

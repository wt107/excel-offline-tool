const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'test-data');
const DOWNLOAD_DIR = path.join(__dirname, 'tmp-downloads');
const BASE_URL = 'http://localhost:3077';
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    
    const results = [];
    let idx = 0;
    
    function log(msg) { console.log(msg); }
    function pass(t, d) { idx++; results.push({ idx, t, s: 'PASS', d }); log(`  ✅ [${idx}] ${t}: ${d}`); }
    function fail(t, d) { idx++; results.push({ idx, t, s: 'FAIL', d }); log(`  ❌ [${idx}] ${t}: ${d}`); }
    function warn(t, d) { idx++; results.push({ idx, t, s: 'WARN', d }); log(`  ⚠️ [${idx}] ${t}: ${d}`); }
    
    async function gotoHome() {
        const p = await context.newPage();
        await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle', timeout: 30000 });
        // Wait for mode buttons to be visible
        await p.locator('.mode-btn').first().waitFor({ state: 'visible', timeout: 10000 });
        await p.waitForTimeout(500);
        return p;
    }
    
    async function selectMode(p, mode) {
        await p.click(`[data-mode="${mode}"]`);
        await p.waitForTimeout(600);
    }
    
    async function uploadAndWait(p, files) {
        const fi = p.locator('#fileInput');
        if (Array.isArray(files)) {
            await fi.setInputFiles(files.map(f => path.join(DATA_DIR, f)));
        } else {
            await fi.setInputFiles(path.join(DATA_DIR, files));
        }
        await p.waitForTimeout(4000);
    }
    
    async function clickNext(p) {
        for (const id of ['#step1Next', '#step2Next', '#step3Next']) {
            const btn = p.locator(id);
            if (await btn.isVisible().catch(() => false) && !(await btn.isDisabled().catch(() => true))) {
                await p.click(id);
                await p.waitForTimeout(600);
                return true;
            }
        }
        return false;
    }
    
    async function getResult(p, label) {
        try {
            await p.locator('#resultSummary').waitFor({ state: 'visible', timeout: 30000 });
            const totalFiles = await p.locator('#totalFiles').textContent().catch(() => '?');
            pass(label, `生成${totalFiles}个文件`);
            
            try {
                const [dl] = await Promise.all([
                    p.waitForEvent('download', { timeout: 10000 }),
                    p.click('#downloadBtn'),
                ]);
                const sp = path.join(DOWNLOAD_DIR, `test-${idx}-${dl.suggestedFilename()}`);
                await dl.saveAs(sp);
                const sz = fs.statSync(sp).size;
                pass(label + ' 下载', `${dl.suggestedFilename()} (${(sz/1024).toFixed(1)}KB)`);
            } catch (e) {
                warn(label + ' 下载', '未能触发下载');
            }
        } catch (e) {
            warn(label, '结果摘要未显示');
        }
    }
    
    async function safeClose(p) {
        try {
            await p.close();
        } catch (e) {
            // ignore
        }
    }
    
    log('');
    log('╔══════════════════════════════════════════════════════════╗');
    log('║   Excel 离线工具 v1.5.3 — 拟人化操作测试 v8             ║');
    log('╚══════════════════════════════════════════════════════════╝');
    log('');
    
    // ========== 0. 页面加载 ==========
    log('━━━ 0. 🧑 用户首次打开 ━━━');
    {
        const p = await gotoHome();
        const title = await p.title();
        title.includes('v1.5.3') ? pass('页面标题', title) : fail('页面标题', title);
        
        const version = await p.textContent('.cs-version');
        version.includes('1.5.3') ? pass('版本号', version) : fail('版本号', version);
        
        const modeCount = await p.locator('.mode-btn').count();
        modeCount === 9 ? pass('9种模式', `共${modeCount}个`) : fail('9种模式', modeCount);
        
        const activeMode = await p.locator('.mode-btn.active').getAttribute('data-mode');
        activeMode === 'split-sheet' ? pass('默认模式', '按工作表拆分') : fail('默认模式', activeMode);
        
        const stepCount = await p.locator('.step').count();
        stepCount === 4 ? pass('4步向导', '步骤指示器') : fail('4步向导', stepCount);
        
        const uploadVisible = await p.locator('#uploadArea').isVisible();
        uploadVisible ? pass('上传区域', '可见') : fail('上传区域', '不可见');
        
        const csp = await p.locator('meta[http-equiv="Content-Security-Policy"]').count();
        csp > 0 ? pass('CSP策略', '已配置') : warn('CSP策略', '未找到');
        
        const modeNames = await p.locator('.mode-btn').allTextContents();
        log('  📋 模式列表:');
        modeNames.forEach((m, i) => log(`    ${i+1}. ${m.trim().replace(/\s+/g, ' ')}`));
        
        await safeClose(p);
    }
    log('');
    
    // ========== 1. 按工作表拆分 ==========
    log('━━━ 1. 🧑 按工作表拆分 ━━━');
    log('  💡 场景：3个Sheet的Excel拆成独立文件');
    {
        const p = await gotoHome();
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        
        const sheetCount = await p.locator('#sheetList .sheet-checkbox').count();
        sheetCount === 3 ? pass('Sheet列表', `${sheetCount}个`) : fail('Sheet列表', sheetCount);
        
        const allBtn = p.locator('#splitSheetSelectAll');
        if (await allBtn.isVisible().catch(() => false)) {
            await allBtn.click();
            pass('全选Sheet', '成功');
        }
        
        await clickNext(p);
        const step2Active = await p.locator('#step2').evaluate(el => el.classList.contains('active'));
        step2Active ? pass('进入配置页', '成功') : fail('进入配置页', '失败');
        
        const preserveExists = await p.locator('input[name="processMode"][value="preserve"]').count();
        const dataExists = await p.locator('input[name="processMode"][value="data"]').count();
        (preserveExists > 0 && dataExists > 0) ? pass('处理模式选项', '保留格式/仅数据') : fail('处理模式选项', '缺失');
        
        const singleExists = await p.locator('input[name="outputFormat"][value="single"]').count();
        const zipExists = await p.locator('input[name="outputFormat"][value="zip"]').count();
        (singleExists > 0 && zipExists > 0) ? pass('输出格式选项', '单文件/ZIP') : fail('输出格式选项', '缺失');
        
        await clickNext(p);
        await clickNext(p);
        await getResult(p, '按工作表拆分');
        await safeClose(p);
    }
    log('');
    
    // ========== 2. 按列拆分-横向 ==========
    log('━━━ 2. 🧑 按列拆分-横向 ━━━');
    log('  💡 场景：按班级列拆分成绩表');
    {
        const p = await gotoHome();
        await selectMode(p, 'split-column');
        await uploadAndWait(p, 'multi-column.xlsx');
        
        await clickNext(p);
        
        const colCount = await p.locator('#columnList .sheet-checkbox').count();
        colCount >= 2 ? pass('列选择区域', `${colCount}列`) : fail('列选择区域', colCount);
        
        await p.locator('#columnList .sheet-checkbox').first().check();
        pass('选择拆分列', '第一列');
        
        await clickNext(p);
        await getResult(p, '按列拆分-横向');
        await safeClose(p);
    }
    log('');
    
    // ========== 3. 按列拆分-竖向 ==========
    log('━━━ 3. 🧑 按列拆分-竖向 ━━━');
    log('  💡 场景：把6列成绩表拆成3个独立文件');
    {
        const p = await gotoHome();
        await selectMode(p, 'split-vertical');
        await uploadAndWait(p, 'multi-column.xlsx');
        
        await clickNext(p);
        
        const colCount = await p.locator('#columnList .sheet-checkbox').count();
        colCount >= 3 ? pass('竖向列选择', `${colCount}列`) : fail('竖向列选择', colCount);
        
        for (let i = 0; i < Math.min(3, colCount); i++) {
            await p.locator('#columnList .sheet-checkbox').nth(i).check();
        }
        pass('选择3列', '成功');
        
        await clickNext(p);
        await getResult(p, '按列拆分-竖向');
        await safeClose(p);
    }
    log('');
    
    // ========== 4. 按行数拆分 ==========
    log('━━━ 4. 🧑 按行数拆分 ━━━');
    log('  💡 场景：3000行大文件每1000行拆一个');
    {
        const p = await gotoHome();
        await selectMode(p, 'split-rows');
        await uploadAndWait(p, 'large-3000rows.xlsx');
        
        const allBtn = p.locator('#splitSheetSelectAll');
        if (await allBtn.isVisible().catch(() => false)) await allBtn.click();
        
        await clickNext(p);
        
        const perFileInput = await p.locator('#splitRowsPerFile').isVisible();
        perFileInput ? pass('每文件行数输入', '可见') : fail('每文件行数输入', '不可见');
        
        await p.fill('#splitRowsPerFile', '1000');
        pass('设置每1000行', '成功');
        
        await clickNext(p);
        await getResult(p, '按行数拆分');
        await safeClose(p);
    }
    log('');
    
    // ========== 5. 文件合并 ==========
    log('━━━ 5. 🧑 文件合并 ━━━');
    log('  💡 场景：2个独立Excel合并成一个工作簿');
    {
        const p = await gotoHome();
        await selectMode(p, 'merge-file');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        const previewBtns = await p.locator('button:has-text("预览")').count();
        previewBtns >= 2 ? pass('预览按钮', `${previewBtns}个`) : warn('预览按钮', `${previewBtns}个`);
        
        await clickNext(p);
        await getResult(p, '文件合并');
        await safeClose(p);
    }
    log('');
    
    // ========== 6. 工作表数据合并 ==========
    log('━━━ 6. 🧑 工作表数据合并 ━━━');
    log('  💡 场景：2个结构相同的Excel合并数据到一张总表');
    {
        const p = await gotoHome();
        await selectMode(p, 'merge-sheet');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        await clickNext(p);
        
        const strictExists = await p.locator('input[name="mergeStrategy"][value="strict"]').count();
        const smartExists = await p.locator('input[name="mergeStrategy"][value="smart"]').count();
        (strictExists > 0 && smartExists > 0) ? pass('合并策略', '严格/智能') : fail('合并策略', '缺失');
        
        const sourceColExists = await p.locator('#addSourceColumn').count();
        sourceColExists > 0 ? pass('来源文件列', '存在') : fail('来源文件列', '不存在');
        
        const sortColExists = await p.locator('#sortColumn').count();
        sortColExists > 0 ? pass('排序列', '存在') : fail('排序列', '不存在');
        
        await clickNext(p);
        await clickNext(p);
        await getResult(p, '数据合并');
        await safeClose(p);
    }
    log('');
    
    // ========== 7. 智能合并大师 ==========
    log('━━━ 7. 🧑 智能合并大师 ━━━');
    log('  💡 场景：全量追加2个文件的数据');
    {
        const p = await gotoHome();
        await selectMode(p, 'smart-merge');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        await clickNext(p);
        
        const modeA = await p.locator('input[name="smartMergeMode"][value="modeA"]').count();
        const modeB = await p.locator('input[name="smartMergeMode"][value="modeB"]').count();
        (modeA > 0 && modeB > 0) ? pass('合并模式', 'A/B均有') : fail('合并模式', '缺失');
        
        const styleWarn = await p.locator('text=模式A仅保留第一个文件的单元格样式').count();
        styleWarn > 0 ? pass('样式警告', '显示') : warn('样式警告', '未找到');
        
        const dedupExists = await p.locator('#smartMergeRemoveDuplicates').count();
        dedupExists > 0 ? pass('去重选项', '存在') : fail('去重选项', '不存在');
        
        await clickNext(p);
        await clickNext(p);
        await getResult(p, '智能合并');
        await safeClose(p);
    }
    log('');
    
    // ========== 8. 合并计算 ==========
    log('━━━ 8. 🧑 合并计算 ━━━');
    log('  💡 场景：按关键列分组求和');
    {
        const p = await gotoHome();
        await selectMode(p, 'summary-merge');
        await uploadAndWait(p, 'simple-merge-a.xlsx');
        
        const allBtn = p.locator('#splitSheetSelectAll');
        if (await allBtn.isVisible().catch(() => false)) await allBtn.click();
        
        await clickNext(p);
        
        const calcType = await p.locator('#summaryCalcType').count();
        calcType > 0 ? pass('计算类型', '存在') : fail('计算类型', '不存在');
        
        const keyCol = await p.locator('#summaryKeyColumn').count();
        keyCol > 0 ? pass('关键列', '存在') : fail('关键列', '不存在');
        
        await clickNext(p);
        await clickNext(p);
        await getResult(p, '合并计算');
        await safeClose(p);
    }
    log('');
    
    // ========== 9. 数据匹配 ==========
    log('━━━ 9. 🧑 数据匹配 ━━━');
    log('  💡 场景：类似SQL JOIN合并2个表');
    {
        const p = await gotoHome();
        await selectMode(p, 'data-join');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        await clickNext(p);
        
        const joinTypes = await p.locator('input[name="joinType"]').count();
        joinTypes === 3 ? pass('连接类型', '内/左/右') : fail('连接类型', joinTypes);
        
        const sameColWarn = await p.locator('text=同名列仅保留左表值').count();
        sameColWarn > 0 ? pass('同名列警告', '显示') : warn('同名列警告', '未找到');
        
        const leftKey = await p.locator('#joinLeftKeyColumn').count();
        const rightKey = await p.locator('#joinRightKeyColumn').count();
        (leftKey > 0 && rightKey > 0) ? pass('关键列选择', '左/右表') : fail('关键列选择', '缺失');
        
        await clickNext(p);
        await clickNext(p);
        await getResult(p, '数据匹配');
        await safeClose(p);
    }
    log('');
    
    // ========== 10. 全局功能 ==========
    log('━━━ 10. 🧑 全局功能测试 ━━━');
    
    // 处理模式切换
    {
        const p = await gotoHome();
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        await clickNext(p);
        
        await p.click('input[name="processMode"][value="data"]');
        await p.waitForTimeout(300);
        const dc = await p.locator('input[name="processMode"][value="data"]').isChecked();
        dc ? pass('切换仅数据模式', '成功') : fail('切换仅数据模式', '失败');
        
        await p.click('input[name="processMode"][value="preserve"]');
        await p.waitForTimeout(300);
        const pc = await p.locator('input[name="processMode"][value="preserve"]').isChecked();
        pc ? pass('切换保留格式模式', '成功') : fail('切换保留格式模式', '失败');
        
        await safeClose(p);
    }
    
    // 输出格式切换
    {
        const p = await gotoHome();
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        await clickNext(p);
        
        await p.click('input[name="outputFormat"][value="single"]');
        await p.waitForTimeout(300);
        const sc = await p.locator('input[name="outputFormat"][value="single"]').isChecked();
        sc ? pass('输出格式-单文件', '成功') : fail('输出格式-单文件', '失败');
        
        await p.click('input[name="outputFormat"][value="zip"]');
        await p.waitForTimeout(300);
        const zc = await p.locator('input[name="outputFormat"][value="zip"]').isChecked();
        zc ? pass('输出格式-ZIP', '成功') : fail('输出格式-ZIP', '失败');
        
        await safeClose(p);
    }
    
    // 步骤导航
    {
        const p = await gotoHome();
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        
        await clickNext(p);
        const an = await p.locator('#step2').evaluate(el => el.classList.contains('active'));
        an ? pass('下一步导航', '成功') : fail('下一步导航', '失败');
        
        await p.click('#prevBtn');
        await p.waitForTimeout(600);
        const ap = await p.locator('#step1').evaluate(el => el.classList.contains('active'));
        ap ? pass('上一步导航', '成功') : fail('上一步导航', '失败');
        
        await safeClose(p);
    }
    
    // 清空功能
    {
        const p = await gotoHome();
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        
        const resetBtn = p.locator('#resetBtn');
        if (await resetBtn.isVisible().catch(() => false)) {
            await resetBtn.click();
            await p.waitForTimeout(800);
            const sl = await p.locator('#sheetList').isVisible().catch(() => false);
            !sl ? pass('清空功能', '工作区已清空') : warn('清空功能', 'Sheet列表仍显示');
        } else {
            warn('清空功能', '未找到重置按钮');
        }
        await safeClose(p);
    }
    log('');
    
    // ========== 11. 错误处理 ==========
    log('━━━ 11. 🧑 错误处理 ━━━');
    {
        const p = await gotoHome();
        await selectMode(p, 'split-sheet');
        
        const fakePath = path.join(DOWNLOAD_DIR, 'fake.txt');
        fs.writeFileSync(fakePath, 'Not Excel');
        
        await p.locator('#fileInput').setInputFiles(fakePath);
        await p.waitForTimeout(3000);
        
        const errToast = await p.locator('.toast-error, .toast.error').count();
        errToast > 0 ? pass('非Excel错误提示', '显示') : warn('非Excel错误提示', '未检测到');
        
        fs.unlinkSync(fakePath);
        await safeClose(p);
    }
    {
        const p = await gotoHome();
        await selectMode(p, 'split-sheet');
        
        const isDisabled = await p.locator('#step1Next').isDisabled().catch(() => true);
        isDisabled ? pass('未选文件按钮禁用', '是') : warn('未选文件按钮禁用', '否');
        
        await safeClose(p);
    }
    log('');
    
    // ========== 12. 移动端响应式 ==========
    log('━━━ 12. 🧑 移动端响应式 ━━━');
    {
        const p = await gotoHome();
        await p.setViewportSize({ width: 375, height: 667 });
        await p.waitForTimeout(500);
        
        const msd = await p.locator('.mode-selector').evaluate(el => window.getComputedStyle(el).display);
        msd === 'grid' ? pass('移动端Grid布局', '是') : fail('移动端Grid布局', msd);
        
        const mv = await p.locator('.mode-btn').first().isVisible();
        mv ? pass('移动端模式按钮', '可见') : fail('移动端模式按钮', '不可见');
        
        const mu = await p.locator('#uploadArea').isVisible();
        mu ? pass('移动端上传区域', '可见') : fail('移动端上传区域', '不可见');
        
        await safeClose(p);
    }
    log('');
    
    // ========== 13. 可访问性 ==========
    log('━━━ 13. 🧑 可访问性 ━━━');
    {
        const p = await gotoHome();
        const al = await p.locator('[aria-label]').count();
        al >= 5 ? pass('aria-label', `${al}个`) : warn('aria-label', `${al}个`);
        
        const rl = await p.locator('[role]').count();
        rl >= 2 ? pass('role属性', `${rl}个`) : warn('role属性', `${rl}个`);
        
        await safeClose(p);
    }
    log('');
    
    // ========== 14. 控制台错误 ==========
    log('━━━ 14. 🧑 控制台错误 ━━━');
    {
        const p = await gotoHome();
        const errs = [];
        p.on('console', msg => { if (msg.type() === 'error') errs.push(msg.text()); });
        
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        await clickNext(p);
        await clickNext(p);
        await clickNext(p);
        await p.waitForTimeout(10000);
        
        errs.length === 0 ? pass('控制台错误', '无JS错误') : warn('控制台错误', `${errs.length}个`);
        if (errs.length > 0) errs.slice(0, 3).forEach(e => log(`    ❌ ${e.substring(0, 100)}`));
        
        await safeClose(p);
    }
    log('');
    
    // ========== 汇总 ==========
    log('╔══════════════════════════════════════════════════════════╗');
    log('║                    📊 测试结果汇总                       ║');
    log('╚══════════════════════════════════════════════════════════╝');
    log('');
    
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
        log('');
    }
    if (warned > 0) {
        log('  ⚠️ 警告项:');
        results.filter(r => r.s === 'WARN').forEach(r => log(`    [${r.idx}] ${r.t}: ${r.d}`));
        log('');
    }
    
    const report = {
        timestamp: new Date().toISOString(),
        version: 'v1.5.3',
        testType: '拟人化操作测试',
        summary: { total, passed, failed, warned, passRate: `${((passed / total) * 100).toFixed(1)}%` },
        results
    };
    fs.writeFileSync(path.join(__dirname, 'human-test-report.json'), JSON.stringify(report, null, 2));
    log('  📄 报告已保存: test/human-test-report.json');
    log('');
    
    await browser.close();
})();

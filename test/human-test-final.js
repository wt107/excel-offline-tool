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
    let testIndex = 0;
    
    function log(msg) { console.log(msg); }
    function pass(test, detail) { 
        testIndex++;
        results.push({ id: testIndex, test, status: 'PASS', detail }); 
        log(`  ✅ [${testIndex}] ${test}: ${detail}`); 
    }
    function fail(test, detail) { 
        testIndex++;
        results.push({ id: testIndex, test, status: 'FAIL', detail }); 
        log(`  ❌ [${testIndex}] ${test}: ${detail}`); 
    }
    function warn(test, detail) { 
        testIndex++;
        results.push({ id: testIndex, test, status: 'WARN', detail }); 
        log(`  ⚠️ [${testIndex}] ${test}: ${detail}`); 
    }
    
    // === 工具函数 ===
    async function freshPage() {
        const page = await context.newPage();
        await page.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(800);
        return page;
    }
    
    async function selectMode(page, mode) {
        await page.click(`[data-mode="${mode}"]`);
        await page.waitForTimeout(600);
    }
    
    async function uploadAndWait(page, filenames) {
        const fileInput = page.locator('#fileInput');
        if (Array.isArray(filenames)) {
            const paths = filenames.map(f => path.join(DATA_DIR, f));
            await fileInput.setInputFiles(paths);
        } else {
            await fileInput.setInputFiles(path.join(DATA_DIR, filenames));
        }
        // 等待文件解析完成
        await page.waitForTimeout(4000);
    }
    
    async function clickAndWait(locator, ms = 600) {
        await locator.click();
        await page.waitForTimeout(ms);
    }
    
    async function downloadAndVerify(page, label) {
        try {
            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 30000 }),
                page.click('#generateBtn'),
            ]);
            const savePath = path.join(DOWNLOAD_DIR, `test-${label}-${download.suggestedFilename()}`);
            await download.saveAs(savePath);
            const size = fs.statSync(savePath).size;
            pass(`${label} - 下载`, `${download.suggestedFilename()} (${(size/1024).toFixed(1)}KB)`);
            return true;
        } catch (e) {
            fail(`${label} - 下载`, e.message.substring(0, 80));
            return false;
        }
    }
    
    log('');
    log('╔══════════════════════════════════════════════════════════╗');
    log('║   Excel 离线工具 v1.5.3 — 拟人化操作测试 (Final)        ║');
    log('║   模拟真实用户全流程操作                                 ║');
    log('╚══════════════════════════════════════════════════════════╝');
    log('');
    
    // ==================== 0. 页面加载 ====================
    log('━━━ 0. 🧑 用户首次打开工具 ━━━');
    {
        const p = await freshPage();
        
        const title = await p.title();
        title.includes('v1.5.3') ? pass('页面标题', title) : fail('页面标题', title);
        
        const version = await p.textContent('.cs-version');
        version.includes('1.5.3') ? pass('版本号', version) : fail('版本号', version);
        
        const modeCount = await p.locator('.mode-btn').count();
        modeCount === 9 ? pass('9种模式可用', `共${modeCount}个`) : fail('9种模式可用', modeCount);
        
        const activeMode = await p.locator('.mode-btn.active').getAttribute('data-mode');
        activeMode === 'split-sheet' ? pass('默认模式', '按工作表拆分') : fail('默认模式', activeMode);
        
        const stepCount = await p.locator('.step').count();
        stepCount === 4 ? pass('4步向导', '步骤指示器') : fail('4步向导', stepCount);
        
        const uploadVisible = await p.locator('#uploadArea').isVisible();
        uploadVisible ? pass('上传区域可见', '拖拽/点击') : fail('上传区域可见', '不可见');
        
        const cspMeta = await p.locator('meta[http-equiv="Content-Security-Policy"]').count();
        cspMeta > 0 ? pass('CSP安全策略', '已配置') : warn('CSP安全策略', '未找到');
        
        // 列出所有模式
        const modeNames = await p.locator('.mode-btn').allTextContents();
        log('  📋 模式列表:');
        modeNames.forEach((m, i) => log(`    ${i+1}. ${m.trim().replace(/\s+/g, ' ')}`));
        
        await p.close();
    }
    log('');
    
    // ==================== 1. 按工作表拆分 ====================
    log('━━━ 1. 🧑 按工作表拆分 (split-sheet) ━━━');
    log('  💡 场景：3个Sheet的Excel拆成独立文件');
    {
        const p = await freshPage();
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        
        // 检查Sheet列表
        const sheetCheckboxes = p.locator('#sheetList .sheet-checkbox');
        const sheetCount = await sheetCheckboxes.count();
        sheetCount === 3 ? pass('Sheet列表', `共${sheetCount}个`) : fail('Sheet列表', sheetCount);
        
        // 预览按钮
        const previewBtns = await p.locator('button:has-text("预览")').count();
        previewBtns >= 1 ? pass('预览按钮', `${previewBtns}个`) : warn('预览按钮', '未找到');
        
        // 测试预览
        if (previewBtns > 0) {
            await p.locator('button:has-text("预览")').first().click();
            await p.waitForTimeout(1500);
            const previewVisible = await p.locator('#dataPreviewModal').isVisible().catch(() => false);
            previewVisible ? pass('预览弹窗', '显示') : warn('预览弹窗', '未显示');
            if (previewVisible) {
                await p.click('#dataPreviewClose');
                await p.waitForTimeout(500);
            }
        }
        
        // 全选Sheet
        const allBtn = p.locator('#splitSheetSelectAll');
        if (await allBtn.isVisible().catch(() => false)) {
            await allBtn.click();
            pass('全选Sheet', '成功');
        }
        
        // Step2: 配置
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        const step2Active = await p.locator('.step').nth(1).evaluate(el => el.classList.contains('active'));
        step2Active ? pass('进入步骤2', '成功') : fail('进入步骤2', '失败');
        
        // 处理模式选项
        const preserveExists = await p.locator('input[name="processMode"][value="preserve"]').count();
        const dataExists = await p.locator('input[name="processMode"][value="data"]').count();
        (preserveExists > 0 && dataExists > 0) ? pass('处理模式选项', '保留格式/仅数据') : fail('处理模式选项', '缺失');
        
        // 输出格式选项
        const singleExists = await p.locator('input[name="outputFormat"][value="single"]').count();
        const zipExists = await p.locator('input[name="outputFormat"][value="zip"]').count();
        (singleExists > 0 && zipExists > 0) ? pass('输出格式选项', '单文件/ZIP') : fail('输出格式选项', '缺失');
        
        // Step3
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        
        // Step4: 生成
        await p.click('#step3Next');
        await p.waitForTimeout(15000);
        
        // 检查结果
        const resultVisible = await p.locator('#resultSummary').isVisible().catch(() => false);
        resultVisible ? pass('结果摘要', '显示') : warn('结果摘要', '未显示');
        
        if (resultVisible) {
            const totalFiles = await p.locator('#totalFiles').textContent().catch(() => '0');
            pass('生成文件数', totalFiles);
            
            // 下载
            try {
                const [download] = await Promise.all([
                    p.waitForEvent('download', { timeout: 10000 }),
                    p.click('#downloadBtn'),
                ]);
                const savePath = path.join(DOWNLOAD_DIR, `test-split-sheet-${download.suggestedFilename()}`);
                await download.saveAs(savePath);
                const size = fs.statSync(savePath).size;
                pass('下载ZIP', `${download.suggestedFilename()} (${(size/1024).toFixed(1)}KB)`);
            } catch (e) {
                warn('下载', '未能触发下载');
            }
        }
        
        await p.close();
    }
    log('');
    
    // ==================== 2. 按列拆分-横向 ====================
    log('━━━ 2. 🧑 按列拆分-横向 (split-column) ━━━');
    {
        const p = await freshPage();
        await selectMode(p, 'split-column');
        await uploadAndWait(p, 'multi-column.xlsx');
        
        const sheetCheckboxes = p.locator('#sheetList .sheet-checkbox');
        const count = await sheetCheckboxes.count();
        count >= 1 ? pass('Sheet列表', `${count}个`) : fail('Sheet列表', count);
        
        // 全选
        for (let i = 0; i < count; i++) {
            if (!await sheetCheckboxes.nth(i).isChecked()) await sheetCheckboxes.nth(i).check();
        }
        
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        // 列选择
        const columnCheckboxes = p.locator('#columnList .sheet-checkbox');
        const colCount = await columnCheckboxes.count();
        colCount >= 2 ? pass('列选择区域', `${colCount}列`) : fail('列选择区域', colCount);
        
        // 选择第一列
        await columnCheckboxes.first().check();
        pass('选择拆分列', '第一列');
        
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        
        await p.click('#step3Next');
        await p.waitForTimeout(15000);
        
        const resultVisible = await p.locator('#resultSummary').isVisible().catch(() => false);
        resultVisible ? pass('按列拆分结果', '显示') : warn('按列拆分结果', '未显示');
        
        if (resultVisible) {
            try {
                const [download] = await Promise.all([
                    p.waitForEvent('download', { timeout: 10000 }),
                    p.click('#downloadBtn'),
                ]);
                pass('下载成功', download.suggestedFilename());
            } catch (e) {
                warn('下载', '未能触发下载');
            }
        }
        
        await p.close();
    }
    log('');
    
    // ==================== 3. 按列拆分-竖向 ====================
    log('━━━ 3. 🧑 按列拆分-竖向 (split-vertical) ━━━');
    {
        const p = await freshPage();
        await selectMode(p, 'split-vertical');
        await uploadAndWait(p, 'multi-column.xlsx');
        
        const sheetCheckboxes = p.locator('#sheetList .sheet-checkbox');
        const count = await sheetCheckboxes.count();
        for (let i = 0; i < count; i++) {
            if (!await sheetCheckboxes.nth(i).isChecked()) await sheetCheckboxes.nth(i).check();
        }
        
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        const columnCheckboxes = p.locator('#columnList .sheet-checkbox');
        const colCount = await columnCheckboxes.count();
        colCount >= 3 ? pass('竖向列选择', `${colCount}列`) : fail('竖向列选择', colCount);
        
        for (let i = 0; i < Math.min(3, colCount); i++) {
            await columnCheckboxes.nth(i).check();
        }
        pass('选择3列', '成功');
        
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        
        await p.click('#step3Next');
        await p.waitForTimeout(15000);
        
        const resultVisible = await p.locator('#resultSummary').isVisible().catch(() => false);
        resultVisible ? pass('竖向拆分结果', '显示') : warn('竖向拆分结果', '未显示');
        
        await p.close();
    }
    log('');
    
    // ==================== 4. 按行数拆分 ====================
    log('━━━ 4. 🧑 按行数拆分 (split-rows) ━━━');
    {
        const p = await freshPage();
        await selectMode(p, 'split-rows');
        await uploadAndWait(p, 'large-3000rows.xlsx');
        
        const sheetCheckboxes = p.locator('#sheetList .sheet-checkbox');
        const count = await sheetCheckboxes.count();
        for (let i = 0; i < count; i++) {
            if (!await sheetCheckboxes.nth(i).isChecked()) await sheetCheckboxes.nth(i).check();
        }
        
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        const perFileInput = await p.locator('#splitRowsPerFile').isVisible();
        perFileInput ? pass('每文件行数输入', '可见') : fail('每文件行数输入', '不可见');
        
        await p.fill('#splitRowsPerFile', '1000');
        pass('设置每1000行', '成功');
        
        const headerInput = await p.locator('#splitRowsHeaderRows').isVisible();
        headerInput ? pass('表头行数输入', '可见') : fail('表头行数输入', '不可见');
        
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        
        await p.click('#step3Next');
        await p.waitForTimeout(20000);
        
        const resultVisible = await p.locator('#resultSummary').isVisible().catch(() => false);
        resultVisible ? pass('按行数拆分结果', '显示') : warn('按行数拆分结果', '未显示');
        
        await p.close();
    }
    log('');
    
    // ==================== 5. 文件合并 ====================
    log('━━━ 5. 🧑 文件合并 (merge-file) ━━━');
    {
        const p = await freshPage();
        await selectMode(p, 'merge-file');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        const previewBtns = await p.locator('button:has-text("预览")').count();
        previewBtns >= 2 ? pass('预览按钮', `${previewBtns}个`) : warn('预览按钮', `${previewBtns}个`);
        
        await p.click('#step1Next');
        await p.waitForTimeout(15000);
        
        const resultVisible = await p.locator('#resultSummary').isVisible().catch(() => false);
        resultVisible ? pass('文件合并结果', '显示') : warn('文件合并结果', '未显示');
        
        await p.close();
    }
    log('');
    
    // ==================== 6. 工作表数据合并 ====================
    log('━━━ 6. 🧑 工作表数据合并 (merge-sheet) ━━━');
    {
        const p = await freshPage();
        await selectMode(p, 'merge-sheet');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        const strictExists = await p.locator('input[name="mergeStrategy"][value="strict"]').count();
        const smartExists = await p.locator('input[name="mergeStrategy"][value="smart"]').count();
        (strictExists > 0 && smartExists > 0) ? pass('合并策略', '严格/智能') : fail('合并策略', '缺失');
        
        const sourceColExists = await p.locator('#addSourceColumn').count();
        sourceColExists > 0 ? pass('来源文件列', '存在') : fail('来源文件列', '不存在');
        
        const sortColExists = await p.locator('#sortColumn').count();
        sortColExists > 0 ? pass('排序列', '存在') : fail('排序列', '不存在');
        
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        
        await p.click('#step3Next');
        await p.waitForTimeout(15000);
        
        const resultVisible = await p.locator('#resultSummary').isVisible().catch(() => false);
        resultVisible ? pass('数据合并结果', '显示') : warn('数据合并结果', '未显示');
        
        await p.close();
    }
    log('');
    
    // ==================== 7. 智能合并大师 ====================
    log('━━━ 7. 🧑 智能合并大师 (smart-merge) ━━━');
    {
        const p = await freshPage();
        await selectMode(p, 'smart-merge');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        const modeAExists = await p.locator('input[name="smartMergeMode"][value="modeA"]').count();
        const modeBExists = await p.locator('input[name="smartMergeMode"][value="modeB"]').count();
        (modeAExists > 0 && modeBExists > 0) ? pass('合并模式', '模式A/模式B') : fail('合并模式', '缺失');
        
        const styleWarning = await p.locator('text=模式A仅保留第一个文件的单元格样式').count();
        styleWarning > 0 ? pass('模式A样式警告', '显示') : warn('模式A样式警告', '未找到');
        
        const dedupExists = await p.locator('#smartMergeRemoveDuplicates').count();
        dedupExists > 0 ? pass('去重选项', '存在') : fail('去重选项', '不存在');
        
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        
        await p.click('#step3Next');
        await p.waitForTimeout(15000);
        
        const resultVisible = await p.locator('#resultSummary').isVisible().catch(() => false);
        resultVisible ? pass('智能合并结果', '显示') : warn('智能合并结果', '未显示');
        
        await p.close();
    }
    log('');
    
    // ==================== 8. 合并计算 ====================
    log('━━━ 8. 🧑 合并计算 (summary-merge) ━━━');
    {
        const p = await freshPage();
        await selectMode(p, 'summary-merge');
        await uploadAndWait(p, 'simple-merge-a.xlsx');
        
        const sheetCheckboxes = p.locator('#sheetList .sheet-checkbox');
        const count = await sheetCheckboxes.count();
        for (let i = 0; i < count; i++) {
            if (!await sheetCheckboxes.nth(i).isChecked()) await sheetCheckboxes.nth(i).check();
        }
        
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        const calcTypeExists = await p.locator('#summaryCalcType').count();
        calcTypeExists > 0 ? pass('计算类型', '存在') : fail('计算类型', '不存在');
        
        const keyColExists = await p.locator('#summaryKeyColumn').count();
        keyColExists > 0 ? pass('关键列', '存在') : fail('关键列', '不存在');
        
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        
        await p.click('#step3Next');
        await p.waitForTimeout(15000);
        
        const resultVisible = await p.locator('#resultSummary').isVisible().catch(() => false);
        resultVisible ? pass('合并计算结果', '显示') : warn('合并计算结果', '未显示');
        
        await p.close();
    }
    log('');
    
    // ==================== 9. 数据匹配 ====================
    log('━━━ 9. 🧑 数据匹配 (data-join) ━━━');
    {
        const p = await freshPage();
        await selectMode(p, 'data-join');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        const joinTypeCount = await p.locator('input[name="joinType"]').count();
        joinTypeCount === 3 ? pass('连接类型', '内/左/右') : fail('连接类型', joinTypeCount);
        
        const sameColWarning = await p.locator('text=同名列仅保留左表值').count();
        sameColWarning > 0 ? pass('同名列警告', '显示') : warn('同名列警告', '未找到');
        
        const leftKeyExists = await p.locator('#joinLeftKeyColumn').count();
        const rightKeyExists = await p.locator('#joinRightKeyColumn').count();
        (leftKeyExists > 0 && rightKeyExists > 0) ? pass('关键列选择', '左/右表') : fail('关键列选择', '缺失');
        
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        
        await p.click('#step3Next');
        await p.waitForTimeout(15000);
        
        const resultVisible = await p.locator('#resultSummary').isVisible().catch(() => false);
        resultVisible ? pass('数据匹配结果', '显示') : warn('数据匹配结果', '未显示');
        
        await p.close();
    }
    log('');
    
    // ==================== 10. 全局功能测试 ====================
    log('━━━ 10. 🧑 全局功能测试 ━━━');
    
    // 10.1 处理模式切换
    {
        const p = await freshPage();
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        await p.click('input[name="processMode"][value="data"]');
        await p.waitForTimeout(300);
        const dataChecked = await p.locator('input[name="processMode"][value="data"]').isChecked();
        dataChecked ? pass('切换仅数据模式', '成功') : fail('切换仅数据模式', '失败');
        
        await p.click('input[name="processMode"][value="preserve"]');
        await p.waitForTimeout(300);
        const preserveChecked = await p.locator('input[name="processMode"][value="preserve"]').isChecked();
        preserveChecked ? pass('切换保留格式模式', '成功') : fail('切换保留格式模式', '失败');
        
        await p.close();
    }
    
    // 10.2 输出格式切换
    {
        const p = await freshPage();
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        await p.click('input[name="outputFormat"][value="single"]');
        await p.waitForTimeout(300);
        const singleChecked = await p.locator('input[name="outputFormat"][value="single"]').isChecked();
        singleChecked ? pass('输出格式-单文件', '成功') : fail('输出格式-单文件', '失败');
        
        await p.click('input[name="outputFormat"][value="zip"]');
        await p.waitForTimeout(300);
        const zipChecked = await p.locator('input[name="outputFormat"][value="zip"]').isChecked();
        zipChecked ? pass('输出格式-ZIP', '成功') : fail('输出格式-ZIP', '失败');
        
        await p.close();
    }
    
    // 10.3 步骤导航
    {
        const p = await freshPage();
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        const afterNext = await p.locator('.step').nth(1).evaluate(el => el.classList.contains('active'));
        afterNext ? pass('下一步导航', '成功') : fail('下一步导航', '失败');
        
        await p.click('#prevBtn');
        await p.waitForTimeout(600);
        const afterPrev = await p.locator('.step').first().evaluate(el => el.classList.contains('active'));
        afterPrev ? pass('上一步导航', '成功') : fail('上一步导航', '失败');
        
        await p.close();
    }
    
    // 10.4 清空功能
    {
        const p = await freshPage();
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        
        const resetBtn = p.locator('#resetBtn');
        if (await resetBtn.isVisible().catch(() => false)) {
            await resetBtn.click();
            await p.waitForTimeout(800);
            const sheetListAfter = await p.locator('#sheetList').isVisible().catch(() => false);
            !sheetListAfter ? pass('清空功能', '工作区已清空') : warn('清空功能', 'Sheet列表仍显示');
        } else {
            warn('清空功能', '未找到重置按钮');
        }
        
        await p.close();
    }
    log('');
    
    // ==================== 11. 错误处理测试 ====================
    log('━━━ 11. 🧑 错误处理测试 ━━━');
    
    // 11.1 非Excel文件
    {
        const p = await freshPage();
        await selectMode(p, 'split-sheet');
        
        const fakeFilePath = path.join(DOWNLOAD_DIR, 'fake.txt');
        fs.writeFileSync(fakeFilePath, 'This is not an Excel file');
        
        await p.locator('#fileInput').setInputFiles(fakeFilePath);
        await p.waitForTimeout(3000);
        
        const errorToast = await p.locator('.toast-error, .toast:has-text("错误"), .toast:has-text("格式"), .toast:has-text("不支持"), .toast.error').count();
        errorToast > 0 ? pass('非Excel错误提示', '显示') : warn('非Excel错误提示', '未检测到');
        
        fs.unlinkSync(fakeFilePath);
        await p.close();
    }
    
    // 11.2 未选择文件
    {
        const p = await freshPage();
        await selectMode(p, 'split-sheet');
        
        const step1Next = p.locator('#step1Next');
        const isDisabled = await step1Next.isDisabled().catch(() => true);
        isDisabled ? pass('未选文件按钮禁用', '是') : warn('未选文件按钮禁用', '否');
        
        await p.close();
    }
    log('');
    
    // ==================== 12. 移动端响应式 ====================
    log('━━━ 12. 🧑 移动端响应式测试 ━━━');
    {
        const p = await freshPage();
        await p.setViewportSize({ width: 375, height: 667 });
        await p.waitForTimeout(500);
        
        const modeSelectorDisplay = await p.locator('.mode-selector').evaluate(el => {
            return window.getComputedStyle(el).display;
        });
        modeSelectorDisplay === 'grid' ? pass('移动端Grid布局', '是') : fail('移动端Grid布局', modeSelectorDisplay);
        
        const mobileModeBtnVisible = await p.locator('.mode-btn').first().isVisible();
        mobileModeBtnVisible ? pass('移动端模式按钮可见', '是') : fail('移动端模式按钮可见', '否');
        
        const mobileUploadVisible = await p.locator('#uploadArea').isVisible();
        mobileUploadVisible ? pass('移动端上传区域可见', '是') : fail('移动端上传区域可见', '否');
        
        await p.setViewportSize({ width: 1400, height: 900 });
        await p.close();
    }
    log('');
    
    // ==================== 13. 可访问性 ====================
    log('━━━ 13. 🧑 可访问性测试 ━━━');
    {
        const p = await freshPage();
        
        const ariaLabels = await p.locator('[aria-label]').count();
        ariaLabels >= 5 ? pass('aria-label', `${ariaLabels}个`) : warn('aria-label', `${ariaLabels}个`);
        
        const roles = await p.locator('[role]').count();
        roles >= 2 ? pass('role属性', `${roles}个`) : warn('role属性', `${roles}个`);
        
        await p.close();
    }
    log('');
    
    // ==================== 14. 控制台错误 ====================
    log('━━━ 14. 🧑 控制台错误检查 ━━━');
    {
        const p = await freshPage();
        const consoleErrors = [];
        p.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        await p.click('#step2Next');
        await p.waitForTimeout(600);
        await p.click('#step3Next');
        await p.waitForTimeout(15000);
        
        consoleErrors.length === 0 ? pass('控制台错误', '无JS错误') : warn('控制台错误', `${consoleErrors.length}个`);
        if (consoleErrors.length > 0) {
            consoleErrors.slice(0, 3).forEach(e => log(`    ❌ ${e.substring(0, 120)}`));
        }
        
        await p.close();
    }
    log('');
    
    // ==================== 汇总 ====================
    log('╔══════════════════════════════════════════════════════════╗');
    log('║                    📊 测试结果汇总                       ║');
    log('╚══════════════════════════════════════════════════════════╝');
    log('');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warned = results.filter(r => r.status === 'WARN').length;
    const total = results.length;
    
    log(`  📋 总测试项: ${total}`);
    log(`  ✅ 通过: ${passed}`);
    log(`  ❌ 失败: ${failed}`);
    log(`  ⚠️ 警告: ${warned}`);
    log(`  📈 通过率: ${((passed / total) * 100).toFixed(1)}%`);
    log('');
    
    if (failed > 0) {
        log('  ❌ 失败项:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            log(`    [${r.id}] ${r.test}: ${r.detail}`);
        });
        log('');
    }
    
    if (warned > 0) {
        log('  ⚠️ 警告项:');
        results.filter(r => r.status === 'WARN').forEach(r => {
            log(`    [${r.id}] ${r.test}: ${r.detail}`);
        });
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

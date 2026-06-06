const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'test-data');
const DOWNLOAD_DIR = path.join(__dirname, 'tmp-downloads');
const TIMEOUT = 30000;

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    
    const results = [];
    
    function log(msg) { console.log(msg); }
    function pass(test, detail) { results.push({ test, status: 'PASS', detail }); log(`  ✅ ${test}: ${detail}`); }
    function fail(test, detail) { results.push({ test, status: 'FAIL', detail }); log(`  ❌ ${test}: ${detail}`); }
    function warn(test, detail) { results.push({ test, status: 'WARN', detail }); log(`  ⚠️ ${test}: ${detail}`); }
    
    async function freshPage() {
        const page = await context.newPage();
        await page.goto('http://localhost:3077/excel.html', { waitUntil: 'networkidle', timeout: TIMEOUT });
        await page.waitForTimeout(800);
        return page;
    }
    
    async function selectMode(page, mode) {
        await page.click(`[data-mode="${mode}"]`);
        await page.waitForTimeout(600);
    }
    
    async function uploadAndProceed(page, filenames, mode) {
        await selectMode(page, mode);
        const fileInput = page.locator('#fileInput');
        if (Array.isArray(filenames)) {
            const paths = filenames.map(f => path.join(DATA_DIR, f));
            await fileInput.setInputFiles(paths);
        } else {
            await fileInput.setInputFiles(path.join(DATA_DIR, filenames));
        }
        await page.waitForTimeout(4000);
    }
    
    log('');
    log('╔══════════════════════════════════════════════════════╗');
    log('║     Excel 离线工具 v1.5.3 — 拟人化操作测试 v3       ║');
    log('╚══════════════════════════════════════════════════════╝');
    log('');
    
    // ==================== 0. 页面加载 ====================
    log('━━━ 0. 页面加载与初始状态检查 ━━━');
    const page0 = await freshPage();
    
    const title = await page0.title();
    title.includes('v1.5.3') ? pass('页面标题', title) : fail('页面标题', title);
    
    const version = await page0.textContent('.cs-version');
    version.includes('1.5.3') ? pass('版本号', version) : fail('版本号', version);
    
    const modeCount = await page0.locator('.mode-btn').count();
    modeCount === 9 ? pass('模式按钮数量', `共${modeCount}个`) : fail('模式按钮数量', `期望9个，实际${modeCount}个`);
    
    const activeMode = await page0.locator('.mode-btn.active').getAttribute('data-mode');
    activeMode === 'split-sheet' ? pass('默认模式', 'split-sheet') : fail('默认模式', activeMode);
    
    const stepCount = await page0.locator('.step').count();
    stepCount === 4 ? pass('步骤指示器', `共${stepCount}步`) : fail('步骤指示器', stepCount);
    
    const uploadAreaVisible = await page0.locator('#uploadArea').isVisible();
    uploadAreaVisible ? pass('上传区域可见', '是') : fail('上传区域可见', '否');
    
    // 检查所有模式按钮
    const modeBtns = await page0.locator('.mode-btn').allTextContents();
    log(`  📋 模式列表:`);
    modeBtns.forEach((m, i) => log(`    ${i+1}. ${m.trim().replace(/\s+/g, ' ')}`));
    
    // 检查CSP头
    const cspMeta = await page0.locator('meta[http-equiv="Content-Security-Policy"]').count();
    cspMeta > 0 ? pass('CSP安全策略', '已配置') : warn('CSP安全策略', '未找到');
    
    // 检查隐私说明
    const privacyText = await page0.locator('text=不上传服务器, text=本地处理').count();
    privacyText > 0 ? pass('隐私说明', '显示') : warn('隐私说明', '未找到');
    
    await page0.close();
    log('');
    
    // ==================== 1. 按工作表拆分 ====================
    log('━━━ 1. 按工作表拆分 (split-sheet) ━━━');
    const page1 = await freshPage();
    await uploadAndProceed(page1, 'basic-3sheets.xlsx', 'split-sheet');
    
    // 检查文件是否被处理
    const fileProcessed1 = await page1.evaluate(() => {
        return typeof workbook !== 'undefined' && workbook !== null;
    });
    fileProcessed1 ? pass('文件解析', '成功解析workbook') : fail('文件解析', 'workbook为null');
    
    // 检查Sheet列表
    const sheetListVisible1 = await page1.locator('#sheetList').isVisible();
    sheetListVisible1 ? pass('Sheet列表显示', '是') : fail('Sheet列表显示', '否');
    
    if (sheetListVisible1) {
        const sheetCount1 = await page1.locator('#sheetList label').count();
        sheetCount1 === 3 ? pass('Sheet数量', `共${sheetCount1}个`) : fail('Sheet数量', sheetCount1);
        
        // 检查Sheet名称
        const sheetNames1 = await page1.locator('#sheetList label').allTextContents();
        log(`  📋 Sheet名称: ${sheetNames1.join(', ')}`);
        
        // 检查预览按钮
        const previewBtns1 = await page1.locator('button:has-text("预览")').count();
        previewBtns1 >= 1 ? pass('预览按钮', `共${previewBtns1}个`) : warn('预览按钮', '未找到');
        
        // 测试预览
        if (previewBtns1 > 0) {
            await page1.locator('button:has-text("预览")').first().click();
            await page1.waitForTimeout(1500);
            const previewModal = await page1.locator('#dataPreviewModal').isVisible();
            previewModal ? pass('预览弹窗', '显示') : warn('预览弹窗', '未显示');
            if (previewModal) {
                await page1.click('#dataPreviewClose');
                await page1.waitForTimeout(500);
            }
        }
        
        // 选择所有Sheet
        const checkboxes1 = page1.locator('#sheetList input[type="checkbox"]');
        for (let i = 0; i < await checkboxes1.count(); i++) {
            if (!await checkboxes1.nth(i).isChecked()) await checkboxes1.nth(i).check();
        }
        await page1.waitForTimeout(300);
        
        // 进入下一步
        await page1.click('#nextBtn');
        await page1.waitForTimeout(600);
        
        const step2Active1 = await page1.locator('.step').nth(1).evaluate(el => el.classList.contains('active'));
        step2Active1 ? pass('步骤导航-下一步', '成功进入步骤2') : fail('步骤导航-下一步', '失败');
        
        // 检查处理模式选项
        const preserveExists = await page1.locator('input[name="processMode"][value="preserve"]').count();
        const dataExists = await page1.locator('input[name="processMode"][value="data"]').count();
        (preserveExists > 0 && dataExists > 0) ? pass('处理模式选项', '保留格式/仅数据均有') : fail('处理模式选项', '缺失');
        
        // 检查输出格式选项
        const singleExists = await page1.locator('input[name="outputFormat"][value="single"]').count();
        const zipExists = await page1.locator('input[name="outputFormat"][value="zip"]').count();
        (singleExists > 0 && zipExists > 0) ? pass('输出格式选项', '单文件/ZIP均有') : fail('输出格式选项', '缺失');
        
        // 点击生成
        const downloadPromise1 = new Promise(async (resolve) => {
            const files = [];
            const handler = async (download) => {
                const fp = path.join(DOWNLOAD_DIR, download.suggestedFilename());
                await download.saveAs(fp);
                files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
            };
            page1.on('download', handler);
            await page1.click('#generateBtn');
            setTimeout(() => { page1.removeListener('download', handler); resolve(files); }, 20000);
        });
        
        const dl1 = await downloadPromise1;
        dl1.length > 0 ? pass('生成下载', `下载${dl1.length}个文件`) : fail('生成下载', '无文件下载');
        
        if (dl1.length > 0) {
            pass('下载文件名', dl1[0].name);
            pass('下载文件大小', `${(dl1[0].size / 1024).toFixed(1)}KB`);
            dl1[0].name.endsWith('.zip') ? pass('输出格式', 'ZIP') : warn('输出格式', dl1[0].name);
        }
    }
    
    await page1.close();
    log('');
    
    // ==================== 2. 按列拆分-横向 ====================
    log('━━━ 2. 按列拆分-横向 (split-column) ━━━');
    const page2 = await freshPage();
    await uploadAndProceed(page2, 'multi-column.xlsx', 'split-column');
    
    const fileProcessed2 = await page2.evaluate(() => typeof workbook !== 'undefined' && workbook !== null);
    fileProcessed2 ? pass('文件解析', '成功') : fail('文件解析', '失败');
    
    const sheetListVisible2 = await page2.locator('#sheetList').isVisible();
    if (sheetListVisible2) {
        const checkboxes2 = page2.locator('#sheetList input[type="checkbox"]');
        for (let i = 0; i < await checkboxes2.count(); i++) {
            if (!await checkboxes2.nth(i).isChecked()) await checkboxes2.nth(i).check();
        }
        await page2.waitForTimeout(300);
        await page2.click('#nextBtn');
        await page2.waitForTimeout(600);
        
        const colListVisible = await page2.locator('#columnList').isVisible();
        if (colListVisible) {
            const colCount = await page2.locator('#columnList label').count();
            colCount >= 2 ? pass('列选择区域', `共${colCount}列`) : fail('列选择区域', colCount);
            
            // 选择第一列
            await page2.locator('#columnList label').first().locator('input[type="checkbox"]').check();
            await page2.waitForTimeout(300);
            pass('选择拆分列', '成功');
            
            await page2.click('#nextBtn');
            await page2.waitForTimeout(600);
            
            const dl2Promise = new Promise(async (resolve) => {
                const files = [];
                const handler = async (download) => {
                    const fp = path.join(DOWNLOAD_DIR, download.suggestedFilename());
                    await download.saveAs(fp);
                    files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
                };
                page2.on('download', handler);
                await page2.click('#generateBtn');
                setTimeout(() => { page2.removeListener('download', handler); resolve(files); }, 20000);
            });
            
            const dl2 = await dl2Promise;
            dl2.length > 0 ? pass('按列拆分下载', `下载${dl2.length}个文件`) : fail('按列拆分下载', '无文件');
        } else {
            warn('列选择区域', '未显示');
        }
    } else {
        warn('Sheet列表', '未显示');
    }
    
    await page2.close();
    log('');
    
    // ==================== 3. 按列拆分-竖向 ====================
    log('━━━ 3. 按列拆分-竖向 (split-vertical) ━━━');
    const page3 = await freshPage();
    await uploadAndProceed(page3, 'multi-column.xlsx', 'split-vertical');
    
    const sheetListVisible3 = await page3.locator('#sheetList').isVisible();
    if (sheetListVisible3) {
        const checkboxes3 = page3.locator('#sheetList input[type="checkbox"]');
        for (let i = 0; i < await checkboxes3.count(); i++) {
            if (!await checkboxes3.nth(i).isChecked()) await checkboxes3.nth(i).check();
        }
        await page3.waitForTimeout(300);
        await page3.click('#nextBtn');
        await page3.waitForTimeout(600);
        
        const colListVisible3 = await page3.locator('#columnList').isVisible();
        if (colListVisible3) {
            const colCount3 = await page3.locator('#columnList label').count();
            colCount3 >= 3 ? pass('竖向列选择', `共${colCount3}列`) : fail('竖向列选择', colCount3);
            
            for (let i = 0; i < Math.min(3, colCount3); i++) {
                await page3.locator('#columnList label').nth(i).locator('input[type="checkbox"]').check();
            }
            await page3.waitForTimeout(300);
            pass('选择3列', '成功');
            
            await page3.click('#nextBtn');
            await page3.waitForTimeout(600);
            
            const dl3Promise = new Promise(async (resolve) => {
                const files = [];
                const handler = async (download) => {
                    const fp = path.join(DOWNLOAD_DIR, download.suggestedFilename());
                    await download.saveAs(fp);
                    files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
                };
                page3.on('download', handler);
                await page3.click('#generateBtn');
                setTimeout(() => { page3.removeListener('download', handler); resolve(files); }, 20000);
            });
            
            const dl3 = await dl3Promise;
            dl3.length >= 1 ? pass('竖向拆分下载', `下载${dl3.length}个文件`) : fail('竖向拆分下载', '无文件');
        }
    }
    
    await page3.close();
    log('');
    
    // ==================== 4. 按行数拆分 ====================
    log('━━━ 4. 按行数拆分 (split-rows) ━━━');
    const page4 = await freshPage();
    await uploadAndProceed(page4, 'large-3000rows.xlsx', 'split-rows');
    
    const sheetListVisible4 = await page4.locator('#sheetList').isVisible();
    if (sheetListVisible4) {
        const checkboxes4 = page4.locator('#sheetList input[type="checkbox"]');
        for (let i = 0; i < await checkboxes4.count(); i++) {
            if (!await checkboxes4.nth(i).isChecked()) await checkboxes4.nth(i).check();
        }
        await page4.waitForTimeout(300);
        await page4.click('#nextBtn');
        await page4.waitForTimeout(600);
        
        const perFileInput = await page4.locator('#splitRowsPerFile').isVisible();
        perFileInput ? pass('每文件行数输入框', '可见') : fail('每文件行数输入框', '不可见');
        
        await page4.fill('#splitRowsPerFile', '1000');
        await page4.waitForTimeout(300);
        pass('设置每1000行拆分', '成功');
        
        const headerInput = await page4.locator('#splitRowsHeaderRows').isVisible();
        headerInput ? pass('表头行数输入框', '可见') : fail('表头行数输入框', '不可见');
        
        await page4.click('#nextBtn');
        await page4.waitForTimeout(600);
        
        const dl4Promise = new Promise(async (resolve) => {
            const files = [];
            const handler = async (download) => {
                const fp = path.join(DOWNLOAD_DIR, download.suggestedFilename());
                await download.saveAs(fp);
                files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
            };
            page4.on('download', handler);
            await page4.click('#generateBtn');
            setTimeout(() => { page4.removeListener('download', handler); resolve(files); }, 25000);
        });
        
        const dl4 = await dl4Promise;
        dl4.length >= 2 ? pass('按行数拆分下载', `下载${dl4.length}个文件`) : fail('按行数拆分下载', `仅${dl4.length}个文件`);
    }
    
    await page4.close();
    log('');
    
    // ==================== 5. 文件合并 ====================
    log('━━━ 5. 文件合并 (merge-file) ━━━');
    const page5 = await freshPage();
    await selectMode(page5, 'merge-file');
    
    const fileInput5 = page5.locator('#fileInput');
    await fileInput5.setInputFiles([
        path.join(DATA_DIR, 'simple-merge-a.xlsx'),
        path.join(DATA_DIR, 'simple-merge-b.xlsx')
    ]);
    await page5.waitForTimeout(4000);
    
    const fileProcessed5 = await page5.evaluate(() => uploadedFiles && uploadedFiles.length > 0);
    fileProcessed5 ? pass('文件上传', '成功上传2个文件') : fail('文件上传', '未检测到文件');
    
    // 检查预览按钮
    const previewBtns5 = await page5.locator('button:has-text("预览")').count();
    previewBtns5 >= 2 ? pass('预览按钮', `共${previewBtns5}个`) : warn('预览按钮', `${previewBtns5}个`);
    
    await page5.click('#nextBtn');
    await page5.waitForTimeout(600);
    
    const dl5Promise = new Promise(async (resolve) => {
        const files = [];
        const handler = async (download) => {
            const fp = path.join(DOWNLOAD_DIR, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        };
        page5.on('download', handler);
        await page5.click('#generateBtn');
        setTimeout(() => { page5.removeListener('download', handler); resolve(files); }, 20000);
    });
    
    const dl5 = await dl5Promise;
    dl5.length >= 1 ? pass('文件合并下载', `下载${dl5.length}个文件`) : fail('文件合并下载', '无文件');
    
    await page5.close();
    log('');
    
    // ==================== 6. 工作表数据合并 ====================
    log('━━━ 6. 工作表数据合并 (merge-sheet) ━━━');
    const page6 = await freshPage();
    await selectMode(page6, 'merge-sheet');
    
    const fileInput6 = page6.locator('#fileInput');
    await fileInput6.setInputFiles([
        path.join(DATA_DIR, 'simple-merge-a.xlsx'),
        path.join(DATA_DIR, 'simple-merge-b.xlsx')
    ]);
    await page6.waitForTimeout(4000);
    
    await page6.click('#nextBtn');
    await page6.waitForTimeout(600);
    
    const strictExists = await page6.locator('input[name="mergeStrategy"][value="strict"]').count();
    const smartExists = await page6.locator('input[name="mergeStrategy"][value="smart"]').count();
    (strictExists > 0 && smartExists > 0) ? pass('合并策略选项', '严格/智能均有') : fail('合并策略选项', '缺失');
    
    const sourceColExists = await page6.locator('#addSourceColumn').count();
    sourceColExists > 0 ? pass('来源文件列选项', '存在') : fail('来源文件列选项', '不存在');
    
    const sortColExists = await page6.locator('#sortColumn').count();
    sortColExists > 0 ? pass('排序列选项', '存在') : fail('排序列选项', '不存在');
    
    const maxRowsExists = await page6.locator('#mergeSheetMaxRows').count();
    maxRowsExists > 0 ? pass('最大行数输入', '存在') : warn('最大行数输入', '不存在');
    
    await page6.click('#nextBtn');
    await page6.waitForTimeout(600);
    
    const dl6Promise = new Promise(async (resolve) => {
        const files = [];
        const handler = async (download) => {
            const fp = path.join(DOWNLOAD_DIR, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        };
        page6.on('download', handler);
        await page6.click('#generateBtn');
        setTimeout(() => { page6.removeListener('download', handler); resolve(files); }, 20000);
    });
    
    const dl6 = await dl6Promise;
    dl6.length >= 1 ? pass('数据合并下载', `下载${dl6.length}个文件`) : fail('数据合并下载', '无文件');
    
    await page6.close();
    log('');
    
    // ==================== 7. 智能合并大师 ====================
    log('━━━ 7. 智能合并大师 (smart-merge) ━━━');
    const page7 = await freshPage();
    await selectMode(page7, 'smart-merge');
    
    const fileInput7 = page7.locator('#fileInput');
    await fileInput7.setInputFiles([
        path.join(DATA_DIR, 'simple-merge-a.xlsx'),
        path.join(DATA_DIR, 'simple-merge-b.xlsx')
    ]);
    await page7.waitForTimeout(4000);
    
    await page7.click('#nextBtn');
    await page7.waitForTimeout(600);
    
    const modeAExists = await page7.locator('input[name="smartMergeMode"][value="modeA"]').count();
    const modeBExists = await page7.locator('input[name="smartMergeMode"][value="modeB"]').count();
    (modeAExists > 0 && modeBExists > 0) ? pass('合并模式选项', '模式A/模式B均有') : fail('合并模式选项', '缺失');
    
    const styleWarning = await page7.locator('text=模式A仅保留第一个文件的单元格样式').count();
    styleWarning > 0 ? pass('模式A样式警告', '显示') : warn('模式A样式警告', '未找到');
    
    const dedupExists = await page7.locator('#smartMergeRemoveDuplicates').count();
    dedupExists > 0 ? pass('去重选项', '存在') : fail('去重选项', '不存在');
    
    await page7.click('#nextBtn');
    await page7.waitForTimeout(600);
    
    const dl7Promise = new Promise(async (resolve) => {
        const files = [];
        const handler = async (download) => {
            const fp = path.join(DOWNLOAD_DIR, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        };
        page7.on('download', handler);
        await page7.click('#generateBtn');
        setTimeout(() => { page7.removeListener('download', handler); resolve(files); }, 20000);
    });
    
    const dl7 = await dl7Promise;
    dl7.length >= 1 ? pass('智能合并下载', `下载${dl7.length}个文件`) : fail('智能合并下载', '无文件');
    
    await page7.close();
    log('');
    
    // ==================== 8. 合并计算 ====================
    log('━━━ 8. 合并计算 (summary-merge) ━━━');
    const page8 = await freshPage();
    await uploadAndProceed(page8, 'simple-merge-a.xlsx', 'summary-merge');
    
    const sheetListVisible8 = await page8.locator('#sheetList').isVisible();
    if (sheetListVisible8) {
        const checkboxes8 = page8.locator('#sheetList input[type="checkbox"]');
        for (let i = 0; i < await checkboxes8.count(); i++) {
            if (!await checkboxes8.nth(i).isChecked()) await checkboxes8.nth(i).check();
        }
        await page8.waitForTimeout(300);
        await page8.click('#nextBtn');
        await page8.waitForTimeout(600);
        
        const calcTypeExists = await page8.locator('#summaryCalcType').count();
        calcTypeExists > 0 ? pass('计算类型下拉', '存在') : fail('计算类型下拉', '不存在');
        
        const keyColExists = await page8.locator('#summaryKeyColumn').count();
        keyColExists > 0 ? pass('关键列下拉', '存在') : fail('关键列下拉', '不存在');
        
        await page8.click('#nextBtn');
        await page8.waitForTimeout(600);
        
        const dl8Promise = new Promise(async (resolve) => {
            const files = [];
            const handler = async (download) => {
                const fp = path.join(DOWNLOAD_DIR, download.suggestedFilename());
                await download.saveAs(fp);
                files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
            };
            page8.on('download', handler);
            await page8.click('#generateBtn');
            setTimeout(() => { page8.removeListener('download', handler); resolve(files); }, 20000);
        });
        
        const dl8 = await dl8Promise;
        dl8.length >= 1 ? pass('合并计算下载', `下载${dl8.length}个文件`) : fail('合并计算下载', '无文件');
    }
    
    await page8.close();
    log('');
    
    // ==================== 9. 数据匹配 ====================
    log('━━━ 9. 数据匹配 (data-join) ━━━');
    const page9 = await freshPage();
    await selectMode(page9, 'data-join');
    
    const fileInput9 = page9.locator('#fileInput');
    await fileInput9.setInputFiles([
        path.join(DATA_DIR, 'simple-merge-a.xlsx'),
        path.join(DATA_DIR, 'simple-merge-b.xlsx')
    ]);
    await page9.waitForTimeout(4000);
    
    await page9.click('#nextBtn');
    await page9.waitForTimeout(600);
    
    const joinTypeCount = await page9.locator('input[name="joinType"]').count();
    joinTypeCount === 3 ? pass('连接类型', '内/左/右连接均有') : fail('连接类型', joinTypeCount);
    
    const sameColWarning = await page9.locator('text=同名列仅保留左表值').count();
    sameColWarning > 0 ? pass('同名列警告', '显示') : warn('同名列警告', '未找到');
    
    const leftKeyExists = await page9.locator('#joinLeftKeyColumn').count();
    const rightKeyExists = await page9.locator('#joinRightKeyColumn').count();
    (leftKeyExists > 0 && rightKeyExists > 0) ? pass('关键列选择', '左/右表均有') : fail('关键列选择', '缺失');
    
    await page9.click('#nextBtn');
    await page9.waitForTimeout(600);
    
    const dl9Promise = new Promise(async (resolve) => {
        const files = [];
        const handler = async (download) => {
            const fp = path.join(DOWNLOAD_DIR, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        };
        page9.on('download', handler);
        await page9.click('#generateBtn');
        setTimeout(() => { page9.removeListener('download', handler); resolve(files); }, 20000);
    });
    
    const dl9 = await dl9Promise;
    dl9.length >= 1 ? pass('数据匹配下载', `下载${dl9.length}个文件`) : fail('数据匹配下载', '无文件');
    
    await page9.close();
    log('');
    
    // ==================== 10. 全局功能测试 ====================
    log('━━━ 10. 全局功能测试 ━━━');
    
    // 10.1 处理模式切换
    log('  🔄 测试处理模式切换...');
    const page10a = await freshPage();
    await uploadAndProceed(page10a, 'basic-3sheets.xlsx', 'split-sheet');
    
    const sheetList10a = await page10a.locator('#sheetList').isVisible();
    if (sheetList10a) {
        const cb10a = page10a.locator('#sheetList input[type="checkbox"]');
        for (let i = 0; i < await cb10a.count(); i++) {
            if (!await cb10a.nth(i).isChecked()) await cb10a.nth(i).check();
        }
        await page10a.waitForTimeout(300);
        await page10a.click('#nextBtn');
        await page10a.waitForTimeout(600);
        
        await page10a.click('input[name="processMode"][value="data"]');
        await page10a.waitForTimeout(300);
        const dataChecked = await page10a.locator('input[name="processMode"][value="data"]').isChecked();
        dataChecked ? pass('切换到仅数据模式', '成功') : fail('切换到仅数据模式', '失败');
        
        await page10a.click('input[name="processMode"][value="preserve"]');
        await page10a.waitForTimeout(300);
        const preserveChecked = await page10a.locator('input[name="processMode"][value="preserve"]').isChecked();
        preserveChecked ? pass('切换回保留格式模式', '成功') : fail('切换回保留格式模式', '失败');
    }
    await page10a.close();
    
    // 10.2 输出格式切换
    log('  📦 测试输出格式切换...');
    const page10b = await freshPage();
    await uploadAndProceed(page10b, 'basic-3sheets.xlsx', 'split-sheet');
    
    const sheetList10b = await page10b.locator('#sheetList').isVisible();
    if (sheetList10b) {
        const cb10b = page10b.locator('#sheetList input[type="checkbox"]');
        for (let i = 0; i < await cb10b.count(); i++) {
            if (!await cb10b.nth(i).isChecked()) await cb10b.nth(i).check();
        }
        await page10b.waitForTimeout(300);
        await page10b.click('#nextBtn');
        await page10b.waitForTimeout(600);
        
        await page10b.click('input[name="outputFormat"][value="single"]');
        await page10b.waitForTimeout(300);
        const singleChecked = await page10b.locator('input[name="outputFormat"][value="single"]').isChecked();
        singleChecked ? pass('输出格式-单文件', '切换成功') : fail('输出格式-单文件', '切换失败');
        
        await page10b.click('input[name="outputFormat"][value="zip"]');
        await page10b.waitForTimeout(300);
        const zipChecked = await page10b.locator('input[name="outputFormat"][value="zip"]').isChecked();
        zipChecked ? pass('输出格式-ZIP', '切换成功') : fail('输出格式-ZIP', '切换失败');
    }
    await page10b.close();
    
    // 10.3 步骤导航
    log('  🧭 测试步骤导航...');
    const page10c = await freshPage();
    await uploadAndProceed(page10c, 'basic-3sheets.xlsx', 'split-sheet');
    
    const sheetList10c = await page10c.locator('#sheetList').isVisible();
    if (sheetList10c) {
        const cb10c = page10c.locator('#sheetList input[type="checkbox"]');
        for (let i = 0; i < await cb10c.count(); i++) {
            if (!await cb10c.nth(i).isChecked()) await cb10c.nth(i).check();
        }
        await page10c.waitForTimeout(300);
        
        await page10c.click('#nextBtn');
        await page10c.waitForTimeout(600);
        const afterNext = await page10c.locator('.step').nth(1).evaluate(el => el.classList.contains('active'));
        afterNext ? pass('下一步导航', '成功') : fail('下一步导航', '失败');
        
        await page10c.click('#prevBtn');
        await page10c.waitForTimeout(600);
        const afterPrev = await page10c.locator('.step').first().evaluate(el => el.classList.contains('active'));
        afterPrev ? pass('上一步导航', '成功') : fail('上一步导航', '失败');
    }
    await page10c.close();
    
    // 10.4 清空功能
    log('  🗑️ 测试清空功能...');
    const page10d = await freshPage();
    await selectMode(page10d, 'split-sheet');
    await page10d.locator('#fileInput').setInputFiles(path.join(DATA_DIR, 'basic-3sheets.xlsx'));
    await page10d.waitForTimeout(3000);
    
    const resetBtn = page10d.locator('button:has-text("清空"), button:has-text("重置")');
    if (await resetBtn.count() > 0) {
        await resetBtn.first().click();
        await page10d.waitForTimeout(800);
        const sheetListAfter = await page10d.locator('#sheetList').isVisible();
        !sheetListAfter ? pass('清空功能', 'Sheet列表已清空') : warn('清空功能', 'Sheet列表仍显示');
    } else {
        warn('清空功能', '未找到清空按钮');
    }
    await page10d.close();
    
    log('');
    
    // ==================== 11. 错误处理测试 ====================
    log('━━━ 11. 错误处理测试 ━━━');
    
    log('  📄 测试上传非Excel文件...');
    const page11a = await freshPage();
    await selectMode(page11a, 'split-sheet');
    
    const fakeFilePath = path.join(DOWNLOAD_DIR, 'fake.txt');
    fs.writeFileSync(fakeFilePath, 'This is not an Excel file');
    
    await page11a.locator('#fileInput').setInputFiles(fakeFilePath);
    await page11a.waitForTimeout(2000);
    
    const errorToast = await page11a.locator('.toast-error, .toast:has-text("错误"), .toast:has-text("格式"), .toast:has-text("不支持")').count();
    errorToast > 0 ? pass('非Excel文件错误提示', '显示错误提示') : warn('非Excel文件错误提示', '未检测到错误提示');
    
    fs.unlinkSync(fakeFilePath);
    await page11a.close();
    
    log('  ⏭️ 测试未选择文件直接下一步...');
    const page11b = await freshPage();
    await selectMode(page11b, 'split-sheet');
    await page11b.click('#nextBtn');
    await page11b.waitForTimeout(500);
    
    const stillStep1 = await page11b.locator('.step').first().evaluate(el => el.classList.contains('active'));
    stillStep1 ? pass('未选择文件阻止', '正确阻止进入下一步') : warn('未选择文件阻止', '未检测到阻止');
    await page11b.close();
    
    log('');
    
    // ==================== 12. 移动端响应式测试 ====================
    log('━━━ 12. 移动端响应式测试 ━━━');
    const page12 = await freshPage();
    
    await page12.setViewportSize({ width: 375, height: 667 });
    await page12.waitForTimeout(500);
    
    const modeSelectorDisplay = await page12.locator('.mode-selector').evaluate(el => {
        return window.getComputedStyle(el).display;
    });
    modeSelectorDisplay === 'grid' ? pass('移动端模式选择器', 'Grid布局') : fail('移动端模式选择器', modeSelectorDisplay);
    
    const mobileModeBtnVisible = await page12.locator('.mode-btn').first().isVisible();
    mobileModeBtnVisible ? pass('移动端模式按钮可见', '是') : fail('移动端模式按钮可见', '否');
    
    const mobileUploadVisible = await page12.locator('#uploadArea').isVisible();
    mobileUploadVisible ? pass('移动端上传区域可见', '是') : fail('移动端上传区域可见', '否');
    
    await page12.setViewportSize({ width: 1400, height: 900 });
    await page12.close();
    
    log('');
    
    // ==================== 13. 可访问性测试 ====================
    log('━━━ 13. 可访问性测试 ━━━');
    const page13 = await freshPage();
    
    const ariaLabels = await page13.locator('[aria-label]').count();
    ariaLabels >= 5 ? pass('aria-label属性', `共${ariaLabels}个`) : warn('aria-label属性', `${ariaLabels}个（偏少）`);
    
    const roles = await page13.locator('[role]').count();
    roles >= 2 ? pass('role属性', `共${roles}个`) : warn('role属性', `${roles}个`);
    
    await page13.close();
    log('');
    
    // ==================== 14. 控制台错误检查 ====================
    log('━━━ 14. 控制台错误检查 ━━━');
    const page14 = await freshPage();
    const consoleErrors = [];
    page14.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    
    await uploadAndProceed(page14, 'basic-3sheets.xlsx', 'split-sheet');
    
    const sheetList14 = await page14.locator('#sheetList').isVisible();
    if (sheetList14) {
        const cb14 = page14.locator('#sheetList input[type="checkbox"]');
        for (let i = 0; i < await cb14.count(); i++) {
            if (!await cb14.nth(i).isChecked()) await cb14.nth(i).check();
        }
        await page14.waitForTimeout(300);
        await page14.click('#nextBtn');
        await page14.waitForTimeout(600);
        await page14.click('#generateBtn');
        await page14.waitForTimeout(10000);
    }
    
    consoleErrors.length === 0 ? pass('控制台错误', '无JS错误') : warn('控制台错误', `${consoleErrors.length}个错误`);
    if (consoleErrors.length > 0) {
        consoleErrors.slice(0, 3).forEach(e => log(`    ❌ ${e.substring(0, 120)}`));
    }
    
    await page14.close();
    
    // ==================== 汇总 ====================
    log('');
    log('╔══════════════════════════════════════════════════════╗');
    log('║                  测试结果汇总                        ║');
    log('╚══════════════════════════════════════════════════════╝');
    log('');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warned = results.filter(r => r.status === 'WARN').length;
    const total = results.length;
    
    log(`  总测试项: ${total}`);
    log(`  ✅ 通过: ${passed}`);
    log(`  ❌ 失败: ${failed}`);
    log(`  ⚠️ 警告: ${warned}`);
    log(`  通过率: ${((passed / total) * 100).toFixed(1)}%`);
    log('');
    
    if (failed > 0) {
        log('  ❌ 失败项:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            log(`    - ${r.test}: ${r.detail}`);
        });
        log('');
    }
    
    if (warned > 0) {
        log('  ⚠️ 警告项:');
        results.filter(r => r.status === 'WARN').forEach(r => {
            log(`    - ${r.test}: ${r.detail}`);
        });
        log('');
    }
    
    // 保存JSON报告
    const report = {
        timestamp: new Date().toISOString(),
        version: 'v1.5.3',
        summary: { total, passed, failed, warned, passRate: `${((passed / total) * 100).toFixed(1)}%` },
        results
    };
    
    fs.writeFileSync(path.join(__dirname, 'human-test-report.json'), JSON.stringify(report, null, 2));
    log('  📄 报告已保存: test/human-test-report.json');
    log('');
    
    await browser.close();
})();

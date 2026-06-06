const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'test-data');
const TIMEOUT = 30000;

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    
    const results = [];
    let currentMode = '';
    
    function log(msg) { console.log(msg); }
    function pass(test, detail) { results.push({ test, status: 'PASS', detail }); log(`  ✅ ${test}: ${detail}`); }
    function fail(test, detail) { results.push({ test, status: 'FAIL', detail }); log(`  ❌ ${test}: ${detail}`); }
    function warn(test, detail) { results.push({ test, status: 'WARN', detail }); log(`  ⚠️ ${test}: ${detail}`); }
    
    // ========== 辅助函数 ==========
    async function gotoHome() {
        await page.goto('http://localhost:3077/excel.html', { waitUntil: 'networkidle', timeout: TIMEOUT });
        await page.waitForTimeout(500);
    }
    
    async function selectMode(mode) {
        await page.click(`[data-mode="${mode}"]`);
        await page.waitForTimeout(500);
        currentMode = mode;
    }
    
    async function uploadFile(filename) {
        const filePath = path.join(DATA_DIR, filename);
        const fileInput = await page.locator('#fileInput');
        await fileInput.setInputFiles(filePath);
        await page.waitForTimeout(2000);
    }
    
    async function uploadFiles(filenames) {
        const filePaths = filenames.map(f => path.join(DATA_DIR, f));
        const fileInput = await page.locator('#fileInput');
        await fileInput.setInputFiles(filePaths);
        await page.waitForTimeout(2000);
    }
    
    async function clickNext() { await page.click('#nextBtn'); await page.waitForTimeout(500); }
    async function clickPrev() { await page.click('#prevBtn'); await page.waitForTimeout(500); }
    async function clickGenerate() { await page.click('#generateBtn'); await page.waitForTimeout(8000); }
    
    async function selectSheet(name) {
        const label = page.locator(`#sheetList label:has-text("${name}")`);
        if (await label.count() > 0) {
            const checkbox = label.locator('input[type="checkbox"]');
            if (!await checkbox.isChecked()) await checkbox.check();
            await page.waitForTimeout(300);
            return true;
        }
        return false;
    }
    
    async function unselectSheet(name) {
        const label = page.locator(`#sheetList label:has-text("${name}")`);
        if (await label.count() > 0) {
            const checkbox = label.locator('input[type="checkbox"]');
            if (await checkbox.isChecked()) await checkbox.uncheck();
            await page.waitForTimeout(300);
        }
    }
    
    async function selectAllSheets() {
        const checkboxes = page.locator('#sheetList input[type="checkbox"]');
        const count = await checkboxes.count();
        for (let i = 0; i < count; i++) {
            if (!await checkboxes.nth(i).isChecked()) await checkboxes.nth(i).check();
        }
        await page.waitForTimeout(300);
    }
    
    async function selectColumn(colName) {
        const label = page.locator(`#columnList label:has-text("${colName}")`);
        if (await label.count() > 0) {
            const checkbox = label.locator('input[type="checkbox"]');
            if (!await checkbox.isChecked()) await checkbox.check();
            await page.waitForTimeout(300);
            return true;
        }
        return false;
    }
    
    async function selectDropdown(id, value) {
        await page.selectOption(`#${id}`, value);
        await page.waitForTimeout(300);
    }
    
    async function setInputValue(id, value) {
        await page.fill(`#${id}`, String(value));
        await page.waitForTimeout(200);
    }
    
    async function getDownloadedFiles() {
        const downloadDir = path.join(__dirname, 'tmp-downloads');
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
        return new Promise(async (resolve) => {
            const files = [];
            page.on('download', async (download) => {
                const fp = path.join(downloadDir, download.suggestedFilename());
                await download.saveAs(fp);
                files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
            });
            await page.waitForTimeout(8000);
            page.removeAllListeners('download');
            resolve(files);
        });
    }
    
    // ========== 拦截下载 ==========
    const downloadDir = path.join(__dirname, 'tmp-downloads');
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
    
    // ========== 开始测试 ==========
    log('');
    log('╔══════════════════════════════════════════════════════╗');
    log('║     Excel 离线工具 v1.5.3 — 拟人化操作测试          ║');
    log('╚══════════════════════════════════════════════════════╝');
    log('');
    
    // ==================== 0. 页面加载 ====================
    log('━━━ 0. 页面加载与初始状态检查 ━━━');
    await gotoHome();
    
    const title = await page.title();
    title.includes('v1.5.3') ? pass('页面标题', title) : fail('页面标题', title);
    
    const version = await page.textContent('.cs-version');
    version.includes('1.5.3') ? pass('版本号', version) : fail('版本号', version);
    
    const modeCount = await page.locator('.mode-btn').count();
    modeCount === 9 ? pass('模式按钮数量', `共${modeCount}个`) : fail('模式按钮数量', `期望9个，实际${modeCount}个`);
    
    const activeMode = await page.locator('.mode-btn.active').getAttribute('data-mode');
    activeMode === 'split-sheet' ? pass('默认模式', 'split-sheet') : fail('默认模式', activeMode);
    
    const stepCount = await page.locator('.step').count();
    stepCount === 4 ? pass('步骤指示器', `共${stepCount}步`) : fail('步骤指示器', stepCount);
    
    const uploadAreaVisible = await page.locator('#uploadArea').isVisible();
    uploadAreaVisible ? pass('上传区域可见', '是') : fail('上传区域可见', '否');
    
    log('');
    
    // ==================== 1. 按工作表拆分 ====================
    log('━━━ 1. 按工作表拆分 (split-sheet) ━━━');
    await gotoHome();
    await selectMode('split-sheet');
    
    // 检查步骤指示器高亮
    const step1Active = await page.locator('.step').first().evaluate(el => el.classList.contains('active'));
    step1Active ? pass('步骤1高亮', '第一步高亮') : fail('步骤1高亮', '未高亮');
    
    // 上传文件
    log('  📤 上传 basic-3sheets.xlsx...');
    await uploadFile('basic-3sheets.xlsx');
    
    // 检查文件列表
    const fileItems = await page.locator('.file-item').count();
    fileItems >= 1 ? pass('文件列表', `显示${fileItems}个文件`) : fail('文件列表', '无文件');
    
    // 检查文件信息（行数、Sheet数）
    const fileInfo = await page.locator('.file-item .file-info').first().textContent();
    fileInfo.includes('行') ? pass('文件行数信息', fileInfo.substring(0, 50)) : warn('文件行数信息', '未显示');
    
    // 检查预览按钮
    const previewBtnCount = await page.locator('.file-item button:has-text("预览")').count();
    previewBtnCount >= 1 ? pass('预览按钮', `共${previewBtnCount}个`) : fail('预览按钮', '未找到');
    
    // 测试文件预览
    log('  👁 测试文件预览...');
    await page.locator('.file-item button:has-text("预览")').first().click();
    await page.waitForTimeout(1000);
    const previewModalVisible = await page.locator('#dataPreviewModal').evaluate(el => {
        return !el.classList.contains('cs-hidden');
    });
    previewModalVisible ? pass('文件预览弹窗', '显示正常') : fail('文件预览弹窗', '未显示');
    
    // 关闭预览
    await page.click('#dataPreviewClose');
    await page.waitForTimeout(500);
    
    // 检查Sheet列表
    const sheetItems = await page.locator('#sheetList label').count();
    sheetItems === 3 ? pass('Sheet列表', `共${sheetItems}个Sheet`) : fail('Sheet列表', `期望3个，实际${sheetItems}个`);
    
    // 检查Sheet名称
    const sheetNames = await page.locator('#sheetList label').allTextContents();
    sheetNames.some(n => n.includes('Sheet1')) ? pass('Sheet名称包含Sheet1', '是') : fail('Sheet名称包含Sheet1', '否');
    
    // 取消选择Sheet1，只保留Sheet2和Sheet3
    log('  ☑️ 取消Sheet1，只拆分Sheet2和Sheet3...');
    await unselectSheet('Sheet1');
    await page.waitForTimeout(300);
    
    // 进入下一步
    await clickNext();
    
    // 检查配置区域
    const step2Active = await page.locator('.step').nth(1).evaluate(el => el.classList.contains('active'));
    step2Active ? pass('步骤2高亮', '第二步高亮') : fail('步骤2高亮', '未高亮');
    
    // 检查处理模式选项
    const preserveRadio = await page.locator('input[name="processMode"][value="preserve"]').isChecked();
    preserveRadio ? pass('默认处理模式', '保留格式') : warn('默认处理模式', '非保留格式');
    
    // 检查输出格式选项
    const outputFormatOptions = await page.locator('input[name="outputFormat"]').count();
    outputFormatOptions >= 2 ? pass('输出格式选项', `共${outputFormatOptions}个`) : fail('输出格式选项', outputFormatOptions);
    
    // 点击生成
    log('  🔨 点击生成...');
    const downloadPromise = new Promise(async (resolve) => {
        const files = [];
        page.on('download', async (download) => {
            const fp = path.join(downloadDir, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        });
        await clickGenerate();
        page.removeAllListeners('download');
        resolve(files);
    });
    
    const downloadFiles = await downloadPromise;
    downloadFiles.length > 0 ? pass('生成下载', `下载${downloadFiles.length}个文件`) : fail('生成下载', '无文件下载');
    
    if (downloadFiles.length > 0) {
        const totalSize = downloadFiles.reduce((s, f) => s + f.size, 0);
        pass('下载文件总大小', `${(totalSize / 1024).toFixed(1)}KB`);
        
        // 检查文件是否为ZIP
        const isZip = downloadFiles[0].name.endsWith('.zip');
        isZip ? pass('输出格式', 'ZIP文件') : fail('输出格式', downloadFiles[0].name);
    }
    
    // 检查结果摘要
    const summaryVisible = await page.locator('#resultSummary').evaluate(el => {
        return el && !el.classList.contains('cs-hidden');
    }).catch(() => false);
    summaryVisible ? pass('结果摘要', '显示') : warn('结果摘要', '未显示或隐藏');
    
    log('');
    
    // ==================== 2. 按列拆分(横向) ====================
    log('━━━ 2. 按列拆分-横向 (split-column) ━━━');
    await gotoHome();
    await selectMode('split-column');
    
    log('  📤 上传 multi-column.xlsx...');
    await uploadFile('multi-column.xlsx');
    
    const sheetList2 = await page.locator('#sheetList label').count();
    sheetList2 >= 1 ? pass('Sheet列表', `共${sheetList2}个`) : fail('Sheet列表', '无');
    
    await selectAllSheets();
    await clickNext();
    
    // 检查列选择区域
    const columnList = await page.locator('#columnList label').count();
    columnList >= 2 ? pass('列选择区域', `共${columnList}列`) : fail('列选择区域', columnList);
    
    // 选择"班级"列
    log('  ☑️ 选择"班级"列进行拆分...');
    const classSelected = await selectColumn('班级');
    classSelected ? pass('选择班级列', '成功') : warn('选择班级列', '未找到班级列，跳过');
    
    if (classSelected) {
        await clickNext();
        
        // 生成
        log('  🔨 点击生成...');
        const dlPromise2 = new Promise(async (resolve) => {
            const files = [];
            page.on('download', async (download) => {
                const fp = path.join(downloadDir, download.suggestedFilename());
                await download.saveAs(fp);
                files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
            });
            await clickGenerate();
            page.removeAllListeners('download');
            resolve(files);
        });
        
        const dl2 = await dlPromise2;
        dl2.length > 0 ? pass('按列拆分下载', `下载${dl2.length}个文件`) : fail('按列拆分下载', '无文件');
    }
    
    log('');
    
    // ==================== 3. 按列拆分(竖向) ====================
    log('━━━ 3. 按列拆分-竖向 (split-vertical) ━━━');
    await gotoHome();
    await selectMode('split-vertical');
    
    log('  📤 上传 multi-column.xlsx...');
    await uploadFile('multi-column.xlsx');
    
    await selectAllSheets();
    await clickNext();
    
    // 检查列选择
    const vertColumns = await page.locator('#columnList label').count();
    vertColumns >= 3 ? pass('竖向列选择', `共${vertColumns}列`) : fail('竖向列选择', vertColumns);
    
    // 选择3列
    log('  ☑️ 选择3列进行竖向拆分...');
    const colLabels = await page.locator('#columnList label').allTextContents();
    for (let i = 0; i < Math.min(3, colLabels.length); i++) {
        await page.locator('#columnList label').nth(i).locator('input[type="checkbox"]').check();
    }
    await page.waitForTimeout(300);
    
    await clickNext();
    
    const dlPromise3 = new Promise(async (resolve) => {
        const files = [];
        page.on('download', async (download) => {
            const fp = path.join(downloadDir, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        });
        await clickGenerate();
        page.removeAllListeners('download');
        resolve(files);
    });
    
    const dl3 = await dlPromise3;
    dl3.length >= 1 ? pass('竖向拆分下载', `下载${dl3.length}个文件`) : fail('竖向拆分下载', '无文件');
    
    log('');
    
    // ==================== 4. 按行数拆分 ====================
    log('━━━ 4. 按行数拆分 (split-rows) ━━━');
    await gotoHome();
    await selectMode('split-rows');
    
    log('  📤 上传 large-3000rows.xlsx...');
    await uploadFile('large-3000rows.xlsx');
    
    await selectAllSheets();
    await clickNext();
    
    // 检查每文件行数输入框
    const perFileInput = await page.locator('#splitRowsPerFile').isVisible();
    perFileInput ? pass('每文件行数输入框', '可见') : fail('每文件行数输入框', '不可见');
    
    // 设置每1000行拆分
    log('  📝 设置每1000行拆分...');
    await setInputValue('splitRowsPerFile', 1000);
    
    // 检查表头行数
    const headerInput = await page.locator('#splitRowsHeaderRows').isVisible();
    headerInput ? pass('表头行数输入框', '可见') : fail('表头行数输入框', '不可见');
    
    await clickNext();
    
    const dlPromise4 = new Promise(async (resolve) => {
        const files = [];
        page.on('download', async (download) => {
            const fp = path.join(downloadDir, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        });
        await clickGenerate();
        page.removeAllListeners('download');
        resolve(files);
    });
    
    const dl4 = await dlPromise4;
    dl4.length >= 2 ? pass('按行数拆分下载', `下载${dl4.length}个文件（3000行÷1000=3）`) : fail('按行数拆分下载', `仅${dl4.length}个文件`);
    
    log('');
    
    // ==================== 5. 文件合并 ====================
    log('━━━ 5. 文件合并 (merge-file) ━━━');
    await gotoHome();
    await selectMode('merge-file');
    
    log('  📤 上传 simple-merge-a.xlsx 和 simple-merge-b.xlsx...');
    await uploadFiles(['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    
    const mergeFileCount = await page.locator('.file-item').count();
    mergeFileCount === 2 ? pass('文件列表', `共${mergeFileCount}个文件`) : fail('文件列表', mergeFileCount);
    
    // 检查文件预览按钮
    const mergePreviewBtns = await page.locator('.file-item button:has-text("预览")').count();
    mergePreviewBtns === 2 ? pass('预览按钮数量', `共${mergePreviewBtns}个`) : fail('预览按钮数量', mergePreviewBtns);
    
    await clickNext();
    
    const dlPromise5 = new Promise(async (resolve) => {
        const files = [];
        page.on('download', async (download) => {
            const fp = path.join(downloadDir, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        });
        await clickGenerate();
        page.removeAllListeners('download');
        resolve(files);
    });
    
    const dl5 = await dlPromise5;
    dl5.length === 1 ? pass('文件合并下载', `下载${dl5.length}个文件`) : fail('文件合并下载', dl5.length);
    
    log('');
    
    // ==================== 6. 工作表数据合并 ====================
    log('━━━ 6. 工作表数据合并 (merge-sheet) ━━━');
    await gotoHome();
    await selectMode('merge-sheet');
    
    log('  📤 上传 simple-merge-a.xlsx 和 simple-merge-b.xlsx...');
    await uploadFiles(['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    
    await clickNext();
    
    // 检查合并策略选项
    const strictRadio = await page.locator('input[name="mergeStrategy"][value="strict"]').count();
    const smartRadio = await page.locator('input[name="mergeStrategy"][value="smart"]').count();
    (strictRadio > 0 && smartRadio > 0) ? pass('合并策略选项', '严格/智能均有') : fail('合并策略选项', '缺失');
    
    // 检查来源文件列选项
    const sourceColCheck = await page.locator('#addSourceColumn').count();
    sourceColCheck > 0 ? pass('来源文件列选项', '存在') : fail('来源文件列选项', '不存在');
    
    // 检查排序选项
    const sortColSelect = await page.locator('#sortColumn').count();
    sortColSelect > 0 ? pass('排序列选项', '存在') : fail('排序列选项', '不存在');
    
    // 检查最大行数
    const maxRowsInput = await page.locator('#mergeSheetMaxRows').isVisible();
    maxRowsInput ? pass('最大行数输入', '可见') : warn('最大行数输入', '不可见');
    
    await clickNext();
    
    const dlPromise6 = new Promise(async (resolve) => {
        const files = [];
        page.on('download', async (download) => {
            const fp = path.join(downloadDir, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        });
        await clickGenerate();
        page.removeAllListeners('download');
        resolve(files);
    });
    
    const dl6 = await dlPromise6;
    dl6.length === 1 ? pass('数据合并下载', `下载${dl6.length}个文件`) : fail('数据合并下载', dl6.length);
    
    log('');
    
    // ==================== 7. 智能合并大师 ====================
    log('━━━ 7. 智能合并大师 (smart-merge) ━━━');
    await gotoHome();
    await selectMode('smart-merge');
    
    log('  📤 上传 simple-merge-a.xlsx 和 simple-merge-b.xlsx...');
    await uploadFiles(['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    
    await clickNext();
    
    // 检查合并模式（模式A/模式B）
    const modeARadio = await page.locator('input[name="smartMergeMode"][value="modeA"]').count();
    const modeBRadio = await page.locator('input[name="smartMergeMode"][value="modeB"]').count();
    (modeARadio > 0 && modeBRadio > 0) ? pass('合并模式选项', '模式A/模式B均有') : fail('合并模式选项', '缺失');
    
    // 检查模式A样式警告
    const styleWarning = await page.locator('.cs-warning:has-text("模式A仅保留第一个文件的单元格样式")').count();
    styleWarning > 0 ? pass('模式A样式警告', '显示') : warn('模式A样式警告', '未找到');
    
    // 检查去重选项
    const dedupCheck = await page.locator('#smartMergeRemoveDuplicates').count();
    dedupCheck > 0 ? pass('去重选项', '存在') : fail('去重选项', '不存在');
    
    // 检查表头行数
    const headerRowsInput = await page.locator('#headerRows').isVisible();
    headerRowsInput ? pass('表头行数输入', '可见') : fail('表头行数输入', '不可见');
    
    await clickNext();
    
    const dlPromise7 = new Promise(async (resolve) => {
        const files = [];
        page.on('download', async (download) => {
            const fp = path.join(downloadDir, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        });
        await clickGenerate();
        page.removeAllListeners('download');
        resolve(files);
    });
    
    const dl7 = await dlPromise7;
    dl7.length === 1 ? pass('智能合并下载', `下载${dl7.length}个文件`) : fail('智能合并下载', dl7.length);
    
    log('');
    
    // ==================== 8. 合并计算 ====================
    log('━━━ 8. 合并计算 (summary-merge) ━━━');
    await gotoHome();
    await selectMode('summary-merge');
    
    log('  📤 上传 simple-merge-a.xlsx...');
    await uploadFile('simple-merge-a.xlsx');
    
    await selectAllSheets();
    await clickNext();
    
    // 检查计算类型
    const calcTypeSelect = await page.locator('#summaryCalcType').count();
    calcTypeSelect > 0 ? pass('计算类型下拉', '存在') : fail('计算类型下拉', '不存在');
    
    // 检查关键列
    const keyColSelect = await page.locator('#summaryKeyColumn').count();
    keyColSelect > 0 ? pass('关键列下拉', '存在') : fail('关键列下拉', '不存在');
    
    // 检查最大行数
    const summaryMaxRows = await page.locator('#summaryMaxRows').isVisible();
    summaryMaxRows ? pass('最大行数输入', '可见') : warn('最大行数输入', '不可见');
    
    await clickNext();
    
    const dlPromise8 = new Promise(async (resolve) => {
        const files = [];
        page.on('download', async (download) => {
            const fp = path.join(downloadDir, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        });
        await clickGenerate();
        page.removeAllListeners('download');
        resolve(files);
    });
    
    const dl8 = await dlPromise8;
    dl8.length >= 1 ? pass('合并计算下载', `下载${dl8.length}个文件`) : fail('合并计算下载', '无文件');
    
    log('');
    
    // ==================== 9. 数据匹配 ====================
    log('━━━ 9. 数据匹配 (data-join) ━━━');
    await gotoHome();
    await selectMode('data-join');
    
    log('  📤 上传 simple-merge-a.xlsx 和 simple-merge-b.xlsx...');
    await uploadFiles(['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    
    await clickNext();
    
    // 检查连接类型
    const joinTypeRadios = await page.locator('input[name="joinType"]').count();
    joinTypeRadios === 3 ? pass('连接类型', '内/左/右连接均有') : fail('连接类型', joinTypeRadios);
    
    // 检查同名列警告
    const sameColWarning = await page.locator('.cs-form-hint:has-text("同名列仅保留左表值")').count();
    sameColWarning > 0 ? pass('同名列警告', '显示') : warn('同名列警告', '未找到');
    
    // 检查左表/右表关键列选择
    const leftKeyCol = await page.locator('#joinLeftKeyColumn').count();
    const rightKeyCol = await page.locator('#joinRightKeyColumn').count();
    (leftKeyCol > 0 && rightKeyCol > 0) ? pass('关键列选择', '左/右表均有') : fail('关键列选择', '缺失');
    
    await clickNext();
    
    const dlPromise9 = new Promise(async (resolve) => {
        const files = [];
        page.on('download', async (download) => {
            const fp = path.join(downloadDir, download.suggestedFilename());
            await download.saveAs(fp);
            files.push({ name: download.suggestedFilename(), path: fp, size: fs.statSync(fp).size });
        });
        await clickGenerate();
        page.removeAllListeners('download');
        resolve(files);
    });
    
    const dl9 = await dlPromise9;
    dl9.length >= 1 ? pass('数据匹配下载', `下载${dl9.length}个文件`) : fail('数据匹配下载', '无文件');
    
    log('');
    
    // ==================== 10. 全局功能测试 ====================
    log('━━━ 10. 全局功能测试 ━━━');
    
    // 10.1 处理模式切换
    log('  🔄 测试处理模式切换...');
    await gotoHome();
    await selectMode('split-sheet');
    await uploadFile('basic-3sheets.xlsx');
    await selectAllSheets();
    await clickNext();
    
    // 切换到仅数据模式
    await page.click('input[name="processMode"][value="data"]');
    await page.waitForTimeout(300);
    const dataModeChecked = await page.locator('input[name="processMode"][value="data"]').isChecked();
    dataModeChecked ? pass('处理模式切换', '切换到仅数据模式成功') : fail('处理模式切换', '切换失败');
    
    // 切换回保留格式模式
    await page.click('input[name="processMode"][value="preserve"]');
    await page.waitForTimeout(300);
    const preserveChecked = await page.locator('input[name="processMode"][value="preserve"]').isChecked();
    preserveChecked ? pass('处理模式切换回', '切换回保留格式模式成功') : fail('处理模式切换回', '切换失败');
    
    // 10.2 输出格式切换
    log('  📦 测试输出格式切换...');
    const outputSingle = await page.locator('input[name="outputFormat"][value="single"]');
    const outputZip = await page.locator('input[name="outputFormat"][value="zip"]');
    
    if (await outputSingle.count() > 0 && await outputZip.count() > 0) {
        await outputSingle.click();
        await page.waitForTimeout(300);
        const singleChecked = await outputSingle.isChecked();
        singleChecked ? pass('输出格式-单文件', '切换成功') : fail('输出格式-单文件', '切换失败');
        
        await outputZip.click();
        await page.waitForTimeout(300);
        const zipChecked = await outputZip.isChecked();
        zipChecked ? pass('输出格式-ZIP', '切换成功') : fail('输出格式-ZIP', '切换失败');
    } else {
        warn('输出格式切换', '未找到选项');
    }
    
    // 10.3 步骤导航
    log('  🧭 测试步骤导航...');
    await gotoHome();
    await selectMode('split-sheet');
    await uploadFile('basic-3sheets.xlsx');
    
    // 点击下一步
    await clickNext();
    const afterNext = await page.locator('.step').nth(1).evaluate(el => el.classList.contains('active'));
    afterNext ? pass('下一步导航', '成功') : fail('下一步导航', '失败');
    
    // 点击上一步
    await clickPrev();
    const afterPrev = await page.locator('.step').first().evaluate(el => el.classList.contains('active'));
    afterPrev ? pass('上一步导航', '成功') : fail('上一步导航', '失败');
    
    // 10.4 清空功能
    log('  🗑️ 测试清空功能...');
    const resetBtn = page.locator('button:has-text("清空")');
    if (await resetBtn.count() > 0) {
        await resetBtn.first().click();
        await page.waitForTimeout(500);
        const fileItemsAfterReset = await page.locator('.file-item').count();
        fileItemsAfterReset === 0 ? pass('清空功能', '文件已清空') : fail('清空功能', `仍有${fileItemsAfterReset}个文件`);
    } else {
        warn('清空功能', '未找到清空按钮');
    }
    
    log('');
    
    // ==================== 11. 错误处理测试 ====================
    log('━━━ 11. 错误处理测试 ━━━');
    
    // 11.1 上传非Excel文件
    log('  📄 测试上传非Excel文件...');
    await gotoHome();
    await selectMode('split-sheet');
    
    // 创建一个假的文本文件
    const fakeFilePath = path.join(downloadDir, 'fake.txt');
    fs.writeFileSync(fakeFilePath, 'This is not an Excel file');
    
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(fakeFilePath);
    await page.waitForTimeout(2000);
    
    // 检查是否有错误提示（toast或错误消息）
    const errorToast = await page.locator('.toast-error, .toast:has-text("错误"), .toast:has-text("格式")').count();
    const hasError = errorToast > 0;
    hasError ? pass('非Excel文件错误提示', '显示错误提示') : warn('非Excel文件错误提示', '未检测到错误提示');
    
    // 11.2 未选择文件直接下一步
    log('  ⏭️ 测试未选择文件直接下一步...');
    await gotoHome();
    await selectMode('split-sheet');
    await clickNext();
    await page.waitForTimeout(500);
    
    // 应该停留在步骤1
    const stillStep1 = await page.locator('.step').first().evaluate(el => el.classList.contains('active'));
    stillStep1 ? pass('未选择文件阻止', '正确阻止进入下一步') : warn('未选择文件阻止', '未检测到阻止');
    
    // 清理
    fs.unlinkSync(fakeFilePath);
    
    log('');
    
    // ==================== 12. 移动端响应式测试 ====================
    log('━━━ 12. 移动端响应式测试 ━━━');
    await gotoHome();
    
    // 切换到移动端视图
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // 检查模式选择器布局
    const modeSelectorDisplay = await page.locator('.mode-selector').evaluate(el => {
        return window.getComputedStyle(el).display;
    });
    modeSelectorDisplay === 'grid' ? pass('移动端模式选择器', 'Grid布局') : fail('移动端模式选择器', modeSelectorDisplay);
    
    // 检查按钮是否可见
    const mobileModeBtnVisible = await page.locator('.mode-btn').first().isVisible();
    mobileModeBtnVisible ? pass('移动端模式按钮可见', '是') : fail('移动端模式按钮可见', '否');
    
    // 检查上传区域
    const mobileUploadVisible = await page.locator('#uploadArea').isVisible();
    mobileUploadVisible ? pass('移动端上传区域可见', '是') : fail('移动端上传区域可见', '否');
    
    // 恢复桌面视图
    await page.setViewportSize({ width: 1400, height: 900 });
    
    log('');
    
    // ==================== 13. 可访问性测试 ====================
    log('━━━ 13. 可访问性测试 ━━━');
    await gotoHome();
    
    // 检查aria-label
    const ariaLabels = await page.locator('[aria-label]').count();
    ariaLabels >= 5 ? pass('aria-label属性', `共${ariaLabels}个`) : warn('aria-label属性', `${ariaLabels}个（偏少）`);
    
    // 检查role属性
    const roles = await page.locator('[role]').count();
    roles >= 2 ? pass('role属性', `共${roles}个`) : warn('role属性', `${roles}个`);
    
    // 检查按钮可聚焦
    const firstBtn = page.locator('.mode-btn').first();
    await firstBtn.focus();
    const isFocused = await firstBtn.evaluate(el => document.activeElement === el);
    isFocused ? pass('按钮可聚焦', '是') : warn('按钮可聚焦', '否');
    
    log('');
    
    // ==================== 14. 控制台错误检查 ====================
    log('━━━ 14. 控制台错误检查 ━━━');
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    
    await gotoHome();
    await selectMode('split-sheet');
    await uploadFile('basic-3sheets.xlsx');
    await selectAllSheets();
    await clickNext();
    await clickGenerate();
    await page.waitForTimeout(5000);
    
    consoleErrors.length === 0 ? pass('控制台错误', '无JS错误') : warn('控制台错误', `${consoleErrors.length}个错误`);
    if (consoleErrors.length > 0) {
        consoleErrors.slice(0, 3).forEach(e => log(`    ❌ ${e.substring(0, 100)}`));
    }
    
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

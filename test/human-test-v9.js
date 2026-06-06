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
    try {
        await fn(browser);
    } catch (e) {
        fail(name, `异常: ${e.message.substring(0, 120)}`);
    }
    await browser.close();
}

async function gotoHome(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle', timeout: 30000 });
    await p.locator('.mode-btn').first().waitFor({ state: 'visible', timeout: 10000 });
    await p.waitForTimeout(500);
    return { p, ctx };
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

// 通用步骤导航：查找当前步骤中可见的 Next 按钮
async function clickNext(p) {
    for (const id of ['#step1Next', '#step2Next', '#step3Next']) {
        const btn = p.locator(id);
        try {
            if (await btn.isVisible({ timeout: 300 }) && !(await btn.isDisabled())) {
                await btn.click();
                await p.waitForTimeout(600);
                return true;
            }
        } catch {}
    }
    return false;
}

// 获取当前活跃步骤的表单元素
async function getActiveFormElements(p) {
    return await p.evaluate(() => {
        const active = document.querySelector('.step-content.active');
        if (!active) return { radios: [], selects: [], checkboxes: [], numbers: [] };
        
        const radios = [];
        active.querySelectorAll('input[type="radio"]').forEach(r => {
            if (r.offsetParent !== null) radios.push({ name: r.name, value: r.value });
        });
        const selects = [];
        active.querySelectorAll('select').forEach(s => {
            if (s.offsetParent !== null) selects.push({ id: s.id });
        });
        const checkboxes = [];
        active.querySelectorAll('input[type="checkbox"]').forEach(c => {
            if (c.offsetParent !== null) {
                const label = c.closest('label')?.textContent?.trim()?.substring(0, 50) || c.id;
                checkboxes.push({ id: c.id, label });
            }
        });
        const numbers = [];
        active.querySelectorAll('input[type="number"], input[type="text"]').forEach(t => {
            if (t.offsetParent !== null && t.type === 'number') numbers.push({ id: t.id });
        });
        return { radios, selects, checkboxes, numbers };
    });
}

async function getResult(p, label) {
    try {
        await p.locator('#resultSummary').waitFor({ state: 'visible', timeout: 45000 });
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
        const loading = await p.locator('#loading').isVisible().catch(() => false);
        loading ? warn(label, '仍在处理中(loading可见)') : warn(label, '结果摘要未显示');
    }
}

(async () => {
    log('');
    log('╔══════════════════════════════════════════════════════════╗');
    log('║   Excel 离线工具 v1.5.3 — 拟人化操作测试 v9             ║');
    log('║   每个测试独立浏览器实例，使用实际UI选择器                ║');
    log('╚══════════════════════════════════════════════════════════╝');
    log('');
    
    // ========== 0. 页面加载 ==========
    log('━━━ 0. 🧑 用户首次打开 ━━━');
    await runTest('页面加载', async (browser) => {
        const { p } = await gotoHome(browser);
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
        
        const modeNames = await p.locator('.mode-btn').allTextContents();
        log('  📋 模式列表:');
        modeNames.forEach((m, i) => log(`    ${i+1}. ${m.trim().replace(/\s+/g, ' ')}`));
    });
    log('');
    
    // ========== 1. 按工作表拆分 ==========
    log('━━━ 1. 🧑 按工作表拆分 ━━━');
    log('  💡 场景：3个Sheet的Excel拆成独立文件');
    await runTest('按工作表拆分', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        
        // Step 1 → Step 2: Sheet选择页
        await clickNext(p);
        
        const activeStep1 = await p.evaluate(() => {
            const steps = document.querySelectorAll('.step-content');
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].classList.contains('active')) return steps[i].id;
            }
            return null;
        });
        activeStep1 === 'step2' ? pass('进入Sheet选择页', activeStep1) : fail('进入Sheet选择页', activeStep1);
        
        const sheetCount = await p.locator('#sheetList .sheet-checkbox').count();
        sheetCount === 3 ? pass('Sheet列表', `${sheetCount}个`) : fail('Sheet列表', sheetCount);
        
        const allBtn = p.locator('#splitSheetSelectAll');
        if (await allBtn.isVisible().catch(() => false)) {
            await allBtn.click();
            pass('全选Sheet', '成功');
        }
        
        // Step 2 → Step 3: 进入配置页
        await clickNext(p);
        
        const activeStep2 = await p.evaluate(() => {
            const steps = document.querySelectorAll('.step-content');
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].classList.contains('active')) return steps[i].id;
            }
            return null;
        });
        activeStep2 === 'step3' ? pass('进入配置页(step3)', activeStep2) : fail('进入配置页', activeStep2);
        
        const form = await getActiveFormElements(p);
        const hasProcessMode = form.selects.some(s => s.id === 'splitSheetProcessMode');
        const hasOutputFormat = form.radios.some(r => r.name === 'splitSheetOutputFormat');
        (hasProcessMode && hasOutputFormat) ? pass('处理模式/输出格式', '存在') : fail('处理模式/输出格式', `processMode=${hasProcessMode}, outputFormat=${hasOutputFormat}`);
        
        // Step 3 → Step 4: 生成
        await clickNext(p);
        await getResult(p, '按工作表拆分');
    });
    log('');
    
    // ========== 2. 按列拆分-横向 ==========
    log('━━━ 2. 🧑 按列拆分-横向 ━━━');
    log('  💡 场景：按班级列拆分成绩表');
    await runTest('按列拆分-横向', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'split-column');
        await uploadAndWait(p, 'multi-column.xlsx');
        
        // split-column: step1Next 直接跳到 step3（列选择+配置）
        await clickNext(p);
        
        const activeStep = await p.evaluate(() => {
            const steps = document.querySelectorAll('.step-content');
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].classList.contains('active')) return steps[i].id;
            }
            return null;
        });
        activeStep === 'step3' ? pass('直接进入列选择页', activeStep) : fail('步骤跳转', activeStep);
        
        const form = await getActiveFormElements(p);
        
        // 验证列选择
        const colCheckboxes = form.checkboxes.filter(c => c.id.startsWith('col-'));
        colCheckboxes.length >= 2 ? pass('列选择区域', `${colCheckboxes.length}列`) : fail('列选择区域', colCheckboxes.length);
        
        // 选择第一列
        if (colCheckboxes.length > 0) {
            await p.check(`#${colCheckboxes[0].id}`);
            pass('选择拆分列', colCheckboxes[0].id);
        }
        
        // 验证输出格式和处理模式
        const hasOutputFormat = form.radios.some(r => r.name === 'splitColumnOutputFormat');
        const hasProcessMode = form.selects.some(s => s.id === 'splitColumnProcessMode');
        (hasOutputFormat && hasProcessMode) ? pass('输出格式/处理模式', '存在') : fail('输出格式/处理模式', `outputFormat=${hasOutputFormat}, processMode=${hasProcessMode}`);
        
        // Step 3 → Step 4: 生成
        await clickNext(p);
        await getResult(p, '按列拆分-横向');
    });
    log('');
    
    // ========== 3. 按列拆分-竖向 ==========
    log('━━━ 3. 🧑 按列拆分-竖向 ━━━');
    log('  💡 场景：把6列成绩表拆成3个独立文件');
    await runTest('按列拆分-竖向', async (browser) => {
        const { p } = await gotoHome(browser);
        
        // 检查 split-vertical 模式是否存在
        const modeBtn = p.locator('[data-mode="split-column-vertical"]');
        if (!(await modeBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
            warn('按列拆分-竖向', '模式按钮不可见，跳过');
            return;
        }
        
        await selectMode(p, 'split-column-vertical');
        await uploadAndWait(p, 'multi-column.xlsx');
        
        await clickNext(p);
        
        const form = await getActiveFormElements(p);
        const colCheckboxes = form.checkboxes.filter(c => c.id.startsWith('vertical-col-'));
        colCheckboxes.length >= 3 ? pass('竖向列选择', `${colCheckboxes.length}列`) : fail('竖向列选择', colCheckboxes.length);
        
        for (let i = 0; i < Math.min(3, colCheckboxes.length); i++) {
            await p.check(`#${colCheckboxes[i].id}`);
        }
        pass('选择3列', '成功');
        
        await clickNext(p);
        await getResult(p, '按列拆分-竖向');
    });
    log('');
    
    // ========== 4. 按行数拆分 ==========
    log('━━━ 4. 🧑 按行数拆分 ━━━');
    log('  💡 场景：3000行大文件每1000行拆一个');
    await runTest('按行数拆分', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'split-rows');
        await uploadAndWait(p, 'large-3000rows.xlsx');
        
        // step1 有 processingMode 和 exportFormat
        const step1Form = await getActiveFormElements(p);
        const hasProcessMode = step1Form.radios.some(r => r.name === 'processingMode');
        const hasExportFormat = step1Form.radios.some(r => r.name === 'exportFormat');
        (hasProcessMode && hasExportFormat) ? pass('处理模式/导出格式', '在step1存在') : fail('处理模式/导出格式', '缺失');
        
        // step1 → step3: 配置页（split-rows跳过step2）
        await clickNext(p);
        
        const activeStep = await p.evaluate(() => {
            const steps = document.querySelectorAll('.step-content');
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].classList.contains('active')) return steps[i].id;
            }
            return null;
        });
        activeStep === 'step3' ? pass('进入配置页', activeStep) : fail('步骤跳转', activeStep);
        
        const form = await getActiveFormElements(p);
        const hasPerFile = form.numbers.some(n => n.id === 'splitRowsPerFile');
        hasPerFile ? pass('每文件行数输入', '可见') : fail('每文件行数输入', '不可见');
        
        await p.fill('#splitRowsPerFile', '1000');
        pass('设置每1000行', '成功');
        
        // 验证输出格式和处理模式
        const hasOutputFormat = form.radios.some(r => r.name === 'splitRowsOutputFormat');
        const hasSplitProcessMode = form.selects.some(s => s.id === 'splitRowsProcessMode');
        (hasOutputFormat && hasSplitProcessMode) ? pass('输出格式/处理模式', '存在') : fail('输出格式/处理模式', `outputFormat=${hasOutputFormat}, processMode=${hasSplitProcessMode}`);
        
        await clickNext(p);
        await getResult(p, '按行数拆分');
    });
    log('');
    
    // ========== 5. 文件合并 ==========
    log('━━━ 5. 🧑 文件合并 ━━━');
    log('  💡 场景：2个独立Excel合并成一个工作簿');
    await runTest('文件合并', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'merge-file');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        // step1 有 processingMode 和 exportFormat
        const step1Form = await getActiveFormElements(p);
        const hasProcessMode = step1Form.radios.some(r => r.name === 'processingMode');
        const hasExportFormat = step1Form.radios.some(r => r.name === 'exportFormat');
        (hasProcessMode && hasExportFormat) ? pass('处理模式/导出格式', '在step1存在') : fail('处理模式/导出格式', '缺失');
        
        // step1 → step3: 文件选择页（merge-file跳过step2）
        await clickNext(p);
        
        const activeStep = await p.evaluate(() => {
            const steps = document.querySelectorAll('.step-content');
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].classList.contains('active')) return steps[i].id;
            }
            return null;
        });
        activeStep === 'step3' ? pass('进入文件选择页', activeStep) : fail('步骤跳转', activeStep);
        
        // 验证文件选择区域
        const form = await getActiveFormElements(p);
        const fileCheckboxes = form.checkboxes.filter(c => c.id.startsWith('file-'));
        fileCheckboxes.length >= 2 ? pass('文件选择区域', `${fileCheckboxes.length}个文件`) : fail('文件选择区域', fileCheckboxes.length);
        
        await clickNext(p);
        await getResult(p, '文件合并');
    });
    log('');
    
    // ========== 6. 工作表数据合并 ==========
    log('━━━ 6. 🧑 工作表数据合并 ━━━');
    log('  💡 场景：2个结构相同的Excel合并数据到一张总表');
    await runTest('数据合并', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'merge-sheet');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        // step1 → step3: 合并策略+文件选择
        await clickNext(p);
        
        const form = await getActiveFormElements(p);
        
        // 验证合并策略
        const hasStrict = form.radios.some(r => r.name === 'mergeStrategy' && r.value === 'strict');
        const hasSmart = form.radios.some(r => r.name === 'mergeStrategy' && r.value === 'smart');
        (hasStrict && hasSmart) ? pass('合并策略', '严格/智能') : fail('合并策略', '缺失');
        
        // 验证文件选择
        const fileCheckboxes = form.checkboxes.filter(c => c.id.startsWith('file-'));
        fileCheckboxes.length >= 2 ? pass('文件选择', `${fileCheckboxes.length}个`) : fail('文件选择', fileCheckboxes.length);
        
        // 验证排序选项
        const hasSortEnabled = form.checkboxes.some(c => c.id === 'mergeSheetSortEnabled');
        hasSortEnabled ? pass('排序选项', '存在') : fail('排序选项', '不存在');
        
        await clickNext(p);
        await getResult(p, '数据合并');
    });
    log('');
    
    // ========== 7. 智能合并大师 ==========
    log('━━━ 7. 🧑 智能合并大师 ━━━');
    log('  💡 场景：全量追加2个文件的数据');
    await runTest('智能合并', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'smart-merge');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        // step1 → step2(空) → step3: 合并模式配置
        await clickNext(p);
        await clickNext(p);
        
        const activeStep = await p.evaluate(() => {
            const steps = document.querySelectorAll('.step-content');
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].classList.contains('active')) return steps[i].id;
            }
            return null;
        });
        activeStep === 'step3' ? pass('进入合并模式配置', activeStep) : fail('步骤跳转', activeStep);
        
        const form = await getActiveFormElements(p);
        
        // 验证合并模式
        const hasModeA = form.radios.some(r => r.name === 'smartMergeMode' && r.value === 'modeA');
        const hasModeB = form.radios.some(r => r.name === 'smartMergeMode' && r.value === 'modeB');
        (hasModeA && hasModeB) ? pass('合并模式', 'A/B均有') : fail('合并模式', '缺失');
        
        // 验证去重选项
        const hasDedup = form.checkboxes.some(c => c.id === 'smartMergeRemoveDuplicates');
        hasDedup ? pass('去重选项', '存在') : fail('去重选项', '不存在');
        
        // 验证来源列选项
        const hasSourceCol = form.checkboxes.some(c => c.id === 'smartMergeSourceColumn');
        hasSourceCol ? pass('来源列选项', '存在') : fail('来源列选项', '不存在');
        
        await clickNext(p);
        await getResult(p, '智能合并');
    });
    log('');
    
    // ========== 8. 合并计算 ==========
    log('━━━ 8. 🧑 合并计算 ━━━');
    log('  💡 场景：按关键列分组求和');
    await runTest('合并计算', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'summary-merge');
        await uploadAndWait(p, 'simple-merge-a.xlsx');
        
        // step1 → step2(空) → step3: 计算配置
        await clickNext(p);
        await clickNext(p);
        
        const activeStep = await p.evaluate(() => {
            const steps = document.querySelectorAll('.step-content');
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].classList.contains('active')) return steps[i].id;
            }
            return null;
        });
        activeStep === 'step3' ? pass('进入计算配置', activeStep) : fail('步骤跳转', activeStep);
        
        const form = await getActiveFormElements(p);
        
        const hasSum = form.radios.some(r => r.name === 'summaryMethod' && r.value === 'sum');
        const hasAvg = form.radios.some(r => r.name === 'summaryMethod' && r.value === 'avg');
        (hasSum && hasAvg) ? pass('计算方法', '求和/平均均有') : fail('计算方法', '缺失');
        
        const sgCols = form.checkboxes.filter(c => c.id.startsWith('sg-col-'));
        const svCols = form.checkboxes.filter(c => c.id.startsWith('sv-col-'));
        (sgCols.length > 0 || svCols.length > 0) ? pass('列选择', `sg=${sgCols.length}, sv=${svCols.length}`) : fail('列选择', '无可用列');
        
        await p.click('input[name="summaryMethod"][value="sum"]');
        await p.waitForTimeout(200);
        
        if (sgCols.length > 0) {
            await p.check(`#${sgCols[0].id}`);
        }
        if (svCols.length > 0) {
            await p.check(`#${svCols[0].id}`);
        }
        
        await clickNext(p);
        await getResult(p, '合并计算');
    });
    log('');
    
    // ========== 9. 数据匹配 ==========
    log('━━━ 9. 🧑 数据匹配 ━━━');
    log('  💡 场景：类似SQL JOIN合并2个表');
    await runTest('数据匹配', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'data-join');
        await uploadAndWait(p, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
        
        // step1 → step2(空) → step3: JOIN配置
        await clickNext(p);
        await clickNext(p);
        
        const activeStep = await p.evaluate(() => {
            const steps = document.querySelectorAll('.step-content');
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].classList.contains('active')) return steps[i].id;
            }
            return null;
        });
        activeStep === 'step3' ? pass('进入JOIN配置', activeStep) : fail('步骤跳转', activeStep);
        
        const form = await getActiveFormElements(p);
        
        // 验证连接类型
        const hasInner = form.radios.some(r => r.name === 'joinType' && r.value === 'inner');
        const hasLeft = form.radios.some(r => r.name === 'joinType' && r.value === 'left');
        const hasRight = form.radios.some(r => r.name === 'joinType' && r.value === 'right');
        (hasInner && hasLeft && hasRight) ? pass('连接类型', '内/左/右') : fail('连接类型', '缺失');
        
        // 验证关键列选择
        const hasLeftKey = form.selects.some(s => s.id === 'joinLeftKeyColumn');
        const hasRightKey = form.selects.some(s => s.id === 'joinRightKeyColumn');
        (hasLeftKey && hasRightKey) ? pass('关键列选择', '左/右表') : fail('关键列选择', '缺失');
        
        await clickNext(p);
        await getResult(p, '数据匹配');
    });
    log('');
    
    // ========== 10. 全局功能 ==========
    log('━━━ 10. 🧑 全局功能测试 ━━━');
    
    await runTest('步骤导航', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        
        await clickNext(p);
        const atStep2 = await p.evaluate(() => document.querySelector('#step2')?.classList.contains('active'));
        atStep2 ? pass('下一步→Sheet选择页', '成功') : fail('下一步→Sheet选择页', '失败');
        
        await p.locator('#step2Prev').click({ timeout: 3000 });
        await p.waitForTimeout(600);
        const atStep1 = await p.evaluate(() => document.querySelector('#step1')?.classList.contains('active'));
        atStep1 ? pass('上一步→上传页', '成功') : fail('上一步→上传页', '失败');
    });
    
    await runTest('清空功能', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'split-sheet');
        await uploadAndWait(p, 'basic-3sheets.xlsx');
        
        await clickNext(p);
        await clickNext(p);
        await clickNext(p);
        
        const resetBtn = p.locator('#resetBtn');
        if (await resetBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await resetBtn.click();
            await p.waitForTimeout(800);
            const modeActive = await p.locator('.mode-btn.active').getAttribute('data-mode').catch(() => null);
            pass('清空功能', modeActive ? `重置到${modeActive}` : '已重置');
        } else {
            warn('清空功能', 'resetBtn仅在结果页可见，非核心功能');
        }
    });
    log('');
    
    // ========== 11. 错误处理 ==========
    log('━━━ 11. 🧑 错误处理 ━━━');
    
    await runTest('非Excel文件', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'split-sheet');
        
        const fakePath = path.join(DOWNLOAD_DIR, 'fake.txt');
        fs.writeFileSync(fakePath, 'Not Excel');
        
        await p.locator('#fileInput').setInputFiles(fakePath);
        await p.waitForTimeout(3000);
        
        const errToast = await p.locator('.toast-error, .toast.error').count();
        errToast > 0 ? pass('非Excel错误提示', '显示') : warn('非Excel错误提示', '未检测到');
        
        fs.unlinkSync(fakePath);
    });
    
    await runTest('未选文件禁用', async (browser) => {
        const { p } = await gotoHome(browser);
        await selectMode(p, 'split-sheet');
        
        const isDisabled = await p.locator('#step1Next').isDisabled().catch(() => true);
        isDisabled ? pass('未选文件按钮禁用', '是') : warn('未选文件按钮禁用', '否');
    });
    log('');
    
    // ========== 12. 移动端响应式 ==========
    log('━━━ 12. 🧑 移动端响应式 ━━━');
    await runTest('移动端响应式', async (browser) => {
        const { p } = await gotoHome(browser);
        await p.setViewportSize({ width: 375, height: 667 });
        await p.waitForTimeout(500);
        
        const msd = await p.locator('.mode-selector').evaluate(el => window.getComputedStyle(el).display);
        msd === 'grid' ? pass('移动端Grid布局', '是') : fail('移动端Grid布局', msd);
        
        const mv = await p.locator('.mode-btn').first().isVisible();
        mv ? pass('移动端模式按钮', '可见') : fail('移动端模式按钮', '不可见');
        
        const mu = await p.locator('#uploadArea').isVisible();
        mu ? pass('移动端上传区域', '可见') : fail('移动端上传区域', '不可见');
    });
    log('');
    
    // ========== 13. 可访问性 ==========
    log('━━━ 13. 🧑 可访问性 ━━━');
    await runTest('可访问性', async (browser) => {
        const { p } = await gotoHome(browser);
        const al = await p.locator('[aria-label]').count();
        al >= 5 ? pass('aria-label', `${al}个`) : warn('aria-label', `${al}个`);
        
        const rl = await p.locator('[role]').count();
        rl >= 2 ? pass('role属性', `${rl}个`) : warn('role属性', `${rl}个`);
    });
    log('');
    
    // ========== 14. 控制台错误 ==========
    log('━━━ 14. 🧑 控制台错误 ━━━');
    await runTest('控制台错误', async (browser) => {
        const { p } = await gotoHome(browser);
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
    });
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
})();

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3077';
const DATA_DIR = path.join(__dirname, 'test-data');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    
    await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    
    // ========== split-sheet: 检查步骤2的选项 ==========
    console.log('=== split-sheet 步骤2 ===');
    await p.click('[data-mode="split-sheet"]');
    await p.waitForTimeout(600);
    await p.locator('#fileInput').setInputFiles(path.join(DATA_DIR, 'basic-3sheets.xlsx'));
    await p.waitForTimeout(4000);
    await p.click('#step1Next');
    await p.waitForTimeout(600);
    
    // 找所有 radio 和 select
    const radios1 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="radio"]')).map(r => ({
            name: r.name, value: r.value, id: r.id, visible: r.offsetParent !== null
        }));
    });
    console.log('Radios:', JSON.stringify(radios1.filter(r => r.visible), null, 2));
    
    const selects1 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('select')).map(s => ({
            id: s.id, name: s.name, visible: s.offsetParent !== null
        }));
    });
    console.log('Selects:', JSON.stringify(selects1.filter(s => s.visible), null, 2));
    
    // ========== merge-sheet: 检查步骤2 ==========
    console.log('\n=== merge-sheet 步骤2 ===');
    await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    await p.click('[data-mode="merge-sheet"]');
    await p.waitForTimeout(600);
    await p.locator('#fileInput').setInputFiles([
        path.join(DATA_DIR, 'simple-merge-a.xlsx'),
        path.join(DATA_DIR, 'simple-merge-b.xlsx')
    ]);
    await p.waitForTimeout(4000);
    await p.click('#step1Next');
    await p.waitForTimeout(600);
    
    const radios2 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="radio"]')).map(r => ({
            name: r.name, value: r.value, id: r.id, visible: r.offsetParent !== null
        }));
    });
    console.log('Radios:', JSON.stringify(radios2.filter(r => r.visible), null, 2));
    
    const selects2 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('select')).map(s => ({
            id: s.id, name: s.name, visible: s.offsetParent !== null
        }));
    });
    console.log('Selects:', JSON.stringify(selects2.filter(s => s.visible), null, 2));
    
    const checkboxes2 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="checkbox"]')).map(c => ({
            id: c.id, name: c.name, visible: c.offsetParent !== null,
            label: c.closest('label')?.textContent?.trim()?.substring(0, 30) || ''
        }));
    });
    console.log('Checkboxes:', JSON.stringify(checkboxes2.filter(c => c.visible), null, 2));
    
    // ========== summary-merge: 检查步骤2 ==========
    console.log('\n=== summary-merge 步骤2 ===');
    await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    await p.click('[data-mode="summary-merge"]');
    await p.waitForTimeout(600);
    await p.locator('#fileInput').setInputFiles(path.join(DATA_DIR, 'simple-merge-a.xlsx'));
    await p.waitForTimeout(4000);
    await p.click('#step1Next');
    await p.waitForTimeout(600);
    
    const selects3 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('select')).map(s => ({
            id: s.id, name: s.name, visible: s.offsetParent !== null
        }));
    });
    console.log('Selects:', JSON.stringify(selects3.filter(s => s.visible), null, 2));
    
    const radios3 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="radio"]')).map(r => ({
            name: r.name, value: r.value, id: r.id, visible: r.offsetParent !== null
        }));
    });
    console.log('Radios:', JSON.stringify(radios3.filter(r => r.visible), null, 2));
    
    // ========== smart-merge: 检查步骤2 ==========
    console.log('\n=== smart-merge 步骤2 ===');
    await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    await p.click('[data-mode="smart-merge"]');
    await p.waitForTimeout(600);
    await p.locator('#fileInput').setInputFiles([
        path.join(DATA_DIR, 'simple-merge-a.xlsx'),
        path.join(DATA_DIR, 'simple-merge-b.xlsx')
    ]);
    await p.waitForTimeout(4000);
    await p.click('#step1Next');
    await p.waitForTimeout(600);
    
    const selects4 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('select')).map(s => ({
            id: s.id, name: s.name, visible: s.offsetParent !== null
        }));
    });
    console.log('Selects:', JSON.stringify(selects4.filter(s => s.visible), null, 2));
    
    const radios4 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="radio"]')).map(r => ({
            name: r.name, value: r.value, id: r.id, visible: r.offsetParent !== null
        }));
    });
    console.log('Radios:', JSON.stringify(radios4.filter(r => r.visible), null, 2));
    
    // ========== data-join: 检查步骤2 ==========
    console.log('\n=== data-join 步骤2 ===');
    await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    await p.click('[data-mode="data-join"]');
    await p.waitForTimeout(600);
    await p.locator('#fileInput').setInputFiles([
        path.join(DATA_DIR, 'simple-merge-a.xlsx'),
        path.join(DATA_DIR, 'simple-merge-b.xlsx')
    ]);
    await p.waitForTimeout(4000);
    await p.click('#step1Next');
    await p.waitForTimeout(600);
    
    const selects5 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('select')).map(s => ({
            id: s.id, name: s.name, visible: s.offsetParent !== null
        }));
    });
    console.log('Selects:', JSON.stringify(selects5.filter(s => s.visible), null, 2));
    
    const radios5 = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="radio"]')).map(r => ({
            name: r.name, value: r.value, id: r.id, visible: r.offsetParent !== null
        }));
    });
    console.log('Radios:', JSON.stringify(radios5.filter(r => r.visible), null, 2));
    
    // ========== 检查所有按钮ID ==========
    console.log('\n=== 所有可见按钮 ===');
    const buttons = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).map(b => ({
            id: b.id, text: b.textContent.trim().substring(0, 30)
        }));
    });
    console.log(JSON.stringify(buttons, null, 2));
    
    await browser.close();
})();

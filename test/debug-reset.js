const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3077';
const DATA_DIR = path.join(__dirname, 'test-data');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    
    await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle', timeout: 30000 });
    await p.waitForTimeout(500);
    
    // Initial state - check upload area
    const initUploadArea = await p.evaluate(() => {
        const el = document.querySelector('#uploadArea');
        return { visible: el.offsetParent !== null, display: el.style.display, classes: el.className };
    });
    console.log('Initial uploadArea:', JSON.stringify(initUploadArea));
    
    await p.click('[data-mode="split-sheet"]');
    await p.waitForTimeout(600);
    await p.locator('#fileInput').setInputFiles(path.join(DATA_DIR, 'basic-3sheets.xlsx'));
    await p.waitForTimeout(3000);
    
    // After upload - is upload area still visible?
    const afterUpload = await p.evaluate(() => {
        const el = document.querySelector('#uploadArea');
        return { visible: el.offsetParent !== null, display: el.style.display, classes: el.className };
    });
    console.log('After upload uploadArea:', JSON.stringify(afterUpload));
    
    // Go to step4
    await p.click('#step1Next');
    await p.waitForTimeout(600);
    await p.click('#splitSheetSelectAll');
    await p.click('#step2Next');
    await p.waitForTimeout(600);
    await p.click('#step3Next');
    await p.waitForTimeout(5000);
    
    // Step4 state
    const step4Upload = await p.evaluate(() => {
        const el = document.querySelector('#uploadArea');
        return { visible: el.offsetParent !== null, display: el.style.display, classes: el.className };
    });
    console.log('Step4 uploadArea:', JSON.stringify(step4Upload));
    
    // Check reset button
    const resetInfo = await p.evaluate(() => {
        const el = document.querySelector('#resetBtn');
        return el ? { visible: el.offsetParent !== null, text: el.textContent } : 'not found';
    });
    console.log('Reset button:', typeof resetInfo === 'string' ? resetInfo : JSON.stringify(resetInfo));
    
    // Click reset
    await p.click('#resetBtn');
    await p.waitForTimeout(1000);
    
    // After reset
    const afterReset = await p.evaluate(() => {
        const uploadArea = document.querySelector('#uploadArea');
        const fileInput = document.querySelector('#fileInput');
        const sheetList = document.querySelector('#sheetList');
        const activeMode = document.querySelector('.mode-btn.active');
        const resetBtn = document.querySelector('#resetBtn');
        
        return {
            uploadArea: uploadArea ? { 
                visible: uploadArea.offsetParent !== null,
                display: uploadArea.style.display,
                classes: uploadArea.className 
            } : 'not found',
            fileInputValue: fileInput ? fileInput.value : 'no input',
            sheetList: sheetList ? sheetList.offsetParent !== null : 'no sheetList',
            activeMode: activeMode ? activeMode.getAttribute('data-mode') : 'none',
            resetBtn: resetBtn ? resetBtn.offsetParent !== null : 'no resetBtn',
            step: (() => {
                const steps = document.querySelectorAll('.step-content');
                for (let i = 0; i < steps.length; i++) {
                    if (steps[i].classList.contains('active')) return `step${i+1}`;
                }
                return 'none';
            })()
        };
    });
    console.log('After reset state:', JSON.stringify(afterReset, null, 2));
    
    await browser.close();
})();

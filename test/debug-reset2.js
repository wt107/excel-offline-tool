const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3077';
const DATA_DIR = path.join(__dirname, 'test-data');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    
    // Auto-accept confirm dialogs
    p.on('dialog', async dialog => {
        console.log('Dialog detected:', dialog.message().substring(0, 60));
        await dialog.accept();
    });
    
    await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle', timeout: 30000 });
    await p.waitForTimeout(500);
    
    await p.click('[data-mode="split-sheet"]');
    await p.waitForTimeout(600);
    await p.locator('#fileInput').setInputFiles(path.join(DATA_DIR, 'basic-3sheets.xlsx'));
    await p.waitForTimeout(3000);
    
    // Go to step4
    await p.click('#step1Next');
    await p.waitForTimeout(600);
    await p.click('#splitSheetSelectAll');
    await p.click('#step2Next');
    await p.waitForTimeout(600);
    await p.click('#step3Next');
    await p.waitForTimeout(5000);
    
    // Click reset
    await p.click('#resetBtn');
    await p.waitForTimeout(1000);
    
    const afterReset = await p.evaluate(() => {
        const uploadArea = document.querySelector('#uploadArea');
        const fileInput = document.querySelector('#fileInput');
        const activeMode = document.querySelector('.mode-btn.active');
        const step1 = document.querySelector('#step1');
        return {
            uploadAreaVisible: uploadArea ? uploadArea.offsetParent !== null : false,
            fileInputValue: fileInput ? fileInput.value : 'no input',
            activeMode: activeMode ? activeMode.getAttribute('data-mode') : 'none',
            step1Active: step1 ? step1.classList.contains('active') : false
        };
    });
    console.log('After reset (with dialog accept):', JSON.stringify(afterReset, null, 2));
    
    await browser.close();
})();

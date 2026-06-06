const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3077';
const DATA_DIR = path.join(__dirname, 'test-data');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    
    await page.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    
    // Check split-column mode flow
    console.log('=== split-column 流程检查 ===');
    await page.click('[data-mode="split-column"]');
    await page.waitForTimeout(600);
    
    // Upload
    await page.locator('#fileInput').setInputFiles(path.join(DATA_DIR, 'multi-column.xlsx'));
    await page.waitForTimeout(4000);
    
    // Check what step we're on and what buttons are visible
    const steps = await page.evaluate(() => {
        const stepEls = document.querySelectorAll('.step');
        const stepContents = document.querySelectorAll('.step-content');
        return {
            steps: Array.from(stepEls).map((el, i) => ({
                index: i,
                text: el.textContent.trim(),
                isActive: el.classList.contains('active'),
                classes: el.className
            })),
            stepContents: Array.from(stepContents).map((el, i) => ({
                index: i,
                id: el.id,
                isActive: el.classList.contains('active'),
                classes: el.className
            }))
        };
    });
    console.log('Steps:', JSON.stringify(steps, null, 2));
    
    // Check all buttons and their states
    const buttons = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        return Array.from(btns).map(btn => ({
            id: btn.id,
            text: btn.textContent.trim().substring(0, 40),
            isVisible: btn.offsetParent !== null,
            isDisabled: btn.disabled,
            classes: btn.className
        })).filter(b => b.id && b.id.includes('step') || b.id.includes('Step') || b.id.includes('next') || b.id.includes('Next') || b.id.includes('prev') || b.id.includes('Prev'));
    });
    console.log('Step buttons:', JSON.stringify(buttons, null, 2));
    
    // Now click step1Next
    console.log('\n=== 点击 step1Next ===');
    await page.click('#step1Next');
    await page.waitForTimeout(600);
    
    const steps2 = await page.evaluate(() => {
        const stepEls = document.querySelectorAll('.step');
        const stepContents = document.querySelectorAll('.step-content');
        return {
            steps: Array.from(stepEls).map((el, i) => ({
                index: i,
                isActive: el.classList.contains('active'),
            })),
            stepContents: Array.from(stepContents).map((el, i) => ({
                index: i,
                id: el.id,
                isActive: el.classList.contains('active'),
            }))
        };
    });
    console.log('After step1Next:', JSON.stringify(steps2, null, 2));
    
    const buttons2 = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        return Array.from(btns).map(btn => ({
            id: btn.id,
            text: btn.textContent.trim().substring(0, 40),
            isVisible: btn.offsetParent !== null,
            isDisabled: btn.disabled,
        })).filter(b => b.id && (b.id.includes('step') || b.id.includes('Step') || b.id.includes('next') || b.id.includes('Next') || b.id.includes('prev') || b.id.includes('Prev')));
    });
    console.log('Buttons after step1Next:', JSON.stringify(buttons2, null, 2));
    
    // Check what's in the column list
    const colCheckboxes = await page.locator('#columnList .sheet-checkbox').count();
    console.log('Column checkboxes:', colCheckboxes);
    
    // Check if there's a different next button for column selection
    const allBtns = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        return Array.from(btns).map(btn => ({
            id: btn.id,
            text: btn.textContent.trim().substring(0, 40),
            isVisible: btn.offsetParent !== null,
            isDisabled: btn.disabled,
        })).filter(b => b.isVisible);
    });
    console.log('\nAll visible buttons:', JSON.stringify(allBtns, null, 2));
    
    await browser.close();
})();

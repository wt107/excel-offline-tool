const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3077';
const DATA_DIR = path.join(__dirname, 'test-data');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    
    async function inspectMode(mode, files) {
        console.log(`\n========== ${mode} ==========`);
        await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await p.click(`[data-mode="${mode}"]`);
        await p.waitForTimeout(600);
        
        if (Array.isArray(files)) {
            await p.locator('#fileInput').setInputFiles(files.map(f => path.join(DATA_DIR, f)));
        } else {
            await p.locator('#fileInput').setInputFiles(path.join(DATA_DIR, files));
        }
        await p.waitForTimeout(4000);
        
        // Step 1
        console.log('--- Step 1 (上传) ---');
        const step1Content = await p.evaluate(() => {
            const el = document.querySelector('#step1');
            return el ? el.innerHTML.substring(0, 200) : 'not found';
        });
        
        // Click next
        await p.click('#step1Next');
        await p.waitForTimeout(600);
        
        // Check which step is active
        const activeStep = await p.evaluate(() => {
            const steps = document.querySelectorAll('.step-content');
            for (let i = 0; i < steps.length; i++) {
                if (steps[i].classList.contains('active')) return { index: i, id: steps[i].id };
            }
            return null;
        });
        console.log('Active step after step1Next:', activeStep);
        
        // Get all visible form elements on current step
        const formElements = await p.evaluate(() => {
            const active = document.querySelector('.step-content.active');
            if (!active) return [];
            
            const elements = [];
            // Radios
            active.querySelectorAll('input[type="radio"]').forEach(r => {
                if (r.offsetParent !== null) {
                    elements.push({ type: 'radio', name: r.name, value: r.value, id: r.id });
                }
            });
            // Selects
            active.querySelectorAll('select').forEach(s => {
                if (s.offsetParent !== null) {
                    elements.push({ type: 'select', id: s.id, name: s.name });
                }
            });
            // Checkboxes
            active.querySelectorAll('input[type="checkbox"]').forEach(c => {
                if (c.offsetParent !== null) {
                    const label = c.closest('label')?.textContent?.trim()?.substring(0, 40) || '';
                    elements.push({ type: 'checkbox', id: c.id, label });
                }
            });
            // Text inputs
            active.querySelectorAll('input[type="number"], input[type="text"]').forEach(t => {
                if (t.offsetParent !== null) {
                    elements.push({ type: t.type, id: t.id, placeholder: t.placeholder });
                }
            });
            return elements;
        });
        console.log('Form elements:', JSON.stringify(formElements, null, 2));
        
        // Check visible buttons
        const buttons = await p.evaluate(() => {
            const active = document.querySelector('.step-content.active');
            if (!active) return [];
            return Array.from(active.querySelectorAll('button')).filter(b => b.offsetParent !== null).map(b => ({
                id: b.id, text: b.textContent.trim().substring(0, 30)
            }));
        });
        console.log('Buttons:', JSON.stringify(buttons, null, 2));
    }
    
    await inspectMode('split-sheet', 'basic-3sheets.xlsx');
    await inspectMode('split-column', 'multi-column.xlsx');
    await inspectMode('split-vertical', 'multi-column.xlsx');
    await inspectMode('split-rows', 'large-3000rows.xlsx');
    await inspectMode('merge-file', ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await inspectMode('merge-sheet', ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await inspectMode('smart-merge', ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await inspectMode('summary-merge', 'simple-merge-a.xlsx');
    await inspectMode('data-join', ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    
    await browser.close();
})();

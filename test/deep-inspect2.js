const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3077';
const DATA_DIR = path.join(__dirname, 'test-data');

async function inspectMode(mode, files) {
    const browser = await chromium.launch({ headless: true });
    try {
        const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await p.goto(BASE_URL + '/excel.html', { waitUntil: 'networkidle', timeout: 30000 });
        await p.waitForTimeout(800);
        
        console.log(`\n========== ${mode} ==========`);
        await p.click(`[data-mode="${mode}"]`);
        await p.waitForTimeout(600);
        
        if (Array.isArray(files)) {
            await p.locator('#fileInput').setInputFiles(files.map(f => path.join(DATA_DIR, f)));
        } else {
            await p.locator('#fileInput').setInputFiles(path.join(DATA_DIR, files));
        }
        await p.waitForTimeout(4000);
        
        // Click through steps and inspect each
        for (let step = 0; step < 4; step++) {
            const activeStep = await p.evaluate(() => {
                const steps = document.querySelectorAll('.step-content');
                for (let i = 0; i < steps.length; i++) {
                    if (steps[i].classList.contains('active')) return { index: i, id: steps[i].id };
                }
                return null;
            });
            
            console.log(`--- Step ${step + 1}: ${activeStep?.id || 'unknown'} ---`);
            
            const formElements = await p.evaluate(() => {
                const active = document.querySelector('.step-content.active');
                if (!active) return [];
                
                const elements = [];
                active.querySelectorAll('input[type="radio"]').forEach(r => {
                    if (r.offsetParent !== null) {
                        elements.push({ type: 'radio', name: r.name, value: r.value });
                    }
                });
                active.querySelectorAll('select').forEach(s => {
                    if (s.offsetParent !== null) {
                        elements.push({ type: 'select', id: s.id });
                    }
                });
                active.querySelectorAll('input[type="checkbox"]').forEach(c => {
                    if (c.offsetParent !== null) {
                        const label = c.closest('label')?.textContent?.trim()?.substring(0, 40) || c.id;
                        elements.push({ type: 'checkbox', id: c.id, label });
                    }
                });
                active.querySelectorAll('input[type="number"], input[type="text"]').forEach(t => {
                    if (t.offsetParent !== null) {
                        elements.push({ type: t.type, id: t.id });
                    }
                });
                return elements;
            });
            
            if (formElements.length > 0) {
                console.log('Form:', JSON.stringify(formElements, null, 2));
            } else {
                console.log('Form: (empty)');
            }
            
            // Try to click next
            const nextBtn = await p.evaluate(() => {
                const active = document.querySelector('.step-content.active');
                if (!active) return null;
                const btns = active.querySelectorAll('button');
                for (const b of btns) {
                    if (b.id && b.id.includes('Next') && b.offsetParent !== null && !b.disabled) {
                        return b.id;
                    }
                }
                return null;
            });
            
            if (nextBtn) {
                await p.click(`#${nextBtn}`);
                await p.waitForTimeout(600);
            } else {
                console.log('No next button found, stopping');
                break;
            }
        }
    } catch (e) {
        console.log(`Error: ${e.message.substring(0, 80)}`);
    }
    await browser.close();
}

(async () => {
    await inspectMode('split-vertical', 'multi-column.xlsx');
    await inspectMode('split-rows', 'large-3000rows.xlsx');
    await inspectMode('merge-file', ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await inspectMode('merge-sheet', ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await inspectMode('smart-merge', ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await inspectMode('summary-merge', 'simple-merge-a.xlsx');
    await inspectMode('data-join', ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
})();

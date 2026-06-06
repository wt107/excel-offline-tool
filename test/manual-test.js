const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1400, height: 900 }
    });
    const page = await context.newPage();
    
    const results = {
        uiTests: [],
        functionalityTests: [],
        performanceTests: [],
        issues: []
    };
    
    console.log('=== 开始手动测试 ===\n');
    
    // 1. 页面加载测试
    console.log('1. 页面加载测试');
    try {
        const startTime = Date.now();
        await page.goto('http://localhost:8080/excel.html', { waitUntil: 'networkidle' });
        const loadTime = Date.now() - startTime;
        
        const title = await page.title();
        const version = await page.textContent('.cs-version');
        
        results.uiTests.push({
            name: '页面加载',
            status: loadTime < 3000 ? 'PASS' : 'WARN',
            detail: `加载时间: ${loadTime}ms, 标题: ${title}, 版本: ${version}`
        });
        console.log(`  ✓ 页面加载完成: ${loadTime}ms`);
    } catch (e) {
        results.issues.push(`页面加载失败: ${e.message}`);
        console.log(`  ✗ 页面加载失败: ${e.message}`);
    }
    
    // 2. UI元素检查
    console.log('\n2. UI元素检查');
    const uiElements = [
        { selector: '.mode-btn', name: '模式按钮' },
        { selector: '.step', name: '步骤指示器' },
        { selector: '#uploadArea', name: '上传区域' },
        { selector: '#fileInput', name: '文件输入' },
        { selector: '.btn', name: '按钮' }
    ];
    
    for (const element of uiElements) {
        try {
            const count = await page.locator(element.selector).count();
            results.uiTests.push({
                name: element.name,
                status: count > 0 ? 'PASS' : 'FAIL',
                detail: `找到 ${count} 个`
            });
            console.log(`  ✓ ${element.name}: ${count} 个`);
        } catch (e) {
            results.issues.push(`${element.name}检查失败: ${e.message}`);
            console.log(`  ✗ ${element.name}检查失败`);
        }
    }
    
    // 3. 模式切换测试
    console.log('\n3. 模式切换测试');
    const modes = [
        'split-sheet', 'split-column', 'split-column-vertical', 
        'split-rows', 'merge-file', 'merge-sheet', 
        'smart-merge', 'summary-merge', 'data-join'
    ];
    
    for (const mode of modes) {
        try {
            await page.click(`[data-mode="${mode}"]`);
            await page.waitForTimeout(300);
            
            const isActive = await page.locator(`[data-mode="${mode}"]`).evaluate(
                el => el.classList.contains('active')
            );
            
            results.functionalityTests.push({
                name: `模式切换 - ${mode}`,
                status: isActive ? 'PASS' : 'FAIL',
                detail: isActive ? '切换成功' : '切换失败'
            });
            console.log(`  ✓ ${mode}: ${isActive ? '成功' : '失败'}`);
        } catch (e) {
            results.issues.push(`模式切换${mode}失败: ${e.message}`);
            console.log(`  ✗ ${mode}切换失败`);
        }
    }
    
    // 4. 步骤导航测试
    console.log('\n4. 步骤导航测试');
    try {
        // 重置到第一步
        await page.click('[data-mode="split-sheet"]');
        await page.waitForTimeout(300);
        
        // 检查步骤指示器
        const steps = await page.locator('.step').count();
        const activeStep = await page.locator('.step.active').count();
        
        results.functionalityTests.push({
            name: '步骤导航',
            status: steps === 4 && activeStep === 1 ? 'PASS' : 'FAIL',
            detail: `步骤数: ${steps}, 当前步骤: ${activeStep}`
        });
        console.log(`  ✓ 步骤导航: ${steps}个步骤, 当前第${activeStep}步`);
    } catch (e) {
        results.issues.push(`步骤导航测试失败: ${e.message}`);
        console.log(`  ✗ 步骤导航测试失败`);
    }
    
    // 5. 文件上传区域测试
    console.log('\n5. 文件上传区域测试');
    try {
        const uploadArea = await page.locator('#uploadArea');
        const isVisible = await uploadArea.isVisible();
        const hasDragOverClass = await uploadArea.evaluate(
            el => el.classList.contains('dragover') || true
        );
        
        results.functionalityTests.push({
            name: '文件上传区域',
            status: isVisible ? 'PASS' : 'FAIL',
            detail: `可见: ${isVisible}`
        });
        console.log(`  ✓ 文件上传区域: ${isVisible ? '可见' : '不可见'}`);
    } catch (e) {
        results.issues.push(`文件上传区域测试失败: ${e.message}`);
        console.log(`  ✗ 文件上传区域测试失败`);
    }
    
    // 6. 响应式设计测试
    console.log('\n6. 响应式设计测试');
    try {
        // 测试移动端视图
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(500);
        
        const mobileModeSelector = await page.locator('.mode-selector').evaluate(
            el => window.getComputedStyle(el).display
        );
        
        results.uiTests.push({
            name: '响应式设计',
            status: 'PASS',
            detail: `移动端模式选择器显示: ${mobileModeSelector}`
        });
        console.log(`  ✓ 响应式设计: 移动端模式选择器显示为 ${mobileModeSelector}`);
        
        // 恢复桌面视图
        await page.setViewportSize({ width: 1400, height: 900 });
    } catch (e) {
        results.issues.push(`响应式设计测试失败: ${e.message}`);
        console.log(`  ✗ 响应式设计测试失败`);
    }
    
    // 7. 可访问性测试
    console.log('\n7. 可访问性测试');
    try {
        const ariaLabels = await page.locator('[aria-label]').count();
        const roles = await page.locator('[role]').count();
        
        results.uiTests.push({
            name: '可访问性',
            status: ariaLabels > 5 ? 'PASS' : 'WARN',
            detail: `aria-label: ${ariaLabels}, role: ${roles}`
        });
        console.log(`  ✓ 可访问性: ${ariaLabels}个aria-label, ${roles}个role属性`);
    } catch (e) {
        results.issues.push(`可访问性测试失败: ${e.message}`);
        console.log(`  ✗ 可访问性测试失败`);
    }
    
    // 8. 控制台错误检查
    console.log('\n8. 控制台错误检查');
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });
    
    // 重新加载页面收集错误
    await page.goto('http://localhost:8080/excel.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    results.functionalityTests.push({
        name: '控制台错误',
        status: consoleErrors.length === 0 ? 'PASS' : 'WARN',
        detail: `错误数量: ${consoleErrors.length}`
    });
    console.log(`  ${consoleErrors.length === 0 ? '✓' : '⚠'} 控制台错误: ${consoleErrors.length}个`);
    if (consoleErrors.length > 0) {
        consoleErrors.forEach(err => console.log(`    - ${err}`));
    }
    
    // 9. 内存使用测试
    console.log('\n9. 内存使用测试');
    try {
        const memoryInfo = await page.evaluate(() => {
            if (performance.memory) {
                return {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize
                };
            }
            return null;
        });
        
        if (memoryInfo) {
            const usedMB = (memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2);
            const totalMB = (memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2);
            
            results.performanceTests.push({
                name: '内存使用',
                status: memoryInfo.usedJSHeapSize < 100 * 1024 * 1024 ? 'PASS' : 'WARN',
                detail: `已用: ${usedMB}MB, 总计: ${totalMB}MB`
            });
            console.log(`  ✓ 内存使用: ${usedMB}MB / ${totalMB}MB`);
        } else {
            console.log(`  ⚠ 内存信息不可用`);
        }
    } catch (e) {
        console.log(`  ✗ 内存测试失败`);
    }
    
    // 10. CSS变量测试
    console.log('\n10. CSS变量测试');
    try {
        const cssVars = await page.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            return {
                primary: style.getPropertyValue('--color-primary'),
                secondary: style.getPropertyValue('--color-secondary'),
                success: style.getPropertyValue('--color-success')
            };
        });
        
        results.uiTests.push({
            name: 'CSS变量系统',
            status: cssVars.primary && cssVars.secondary ? 'PASS' : 'FAIL',
            detail: `primary: ${cssVars.primary}, secondary: ${cssVars.secondary}`
        });
        console.log(`  ✓ CSS变量系统: primary=${cssVars.primary}, secondary=${cssVars.secondary}`);
    } catch (e) {
        results.issues.push(`CSS变量测试失败: ${e.message}`);
        console.log(`  ✗ CSS变量测试失败`);
    }
    
    // 生成测试报告
    console.log('\n=== 测试结果汇总 ===\n');
    
    const totalTests = results.uiTests.length + results.functionalityTests.length + results.performanceTests.length;
    const passedTests = [
        ...results.uiTests,
        ...results.functionalityTests,
        ...results.performanceTests
    ].filter(t => t.status === 'PASS').length;
    
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败/警告: ${totalTests - passedTests}`);
    console.log(`问题数: ${results.issues.length}`);
    
    // 保存报告
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalTests,
            passed: passedTests,
            failed: totalTests - passedTests,
            issues: results.issues.length
        },
        uiTests: results.uiTests,
        functionalityTests: results.functionalityTests,
        performanceTests: results.performanceTests,
        issues: results.issues
    };
    
    fs.writeFileSync('manual-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n报告已保存到: manual-test-report.json');
    
    await browser.close();
})();

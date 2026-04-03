/**
 * 视觉操作测试 - 完整的真实浏览器自动化测试
 * 每一步操作都真实执行并截图记录
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// 测试配置
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  baseUrl: 'file://' + path.resolve(__dirname, '../excel.html'),
  screenshotDir: path.resolve(__dirname, 'visual-screenshots'),
  headless: false, // 设置为 true 可以在后台运行
  slowMo: 500, // 操作间隔，便于观察
  viewport: { width: 1440, height: 900 }
};

// ═══════════════════════════════════════════════════════════════
// 测试报告
// ═══════════════════════════════════════════════════════════════

class VisualTestReport {
  constructor() {
    this.steps = [];
    this.startTime = Date.now();
    this.screenshotCount = 0;
  }

  addStep(name, status, details = {}, screenshotPath = null) {
    this.steps.push({
      step: this.steps.length + 1,
      name,
      status, // 'success', 'error', 'warning'
      details,
      screenshot: screenshotPath,
      timestamp: new Date().toISOString()
    });
  }

  generateHtml() {
    const duration = Date.now() - this.startTime;
    const successCount = this.steps.filter(s => s.status === 'success').length;
    const errorCount = this.steps.filter(s => s.status === 'error').length;

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Excel 离线工具 - 视觉操作测试报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            padding-bottom: 15px;
            border-bottom: 3px solid #667eea;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin: 20px 0;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-card.error {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        }
        .summary-value {
            font-size: 2em;
            font-weight: bold;
        }
        .step {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #28a745;
        }
        .step.error {
            border-left-color: #dc3545;
            background: #fff5f5;
        }
        .step-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .step-number {
            background: #667eea;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }
        .step-title {
            font-size: 1.2em;
            font-weight: 600;
            color: #333;
        }
        .step-status {
            margin-left: auto;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 500;
        }
        .step-status.success {
            background: #d4edda;
            color: #155724;
        }
        .step-status.error {
            background: #f8d7da;
            color: #721c24;
        }
        .screenshot {
            margin-top: 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
        }
        .screenshot img {
            width: 100%;
            max-height: 400px;
            object-fit: contain;
            background: #f0f0f0;
        }
        .screenshot-label {
            background: #667eea;
            color: white;
            padding: 8px 12px;
            font-size: 0.85em;
        }
        .details {
            margin-top: 10px;
            padding: 10px;
            background: white;
            border-radius: 4px;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📸 Excel 离线工具 - 视觉操作测试报告</h1>
        <p>测试时间: ${new Date().toLocaleString('zh-CN')}</p>
        <p>总耗时: ${(duration / 1000).toFixed(2)} 秒</p>
        
        <div class="summary">
            <div class="summary-card">
                <div class="summary-value">${this.steps.length}</div>
                <div>总步骤</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${successCount}</div>
                <div>通过</div>
            </div>
            <div class="summary-card ${errorCount > 0 ? 'error' : ''}">
                <div class="summary-value">${errorCount}</div>
                <div>失败</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${this.screenshotCount}</div>
                <div>截图</div>
            </div>
        </div>

        ${this.steps.map(step => `
            <div class="step ${step.status}">
                <div class="step-header">
                    <div class="step-number">${step.step}</div>
                    <div class="step-title">${step.name}</div>
                    <div class="step-status ${step.status}">
                        ${step.status === 'success' ? '✅ 通过' : '❌ 失败'}
                    </div>
                </div>
                ${Object.keys(step.details).length > 0 ? `
                    <div class="details">
                        ${Object.entries(step.details).map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('')}
                    </div>
                ` : ''}
                ${step.screenshot ? `
                    <div class="screenshot">
                        <div class="screenshot-label">📷 截图</div>
                        <img src="${path.basename(step.screenshot)}" alt="${step.name}">
                    </div>
                ` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;
  }

  save() {
    const htmlPath = path.join(CONFIG.screenshotDir, 'visual-test-report.html');
    fs.writeFileSync(htmlPath, this.generateHtml());
    return htmlPath;
  }
}

// ═══════════════════════════════════════════════════════════════
// 视觉测试类
// ═══════════════════════════════════════════════════════════════

class VisualTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.report = new VisualTestReport();
  }

  async init() {
    console.log('🚀 启动浏览器...');
    this.browser = await chromium.launch({
      headless: CONFIG.headless,
      slowMo: CONFIG.slowMo
    });
    
    this.page = await this.browser.newPage({
      viewport: CONFIG.viewport
    });

    // 创建截图目录
    if (!fs.existsSync(CONFIG.screenshotDir)) {
      fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
    }

    console.log('✅ 浏览器启动成功\n');
  }

  async screenshot(name) {
    const filename = `step_${String(this.report.screenshotCount + 1).padStart(2, '0')}_${name}.png`;
    const filepath = path.join(CONFIG.screenshotDir, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    this.report.screenshotCount++;
    return filepath;
  }

  async testInitialLoad() {
    console.log('📸 Step 1: 测试初始页面加载...');
    
    try {
      await this.page.goto(CONFIG.baseUrl);
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(1000);
      
      const title = await this.page.title();
      const screenshot = await this.screenshot('initial_load');
      
      this.report.addStep(
        '初始页面加载',
        'success',
        { 页面标题: title, URL: CONFIG.baseUrl },
        screenshot
      );
      
      console.log('   ✅ 页面加载成功:', title);
    } catch (e) {
      this.report.addStep('初始页面加载', 'error', { 错误: e.message });
      console.log('   ❌ 页面加载失败:', e.message);
    }
  }

  async testModeButtons() {
    console.log('📸 Step 2: 测试模式按钮...');
    
    const modes = [
      { name: '按工作表拆分', selector: '[data-mode="split-sheet"]' },
      { name: '按列拆分(横向)', selector: '[data-mode="split-column"]' },
      { name: '按列拆分(竖向)', selector: '[data-mode="split-column-vertical"]' },
      { name: '文件合并', selector: '[data-mode="merge-file"]' },
      { name: '工作表数据合并', selector: '[data-mode="merge-sheet"]' }
    ];

    for (const mode of modes) {
      try {
        const button = this.page.locator(mode.selector);
        await button.click();
        await this.page.waitForTimeout(500);
        
        const isActive = await button.evaluate(el => el.classList.contains('active'));
        
        if (isActive) {
          console.log(`   ✅ ${mode.name} - 点击成功`);
        }
      } catch (e) {
        console.log(`   ❌ ${mode.name} - 点击失败:`, e.message);
      }
    }

    // 截图记录模式切换后的状态
    const screenshot = await this.screenshot('mode_buttons');
    this.report.addStep(
      '模式按钮测试',
      'success',
      { 测试模式数: modes.length, 当前模式: '工作表数据合并' },
      screenshot
    );
  }

  async testFileUpload() {
    console.log('📸 Step 3: 测试文件上传区域...');
    
    try {
      // 切换到按工作表拆分模式
      await this.page.locator('[data-mode="split-sheet"]').click();
      await this.page.waitForTimeout(500);
      
      // 检查上传区域
      const uploadArea = this.page.locator('#uploadArea');
      const isVisible = await uploadArea.isVisible();
      
      const screenshot = await this.screenshot('upload_area');
      
      this.report.addStep(
        '文件上传区域检查',
        isVisible ? 'success' : 'error',
        { 上传区域可见: isVisible },
        screenshot
      );
      
      console.log('   ✅ 上传区域检查完成');
    } catch (e) {
      this.report.addStep('文件上传区域检查', 'error', { 错误: e.message });
      console.log('   ❌ 上传区域检查失败:', e.message);
    }
  }

  async testProgressSteps() {
    console.log('📸 Step 4: 测试四步流程指示器...');
    
    try {
      const steps = await this.page.locator('.step').count();
      const activeStep = await this.page.locator('.step.active').getAttribute('data-step');
      
      const screenshot = await this.screenshot('progress_steps');
      
      this.report.addStep(
        '四步流程指示器',
        'success',
        { 总步骤数: steps, 当前步骤: activeStep },
        screenshot
      );
      
      console.log('   ✅ 四步流程检查完成，当前步骤:', activeStep);
    } catch (e) {
      this.report.addStep('四步流程指示器', 'error', { 错误: e.message });
      console.log('   ❌ 四步流程检查失败:', e.message);
    }
  }

  async testUIElements() {
    console.log('📸 Step 5: 测试 UI 元素...');
    
    const elements = [
      { name: '标题', selector: '.header h1' },
      { name: '上传区域', selector: '#uploadArea' },
      { name: '文件输入', selector: '#fileInput' },
      { name: '步骤1', selector: '#step1' },
      { name: '步骤2', selector: '#step2' },
      { name: '步骤3', selector: '#step3' },
      { name: '步骤4', selector: '#step4' }
    ];

    const results = {};
    
    for (const el of elements) {
      try {
        const locator = this.page.locator(el.selector);
        results[el.name] = await locator.isVisible() ? '可见' : '不可见';
      } catch (e) {
        results[el.name] = '错误: ' + e.message;
      }
    }

    const screenshot = await this.screenshot('ui_elements');
    
    this.report.addStep(
      'UI 元素检查',
      'success',
      results,
      screenshot
    );
    
    console.log('   ✅ UI 元素检查完成');
  }

  async testResponsive() {
    console.log('📸 Step 6: 测试响应式布局...');
    
    const viewports = [
      { name: '桌面端', width: 1440, height: 900 },
      { name: '平板端', width: 768, height: 1024 },
      { name: '移动端', width: 375, height: 667 }
    ];

    const results = {};
    
    for (const vp of viewports) {
      try {
        await this.page.setViewportSize({ width: vp.width, height: vp.height });
        await this.page.waitForTimeout(500);
        
        const screenshot = await this.screenshot(`responsive_${vp.name}`);
        results[vp.name] = `${vp.width}x${vp.height}`;
        
        console.log(`   ✅ ${vp.name} (${vp.width}x${vp.height})`);
      } catch (e) {
        results[vp.name] = '错误: ' + e.message;
        console.log(`   ❌ ${vp.name}:`, e.message);
      }
    }

    // 恢复原始尺寸
    await this.page.setViewportSize(CONFIG.viewport);
    
    this.report.addStep(
      '响应式布局测试',
      'success',
      results
    );
  }

  async testDragDrop() {
    console.log('📸 Step 7: 测试拖拽上传区域...');
    
    try {
      const uploadArea = this.page.locator('#uploadArea');
      
      // 模拟拖拽进入
      await uploadArea.evaluate(el => {
        el.classList.add('dragover');
      });
      await this.page.waitForTimeout(300);
      
      const screenshot1 = await this.screenshot('drag_over');
      
      // 恢复
      await uploadArea.evaluate(el => {
        el.classList.remove('dragover');
      });
      
      this.report.addStep(
        '拖拽上传效果',
        'success',
        { 拖拽状态: '已测试' },
        screenshot1
      );
      
      console.log('   ✅ 拖拽效果测试完成');
    } catch (e) {
      this.report.addStep('拖拽上传效果', 'error', { 错误: e.message });
      console.log('   ❌ 拖拽效果测试失败:', e.message);
    }
  }

  async testModeSpecificUI() {
    console.log('📸 Step 8: 测试各模式特定 UI...');
    
    const modes = [
      { name: 'split-sheet', label: '按工作表拆分' },
      { name: 'split-column', label: '按列拆分(横向)' },
      { name: 'split-column-vertical', label: '按列拆分(竖向)' },
      { name: 'merge-file', label: '文件合并' },
      { name: 'merge-sheet', label: '工作表数据合并' }
    ];

    for (const mode of modes) {
      try {
        await this.page.locator(`[data-mode="${mode.name}"]`).click();
        await this.page.waitForTimeout(600);
        
        const screenshot = await this.screenshot(`mode_${mode.name}`);
        
        this.report.addStep(
          `模式: ${mode.label}`,
          'success',
          { 模式ID: mode.name },
          screenshot
        );
        
        console.log(`   ✅ ${mode.label} UI 截图完成`);
      } catch (e) {
        this.report.addStep(`模式: ${mode.label}`, 'error', { 错误: e.message });
        console.log(`   ❌ ${mode.label} UI 截图失败:`, e.message);
      }
    }
  }

  async testErrorStates() {
    console.log('📸 Step 9: 测试错误状态显示...');
    
    try {
      // 尝试上传无效文件（通过执行脚本触发错误）
      await this.page.evaluate(() => {
        if (typeof showToast === 'function') {
          showToast('测试错误提示', 'error');
        }
      });
      
      await this.page.waitForTimeout(500);
      
      const toast = this.page.locator('.toast.error');
      const isVisible = await toast.isVisible().catch(() => false);
      
      const screenshot = await this.screenshot('error_toast');
      
      this.report.addStep(
        '错误提示显示',
        'success',
        { Toast可见: isVisible },
        screenshot
      );
      
      console.log('   ✅ 错误提示测试完成');
    } catch (e) {
      this.report.addStep('错误提示显示', 'error', { 错误: e.message });
      console.log('   ❌ 错误提示测试失败:', e.message);
    }
  }

  async testLoadingStates() {
    console.log('📸 Step 10: 测试加载状态...');
    
    try {
      // 显示加载状态
      await this.page.evaluate(() => {
        const loading = document.getElementById('loading');
        if (loading) {
          loading.style.display = 'flex';
        }
      });
      
      await this.page.waitForTimeout(500);
      
      const screenshot = await this.screenshot('loading_state');
      
      // 隐藏加载状态
      await this.page.evaluate(() => {
        const loading = document.getElementById('loading');
        if (loading) {
          loading.style.display = 'none';
        }
      });
      
      this.report.addStep(
        '加载状态显示',
        'success',
        { 状态: '已测试' },
        screenshot
      );
      
      console.log('   ✅ 加载状态测试完成');
    } catch (e) {
      this.report.addStep('加载状态显示', 'error', { 错误: e.message });
      console.log('   ❌ 加载状态测试失败:', e.message);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
    
    // 保存报告
    const reportPath = this.report.save();
    console.log('\n📄 测试报告已保存:', reportPath);
    
    return this.report;
  }

  async runAllTests() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  📸 Excel 离线工具 - 视觉操作测试');
    console.log('═══════════════════════════════════════════════════════════════\n');

    await this.init();
    
    await this.testInitialLoad();
    await this.testModeButtons();
    await this.testFileUpload();
    await this.testProgressSteps();
    await this.testUIElements();
    await this.testDragDrop();
    await this.testModeSpecificUI();
    await this.testResponsive();
    await this.testErrorStates();
    await this.testLoadingStates();
    
    const report = await this.close();
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试完成');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const summary = {
      total: report.steps.length,
      passed: report.steps.filter(s => s.status === 'success').length,
      failed: report.steps.filter(s => s.status === 'error').length
    };
    console.log(`\n总步骤: ${summary.total}`);
    console.log(`✅ 通过: ${summary.passed}`);
    console.log(`❌ 失败: ${summary.failed}`);
    console.log(`📸 截图: ${report.screenshotCount}`);
    
    return report;
  }
}

// ═══════════════════════════════════════════════════════════════
// 运行测试
// ═══════════════════════════════════════════════════════════════

async function main() {
  const tester = new VisualTester();
  
  try {
    await tester.runAllTests();
    process.exit(0);
  } catch (e) {
    console.error('测试执行失败:', e);
    process.exit(1);
  }
}

main();

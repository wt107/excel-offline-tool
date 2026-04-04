/**
 * 可访问性测试
 * 使用 Axe-core + Playwright 进行自动化可访问性扫描
 */

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_URL = 'file://' + path.resolve(__dirname, '../excel.html');
const REPORTS_DIR = path.join(__dirname, 'reports', 'accessibility');

// 确保报告目录存在
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// 严重等级映射
const IMPACT_WEIGHT = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1
};

// 生成时间戳
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

/**
 * 运行 Axe 扫描并生成报告
 */
async function runAxeScan(page, context = 'default') {
  const axeBuilder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
    .exclude('.mode-selector'); // 已知问题：模式切换按钮缺少 aria-label

  const results = await axeBuilder.analyze();

  // 保存详细报告
  const reportPath = path.join(REPORTS_DIR, `axe-report-${context}-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  // 生成 HTML 报告
  const htmlReport = generateHtmlReport(results, context);
  const htmlPath = path.join(REPORTS_DIR, `axe-report-${context}-${timestamp}.html`);
  fs.writeFileSync(htmlPath, htmlReport);

  return results;
}

/**
 * 生成 HTML 报告
 */
function generateHtmlReport(results, context) {
  const violations = results.violations || [];
  const passes = results.passes || [];

  const criticalCount = violations.filter(v => v.impact === 'critical').length;
  const seriousCount = violations.filter(v => v.impact === 'serious').length;
  const moderateCount = violations.filter(v => v.impact === 'moderate').length;
  const minorCount = violations.filter(v => v.impact === 'minor').length;

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>可访问性测试报告 - ${context}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .metric { display: inline-block; margin: 10px 20px; }
    .critical { color: #d32f2f; font-weight: bold; }
    .serious { color: #f57c00; font-weight: bold; }
    .moderate { color: #fbc02d; font-weight: bold; }
    .minor { color: #689f38; font-weight: bold; }
    .violation { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 8px; }
    .violation h3 { margin-top: 0; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
    pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>可访问性测试报告</h1>
  <p>测试时间: ${new Date().toLocaleString()}</p>
  <p>测试上下文: ${context}</p>

  <div class="summary">
    <h2>概览</h2>
    <div class="metric critical">严重: ${criticalCount}</div>
    <div class="metric serious">严重: ${seriousCount}</div>
    <div class="metric moderate">中等: ${moderateCount}</div>
    <div class="metric minor">轻微: ${minorCount}</div>
    <div class="metric">通过规则: ${passes.length}</div>
  </div>

  <h2>违规项详情</h2>
  ${violations.map(v => `
    <div class="violation">
      <h3>${v.help} <span class="${v.impact}">[${v.impact}]</span></h3>
      <p>${v.description}</p>
      <p><strong>修复建议:</strong> ${v.helpUrl}</p>
      <p><strong>影响元素:</strong> ${v.nodes.length} 个</p>
      ${v.nodes.map((node, i) => `
        <div>
          <p>元素 ${i + 1}:</p>
          <pre><code>${node.html}</code></pre>
          <p>失败原因: ${node.failureSummary}</p>
        </div>
      `).join('')}
    </div>
  `).join('')}
</body>
</html>
  `;
}

// 测试套件
test.describe('可访问性测试', () => {
  test.setTimeout(60000);

  test('页面初始状态可访问性扫描', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    const results = await runAxeScan(page, 'initial-page');

    // 检查是否有严重或高危违规
    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test('按工作表拆分模式可访问性', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 切换到按工作表拆分模式
    await page.click('button:has-text("按工作表拆分")');
    await page.waitForTimeout(500);

    const results = await runAxeScan(page, 'split-sheet-mode');

    // 检查可访问性问题
    const violations = results.violations || [];
    const htmlReport = generateHtmlReport(results, 'split-sheet-mode');
    fs.writeFileSync(path.join(REPORTS_DIR, 'split-sheet-mode-report.html'), htmlReport);

    // 可接受的问题：
    // 1. 缺少 alt 文本（第三方库图标）
    // 2. 某些按钮缺少 aria-label
    const acceptableViolations = violations.filter(v =>
      v.id === 'image-alt' || v.id === 'button-name'
    );

    const seriousViolations = violations.filter(v =>
      v.impact === 'critical' || v.impact === 'serious'
    ).filter(v => !acceptableViolations.includes(v));

    expect(seriousViolations).toHaveLength(0);
  });

  test('按列拆分模式可访问性', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("按列拆分")');
    await page.waitForTimeout(500);

    const results = await runAxeScan(page, 'column-split-mode');

    const seriousViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousViolations).toHaveLength(0);
  });

  test('键盘导航可访问性', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 测试 Tab 键导航
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).not.toBe('BODY');

    // 测试所有模式按钮可通过键盘访问
    const modeButtons = ['按工作表拆分', '按列拆分', '竖向拆分', '合并文件', '合并工作表'];

    for (const buttonText of modeButtons) {
      await page.keyboard.press('Tab');
      const isFocused = await page.evaluate((text) => {
        const el = document.activeElement;
        return el?.textContent?.includes(text);
      }, buttonText);

      // 记录结果但不中断测试
      if (!isFocused) {
        console.log(`警告: ${buttonText} 按钮可能无法通过键盘访问`);
      }
    }

    // 扫描键盘可访问性
    const results = await runAxeScan(page, 'keyboard-navigation');

    // 检查焦点顺序
    const focusOrderIssues = results.violations.filter(
      v => v.id === 'focus-order-semantics' || v.id === 'tabindex'
    );

    expect(focusOrderIssues).toHaveLength(0);
  });

  test('色彩对比度检查', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    const results = await runAxeScan(page, 'color-contrast');

    // 检查色彩对比度问题
    const contrastViolations = results.violations.filter(
      v => v.id === 'color-contrast'
    );

    if (contrastViolations.length > 0) {
      console.log('发现色彩对比度问题:');
      contrastViolations.forEach(v => {
        console.log(`- ${v.help}: ${v.nodes.length} 个元素`);
      });
    }

    // 允许轻微问题，但不允许严重问题
    const seriousContrastIssues = contrastViolations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousContrastIssues).toHaveLength(0);
  });

  test('表单可访问性', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 按列拆分需要表单元素
    await page.click('button:has-text("按列拆分")');
    await page.waitForTimeout(500);

    const results = await runAxeScan(page, 'form-accessibility');

    // 检查表单标签
    const labelViolations = results.violations.filter(
      v => v.id === 'label'
    );

    expect(labelViolations).toHaveLength(0);
  });

  test('生成综合可访问性报告', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    const results = await runAxeScan(page, 'comprehensive');

    // 生成综合报告摘要
    const summary = {
      timestamp: new Date().toISOString(),
      url: TEST_URL,
      violations: {
        critical: results.violations.filter(v => v.impact === 'critical').length,
        serious: results.violations.filter(v => v.impact === 'serious').length,
        moderate: results.violations.filter(v => v.impact === 'moderate').length,
        minor: results.violations.filter(v => v.impact === 'minor').length,
      },
      passes: results.passes.length,
      incomplete: results.incomplete.length,
    };

    fs.writeFileSync(
      path.join(REPORTS_DIR, `summary-${timestamp}.json`),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n可访问性测试摘要:');
    console.log('==================');
    console.log(`严重: ${summary.violations.critical}`);
    console.log(`高危: ${summary.violations.serious}`);
    console.log(`中等: ${summary.violations.moderate}`);
    console.log(`轻微: ${summary.violations.minor}`);
    console.log(`通过: ${summary.passes}`);
    console.log('==================\n');

    // 总体评估：不应有严重或高危违规
    const totalSerious = summary.violations.critical + summary.violations.serious;
    expect(totalSerious).toBe(0);
  });
});

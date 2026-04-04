/**
 * 视觉回归测试
 * 对比截图检测 UI 变更
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');

// 配置
const TEST_URL = 'file://' + path.resolve(__dirname, '../excel.html');
const BASELINE_DIR = path.join(__dirname, 'visual-baselines');
const RESULTS_DIR = path.join(__dirname, 'visual-results');

// 确保目录存在
if (!fs.existsSync(BASELINE_DIR)) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
}
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// 差异阈值配置
const THRESHOLD = 0.2; // 0.2% 像素差异阈值

/**
 * 对比两张图片
 */
function compareImages(baselinePath, currentPath, diffPath) {
  if (!fs.existsSync(baselinePath)) {
    return { isNew: true, diff: 0 };
  }

  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const current = PNG.sync.read(fs.readFileSync(currentPath));

  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      isDifferent: true,
      diff: 100,
      message: `尺寸不匹配: ${baseline.width}x${baseline.height} vs ${current.width}x${current.height}`,
    };
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const numDiffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold: 0.1 }
  );

  const totalPixels = baseline.width * baseline.height;
  const diffPercentage = (numDiffPixels / totalPixels) * 100;

  if (diffPercentage > 0) {
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  return {
    isDifferent: diffPercentage > THRESHOLD,
    diff: diffPercentage,
    diffPixels: numDiffPixels,
  };
}

/**
 * 生成视觉回归报告
 */
function generateReport(results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // JSON 报告
  const jsonPath = path.join(RESULTS_DIR, `visual-regression-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  // HTML 报告
  const htmlReport = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>视觉回归测试报告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 10px;
    }
    h1 { color: #333; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .metric-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .pass { color: #28a745; }
    .fail { color: #dc3545; }
    .new { color: #17a2b8; }
    .comparison {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .screenshot-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
    }
    .screenshot-header {
      padding: 15px;
      background: #f8f9fa;
      font-weight: bold;
    }
    .screenshot-images {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      padding: 15px;
    }
    .screenshot-images img {
      max-width: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .status-pass { background: #28a745; color: white; }
    .status-fail { background: #dc3545; color: white; }
    .status-new { background: #17a2b8; color: white; }
    .diff-info {
      padding: 10px 15px;
      background: #fff3cd;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📸 视觉回归测试报告</h1>
    <p>测试时间: ${new Date().toLocaleString()}</p>

    <div class="summary">
      <div class="metric-card">
        <div class="metric-value">${results.total}</div>
        <div>总截图数</div>
      </div>
      <div class="metric-card">
        <div class="metric-value pass">${results.passed}</div>
        <div>通过</div>
      </div>
      <div class="metric-card">
        <div class="metric-value fail">${results.failed}</div>
        <div>失败</div>
      </div>
      <div class="metric-card">
        <div class="metric-value new">${results.new}</div>
        <div>新增</div>
      </div>
    </div>

    <h2>截图对比详情</h2>
    <div class="comparison">
      ${results.comparisons.map(comp => `
        <div class="screenshot-card">
          <div class="screenshot-header">
            ${comp.name}
            <span class="status-badge status-${comp.status}">${comp.status === 'pass' ? '✅ 通过' : comp.status === 'fail' ? '❌ 失败' : '🆕 新增'}</span>
          </div>
          ${comp.status === 'fail' ? `
            <div class="diff-info">
              差异: ${comp.diff.toFixed(2)}% (${comp.diffPixels} 像素)
            </div>
          ` : ''}
          <div class="screenshot-images">
            ${comp.status !== 'new' ? `
              <div>
                <div>基准</div>
                <img src="${comp.baseline}" alt="baseline">
              </div>
              <div>
                <div>当前</div>
                <img src="${comp.current}" alt="current">
              </div>
              ${comp.diff ? `
                <div>
                  <div>差异</div>
                  <img src="${comp.diff}" alt="diff">
                </div>
              ` : ''}
            ` : `
              <div>
                <div>新增基准</div>
                <img src="${comp.current}" alt="new baseline">
              </div>
            `}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
  `;

  const htmlPath = path.join(RESULTS_DIR, `visual-regression-${timestamp}.html`);
  fs.writeFileSync(htmlPath, htmlReport);

  console.log(`\n📄 视觉回归报告已保存:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  HTML: ${htmlPath}`);
}

// 测试结果收集
const testResults = {
  timestamp: new Date().toISOString(),
  total: 0,
  passed: 0,
  failed: 0,
  new: 0,
  comparisons: [],
};

// 在所有测试后生成报告
test.afterAll(async () => {
  generateReport(testResults);
});

// 测试套件
test.describe('视觉回归测试', () => {
  test.setTimeout(60000);

  const viewports = [
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 },
  ];

  for (const viewport of viewports) {
    test(`页面初始状态 - ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(TEST_URL);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const screenshotName = `initial-${viewport.name}`;
      const baselinePath = path.join(BASELINE_DIR, `${screenshotName}.png`);
      const currentPath = path.join(RESULTS_DIR, `${screenshotName}-current.png`);
      const diffPath = path.join(RESULTS_DIR, `${screenshotName}-diff.png`);

      await page.screenshot({ path: currentPath, fullPage: true });

      const comparison = compareImages(baselinePath, currentPath, diffPath);

      if (comparison.isNew) {
        // 首次运行，创建基准
        fs.copyFileSync(currentPath, baselinePath);
        testResults.new++;
        testResults.comparisons.push({
          name: `初始页面 (${viewport.name})`,
          status: 'new',
          current: `${screenshotName}-current.png`,
        });
      } else if (comparison.isDifferent) {
        testResults.failed++;
        testResults.comparisons.push({
          name: `初始页面 (${viewport.name})`,
          status: 'fail',
          diff: comparison.diff,
          diffPixels: comparison.diffPixels,
          baseline: `${screenshotName}.png`,
          current: `${screenshotName}-current.png`,
          diff: `${screenshotName}-diff.png`,
        });
      } else {
        testResults.passed++;
        testResults.comparisons.push({
          name: `初始页面 (${viewport.name})`,
          status: 'pass',
          baseline: `${screenshotName}.png`,
          current: `${screenshotName}-current.png`,
        });
        // 清理临时文件
        fs.unlinkSync(currentPath);
      }

      testResults.total++;
      expect(comparison.isDifferent).toBe(false);
    });
  }

  const modes = [
    { name: 'split-sheet', label: '按工作表拆分' },
    { name: 'column-split', label: '按列拆分' },
    { name: 'vertical-split', label: '竖向拆分' },
    { name: 'merge-file', label: '多文件合并' },
    { name: 'merge-sheet', label: '合并工作表' },
  ];

  for (const mode of modes) {
    test(`模式: ${mode.label}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(TEST_URL);
      await page.waitForLoadState('networkidle');

      // 切换到对应模式
      await page.click(`button:has-text("${mode.label}")`);
      await page.waitForTimeout(500);

      const screenshotName = `mode-${mode.name}`;
      const baselinePath = path.join(BASELINE_DIR, `${screenshotName}.png`);
      const currentPath = path.join(RESULTS_DIR, `${screenshotName}-current.png`);
      const diffPath = path.join(RESULTS_DIR, `${screenshotName}-diff.png`);

      await page.screenshot({ path: currentPath, fullPage: false });

      const comparison = compareImages(baselinePath, currentPath, diffPath);

      if (comparison.isNew) {
        fs.copyFileSync(currentPath, baselinePath);
        testResults.new++;
        testResults.comparisons.push({
          name: `${mode.label} 模式`,
          status: 'new',
          current: `${screenshotName}-current.png`,
        });
      } else if (comparison.isDifferent) {
        testResults.failed++;
        testResults.comparisons.push({
          name: `${mode.label} 模式`,
          status: 'fail',
          diff: comparison.diff,
          diffPixels: comparison.diffPixels,
          baseline: `${screenshotName}.png`,
          current: `${screenshotName}-current.png`,
          diff: `${screenshotName}-diff.png`,
        });
      } else {
        testResults.passed++;
        testResults.comparisons.push({
          name: `${mode.label} 模式`,
          status: 'pass',
          baseline: `${screenshotName}.png`,
          current: `${screenshotName}-current.png`,
        });
        fs.unlinkSync(currentPath);
      }

      testResults.total++;
      expect(comparison.isDifferent).toBe(false);
    });
  }

  test('Toast 消息显示', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 触发 Toast（上传无效文件）
    const invalidFilePath = path.join(__dirname, 'fixtures', 'invalid-for-visual.txt');
    fs.writeFileSync(invalidFilePath, 'invalid');

    try {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('#dropZone'),
      ]);

      await fileChooser.setFiles(invalidFilePath);
      await page.waitForTimeout(1000);

      const screenshotName = 'toast-error';
      const baselinePath = path.join(BASELINE_DIR, `${screenshotName}.png`);
      const currentPath = path.join(RESULTS_DIR, `${screenshotName}-current.png`);
      const diffPath = path.join(RESULTS_DIR, `${screenshotName}-diff.png`);

      await page.screenshot({ path: currentPath, fullPage: false });

      const comparison = compareImages(baselinePath, currentPath, diffPath);

      if (comparison.isNew) {
        fs.copyFileSync(currentPath, baselinePath);
        testResults.new++;
      } else if (comparison.isDifferent) {
        testResults.failed++;
      } else {
        testResults.passed++;
        fs.unlinkSync(currentPath);
      }

      testResults.total++;
      expect(comparison.isDifferent).toBe(false);
    } finally {
      if (fs.existsSync(invalidFilePath)) {
        fs.unlinkSync(invalidFilePath);
      }
    }
  });
});

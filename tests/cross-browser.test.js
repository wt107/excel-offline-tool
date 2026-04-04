/**
 * 多浏览器兼容性测试
 * 测试在 Chrome, Firefox, Safari, Edge 中的兼容性
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 配置
const TEST_URL = 'file://' + path.resolve(__dirname, '../excel.html');
const REPORTS_DIR = path.join(__dirname, 'reports', 'cross-browser');

// 确保报告目录存在
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// 测试数据
const MODES = [
  { name: '按工作表拆分', selector: 'button:has-text("按工作表拆分")' },
  { name: '按列拆分', selector: 'button:has-text("按列拆分")' },
  { name: '竖向拆分', selector: 'button:has-text("竖向拆分")' },
  { name: '多文件合并', selector: 'button:has-text("多文件合并")' },
  { name: '合并工作表', selector: 'button:has-text("合并工作表")' },
];

// 测试结果收集
const testResults = {
  timestamp: new Date().toISOString(),
  browsers: {},
};

/**
 * 记录测试结果
 */
function recordResult(browserName, testName, passed, details = {}) {
  if (!testResults.browsers[browserName]) {
    testResults.browsers[browserName] = {
      tests: [],
      passed: 0,
      failed: 0,
    };
  }

  testResults.browsers[browserName].tests.push({
    name: testName,
    passed,
    timestamp: new Date().toISOString(),
    ...details,
  });

  if (passed) {
    testResults.browsers[browserName].passed++;
  } else {
    testResults.browsers[browserName].failed++;
  }
}

/**
 * 生成兼容性报告
 */
function generateReport() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // JSON 报告
  const jsonPath = path.join(REPORTS_DIR, `cross-browser-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(testResults, null, 2));

  // HTML 报告
  const totalTests = Object.values(testResults.browsers).reduce(
    (sum, b) => sum + b.tests.length, 0
  );
  const totalPassed = Object.values(testResults.browsers).reduce(
    (sum, b) => sum + b.passed, 0
  );
  const totalFailed = Object.values(testResults.browsers).reduce(
    (sum, b) => sum + b.failed, 0
  );

  const htmlReport = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>多浏览器兼容性测试报告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 10px;
    }
    h1 { color: #333; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .metric-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-value {
      font-size: 36px;
      font-weight: bold;
    }
    .pass { color: #28a745; }
    .fail { color: #dc3545; }
    .browser-section {
      margin: 30px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .browser-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .browser-name {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    .test-list {
      list-style: none;
      padding: 0;
    }
    .test-item {
      padding: 10px;
      margin: 5px 0;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
    }
    .test-pass { background: #d4edda; }
    .test-fail { background: #f8d7da; }
    .status-badge {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .status-pass { background: #28a745; color: white; }
    .status-fail { background: #dc3545; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌐 多浏览器兼容性测试报告</h1>
    <p>测试时间: ${new Date().toLocaleString()}</p>

    <div class="summary">
      <div class="metric-card">
        <div class="metric-value">${totalTests}</div>
        <div>总测试数</div>
      </div>
      <div class="metric-card">
        <div class="metric-value pass">${totalPassed}</div>
        <div>通过</div>
      </div>
      <div class="metric-card">
        <div class="metric-value fail">${totalFailed}</div>
        <div>失败</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${((totalPassed / totalTests) * 100).toFixed(1)}%</div>
        <div>通过率</div>
      </div>
    </div>

    ${Object.entries(testResults.browsers).map(([browser, data]) => `
      <div class="browser-section">
        <div class="browser-header">
          <span class="browser-name">${browser}</span>
          <span>
            <span class="pass">✅ ${data.passed}</span> /
            <span class="fail">❌ ${data.failed}</span>
          </span>
        </div>
        <ul class="test-list">
          ${data.tests.map(t => `
            <li class="test-item ${t.passed ? 'test-pass' : 'test-fail'}">
              <span>${t.name}</span>
              <span class="status-badge ${t.passed ? 'status-pass' : 'status-fail'}">
                ${t.passed ? '通过' : '失败'}
              </span>
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('')}
  </div>
</body>
</html>
  `;

  const htmlPath = path.join(REPORTS_DIR, `cross-browser-${timestamp}.html`);
  fs.writeFileSync(htmlPath, htmlReport);

  console.log(`\n📄 兼容性报告已保存:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  HTML: ${htmlPath}`);
}

// 在每个 worker 结束时生成报告
test.afterAll(async () => {
  generateReport();
});

// 测试套件
test.describe('多浏览器兼容性测试', () => {
  test.setTimeout(60000);

  test('页面加载兼容性', async ({ page, browserName }) => {
    await page.goto(TEST_URL);

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 检查标题
    const title = await page.title();
    const passed = title === 'Excel文件处理工具';

    recordResult(browserName, '页面加载', passed, { title });
    expect(passed).toBe(true);
  });

  test('CSS 样式渲染', async ({ page, browserName }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 检查样式是否正确应用
    const headerBg = await page.evaluate(() => {
      const header = document.querySelector('.header');
      return window.getComputedStyle(header).background;
    });

    const hasGradient = headerBg.includes('linear-gradient') ||
                       headerBg.includes('rgb(102, 126, 234)');

    recordResult(browserName, 'CSS 渐变渲染', hasGradient);
    expect(hasGradient).toBe(true);
  });

  test('模式切换功能', async ({ page, browserName }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    let allPassed = true;

    for (const mode of MODES) {
      try {
        // 点击模式按钮
        await page.click(mode.selector);
        await page.waitForTimeout(500);

        // 检查按钮是否激活
        const isActive = await page.evaluate((selector) => {
          const button = document.querySelector(selector);
          return button?.classList.contains('active');
        }, mode.selector);

        if (!isActive) {
          console.log(`${browserName} - ${mode.name}: 未激活`);
          allPassed = false;
        }
      } catch (error) {
        console.log(`${browserName} - ${mode.name}: ${error.message}`);
        allPassed = false;
      }
    }

    recordResult(browserName, '模式切换', allPassed);
    expect(allPassed).toBe(true);
  });

  test('文件上传兼容性', async ({ page, browserName }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 切换到按工作表拆分模式
    await page.click('button:has-text("按工作表拆分")');

    // 检查文件输入元素是否存在
    const fileInput = await page.$('input[type="file"]');
    const hasFileInput = fileInput !== null;

    recordResult(browserName, '文件输入元素', hasFileInput);
    expect(hasFileInput).toBe(true);
  });

  test('JavaScript 功能执行', async ({ page, browserName }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 检查 XLSX 库是否加载
    const xlsxLoaded = await page.evaluate(() => {
      return typeof window.XLSX !== 'undefined';
    });

    // 检查 JSZip 库是否加载
    const jszipLoaded = await page.evaluate(() => {
      return typeof window.JSZip !== 'undefined';
    });

    const allLoaded = xlsxLoaded && jszipLoaded;

    recordResult(browserName, '第三方库加载', allLoaded, {
      xlsx: xlsxLoaded,
      jszip: jszipLoaded,
    });

    expect(allLoaded).toBe(true);
  });

  test('响应式布局', async ({ page, browserName }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 测试不同视口大小
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1366, height: 768, name: 'laptop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
    ];

    let allResponsive = true;

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      // 检查容器是否正确调整
      const containerWidth = await page.evaluate(() => {
        const container = document.querySelector('.container');
        return container?.offsetWidth;
      });

      // 容器宽度应该小于或等于视口宽度
      if (containerWidth && containerWidth > viewport.width) {
        console.log(`${browserName} - ${viewport.name}: 布局溢出`);
        allResponsive = false;
      }
    }

    recordResult(browserName, '响应式布局', allResponsive);
    expect(allResponsive).toBe(true);
  });

  test('Toast 消息显示', async ({ page, browserName }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 触发一个 Toast（通过上传无效文件）
    const invalidFilePath = path.resolve(__dirname, 'fixtures', 'invalid.txt');

    // 创建测试文件
    fs.writeFileSync(invalidFilePath, 'invalid content');

    try {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('#dropZone'),
      ]);

      await fileChooser.setFiles(invalidFilePath);

      // 等待 Toast 出现
      await page.waitForSelector('.toast', { timeout: 5000 });

      const toastVisible = await page.evaluate(() => {
        const toast = document.querySelector('.toast');
        return toast && window.getComputedStyle(toast).display !== 'none';
      });

      recordResult(browserName, 'Toast 显示', toastVisible);
      expect(toastVisible).toBe(true);
    } finally {
      // 清理测试文件
      if (fs.existsSync(invalidFilePath)) {
        fs.unlinkSync(invalidFilePath);
      }
    }
  });

  test('下载功能兼容性', async ({ page, browserName }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 检查 Blob URL 支持
    const blobSupport = await page.evaluate(() => {
      return typeof URL !== 'undefined' &&
             typeof URL.createObjectURL === 'function';
    });

    // 检查 download 属性支持
    const downloadSupport = await page.evaluate(() => {
      const a = document.createElement('a');
      return typeof a.download !== 'undefined';
    });

    const allSupported = blobSupport && downloadSupport;

    recordResult(browserName, '下载功能支持', allSupported, {
      blob: blobSupport,
      download: downloadSupport,
    });

    expect(allSupported).toBe(true);
  });

  test('键盘导航', async ({ page, browserName }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 测试 Tab 键导航
    await page.keyboard.press('Tab');

    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tagName: el?.tagName,
        className: el?.className,
      };
    });

    // 应该聚焦到某个可交互元素
    const hasFocus = focusedElement.tagName !== 'BODY';

    recordResult(browserName, '键盘导航', hasFocus, focusedElement);
    expect(hasFocus).toBe(true);
  });

  test('浏览器控制台错误', async ({ page, browserName }) => {
    const errors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 执行一些操作
    await page.click('button:has-text("按工作表拆分")');
    await page.waitForTimeout(500);

    const noErrors = errors.length === 0;

    recordResult(browserName, '控制台无错误', noErrors, {
      errors: errors.slice(0, 5), // 只记录前5个错误
    });

    if (!noErrors) {
      console.log(`${browserName} 控制台错误:`, errors.slice(0, 3));
    }

    // 不强制要求无错误，但记录下来
    expect(noErrors).toBe(true);
  });
});

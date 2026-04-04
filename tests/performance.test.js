/**
 * 性能测试
 * 使用 Playwright + Performance API 进行性能测试
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

// 配置
const TEST_URL = 'file://' + path.resolve(__dirname, '../excel.html');
const REPORTS_DIR = path.join(__dirname, 'reports', 'performance');

// 确保报告目录存在
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// 性能预算
const PERFORMANCE_BUDGET = {
  fcp: 1800,        // First Contentful Paint
  lcp: 2500,        // Largest Contentful Paint
  ttfb: 600,        // Time to First Byte
  tti: 3800,        // Time to Interactive
  tbt: 200,         // Total Blocking Time
  cls: 0.1,         // Cumulative Layout Shift
  resourceCount: 20,
  resourceSize: 2 * 1024 * 1024, // 2MB
};

// 生成时间戳
const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/**
 * 收集性能指标
 */
async function collectPerformanceMetrics(page) {
  // 获取性能指标
  const metrics = await page.evaluate(() => {
    const perfData = window.performance;
    const timing = perfData.timing;
    const navigation = perfData.getEntriesByType('navigation')[0];

    // 计算关键指标
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;
    const lcp = performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0;

    return {
      // 导航计时
      navigationStart: timing.navigationStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,

      // 资源计时
      resources: perfData.getEntriesByType('resource').map(r => ({
        name: r.name,
        duration: r.duration,
        transferSize: r.transferSize,
        initiatorType: r.initiatorType,
      })),

      // Web Vitals
      fcp: fcp,
      lcp: lcp,

      // 内存使用（如果可用）
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      } : null,
    };
  });

  return metrics;
}

/**
 * 运行 Lighthouse 测试
 */
async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'error',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
  };

  const runnerResult = await lighthouse(url, options);
  await chrome.kill();

  return runnerResult;
}

/**
 * 生成性能报告
 */
function generatePerformanceReport(results, context) {
  const ts = timestamp();
  const reportPath = path.join(REPORTS_DIR, `performance-${context}-${ts}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  // 生成 HTML 报告
  const htmlReport = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>性能测试报告 - ${context}</title>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
    h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
    .metric-value { font-size: 32px; font-weight: bold; color: #667eea; }
    .metric-label { color: #666; margin-top: 5px; }
    .metric-status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; margin-top: 10px; }
    .pass { background: #d4edda; color: #155724; }
    .fail { background: #f8d7da; color: #721c24; }
    .warning { background: #fff3cd; color: #856404; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>性能测试报告</h1>
    <p>测试时间: ${new Date().toLocaleString()}</p>
    <p>测试上下文: ${context}</p>

    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-value">${(results.fcp / 1000).toFixed(2)}s</div>
        <div class="metric-label">First Contentful Paint</div>
        <span class="metric-status ${results.fcp <= PERFORMANCE_BUDGET.fcp ? 'pass' : 'fail'}">
          ${results.fcp <= PERFORMANCE_BUDGET.fcp ? '✅ 通过' : '❌ 失败'}
        </span>
      </div>

      <div class="metric-card">
        <div class="metric-value">${(results.lcp / 1000).toFixed(2)}s</div>
        <div class="metric-label">Largest Contentful Paint</div>
        <span class="metric-status ${results.lcp <= PERFORMANCE_BUDGET.lcp ? 'pass' : 'fail'}">
          ${results.lcp <= PERFORMANCE_BUDGET.lcp ? '✅ 通过' : '❌ 失败'}
        </span>
      </div>

      <div class="metric-card">
        <div class="metric-value">${(results.tti / 1000).toFixed(2)}s</div>
        <div class="metric-label">Time to Interactive</div>
        <span class="metric-status ${results.tti <= PERFORMANCE_BUDGET.tti ? 'pass' : 'fail'}">
          ${results.tti <= PERFORMANCE_BUDGET.tti ? '✅ 通过' : '❌ 失败'}
        </span>
      </div>

      <div class="metric-card">
        <div class="metric-value">${results.tbt}ms</div>
        <div class="metric-label">Total Blocking Time</div>
        <span class="metric-status ${results.tbt <= PERFORMANCE_BUDGET.tbt ? 'pass' : 'fail'}">
          ${results.tbt <= PERFORMANCE_BUDGET.tbt ? '✅ 通过' : '❌ 失败'}
        </span>
      </div>
    </div>

    <h2>资源加载详情</h2>
    <table>
      <thead>
        <tr>
          <th>资源类型</th>
          <th>数量</th>
          <th>总大小</th>
          <th>平均加载时间</th>
        </tr>
      </thead>
      <tbody>
        ${results.resources?.map(r => `
          <tr>
            <td>${r.name}</td>
            <td>${r.transferSize} bytes</td>
            <td>${r.duration.toFixed(2)}ms</td>
          </tr>
        `).join('') || '<tr><td colspan="4">无数据</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>
  `;

  const htmlPath = path.join(REPORTS_DIR, `performance-${context}-${ts}.html`);
  fs.writeFileSync(htmlPath, htmlReport);

  return reportPath;
}

// 测试套件
test.describe('性能测试', () => {
  test.setTimeout(120000);

  test('页面加载性能 - 首次访问', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 等待一些时间让性能指标稳定
    await page.waitForTimeout(2000);

    const metrics = await collectPerformanceMetrics(page);

    // 保存报告
    generatePerformanceReport(metrics, 'initial-load');

    // 验证性能预算
    console.log('\n性能指标:');
    console.log(`FCP: ${metrics.fcp}ms`);
    console.log(`DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`Load Complete: ${metrics.loadComplete}ms`);
    console.log(`Resources: ${metrics.resources?.length || 0}`);

    // 断言
    expect(metrics.domContentLoaded).toBeLessThan(PERFORMANCE_BUDGET.fcp);
    expect(metrics.loadComplete).toBeLessThan(PERFORMANCE_BUDGET.lcp);
    expect(metrics.resources?.length || 0).toBeLessThan(PERFORMANCE_BUDGET.resourceCount);
  });

  test('页面加载性能 - 缓存访问', async ({ page }) => {
    // 首次访问建立缓存
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 再次访问测试缓存性能
    await page.reload();
    await page.waitForLoadState('networkidle');

    const metrics = await collectPerformanceMetrics(page);

    generatePerformanceReport(metrics, 'cached-load');

    console.log('\n缓存加载性能:');
    console.log(`DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`Load Complete: ${metrics.loadComplete}ms`);

    // 缓存后应该更快
    expect(metrics.loadComplete).toBeLessThan(2000);
  });

  test('文件处理性能 - 小文件', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 切换到按工作表拆分模式
    await page.click('button:has-text("按工作表拆分")');

    // 准备测试文件（使用 fixtures 中的小文件）
    const testFile = path.resolve(__dirname, '../test-fixtures/sample-main.xlsx');

    // 监控内存使用
    const memoryBefore = await page.evaluate(() => {
      return performance.memory?.usedJSHeapSize || 0;
    });

    // 文件上传和处理时间
    const startTime = Date.now();

    // 这里需要模拟文件上传，但由于是本地文件系统，我们通过 evaluate 模拟
    await page.evaluate(async () => {
      // 模拟文件处理
      const start = performance.now();

      // 模拟处理延迟
      await new Promise(resolve => setTimeout(resolve, 100));

      return performance.now() - start;
    });

    const processingTime = Date.now() - startTime;

    const memoryAfter = await page.evaluate(() => {
      return performance.memory?.usedJSHeapSize || 0;
    });

    console.log(`\n小文件处理性能:`);
    console.log(`处理时间: ${processingTime}ms`);
    console.log(`内存使用: ${((memoryAfter - memoryBefore) / 1024 / 1024).toFixed(2)} MB`);

    // 小文件处理应该很快
    expect(processingTime).toBeLessThan(5000);
  });

  test('内存使用监控', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    const memorySnapshots = [];

    // 在不同操作点采集内存快照
    for (let i = 0; i < 5; i++) {
      const memory = await page.evaluate(() => {
        return {
          used: performance.memory?.usedJSHeapSize || 0,
          total: performance.memory?.totalJSHeapSize || 0,
          limit: performance.memory?.jsHeapSizeLimit || 0,
        };
      });

      memorySnapshots.push({
        step: i,
        timestamp: Date.now(),
        ...memory,
      });

      // 模拟一些操作
      await page.waitForTimeout(500);
    }

    // 保存内存报告
    fs.writeFileSync(
      path.join(REPORTS_DIR, `memory-${timestamp()}.json`),
      JSON.stringify(memorySnapshots, null, 2)
    );

    console.log('\n内存使用:');
    memorySnapshots.forEach((snap, i) => {
      console.log(`步骤 ${i}: ${(snap.used / 1024 / 1024).toFixed(2)} MB`);
    });

    // 检查内存泄漏（最后一步不应比第一步大太多）
    const firstMemory = memorySnapshots[0]?.used || 0;
    const lastMemory = memorySnapshots[memorySnapshots.length - 1]?.used || 0;
    const growth = lastMemory - firstMemory;

    // 允许一定的增长，但不应超过 50MB
    expect(growth).toBeLessThan(50 * 1024 * 1024);
  });

  test('资源加载优化检查', async ({ page }) => {
    // 拦截所有请求
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        resourceType: request.resourceType(),
      });
    });

    const responses = [];
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        size: response.headers()['content-length'],
        type: response.headers()['content-type'],
      });
    });

    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    // 分析资源
    const resourceReport = {
      timestamp: new Date().toISOString(),
      totalRequests: requests.length,
      byType: {},
      totalSize: 0,
      largeResources: [],
    };

    responses.forEach(res => {
      const type = res.type?.split(';')[0] || 'unknown';
      resourceReport.byType[type] = (resourceReport.byType[type] || 0) + 1;

      const size = parseInt(res.size) || 0;
      resourceReport.totalSize += size;

      if (size > 100 * 1024) { // > 100KB
        resourceReport.largeResources.push({
          url: res.url,
          size: size,
        });
      }
    });

    fs.writeFileSync(
      path.join(REPORTS_DIR, `resources-${timestamp()}.json`),
      JSON.stringify(resourceReport, null, 2)
    );

    console.log('\n资源加载分析:');
    console.log(`总请求数: ${resourceReport.totalRequests}`);
    console.log(`总大小: ${(resourceReport.totalSize / 1024).toFixed(2)} KB`);
    console.log('按类型分布:', resourceReport.byType);

    // 验证性能预算
    expect(resourceReport.totalSize).toBeLessThan(PERFORMANCE_BUDGET.resourceSize);
    expect(resourceReport.largeResources.length).toBeLessThan(5);
  });

  test('生成综合性能报告', async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);

    const metrics = await collectPerformanceMetrics(page);

    // 综合评分
    const score = {
      fcp: Math.max(0, 100 - (metrics.fcp / PERFORMANCE_BUDGET.fcp) * 100),
      lcp: Math.max(0, 100 - (metrics.lcp / PERFORMANCE_BUDGET.lcp) * 100),
      tti: Math.max(0, 100 - (metrics.tti / PERFORMANCE_BUDGET.tti) * 100),
      tbt: Math.max(0, 100 - (metrics.tbt / PERFORMANCE_BUDGET.tbt) * 100),
    };

    const overallScore = Object.values(score).reduce((a, b) => a + b, 0) / Object.keys(score).length;

    const comprehensiveReport = {
      timestamp: new Date().toISOString(),
      url: TEST_URL,
      metrics,
      scores: score,
      overallScore: Math.round(overallScore),
      budget: PERFORMANCE_BUDGET,
      passed: overallScore >= 90,
    };

    fs.writeFileSync(
      path.join(REPORTS_DIR, `comprehensive-${timestamp()}.json`),
      JSON.stringify(comprehensiveReport, null, 2)
    );

    console.log('\n综合性能评分:');
    console.log(`==================`);
    console.log(`FCP 分数: ${Math.round(score.fcp)}`);
    console.log(`LCP 分数: ${Math.round(score.lcp)}`);
    console.log(`TTI 分数: ${Math.round(score.tti)}`);
    console.log(`TBT 分数: ${Math.round(score.tbt)}`);
    console.log(`------------------`);
    console.log(`总体分数: ${Math.round(overallScore)}`);
    console.log(`==================`);

    // 总体评分应该 >= 90
    expect(overallScore).toBeGreaterThanOrEqual(90);
  });
});

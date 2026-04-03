/**
 * 测试运行器
 * 统一运行所有测试并生成报告
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// 测试配置
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  testDirs: ['unit', 'integration', 'e2e'],
  outputDir: './reports',
  formats: ['console', 'json', 'html'],
  coverage: true
};

// ═══════════════════════════════════════════════════════════════
// 测试结果收集器
// ═══════════════════════════════════════════════════════════════

class TestResultsCollector {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      suites: []
    };
    this.startTime = Date.now();
  }

  addSuite(suite) {
    this.results.suites.push({
      name: suite.name,
      tests: suite.tests,
      passed: suite.passed,
      failed: suite.failed,
      duration: suite.duration
    });
    
    this.results.summary.total += suite.tests.length;
    this.results.summary.passed += suite.passed;
    this.results.summary.failed += suite.failed;
  }

  finalize() {
    this.results.summary.duration = Date.now() - this.startTime;
    return this.results;
  }
}

// ═══════════════════════════════════════════════════════════════
// 简单的测试运行器实现
// ═══════════════════════════════════════════════════════════════

class SimpleTestRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.collector = new TestResultsCollector();
  }

  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      passed: 0,
      failed: 0,
      duration: 0
    };
    
    this.suites.push(suite);
    this.currentSuite = suite;
    
    const startTime = Date.now();
    try {
      fn();
    } catch (e) {
      console.error(`Suite "${name}" error:`, e.message);
    }
    suite.duration = Date.now() - startTime;
    
    this.collector.addSuite(suite);
    this.currentSuite = null;
  }

  test(name, fn) {
    if (!this.currentSuite) {
      console.warn('Test outside of suite:', name);
      return;
    }

    const testResult = {
      name,
      status: 'pending',
      error: null,
      duration: 0
    };

    const startTime = Date.now();
    try {
      fn();
      testResult.status = 'passed';
      this.currentSuite.passed++;
    } catch (e) {
      testResult.status = 'failed';
      testResult.error = e.message;
      this.currentSuite.failed++;
    }
    testResult.duration = Date.now() - startTime;
    
    this.currentSuite.tests.push(testResult);
  }

  expect(actual) {
    return {
      toBe(expected) {
        if (actual !== expected) {
          throw new Error(`Expected ${expected} but got ${actual}`);
        }
      },
      toEqual(expected) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
      },
      toBeDefined() {
        if (actual === undefined) {
          throw new Error(`Expected value to be defined but got undefined`);
        }
      },
      toBeNull() {
        if (actual !== null) {
          throw new Error(`Expected null but got ${actual}`);
        }
      },
      toBeTruthy() {
        if (!actual) {
          throw new Error(`Expected truthy value but got ${actual}`);
        }
      },
      toBeFalsy() {
        if (actual) {
          throw new Error(`Expected falsy value but got ${actual}`);
        }
      },
      toHaveLength(expected) {
        if (actual.length !== expected) {
          throw new Error(`Expected length ${expected} but got ${actual.length}`);
        }
      },
      toContain(expected) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
        }
      },
      toThrow(expected) {
        let threw = false;
        let error = null;
        try {
          actual();
        } catch (e) {
          threw = true;
          error = e;
        }
        if (!threw) {
          throw new Error(`Expected function to throw but it didn't`);
        }
        if (expected && !error.message.includes(expected)) {
          throw new Error(`Expected error to contain "${expected}" but got "${error.message}"`);
        }
      },
      toBeGreaterThan(expected) {
        if (!(actual > expected)) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },
      toBeLessThan(expected) {
        if (!(actual < expected)) {
          throw new Error(`Expected ${actual} to be less than ${expected}`);
        }
      },
      toBeGreaterThanOrEqual(expected) {
        if (!(actual >= expected)) {
          throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
        }
      },
      toBeLessThanOrEqual(expected) {
        if (!(actual <= expected)) {
          throw new Error(`Expected ${actual} to be less than or equal to ${expected}`);
        }
      }
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// 报告生成器
// ═══════════════════════════════════════════════════════════════

function generateConsoleReport(results) {
  console.log('\n' + '='.repeat(80));
  console.log('测试报告');
  console.log('='.repeat(80));
  console.log(`\n运行时间: ${results.timestamp}`);
  console.log(`总耗时: ${results.summary.duration}ms\n`);
  
  results.suites.forEach(suite => {
    console.log(`\n📦 ${suite.name}`);
    console.log('-'.repeat(80));
    
    suite.tests.forEach(test => {
      const icon = test.status === 'passed' ? '✅' : 
                   test.status === 'failed' ? '❌' : '⏭️';
      console.log(`  ${icon} ${test.name} (${test.duration}ms)`);
      
      if (test.error) {
        console.log(`     Error: ${test.error}`);
      }
    });
    
    console.log(`\n  通过: ${suite.passed} | 失败: ${suite.failed} | 总计: ${suite.tests.length}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('汇总');
  console.log('='.repeat(80));
  console.log(`总计: ${results.summary.total}`);
  console.log(`通过: ${results.summary.passed} ✅`);
  console.log(`失败: ${results.summary.failed} ❌`);
  console.log(`跳过: ${results.summary.skipped} ⏭️`);
  console.log(`通过率: ${((results.summary.passed / results.summary.total) * 100).toFixed(2)}%`);
  console.log('='.repeat(80) + '\n');
}

function generateJsonReport(results) {
  return JSON.stringify(results, null, 2);
}

function generateHtmlReport(results) {
  const statusColor = (status) => {
    switch (status) {
      case 'passed': return '#28a745';
      case 'failed': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const testRows = results.suites.flatMap(suite => 
    suite.tests.map(test => `
      <tr>
        <td>${suite.name}</td>
        <td>${test.name}</td>
        <td style="color: ${statusColor(test.status)}">${test.status === 'passed' ? '✅ 通过' : test.status === 'failed' ? '❌ 失败' : '⏭️ 跳过'}</td>
        <td>${test.duration}ms</td>
        <td>${test.error || '-'}</td>
      </tr>
    `).join('')
  ).join('');

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Excel 离线工具测试报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-card.failed {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        }
        .summary-card.passed {
            background: linear-gradient(135deg, #28a745 0%, #218838 100%);
        }
        .summary-card.skipped {
            background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
        }
        .summary-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .summary-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .timestamp {
            color: #6c757d;
            font-size: 0.9em;
            margin-bottom: 20px;
        }
        .duration {
            color: #6c757d;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Excel 离线工具测试报告</h1>
        <div class="timestamp">运行时间: ${results.timestamp}</div>
        <div class="duration">总耗时: ${results.summary.duration}ms</div>
        
        <div class="summary">
            <div class="summary-card">
                <div class="summary-value">${results.summary.total}</div>
                <div class="summary-label">总计</div>
            </div>
            <div class="summary-card passed">
                <div class="summary-value">${results.summary.passed}</div>
                <div class="summary-label">通过</div>
            </div>
            <div class="summary-card failed">
                <div class="summary-value">${results.summary.failed}</div>
                <div class="summary-label">失败</div>
            </div>
            <div class="summary-card skipped">
                <div class="summary-value">${results.summary.skipped}</div>
                <div class="summary-label">跳过</div>
            </div>
        </div>
        
        <h2>详细结果</h2>
        <table>
            <thead>
                <tr>
                    <th>测试套件</th>
                    <th>测试用例</th>
                    <th>状态</th>
                    <th>耗时</th>
                    <th>错误信息</th>
                </tr>
            </thead>
            <tbody>
                ${testRows}
            </tbody>
        </table>
    </div>
</body>
</html>
  `;
}

// ═══════════════════════════════════════════════════════════════
// 运行测试
// ═══════════════════════════════════════════════════════════════

async function runTests() {
  console.log('🚀 开始运行测试...\n');
  
  const runner = new SimpleTestRunner();
  
  // 定义全局测试函数
  global.describe = runner.describe.bind(runner);
  global.test = runner.test.bind(runner);
  global.expect = runner.expect.bind(runner);
  global.beforeAll = () => {};
  global.afterAll = () => {};
  global.beforeEach = () => {};
  global.afterEach = () => {};
  
  // 加载并运行测试文件
  const testFiles = [
    './unit/core-functions.test.js',
    './integration/functional-flow.test.js'
  ];
  
  for (const file of testFiles) {
    try {
      const filePath = path.resolve(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`加载: ${file}`);
        require(filePath);
      } else {
        console.warn(`⚠️ 文件不存在: ${file}`);
      }
    } catch (e) {
      console.error(`❌ 加载失败 ${file}:`, e.message);
    }
  }
  
  // 收集结果
  const results = runner.collector.finalize();
  
  // 生成报告
  generateConsoleReport(results);
  
  // 保存 JSON 报告
  const jsonReport = generateJsonReport(results);
  fs.writeFileSync(path.join(__dirname, 'reports', 'test-results.json'), jsonReport);
  
  // 保存 HTML 报告
  const htmlReport = generateHtmlReport(results);
  fs.writeFileSync(path.join(__dirname, 'reports', 'test-report.html'), htmlReport);
  
  console.log('📄 报告已保存到 tests/reports/');
  console.log(`   - test-results.json`);
  console.log(`   - test-report.html`);
  
  // 返回测试结果
  return {
    success: results.summary.failed === 0,
    results
  };
}

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════

if (require.main === module) {
  // 创建输出目录
  if (!fs.existsSync(path.join(__dirname, 'reports'))) {
    fs.mkdirSync(path.join(__dirname, 'reports'), { recursive: true });
  }
  
  runTests().then(({ success, results }) => {
    process.exit(success ? 0 : 1);
  }).catch(e => {
    console.error('测试运行失败:', e);
    process.exit(1);
  });
}

module.exports = { runTests, SimpleTestRunner, TestResultsCollector };

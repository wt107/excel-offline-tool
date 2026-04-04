/**
 * 安全审计测试
 * 检查依赖漏洞、XSS防护、输入验证等安全问题
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const REPORTS_DIR = path.join(__dirname, 'reports', 'security');
const PROJECT_ROOT = path.join(__dirname, '..');

// 确保报告目录存在
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// 生成时间戳
const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/**
 * 运行 npm audit
 */
function runNpmAudit() {
  console.log('\n🔒 运行 npm audit 安全审计...\n');

  try {
    // 运行 npm audit --json
    const output = execSync('npm audit --json', {
      cwd: path.join(__dirname),
      encoding: 'utf-8',
      timeout: 60000,
    });

    return JSON.parse(output);
  } catch (error) {
    // npm audit 发现漏洞时会返回非零退出码，但输出仍然是 JSON
    try {
      return JSON.parse(error.stdout);
    } catch {
      return {
        error: '无法解析 npm audit 输出',
        message: error.message,
      };
    }
  }
}

/**
 * 检查代码中的潜在安全问题
 */
function checkCodeSecurity() {
  console.log('\n🔍 检查代码安全问题...\n');

  const issues = [];
  const htmlContent = fs.readFileSync(path.join(PROJECT_ROOT, 'excel.html'), 'utf-8');

  // 检查 1: innerHTML 使用（潜在的 XSS）
  const innerHTMLMatches = htmlContent.match(/innerHTML\s*=/g);
  if (innerHTMLMatches) {
    issues.push({
      type: 'warning',
      category: 'XSS Risk',
      message: `发现 ${innerHTMLMatches.length} 处 innerHTML 使用`,
      details: 'innerHTML 可能导致 XSS 漏洞，请确保输入已正确转义',
      recommendation: '使用 textContent 替代，或确保 HTML 内容来自可信来源',
    });
  }

  // 检查 2: eval 使用
  const evalMatches = htmlContent.match(/eval\s*\(/g);
  if (evalMatches) {
    issues.push({
      type: 'error',
      category: 'Code Injection',
      message: `发现 ${evalMatches.length} 处 eval 使用`,
      details: 'eval 可能导致代码注入漏洞',
      recommendation: '避免使用 eval，改用 JSON.parse 或 Function 构造器',
    });
  }

  // 检查 3: document.write 使用
  const writeMatches = htmlContent.match(/document\.write/g);
  if (writeMatches) {
    issues.push({
      type: 'warning',
      category: 'XSS Risk',
      message: `发现 ${writeMatches.length} 处 document.write 使用`,
      details: 'document.write 可能覆盖整个文档，导致 XSS',
      recommendation: '使用 DOM API (createElement, appendChild) 替代',
    });
  }

  // 检查 4: 第三方脚本加载
  const scriptSrcMatches = htmlContent.match(/<script[^>]+src="([^"]+)"/g);
  const externalScripts = [];
  if (scriptSrcMatches) {
    scriptSrcMatches.forEach(match => {
      const src = match.match(/src="([^"]+)"/)?.[1];
      if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
        externalScripts.push(src);
      }
    });

    if (externalScripts.length > 0) {
      issues.push({
        type: 'info',
        category: 'External Resources',
        message: `发现 ${externalScripts.length} 个外部脚本`,
        details: externalScripts.join(', '),
        recommendation: '确保外部脚本来源可信，使用 SRI (Subresource Integrity)',
      });
    }
  }

  // 检查 5: 缺少 CSP (Content Security Policy)
  const hasCSP = htmlContent.match(/Content-Security-Policy/i);
  if (!hasCSP) {
    issues.push({
      type: 'warning',
      category: 'Security Headers',
      message: '未检测到 Content Security Policy',
      details: '缺少 CSP 可能增加 XSS 攻击风险',
      recommendation: '添加 <meta http-equiv="Content-Security-Policy" content="...">',
    });
  }

  // 检查 6: 敏感信息硬编码
  const sensitivePatterns = [
    /password\s*[=:]\s*["\'][^"\']+["\']/i,
    /secret\s*[=:]\s*["\'][^"\']+["\']/i,
    /token\s*[=:]\s*["\'][^"\']+["\']/i,
    /api[_-]?key\s*[=:]\s*["\'][^"\']+["\']/i,
  ];

  sensitivePatterns.forEach(pattern => {
    const matches = htmlContent.match(pattern);
    if (matches) {
      issues.push({
        type: 'error',
        category: 'Sensitive Data',
        message: '检测到可能的敏感信息硬编码',
        details: '代码中可能包含密码、密钥或 Token',
        recommendation: '使用环境变量或配置管理系统存储敏感信息',
      });
    }
  });

  // 检查 7: 输入验证
  const inputValidation = htmlContent.match(/validate|sanitize|escape/i);
  if (!inputValidation) {
    issues.push({
      type: 'warning',
      category: 'Input Validation',
      message: '未检测到输入验证逻辑',
      details: '用户输入应该进行验证和清理',
      recommendation: '添加输入验证函数，过滤或转义特殊字符',
    });
  }

  // 检查 8: 文件类型验证
  const fileTypeValidation = htmlContent.match(/\.xlsx|\.xls/i);
  if (fileTypeValidation) {
    issues.push({
      type: 'info',
      category: 'File Upload',
      message: '检测到文件类型限制',
      details: '文件上传限制为 Excel 文件',
      recommendation: '确保同时检查 MIME 类型和文件扩展名',
    });
  }

  return issues;
}

/**
 * 检查第三方依赖安全
 */
function checkDependencySecurity() {
  console.log('\n📦 检查第三方依赖安全...\n');

  const issues = [];
  const packageJsonPath = path.join(__dirname, 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // 检查过时的依赖
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // 已知的危险依赖（示例）
    const dangerousPackages = [
      'lodash', // 旧版本有漏洞
      'jquery', // 旧版本有 XSS 漏洞
    ];

    dangerousPackages.forEach(pkg => {
      if (dependencies[pkg]) {
        issues.push({
          type: 'warning',
          category: 'Dependency Risk',
          message: `使用可能存在漏洞的包: ${pkg}`,
          details: `当前版本: ${dependencies[pkg]}`,
          recommendation: `定期更新 ${pkg} 到最新版本`,
        });
      }
    });
  }

  return issues;
}

/**
 * 生成安全报告
 */
function generateSecurityReport(npmAuditResults, codeIssues, dependencyIssues) {
  const ts = timestamp();

  // 统计问题
  const allIssues = [...codeIssues, ...dependencyIssues];
  const stats = {
    error: allIssues.filter(i => i.type === 'error').length,
    warning: allIssues.filter(i => i.type === 'warning').length,
    info: allIssues.filter(i => i.type === 'info').length,
  };

  // npm audit 统计
  const npmStats = {
    vulnerabilities: npmAuditResults.metadata?.vulnerabilities || {},
    totalDependencies: npmAuditResults.metadata?.totalDependencies || 0,
    severity: {
      critical: npmAuditResults.metadata?.vulnerabilities?.critical || 0,
      high: npmAuditResults.metadata?.vulnerabilities?.high || 0,
      moderate: npmAuditResults.metadata?.vulnerabilities?.moderate || 0,
      low: npmAuditResults.metadata?.vulnerabilities?.low || 0,
      info: npmAuditResults.metadata?.vulnerabilities?.info || 0,
    },
  };

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      npmAudit: npmStats,
      codeSecurity: stats,
      overallRisk: stats.error > 0 || npmStats.severity.critical > 0 || npmStats.severity.high > 0
        ? 'high'
        : stats.warning > 0 || npmStats.severity.moderate > 0
          ? 'medium'
          : 'low',
    },
    details: {
      npmAudit: npmAuditResults,
      codeIssues,
      dependencyIssues,
    },
  };

  // 保存 JSON 报告
  const jsonPath = path.join(REPORTS_DIR, `security-audit-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // 生成 HTML 报告
  const htmlReport = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>安全审计报告</title>
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
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 { color: #333; border-bottom: 2px solid #dc3545; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .summary-box {
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
    .metric-label { color: #666; margin-top: 5px; }
    .critical { color: #dc3545; }
    .high { color: #fd7e14; }
    .moderate { color: #ffc107; }
    .low { color: #17a2b8; }
    .issue {
      border-left: 4px solid;
      padding: 15px;
      margin: 10px 0;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .issue.error { border-color: #dc3545; }
    .issue.warning { border-color: #ffc107; }
    .issue.info { border-color: #17a2b8; }
    .issue-type {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .issue.error .issue-type { background: #dc3545; color: white; }
    .issue.warning .issue-type { background: #ffc107; color: #333; }
    .issue.info .issue-type { background: #17a2b8; color: white; }
    .category { font-weight: bold; color: #333; margin: 10px 0 5px; }
    .details { color: #666; margin: 5px 0; }
    .recommendation {
      background: #e7f3ff;
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
      color: #004085;
    }
    .risk-high { background: #dc3545; color: white; padding: 10px 20px; border-radius: 4px; }
    .risk-medium { background: #ffc107; color: #333; padding: 10px 20px; border-radius: 4px; }
    .risk-low { background: #28a745; color: white; padding: 10px 20px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔒 安全审计报告</h1>
    <p>审计时间: ${new Date().toLocaleString()}</p>

    <div class="risk-${report.summary.overallRisk}">
      <strong>总体风险等级: ${report.summary.overallRisk.toUpperCase()}</strong>
    </div>

    <h2>📊 漏洞统计</h2>
    <div class="summary-box">
      <div class="metric-card">
        <div class="metric-value critical">${npmStats.severity.critical}</div>
        <div class="metric-label">严重漏洞</div>
      </div>
      <div class="metric-card">
        <div class="metric-value high">${npmStats.severity.high}</div>
        <div class="metric-label">高危漏洞</div>
      </div>
      <div class="metric-card">
        <div class="metric-value moderate">${npmStats.severity.moderate}</div>
        <div class="metric-label">中危漏洞</div>
      </div>
      <div class="metric-card">
        <div class="metric-value low">${npmStats.severity.low}</div>
        <div class="metric-label">低危漏洞</div>
      </div>
    </div>

    <h2>📝 代码安全问题</h2>
    ${codeIssues.length > 0 ? codeIssues.map(issue => `
      <div class="issue ${issue.type}">
        <span class="issue-type">${issue.type}</span>
        <div class="category">${issue.category}</div>
        <div>${issue.message}</div>
        <div class="details">${issue.details}</div>
        <div class="recommendation">💡 ${issue.recommendation}</div>
      </div>
    `).join('') : '<p>✅ 未发现代码安全问题</p>'}

    <h2>📦 依赖安全问题</h2>
    ${dependencyIssues.length > 0 ? dependencyIssues.map(issue => `
      <div class="issue ${issue.type}">
        <span class="issue-type">${issue.type}</span>
        <div class="category">${issue.category}</div>
        <div>${issue.message}</div>
        <div class="details">${issue.details}</div>
        <div class="recommendation">💡 ${issue.recommendation}</div>
      </div>
    `).join('') : '<p>✅ 未发现依赖安全问题</p>'}

    <h2>🔍 漏洞详情</h2>
    ${npmAuditResults.vulnerabilities ? `
      <table>
        <thead>
          <tr>
            <th>包名</th>
            <th>严重程度</th>
            <th>范围</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(npmAuditResults.vulnerabilities).map(([name, vuln]) => `
            <tr>
              <td>${name}</td>
              <td class="${vuln.severity}">${vuln.severity}</td>
              <td>${vuln.via?.map(v => v.title || v).join(', ') || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>未发现依赖漏洞</p>'}
  </div>
</body>
</html>
  `;

  const htmlPath = path.join(REPORTS_DIR, `security-audit-${ts}.html`);
  fs.writeFileSync(htmlPath, htmlReport);

  return { jsonPath, htmlPath, report };
}

/**
 * 主函数
 */
async function main() {
  console.log('=========================================');
  console.log('🔒 安全审计开始');
  console.log('=========================================\n');

  // 运行 npm audit
  const npmAuditResults = runNpmAudit();

  // 检查代码安全
  const codeIssues = checkCodeSecurity();

  // 检查依赖安全
  const dependencyIssues = checkDependencySecurity();

  // 生成报告
  const { jsonPath, htmlPath, report } = generateSecurityReport(
    npmAuditResults,
    codeIssues,
    dependencyIssues
  );

  // 输出摘要
  console.log('\n=========================================');
  console.log('📊 安全审计摘要');
  console.log('=========================================');
  console.log(`依赖漏洞:`);
  console.log(`  严重: ${report.summary.npmAudit.severity.critical}`);
  console.log(`  高危: ${report.summary.npmAudit.severity.high}`);
  console.log(`  中危: ${report.summary.npmAudit.severity.moderate}`);
  console.log(`  低危: ${report.summary.npmAudit.severity.low}`);
  console.log(`\n代码安全问题:`);
  console.log(`  错误: ${report.summary.codeSecurity.error}`);
  console.log(`  警告: ${report.summary.codeSecurity.warning}`);
  console.log(`  信息: ${report.summary.codeSecurity.info}`);
  console.log(`\n总体风险: ${report.summary.overallRisk.toUpperCase()}`);
  console.log('=========================================');
  console.log(`\n📄 报告已保存:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  HTML: ${htmlPath}`);
  console.log('\n=========================================');

  // 退出码：有严重或高危问题时返回 1
  const hasSeriousIssues =
    report.summary.npmAudit.severity.critical > 0 ||
    report.summary.npmAudit.severity.high > 0 ||
    report.summary.codeSecurity.error > 0;

  process.exit(hasSeriousIssues ? 1 : 0);
}

// 运行主函数
main().catch(error => {
  console.error('安全审计失败:', error);
  process.exit(1);
});

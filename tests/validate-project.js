/**
 * 项目验证脚本
 * 验证 Excel 离线工具是否符合设计目标和验收标准
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// 验证配置
// ═══════════════════════════════════════════════════════════════

const VALIDATION_CONFIG = {
  projectRoot: path.join(__dirname, '..'),
  requiredFiles: [
    'excel.html',
    'src/core/constants.js',
    'src/utils/excel-utils.js',
    'workers/excel-processor.worker.js',
    'lib/xlsx.bundle.js',
    'lib/jszip.min.js'
  ],
  requiredFeatures: [
    '按工作表拆分',
    '按列拆分',
    '文件合并',
    '工作表数据合并'
  ],
  prdRequirements: {
    fileLimits: {
      maxSingleFile: 20 * 1024 * 1024,      // 20MB 软限制
      hardLimit: 50 * 1024 * 1024,          // 50MB 硬限制
      maxTotal: 100 * 1024 * 1024,          // 100MB 总限制
      maxFileCount: 50,
      maxSheetCount: 200
    },
    supportedFormats: ['.xlsx', '.xls'],
    outputFormat: '.xlsx'
  }
};

// ═══════════════════════════════════════════════════════════════
// 验证结果收集器
// ═══════════════════════════════════════════════════════════════

class ValidationResult {
  constructor() {
    this.checks = [];
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
  }

  addCheck(category, name, status, message = '', details = {}) {
    this.checks.push({
      category,
      name,
      status, // 'pass', 'fail', 'warning'
      message,
      details,
      timestamp: new Date().toISOString()
    });

    if (status === 'pass') this.passed++;
    else if (status === 'fail') this.failed++;
    else if (status === 'warning') this.warnings++;
  }

  getSummary() {
    return {
      total: this.checks.length,
      passed: this.passed,
      failed: this.failed,
      warnings: this.warnings,
      passRate: ((this.passed / this.checks.length) * 100).toFixed(2) + '%'
    };
  }

  getReport() {
    return {
      summary: this.getSummary(),
      checks: this.checks,
      generatedAt: new Date().toISOString()
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// 验证器
// ═══════════════════════════════════════════════════════════════

class ProjectValidator {
  constructor(config) {
    this.config = config;
    this.result = new ValidationResult();
  }

  // 验证文件结构
  validateFileStructure() {
    console.log('🔍 验证文件结构...');

    this.config.requiredFiles.forEach(file => {
      const fullPath = path.join(this.config.projectRoot, file);
      const exists = fs.existsSync(fullPath);

      this.result.addCheck(
        '文件结构',
        `检查文件: ${file}`,
        exists ? 'pass' : 'fail',
        exists ? '文件存在' : '文件不存在',
        { path: fullPath }
      );
    });

    // 检查 test-fixtures 目录
    const fixturesDir = path.join(this.config.projectRoot, 'test-fixtures');
    const hasFixtures = fs.existsSync(fixturesDir);
    this.result.addCheck(
      '文件结构',
      '检查测试数据目录',
      hasFixtures ? 'pass' : 'warning',
      hasFixtures ? '测试数据目录存在' : '测试数据目录不存在'
    );
  }

  // 验证代码质量
  validateCodeQuality() {
    console.log('🔍 验证代码质量...');

    const htmlPath = path.join(this.config.projectRoot, 'excel.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // 检查文件大小
    const htmlSize = fs.statSync(htmlPath).size;
    const sizeCheck = htmlSize < 1024 * 1024; // 小于 1MB
    this.result.addCheck(
      '代码质量',
      'HTML 文件大小',
      sizeCheck ? 'pass' : 'warning',
      `大小: ${(htmlSize / 1024).toFixed(2)} KB`,
      { size: htmlSize }
    );

    // 检查基本结构
    const hasDoctype = htmlContent.includes('<!DOCTYPE html>');
    this.result.addCheck(
      '代码质量',
      'HTML 文档类型声明',
      hasDoctype ? 'pass' : 'fail',
      hasDoctype ? '包含 DOCTYPE' : '缺少 DOCTYPE'
    );

    // 检查 XSS 防护
    const hasEscapeHtml = htmlContent.includes('escapeHtml');
    this.result.addCheck(
      '代码质量',
      'XSS 防护函数',
      hasEscapeHtml ? 'pass' : 'fail',
      hasEscapeHtml ? '存在 escapeHtml 函数' : '缺少 XSS 防护'
    );

    // 检查文件大小限制常量
    const hasFileSizeLimit = htmlContent.includes('MAX_SINGLE_FILE_BYTES') ||
                              htmlContent.includes('20 * 1024 * 1024');
    this.result.addCheck(
      '代码质量',
      '文件大小限制',
      hasFileSizeLimit ? 'pass' : 'fail',
      hasFileSizeLimit ? '存在文件大小限制' : '缺少文件大小限制'
    );

    // 检查错误处理
    const hasErrorHandling = htmlContent.includes('try') && htmlContent.includes('catch');
    this.result.addCheck(
      '代码质量',
      '错误处理',
      hasErrorHandling ? 'pass' : 'fail',
      hasErrorHandling ? '存在 try-catch 错误处理' : '缺少错误处理'
    );

    // 检查性能优化（Worker）
    const hasWorker = htmlContent.includes('Worker') || 
                      fs.existsSync(path.join(this.config.projectRoot, 'workers/excel-processor.worker.js'));
    this.result.addCheck(
      '代码质量',
      '性能优化（Web Worker）',
      hasWorker ? 'pass' : 'warning',
      hasWorker ? '使用 Web Worker 优化性能' : '未使用 Web Worker'
    );
  }

  // 验证功能实现
  validateFeatures() {
    console.log('🔍 验证功能实现...');

    const htmlPath = path.join(this.config.projectRoot, 'excel.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // 检查各个模式
    const modes = [
      { name: '按工作表拆分', keyword: 'split-sheet' },
      { name: '按列拆分（横向）', keyword: 'split-column"' },
      { name: '按列拆分（竖向）', keyword: 'split-column-vertical' },
      { name: '多文件合并', keyword: 'merge-file' },
      { name: '工作表数据合并', keyword: 'merge-sheet' }
    ];

    modes.forEach(mode => {
      const exists = htmlContent.includes(mode.keyword) || 
                     htmlContent.includes(mode.name);
      this.result.addCheck(
        '功能实现',
        mode.name,
        exists ? 'pass' : 'fail',
        exists ? '功能已实现' : '功能未实现'
      );
    });

    // 检查文件上传功能
    const hasFileUpload = htmlContent.includes('type="file"') &&
                          htmlContent.includes('accept=".xlsx,.xls"');
    this.result.addCheck(
      '功能实现',
      '文件上传',
      hasFileUpload ? 'pass' : 'fail',
      hasFileUpload ? '支持 XLSX/XLS 文件上传' : '文件上传功能不完整'
    );

    // 检查拖拽上传
    const hasDragDrop = htmlContent.includes('dragover') &&
                        htmlContent.includes('drop');
    this.result.addCheck(
      '功能实现',
      '拖拽上传',
      hasDragDrop ? 'pass' : 'warning',
      hasDragDrop ? '支持拖拽上传' : '未实现拖拽上传'
    );

    // 检查下载功能
    const hasDownload = htmlContent.includes('download') ||
                        htmlContent.includes('URL.createObjectURL');
    this.result.addCheck(
      '功能实现',
      '文件下载',
      hasDownload ? 'pass' : 'fail',
      hasDownload ? '支持文件下载' : '缺少下载功能'
    );

    // 检查 ZIP 生成
    const hasZip = htmlContent.includes('JSZip') ||
                   htmlContent.includes('generateAsync');
    this.result.addCheck(
      '功能实现',
      'ZIP 打包',
      hasZip ? 'pass' : 'fail',
      hasZip ? '支持 ZIP 打包' : '缺少 ZIP 打包功能'
    );
  }

  // 验证 PRD 符合性
  validatePRDCompliance() {
    console.log('🔍 验证 PRD 符合性...');

    const htmlPath = path.join(this.config.projectRoot, 'excel.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // 检查四步流程
    const steps = ['上传文件', '选择内容', '配置选项', '生成文件'];
    steps.forEach((step, index) => {
      const exists = htmlContent.includes(step);
      this.result.addCheck(
        'PRD 符合性',
        `四步流程 - 步骤 ${index + 1}: ${step}`,
        exists ? 'pass' : 'fail',
        exists ? '流程步骤存在' : '流程步骤缺失'
      );
    });

    // 检查隐私说明
    const hasPrivacy = htmlContent.includes('本地处理') ||
                       htmlContent.includes('不会上传');
    this.result.addCheck(
      'PRD 符合性',
      '隐私说明',
      hasPrivacy ? 'pass' : 'warning',
      hasPrivacy ? '包含隐私说明' : '缺少隐私说明'
    );

    // 检查格式保留说明
    const hasFormatRetention = htmlContent.includes('保留') &&
                                htmlContent.includes('格式');
    this.result.addCheck(
      'PRD 符合性',
      '格式保留',
      hasFormatRetention ? 'pass' : 'warning',
      hasFormatRetention ? '包含格式保留说明' : '格式保留说明不完整'
    );

    // 检查错误提示
    const hasErrorMessages = htmlContent.includes('showToast') ||
                             htmlContent.includes('alert');
    this.result.addCheck(
      'PRD 符合性',
      '错误提示',
      hasErrorMessages ? 'pass' : 'fail',
      hasErrorMessages ? '有错误提示机制' : '缺少错误提示'
    );

    // 检查进度指示
    const hasProgress = htmlContent.includes('progress') ||
                        htmlContent.includes('loading');
    this.result.addCheck(
      'PRD 符合性',
      '进度指示',
      hasProgress ? 'pass' : 'warning',
      hasProgress ? '有进度指示' : '缺少进度指示'
    );
  }

  // 验证文档完整性
  validateDocumentation() {
    console.log('🔍 验证文档完整性...');

    const docs = [
      { file: 'README.md', required: true },
      { file: 'PRD.md', required: true },
      { file: '开发计划.md', required: false },
      { file: '验收报告.md', required: false }
    ];

    docs.forEach(doc => {
      const docPath = path.join(this.config.projectRoot, doc.file);
      const exists = fs.existsSync(docPath);
      this.result.addCheck(
        '文档完整性',
        `文档: ${doc.file}`,
        exists ? 'pass' : (doc.required ? 'fail' : 'warning'),
        exists ? '文档存在' : '文档不存在',
        { required: doc.required }
      );
    });
  }

  // 验证测试覆盖
  validateTestCoverage() {
    console.log('🔍 验证测试覆盖...');

    // 检查测试目录
    const testDir = path.join(this.config.projectRoot, 'tests');
    const hasTestDir = fs.existsSync(testDir);
    this.result.addCheck(
      '测试覆盖',
      '测试目录存在',
      hasTestDir ? 'pass' : 'warning',
      hasTestDir ? '测试目录存在' : '缺少测试目录'
    );

    if (hasTestDir) {
      // 检查单元测试
      const unitDir = path.join(testDir, 'unit');
      const hasUnitTests = fs.existsSync(unitDir) && 
                           fs.readdirSync(unitDir).some(f => f.endsWith('.test.js'));
      this.result.addCheck(
        '测试覆盖',
        '单元测试',
        hasUnitTests ? 'pass' : 'warning',
        hasUnitTests ? '有单元测试' : '缺少单元测试'
      );

      // 检查集成测试
      const integrationDir = path.join(testDir, 'integration');
      const hasIntegrationTests = fs.existsSync(integrationDir) &&
                                   fs.readdirSync(integrationDir).some(f => f.endsWith('.test.js'));
      this.result.addCheck(
        '测试覆盖',
        '集成测试',
        hasIntegrationTests ? 'pass' : 'warning',
        hasIntegrationTests ? '有集成测试' : '缺少集成测试'
      );

      // 检查 E2E 测试
      const e2eDir = path.join(testDir, 'e2e');
      const hasE2ETests = fs.existsSync(e2eDir) &&
                          fs.readdirSync(e2eDir, { recursive: true })
                            .some(f => typeof f === 'string' && f.endsWith('.spec.js'));
      this.result.addCheck(
        '测试覆盖',
        'E2E 测试',
        hasE2ETests ? 'pass' : 'warning',
        hasE2ETests ? '有 E2E 测试' : '缺少 E2E 测试'
      );
    }
  }

  // 运行所有验证
  runAll() {
    console.log('🚀 开始项目验证...\n');

    this.validateFileStructure();
    this.validateCodeQuality();
    this.validateFeatures();
    this.validatePRDCompliance();
    this.validateDocumentation();
    this.validateTestCoverage();

    return this.result;
  }
}

// ═══════════════════════════════════════════════════════════════
// 报告生成
// ═══════════════════════════════════════════════════════════════

function generateReport(result) {
  const report = result.getReport();
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 项目验证报告');
  console.log('='.repeat(80));
  
  console.log(`\n生成时间: ${report.generatedAt}`);
  console.log(`\n汇总:`);
  console.log(`  总计检查项: ${report.summary.total}`);
  console.log(`  ✅ 通过: ${report.summary.passed}`);
  console.log(`  ❌ 失败: ${report.summary.failed}`);
  console.log(`  ⚠️  警告: ${report.summary.warnings}`);
  console.log(`  通过率: ${report.summary.passRate}`);
  
  console.log('\n详细结果:');
  console.log('-'.repeat(80));
  
  const categories = [...new Set(report.checks.map(c => c.category))];
  categories.forEach(category => {
    console.log(`\n📁 ${category}:`);
    const checks = report.checks.filter(c => c.category === category);
    checks.forEach(check => {
      const icon = check.status === 'pass' ? '✅' : 
                   check.status === 'fail' ? '❌' : '⚠️';
      console.log(`  ${icon} ${check.name}`);
      if (check.message) {
        console.log(`     ${check.message}`);
      }
    });
  });
  
  console.log('\n' + '='.repeat(80));
  
  // 保存报告
  const reportPath = path.join(__dirname, 'reports', 'validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  const htmlReport = generateHtmlReport(report);
  const htmlPath = path.join(__dirname, 'reports', 'validation-report.html');
  fs.writeFileSync(htmlPath, htmlReport);
  
  console.log(`\n📄 报告已保存:`);
  console.log(`   - ${reportPath}`);
  console.log(`   - ${htmlPath}`);
  
  return report;
}

function generateHtmlReport(report) {
  const statusColor = (status) => {
    switch (status) {
      case 'pass': return '#28a745';
      case 'fail': return '#dc3545';
      case 'warning': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const statusIcon = (status) => {
    switch (status) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'warning': return '⚠️';
      default: return '⏭️';
    }
  };

  const categories = [...new Set(report.checks.map(c => c.category))];
  
  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Excel 离线工具项目验证报告</title>
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
            border-bottom: 3px solid #667eea;
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
        .summary-card.fail { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); }
        .summary-card.warning { background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%); color: #333; }
        .summary-value {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .summary-label { font-size: 0.9em; opacity: 0.9; }
        .category {
            margin-bottom: 25px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .category h2 {
            color: #495057;
            margin-bottom: 15px;
            font-size: 1.2em;
        }
        .check-item {
            display: flex;
            align-items: flex-start;
            padding: 10px;
            margin-bottom: 8px;
            background: white;
            border-radius: 6px;
            border-left: 4px solid #28a745;
        }
        .check-item.fail { border-left-color: #dc3545; }
        .check-item.warning { border-left-color: #ffc107; }
        .check-icon {
            margin-right: 10px;
            font-size: 1.2em;
        }
        .check-content {
            flex: 1;
        }
        .check-name {
            font-weight: 500;
            color: #333;
        }
        .check-message {
            font-size: 0.85em;
            color: #6c757d;
            margin-top: 3px;
        }
        .timestamp {
            color: #6c757d;
            font-size: 0.9em;
            margin-bottom: 20px;
        }
        .pass-rate {
            text-align: center;
            padding: 15px;
            font-size: 1.3em;
            font-weight: bold;
            color: #28a745;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Excel 离线工具项目验证报告</h1>
        <div class="timestamp">生成时间: ${report.generatedAt}</div>
        
        <div class="summary">
            <div class="summary-card">
                <div class="summary-value">${report.summary.total}</div>
                <div class="summary-label">总计</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${report.summary.passed}</div>
                <div class="summary-label">通过</div>
            </div>
            <div class="summary-card fail">
                <div class="summary-value">${report.summary.failed}</div>
                <div class="summary-label">失败</div>
            </div>
            <div class="summary-card warning">
                <div class="summary-value">${report.summary.warnings}</div>
                <div class="summary-label">警告</div>
            </div>
        </div>
        
        <div class="pass-rate">通过率: ${report.summary.passRate}</div>
        
        ${categories.map(category => {
          const checks = report.checks.filter(c => c.category === category);
          return `
            <div class="category">
                <h2>📁 ${category}</h2>
                ${checks.map(check => `
                    <div class="check-item ${check.status}">
                        <span class="check-icon">${statusIcon(check.status)}</span>
                        <div class="check-content">
                            <div class="check-name">${check.name}</div>
                            ${check.message ? `<div class="check-message">${check.message}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
          `;
        }).join('')}
    </div>
</body>
</html>
  `;
  
  return html;
}

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════

function main() {
  // 创建报告目录
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // 运行验证
  const validator = new ProjectValidator(VALIDATION_CONFIG);
  const result = validator.runAll();
  
  // 生成报告
  const report = generateReport(result);
  
  // 输出结论
  console.log('\n📋 验证结论:');
  if (report.summary.failed === 0) {
    console.log('✅ 项目验证通过！所有检查项均已满足。');
  } else {
    console.log(`⚠️  项目验证发现问题，共有 ${report.summary.failed} 项检查未通过。`);
  }
  
  if (report.summary.warnings > 0) {
    console.log(`⚠️  有 ${report.summary.warnings} 项警告需要关注。`);
  }
  
  // 返回退出码
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

// 导出供其他模块使用
module.exports = { ProjectValidator, ValidationResult, VALIDATION_CONFIG };

/**
 * Phase 1: 代码静态分析
 * 检查安全隐患、逻辑缺陷、代码质量问题
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const htmlPath = path.join(projectRoot, 'excel.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

const results = [];
let passCount = 0, failCount = 0, warnCount = 0;

function check(name, status, detail) {
  results.push({ name, status, detail });
  if (status === 'pass') passCount++;
  else if (status === 'fail') failCount++;
  else warnCount++;
}

// ═══════════════════════════════════════════════════════════════
// 1.1 安全隐患检查
// ═══════════════════════════════════════════════════════════════

// XSS: escapeHtml 使用检查
const escapeHtmlCalls = (htmlContent.match(/escapeHtml\(/g) || []).length;
const innerHTMLAssignments = (htmlContent.match(/\.innerHTML\s*=/g) || []).length;
const innerHTMLWithEscape = (htmlContent.match(/escapeHtml\([^)]*\)/g) || []).length;

// 检查所有 innerHTML 赋值是否都用了 escapeHtml
const innerHTMLLines = htmlContent.split('\n').filter(line => 
  line.includes('.innerHTML') && line.includes('=') && !line.trim().startsWith('//')
);

let unsafeInnerHTML = 0;
innerHTMLLines.forEach(line => {
  if (!line.includes('escapeHtml') && line.includes('innerHTML')) {
    unsafeInnerHTML++;
  }
});

check(
  'XSS防护 - escapeHtml使用',
  unsafeInnerHTML > 0 ? 'warn' : 'pass',
  `escapeHtml调用${escapeHtmlCalls}次, innerHTML赋值${innerHTMLAssignments}次, 未转义${unsafeInnerHTML}处`
);

// 魔术字节验证
const hasMagicBytesCheck = htmlContent.includes('validateExcelFileByMagicBytes');
check('文件上传 - 魔术字节验证', hasMagicBytesCheck ? 'pass' : 'fail',
  hasMagicBytesCheck ? '存在魔术字节验证' : '缺少魔术字节验证');

// 无限循环防护
const hasMaxAttempts = htmlContent.includes('MAX_ATTEMPTS');
check('无限循环防护 - MAX_ATTEMPTS', hasMaxAttempts ? 'pass' : 'fail',
  hasMaxAttempts ? '存在最大尝试次数限制' : '缺少无限循环防护');

// Blob URL revoke
const revokeCount = (htmlContent.match(/revokeObjectURL/g) || []).length;
const createCount = (htmlContent.match(/createObjectURL/g) || []).length;
check('内存泄漏 - Blob URL回收',
  revokeCount >= createCount ? 'pass' : 'warn',
  `createObjectURL ${createCount}次, revokeObjectURL ${revokeCount}次`);

// ═══════════════════════════════════════════════════════════════
// 1.2 逻辑缺陷检查
// ═══════════════════════════════════════════════════════════════

// ensureUniqueFileName 扩展名处理
// 检查: test.xlsx_01 vs test_01.xlsx
const ensureUniqueFnMatch = htmlContent.match(/function ensureUniqueFileName[\s\S]*?^        \}/m);
if (ensureUniqueFnMatch) {
  const fn = ensureUniqueFnMatch[0];
  // 检查扩展名处理是否正确
  const hasExtMatch = fn.includes("fileName.match(/(\\.[^.]+)$/)") || 
                       fn.includes("fileName.lastIndexOf('.')");
  check('逻辑缺陷 - ensureUniqueFileName扩展名处理',
    hasExtMatch ? 'pass' : 'fail',
    hasExtMatch ? '扩展名处理逻辑存在' : '扩展名处理可能有问题');
} else {
  check('逻辑缺陷 - ensureUniqueFileName', 'fail', '函数未找到');
}

// performColumnSplit 防御性处理
const hasDefensiveResult = htmlContent.includes('generationResult && generationResult.fileCount');
check('逻辑缺陷 - performColumnSplit防御性处理',
  hasDefensiveResult ? 'pass' : 'warn',
  hasDefensiveResult ? '存在防御性结果处理' : '可能缺少防御性处理');

// 来源列插入逻辑
const hasSourceColumn = htmlContent.includes('来源文件') && htmlContent.includes('col0Addr');
check('逻辑缺陷 - 来源列插入',
  hasSourceColumn ? 'pass' : 'fail',
  hasSourceColumn ? '来源列插入逻辑存在' : '来源列逻辑可能有问题');

// copyWorksheetProperties 行映射
const hasRowsToKeep = htmlContent.includes('rowsToKeep') && htmlContent.includes('indexOf');
check('逻辑缺陷 - 行映射处理',
  hasRowsToKeep ? 'pass' : 'warn',
  hasRowsToKeep ? '行映射处理存在' : '行映射可能不完整');

// ═══════════════════════════════════════════════════════════════
// 1.3 代码质量
// ═══════════════════════════════════════════════════════════════

// 检查 src/ 模块与 excel.html 内联代码的同步
const srcFiles = [
  'src/core/constants.js',
  'src/utils/excel-utils.js',
  'src/utils/dom-utils.js',
  'src/utils/file-utils.js',
  'src/core/workbook-cache.js',
  'src/core/worker-pool.js'
];

let srcSyncIssues = 0;
srcFiles.forEach(file => {
  const fullPath = path.join(projectRoot, file);
  if (fs.existsSync(fullPath)) {
    const srcContent = fs.readFileSync(fullPath, 'utf-8');
    // 检查关键函数是否在 html 中也存在
    const exports = srcContent.match(/export\s+(function|class|const)\s+(\w+)/g) || [];
    exports.forEach(exp => {
      const name = exp.split(/\s+/).pop();
      if (name && !htmlContent.includes(name)) {
        srcSyncIssues++;
      }
    });
  }
});

check('代码质量 - src模块与html同步',
  srcSyncIssues === 0 ? 'pass' : 'warn',
  srcSyncIssues === 0 ? '模块代码在html中均有对应' : `${srcSyncIssues}个导出在html中未找到`);

// 函数复杂度检查
const functions = htmlContent.match(/function\s+(\w+)\s*\(/g) || [];
const longFunctions = [];
functions.forEach(fn => {
  const name = fn.match(/function\s+(\w+)/)[1];
  const fnRegex = new RegExp(`function\\s+${name}\\s*\\([\\s\\S]*?^\\s{8}\\}`, 'gm');
  const match = htmlContent.match(fnRegex);
  if (match && match[0] && match[0].split('\n').length > 100) {
    longFunctions.push({ name, lines: match[0].split('\n').length });
  }
});

check('代码质量 - 函数复杂度',
  longFunctions.length === 0 ? 'pass' : 'warn',
  longFunctions.length === 0 ? '无超长函数' : `${longFunctions.length}个函数超过100行: ${longFunctions.map(f => f.name).join(', ')}`);

// 检查重复代码模式
const tryCatchCount = (htmlContent.match(/try\s*\{/g) || []).length;
const showToastCount = (htmlContent.match(/showToast\(/g) || []).length;
check('代码质量 - 错误处理覆盖',
  tryCatchCount >= 10 ? 'pass' : 'warn',
  `${tryCatchCount}个try-catch块, ${showToastCount}次Toast调用`);

// 检查全局变量数量
const globalVars = htmlContent.match(/^\s*let\s+(\w+)/gm) || [];
check('代码质量 - 全局变量数量',
  globalVars.length < 30 ? 'pass' : 'warn',
  `${globalVars.length}个全局变量`);

// 检查是否有未使用的变量
const allGlobalVarNames = globalVars.map(g => g.match(/let\s+(\w+)/)[1]);
let unusedVars = 0;
allGlobalVarNames.forEach(name => {
  const regex = new RegExp(name, 'g');
  const count = (htmlContent.match(regex) || []).length;
  if (count <= 2) unusedVars++; // 声明 + 最多1次使用
});

check('代码质量 - 未使用变量',
  unusedVars < 5 ? 'pass' : 'warn',
  `${unusedVars}个可能未使用的变量`);

// ═══════════════════════════════════════════════════════════════
// 输出报告
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(80));
console.log('Phase 1: 代码静态分析报告');
console.log('='.repeat(80));
console.log(`\n总计: ${results.length} 项检查`);
console.log(`✅ 通过: ${passCount}`);
console.log(`❌ 失败: ${failCount}`);
console.log(`⚠️  警告: ${warnCount}`);
console.log('\n详细结果:');
console.log('-'.repeat(80));

results.forEach((r, i) => {
  const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⚠️';
  console.log(`${icon} ${i + 1}. ${r.name}`);
  console.log(`   ${r.detail}`);
});

console.log('\n' + '='.repeat(80));

// 保存报告
const report = {
  phase: 'Phase 1: 代码静态分析',
  timestamp: new Date().toISOString(),
  summary: { total: results.length, passed: passCount, failed: failCount, warnings: warnCount },
  results
};

const reportPath = path.join(__dirname, 'reports', 'phase1-static-analysis.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 报告已保存: ${reportPath}`);

process.exit(failCount > 0 ? 1 : 0);

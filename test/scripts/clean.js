/**
 * 清理测试产物
 * 用法: node scripts/clean.js
 */
const fs = require('fs');
const path = require('path');

const TEST_DIR = path.resolve(__dirname, '..');

const toClean = [
  path.join(TEST_DIR, 'test-downloads'),
  path.join(TEST_DIR, 'test-results'),
  path.join(TEST_DIR, 'playwright-report'),
];

toClean.forEach(dir => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  已清理: ${path.basename(dir)}/`);
  }
});

console.log('清理完毕');

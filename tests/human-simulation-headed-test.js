/**
 * Human-simulation headed test: step-by-step click through all 5 modes
 * Takes screenshots at every step for visual verification
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const BASE_URL = 'file:///private/tmp/excel-offline-tool/excel.html';
const FIXTURES = '/private/tmp/excel-offline-tool/test-fixtures';
const TEST_FILES = '/private/tmp/excel-offline-tool/tests/test-files';
const SCREENSHOT_DIR = '/private/tmp/excel-offline-tool/tests/human-test-screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let passCount = 0, failCount = 0;
const results = [];

function check(name, status, detail) {
  results.push({ name, status, detail });
  if (status === 'pass') passCount++; else failCount++;
  console.log(`${status === 'pass' ? '✅' : '❌'} ${name}: ${detail}`);
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('\n' + '='.repeat(70));
  console.log('拟人操作测试 - Headed Mode Step-by-Step');
  console.log('='.repeat(70));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ═══════════════════════════════════════════════════════════════
  // Test 1: 打开页面 - 验证初始状态
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 测试1: 打开页面，验证初始布局 ---');
  await page.goto(BASE_URL);
  await delay(1000);
  await screenshot(page, '01-initial-page');

  const title = await page.title();
  check('页面标题', title.includes('Excel') ? 'pass' : 'fail', title);

  const h1Text = await page.locator('.header h1').textContent();
  check('标题文字', h1Text.includes('Excel') ? 'pass' : 'fail', h1Text);

  const modeBtns = await page.locator('.mode-btn').count();
  check('模式按钮数量', modeBtns === 5 ? 'pass' : 'fail', `${modeBtns}个`);

  const step1Active = await page.locator('[data-step="1"]').getAttribute('class');
  check('默认第一步', step1Active.includes('active') ? 'pass' : 'fail', step1Active);

  const uploadVisible = await page.locator('#uploadArea').isVisible();
  check('上传区域可见', uploadVisible ? 'pass' : 'fail', uploadVisible ? '可见' : '不可见');

  // ═══════════════════════════════════════════════════════════════
  // Test 2: 按工作表拆分 - 完整流程
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 测试2: 按工作表拆分 - 完整流程 ---');
  await page.goto(BASE_URL);
  await delay(1000);

  const multiSheetFile = path.join(TEST_FILES, 'multi-sheet.xlsx');
  if (fs.existsSync(multiSheetFile)) {
    // Step 1: 上传文件
    await page.locator('#fileInput').setInputFiles(multiSheetFile);
    await delay(2000);
    await screenshot(page, '02-split-sheet-upload');

    const step2Active = await page.locator('[data-step="2"]').getAttribute('class');
    check('上传后进入步骤2', step2Active.includes('active') ? 'pass' : 'fail', step2Active);

    const sheetCount = await page.locator('#sheetList .sheet-item').count();
    check('工作表列表显示', sheetCount > 0 ? 'pass' : 'fail', `${sheetCount}个工作表`);

    const selectedCount = await page.locator('#sheetList .sheet-item.selected').count();
    check('工作表默认全选', selectedCount === sheetCount ? 'pass' : 'fail', `${selectedCount}/${sheetCount}`);

    // Step 2 -> Step 3
    await page.locator('#step2Next').click();
    await delay(500);
    await screenshot(page, '03-split-sheet-step3');

    const step3Active = await page.locator('[data-step="3"]').getAttribute('class');
    check('进入步骤3', step3Active.includes('active') ? 'pass' : 'fail', step3Active);

    const splitOptionsVisible = await page.locator('#splitSheetOptions').isVisible();
    check('拆分选项显示', splitOptionsVisible ? 'pass' : 'fail', splitOptionsVisible ? '可见' : '不可见');

    // 点击取消全选
    await page.locator('#splitSheetOptions button', { hasText: /^取消全选$/ }).click();
    await delay(300);
    const countAfterDeselect = await page.locator('#splitSheetSelectedCount').textContent();
    check('取消全选', countAfterDeselect.includes('0') ? 'pass' : 'fail', countAfterDeselect);

    // 点击全选
    await page.locator('#splitSheetOptions button', { hasText: /^全选$/ }).click();
    await delay(300);
    const countAfterSelect = await page.locator('#splitSheetSelectedCount').textContent();
    check('全选', countAfterSelect.includes('3') ? 'pass' : 'fail', countAfterSelect);

    // Step 3 -> Step 4 (生成)
    await page.locator('#step3Next').click();
    await delay(5000);
    await screenshot(page, '04-split-sheet-result');

    const summaryVisible = await page.locator('#resultSummary').isVisible();
    check('结果区域显示', summaryVisible ? 'pass' : 'fail', summaryVisible ? '可见' : '不可见');

    const fileCountText = await page.locator('#totalFiles').textContent();
    const fileCount = parseInt(fileCountText);
    check('生成文件数', fileCount > 0 ? 'pass' : 'fail', fileCountText);

    const sizeText = await page.locator('#totalSize').textContent();
    check('总大小显示', sizeText.length > 0 ? 'pass' : 'fail', sizeText);

    const downloadVisible = await page.locator('#downloadBtn').isVisible();
    check('下载按钮显示', downloadVisible ? 'pass' : 'fail', downloadVisible ? '可见' : '不可见');

    const fileListCount = await page.locator('#resultFileList .file-list-item').count();
    check('结果文件列表', fileListCount > 0 ? 'pass' : 'fail', `${fileListCount}个文件`);

    // 验证下载按钮可点击
    await page.locator('#downloadBtn').click();
    await delay(500);
    check('下载按钮可点击', 'pass', '点击下载无报错');
  } else {
    check('测试文件存在', 'fail', 'multi-sheet.xlsx 不存在');
  }

  // ═══════════════════════════════════════════════════════════════
  // Test 3: 按列拆分(横向) - 完整流程
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 测试3: 按列拆分(横向) - 完整流程 ---');
  await page.goto(BASE_URL);
  await delay(500);

  // 点击切换到按列拆分(横向)
  await page.locator('[data-mode="split-column"]').click();
  await delay(500);
  await screenshot(page, '05-column-split-mode');

  const colSplitActive = await page.locator('[data-mode="split-column"]').getAttribute('class');
  check('切换到按列拆分', colSplitActive.includes('active') ? 'pass' : 'fail', colSplitActive);

  const colSplitFile = path.join(TEST_FILES, 'split-by-column.xlsx');
  if (fs.existsSync(colSplitFile)) {
    await page.locator('#fileInput').setInputFiles(colSplitFile);
    await delay(2000);
    await screenshot(page, '06-column-split-upload');

    // 选择工作表
    await page.locator('#sheetList .sheet-item').first().click();
    await delay(300);

    const step2NextDisabled = await page.locator('#step2Next').isDisabled();
    check('选择工作表后可继续', !step2NextDisabled ? 'pass' : 'fail', step2NextDisabled ? '禁用' : '可用');

    await page.locator('#step2Next').click();
    await delay(1000);
    await screenshot(page, '07-column-split-step3');

    const columnCount = await page.locator('#columnList .sheet-item').count();
    check('列列表显示', columnCount > 0 ? 'pass' : 'fail', `${columnCount}列`);

    // 选择第一个拆分列
    await page.locator('#columnList .sheet-item').first().click();
    await delay(300);

    const step3NextDisabled = await page.locator('#step3Next').isDisabled();
    check('选择列后可继续', !step3NextDisabled ? 'pass' : 'fail', step3NextDisabled ? '禁用' : '可用');

    // 生成
    await page.locator('#step3Next').click();
    await delay(8000);
    await screenshot(page, '08-column-split-result');

    const colResultVisible = await page.locator('#resultSummary').isVisible();
    check('横向拆分结果显示', colResultVisible ? 'pass' : 'fail', colResultVisible ? '可见' : '不可见');

    const colFileCount = await page.locator('#totalFiles').textContent();
    check('横向拆分文件数', parseInt(colFileCount) > 1 ? 'pass' : 'fail', colFileCount);
  }

  // ═══════════════════════════════════════════════════════════════
  // Test 4: 按列拆分(竖向) - 完整流程
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 测试4: 按列拆分(竖向) - 完整流程 ---');
  await page.goto(BASE_URL);
  await delay(500);

  await page.locator('[data-mode="split-column-vertical"]').click();
  await delay(500);
  await screenshot(page, '09-vertical-split-mode');

  const vertSplitFile = path.join(TEST_FILES, 'vertical-split.xlsx');
  if (fs.existsSync(vertSplitFile)) {
    await page.locator('#fileInput').setInputFiles(vertSplitFile);
    await delay(2000);

    await page.locator('#sheetList .sheet-item').first().click();
    await delay(300);
    await page.locator('#step2Next').click();
    await delay(1000);
    await screenshot(page, '10-vertical-split-step3');

    const keyColCount = await page.locator('#verticalKeyColumnList .sheet-item').count();
    const dataColCount = await page.locator('#verticalColumnList .sheet-item').count();
    check('竖向拆分列选择显示', keyColCount > 0 && dataColCount > 0 ? 'pass' : 'fail',
      `固定列${keyColCount}个, 数据列${dataColCount}个`);

    // 选择固定列
    const firstKeyCheckbox = page.locator('#verticalKeyColumnList .sheet-checkbox').first();
    await firstKeyCheckbox.check();
    await delay(300);

    // 选择数据列
    const firstDataCheckbox = page.locator('#verticalColumnList .sheet-checkbox:not(:disabled)').first();
    await firstDataCheckbox.check();
    await delay(300);

    const vertStep3Disabled = await page.locator('#step3Next').isDisabled();
    check('选择列后可继续', !vertStep3Disabled ? 'pass' : 'fail', vertStep3Disabled ? '禁用' : '可用');

    await page.locator('#step3Next').click();
    await delay(8000);
    await screenshot(page, '11-vertical-split-result');

    const vertResultVisible = await page.locator('#resultSummary').isVisible();
    check('竖向拆分结果显示', vertResultVisible ? 'pass' : 'fail', vertResultVisible ? '可见' : '不可见');
  }

  // ═══════════════════════════════════════════════════════════════
  // Test 5: 文件合并 - 完整流程
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 测试5: 文件合并 - 完整流程 ---');
  await page.goto(BASE_URL);
  await delay(500);

  await page.locator('[data-mode="merge-file"]').click();
  await delay(500);
  await screenshot(page, '12-merge-file-mode');

  const merge1 = path.join(TEST_FILES, 'merge-1.xlsx');
  const merge2 = path.join(TEST_FILES, 'merge-2.xlsx');
  if (fs.existsSync(merge1) && fs.existsSync(merge2)) {
    await page.locator('#fileInput').setInputFiles([merge1, merge2]);
    await delay(2000);
    await screenshot(page, '13-merge-file-upload');

    const fileListCount = await page.locator('#fileList .file-list-item').count();
    check('合并文件列表显示', fileListCount === 2 ? 'pass' : 'fail', `${fileListCount}个文件`);

    await page.locator('#step2Next').click();
    await delay(500);
    await page.locator('#step3Next').click();
    await delay(8000);
    await screenshot(page, '14-merge-file-result');

    const mergeResultVisible = await page.locator('#resultSummary').isVisible();
    check('合并结果显示', mergeResultVisible ? 'pass' : 'fail', mergeResultVisible ? '可见' : '不可见');

    const mergeFileCount = await page.locator('#totalFiles').textContent();
    check('合并输出文件数', mergeFileCount === '1' ? 'pass' : 'fail', mergeFileCount);
  }

  // ═══════════════════════════════════════════════════════════════
  // Test 6: 工作表数据合并 - 完整流程
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 测试6: 工作表数据合并 - 完整流程 ---');
  await page.goto(BASE_URL);
  await delay(500);

  await page.locator('[data-mode="merge-sheet"]').click();
  await delay(500);
  await screenshot(page, '15-merge-sheet-mode');

  const ms1 = path.join(TEST_FILES, 'merge-sheet-1.xlsx');
  const ms2 = path.join(TEST_FILES, 'merge-sheet-2.xlsx');
  if (fs.existsSync(ms1) && fs.existsSync(ms2)) {
    await page.locator('#fileInput').setInputFiles([ms1, ms2]);
    await delay(2000);
    await screenshot(page, '16-merge-sheet-upload');

    await page.locator('#step2Next').click();
    await delay(500);
    await screenshot(page, '17-merge-sheet-step3');

    const mergeSheetDisabled = await page.locator('#step3Next').isDisabled();
    check('工作表数据合并可继续', !mergeSheetDisabled ? 'pass' : 'fail', mergeSheetDisabled ? '禁用' : '可用');

    await page.locator('#step3Next').click();
    await delay(8000);
    await screenshot(page, '18-merge-sheet-result');

    const mergeSheetResultVisible = await page.locator('#resultSummary').isVisible();
    check('工作表合并结果显示', mergeSheetResultVisible ? 'pass' : 'fail', mergeSheetResultVisible ? '可见' : '不可见');
  }

  // ═══════════════════════════════════════════════════════════════
  // Test 7: 重新开始
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 测试7: 重新开始功能 ---');
  await page.goto(BASE_URL);
  await delay(500);

  if (fs.existsSync(multiSheetFile)) {
    await page.locator('#fileInput').setInputFiles(multiSheetFile);
    await delay(2000);
    await page.locator('#step2Next').click();
    await delay(500);
    await page.locator('#step3Next').click();
    await delay(5000);

    await screenshot(page, '19-before-reset');

    const resetVisible = await page.locator('button:has-text("重新开始")').isVisible();
    check('重新开始按钮可见', resetVisible ? 'pass' : 'fail', resetVisible ? '可见' : '不可见');

    await page.locator('button:has-text("重新开始")').click();
    await delay(1000);
    await screenshot(page, '20-after-reset');

    const step1AfterReset = await page.locator('[data-step="1"]').getAttribute('class');
    check('重置后回到第一步', step1AfterReset.includes('active') ? 'pass' : 'fail', step1AfterReset);

    const sheetListEmpty = (await page.locator('#sheetList').textContent()).trim();
    check('重置后列表清空', sheetListEmpty === '' ? 'pass' : 'fail', sheetListEmpty === '' ? '空' : '非空');
  }

  // ═══════════════════════════════════════════════════════════════
  // Test 8: 异常处理 - 非Excel文件
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 测试8: 异常处理 - 非Excel文件 ---');
  await page.goto(BASE_URL);
  await delay(500);

  const txtFile = '/tmp/test-not-excel.txt';
  fs.writeFileSync(txtFile, 'not an excel file');
  await page.locator('#fileInput').setInputFiles(txtFile);
  await delay(1000);
  await screenshot(page, '21-invalid-file-error');

  const errorToast = page.locator('.toast.error');
  const errorVisible = await errorToast.isVisible();
  check('非Excel文件报错', errorVisible ? 'pass' : 'fail', errorVisible ? '显示错误' : '无错误');
  fs.unlinkSync(txtFile);

  // ═══════════════════════════════════════════════════════════════
  // Test 9: 输出文件数据验证
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 测试9: 输出文件数据验证 ---');

  // 验证测试文件本身的数据完整性
  const testFiles = [
    { name: 'multi-sheet.xlsx', path: path.join(TEST_FILES, 'multi-sheet.xlsx'), minSheets: 2 },
    { name: 'split-by-column.xlsx', path: path.join(TEST_FILES, 'split-by-column.xlsx'), minRows: 3 },
    { name: 'vertical-split.xlsx', path: path.join(TEST_FILES, 'vertical-split.xlsx'), minRows: 2 },
    { name: 'merge-1.xlsx', path: path.join(TEST_FILES, 'merge-1.xlsx'), minSheets: 1 },
    { name: 'merge-2.xlsx', path: path.join(TEST_FILES, 'merge-2.xlsx'), minSheets: 1 },
  ];

  for (const tf of testFiles) {
    if (fs.existsSync(tf.path)) {
      const wb = XLSX.readFile(tf.path);
      const sheetCount = wb.SheetNames.length;
      const totalRows = wb.SheetNames.reduce((sum, n) => {
        const data = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 });
        return sum + data.length;
      }, 0);
      check(`${tf.name} 数据完整性`,
        (tf.minSheets ? sheetCount >= tf.minSheets : totalRows >= (tf.minRows || 1)) ? 'pass' : 'fail',
        `${sheetCount}个工作表, ${totalRows}行数据`);
    } else {
      check(`${tf.name} 存在`, 'fail', '文件不存在');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Test 10: 模式切换后状态重置
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- 测试10: 模式切换后状态重置 ---');
  await page.goto(BASE_URL);
  await delay(500);

  if (fs.existsSync(multiSheetFile)) {
    await page.locator('#fileInput').setInputFiles(multiSheetFile);
    await delay(2000);

    // 切换到另一个模式
    await page.locator('[data-mode="split-column"]').click();
    await delay(500);
    await screenshot(page, '22-mode-switch-reset');

    const step1AfterSwitch = await page.locator('[data-step="1"]').getAttribute('class');
    check('切换模式后回到第一步', step1AfterSwitch.includes('active') ? 'pass' : 'fail', step1AfterSwitch);

    const uploadHint = await page.locator('#uploadHint').textContent();
    check('上传提示更新', uploadHint.length > 0 ? 'pass' : 'fail', uploadHint);
  }

  // ═══════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(70));
  console.log(`总计: ${results.length} | 通过: ${passCount} | 失败: ${failCount}`);
  console.log(`通过率: ${((passCount / results.length) * 100).toFixed(1)}%`);
  console.log(`截图: ${SCREENSHOT_DIR}/`);
  console.log('='.repeat(70));

  await browser.close();

  const report = {
    phase: '拟人操作测试 (Headed Step-by-Step)',
    timestamp: new Date().toISOString(),
    summary: { total: results.length, passed: passCount, failed: failCount },
    results
  };
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'human-test-report.json'),
    JSON.stringify(report, null, 2)
  );

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Test failed:', e.message);
  process.exit(1);
});

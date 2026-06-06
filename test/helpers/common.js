/**
 * Playwright 测试公共工具函数
 * 封装与 Excel 工具 UI 的交互逻辑，供各测试用例复用
 */
const { expect } = require('@playwright/test');
const path = require('path');

const TEST_DATA_DIR = path.resolve(__dirname, '..', 'test-data');

// ─── 页面导航 ────────────────────────────────────

async function gotoHome(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.mode-btn').first()).toBeVisible();
}

async function gotoSelfTest(page) {
  await page.goto('/?selftest=1');
  await page.waitForLoadState('networkidle');
  // 等待自测完成
  await page.waitForSelector('#selfTestPanel', { timeout: 15000 });
}

// ─── 模式切换 ────────────────────────────────────

async function selectMode(page, mode) {
  await page.click(`[data-mode="${mode}"]`);
  // 确认模式按钮变为 active
  await expect(page.locator(`[data-mode="${mode}"]`)).toHaveClass(/active/);
}

// ─── 文件上传 ────────────────────────────────────

async function uploadFile(page, fileName) {
  const filePath = path.join(TEST_DATA_DIR, fileName);
  const fileInput = page.locator('#fileInput');
  await fileInput.setInputFiles(filePath);
  // 等待文件解析完成（步骤1按钮变为可用）
  await expect(page.locator('#step1Next')).toBeEnabled({ timeout: 10000 });
}

async function uploadFiles(page, fileNames) {
  const filePaths = fileNames.map(f => path.join(TEST_DATA_DIR, f));
  const fileInput = page.locator('#fileInput');
  await fileInput.setInputFiles(filePaths);
  await expect(page.locator('#step1Next')).toBeEnabled({ timeout: 10000 });
}

// ─── 步骤导航 ────────────────────────────────────

async function goToStep2(page) {
  await page.click('#step1Next');
  // 合并模式跳过step2直接到step3（显示工作表选择）
  const activeStep = page.locator('.step-content.active');
  await expect(activeStep).toBeVisible({ timeout: 5000 });
}

async function goToStep3(page) {
  // 合并模式已通过step1Next直接跳到step3
  const step3Active = await page.locator('#step3').evaluate(el => el.classList.contains('active')).catch(() => false);
  if (!step3Active) {
    await page.click('#step2Next');
  }
  await expect(page.locator('#step3')).toHaveClass(/active/);
}

async function goToStep4(page) {
  await page.click('#step3Next');
  // 等待处理完成
  await waitForProcessing(page);
}

// ─── 工作表选择 ──────────────────────────────────

async function selectAllSheets(page) {
  // 根据当前模式选择正确的全选按钮ID
  const possibleIds = ['#splitSheetSelectAll', '#mergeFileSelectAll', '#mergeSheetSelectAll'];
  for (const id of possibleIds) {
    const btn = page.locator(id);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      return;
    }
  }
  // 修复：如果所有全选按钮都不可见，说明UI有问题，不应静默跳过
  throw new Error('selectAllSheets: 未找到任何可见的全选按钮');
}

async function selectSheetByName(page, name) {
  const checkbox = page.locator(`.sheet-checkbox:has-text("${name}") input, .sheet-checkbox:has-text("${name}")`);
  // 修复：用断言替代静默跳过，确保目标元素存在
  await expect(checkbox.first(), `名为"${name}"的Sheet复选框应存在`).toBeVisible({ timeout: 5000 });
  await checkbox.first().check();
}

// ─── 列选择（横向拆分） ──────────────────────────

async function selectColumnByIndex(page, index) {
  const checkboxes = page.locator('#columnList .sheet-checkbox');
  // 修复：用断言确保有足够的列可供选择
  const count = await checkboxes.count();
  expect(count, `列列表应有至少${index + 1}个可选项，实际只有${count}个`).toBeGreaterThan(index);
  await checkboxes.nth(index).check();
}

// ─── 列选择（竖向拆分） ──────────────────────────

async function selectVerticalColumnByIndex(page, index) {
  const checkboxes = page.locator('#verticalColumnList .sheet-checkbox');
  // 修复：用断言确保有足够的列可供选择
  const count = await checkboxes.count();
  expect(count, `竖向列列表应有至少${index + 1}个可选项，实际只有${count}个`).toBeGreaterThan(index);
  await checkboxes.nth(index).check();
}

// ─── 处理等待 ────────────────────────────────────

async function waitForProcessing(page) {
  // 等待加载遮罩出现然后消失
  const loading = page.locator('#loading');
  try {
    await loading.waitFor({ state: 'visible', timeout: 5000 });
  } catch (e) {
    // 可能处理太快没看到加载，这是正常的
  }
  await loading.waitFor({ state: 'hidden', timeout: 120000 });
  // 等待结果摘要出现
  await expect(page.locator('#resultSummary')).toBeVisible({ timeout: 10000 });
}

// ─── 下载处理 ────────────────────────────────────

async function downloadResult(page) {
  const downloadBtn = page.locator('#downloadBtn');
  await expect(downloadBtn).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    downloadBtn.click(),
  ]);
  return download;
}

async function downloadAndSave(page, savePath) {
  // 确保目标目录存在
  const fs = require('fs');
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const download = await downloadResult(page);
  await download.saveAs(savePath);
  return download;
}

// ─── 结果验证 ────────────────────────────────────

async function expectResultSuccess(page) {
  await expect(page.locator('#resultSummary')).toBeVisible();
  await expect(page.locator('#totalFiles')).not.toHaveText('0');
}

async function getResultFileCount(page) {
  const text = await page.locator('#totalFiles').textContent();
  return parseInt(text, 10) || 0;
}

async function getResultTotalSize(page) {
  const text = await page.locator('#totalSize').textContent();
  return text;
}

// ─── 自测验证 ────────────────────────────────────

async function expectSelfTestAllPassed(page) {
  const panel = page.locator('#selfTestPanel');
  await expect(panel).toBeVisible();
  // 检查面板顶部是绿色（通过）边框
  await expect(panel).toHaveClass(/cs-passed/);
  // 确认没有失败项
  const failItems = page.locator('.cs-selftest-fail');
  const failCount = await failItems.count();
  return failCount;
}

async function getSelfTestResults(page) {
  const panel = page.locator('#selfTestPanel');
  const passItems = await page.locator('.cs-selftest-ok').count();
  const failItems = await page.locator('.cs-selftest-fail').count();
  const failReasons = [];
  if (failItems > 0) {
    const reasons = await page.locator('.cs-selftest-reason').allTextContents();
    failReasons.push(...reasons);
  }
  return { passed: passItems, failed: failItems, failReasons };
}

// ─── 重置 ────────────────────────────────────

async function resetTool(page) {
  const resetBtn = page.locator('#resetBtn');
  await expect(resetBtn, '重置按钮应可见').toBeVisible({ timeout: 5000 });
  await resetBtn.click();
  await page.waitForLoadState('networkidle');
}

// ─── Toast 消息检测 ──────────────────────────────

async function waitForToast(page, type, timeout) {
  if (type === undefined) type = 'success';
  if (timeout === undefined) timeout = 5000;
  // Toast CSS类名使用空格分隔：.toast.error / .toast.warning / .toast.success / .toast.info
  var toastClass = '.toast.' + type;
  await page.waitForSelector(toastClass, { timeout: timeout });
}

module.exports = {
  TEST_DATA_DIR,
  gotoHome,
  gotoSelfTest,
  selectMode,
  uploadFile,
  uploadFiles,
  goToStep2,
  goToStep3,
  goToStep4,
  selectAllSheets,
  selectSheetByName,
  selectColumnByIndex,
  selectVerticalColumnByIndex,
  waitForProcessing,
  downloadResult,
  downloadAndSave,
  expectResultSuccess,
  getResultFileCount,
  getResultTotalSize,
  expectSelfTestAllPassed,
  getSelfTestResults,
  resetTool,
  waitForToast,
};

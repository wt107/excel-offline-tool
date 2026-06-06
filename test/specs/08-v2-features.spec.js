/**
 * 测试08: v2.0 新功能 — split-rows, smart-merge, 输出格式, 命名模板, 处理模式
 *
 * 注意：split-rows 跳过 step2（无工作表选择面板），使用 uploadAndGoToOptions
 * 直接进入 step3。smart-merge 模式走标准 step2→step3 流程。
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { gotoHome, selectMode, uploadFile, uploadFiles, goToStep2, goToStep3, goToStep4,
        selectAllSheets, selectSheetByName, downloadResult, expectResultSuccess,
        getResultFileCount, waitForProcessing, resetTool } = require('../helpers/common');

/** split-rows 模式：跳过 step2，直接进入 step3 */
async function uploadAndGoToOptions(page, mode, fileNames) {
  await gotoHome(page);
  await selectMode(page, mode);
  await uploadFile(page, fileNames);
  await page.click('#step1Next');
  await expect(page.locator('#step3')).toHaveClass(/active/, { timeout: 5000 });
}

test.describe('v2.0 新功能', () => {

  // ─── split-rows 模式 ────────────────────────────────────

  test.describe('split-rows 按行数拆分', () => {

    test('SR-01: 基本拆分 - 3000行每1000行一份，应生成3个文件', async ({ page }) => {
      await uploadAndGoToOptions(page, 'split-rows', 'large-3000rows.xlsx');
      await page.fill('#splitRowsPerFile', '1000');
      await goToStep4(page);
      await expectResultSuccess(page);
      const fileCount = await getResultFileCount(page);
      expect(fileCount).toBe(3);
    });

    test('SR-02: 命名模板自定义 - {original}_{index}模板', async ({ page }) => {
      await uploadAndGoToOptions(page, 'split-rows', 'large-3000rows.xlsx');
      await page.fill('#splitRowsPerFile', '2000');
      await page.fill('#splitRowsNamingTemplate', '文件_{index}');
      await goToStep4(page);
      await expectResultSuccess(page);
      const fileCount = await getResultFileCount(page);
      expect(fileCount).toBe(2);
    });

    test('SR-03: 空表头自动跳过', async ({ page }) => {
      await uploadAndGoToOptions(page, 'split-rows', 'basic-3sheets.xlsx');
      await page.fill('#splitRowsPerFile', '5');
      await goToStep4(page);
      await expectResultSuccess(page);
    });
  });

  // ─── smart-merge 模式A（step2 仅显示文件列表，无需 selectAllSheets） ──

  test.describe('smart-merge 模式A（全量追加）', () => {

    test('SM-A01: 2个结构相同文件的合并', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'smart-merge');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
      await goToStep2(page);
      await goToStep3(page);
      await page.check('input[name="smartMergeMode"][value="modeA"]');
      await page.fill('#smartMergeHeaderRows', '1');
      await goToStep4(page);
      await expectResultSuccess(page);
    });

    test('SM-A02: 添加来源列后合并', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'smart-merge');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
      await goToStep2(page);
      await goToStep3(page);
      await page.check('input[name="smartMergeMode"][value="modeA"]');
      await page.check('#smartMergeSourceColumn');
      await goToStep4(page);
      await expectResultSuccess(page);
    });

    test('SM-A03: 开启去重后合并', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'smart-merge');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
      await goToStep2(page);
      await goToStep3(page);
      await page.check('input[name="smartMergeMode"][value="modeA"]');
      await page.check('#smartMergeRemoveDuplicates');
      await goToStep4(page);
      await expectResultSuccess(page);
    });
  });

  // ─── smart-merge 模式B ─────────────────────────────────

  test.describe('smart-merge 模式B（按名称归类）', () => {

    test('SM-B01: 同名Sheet归类合并', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'smart-merge');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
      await goToStep2(page);
      await goToStep3(page);
      await page.check('input[name="smartMergeMode"][value="modeB"]');
      await goToStep4(page);
      await expectResultSuccess(page);
    });
  });

  // ─── 输出格式 toggle（split-sheet 单文件） ────────────

  test.describe('输出格式切换', () => {

    test('OF-01: split-sheet 单文件模式', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'split-sheet');
      await uploadFile(page, 'basic-3sheets.xlsx');
      await goToStep2(page);
      await selectAllSheets(page);
      await goToStep3(page);
      await page.check('input[name="splitSheetOutputFormat"][value="single"]');
      await goToStep4(page);
      await expectResultSuccess(page);
      const download = await downloadResult(page);
      expect(download.suggestedFilename()).toContain('.xlsx');
      expect(download.suggestedFilename()).not.toContain('.zip');
    });

    test('OF-02: split-sheet ZIP模式（默认）', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'split-sheet');
      await uploadFile(page, 'basic-3sheets.xlsx');
      await goToStep2(page);
      await selectAllSheets(page);
      await goToStep3(page);
      await page.check('input[name="splitSheetOutputFormat"][value="zip"]');
      await goToStep4(page);
      await expectResultSuccess(page);
      const download = await downloadResult(page);
      expect(download.suggestedFilename()).toContain('.zip');
    });
  });

  // ─── 处理模式切换 ─────────────────────────────────

  test.describe('处理模式切换', () => {

    test('PM-01: 全局切换为仅数据模式', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'split-sheet');
      await uploadFile(page, 'basic-3sheets.xlsx');
      await page.check('input[name="processingMode"][value="data"]');
      await goToStep2(page);
      await selectAllSheets(page);
      await goToStep3(page);
      await goToStep4(page);
      await expectResultSuccess(page);
    });

    test('PM-02: 全局保留格式模式（默认）', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'split-sheet');
      await uploadFile(page, 'basic-3sheets.xlsx');
      await page.check('input[name="processingMode"][value="full"]');
      await goToStep2(page);
      await selectAllSheets(page);
      await goToStep3(page);
      await goToStep4(page);
      await expectResultSuccess(page);
    });
  });

  // ─── 命名模板自定义 ─────────────────────────────────

  test.describe('命名模板', () => {

    test('NT-01: split-sheet 自定义命名模板', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'split-sheet');
      await uploadFile(page, 'basic-3sheets.xlsx');
      await goToStep2(page);
      await selectAllSheets(page);
      await goToStep3(page);
      await page.fill('#splitSheetNamingTemplate', '自定义_{index}');
      await goToStep4(page);
      await expectResultSuccess(page);
    });
  });
});

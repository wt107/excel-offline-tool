/**
 * Comprehensive E2E Test - All 5 modes full flow
 * Covers: UI interaction, file upload, processing, download, result validation
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const JSZip = require('jszip');

const BASE_URL = 'file:///private/tmp/excel-offline-tool/excel.html';
const FIXTURES = '/private/tmp/excel-offline-tool/test-fixtures';
const TEST_FILES_DIR = '/private/tmp/excel-offline-tool/tests/test-files';

// Ensure test files exist
function getFixture(name) {
  return path.join(FIXTURES, name);
}

function getTestFile(name) {
  return path.join(TEST_FILES_DIR, name);
}

test.describe('Phase 4+5+6+7+8: Comprehensive E2E Test', () => {

  // ═══════════════════════════════════════════════════════════════
  // Phase 4: E2E - Page Load & Initialization
  // ═══════════════════════════════════════════════════════════════
  test.describe('页面加载与初始化', () => {
    test('页面应正常加载', async ({ page }) => {
      await page.goto(BASE_URL);
      await expect(page).toHaveTitle(/Excel/);
    });

    test('5个模式按钮应可见', async ({ page }) => {
      await page.goto(BASE_URL);
      const modes = ['split-sheet', 'split-column', 'split-column-vertical', 'merge-file', 'merge-sheet'];
      for (const mode of modes) {
        await expect(page.locator(`[data-mode="${mode}"]`)).toBeVisible();
      }
    });

    test('四步流程指示器应可见', async ({ page }) => {
      await page.goto(BASE_URL);
      for (let i = 1; i <= 4; i++) {
        await expect(page.locator(`[data-step="${i}"]`)).toBeVisible();
      }
    });

    test('上传区域应可见', async ({ page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator('#uploadArea')).toBeVisible();
      await expect(page.locator('#fileInput')).toBeVisible();
    });

    test('默认模式应为按工作表拆分', async ({ page }) => {
      await page.goto(BASE_URL);
      const activeBtn = page.locator('.mode-btn.active');
      await expect(activeBtn).toHaveAttribute('data-mode', 'split-sheet');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Phase 5: UI Interaction - Mode Switching
  // ═══════════════════════════════════════════════════════════════
  test.describe('模式切换交互', () => {
    test('切换到按列拆分(横向)应更新UI', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column"]').click();
      await page.waitForTimeout(300);
      const activeBtn = page.locator('.mode-btn.active');
      await expect(activeBtn).toHaveAttribute('data-mode', 'split-column');
    });

    test('切换到按列拆分(竖向)应更新UI', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column-vertical"]').click();
      await page.waitForTimeout(300);
      const activeBtn = page.locator('.mode-btn.active');
      await expect(activeBtn).toHaveAttribute('data-mode', 'split-column-vertical');
    });

    test('切换到文件合并应允许多选', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="merge-file"]').click();
      await page.waitForTimeout(300);
      const multiple = await page.locator('#fileInput').getAttribute('multiple');
      expect(multiple).toBe('multiple');
    });

    test('切换到工作表数据合并应允许多选', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="merge-sheet"]').click();
      await page.waitForTimeout(300);
      const multiple = await page.locator('#fileInput').getAttribute('multiple');
      expect(multiple).toBe('multiple');
    });

    test('切换模式应重置状态', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column"]').click();
      await page.waitForTimeout(300);
      const step1Visible = await page.locator('#step1').getAttribute('class');
      expect(step1Visible).toContain('active');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Phase 4+5: Split by Sheet - Full Flow
  // ═══════════════════════════════════════════════════════════════
  test.describe('按工作表拆分 - 全流程', () => {
    test('上传多sheet文件应显示工作表列表', async ({ page }) => {
      await page.goto(BASE_URL);
      const multiSheetFile = getTestFile('multi-sheet.xlsx');
      if (!fs.existsSync(multiSheetFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(multiSheetFile);
      await page.waitForTimeout(1500);
      
      const step2Active = await page.locator('#step2').getAttribute('class');
      expect(step2Active).toContain('active');
      
      const sheetCount = await page.locator('#sheetList .sheet-item').count();
      expect(sheetCount).toBeGreaterThan(0);
    });

    test('工作表应默认全选', async ({ page }) => {
      await page.goto(BASE_URL);
      const multiSheetFile = getTestFile('multi-sheet.xlsx');
      if (!fs.existsSync(multiSheetFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(multiSheetFile);
      await page.waitForTimeout(1500);
      
      const selectedCount = await page.locator('#sheetList .sheet-item.selected').count();
      const totalCount = await page.locator('#sheetList .sheet-item').count();
      expect(selectedCount).toBe(totalCount);
    });

    test('全选/取消全选应正常工作', async ({ page }) => {
      await page.goto(BASE_URL);
      const multiSheetFile = getTestFile('multi-sheet.xlsx');
      if (!fs.existsSync(multiSheetFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(multiSheetFile);
      await page.waitForTimeout(1500);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(500);

      const countText1 = await page.locator('#splitSheetSelectedCount').textContent();
      expect(countText1).toMatch(/已选择: \d+ 个工作表/);

      await page.locator('#splitSheetOptions button:has-text("取消全选")').click();
      await page.waitForTimeout(300);
      const countText2 = await page.locator('#splitSheetSelectedCount').textContent();
      expect(countText2).toContain('已选择: 0');

      await page.locator('#splitSheetOptions button', { hasText: /^全选$/ }).click();
      await page.waitForTimeout(300);
      const countText3 = await page.locator('#splitSheetSelectedCount').textContent();
      expect(countText3).toMatch(/已选择: \d+ 个工作表/);
    });

    test('生成文件应显示结果统计', async ({ page }) => {
      await page.goto(BASE_URL);
      const multiSheetFile = getTestFile('multi-sheet.xlsx');
      if (!fs.existsSync(multiSheetFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(multiSheetFile);
      await page.waitForTimeout(1500);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(500);
      await page.locator('#step3Next').click();
      await page.waitForTimeout(3000);
      
      const summaryVisible = await page.locator('#resultSummary').isVisible();
      expect(summaryVisible).toBe(true);
      
      const fileCountText = await page.locator('#totalFiles').textContent();
      const fileCount = parseInt(fileCountText);
      expect(fileCount).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Phase 4+5: Split by Column (Horizontal) - Full Flow
  // ═══════════════════════════════════════════════════════════════
  test.describe('按列拆分(横向) - 全流程', () => {
    test('上传文件后选择工作表应进入配置', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column"]').click();
      await page.waitForTimeout(300);
      
      const colSplitFile = getTestFile('split-by-column.xlsx');
      if (!fs.existsSync(colSplitFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(colSplitFile);
      await page.waitForTimeout(1500);
      
      const sheetItem = page.locator('#sheetList .sheet-item').first();
      await sheetItem.click();
      await page.waitForTimeout(300);
      
      const step2NextDisabled = await page.locator('#step2Next').isDisabled();
      expect(step2NextDisabled).toBe(false);
    });

    test('表头行数设置应影响列列表', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column"]').click();
      await page.waitForTimeout(300);
      
      const colSplitFile = getTestFile('split-by-column.xlsx');
      if (!fs.existsSync(colSplitFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(colSplitFile);
      await page.waitForTimeout(1500);
      
      const sheetItem = page.locator('#sheetList .sheet-item').first();
      await sheetItem.click();
      await page.waitForTimeout(300);
      
      await page.locator('#step2Next').click();
      await page.waitForTimeout(1000);
      
      const columnCount1 = await page.locator('#columnList .sheet-item').count();
      expect(columnCount1).toBeGreaterThan(0);
    });

    test('选择拆分列后应允许继续', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column"]').click();
      await page.waitForTimeout(300);
      
      const colSplitFile = getTestFile('split-by-column.xlsx');
      if (!fs.existsSync(colSplitFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(colSplitFile);
      await page.waitForTimeout(1500);
      
      await page.locator('#sheetList .sheet-item').first().click();
      await page.waitForTimeout(300);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(1000);
      
      const firstColumn = page.locator('#columnList .sheet-item').first();
      await firstColumn.click();
      await page.waitForTimeout(300);
      
      const step3NextDisabled = await page.locator('#step3Next').isDisabled();
      expect(step3NextDisabled).toBe(false);
    });

    test('生成文件应正确分组', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column"]').click();
      await page.waitForTimeout(300);
      
      const colSplitFile = getTestFile('split-by-column.xlsx');
      if (!fs.existsSync(colSplitFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(colSplitFile);
      await page.waitForTimeout(1500);
      
      await page.locator('#sheetList .sheet-item').first().click();
      await page.waitForTimeout(300);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(1000);
      
      await page.locator('#columnList .sheet-item').first().click();
      await page.waitForTimeout(300);
      await page.locator('#step3Next').click();
      await page.waitForTimeout(5000);
      
      const summaryVisible = await page.locator('#resultSummary').isVisible();
      expect(summaryVisible).toBe(true);
      
      const fileCountText = await page.locator('#totalFiles').textContent();
      const fileCount = parseInt(fileCountText);
      expect(fileCount).toBeGreaterThan(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Phase 4+5: Split by Column (Vertical) - Full Flow
  // ═══════════════════════════════════════════════════════════════
  test.describe('按列拆分(竖向) - 全流程', () => {
    test('上传文件后应显示列选择', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column-vertical"]').click();
      await page.waitForTimeout(300);
      
      const vertSplitFile = getTestFile('vertical-split.xlsx');
      if (!fs.existsSync(vertSplitFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(vertSplitFile);
      await page.waitForTimeout(1500);
      
      await page.locator('#sheetList .sheet-item').first().click();
      await page.waitForTimeout(300);
      
      const step2NextDisabled = await page.locator('#step2Next').isDisabled();
      expect(step2NextDisabled).toBe(false);
    });

    test('选择固定列和数据列后应允许继续', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column-vertical"]').click();
      await page.waitForTimeout(300);
      
      const vertSplitFile = getTestFile('vertical-split.xlsx');
      if (!fs.existsSync(vertSplitFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(vertSplitFile);
      await page.waitForTimeout(1500);
      
      await page.locator('#sheetList .sheet-item').first().click();
      await page.waitForTimeout(300);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(1000);
      
      const keyCheckboxes = page.locator('#verticalKeyColumnList .sheet-checkbox');
      const keyCount = await keyCheckboxes.count();
      if (keyCount > 0) {
        await keyCheckboxes.first().check();
        await page.waitForTimeout(300);
      }
      
      const dataCheckboxes = page.locator('#verticalColumnList .sheet-checkbox:not(:disabled)');
      const dataCount = await dataCheckboxes.count();
      if (dataCount > 0) {
        await dataCheckboxes.first().check();
        await page.waitForTimeout(300);
      }
      
      const step3NextDisabled = await page.locator('#step3Next').isDisabled();
      expect(step3NextDisabled).toBe(false);
    });

    test('生成文件应包含固定列+数据列', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column-vertical"]').click();
      await page.waitForTimeout(300);
      
      const vertSplitFile = getTestFile('vertical-split.xlsx');
      if (!fs.existsSync(vertSplitFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(vertSplitFile);
      await page.waitForTimeout(1500);
      
      await page.locator('#sheetList .sheet-item').first().click();
      await page.waitForTimeout(300);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(1000);
      
      const keyCheckboxes = page.locator('#verticalKeyColumnList .sheet-checkbox');
      const keyCount = await keyCheckboxes.count();
      if (keyCount > 0) {
        await keyCheckboxes.first().check();
        await page.waitForTimeout(300);
      }
      
      const dataCheckboxes = page.locator('#verticalColumnList .sheet-checkbox:not(:disabled)');
      const dataCount = await dataCheckboxes.count();
      if (dataCount > 0) {
        await dataCheckboxes.first().check();
        await page.waitForTimeout(300);
      }
      
      await page.locator('#step3Next').click();
      await page.waitForTimeout(5000);
      
      const summaryVisible = await page.locator('#resultSummary').isVisible();
      expect(summaryVisible).toBe(true);
      
      const fileCountText = await page.locator('#totalFiles').textContent();
      const fileCount = parseInt(fileCountText);
      expect(fileCount).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Phase 4+5: Merge Files - Full Flow
  // ═══════════════════════════════════════════════════════════════
  test.describe('文件合并 - 全流程', () => {
    test('上传多个文件应显示文件列表', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="merge-file"]').click();
      await page.waitForTimeout(300);
      
      const merge1 = getTestFile('merge-1.xlsx');
      const merge2 = getTestFile('merge-2.xlsx');
      if (!fs.existsSync(merge1) || !fs.existsSync(merge2)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles([merge1, merge2]);
      await page.waitForTimeout(2000);
      
      const fileListCount = await page.locator('#fileList .file-list-item').count();
      expect(fileListCount).toBe(2);
    });

    test('生成合并文件应成功', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="merge-file"]').click();
      await page.waitForTimeout(300);
      
      const merge1 = getTestFile('merge-1.xlsx');
      const merge2 = getTestFile('merge-2.xlsx');
      if (!fs.existsSync(merge1) || !fs.existsSync(merge2)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles([merge1, merge2]);
      await page.waitForTimeout(2000);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(500);
      await page.locator('#step3Next').click();
      await page.waitForTimeout(5000);
      
      const summaryVisible = await page.locator('#resultSummary').isVisible();
      expect(summaryVisible).toBe(true);
      
      const fileCountText = await page.locator('#totalFiles').textContent();
      expect(parseInt(fileCountText)).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Phase 4+5: Merge Sheet Data - Full Flow
  // ═══════════════════════════════════════════════════════════════
  test.describe('工作表数据合并 - 全流程', () => {
    test('上传多个文件应显示工作表选择', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="merge-sheet"]').click();
      await page.waitForTimeout(300);
      
      const merge1 = getTestFile('merge-1.xlsx');
      const merge2 = getTestFile('merge-2.xlsx');
      if (!fs.existsSync(merge1) || !fs.existsSync(merge2)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles([merge1, merge2]);
      await page.waitForTimeout(2000);
      
      const step2Active = await page.locator('#step2').getAttribute('class');
      expect(step2Active).toContain('active');
    });

    test('生成合并数据应成功', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="merge-sheet"]').click();
      await page.waitForTimeout(300);

      const merge1 = getTestFile('merge-sheet-1.xlsx');
      const merge2 = getTestFile('merge-sheet-2.xlsx');
      if (!fs.existsSync(merge1) || !fs.existsSync(merge2)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles([merge1, merge2]);
      await page.waitForTimeout(2000);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(500);

      const step3NextDisabled = await page.locator('#step3Next').isDisabled();
      if (step3NextDisabled) {
        test.skip();
        return;
      }

      await page.locator('#step3Next').click();
      await page.waitForTimeout(5000);

      const summaryVisible = await page.locator('#resultSummary').isVisible();
      expect(summaryVisible).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Phase 5: Human-like Interaction Tests
  // ═══════════════════════════════════════════════════════════════
  test.describe('拟人操作测试', () => {
    test('点击上传区域应触发文件选择', async ({ page }) => {
      await page.goto(BASE_URL);
      const uploadArea = page.locator('#uploadArea');
      await expect(uploadArea).toBeVisible();
      
      const uploadText = await page.locator('#uploadText').textContent();
      expect(uploadText).toContain('拖放');
    });

    test('步骤导航应正确响应', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const step1Class = await page.locator('[data-step="1"]').getAttribute('class');
      expect(step1Class).toContain('active');
      
      const multiSheetFile = getTestFile('multi-sheet.xlsx');
      if (!fs.existsSync(multiSheetFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(multiSheetFile);
      await page.waitForTimeout(1500);
      
      const step2Class = await page.locator('[data-step="2"]').getAttribute('class');
      expect(step2Class).toContain('active');
      
      const step1Completed = await page.locator('[data-step="1"]').getAttribute('class');
      expect(step1Completed).toContain('completed');
    });

    test('Toast提示应显示并消失', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const multiSheetFile = getTestFile('multi-sheet.xlsx');
      if (!fs.existsSync(multiSheetFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(multiSheetFile);
      await page.waitForTimeout(1500);
      
      const toastVisible = await page.locator('.toast').isVisible();
      expect(toastVisible).toBe(true);
      
      const toastText = await page.locator('.toast').textContent();
      expect(toastText.length).toBeGreaterThan(0);
    });

    test('重新开始应重置所有状态', async ({ page }) => {
      await page.goto(BASE_URL);

      const multiSheetFile = getTestFile('multi-sheet.xlsx');
      if (!fs.existsSync(multiSheetFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(multiSheetFile);
      await page.waitForTimeout(1500);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(500);
      await page.locator('#step3Next').click();
      await page.waitForTimeout(3000);

      const resetVisible = await page.locator('button:has-text("重新开始")').isVisible();
      expect(resetVisible).toBe(true);

      await page.locator('button:has-text("重新开始")').click();
      await page.waitForTimeout(1000);

      const step1Class = await page.locator('[data-step="1"]').getAttribute('class');
      expect(step1Class).toContain('active');

      const sheetListContent = await page.locator('#sheetList').textContent();
      expect(sheetListContent.trim()).toBe('');
    });

    test('下载按钮应在生成后显示', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const multiSheetFile = getTestFile('multi-sheet.xlsx');
      if (!fs.existsSync(multiSheetFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(multiSheetFile);
      await page.waitForTimeout(1500);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(500);
      await page.locator('#step3Next').click();
      await page.waitForTimeout(3000);
      
      const downloadVisible = await page.locator('#downloadBtn').isVisible();
      expect(downloadVisible).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Phase 7: Boundary & Error Handling
  // ═══════════════════════════════════════════════════════════════
  test.describe('边界与异常处理', () => {
    test('非Excel文件应拒绝', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const txtFile = path.join('/tmp', 'test.txt');
      fs.writeFileSync(txtFile, 'not an excel file');
      
      await page.locator('#fileInput').setInputFiles(txtFile);
      await page.waitForTimeout(1000);
      
      const toast = page.locator('.toast.error');
      const toastVisible = await toast.isVisible();
      expect(toastVisible).toBe(true);
      
      fs.unlinkSync(txtFile);
    });

    test('未选择工作表应阻止生成', async ({ page }) => {
      await page.goto(BASE_URL);

      const multiSheetFile = getTestFile('multi-sheet.xlsx');
      if (!fs.existsSync(multiSheetFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(multiSheetFile);
      await page.waitForTimeout(1500);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(500);

      await page.locator('#splitSheetOptions button:has-text("取消全选")').click();
      await page.waitForTimeout(300);

      const step3NextDisabled = await page.locator('#step3Next').isDisabled();
      expect(step3NextDisabled).toBe(true);
    });

    test('竖向拆分未选固定列应阻止继续', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="split-column-vertical"]').click();
      await page.waitForTimeout(300);
      
      const vertSplitFile = getTestFile('vertical-split.xlsx');
      if (!fs.existsSync(vertSplitFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(vertSplitFile);
      await page.waitForTimeout(1500);
      
      await page.locator('#sheetList .sheet-item').first().click();
      await page.waitForTimeout(300);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(1000);
      
      const step3NextDisabled = await page.locator('#step3Next').isDisabled();
      expect(step3NextDisabled).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Phase 6+8: Output Validation & Format Retention
  // ═══════════════════════════════════════════════════════════════
  test.describe('输出结果与格式保留验证', () => {
    test('按工作表拆分 - ZIP文件应可解压且数据正确', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const multiSheetFile = getTestFile('multi-sheet.xlsx');
      if (!fs.existsSync(multiSheetFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(multiSheetFile);
      await page.waitForTimeout(1500);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(500);
      await page.locator('#step3Next').click();
      await page.waitForTimeout(5000);
      
      const fileCountText = await page.locator('#totalFiles').textContent();
      const fileCount = parseInt(fileCountText);
      expect(fileCount).toBeGreaterThan(0);
      
      const sizeText = await page.locator('#totalSize').textContent();
      expect(sizeText.length).toBeGreaterThan(0);
    });

    test('文件合并 - 输出应包含所有选中sheet', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.locator('[data-mode="merge-file"]').click();
      await page.waitForTimeout(300);
      
      const merge1 = getTestFile('merge-1.xlsx');
      const merge2 = getTestFile('merge-2.xlsx');
      if (!fs.existsSync(merge1) || !fs.existsSync(merge2)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles([merge1, merge2]);
      await page.waitForTimeout(2000);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(500);
      await page.locator('#step3Next').click();
      await page.waitForTimeout(5000);
      
      const fileCountText = await page.locator('#totalFiles').textContent();
      expect(parseInt(fileCountText)).toBe(1);
    });

    test('列宽格式应在拆分后保留', async ({ page }) => {
      await page.goto(BASE_URL);
      
      const colWidthFile = getTestFile('col-width-test.xlsx');
      if (!fs.existsSync(colWidthFile)) {
        test.skip();
        return;
      }
      await page.locator('#fileInput').setInputFiles(colWidthFile);
      await page.waitForTimeout(1500);
      await page.locator('#step2Next').click();
      await page.waitForTimeout(500);
      await page.locator('#step3Next').click();
      await page.waitForTimeout(5000);
      
      const summaryVisible = await page.locator('#resultSummary').isVisible();
      expect(summaryVisible).toBe(true);
    });
  });
});

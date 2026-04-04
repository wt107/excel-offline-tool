/**
 * Playwright E2E 测试规范
 * 完整的端到端测试用例
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════
// 测试数据
// ═══════════════════════════════════════════════════════════════

const TEST_FILES = {
  singleSheet: path.join(__dirname, '../../fixtures/sample-main.xlsx'),
  multiSheet: path.join(__dirname, '../../fixtures/sample-merge.xlsx'),
  legacyXls: path.join(__dirname, '../../fixtures/sample-legacy.xls'),
  compatible: path.join(__dirname, '../../fixtures/sample-compatible.xlsx'),
};

// ═══════════════════════════════════════════════════════════════
// 页面对象模式
// ═══════════════════════════════════════════════════════════════

class ExcelToolPage {
  constructor(page) {
    this.page = page;
    
    // 模式按钮
    this.modeButtons = {
      splitSheet: page.locator('[data-mode="split-sheet"]'),
      splitColumnH: page.locator('[data-mode="split-column"]'),
      splitColumnV: page.locator('[data-mode="split-column-vertical"]'),
      mergeFile: page.locator('[data-mode="merge-file"]'),
      mergeSheet: page.locator('[data-mode="merge-sheet"]'),
    };
    
    // 文件上传
    this.fileInput = page.locator('#fileInput');
    this.uploadArea = page.locator('#uploadArea');
    
    // 步骤导航
    this.steps = {
      1: page.locator('[data-step="1"]'),
      2: page.locator('[data-step="2"]'),
      3: page.locator('[data-step="3"]'),
      4: page.locator('[data-step="4"]'),
    };
    
    // 按钮
    this.nextButton = page.locator('#step2Next, #step3Next, #step1Next');
    this.prevButton = page.locator('button:has-text("上一步")');
    this.resetButton = page.locator('button:has-text("重新开始")');
    this.downloadButton = page.locator('#downloadBtn');
    this.selectAllButton = page.locator('button:has-text("全选")');
    this.deselectAllButton = page.locator('button:has-text("取消全选")');
    
    // 结果显示
    this.resultSummary = page.locator('#resultSummary');
    this.totalFiles = page.locator('#totalFiles');
    this.totalSize = page.locator('#totalSize');
    this.fileList = page.locator('#resultFileList');
    
    // Toast 提示
    this.toast = page.locator('.toast');
  }

  async goto() {
    await this.page.goto('');
    await this.page.waitForLoadState('networkidle');
  }

  async selectMode(mode) {
    await this.modeButtons[mode].click();
    await this.page.waitForTimeout(300);
  }

  async uploadFile(filePath) {
    await this.fileInput.setInputFiles(filePath);
    await this.page.waitForTimeout(1000);
  }

  async uploadMultipleFiles(filePaths) {
    await this.fileInput.setInputFiles(filePaths);
    await this.page.waitForTimeout(1000);
  }

  async clickNext() {
    await this.nextButton.click();
    await this.page.waitForTimeout(500);
  }

  async clickPrev() {
    await this.prevButton.first().click();
    await this.page.waitForTimeout(300);
  }

  async clickReset() {
    await this.resetButton.click();
    await this.page.waitForTimeout(300);
  }

  async selectAllSheets() {
    await this.selectAllButton.click();
    await this.page.waitForTimeout(200);
  }

  async deselectAllSheets() {
    await this.deselectAllButton.click();
    await this.page.waitForTimeout(200);
  }

  async selectSheetByName(name) {
    const sheetItem = this.page.locator(`.sheet-item:has-text("${name}")`);
    await sheetItem.click();
    await this.page.waitForTimeout(200);
  }

  async selectColumnByIndex(index) {
    const columnItem = this.page.locator(`#columnList .sheet-item`).nth(index);
    await columnItem.click();
    await this.page.waitForTimeout(200);
  }

  async setHeaderRows(value) {
    const input = this.page.locator('#splitHeaderRows, #splitVerticalHeaderRows, #headerRows').first();
    await input.fill(value.toString());
    await this.page.waitForTimeout(300);
  }

  async waitForToast() {
    await this.toast.waitFor({ state: 'visible', timeout: 5000 });
  }

  async getToastText() {
    return await this.toast.textContent();
  }

  async getCurrentStep() {
    const activeStep = await this.page.locator('.step.active').getAttribute('data-step');
    return parseInt(activeStep);
  }

  async getGeneratedFileCount() {
    const text = await this.totalFiles.textContent();
    return parseInt(text);
  }
}

// ═══════════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════════

test.describe('Excel 离线工具 E2E 测试', () => {
  let excelPage;

  test.beforeEach(async ({ page }) => {
    excelPage = new ExcelToolPage(page);
    await excelPage.goto();
  });

  // ─────────────────────────────────────────────────────────────
  // 页面加载和初始化
  // ─────────────────────────────────────────────────────────────
  test.describe('页面加载', () => {
    test('页面标题应正确显示', async () => {
      await expect(excelPage.page).toHaveTitle(/Excel/);
    });

    test('应显示所有模式切换按钮', async () => {
      await expect(excelPage.modeButtons.splitSheet).toBeVisible();
      await expect(excelPage.modeButtons.splitColumnH).toBeVisible();
      await expect(excelPage.modeButtons.splitColumnV).toBeVisible();
      await expect(excelPage.modeButtons.mergeFile).toBeVisible();
      await expect(excelPage.modeButtons.mergeSheet).toBeVisible();
    });

    test('应显示四步流程指示器', async () => {
      await expect(excelPage.steps[1]).toBeVisible();
      await expect(excelPage.steps[2]).toBeVisible();
      await expect(excelPage.steps[3]).toBeVisible();
      await expect(excelPage.steps[4]).toBeVisible();
    });

    test('初始应显示第一步', async () => {
      const currentStep = await excelPage.getCurrentStep();
      expect(currentStep).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 模式切换
  // ─────────────────────────────────────────────────────────────
  test.describe('模式切换', () => {
    test('切换模式应更新活动状态', async () => {
      await excelPage.selectMode('split-column');
      await expect(excelPage.modeButtons.splitColumnH).toHaveClass(/active/);
    });

    test('合并模式应允许多文件上传', async () => {
      await excelPage.selectMode('merge-file');
      const multiple = await excelPage.fileInput.getAttribute('multiple');
      expect(multiple).toBe('multiple');
    });

    test('拆分模式应只允许单文件上传', async () => {
      await excelPage.selectMode('split-sheet');
      const multiple = await excelPage.fileInput.getAttribute('multiple');
      expect(multiple).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 文件上传
  // ─────────────────────────────────────────────────────────────
  test.describe('文件上传', () => {
    test('上传有效 XLSX 文件应解析成功', async () => {
      // 跳过如果测试文件不存在
      if (!fs.existsSync(TEST_FILES.singleSheet)) {
        test.skip();
        return;
      }
      
      await excelPage.uploadFile(TEST_FILES.singleSheet);
      await excelPage.waitForToast();
      const toastText = await excelPage.getToastText();
      expect(toastText).toContain('成功');
    });

    test('上传后应自动进入第二步', async () => {
      if (!fs.existsSync(TEST_FILES.singleSheet)) {
        test.skip();
        return;
      }
      
      await excelPage.uploadFile(TEST_FILES.singleSheet);
      await excelPage.page.waitForTimeout(500);
      const currentStep = await excelPage.getCurrentStep();
      expect(currentStep).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 按工作表拆分
  // ─────────────────────────────────────────────────────────────
  test.describe('按工作表拆分', () => {
    test('应显示所有工作表', async () => {
      if (!fs.existsSync(TEST_FILES.multiSheet)) {
        test.skip();
        return;
      }
      
      await excelPage.uploadFile(TEST_FILES.multiSheet);
      await excelPage.page.waitForTimeout(500);
      
      const sheets = await excelPage.page.locator('#sheetList .sheet-item').count();
      expect(sheets).toBeGreaterThan(0);
    });

    test('全选应选中所有工作表', async () => {
      if (!fs.existsSync(TEST_FILES.multiSheet)) {
        test.skip();
        return;
      }
      
      await excelPage.uploadFile(TEST_FILES.multiSheet);
      await excelPage.page.waitForTimeout(500);
      await excelPage.selectAllSheets();
      
      const selectedCount = await excelPage.page.locator('#sheetList .sheet-item.selected').count();
      const totalCount = await excelPage.page.locator('#sheetList .sheet-item').count();
      expect(selectedCount).toBe(totalCount);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 重置功能
  // ─────────────────────────────────────────────────────────────
  test.describe('重置功能', () => {
    test('重置应返回到第一步', async () => {
      if (!fs.existsSync(TEST_FILES.singleSheet)) {
        test.skip();
        return;
      }
      
      await excelPage.uploadFile(TEST_FILES.singleSheet);
      await excelPage.page.waitForTimeout(500);
      await excelPage.clickReset();
      await excelPage.page.waitForTimeout(300);
      
      const currentStep = await excelPage.getCurrentStep();
      expect(currentStep).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 性能测试
  // ─────────────────────────────────────────────────────────────
  test.describe('性能测试', () => {
    test('文件解析应在合理时间内完成', async () => {
      if (!fs.existsSync(TEST_FILES.singleSheet)) {
        test.skip();
        return;
      }
      
      const startTime = Date.now();
      
      await excelPage.uploadFile(TEST_FILES.singleSheet);
      await excelPage.page.waitForTimeout(500);
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000); // 5秒内完成
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════

module.exports = { ExcelToolPage };

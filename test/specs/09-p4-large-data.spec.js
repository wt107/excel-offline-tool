/**
 * 测试09: P4.2 大数据量分片处理
 * 验证文件行数显示、大文件警告、最大处理行数限制
 */
const { test, expect } = require('@playwright/test');
const { gotoHome, selectMode, uploadFile, goToStep2, goToStep3, goToStep4,
        selectAllSheets, waitForToast, expectResultSuccess, waitForProcessing,
        uploadFiles } = require('../helpers/common');

test.describe('P4.2 大数据量分片处理', () => {

  test('P4-01: 上传文件后行数信息应包含行号和Sheet数量', async ({ page }) => {
    await gotoHome(page);
    await uploadFile(page, 'large-3000rows.xlsx');

    // fileInfo 应显示（上传后自动展示）
    await expect(page.locator('#fileInfo')).toHaveClass(/cs-flex/);

    // 验证 fileInfo 的子文本包含行和 Sheet 数量（不依赖 fileRows 可见性）
    await expect(page.locator('#fileInfo')).toContainText(/3[,.]?001.*1 个 Sheet/, { timeout: 8000 });
  });

  test('P4-02: merge-sheet 模式下设置最大行数后处理应正常', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');

    // 先上传文件
    await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    // 然后再设置最大行数（此时 processingModeBar 可见）
    const maxRowsInput = page.locator('#maxDataRows');
    await maxRowsInput.click();
    await maxRowsInput.fill('10');

    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);
  });

  test('P4-03: split-sheet 模式下上传大文件后设置最大行数', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-sheet');

    await uploadFile(page, 'large-3000rows.xlsx');

    // 上传后 processingModeBar 可见，再设最大行数
    const maxRowsInput = page.locator('#maxDataRows');
    await maxRowsInput.click();
    await maxRowsInput.fill('10');

    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);
  });

  test('P4-04: 行数上限为0时不限制', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');

    // 确保最大行数为0（默认值）
    const maxRowsInput = page.locator('#maxDataRows');
    await expect(maxRowsInput).toHaveValue('0');

    await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);
  });

  test('P4-05: smart-merge 模式设置最大行数后处理应正常', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'smart-merge');

    // 先上传再设最大行数
    await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);

    const maxRowsInput = page.locator('#maxDataRows');
    await maxRowsInput.click();
    await maxRowsInput.fill('5');

    // 智能合并的步骤：上传后直接看到工作表选择
    // 不需要手动选择工作表（全量追加模式下默认全选）
    await goToStep2(page);
    // 等待处理界面出现 → 进入生成步骤
    await goToStep3(page);

    // 完成处理
    await page.locator('#step3Next').click();
    await waitForProcessing(page);

    await expectResultSuccess(page);
  });

  test('P4-06: 合并计算模式设置最大行数后处理应正常', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'summary-merge');

    await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);

    const maxRowsInput = page.locator('#maxDataRows');
    await maxRowsInput.click();
    await maxRowsInput.fill('5');

    // summary-merge流程：step1Next → step2(文件列表) → step2Next → step3(选项)
    await page.click('#step1Next');
    await expect(page.locator('.step-content#step2')).toHaveClass(/active/);
    await page.click('#step2Next');
    await expect(page.locator('.step-content#step3')).toHaveClass(/active/);

    // Sheet已被displayMergeSheetSelection自动全选，无需手动操作
    // 直接选择分组列和数值列
    const groupCbs = page.locator('#summaryGroupColumns .sheet-checkbox');
    await expect(groupCbs.first()).toBeVisible({ timeout: 5000 });
    if ((await groupCbs.count()) > 0) await groupCbs.first().check();

    const valueCbs = page.locator('#summaryValueColumns .sheet-checkbox');
    await expect(valueCbs.first()).toBeVisible({ timeout: 5000 });
    if ((await valueCbs.count()) > 0) await valueCbs.first().check();

    // 执行处理
    await expect(page.locator('#step3Next')).toBeEnabled({ timeout: 3000 });
    await page.locator('#step3Next').click();
    await waitForProcessing(page);

    await expectResultSuccess(page);
  });
});

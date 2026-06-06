/**
 * 测试01: 按工作表拆分
 * 上传多Sheet文件 → 选择部分Sheet → 拆分为独立文件 → 验证ZIP下载
 */
const { test, expect } = require('@playwright/test');
const { gotoHome, selectMode, uploadFile, goToStep2, goToStep3, goToStep4,
        selectAllSheets, selectSheetByName, downloadResult, expectResultSuccess,
        getResultFileCount } = require('../helpers/common');

test.describe('按工作表拆分', () => {

  test('拆分3个Sheet的文件，应生成3个独立文件（空表跳过后2个）', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-sheet');
    await uploadFile(page, 'basic-3sheets.xlsx');
    await goToStep2(page);

    // 应能看到工作表列表
    const sheetCheckboxes = page.locator('#sheetList .sheet-checkbox');
    const count = await sheetCheckboxes.count();
    expect(count).toBe(3); // 精确验证3个Sheet

    // 全选
    await selectAllSheets(page);
    await goToStep3(page);
    await goToStep4(page);

    // 验证结果
    await expectResultSuccess(page);
    const fileCount = await getResultFileCount(page);
    // 3个Sheet中1个空表被跳过，应精确生成2个文件
    expect(fileCount).toBe(2);

    // 下载验证
    const download = await downloadResult(page);
    expect(download.suggestedFilename()).toContain('.zip');
  });

  test('只选择1个Sheet拆分', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-sheet');
    await uploadFile(page, 'basic-3sheets.xlsx');
    await goToStep2(page);

    // 取消全选，只选第一个
    const allCheckboxes = page.locator('#sheetList .sheet-checkbox');
    const count = await allCheckboxes.count();
    for (let i = 1; i < count; i++) {
        await allCheckboxes.nth(i).uncheck();
    }

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);
    const fileCount = await getResultFileCount(page);
    expect(fileCount).toBe(1);
  });

  test('空Sheet应被自动跳过并提示', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-sheet');
    await uploadFile(page, 'basic-3sheets.xlsx');
    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);
    // 检查是否有跳过空表的提示
    const skipInfo = page.locator('#skippedEmptySheetsInfo');
    await expect(skipInfo).toBeVisible({ timeout: 5000 });
  });
});

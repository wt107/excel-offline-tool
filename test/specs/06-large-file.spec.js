/**
 * 测试06: 大文件与性能测试
 * 验证时间片分片、内存优化、旧设备兼容性
 */
const { test, expect } = require('@playwright/test');
const { gotoHome, selectMode, uploadFile, goToStep2, goToStep3, goToStep4,
        selectAllSheets, downloadResult, expectResultSuccess } = require('../helpers/common');

test.describe('大文件处理', () => {

  test('3000行文件按工作表拆分不应假死', async ({ page }) => {
    // 记录开始时间
    const startTime = Date.now();

    await gotoHome(page);
    await selectMode(page, 'split-sheet');
    await uploadFile(page, 'large-3000rows.xlsx');
    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);

    const elapsed = Date.now() - startTime;
    console.log(`  3000行拆分耗时: ${(elapsed / 1000).toFixed(1)}秒`);

    // 不应超过60秒（含浏览器启动）
    expect(elapsed).toBeLessThan(60000);
  });

  test('3000行文件按列拆分(横向)应正常完成', async ({ page }) => {
    const startTime = Date.now();

    await gotoHome(page);
    await selectMode(page, 'split-column');
    await uploadFile(page, 'large-3000rows.xlsx');
    await goToStep2(page);

    // 选择"分类"列（第5列，索引4）
    const checkboxes = page.locator('#columnList .sheet-checkbox');
    const count = await checkboxes.count();
    expect(count, '列列表应有至少5个可选项').toBeGreaterThan(4);
    await checkboxes.nth(4).check();

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);

    const elapsed = Date.now() - startTime;
    console.log(`  3000行按列拆分耗时: ${(elapsed / 1000).toFixed(1)}秒`);
    expect(elapsed).toBeLessThan(90000);
  });
});

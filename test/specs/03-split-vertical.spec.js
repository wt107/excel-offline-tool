/**
 * 测试03: 按列拆分（竖向）
 * 上传多列文件 → 选择部分列 → 竖向拆分为独立文件
 */
const { test, expect } = require('@playwright/test');
const { gotoHome, selectMode, uploadFile, goToStep2, goToStep3, goToStep4,
        selectVerticalColumnByIndex, downloadResult, expectResultSuccess,
        getResultFileCount } = require('../helpers/common');

test.describe('按列拆分(竖向)', () => {

  test('6列成绩表选3列拆分', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-column-vertical');
    await uploadFile(page, 'multi-column.xlsx');
    await goToStep2(page);

    // 选择语文、数学、英语（第1、2、3列）
    await selectVerticalColumnByIndex(page, 1);
    await selectVerticalColumnByIndex(page, 2);
    await selectVerticalColumnByIndex(page, 3);

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);
    // 3列 → 3个文件
    const fileCount = await getResultFileCount(page);
    expect(fileCount).toBe(3);

    const download = await downloadResult(page);
    expect(download.suggestedFilename()).toContain('.zip');
  });

  test('选择全部6列拆分', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-column-vertical');
    await uploadFile(page, 'multi-column.xlsx');
    await goToStep2(page);

    // 全选6列
    for (let i = 0; i < 6; i++) {
      await selectVerticalColumnByIndex(page, i);
    }

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);
    const fileCount = await getResultFileCount(page);
    expect(fileCount).toBe(6);
  });
});

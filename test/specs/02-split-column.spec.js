/**
 * 测试02: 按列拆分（横向）
 * 上传含分类列的文件 → 选择拆分列 → 按列值拆分 → 验证ZIP下载
 */
const { test, expect } = require('@playwright/test');
const { gotoHome, selectMode, uploadFile, goToStep2, goToStep3, goToStep4,
        selectColumnByIndex, downloadResult, expectResultSuccess,
        getResultFileCount } = require('../helpers/common');

test.describe('按列拆分(横向)', () => {

  test('按分类列拆分含合并单元格的文件', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-column');
    await uploadFile(page, 'merged-cells.xlsx');
    await goToStep2(page);

    // 选择第1列（分类列）作为拆分依据
    await selectColumnByIndex(page, 0);

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);
    // "水果"、"蔬菜"、"饮料" 3个分类 → 3个文件
    const fileCount = await getResultFileCount(page);
    expect(fileCount).toBe(3);

    const download = await downloadResult(page);
    expect(download.suggestedFilename()).toContain('.zip');
  });

  test('大小写冲突值拆分应生成不同文件名', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-column');
    await uploadFile(page, 'case-sensitive.xlsx');
    await goToStep2(page);

    // 选择"部门"列
    await selectColumnByIndex(page, 0);

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);
    // Apple, apple, Banana, banana, Cherry = 5个文件（不应合并为3个）
    const fileCount = await getResultFileCount(page);
    expect(fileCount).toBe(5);
  });

  test('特殊字符拆分列值应被安全处理', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-column');
    await uploadFile(page, 'special-chars.xlsx');
    await goToStep2(page);

    await selectColumnByIndex(page, 0);

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);
    // 即使列值含 \/:*?"<>| 也应正常生成，验证文件数大于0且可下载
    const fileCount = await getResultFileCount(page);
    expect(fileCount).toBe(4);
    const download = await downloadResult(page);
    expect(download.suggestedFilename()).toContain('.zip');
  });
});

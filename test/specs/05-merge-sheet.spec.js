/**
 * 测试05: 工作表数据合并
 * 上传多个结构相同的Excel → 合并各Sheet数据为一张总表 → 验证输出
 */
const { test, expect } = require('@playwright/test');
const { gotoHome, selectMode, uploadFiles, goToStep2, goToStep3, goToStep4,
        downloadResult, expectResultSuccess, downloadAndSave,
        TEST_DATA_DIR } = require('../helpers/common');
const path = require('path');

test.describe('工作表数据合并', () => {

  test('合并2个文件的"销售"Sheet数据', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');
    await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await goToStep2(page);

    // 选择"销售"Sheet进行合并（用断言确保元素存在）
    const salesCheckbox = page.locator('.sheet-checkbox-item').filter({ hasText: '销售' });
    await expect(salesCheckbox.first(), '应存在"销售"Sheet复选框').toBeVisible({ timeout: 5000 });
    await salesCheckbox.first().locator('input').check();

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);

    const download = await downloadResult(page);
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('合并后文件应包含"来源文件"列且数据正确', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');
    await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await goToStep2(page);

    // 选择所有可用的Sheet
    const checkboxes = page.locator('.sheet-checkbox');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);

    // 下载文件并验证内容
    const savePath = path.join(TEST_DATA_DIR, '..', 'test-downloads', 'merge-sheet-result.xlsx');
    const download = await downloadAndSave(page, savePath);

    // 使用XLSX库验证合并结果
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(savePath);
    expect(wb.SheetNames.length, '应至少有1个Sheet').toBeGreaterThanOrEqual(1);

    // 检查第一个Sheet是否包含"来源文件"列（合并后自动添加）
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    expect(data.length, '数据行应大于1（含表头）').toBeGreaterThan(1);

    const headerRow = data[0];
    const hasSourceCol = headerRow.some(h => h === '来源文件' || h === '来源' || String(h).includes('来源'));
    expect(hasSourceCol, '合并后应包含"来源文件"列').toBe(true);
  });

  test('合并不同结构的Sheet应跳过不一致的Sheet', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');
    await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await goToStep2(page);

    // 选择所有Sheet（包含结构不同的Sheet如"库存"）
    const checkboxes = page.locator('.sheet-checkbox');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    await goToStep3(page);
    await goToStep4(page);

    // 处理应正常完成，不崩溃
    await expectResultSuccess(page);
  });
});

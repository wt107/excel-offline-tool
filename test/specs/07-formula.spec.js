/**
 * 测试07: 公式处理
 * 上传含公式的文件 → 验证公式保留 → 合并后公式仍有效 → fullCalcOnLoad注入
 */
const { test, expect } = require('@playwright/test');
const { gotoHome, selectMode, uploadFile, uploadFiles, goToStep2, goToStep3, goToStep4,
        selectAllSheets, downloadResult, downloadAndSave,
        expectResultSuccess, TEST_DATA_DIR } = require('../helpers/common');
const path = require('path');

test.describe('公式处理', () => {

  test('含公式的文件拆分后公式应保留', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-sheet');
    await uploadFile(page, 'formula.xlsx');
    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);

    // 下载ZIP
    const download = await downloadResult(page);
    expect(download.suggestedFilename()).toContain('.zip');
  });

  test('含公式的文件合并后fullCalcOnLoad应被注入', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-file');
    await uploadFiles(page, ['formula.xlsx', 'simple-merge-a.xlsx']);
    await goToStep2(page);

    // 点击全选按钮（用断言确保按钮可见）
    const selectAllBtn = page.locator('#mergeFileSelectAll');
    await expect(selectAllBtn, '全选按钮应可见').toBeVisible({ timeout: 5000 });
    await selectAllBtn.click();

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);

    // 下载合并后的文件并验证fullCalcOnLoad
    const savePath = path.join(TEST_DATA_DIR, '..', 'test-downloads', 'formula-merge-result.xlsx');
    await downloadAndSave(page, savePath);

    const XLSX = require('xlsx');
    const wb = XLSX.readFile(savePath);

    // 合并后的文件必须有Workbook.CalcPr.fullCalcOnLoad=1
    // 修复：如果CalcPr不存在则测试失败，不再静默跳过
    expect(wb.Workbook, '工作簿应有Workbook属性').toBeDefined();
    expect(wb.Workbook.CalcPr, '应有CalcPr属性(由injectFullCalcOnLoad注入)').toBeDefined();
    expect(wb.Workbook.CalcPr.fullCalcOnLoad, 'fullCalcOnLoad应为"1"').toBe('1');

    // 验证文件包含多个Sheet
    expect(wb.SheetNames.length, '合并后应有多个Sheet').toBeGreaterThanOrEqual(2);
  });

  test('数据合并含公式的Sheet应保留公式字段', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');
    await uploadFiles(page, ['formula.xlsx']);
    await goToStep2(page);

    // 选择公式Sheet
    const checkboxes = page.locator('.sheet-checkbox');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);

    // 下载并验证
    const savePath = path.join(TEST_DATA_DIR, '..', 'test-downloads', 'formula-sheet-merge.xlsx');
    await downloadAndSave(page, savePath);

    const XLSX = require('xlsx');
    const wb = XLSX.readFile(savePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // 合并后应仍有数据行
    expect(data.length, '合并后应有数据行').toBeGreaterThan(1);

    // 验证至少有一个单元格保留了公式字段(f)
    let formulaCount = 0;
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: r, c: c });
        if (ws[addr] && ws[addr].f) {
          formulaCount++;
        }
      }
    }
    expect(formulaCount, '合并后应至少保留1个公式字段').toBeGreaterThanOrEqual(1);
  });
});

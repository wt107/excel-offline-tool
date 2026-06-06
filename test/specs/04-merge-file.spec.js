/**
 * 测试04: 文件合并
 * 上传多个Excel → 合并到一个工作簿 → 下载验证
 */
const { test, expect } = require('@playwright/test');
const { gotoHome, selectMode, uploadFiles, goToStep2, goToStep3, goToStep4,
        downloadResult, expectResultSuccess, downloadAndSave } = require('../helpers/common');
const path = require('path');

test.describe('文件合并', () => {

  test('合并2个文件到同一工作簿', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-file');
    await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await goToStep2(page);

    // 点击全选按钮（用断言确保按钮可见）
    const selectAllBtn = page.locator('#mergeFileSelectAll');
    await expect(selectAllBtn, '全选按钮应可见').toBeVisible({ timeout: 5000 });
    await selectAllBtn.click();

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);

    // 下载合并后的文件
    const download = await downloadResult(page);
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('合并后文件应在旧版Office中正常打开', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-file');
    await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
    await goToStep2(page);

    const selectAllBtn = page.locator('#mergeFileSelectAll');
    await expect(selectAllBtn).toBeVisible({ timeout: 5000 });
    await selectAllBtn.click();

    await goToStep3(page);
    await goToStep4(page);

    await expectResultSuccess(page);

    // 下载并验证文件有效
    const tmpPath = path.join(__dirname, '..', 'test-downloads', 'merged-file.xlsx');
    const download = await downloadAndSave(page, tmpPath);

    const fs = require('fs');
    expect(fs.existsSync(tmpPath), '下载文件应存在').toBe(true);
    const stat = fs.statSync(tmpPath);
    // 有效xlsx文件至少5KB，旧版Office打开需要完整的XML结构
    expect(stat.size, `文件大小${stat.size}bytes应大于5000bytes`).toBeGreaterThan(5000);

    // 用XLSX库验证文件结构
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(tmpPath);
    expect(wb.SheetNames.length, '合并后应包含多个Sheet').toBeGreaterThanOrEqual(2);
  });
});

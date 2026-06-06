/**
 * 测试10: P1.2/P3.1/P3.2/P3.3/P4.1/P4.3 补充测试
 *
 * 覆盖现有测试未覆盖的功能：
 * - footerRows 拆分保留底部行
 * - summary-merge 合并计算（sum/count）
 * - data-join 数据匹配（inner/left）
 * - merge-sheet 合并后排序
 * - CSV/XLS 导出格式
 * - 模板保存/加载
 */
const { test, expect } = require('@playwright/test');
const { gotoHome, selectMode, uploadFile, uploadFiles, goToStep2, goToStep3, goToStep4,
        selectAllSheets, selectColumnByIndex, downloadResult, expectResultSuccess, getResultFileCount,
        waitForProcessing, waitForToast } = require('../helpers/common');

// ─── 辅助：split-column 直接跳过 step2 → step3 ──────────────
async function splitColumnUploadAndGoToOptions(page, fileName) {
  await gotoHome(page);
  await selectMode(page, 'split-column');
  await uploadFile(page, fileName);
  await page.click('#step1Next');
  await expect(page.locator('#step3')).toHaveClass(/active/, { timeout: 5000 });
}

// ─── 辅助：merge 类模式 step1Next → step2 → step3 ───────────
async function goToStep2Then3(page) {
  await page.click('#step1Next');
  await expect(page.locator('.step-content#step2')).toHaveClass(/active/);
  await page.click('#step2Next');
  await expect(page.locator('.step-content#step3')).toHaveClass(/active/);
}

test.describe('补充功能测试', () => {

  // ══════════════════════════════════════════════════════════
  // P1.2 footerRows 拆分保留底部行
  // ══════════════════════════════════════════════════════════

  test.describe('footerRows 保留底部行', () => {

    test('FR-01: split-column 设置 footerRows=1 应处理成功', async ({ page }) => {
      await splitColumnUploadAndGoToOptions(page, 'merged-cells.xlsx');
      // 在第3列选择拆分列（分类列，索引0）
      const checkboxes = page.locator('#columnList .sheet-checkbox');
      await expect(checkboxes.first()).toBeVisible({ timeout: 5000 });
      await checkboxes.first().check();
      // 设置 footerRows=1
      await page.fill('#splitColumnFooterRows', '1');
      // 执行
      await page.click('#step3Next');
      await waitForProcessing(page);
      await expectResultSuccess(page);
    });

    test('FR-02: split-sheet 设置 footerRows=1 应处理成功', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'split-sheet');
      await uploadFile(page, 'basic-3sheets.xlsx');
      await goToStep2(page);
      await selectAllSheets(page);
      await goToStep3(page);
      // 设置 footerRows=1
      await page.fill('#splitSheetFooterRows', '1');
      // 执行
      await goToStep4(page);
      await expectResultSuccess(page);
    });

    test('FR-03: footerRows=0 时行为不变（默认值）', async ({ page }) => {
      await splitColumnUploadAndGoToOptions(page, 'merged-cells.xlsx');
      const checkboxes = page.locator('#columnList .sheet-checkbox');
      await expect(checkboxes.first()).toBeVisible({ timeout: 5000 });
      await checkboxes.first().check();
      // footerRows 默认 0
      await page.click('#step3Next');
      await waitForProcessing(page);
      await expectResultSuccess(page);
    });
  });

  // ══════════════════════════════════════════════════════════
  // P3.1 summary-merge 合并计算
  // ══════════════════════════════════════════════════════════

  test.describe('合并计算 summary-merge', () => {

    test('SM-01: 求和计算应正常完成', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'summary-merge');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);

      // step1Next → step2（文件列表）→ step2Next → step3（选项）
      await goToStep2Then3(page);

      // 选择分组列和数值列的第一个选项
      const groupCbs = page.locator('#summaryGroupColumns .sheet-checkbox');
      await expect(groupCbs.first()).toBeVisible({ timeout: 5000 });
      await groupCbs.first().check();
      const valueCbs = page.locator('#summaryValueColumns .sheet-checkbox');
      await expect(valueCbs.first()).toBeVisible({ timeout: 5000 });
      await valueCbs.first().check();

      // 确保方法为求和（默认）
      await page.check('input[name="summaryMethod"][value="sum"]');

      // 执行
      await expect(page.locator('#step3Next')).toBeEnabled({ timeout: 3000 });
      await page.locator('#step3Next').click();
      await waitForProcessing(page);
      await expectResultSuccess(page);
    });

    test('SM-02: 计数计算应正常完成', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'summary-merge');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);

      await goToStep2Then3(page);

      const groupCbs = page.locator('#summaryGroupColumns .sheet-checkbox');
      await expect(groupCbs.first()).toBeVisible({ timeout: 5000 });
      await groupCbs.first().check();
      const valueCbs = page.locator('#summaryValueColumns .sheet-checkbox');
      await expect(valueCbs.first()).toBeVisible({ timeout: 5000 });
      await valueCbs.first().check();

      // 切换为计数
      await page.check('input[name="summaryMethod"][value="count"]');

      await expect(page.locator('#step3Next')).toBeEnabled({ timeout: 3000 });
      await page.locator('#step3Next').click();
      await waitForProcessing(page);
      await expectResultSuccess(page);
    });
  });

  // ══════════════════════════════════════════════════════════
  // P3.2 data-join 数据匹配
  // ══════════════════════════════════════════════════════════

  test.describe('数据匹配 data-join', () => {

    test('DJ-01: 内连接（inner join）应处理成功', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'data-join');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);

      // step1Next → step2 → step2Next → step3
      await goToStep2Then3(page);

      // 等待 join 列选择出现
      const leftKey = page.locator('#joinLeftKeyColumn');
      const rightKey = page.locator('#joinRightKeyColumn');
      await expect(leftKey).toBeVisible({ timeout: 5000 });
      // 选择第一个选项作为关键列
      await leftKey.selectOption({ index: 0 });
      await rightKey.selectOption({ index: 0 });

      // 内连接为默认
      await page.check('input[name="joinType"][value="inner"]');

      await expect(page.locator('#step3Next')).toBeEnabled({ timeout: 3000 });
      await page.locator('#step3Next').click();
      await waitForProcessing(page);
      await expectResultSuccess(page);
    });

    test('DJ-02: 左连接（left join）应处理成功', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'data-join');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);

      await goToStep2Then3(page);

      const leftKey = page.locator('#joinLeftKeyColumn');
      const rightKey = page.locator('#joinRightKeyColumn');
      await expect(leftKey).toBeVisible({ timeout: 5000 });
      await leftKey.selectOption({ index: 0 });
      await rightKey.selectOption({ index: 0 });

      // 左连接
      await page.check('input[name="joinType"][value="left"]');

      await expect(page.locator('#step3Next')).toBeEnabled({ timeout: 3000 });
      await page.locator('#step3Next').click();
      await waitForProcessing(page);
      await expectResultSuccess(page);
    });

    test('DJ-03: 右连接（right join）应处理成功', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'data-join');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);

      await goToStep2Then3(page);

      const leftKey = page.locator('#joinLeftKeyColumn');
      const rightKey = page.locator('#joinRightKeyColumn');
      await expect(leftKey).toBeVisible({ timeout: 5000 });
      await leftKey.selectOption({ index: 0 });
      await rightKey.selectOption({ index: 0 });

      // 右连接
      await page.check('input[name="joinType"][value="right"]');

      await expect(page.locator('#step3Next')).toBeEnabled({ timeout: 3000 });
      await page.locator('#step3Next').click();
      await waitForProcessing(page);
      await expectResultSuccess(page);
    });
  });

  // ══════════════════════════════════════════════════════════
  // P3.3 merge-sheet 排序
  // ══════════════════════════════════════════════════════════

  test.describe('合并排序 merge-sheet sort', () => {

    test('MS-01: 合并后按列排序（升序）', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'merge-sheet');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);

      // merge-sheet: step1Next → step3（跳过 step2）
      await page.click('#step1Next');
      await expect(page.locator('#step3')).toHaveClass(/active/, { timeout: 5000 });

      // 选择 Sheet（自动全选后，再手动确认 Sheet 选项可见）
      await selectAllSheets(page);

      // 启用排序
      await page.check('#mergeSheetSortEnabled');
      // 排序选项面板应出现
      await expect(page.locator('#mergeSheetSortOptions')).toBeVisible();

      // 升序（默认）
      await page.check('input[name="mergeSheetSortOrder"][value="asc"]');

      await page.click('#step3Next');
      await waitForProcessing(page);
      await expectResultSuccess(page);
    });

    test('MS-02: 合并后按列排序（降序）', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'merge-sheet');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
      await page.click('#step1Next');
      await expect(page.locator('#step3')).toHaveClass(/active/);

      await selectAllSheets(page);

      await page.check('#mergeSheetSortEnabled');
      await page.check('input[name="mergeSheetSortOrder"][value="desc"]');

      await page.click('#step3Next');
      await waitForProcessing(page);
      await expectResultSuccess(page);
    });
  });

  // ══════════════════════════════════════════════════════════
  // P4.1 CSV/XLS 导出格式
  // ══════════════════════════════════════════════════════════

  test.describe('导出格式 export format', () => {

    test('EF-01: 导出为 CSV 格式应生成带 .csv 扩展名的文件', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'merge-sheet');
      // 切换到 CSV 导出
      await page.check('input[name="exportFormat"][value="csv"]');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
      // merge-sheet: step1Next → step3
      await page.click('#step1Next');
      await expect(page.locator('#step3')).toHaveClass(/active/);
      await selectAllSheets(page);
      await page.click('#step3Next');
      await waitForProcessing(page);
      await expectResultSuccess(page);
      const download = await downloadResult(page);
      expect(download.suggestedFilename()).toContain('.csv');
    });

    test('EF-02: 导出为 XLS 格式应生成带 .xls 扩展名的文件', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'merge-sheet');
      await page.check('input[name="exportFormat"][value="xls"]');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
      await page.click('#step1Next');
      await expect(page.locator('#step3')).toHaveClass(/active/);
      await selectAllSheets(page);
      await page.click('#step3Next');
      await waitForProcessing(page);
      await expectResultSuccess(page);
      const download = await downloadResult(page);
      expect(download.suggestedFilename()).toContain('.xls');
    });

    test('EF-03: 默认导出格式为 XLSX', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'merge-sheet');
      // 不切换格式，默认 XLSX
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
      await page.click('#step1Next');
      await expect(page.locator('#step3')).toHaveClass(/active/);
      await selectAllSheets(page);
      await page.click('#step3Next');
      await waitForProcessing(page);
      await expectResultSuccess(page);
      const download = await downloadResult(page);
      expect(download.suggestedFilename()).toContain('.xlsx');
    });
  });

  // ══════════════════════════════════════════════════════════
  // split-column 单文件模式
  // ══════════════════════════════════════════════════════════

  test('SC-01: split-column 单文件模式应输出 .xlsx 而非 ZIP', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'split-column');
    await uploadFile(page, 'merged-cells.xlsx');
    // step1Next → step3（split-column 跳过 step2）
    await goToStep2(page);
    // 选第1列作为拆分列
    await selectColumnByIndex(page, 0);
    // 切换到单文件模式（在 step3 面板内）
    await page.check('input[name="splitColumnOutputFormat"][value="single"]');
    await goToStep4(page);
    await expectResultSuccess(page);
    const download = await downloadResult(page);
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  // ══════════════════════════════════════════════════════════
  // P4.3 模板保存/加载
  // ══════════════════════════════════════════════════════════

  test.describe('模板保存/加载 template', () => {

    test('TP-01: 保存模板后下拉列表应有新增项', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'merge-sheet');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
      // 模拟 prompt 弹出，自动填入模板名
      await page.evaluate(() => {
        window.prompt = () => '测试模板_TP01';
      });
      const templateSelect = page.locator('#loadTemplateSelect');
      const beforeOptions = await templateSelect.locator('option').count();
      // 点击保存模板
      await page.click('#saveTemplateBtn');
      await waitForToast(page, 'success', 3000);
      // 选项应增加
      await expect.poll(async () => {
        return await templateSelect.locator('option').count();
      }, { timeout: 5000 }).toBeGreaterThan(beforeOptions);
    });

    test('TP-02: 加载已保存模板不报错', async ({ page }) => {
      await gotoHome(page);
      await selectMode(page, 'merge-sheet');
      await uploadFiles(page, ['simple-merge-a.xlsx', 'simple-merge-b.xlsx']);
      await page.evaluate(() => {
        window.prompt = () => '测试模板_TP02';
      });
      await page.click('#saveTemplateBtn');
      await waitForToast(page, 'success', 3000);

      // 选择刚保存的模板
      const templateSelect = page.locator('#loadTemplateSelect');
      await templateSelect.selectOption('测试模板_TP02');
      await waitForToast(page, 'info', 3000);
    });
  });
});

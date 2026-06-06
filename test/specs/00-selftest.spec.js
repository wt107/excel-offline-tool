/**
 * 测试00: 内置自测系统验证
 * 打开 ?selftest=1 确认所有内置测试项通过
 */
const { test, expect } = require('@playwright/test');
const { gotoSelfTest, getSelfTestResults } = require('../helpers/common');

test.describe('内置自测系统', () => {

  test('所有自测项应全部通过', async ({ page }) => {
    await gotoSelfTest(page);

    // 等待自测面板出现并完成
    const panel = page.locator('#selfTestPanel');
    await expect(panel).toBeVisible({ timeout: 20000 });

    // 面板应有绿色边框（通过）
    await expect(panel).toHaveClass(/cs-passed/, { timeout: 10000 });

    // 获取详细结果
    const results = await getSelfTestResults(page);
    console.log(`  自测结果: 通过 ${results.passed}, 失败 ${results.failed}`);

    if (results.failed > 0) {
      console.log('  失败项:', results.failReasons);
    }

    expect(results.failed).toBe(0);
  });

  test('核心函数应全部存在', async ({ page }) => {
    await gotoSelfTest(page);
    const panel = page.locator('#selfTestPanel');
    await expect(panel).toBeVisible({ timeout: 20000 });

    // 检查关键函数存在性测试通过
    const coreFnTests = [
      'T03 函数存在: copyWorksheetByDeletion',
      'T03 函数存在: copyWorksheetWithFilteredRows',
      'T03 函数存在: copyWorksheetByColumnDeletion',
      'T03 函数存在: cloneWorksheet',
      'T03 函数存在: cloneWorksheetCustom',
      'T03 函数存在: injectFullCalcOnLoad',
    ];

    for (const testText of coreFnTests) {
      const locator = page.locator(`.cs-selftest-ok:has-text("${testText}")`);
      const count = await locator.count();
      expect(count, `核心函数测试 "${testText}" 应通过`).toBeGreaterThan(0);
    }
  });

  test('新增v1.4.0功能自测应通过', async ({ page }) => {
    await gotoSelfTest(page);
    const panel = page.locator('#selfTestPanel');
    await expect(panel).toBeVisible({ timeout: 20000 });

    const v14Tests = [
      'T14 cloneWorksheetCustom',
      'T15 injectFullCalcOnLoad',
      'T16 deepCopyCell stripStyle',
      'T17 adjustRangeReference',
      'T18 sanitizeFileName',
    ];

    for (const testText of v14Tests) {
      // 匹配包含关键字的通过项
      const passItem = page.locator(`.cs-selftest-ok`).filter({ hasText: testText });
      const count = await passItem.count();
      expect(count, `v1.4.0测试 "${testText}" 应通过`).toBeGreaterThan(0);
    }
  });
});

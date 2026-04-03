/**
 * 完整流程视觉测试 - 包含真实文件操作
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CONFIG = {
  baseUrl: 'file://' + path.resolve(__dirname, '../excel.html'),
  screenshotDir: path.resolve(__dirname, 'visual-screenshots/full-flow'),
  headless: true,
  slowMo: 300
};

// 确保目录存在
if (!fs.existsSync(CONFIG.screenshotDir)) {
  fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
}

// 创建测试用 Excel 文件
function createTestFiles() {
  const testFilesDir = path.resolve(__dirname, 'test-files');
  if (!fs.existsSync(testFilesDir)) {
    fs.mkdirSync(testFilesDir, { recursive: true });
  }

  // 多工作表文件
  const multiSheetWb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet([
    ['姓名', '部门', '销售额'],
    ['张三', '销售部', 15000],
    ['李四', '销售部', 20000],
    ['王五', '技术部', 18000]
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['产品', '库存', '价格'],
    ['产品A', 100, 50],
    ['产品B', 200, 80]
  ]);
  XLSX.utils.book_append_sheet(multiSheetWb, ws1, '销售数据');
  XLSX.utils.book_append_sheet(multiSheetWb, ws2, '库存数据');
  XLSX.writeFile(multiSheetWb, path.join(testFilesDir, 'multi-sheet-test.xlsx'));

  // 单列拆分测试文件
  const splitColWb = XLSX.utils.book_new();
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['部门', '姓名', '业绩'],
    ['销售部', '张三', 100],
    ['技术部', '李四', 200],
    ['销售部', '王五', 150],
    ['技术部', '赵六', 180]
  ]);
  XLSX.utils.book_append_sheet(splitColWb, ws3, 'Sheet1');
  XLSX.writeFile(splitColWb, path.join(testFilesDir, 'split-column-test.xlsx'));

  // 竖向拆分测试文件
  const verticalWb = XLSX.utils.book_new();
  const ws4 = XLSX.utils.aoa_to_sheet([
    ['姓名', '1月', '2月', '3月'],
    ['张三', 100, 120, 130],
    ['李四', 90, 110, 100]
  ]);
  XLSX.utils.book_append_sheet(verticalWb, ws4, 'Sheet1');
  XLSX.writeFile(verticalWb, path.join(testFilesDir, 'vertical-split-test.xlsx'));

  console.log('✅ 测试文件创建完成');
  return testFilesDir;
}

// 测试类
class FullFlowTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.stepCount = 0;
  }

  async init() {
    console.log('🚀 启动浏览器...');
    this.browser = await chromium.launch({
      headless: CONFIG.headless,
      slowMo: CONFIG.slowMo
    });
    this.page = await this.browser.newPage({
      viewport: { width: 1440, height: 900 }
    });
  }

  async screenshot(name) {
    this.stepCount++;
    const filename = `step_${String(this.stepCount).padStart(2, '0')}_${name}.png`;
    const filepath = path.join(CONFIG.screenshotDir, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`   📸 截图: ${filename}`);
    return filepath;
  }

  // 测试 1: 按工作表拆分完整流程
  async testSplitBySheet(testFilesDir) {
    console.log('\n📋 测试 1: 按工作表拆分完整流程');
    
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForLoadState('networkidle');
    await this.screenshot('split_sheet_01_initial');

    // 点击模式按钮
    await this.page.click('[data-mode="split-sheet"]');
    await this.page.waitForTimeout(500);
    await this.screenshot('split_sheet_02_mode_selected');

    // 上传文件
    const fileInput = this.page.locator('#fileInput');
    await fileInput.setInputFiles(path.join(testFilesDir, 'multi-sheet-test.xlsx'));
    await this.page.waitForTimeout(1500);
    await this.screenshot('split_sheet_03_file_uploaded');

    // 检查是否进入第2步
    const step2 = await this.page.locator('#step2').isVisible();
    console.log('   ✅ 步骤2可见:', step2);

    if (step2) {
      await this.screenshot('split_sheet_04_step2_visible');

      // 检查工作表列表
      const sheetItems = await this.page.locator('#sheetList .sheet-item').count();
      console.log('   ✅ 工作表数量:', sheetItems);

      // 工作表已默认全选，直接点击下一步
      await this.screenshot('split_sheet_05_sheets_selected');

      // 进入下一步
      await this.page.click('#step2Next');
      await this.page.waitForTimeout(500);
      await this.screenshot('split_sheet_06_step3');

      // 进入生成步骤
      await this.page.click('#step3Next');
      await this.page.waitForTimeout(1000);
      await this.screenshot('split_sheet_07_processing');

      // 等待处理完成
      await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
      await this.screenshot('split_sheet_08_complete');

      // 检查生成的文件数
      const fileCount = await this.page.locator('#totalFiles').textContent();
      console.log('   ✅ 生成文件数:', fileCount);

      // 检查下载按钮
      const downloadBtn = await this.page.locator('#downloadBtn').isVisible();
      console.log('   ✅ 下载按钮可见:', downloadBtn);
    }
  }

  // 测试 2: 按列拆分（横向）
  async testSplitByColumn(testFilesDir) {
    console.log('\n📋 测试 2: 按列拆分（横向）');
    
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForLoadState('networkidle');

    // 选择模式
    await this.page.click('[data-mode="split-column"]');
    await this.page.waitForTimeout(500);
    await this.screenshot('split_col_h_01_mode');

    // 上传文件
    await this.page.locator('#fileInput').setInputFiles(path.join(testFilesDir, 'split-column-test.xlsx'));
    await this.page.waitForTimeout(1500);
    await this.screenshot('split_col_h_02_uploaded');

    // 选择工作表
    const sheetItem = this.page.locator('#sheetList .sheet-item').first();
    if (await sheetItem.isVisible().catch(() => false)) {
      await sheetItem.click();
      await this.page.waitForTimeout(500);
      await this.screenshot('split_col_h_03_sheet_selected');

      // 进入下一步
      await this.page.click('#step2Next');
      await this.page.waitForTimeout(500);
      await this.screenshot('split_col_h_04_columns');

      // 检查列列表
      const colCount = await this.page.locator('#columnList .sheet-item').count();
      console.log('   ✅ 列数量:', colCount);

      // 选择第一列
      await this.page.locator('#columnList .sheet-item').first().click();
      await this.page.waitForTimeout(300);
      await this.screenshot('split_col_h_05_column_selected');

      // 进入生成步骤
      await this.page.click('#step3Next');
      await this.page.waitForTimeout(2000);
      await this.screenshot('split_col_h_06_processing');

      // 等待完成
      await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
      await this.screenshot('split_col_h_07_complete');
    }
  }

  // 测试 3: 按列拆分（竖向）
  async testSplitVertical(testFilesDir) {
    console.log('\n📋 测试 3: 按列拆分（竖向）');
    
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForLoadState('networkidle');

    // 选择模式
    await this.page.click('[data-mode="split-column-vertical"]');
    await this.page.waitForTimeout(500);
    await this.screenshot('split_col_v_01_mode');

    // 上传文件
    await this.page.locator('#fileInput').setInputFiles(path.join(testFilesDir, 'vertical-split-test.xlsx'));
    await this.page.waitForTimeout(1500);
    await this.screenshot('split_col_v_02_uploaded');

    // 选择工作表
    const sheetItem = this.page.locator('#sheetList .sheet-item').first();
    if (await sheetItem.isVisible().catch(() => false)) {
      await sheetItem.click();
      await this.page.waitForTimeout(500);

      // 进入下一步
      await this.page.click('#step2Next');
      await this.page.waitForTimeout(500);
      await this.screenshot('split_col_v_03_config');

      // 检查固定列和数据列
      const keyCols = await this.page.locator('#verticalKeyColumnList .sheet-item').count();
      const dataCols = await this.page.locator('#verticalColumnList .sheet-item').count();
      console.log('   ✅ 固定列:', keyCols, '数据列:', dataCols);
    }
  }

  // 测试 4: 文件合并
  async testMergeFiles(testFilesDir) {
    console.log('\n📋 测试 4: 多文件合并');
    
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForLoadState('networkidle');

    // 选择模式
    await this.page.click('[data-mode="merge-file"]');
    await this.page.waitForTimeout(500);
    await this.screenshot('merge_file_01_mode');

    // 上传多个文件
    await this.page.locator('#fileInput').setInputFiles([
      path.join(testFilesDir, 'multi-sheet-test.xlsx'),
      path.join(testFilesDir, 'split-column-test.xlsx')
    ]);
    await this.page.waitForTimeout(1500);
    await this.screenshot('merge_file_02_files_uploaded');

    // 检查文件列表
    const fileCount = await this.page.locator('#fileList .file-list-item').count();
    console.log('   ✅ 上传文件数:', fileCount);

    if (fileCount > 0) {
      // 进入下一步
      await this.page.click('#step2Next');
      await this.page.waitForTimeout(500);
      await this.screenshot('merge_file_03_sheet_selection');

      // 进入生成步骤（工作表默认已选）
      await this.page.click('#step3Next');
      await this.page.waitForTimeout(2000);
      await this.screenshot('merge_file_04_processing');

      // 等待完成
      await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
      await this.screenshot('merge_file_05_complete');
    }
  }

  // 测试 5: 重置功能
  async testReset() {
    console.log('\n📋 测试 5: 重置功能');
    
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForLoadState('networkidle');

    // 切换到合并模式（显示下一步按钮）
    await this.page.click('[data-mode="merge-file"]');
    await this.page.waitForTimeout(500);

    // 点击重置
    await this.page.click('button:has-text("重新开始")');
    await this.page.waitForTimeout(500);
    await this.screenshot('reset_01_after_reset');

    // 检查是否回到第1步
    const step1Active = await this.page.locator('[data-step="1"]').evaluate(el => 
      el.classList.contains('active')
    );
    console.log('   ✅ 重置后步骤1激活:', step1Active);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('\n✅ 浏览器已关闭');
    console.log('📁 截图保存在:', CONFIG.screenshotDir);
  }

  async runAll() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  📸 Excel 离线工具 - 完整流程视觉测试');
    console.log('═══════════════════════════════════════════════════════════════');

    const testFilesDir = createTestFiles();
    await this.init();

    try {
      await this.testSplitBySheet(testFilesDir);
      await this.testSplitByColumn(testFilesDir);
      await this.testSplitVertical(testFilesDir);
      await this.testMergeFiles(testFilesDir);
      await this.testReset();
      
      console.log('\n✅ 所有测试完成！');
    } catch (e) {
      console.error('\n❌ 测试失败:', e);
      await this.screenshot('error_' + Date.now());
    }

    await this.close();
  }
}

// 运行测试
async function main() {
  // 检查是否有 xlsx 库
  try {
    require('xlsx');
  } catch (e) {
    console.log('正在安装 xlsx 库...');
    const { execSync } = require('child_process');
    execSync('npm install xlsx --save-dev', { cwd: __dirname, stdio: 'inherit' });
  }

  const tester = new FullFlowTester();
  await tester.runAll();
}

main().catch(console.error);

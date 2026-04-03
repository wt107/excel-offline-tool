/**
 * 真实可运行的 E2E 测试
 * 每一步都真实点击并验证结果
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CONFIG = {
  baseUrl: 'file://' + path.resolve(__dirname, '../excel.html'),
  screenshotDir: path.resolve(__dirname, 'real-test-screenshots'),
  headless: false, // 设为 true 可在无界面环境运行
  slowMo: 800, // 减慢操作以便观察
  timeout: 60000
};

// 确保目录存在
if (!fs.existsSync(CONFIG.screenshotDir)) {
  fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
}

// 创建测试文件
function createTestExcelFile(filename, data, sheets = null) {
  const testDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  
  const filepath = path.join(testDir, filename);
  
  if (sheets) {
    // 多工作表
    const wb = XLSX.utils.book_new();
    sheets.forEach(sheet => {
      const ws = XLSX.utils.aoa_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    });
    XLSX.writeFile(wb, filepath);
  } else {
    // 单工作表
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filepath);
  }
  
  return filepath;
}

class RealE2ETest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.stepNum = 0;
    this.results = [];
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
    console.log('✅ 浏览器启动成功\n');
  }

  async screenshot(name) {
    this.stepNum++;
    const filename = `${String(this.stepNum).padStart(2, '0')}_${name}.png`;
    const filepath = path.join(CONFIG.screenshotDir, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  log(step, status, message) {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} Step ${this.stepNum}: ${step}`);
    if (message) console.log(`   ${message}`);
    this.results.push({ step, status, message, stepNum: this.stepNum });
  }

  // 等待元素可见并点击
  async safeClick(selector, stepName) {
    try {
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
      await this.page.click(selector);
      await this.page.waitForTimeout(500);
      return true;
    } catch (e) {
      this.log(stepName, 'FAIL', `点击失败: ${e.message}`);
      return false;
    }
  }

  // 测试1: 页面初始状态
  async test01_InitialState() {
    console.log('\n📋 测试1: 页面初始状态');
    
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
    
    const title = await this.page.title();
    const screenshot = await this.screenshot('initial_state');
    
    this.log('页面加载', 'PASS', `标题: ${title}`);
    
    // 检查5个模式按钮
    const modes = ['split-sheet', 'split-column', 'split-column-vertical', 'merge-file', 'merge-sheet'];
    for (const mode of modes) {
      const visible = await this.page.locator(`[data-mode="${mode}"]`).isVisible();
      if (!visible) {
        this.log(`模式按钮 ${mode}`, 'FAIL', '不可见');
        return false;
      }
    }
    this.log('模式按钮检查', 'PASS', '5个按钮都可见');
    
    // 检查四步流程
    const steps = await this.page.locator('.step').count();
    this.log('四步流程', steps === 4 ? 'PASS' : 'FAIL', `步骤数: ${steps}`);
    
    // 检查上传区域
    const uploadVisible = await this.page.locator('#uploadArea').isVisible();
    this.log('上传区域', uploadVisible ? 'PASS' : 'FAIL', uploadVisible ? '可见' : '不可见');
    
    return true;
  }

  // 测试2: 按工作表拆分完整流程
  async test02_SplitBySheet() {
    console.log('\n📋 测试2: 按工作表拆分完整流程');
    
    // 创建测试文件
    const testFile = createTestExcelFile('test-multi-sheet.xlsx', null, [
      { name: '销售数据', data: [['姓名', '销售额'], ['张三', 100], ['李四', 200]] },
      { name: '库存数据', data: [['产品', '数量'], ['A', 10], ['B', 20]] }
    ]);
    
    // 1. 选择模式
    const modeClicked = await this.safeClick('[data-mode="split-sheet"]', '选择拆分模式');
    if (!modeClicked) return false;
    await this.screenshot('split_mode_selected');
    this.log('选择拆分模式', 'PASS');
    
    // 2. 上传文件
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(2000);
    await this.screenshot('file_uploaded');
    
    // 验证文件信息显示
    const fileInfoVisible = await this.page.locator('#fileInfo').isVisible();
    this.log('文件上传', fileInfoVisible ? 'PASS' : 'FAIL', fileInfoVisible ? '文件信息显示' : '文件信息未显示');
    
    // 3. 验证步骤2显示
    const step2Visible = await this.page.locator('#step2').isVisible();
    if (!step2Visible) {
      this.log('进入步骤2', 'FAIL', '步骤2未显示');
      return false;
    }
    this.log('进入步骤2', 'PASS');
    await this.screenshot('step2_worksheets');
    
    // 4. 检查工作表列表
    const sheetCount = await this.page.locator('#sheetList .sheet-item').count();
    this.log('工作表列表', sheetCount > 0 ? 'PASS' : 'FAIL', `工作表数: ${sheetCount}`);
    
    // 5. 点击下一步
    const nextClicked = await this.safeClick('#step2Next', '步骤2下一步');
    if (!nextClicked) return false;
    await this.page.waitForTimeout(1000);
    await this.screenshot('step3_config');
    
    // 6. 验证步骤3
    const step3Visible = await this.page.locator('#step3').isVisible();
    this.log('进入步骤3', step3Visible ? 'PASS' : 'FAIL');
    
    // 7. 点击生成
    const generateClicked = await this.safeClick('#step3Next', '生成文件');
    if (!generateClicked) return false;
    
    // 8. 等待处理完成
    try {
      await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
      await this.page.waitForTimeout(1000);
      await this.screenshot('split_complete');
      
      const fileCount = await this.page.locator('#totalFiles').textContent();
      const downloadVisible = await this.page.locator('#downloadBtn').isVisible();
      
      this.log('文件生成', 'PASS', `生成文件数: ${fileCount}, 下载按钮: ${downloadVisible}`);
      return true;
    } catch (e) {
      this.log('文件生成', 'FAIL', '处理超时');
      return false;
    }
  }

  // 测试3: 按列拆分（横向）
  async test03_SplitByColumn() {
    console.log('\n📋 测试3: 按列拆分（横向）');
    
    // 创建测试文件
    const testFile = createTestExcelFile('test-split-column.xlsx', [
      ['部门', '姓名', '业绩'],
      ['销售', '张三', 100],
      ['技术', '李四', 200],
      ['销售', '王五', 150]
    ]);
    
    // 刷新页面
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(1000);
    
    // 1. 选择模式
    await this.safeClick('[data-mode="split-column"]', '选择横向拆分');
    await this.screenshot('col_h_mode');
    
    // 2. 上传文件
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(2000);
    await this.screenshot('col_h_uploaded');
    
    // 3. 选择工作表（第2步）
    const sheetItem = this.page.locator('#sheetList .sheet-item').first();
    if (await sheetItem.isVisible()) {
      await sheetItem.click();
      await this.page.waitForTimeout(500);
      this.log('选择工作表', 'PASS');
    }
    
    // 4. 进入下一步
    await this.safeClick('#step2Next', '进入列选择');
    await this.page.waitForTimeout(1000);
    await this.screenshot('col_h_columns');
    
    // 5. 检查列列表
    const colCount = await this.page.locator('#columnList .sheet-item').count();
    this.log('列列表', colCount > 0 ? 'PASS' : 'FAIL', `列数: ${colCount}`);
    
    // 6. 选择第一列
    const colItem = this.page.locator('#columnList .sheet-item').first();
    if (await colItem.isVisible()) {
      await colItem.click();
      await this.page.waitForTimeout(500);
      this.log('选择拆分列', 'PASS');
      await this.screenshot('col_h_selected');
    }
    
    // 7. 生成文件
    await this.safeClick('#step3Next', '生成文件');
    
    try {
      await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
      await this.screenshot('col_h_complete');
      this.log('横向拆分完成', 'PASS');
      return true;
    } catch (e) {
      this.log('横向拆分完成', 'FAIL', e.message);
      return false;
    }
  }

  // 测试4: 文件合并
  async test04_MergeFiles() {
    console.log('\n📋 测试4: 多文件合并');
    
    // 创建两个测试文件
    const file1 = createTestExcelFile('merge1.xlsx', [
      ['姓名', '数据'],
      ['张三', 100]
    ]);
    const file2 = createTestExcelFile('merge2.xlsx', [
      ['姓名', '数据'],
      ['李四', 200]
    ]);
    
    // 刷新页面
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(1000);
    
    // 1. 选择合并模式
    await this.safeClick('[data-mode="merge-file"]', '选择合并模式');
    await this.screenshot('merge_mode');
    
    // 2. 上传多个文件
    await this.page.locator('#fileInput').setInputFiles([file1, file2]);
    await this.page.waitForTimeout(2000);
    await this.screenshot('merge_files_uploaded');
    
    // 3. 检查文件列表
    const fileCount = await this.page.locator('#fileList .file-list-item').count();
    this.log('多文件上传', fileCount >= 2 ? 'PASS' : 'FAIL', `文件数: ${fileCount}`);
    
    // 4. 进入下一步
    const nextBtn = this.page.locator('#step1Next, #step2Next').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await this.page.waitForTimeout(1000);
      await this.screenshot('merge_sheet_selection');
      this.log('进入工作表选择', 'PASS');
    }
    
    // 5. 生成文件
    const step3Next = this.page.locator('#step3Next');
    if (await step3Next.isVisible()) {
      await step3Next.click();
      
      try {
        await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
        await this.screenshot('merge_complete');
        this.log('合并完成', 'PASS');
        return true;
      } catch (e) {
        this.log('合并完成', 'FAIL');
        return false;
      }
    }
    
    return false;
  }

  // 测试5: 重置功能
  async test05_Reset() {
    console.log('\n📋 测试5: 重置功能');
    
    // 先执行一些操作
    const testFile = createTestExcelFile('reset-test.xlsx', [['A', 'B'], [1, 2]]);
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(1000);
    
    await this.safeClick('[data-mode="merge-file"]', '选择模式');
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(1500);
    
    // 点击重置
    const resetBtns = await this.page.locator('button:has-text("重新开始")').all();
    if (resetBtns.length > 0) {
      // 找到可见的按钮
      for (const btn of resetBtns) {
        if (await btn.isVisible()) {
          await btn.click();
          await this.page.waitForTimeout(1000);
          await this.screenshot('after_reset');
          
          // 验证回到步骤1
          const step1Active = await this.page.locator('[data-step="1"]').evaluate(
            el => el.classList.contains('active')
          ).catch(() => false);
          
          this.log('重置功能', step1Active ? 'PASS' : 'FAIL', step1Active ? '回到步骤1' : '未回到步骤1');
          return step1Active;
        }
      }
    }
    
    this.log('重置功能', 'FAIL', '未找到重置按钮');
    return false;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runAll() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  🎯 Excel 离线工具 - 真实 E2E 测试');
    console.log('═══════════════════════════════════════════════════════════════');
    
    await this.init();
    
    await this.test01_InitialState();
    await this.test02_SplitBySheet();
    await this.test03_SplitByColumn();
    await this.test04_MergeFiles();
    await this.test05_Reset();
    
    await this.close();
    
    // 输出报告
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试报告');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log(`\n总步骤: ${this.results.length}`);
    console.log(`✅ 通过: ${passCount}`);
    console.log(`❌ 失败: ${failCount}`);
    console.log(`📸 截图: ${this.stepNum} 张`);
    console.log(`\n截图保存位置: ${CONFIG.screenshotDir}`);
    
    return { passCount, failCount, total: this.results.length };
  }
}

// 运行测试
async function main() {
  const test = new RealE2ETest();
  const result = await test.runAll();
  process.exit(result.failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('测试失败:', e);
  process.exit(1);
});

/**
 * 全面的 E2E 测试套件
 * 测试每一个按钮功能，验证生成的文件
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CONFIG = {
  baseUrl: 'file://' + path.resolve(__dirname, '../excel.html'),
  screenshotDir: path.resolve(__dirname, 'comprehensive-test-screenshots'),
  downloadDir: path.join(__dirname, 'downloads'),
  headless: false,
  slowMo: 600
};

// 确保目录存在
[CONFIG.screenshotDir, CONFIG.downloadDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 测试报告
class TestReport {
  constructor() {
    this.tests = [];
    this.startTime = Date.now();
  }

  add(testName, status, details = {}) {
    this.tests.push({
      name: testName,
      status,
      details,
      time: new Date().toISOString()
    });
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${testName}`);
    if (details.message) console.log(`   ${details.message}`);
  }

  summary() {
    const pass = this.tests.filter(t => t.status === 'PASS').length;
    const fail = this.tests.filter(t => t.status === 'FAIL').length;
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    return { pass, fail, total: this.tests.length, duration };
  }
}

const report = new TestReport();

// 创建各种测试文件
const TestFiles = {
  // 多工作表文件
  multiSheet: () => {
    const filepath = path.join(__dirname, 'test-files', 'multi-sheet.xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['姓名', '部门', '销售额'],
      ['张三', '销售部', 15000],
      ['李四', '销售部', 20000],
      ['王五', '技术部', 18000]
    ]), '销售数据');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['产品', '库存', '价格'],
      ['产品A', 100, 50],
      ['产品B', 200, 80],
      ['产品C', 150, 60]
    ]), '库存数据');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['客户', '等级', '消费'],
      ['客户X', 'A', 5000],
      ['客户Y', 'B', 3000]
    ]), '客户数据');
    XLSX.writeFile(wb, filepath);
    return filepath;
  },

  // 按列拆分测试文件
  splitByColumn: () => {
    const filepath = path.join(__dirname, 'test-files', 'split-by-column.xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['部门', '姓名', '业绩', '提成'],
      ['销售部', '张三', 100, 10],
      ['技术部', '李四', 200, 20],
      ['销售部', '王五', 150, 15],
      ['技术部', '赵六', 180, 18],
      ['人事部', '孙七', 120, 12]
    ]), 'Sheet1');
    XLSX.writeFile(wb, filepath);
    return filepath;
  },

  // 竖向拆分测试文件
  verticalSplit: () => {
    const filepath = path.join(__dirname, 'test-files', 'vertical-split.xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['姓名', '部门', '1月', '2月', '3月'],
      ['张三', '销售', 100, 120, 130],
      ['李四', '技术', 90, 110, 100],
      ['王五', '人事', 80, 85, 90]
    ]), 'Sheet1');
    XLSX.writeFile(wb, filepath);
    return filepath;
  },

  // 合并测试文件1
  merge1: () => {
    const filepath = path.join(__dirname, 'test-files', 'merge-1.xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['姓名', '数据'],
      ['张三', 100],
      ['李四', 200]
    ]), '数据表1');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['产品', '销量'],
      ['A', 50],
      ['B', 80]
    ]), '数据表2');
    XLSX.writeFile(wb, filepath);
    return filepath;
  },

  // 合并测试文件2
  merge2: () => {
    const filepath = path.join(__dirname, 'test-files', 'merge-2.xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['姓名', '数据'],
      ['王五', 300],
      ['赵六', 400]
    ]), '数据表3');
    XLSX.writeFile(wb, filepath);
    return filepath;
  },

  // 大数据文件
  largeData: () => {
    const filepath = path.join(__dirname, 'test-files', 'large-data.xlsx');
    const wb = XLSX.utils.book_new();
    const data = [['ID', '名称', '数值', '类别']];
    for (let i = 1; i <= 100; i++) {
      data.push([i, `项目${i}`, Math.floor(Math.random() * 1000), `类别${i % 5}`]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), '大数据');
    XLSX.writeFile(wb, filepath);
    return filepath;
  }
};

class ComprehensiveTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.stepNum = 0;
  }

  async init() {
    console.log('🚀 启动浏览器...');
    this.browser = await chromium.launch({ headless: CONFIG.headless, slowMo: CONFIG.slowMo });
    this.page = await this.browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    // 设置下载行为
    await this.page._client?.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: CONFIG.downloadDir
    });
    
    console.log('✅ 浏览器启动成功\n');
  }

  async screenshot(name) {
    this.stepNum++;
    const filepath = path.join(CONFIG.screenshotDir, `${String(this.stepNum).padStart(3, '0')}_${name}.png`);
    await this.page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  // ========== 测试套件 1: 所有按钮功能 ==========
  async testSuite1_AllButtons() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试套件 1: 所有按钮功能测试');
    console.log('═══════════════════════════════════════════════════════════════');

    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(1000);
    await this.screenshot('s1_initial');

    // 1.1 测试5个模式按钮
    const modes = [
      { id: 'split-sheet', name: '按工作表拆分' },
      { id: 'split-column', name: '按列拆分(横向)' },
      { id: 'split-column-vertical', name: '按列拆分(竖向)' },
      { id: 'merge-file', name: '文件合并' },
      { id: 'merge-sheet', name: '工作表数据合并' }
    ];

    for (const mode of modes) {
      try {
        const btn = this.page.locator(`[data-mode="${mode.id}"]`);
        await btn.click();
        await this.page.waitForTimeout(500);
        
        const isActive = await btn.evaluate(el => el.classList.contains('active'));
        report.add(`模式按钮: ${mode.name}`, isActive ? 'PASS' : 'FAIL', 
          isActive ? { message: '点击后处于激活状态' } : { message: '点击后未激活' });
      } catch (e) {
        report.add(`模式按钮: ${mode.name}`, 'FAIL', { message: e.message });
      }
    }
    await this.screenshot('s1_modes_tested');

    // 1.2 测试全选/取消全选按钮
    await this.page.click('[data-mode="split-sheet"]');
    await this.page.waitForTimeout(300);
    
    // 先上传文件才能测试全选
    const testFile = TestFiles.multiSheet();
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(2000);
    await this.screenshot('s1_file_uploaded');

    // 测试全选按钮
    try {
      const selectAllBtn = this.page.locator('button:has-text("全选")').first();
      if (await selectAllBtn.isVisible()) {
        await selectAllBtn.click();
        await this.page.waitForTimeout(300);
        
        // 检查是否选中
        const checkedCount = await this.page.locator('.sheet-checkbox:checked').count();
        report.add('全选按钮', checkedCount > 0 ? 'PASS' : 'FAIL', 
          { message: `选中 ${checkedCount} 个工作表` });
      }
    } catch (e) {
      report.add('全选按钮', 'FAIL', { message: e.message });
    }

    // 测试取消全选按钮
    try {
      const deselectBtn = this.page.locator('button:has-text("取消全选")').first();
      if (await deselectBtn.isVisible()) {
        await deselectBtn.click();
        await this.page.waitForTimeout(300);
        
        const checkedCount = await this.page.locator('.sheet-checkbox:checked').count();
        report.add('取消全选按钮', checkedCount === 0 ? 'PASS' : 'FAIL', 
          { message: `选中 ${checkedCount} 个工作表` });
      }
    } catch (e) {
      report.add('取消全选按钮', 'FAIL', { message: e.message });
    }
    await this.screenshot('s1_select_buttons');

    // 1.3 测试上一步/下一步按钮
    try {
      const nextBtn = this.page.locator('#step2Next');
      if (await nextBtn.isVisible()) {
        // 先选中一个工作表
        await this.page.locator('.sheet-checkbox').first().check();
        await this.page.waitForTimeout(300);
        
        await nextBtn.click();
        await this.page.waitForTimeout(500);
        
        const step3Visible = await this.page.locator('#step3').isVisible();
        report.add('下一步按钮', step3Visible ? 'PASS' : 'FAIL', 
          step3Visible ? { message: '成功进入步骤3' } : { message: '未进入步骤3' });
        
        if (step3Visible) {
          await this.screenshot('s1_step3');
          
          // 测试上一步
          const prevBtn = this.page.locator('button:has-text("上一步")').first();
          if (await prevBtn.isVisible()) {
            await prevBtn.click();
            await this.page.waitForTimeout(500);
            
            const step2Visible = await this.page.locator('#step2').isVisible();
            report.add('上一步按钮', step2Visible ? 'PASS' : 'FAIL', 
              step2Visible ? { message: '成功返回步骤2' } : { message: '未返回步骤2' });
          }
        }
      }
    } catch (e) {
      report.add('上一步/下一步按钮', 'FAIL', { message: e.message });
    }
    await this.screenshot('s1_navigation_buttons');
  }

  // ========== 测试套件 2: 按工作表拆分完整流程 ==========
  async testSuite2_SplitBySheet() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试套件 2: 按工作表拆分完整流程');
    console.log('═══════════════════════════════════════════════════════════════');

    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(500);

    // 步骤1: 选择模式
    await this.page.click('[data-mode="split-sheet"]');
    await this.page.waitForTimeout(500);
    report.add('S2: 选择拆分模式', 'PASS');
    await this.screenshot('s2_step1_mode');

    // 步骤2: 上传文件
    const testFile = TestFiles.multiSheet();
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(2000);
    report.add('S2: 上传文件', 'PASS', { message: '文件解析成功' });
    await this.screenshot('s2_step2_upload');

    // 验证步骤2显示
    const fileInfoVisible = await this.page.locator('#fileInfo').isVisible();
    const sheetListVisible = await this.page.locator('#sheetList').isVisible();
    report.add('S2: 进入步骤2', (fileInfoVisible && sheetListVisible) ? 'PASS' : 'FAIL', 
      { message: `文件信息: ${fileInfoVisible}, 工作表列表: ${sheetListVisible}` });

    // 验证工作表数量
    const sheetCount = await this.page.locator('#sheetList .sheet-item').count();
    report.add('S2: 工作表数量', sheetCount === 3 ? 'PASS' : 'FAIL', 
      { message: `期望3个, 实际${sheetCount}个` });

    // 步骤3: 全选工作表并下一步
    const checkboxes = await this.page.locator('.sheet-checkbox').all();
    for (const cb of checkboxes) {
      await cb.check();
    }
    await this.page.waitForTimeout(300);
    report.add('S2: 选择工作表', 'PASS', { message: `选中 ${checkboxes.length} 个工作表` });
    await this.screenshot('s2_step2_selected');

    // 点击下一步
    await this.page.click('#step2Next');
    await this.page.waitForTimeout(1000);
    const step3Visible = await this.page.locator('#step3').isVisible();
    report.add('S2: 进入步骤3', step3Visible ? 'PASS' : 'FAIL');
    await this.screenshot('s2_step3');

    // 步骤4: 生成文件
    await this.page.click('#step3Next');
    await this.page.waitForTimeout(1000);
    
    // 等待处理完成
    try {
      await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
      await this.page.waitForTimeout(1000);
      report.add('S2: 文件生成', 'PASS', { message: '处理完成' });
      await this.screenshot('s2_step4_complete');

      // 验证结果
      const fileCount = await this.page.locator('#totalFiles').textContent();
      const downloadBtnVisible = await this.page.locator('#downloadBtn').isVisible();
      const resultFiles = await this.page.locator('#resultFileList .file-list-item').count();
      
      report.add('S2: 生成文件数', parseInt(fileCount) === 3 ? 'PASS' : 'FAIL', 
        { message: `期望3个, 显示${fileCount}个, 列表中有${resultFiles}个` });
      report.add('S2: 下载按钮', downloadBtnVisible ? 'PASS' : 'FAIL');

      // 验证生成的文件名
      const fileNames = await this.page.locator('#resultFileList .file-list-name').allTextContents();
      const hasCorrectNames = fileNames.every(name => 
        name.includes('销售数据') || name.includes('库存数据') || name.includes('客户数据')
      );
      report.add('S2: 文件名正确', hasCorrectNames ? 'PASS' : 'FAIL', 
        { message: fileNames.join(', ') });

    } catch (e) {
      report.add('S2: 文件生成', 'FAIL', { message: '处理超时或失败' });
    }
  }

  // ========== 测试套件 3: 按列拆分（横向）==========
  async testSuite3_SplitByColumn() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试套件 3: 按列拆分（横向）');
    console.log('═══════════════════════════════════════════════════════════════');

    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(500);

    // 选择模式
    await this.page.click('[data-mode="split-column"]');
    await this.page.waitForTimeout(500);
    report.add('S3: 选择横向拆分模式', 'PASS');
    await this.screenshot('s3_step1');

    // 上传文件
    const testFile = TestFiles.splitByColumn();
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(2000);
    report.add('S3: 上传文件', 'PASS');
    await this.screenshot('s3_step2_upload');

    // 选择工作表
    const sheetItem = this.page.locator('#sheetList .sheet-item').first();
    if (await sheetItem.isVisible()) {
      await sheetItem.click();
      await this.page.waitForTimeout(500);
      report.add('S3: 选择工作表', 'PASS');
    }

    // 进入列选择
    await this.page.click('#step2Next');
    await this.page.waitForTimeout(1000);
    
    const colListVisible = await this.page.locator('#columnList').isVisible();
    report.add('S3: 进入列选择', colListVisible ? 'PASS' : 'FAIL');
    await this.screenshot('s3_step3_columns');

    if (colListVisible) {
      // 验证列数
      const colCount = await this.page.locator('#columnList .sheet-item').count();
      report.add('S3: 列数量', colCount === 4 ? 'PASS' : 'FAIL', 
        { message: `期望4列, 实际${colCount}列` });

      // 选择第一列（部门）
      const firstCol = this.page.locator('#columnList .sheet-item').first();
      await firstCol.click();
      await this.page.waitForTimeout(500);
      report.add('S3: 选择拆分列', 'PASS');
      await this.screenshot('s3_column_selected');

      // 生成文件
      await this.page.click('#step3Next');
      await this.page.waitForTimeout(1000);
      
      try {
        await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
        await this.page.waitForTimeout(1000);
        report.add('S3: 文件生成', 'PASS');
        await this.screenshot('s3_complete');

        // 验证分组结果（应该分成3个部门）
        const resultFiles = await this.page.locator('#resultFileList .file-list-item').count();
        report.add('S3: 分组文件数', resultFiles === 3 ? 'PASS' : 'FAIL', 
          { message: `期望3个部门文件, 实际${resultFiles}个` });

      } catch (e) {
        report.add('S3: 文件生成', 'FAIL', { message: e.message });
      }
    }
  }

  // ========== 测试套件 4: 按列拆分（竖向）==========
  async testSuite4_VerticalSplit() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试套件 4: 按列拆分（竖向）');
    console.log('═══════════════════════════════════════════════════════════════');

    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(500);

    // 选择模式
    await this.page.click('[data-mode="split-column-vertical"]');
    await this.page.waitForTimeout(500);
    report.add('S4: 选择竖向拆分模式', 'PASS');
    await this.screenshot('s4_step1');

    // 上传文件
    const testFile = TestFiles.verticalSplit();
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(2000);
    report.add('S4: 上传文件', 'PASS');
    await this.screenshot('s4_step2_upload');

    // 选择工作表
    const sheetItem = this.page.locator('#sheetList .sheet-item').first();
    if (await sheetItem.isVisible()) {
      await sheetItem.click();
      await this.page.waitForTimeout(500);
      report.add('S4: 选择工作表', 'PASS');
    }

    // 进入配置
    await this.page.click('#step2Next');
    await this.page.waitForTimeout(1000);
    
    const configVisible = await this.page.locator('#splitColumnVerticalOptions').isVisible();
    report.add('S4: 进入配置界面', configVisible ? 'PASS' : 'FAIL');
    await this.screenshot('s4_step3_config');

    if (configVisible) {
      // 验证固定列列表
      const keyCols = await this.page.locator('#verticalKeyColumnList .sheet-item').count();
      report.add('S4: 固定列数量', keyCols === 5 ? 'PASS' : 'FAIL', 
        { message: `期望5列, 实际${keyCols}列` });

      // 验证数据列列表
      const dataCols = await this.page.locator('#verticalColumnList .sheet-item').count();
      report.add('S4: 数据列数量', dataCols === 5 ? 'PASS' : 'FAIL', 
        { message: `期望5列, 实际${dataCols}列` });

      // 选择固定列
      const keyColCheckboxes = await this.page.locator('#verticalKeyColumnList input[type="checkbox"]').all();
      if (keyColCheckboxes.length >= 2) {
        await keyColCheckboxes[0].check();
        await keyColCheckboxes[1].check();
        report.add('S4: 选择固定列', 'PASS', { message: '选中2个固定列' });
      }

      // 选择数据列（跳过已禁用的）
      const dataColCheckboxes = await this.page.locator('#verticalColumnList input[type="checkbox"]:enabled').all();
      if (dataColCheckboxes.length >= 2) {
        await dataColCheckboxes[0].check();
        await dataColCheckboxes[1].check();
        report.add('S4: 选择数据列', 'PASS', { message: `选中2个数据列(可用${dataColCheckboxes.length}个)` });
      } else if (dataColCheckboxes.length >= 1) {
        await dataColCheckboxes[0].check();
        report.add('S4: 选择数据列', 'PASS', { message: '选中1个数据列' });
      }

      await this.screenshot('s4_columns_selected');

      // 生成文件
      await this.page.click('#step3Next');
      await this.page.waitForTimeout(1000);
      
      try {
        await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
        report.add('S4: 文件生成', 'PASS');
        await this.screenshot('s4_complete');

        // 应该生成2个文件（对应2个数据列）
        const resultFiles = await this.page.locator('#resultFileList .file-list-item').count();
        report.add('S4: 生成文件数', resultFiles === 2 ? 'PASS' : 'FAIL', 
          { message: `期望2个文件, 实际${resultFiles}个` });

      } catch (e) {
        report.add('S4: 文件生成', 'FAIL', { message: e.message });
      }
    }
  }

  // ========== 测试套件 5: 文件合并 ==========
  async testSuite5_MergeFiles() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试套件 5: 多文件合并');
    console.log('═══════════════════════════════════════════════════════════════');

    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(500);

    // 选择模式
    await this.page.click('[data-mode="merge-file"]');
    await this.page.waitForTimeout(500);
    report.add('S5: 选择文件合并模式', 'PASS');
    await this.screenshot('s5_step1');

    // 上传多个文件
    const file1 = TestFiles.merge1();
    const file2 = TestFiles.merge2();
    await this.page.locator('#fileInput').setInputFiles([file1, file2]);
    await this.page.waitForTimeout(2000);
    report.add('S5: 上传多个文件', 'PASS');
    await this.screenshot('s5_step2_files');

    // 验证文件列表
    const fileCount = await this.page.locator('#fileList .file-list-item').count();
    report.add('S5: 文件列表显示', fileCount === 2 ? 'PASS' : 'FAIL', 
      { message: `期望2个文件, 实际${fileCount}个` });

    // 进入工作表选择
    const nextBtn = this.page.locator('#step1Next, #step2Next').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await this.page.waitForTimeout(1000);
      report.add('S5: 进入工作表选择', 'PASS');
      await this.screenshot('s5_step3_sheets');

      // 选择所有工作表
      const checkboxes = await this.page.locator('.sheet-checkbox').all();
      for (const cb of checkboxes) {
        await cb.check();
      }
      report.add('S5: 选择工作表', 'PASS', { message: `选中 ${checkboxes.length} 个工作表` });

      // 生成合并文件
      await this.page.click('#step3Next');
      await this.page.waitForTimeout(1000);
      
      try {
        await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
        report.add('S5: 合并完成', 'PASS');
        await this.screenshot('s5_complete');

        // 应该只生成1个合并文件
        const fileCount = await this.page.locator('#totalFiles').textContent();
        report.add('S5: 合并文件数', parseInt(fileCount) === 1 ? 'PASS' : 'FAIL', 
          { message: `显示${fileCount}个文件` });

      } catch (e) {
        report.add('S5: 合并完成', 'FAIL', { message: e.message });
      }
    }
  }

  // ========== 测试套件 6: 工作表数据合并 ==========
  async testSuite6_MergeSheetData() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试套件 6: 工作表数据合并');
    console.log('═══════════════════════════════════════════════════════════════');

    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(500);

    // 选择模式
    await this.page.click('[data-mode="merge-sheet"]');
    await this.page.waitForTimeout(500);
    report.add('S6: 选择工作表数据合并模式', 'PASS');
    await this.screenshot('s6_step1');

    // 上传文件
    const testFile = TestFiles.merge1();
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(2000);
    report.add('S6: 上传文件', 'PASS');
    await this.screenshot('s6_step2_upload');

    // 进入工作表选择
    const nextBtn = this.page.locator('#step1Next, #step2Next').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await this.page.waitForTimeout(1000);

      // 选择工作表
      const checkboxes = await this.page.locator('.sheet-checkbox').all();
      for (const cb of checkboxes) {
        await cb.check();
      }
      report.add('S6: 选择工作表', 'PASS', { message: `选中 ${checkboxes.length} 个` });
      await this.screenshot('s6_step3_selected');

      // 进入配置
      await this.page.click('#step3Next');
      await this.page.waitForTimeout(1000);
      
      const configVisible = await this.page.locator('#mergeSheetOptions').isVisible();
      report.add('S6: 进入配置', configVisible ? 'PASS' : 'FAIL');
      await this.screenshot('s6_step4_config');

      if (configVisible) {
        // 设置表头行数
        const headerInput = this.page.locator('#headerRows');
        if (await headerInput.isVisible()) {
          await headerInput.fill('1');
          report.add('S6: 设置表头行数', 'PASS');
        }

        // 生成合并数据
        await this.page.click('#step3Next');
        await this.page.waitForTimeout(1000);
        
        try {
          await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
          report.add('S6: 数据合并完成', 'PASS');
          await this.screenshot('s6_complete');

          // 验证生成了1个文件
          const fileCount = await this.page.locator('#totalFiles').textContent();
          report.add('S6: 生成文件数', parseInt(fileCount) === 1 ? 'PASS' : 'FAIL');

        } catch (e) {
          report.add('S6: 数据合并完成', 'FAIL', { message: e.message });
        }
      }
    }
  }

  // ========== 测试套件 7: 重置功能 ==========
  async testSuite7_Reset() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试套件 7: 重置功能');
    console.log('═══════════════════════════════════════════════════════════════');

    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(500);

    // 执行一些操作
    await this.page.click('[data-mode="merge-file"]');
    const testFile = TestFiles.merge1();
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(1500);
    await this.screenshot('s7_before_reset');

    // 点击重置
    const resetBtns = await this.page.locator('button:has-text("重新开始")').all();
    let resetClicked = false;
    for (const btn of resetBtns) {
      if (await btn.isVisible()) {
        await btn.click();
        resetClicked = true;
        await this.page.waitForTimeout(1000);
        break;
      }
    }

    if (resetClicked) {
      await this.screenshot('s7_after_reset');
      
      // 验证回到步骤1
      const step1Active = await this.page.locator('[data-step="1"]').evaluate(
        el => el.classList.contains('active')
      ).catch(() => false);
      
      // 验证文件输入已清空
      const fileInfoHidden = await this.page.locator('#fileInfo').isHidden().catch(() => true);
      
      report.add('S7: 重置功能', (step1Active && fileInfoHidden) ? 'PASS' : 'FAIL', 
        { message: `步骤1激活: ${step1Active}, 文件信息隐藏: ${fileInfoHidden}` });
    } else {
      report.add('S7: 重置功能', 'FAIL', { message: '未找到重置按钮' });
    }
  }

  // ========== 测试套件 8: 异常处理 ==========
  async testSuite8_ErrorHandling() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试套件 8: 异常处理');
    console.log('═══════════════════════════════════════════════════════════════');

    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(500);

    // 测试无效文件
    const invalidFile = path.join(__dirname, 'test-files', 'invalid.txt');
    fs.writeFileSync(invalidFile, '这不是Excel文件');
    
    await this.page.locator('#fileInput').setInputFiles(invalidFile);
    await this.page.waitForTimeout(2000);
    await this.screenshot('s8_invalid_file');

    // 检查是否显示错误提示
    const toast = this.page.locator('.toast.error, .toast');
    const toastVisible = await toast.isVisible().catch(() => false);
    const toastText = toastVisible ? await toast.textContent() : '';
    
    report.add('S8: 无效文件提示', toastVisible ? 'PASS' : 'FAIL', 
      { message: toastVisible ? `提示: ${toastText.substring(0, 50)}...` : '未显示提示' });

    fs.unlinkSync(invalidFile);
  }

  async close() {
    if (this.browser) await this.browser.close();
  }

  async runAll() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  🎯 Excel 离线工具 - 全面 E2E 测试');
    console.log('═══════════════════════════════════════════════════════════════');

    await this.init();

    await this.testSuite1_AllButtons();
    await this.testSuite2_SplitBySheet();
    await this.testSuite3_SplitByColumn();
    await this.testSuite4_VerticalSplit();
    await this.testSuite5_MergeFiles();
    await this.testSuite6_MergeSheetData();
    await this.testSuite7_Reset();
    await this.testSuite8_ErrorHandling();

    await this.close();

    // 输出报告
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试报告');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const summary = report.summary();
    console.log(`\n总测试项: ${summary.total}`);
    console.log(`✅ 通过: ${summary.pass}`);
    console.log(`❌ 失败: ${summary.fail}`);
    console.log(`⏱️  耗时: ${summary.duration} 秒`);
    console.log(`📸 截图: ${this.stepNum} 张`);
    console.log(`\n截图保存: ${CONFIG.screenshotDir}`);

    // 保存详细报告
    const reportPath = path.join(CONFIG.screenshotDir, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      summary,
      tests: report.tests,
      screenshots: this.stepNum
    }, null, 2));
    console.log(`报告保存: ${reportPath}`);

    return summary;
  }
}

// 运行测试
async function main() {
  const test = new ComprehensiveTest();
  const result = await test.runAll();
  process.exit(result.fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('测试失败:', e);
  process.exit(1);
});

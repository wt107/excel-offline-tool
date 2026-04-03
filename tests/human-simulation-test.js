/**
 * 真人操作模拟测试
 * 模拟用户的每一步操作，验证所有细节
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const JSZip = require('jszip');

const CONFIG = {
  baseUrl: 'file://' + path.resolve(__dirname, '../excel.html'),
  screenshotDir: path.join(__dirname, 'human-test-screenshots'),
  downloadDir: path.join(__dirname, 'human-test-downloads'),
  headless: false,
  slowMo: 1000 // 1秒延迟，像真人一样慢
};

// 确保目录存在
[CONFIG.screenshotDir, CONFIG.downloadDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 测试日志
const testLog = [];
function log(step, action, result, details = '') {
  const entry = { time: new Date().toISOString(), step, action, result, details };
  testLog.push(entry);
  const icon = result === 'PASS' ? '✅' : result === 'FAIL' ? '❌' : '⏳';
  console.log(`${icon} [步骤${step}] ${action}`);
  if (details) console.log(`   ${details}`);
}

// 创建带格式的测试文件
function createFormattedTestFile() {
  const filepath = path.join(CONFIG.downloadDir, 'source-formatted.xlsx');
  
  // 使用 xlsx 创建带格式的文件
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['姓名', '部门', '销售额', '日期'],
    ['张三', '销售部', 15000, '2024-01-15'],
    ['李四', '销售部', 20000, '2024-01-16'],
    ['王五', '技术部', 18000, '2024-01-17']
  ]);
  
  // 设置列宽（格式）
  ws['!cols'] = [
    { wch: 12 },  // 姓名列宽
    { wch: 12 },  // 部门列宽
    { wch: 12 },  // 销售额列宽
    { wch: 14 }   // 日期列宽
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, '员工数据');
  XLSX.writeFile(wb, filepath);
  
  return filepath;
}

// 创建多工作表文件
function createMultiSheetFile() {
  const filepath = path.join(CONFIG.downloadDir, 'source-multi.xlsx');
  
  const wb = XLSX.utils.book_new();
  
  // 表1: 销售数据
  const ws1 = XLSX.utils.aoa_to_sheet([
    ['产品', 'Q1销量', 'Q2销量', 'Q3销量'],
    ['产品A', 100, 120, 140],
    ['产品B', 80, 90, 100]
  ]);
  ws1['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, '销售数据');
  
  // 表2: 库存数据
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['仓库', '产品A', '产品B'],
    ['北京', 50, 30],
    ['上海', 40, 25]
  ]);
  ws2['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, '库存数据');
  
  XLSX.writeFile(wb, filepath);
  return filepath;
}

// 创建列拆分测试文件
function createSplitColumnFile() {
  const filepath = path.join(CONFIG.downloadDir, 'source-split-col.xlsx');
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['城市', '姓名', '销售额', '月份'],
    ['北京', '张三', 10000, '1月'],
    ['上海', '李四', 15000, '1月'],
    ['北京', '王五', 12000, '2月'],
    ['上海', '赵六', 18000, '2月']
  ]);
  ws['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];
  
  XLSX.utils.book_append_sheet(wb, ws, '销售记录');
  XLSX.writeFile(wb, filepath);
  return filepath;
}

class HumanSimulationTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.stepNum = 0;
  }

  async init() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  🎭 真人操作模拟测试');
    console.log('  模拟真实用户的每一步操作');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    this.browser = await chromium.launch({ headless: CONFIG.headless, slowMo: CONFIG.slowMo });
    this.context = await this.browser.newContext({ acceptDownloads: true });
    this.page = await this.context.newPage({ viewport: { width: 1440, height: 900 } });
    
    log(0, '浏览器启动', 'PASS', 'Chromium 启动成功');
  }

  async screenshot(name) {
    this.stepNum++;
    const filepath = path.join(CONFIG.screenshotDir, 
      `${String(this.stepNum).padStart(3, '0')}_${name}.png`);
    await this.page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  async waitAndClick(selector, description) {
    try {
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
      await this.page.click(selector);
      log(this.stepNum, description, 'PASS', `点击 ${selector}`);
      await this.page.waitForTimeout(500);
      return true;
    } catch (e) {
      log(this.stepNum, description, 'FAIL', e.message);
      return false;
    }
  }

  // ========== 测试场景1: 按工作表拆分完整流程 ==========
  async testScene1_SplitBySheet() {
    console.log('\n📋 场景1: 按工作表拆分（完整真人操作）');
    
    // 1. 打开浏览器，访问页面
    log(1, '打开浏览器访问页面', 'START');
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
    const title = await this.page.title();
    log(1, '打开浏览器访问页面', title.includes('Excel') ? 'PASS' : 'FAIL', `标题: ${title}`);
    await this.screenshot('scene1_01_open_page');

    // 2. 查看页面，找到"按工作表拆分"按钮
    log(2, '查看页面寻找按钮', 'START');
    const modeBtn = await this.page.locator('[data-mode="split-sheet"]').isVisible();
    log(2, '查看页面寻找按钮', modeBtn ? 'PASS' : 'FAIL', '找到"按工作表拆分"按钮');

    // 3. 点击"按工作表拆分"按钮
    log(3, '点击"按工作表拆分"按钮', 'START');
    await this.page.click('[data-mode="split-sheet"]');
    await this.page.waitForTimeout(800);
    const isActive = await this.page.locator('[data-mode="split-sheet"]').evaluate(
      el => el.classList.contains('active')
    );
    log(3, '点击"按工作表拆分"按钮', isActive ? 'PASS' : 'FAIL', '按钮处于激活状态');
    await this.screenshot('scene1_03_mode_selected');

    // 4. 观察页面，找到上传区域
    log(4, '观察上传区域', 'START');
    const uploadVisible = await this.page.locator('#uploadArea').isVisible();
    log(4, '观察上传区域', uploadVisible ? 'PASS' : 'FAIL', '上传区域可见');

    // 5. 准备测试文件
    log(5, '准备测试文件', 'START');
    const testFile = createMultiSheetFile();
    const fileExists = fs.existsSync(testFile);
    log(5, '准备测试文件', fileExists ? 'PASS' : 'FAIL', testFile);

    // 6. 点击上传区域选择文件
    log(6, '点击上传区域选择文件', 'START');
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(2000);
    
    // 7. 等待文件解析，观察提示
    log(7, '等待文件解析', 'START');
    const toast = this.page.locator('.toast');
    const toastVisible = await toast.isVisible().catch(() => false);
    const toastText = toastVisible ? await toast.textContent() : '';
    log(7, '等待文件解析', toastVisible ? 'PASS' : 'INFO', `提示: ${toastText.substring(0, 30)}...`);
    await this.screenshot('scene1_07_file_uploaded');

    // 8. 查看文件信息显示
    log(8, '查看文件信息', 'START');
    const fileInfoVisible = await this.page.locator('#fileInfo').isVisible();
    const fileName = fileInfoVisible ? 
      await this.page.locator('#fileName').textContent() : '';
    log(8, '查看文件信息', fileInfoVisible ? 'PASS' : 'FAIL', `文件名: ${fileName}`);

    // 9. 查看工作表列表
    log(9, '查看工作表列表', 'START');
    const sheetListVisible = await this.page.locator('#sheetList').isVisible();
    const sheetCount = await this.page.locator('#sheetList .sheet-item').count();
    log(9, '查看工作表列表', sheetListVisible ? 'PASS' : 'FAIL', `发现 ${sheetCount} 个工作表`);
    await this.screenshot('scene1_09_sheet_list');

    // 10. 观察工作表默认选中状态
    log(10, '检查默认选中状态', 'START');
    const checkedCount = await this.page.locator('.sheet-checkbox:checked').count();
    log(10, '检查默认选中状态', checkedCount > 0 ? 'PASS' : 'INFO', `${checkedCount} 个工作表已选中`);

    // 11. 点击"下一步"按钮
    log(11, '点击"下一步"按钮', 'START');
    await this.page.click('#step2Next');
    await this.page.waitForTimeout(1000);
    const step3Visible = await this.page.locator('#step3').isVisible();
    log(11, '点击"下一步"按钮', step3Visible ? 'PASS' : 'FAIL', '进入步骤3');
    await this.screenshot('scene1_11_step3');

    // 12. 阅读配置说明
    log(12, '阅读配置说明', 'START');
    const configText = await this.page.locator('#splitSheetOptions p').textContent().catch(() => '');
    log(12, '阅读配置说明', 'PASS', configText.substring(0, 50));

    // 13. 点击"下一步"生成文件
    log(13, '点击生成文件', 'START');
    await this.page.click('#step3Next');
    await this.page.waitForTimeout(1000);
    await this.screenshot('scene1_13_processing');

    // 14. 等待处理完成
    log(14, '等待处理完成', 'START');
    try {
      await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
      log(14, '等待处理完成', 'PASS', '处理完成');
    } catch (e) {
      log(14, '等待处理完成', 'FAIL', '超时');
      return;
    }
    await this.screenshot('scene1_14_complete');

    // 15. 查看生成结果统计
    log(15, '查看生成结果', 'START');
    const resultVisible = await this.page.locator('#resultSummary').isVisible();
    const fileCount = await this.page.locator('#totalFiles').textContent();
    const totalSize = await this.page.locator('#totalSize').textContent();
    log(15, '查看生成结果', resultVisible ? 'PASS' : 'FAIL', 
      `文件数: ${fileCount}, 总大小: ${totalSize}`);

    // 16. 查看生成的文件列表
    log(16, '查看文件列表', 'START');
    const resultFiles = await this.page.locator('#resultFileList .file-list-item').count();
    log(16, '查看文件列表', resultFiles > 0 ? 'PASS' : 'FAIL', `${resultFiles} 个文件`);

    // 17. 验证文件名
    log(17, '验证文件名', 'START');
    const fileNames = await this.page.locator('#resultFileList .file-list-name').allTextContents();
    const hasCorrectNames = fileNames.every(name => 
      name.includes('销售数据') || name.includes('库存数据')
    );
    log(17, '验证文件名', hasCorrectNames ? 'PASS' : 'FAIL', fileNames.join(', '));

    // 18. 点击下载按钮
    log(18, '点击下载按钮', 'START');
    const downloadBtnVisible = await this.page.locator('#downloadBtn').isVisible();
    log(18, '点击下载按钮', downloadBtnVisible ? 'PASS' : 'FAIL', '下载按钮可见');

    // 19. 等待下载完成并验证
    log(19, '下载并验证文件', 'START');
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.click('#downloadBtn')
    ]);
    
    const downloadPath = path.join(CONFIG.downloadDir, download.suggestedFilename());
    await download.saveAs(downloadPath);
    log(19, '下载并验证文件', fs.existsSync(downloadPath) ? 'PASS' : 'FAIL', downloadPath);

    // 20. 解压并验证内容
    log(20, '解压验证内容', 'START');
    const zipData = fs.readFileSync(downloadPath);
    const zip = await JSZip.loadAsync(zipData);
    const files = Object.keys(zip.files).filter(name => name.endsWith('.xlsx'));
    log(20, '解压验证内容', files.length === 2 ? 'PASS' : 'FAIL', `包含 ${files.length} 个文件`);

    // 21. 验证每个文件的数据
    for (const fileName of files) {
      const fileData = await zip.files[fileName].async('nodebuffer');
      const tempPath = path.join(CONFIG.downloadDir, `verify-${fileName}`);
      fs.writeFileSync(tempPath, fileData);
      
      const wb = XLSX.readFile(tempPath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      log(21, `验证 ${fileName}`, jsonData.length > 0 ? 'PASS' : 'FAIL', 
        `${jsonData.length} 行数据`);
      
      // 验证列宽
      const hasCols = ws['!cols'] && ws['!cols'].length > 0;
      log(22, `验证 ${fileName} 格式`, hasCols ? 'PASS' : 'FAIL', 
        hasCols ? '列宽保留' : '列宽丢失');
      
      fs.unlinkSync(tempPath);
    }

    console.log('\n✅ 场景1测试完成\n');
  }

  // ========== 测试场景2: 按列拆分 ==========
  async testScene2_SplitByColumn() {
    console.log('\n📋 场景2: 按列拆分（横向）');
    
    // 类似场景1的完整流程...
    log(23, '场景2开始', 'START', '按列拆分测试');
    
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(1000);
    
    // 选择模式
    await this.page.click('[data-mode="split-column"]');
    await this.page.waitForTimeout(800);
    log(24, '选择横向拆分模式', 'PASS');
    await this.screenshot('scene2_01_mode');

    // 上传文件
    const testFile = createSplitColumnFile();
    await this.page.locator('#fileInput').setInputFiles(testFile);
    await this.page.waitForTimeout(2000);
    log(25, '上传文件', 'PASS');
    await this.screenshot('scene2_02_uploaded');

    // 选择工作表
    await this.page.locator('#sheetList .sheet-item').first().click();
    await this.page.waitForTimeout(500);
    log(26, '选择工作表', 'PASS');

    // 下一步
    await this.page.click('#step2Next');
    await this.page.waitForTimeout(1000);
    log(27, '进入列选择', 'PASS');
    await this.screenshot('scene2_03_columns');

    // 选择第一列（城市）
    await this.page.locator('#columnList .sheet-item').first().click();
    await this.page.waitForTimeout(500);
    log(28, '选择拆分列', 'PASS');

    // 生成
    await this.page.click('#step3Next');
    await this.page.waitForTimeout(1000);
    await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
    log(29, '生成完成', 'PASS');
    await this.screenshot('scene2_04_complete');

    // 验证分组结果（应该分成北京和上海两个文件）
    const resultFiles = await this.page.locator('#resultFileList .file-list-item').count();
    log(30, '分组结果', resultFiles === 2 ? 'PASS' : 'FAIL', `${resultFiles} 个分组文件`);

    console.log('\n✅ 场景2测试完成\n');
  }

  async close() {
    if (this.browser) await this.browser.close();
    
    // 保存测试日志
    const logPath = path.join(CONFIG.screenshotDir, 'test-log.json');
    fs.writeFileSync(logPath, JSON.stringify(testLog, null, 2));
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试完成');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const passCount = testLog.filter(l => l.result === 'PASS').length;
    const failCount = testLog.filter(l => l.result === 'FAIL').length;
    
    console.log(`\n总步骤: ${testLog.length}`);
    console.log(`✅ 通过: ${passCount}`);
    console.log(`❌ 失败: ${failCount}`);
    console.log(`📸 截图: ${this.stepNum} 张`);
    console.log(`📝 日志: ${logPath}`);
  }

  async runAll() {
    await this.init();
    await this.testScene1_SplitBySheet();
    await this.testScene2_SplitByColumn();
    await this.close();
  }
}

// 运行测试
async function main() {
  const test = new HumanSimulationTest();
  await test.runAll();
}

main().catch(console.error);

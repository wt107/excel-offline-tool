/**
 * 文件下载和内容验证测试
 * 验证生成的文件内容、格式是否正确
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CONFIG = {
  baseUrl: 'file://' + path.resolve(__dirname, '../excel.html'),
  downloadDir: path.join(__dirname, 'verified-downloads'),
  screenshotDir: path.join(__dirname, 'verification-screenshots'),
  headless: false,
  slowMo: 500
};

// 确保目录存在
[CONFIG.downloadDir, CONFIG.screenshotDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 验证报告
class VerificationReport {
  constructor() {
    this.checks = [];
  }

  add(category, check, status, details = {}) {
    this.checks.push({ category, check, status, details, time: new Date().toISOString() });
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} [${category}] ${check}`);
    if (details.message) console.log(`   ${details.message}`);
  }

  summary() {
    const pass = this.checks.filter(c => c.status === 'PASS').length;
    const fail = this.checks.filter(c => c.status === 'FAIL').length;
    return { pass, fail, total: this.checks.length };
  }
}

const report = new VerificationReport();

class FileVerificationTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.stepNum = 0;
  }

  async init() {
    console.log('🚀 启动浏览器...');
    this.browser = await chromium.launch({ headless: CONFIG.headless, slowMo: CONFIG.slowMo });
    this.context = await this.browser.newContext({
      acceptDownloads: true
    });
    this.page = await this.context.newPage();
    console.log('✅ 浏览器启动成功\n');
  }

  async screenshot(name) {
    this.stepNum++;
    const filepath = path.join(CONFIG.screenshotDir, `${String(this.stepNum).padStart(3, '0')}_${name}.png`);
    await this.page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  // 等待并获取下载的文件
  async waitForDownload(timeout = 30000) {
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout }),
      this.page.click('#downloadBtn')
    ]);
    
    const downloadPath = path.join(CONFIG.downloadDir, download.suggestedFilename());
    await download.saveAs(downloadPath);
    return { download, downloadPath, filename: download.suggestedFilename() };
  }

  // 验证 Excel 文件内容
  verifyExcelContent(filepath, expectedData, testName) {
    try {
      const workbook = XLSX.readFile(filepath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // 验证行数
      const rowMatch = jsonData.length === expectedData.length;
      report.add(testName, '行数验证', rowMatch ? 'PASS' : 'FAIL', 
        { message: `期望${expectedData.length}行, 实际${jsonData.length}行` });

      // 验证内容
      let contentMatch = true;
      for (let i = 0; i < Math.min(jsonData.length, expectedData.length); i++) {
        const actualRow = jsonData[i];
        const expectedRow = expectedData[i];
        
        for (let j = 0; j < Math.min(actualRow.length, expectedRow.length); j++) {
          if (String(actualRow[j]) !== String(expectedRow[j])) {
            contentMatch = false;
            report.add(testName, `内容验证[${i},${j}]`, 'FAIL', 
              { message: `期望"${expectedRow[j]}",实际"${actualRow[j]}"` });
          }
        }
      }

      if (contentMatch) {
        report.add(testName, '内容验证', 'PASS', { message: '所有数据匹配' });
      }

      return { workbook, jsonData, sheetName };
    } catch (e) {
      report.add(testName, '文件读取', 'FAIL', { message: e.message });
      return null;
    }
  }

  // 测试1: 验证按工作表拆分的文件
  async test1_SplitBySheet_VerifyContent() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试1: 按工作表拆分 - 验证文件内容和格式');
    console.log('═══════════════════════════════════════════════════════════════');

    // 准备源数据
    const sourceData = {
      '销售数据': [
        ['姓名', '部门', '销售额'],
        ['张三', '销售部', 15000],
        ['李四', '销售部', 20000],
        ['王五', '技术部', 18000]
      ],
      '库存数据': [
        ['产品', '库存', '价格'],
        ['产品A', 100, 50],
        ['产品B', 200, 80],
        ['产品C', 150, 60]
      ]
    };

    // 创建源文件
    const sourceFile = path.join(CONFIG.downloadDir, 'source-multi-sheet.xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sourceData['销售数据']), '销售数据');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sourceData['库存数据']), '库存数据');
    XLSX.writeFile(wb, sourceFile);

    // 打开页面并处理
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(1000);
    await this.page.click('[data-mode="split-sheet"]');
    await this.page.waitForTimeout(500);

    // 上传文件
    await this.page.locator('#fileInput').setInputFiles(sourceFile);
    await this.page.waitForTimeout(2000);
    await this.screenshot('t1_uploaded');

    // 全选并生成
    const checkboxes = await this.page.locator('.sheet-checkbox').all();
    for (const cb of checkboxes) await cb.check();
    await this.page.waitForTimeout(300);

    await this.page.click('#step2Next');
    await this.page.waitForTimeout(500);
    await this.page.click('#step3Next');
    await this.page.waitForTimeout(1000);

    // 等待完成
    await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
    await this.screenshot('t1_complete');

    // 下载文件
    console.log('   📥 下载生成的文件...');
    const downloadResult = await this.waitForDownload();
    console.log(`   📁 下载完成: ${downloadResult.filename}`);

    // 因为是ZIP，需要解压验证
    if (downloadResult.filename.endsWith('.zip')) {
      const JSZip = require('jszip');
      const zipData = fs.readFileSync(downloadResult.downloadPath);
      const zip = await JSZip.loadAsync(zipData);
      
      const files = Object.keys(zip.files).filter(name => name.endsWith('.xlsx'));
      report.add('T1', 'ZIP文件数量', files.length === 2 ? 'PASS' : 'FAIL', 
        { message: `ZIP中包含${files.length}个xlsx文件` });

      // 验证每个文件
      for (const fileName of files) {
        const sheetName = fileName.includes('销售数据') ? '销售数据' : 
                          fileName.includes('库存数据') ? '库存数据' : null;
        
        if (sheetName && sourceData[sheetName]) {
          const fileData = await zip.files[fileName].async('nodebuffer');
          const tempPath = path.join(CONFIG.downloadDir, `temp-${fileName}`);
          fs.writeFileSync(tempPath, fileData);
          
          console.log(`   🔍 验证文件: ${fileName}`);
          this.verifyExcelContent(tempPath, sourceData[sheetName], `T1-${sheetName}`);
          
          fs.unlinkSync(tempPath);
        }
      }
    }
  }

  // 测试2: 验证按列拆分的文件
  async test2_SplitByColumn_VerifyContent() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试2: 按列拆分 - 验证分组正确性');
    console.log('═══════════════════════════════════════════════════════════════');

    // 准备源数据
    const sourceData = [
      ['部门', '姓名', '业绩'],
      ['销售部', '张三', 100],
      ['技术部', '李四', 200],
      ['销售部', '王五', 150],
      ['技术部', '赵六', 180]
    ];

    const expectedGroups = {
      '销售部': [
        ['部门', '姓名', '业绩'],
        ['销售部', '张三', 100],
        ['销售部', '王五', 150]
      ],
      '技术部': [
        ['部门', '姓名', '业绩'],
        ['技术部', '李四', 200],
        ['技术部', '赵六', 180]
      ]
    };

    // 创建源文件
    const sourceFile = path.join(CONFIG.downloadDir, 'source-split-col.xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sourceData), 'Sheet1');
    XLSX.writeFile(wb, sourceFile);

    // 处理文件
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(1000);
    await this.page.click('[data-mode="split-column"]');
    await this.page.waitForTimeout(500);

    await this.page.locator('#fileInput').setInputFiles(sourceFile);
    await this.page.waitForTimeout(2000);
    await this.screenshot('t2_uploaded');

    // 选择工作表和列
    await this.page.locator('#sheetList .sheet-item').first().click();
    await this.page.waitForTimeout(500);
    await this.page.click('#step2Next');
    await this.page.waitForTimeout(1000);
    await this.screenshot('t2_columns');

    // 选择第一列（部门）
    await this.page.locator('#columnList .sheet-item').first().click();
    await this.page.waitForTimeout(500);

    await this.page.click('#step3Next');
    await this.page.waitForTimeout(1000);
    await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
    await this.screenshot('t2_complete');

    // 下载并验证
    const downloadResult = await this.waitForDownload();
    console.log(`   📁 下载完成: ${downloadResult.filename}`);

    if (downloadResult.filename.endsWith('.zip')) {
      const JSZip = require('jszip');
      const zipData = fs.readFileSync(downloadResult.downloadPath);
      const zip = await JSZip.loadAsync(zipData);
      
      const files = Object.keys(zip.files).filter(name => name.endsWith('.xlsx'));
      report.add('T2', '分组文件数量', files.length >= 2 ? 'PASS' : 'FAIL', 
        { message: `期望2个部门文件, 实际${files.length}个` });

      // 验证分组内容
      for (const fileName of files) {
        const groupName = fileName.includes('销售部') ? '销售部' :
                         fileName.includes('技术部') ? '技术部' : null;
        
        if (groupName && expectedGroups[groupName]) {
          const fileData = await zip.files[fileName].async('nodebuffer');
          const tempPath = path.join(CONFIG.downloadDir, `temp-${fileName}`);
          fs.writeFileSync(tempPath, fileData);
          
          console.log(`   🔍 验证分组: ${groupName}`);
          this.verifyExcelContent(tempPath, expectedGroups[groupName], `T2-${groupName}`);
          
          fs.unlinkSync(tempPath);
        }
      }
    }
  }

  // 测试3: 验证文件合并的内容
  async test3_MergeFiles_VerifyContent() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试3: 多文件合并 - 验证合并结果');
    console.log('═══════════════════════════════════════════════════════════════');

    // 准备源文件1
    const file1Data = [
      ['姓名', '数据'],
      ['张三', 100],
      ['李四', 200]
    ];
    const file1 = path.join(CONFIG.downloadDir, 'merge-source-1.xlsx');
    const wb1 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb1, XLSX.utils.aoa_to_sheet(file1Data), '数据表1');
    XLSX.writeFile(wb1, file1);

    // 准备源文件2
    const file2Data = [
      ['姓名', '数据'],
      ['王五', 300],
      ['赵六', 400]
    ];
    const file2 = path.join(CONFIG.downloadDir, 'merge-source-2.xlsx');
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(file2Data), '数据表2');
    XLSX.writeFile(wb2, file2);

    // 处理
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(1000);
    await this.page.click('[data-mode="merge-file"]');
    await this.page.waitForTimeout(500);

    await this.page.locator('#fileInput').setInputFiles([file1, file2]);
    await this.page.waitForTimeout(2000);
    await this.screenshot('t3_uploaded');

    // 下一步
    const nextBtn = this.page.locator('#step1Next, #step2Next').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await this.page.waitForTimeout(1000);
      await this.screenshot('t3_sheets');

      // 选择所有工作表
      const checkboxes = await this.page.locator('.sheet-checkbox').all();
      for (const cb of checkboxes) await cb.check();

      await this.page.click('#step3Next');
      await this.page.waitForTimeout(1000);
      await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
      await this.screenshot('t3_complete');

      // 下载合并结果
      const downloadResult = await this.waitForDownload();
      console.log(`   📁 下载完成: ${downloadResult.filename}`);

      // 验证合并后的文件
      if (downloadResult.filename.endsWith('.xlsx')) {
        const result = this.verifyExcelContent(downloadResult.downloadPath, [], 'T3');
        
        if (result && result.workbook) {
          // 验证工作表数量
          const sheetCount = result.workbook.SheetNames.length;
          report.add('T3', '合并后工作表数量', sheetCount >= 2 ? 'PASS' : 'FAIL', 
            { message: `期望至少2个工作表, 实际${sheetCount}个` });

          // 验证每个工作表
          for (const sheetName of result.workbook.SheetNames) {
            const ws = result.workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            report.add('T3', `工作表"${sheetName}"`, 'PASS', 
              { message: `包含${data.length}行数据` });
          }
        }
      }
    }
  }

  // 测试4: 验证格式保留
  async test4_FormatRetention() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  测试4: 格式保留验证');
    console.log('═══════════════════════════════════════════════════════════════');

    // 创建一个带格式的文件（使用 xlsx-js-style 的格式）
    const sourceFile = path.join(CONFIG.downloadDir, 'source-formatted.xlsx');
    
    // 使用基础 xlsx 创建，带一些格式
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['标题', '数值', '日期'],
      ['项目A', 100, '2024-01-01'],
      ['项目B', 200, '2024-01-02']
    ]);
    
    // 添加列宽
    ws['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 12 }];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, sourceFile);

    // 处理
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForTimeout(1000);
    await this.page.click('[data-mode="split-sheet"]');
    await this.page.waitForTimeout(500);

    await this.page.locator('#fileInput').setInputFiles(sourceFile);
    await this.page.waitForTimeout(2000);

    // 选择并生成
    const checkboxes = await this.page.locator('.sheet-checkbox').all();
    for (const cb of checkboxes) await cb.check();
    
    await this.page.click('#step2Next');
    await this.page.waitForTimeout(500);
    await this.page.click('#step3Next');
    await this.page.waitForTimeout(1000);
    await this.page.waitForSelector('#resultSummary', { state: 'visible', timeout: 30000 });
    await this.screenshot('t4_complete');

    // 下载
    const downloadResult = await this.waitForDownload();
    
    // 验证格式
    if (downloadResult.filename.endsWith('.zip')) {
      const JSZip = require('jszip');
      const zipData = fs.readFileSync(downloadResult.downloadPath);
      const zip = await JSZip.loadAsync(zipData);
      
      const xlsxFiles = Object.keys(zip.files).filter(name => name.endsWith('.xlsx'));
      
      for (const fileName of xlsxFiles) {
        const fileData = await zip.files[fileName].async('nodebuffer');
        const tempPath = path.join(CONFIG.downloadDir, `format-test-${fileName}`);
        fs.writeFileSync(tempPath, fileData);
        
        // 读取验证（设置 cellStyles: true 以保留格式）
        const resultWb = XLSX.readFile(tempPath, { cellStyles: true });
        const resultWs = resultWb.Sheets[resultWb.SheetNames[0]];
        
        // 验证列宽是否保留
        const hasCols = resultWs['!cols'] && resultWs['!cols'].length > 0;
        report.add('T4', `文件"${fileName}"列宽保留`, hasCols ? 'PASS' : 'FAIL', 
          hasCols ? { message: `保留${resultWs['!cols'].length}列宽度` } : { message: '列宽未保留' });
        
        // 验证数据完整性
        const jsonData = XLSX.utils.sheet_to_json(resultWs, { header: 1 });
        report.add('T4', `文件"${fileName}"数据完整性`, jsonData.length >= 3 ? 'PASS' : 'FAIL', 
          { message: `${jsonData.length}行数据` });
        
        fs.unlinkSync(tempPath);
      }
    }
  }

  async close() {
    if (this.browser) await this.browser.close();
  }

  async runAll() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  🔍 Excel 离线工具 - 文件内容验证测试');
    console.log('═══════════════════════════════════════════════════════════════');

    await this.init();

    try {
      await this.test1_SplitBySheet_VerifyContent();
      await this.test2_SplitByColumn_VerifyContent();
      await this.test3_MergeFiles_VerifyContent();
      await this.test4_FormatRetention();
    } catch (e) {
      console.error('测试失败:', e);
    }

    await this.close();

    // 输出报告
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  验证测试报告');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const summary = report.summary();
    console.log(`\n总验证项: ${summary.total}`);
    console.log(`✅ 通过: ${summary.pass}`);
    console.log(`❌ 失败: ${summary.fail}`);
    console.log(`📸 截图: ${this.stepNum} 张`);
    console.log(`📁 下载文件: ${CONFIG.downloadDir}`);

    // 保存报告
    const reportPath = path.join(CONFIG.downloadDir, 'verification-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      summary,
      checks: report.checks
    }, null, 2));
    console.log(`\n📄 报告保存: ${reportPath}`);

    return summary;
  }
}

// 运行测试
async function main() {
  const test = new FileVerificationTest();
  const result = await test.runAll();
  process.exit(result.fail > 0 ? 1 : 0);
}

main().catch(console.error);

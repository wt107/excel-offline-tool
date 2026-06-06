/**
 * Bug-1 修复验证：不同列数文件合并，来源列统一
 * merge-sheet 模式：将同名工作表的数据合并到一个工作表中
 * 从用户角度验证：当合并列数不同的文件时，来源列位置应当一致
 */
const { test, expect } = require('@playwright/test');
const {
  gotoHome,
  selectMode,
  uploadFiles,
  goToStep2,
  selectAllSheets,
  goToStep4,
  downloadAndSave,
  expectResultSuccess,
} = require('../helpers/common');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

test.describe('Bug-1 修复验证：不同列数文件合并 (merge-sheet)', () => {
  test('2列 + 5列文件合并，应成功合并为5列（智能追加模式）', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');
    await uploadFiles(page, ['bug1-merge-2cols.xlsx', 'bug1-merge-5cols.xlsx']);
    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep4(page);
    await expectResultSuccess(page);

    // 验证：没有跳过信息（5列文件应成功合并）
    const skippedInfo = page.locator('#skippedSheetsInfo');
    const isVisible = await skippedInfo.isVisible().catch(() => false);
    expect(isVisible).toBe(false); // 不应显示跳过信息

    const downloadPath = path.resolve(__dirname, '..', 'test-downloads', 'bug1-2plus5.xlsx');
    await downloadAndSave(page, downloadPath);

    const wb = XLSX.readFile(downloadPath);
    expect(wb.SheetNames.length).toBe(1);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log('Data:', JSON.stringify(data, null, 2));

    // 验证：合并后应为 5 行（表头 + 文件A的2行 + 文件B的2行）
    expect(data.length).toBe(5);

    // 验证：表头应为 6 列（5 数据列 + 来源列）
    const headerRow = data[0];
    expect(headerRow.length).toBe(6);

    // 验证：来源列在最右侧（索引5）
    const sourceColIdx = headerRow.indexOf('来源文件');
    expect(sourceColIdx).toBe(5);

    // 验证：文件A的数据行（第1-2行）只有前2列有值，后3列为空（null）
    expect(data[1][0]).toBe('张三');
    expect(data[1][1]).toBe(10);
    expect(data[1][2]).toBeFalsy(); // 缺失列留空（SheetJS读取为null）
    expect(data[1][3]).toBeFalsy();
    expect(data[1][4]).toBeFalsy();
    expect(data[1][5]).toContain('bug1-merge-2cols.xlsx');

    // 验证：文件B的数据行（第3-4行）5列都有值
    expect(data[3][0]).toBe('王五');
    expect(data[3][1]).toBe(30);
    expect(data[3][2]).toBe(5.5);
    expect(data[3][3]).toBe('2024-01-01');
    expect(data[3][4]).toBe('好');
    expect(data[3][5]).toContain('bug1-merge-5cols.xlsx');

    fs.unlinkSync(downloadPath);
  });

  test('5列 + 2列文件合并，来源列应统一在最后', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');
    await uploadFiles(page, ['bug1-merge-5cols.xlsx', 'bug1-merge-2cols.xlsx']);
    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep4(page);
    await expectResultSuccess(page);

    const downloadPath = path.resolve(__dirname, '..', 'test-downloads', 'bug1-5plus2.xlsx');
    await downloadAndSave(page, downloadPath);

    const wb = XLSX.readFile(downloadPath);
    expect(wb.SheetNames.length).toBe(1);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log('5+2 Data:', JSON.stringify(data, null, 2));

    const headerRow = data[0];
    const sourceColIdx = headerRow.indexOf('来源文件');
    expect(sourceColIdx).toBe(5); // 同上，来源列应在索引5

    for (let i = 1; i < data.length; i++) {
      expect(data[i][sourceColIdx]).toBeTruthy();
    }

    fs.unlinkSync(downloadPath);
  });

  test('空字符串单元格应保留（merge-sheet）', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');
    await uploadFiles(page, ['empty-cells.xlsx']);
    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep4(page);
    await expectResultSuccess(page);

    const downloadPath = path.resolve(__dirname, '..', 'test-downloads', 'bug1-empty.xlsx');
    await downloadAndSave(page, downloadPath);

    const wb = XLSX.readFile(downloadPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // 验证空字符串单元格没有被吞掉
    // 原始数据: [['A','B','C'],[1,'',3],['',2,'']]
    expect(data[1][0]).toBe(1);
    expect(data[1][1]).toBe(''); // 空字符串
    expect(data[1][2]).toBe(3);
    expect(data[2][0]).toBe(''); // 空字符串
    expect(data[2][1]).toBe(2);
    expect(data[2][2]).toBe(''); // 空字符串

    fs.unlinkSync(downloadPath);
  });

  test('数字0应正确保留（merge-sheet）', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');
    await uploadFiles(page, ['zero-cells.xlsx']);
    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep4(page);
    await expectResultSuccess(page);

    const downloadPath = path.resolve(__dirname, '..', 'test-downloads', 'bug1-zero.xlsx');
    await downloadAndSave(page, downloadPath);

    const wb = XLSX.readFile(downloadPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    expect(data[1][0]).toBe(0);
    expect(data[1][1]).toBe(1);
    expect(data[2][0]).toBe(2);
    expect(data[2][1]).toBe(0);

    fs.unlinkSync(downloadPath);
  });

  test('公式在merge-sheet模式下会丢失（转为静态值）', async ({ page }) => {
    await gotoHome(page);
    await selectMode(page, 'merge-sheet');
    await uploadFiles(page, ['formula.xlsx']);
    await goToStep2(page);
    await selectAllSheets(page);
    await goToStep4(page);
    await expectResultSuccess(page);

    const downloadPath = path.resolve(__dirname, '..', 'test-downloads', 'bug1-formula.xlsx');
    await downloadAndSave(page, downloadPath);

    const wb = XLSX.readFile(downloadPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    
    // 检查 D2 单元格是否还有公式
    const d2 = ws['D2'];
    console.log('D2 cell:', d2);
    
    // sheet_to_json 已经将公式转为静态值
    // 合并后的文件中，公式应该丢失
    expect(d2).toBeDefined();
    expect(d2.v).toBe(55); // 计算结果保留
    // 注意：f 属性（公式）可能已经丢失，这是已知限制

    fs.unlinkSync(downloadPath);
  });
});
/**
 * 测试数据生成器
 * 使用 SheetJS (xlsx) 生成各种特征的 Excel 测试文件
 *
 * 用法: node scripts/generate-test-data.js
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'test-data');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('正在生成测试数据...\n');

// ─── 1. basic-3sheets.xlsx ───────────────────────
// 3个工作表，含数据，用于按工作表拆分和文件合并测试
{
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet([
    ['名称', '数量', '价格', '备注'],
    ['苹果', 10, 5.5, '新鲜'],
    ['香蕉', 20, 3.2, '进口'],
    ['橙子', 15, 4.8, '国产'],
    ['葡萄', 8, 12.0, '新疆'],
    ['西瓜', 3, 2.8, '本地'],
    ['芒果', 12, 8.5, '海南'],
    ['草莓', 25, 15.0, '大连'],
    ['蓝莓', 30, 22.0, '进口'],
    ['樱桃', 18, 35.0, '山东'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws1, '销售数据');

  const ws2 = XLSX.utils.aoa_to_sheet([
    ['类别', '库存量', '供应商'],
    ['水果', 500, 'A公司'],
    ['蔬菜', 300, 'B公司'],
    ['饮料', 200, 'C公司'],
    ['零食', 150, 'D公司'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws2, '库存');

  // 空Sheet - 测试空Sheet跳过逻辑
  const ws3 = XLSX.utils.aoa_to_sheet([]);
  ws3['!ref'] = 'A1';
  XLSX.utils.book_append_sheet(wb, ws3, '空表');

  const filePath = path.join(OUTPUT_DIR, 'basic-3sheets.xlsx');
  XLSX.writeFile(wb, filePath);
  console.log('  [OK] basic-3sheets.xlsx - 3个工作表(含1个空表)');
}

// ─── 2. merged-cells.xlsx ───────────────────────
// 含合并单元格，用于按列拆分（横向）测试
{
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([
    ['分类', '名称', '数量'],
    ['水果', '苹果', 10],
    ['水果', '香蕉', 20],
    ['水果', '橙子', 15],
    ['蔬菜', '白菜', 30],
    ['蔬菜', '萝卜', 25],
    ['饮料', '可乐', 40],
    ['饮料', '果汁', 35],
  ]);

  // 设置合并单元格：A1:C1 (标题行合并)
  ws['!merges'] = [
    { s: { r: 1, c: 0 }, e: { r: 3, c: 0 } },  // A2:A4 "水果" 合并
    { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },  // A5:A6 "蔬菜" 合并
    { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } },  // A7:A8 "饮料" 合并
  ];

  XLSX.utils.book_append_sheet(wb, ws, '数据');
  const filePath = path.join(OUTPUT_DIR, 'merged-cells.xlsx');
  XLSX.writeFile(wb, filePath);
  console.log('  [OK] merged-cells.xlsx - 含合并单元格+分类列');
}

// ─── 3. case-sensitive.xlsx ─────────────────────
// 拆分列含大小写冲突值，用于文件名去重测试
{
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([
    ['部门', '姓名', '工资'],
    ['Apple', '张三', 8000],
    ['apple', '李四', 7500],
    ['Banana', '王五', 9000],
    ['banana', '赵六', 8500],
    ['Cherry', '钱七', 7000],
  ]);

  XLSX.utils.book_append_sheet(wb, ws, '员工');
  const filePath = path.join(OUTPUT_DIR, 'case-sensitive.xlsx');
  XLSX.writeFile(wb, filePath);
  console.log('  [OK] case-sensitive.xlsx - 大小写冲突值(Apple/apple)');
}

// ─── 4. multi-column.xlsx ──────────────────────
// 6列数据，用于竖向拆分测试
{
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([
    ['姓名', '语文', '数学', '英语', '物理', '化学'],
    ['张三', 85, 92, 78, 88, 90],
    ['李四', 72, 88, 95, 76, 82],
    ['王五', 90, 76, 82, 95, 78],
    ['赵六', 68, 95, 88, 72, 92],
    ['钱七', 95, 82, 70, 90, 85],
  ]);

  // 设置列宽
  ws['!cols'] = [
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, '成绩');
  const filePath = path.join(OUTPUT_DIR, 'multi-column.xlsx');
  XLSX.writeFile(wb, filePath);
  console.log('  [OK] multi-column.xlsx - 6列成绩表(竖向拆分)');
}

// ─── 5. simple-merge-a.xlsx + simple-merge-b.xlsx ──
// 两个结构相同的文件，用于工作表数据合并测试
{
  const wbA = XLSX.utils.book_new();
  const wsA1 = XLSX.utils.aoa_to_sheet([
    ['名称', '数量', '价格'],
    ['苹果', 10, 5.5],
    ['香蕉', 20, 3.2],
  ]);
  XLSX.utils.book_append_sheet(wbA, wsA1, '销售');
  const wsA2 = XLSX.utils.aoa_to_sheet([
    ['类别', '库存'],
    ['水果', 500],
    ['蔬菜', 300],
  ]);
  XLSX.utils.book_append_sheet(wbA, wsA2, '库存');
  XLSX.writeFile(wbA, path.join(OUTPUT_DIR, 'simple-merge-a.xlsx'));
  console.log('  [OK] simple-merge-a.xlsx - 合并测试文件A(2个Sheet)');

  const wbB = XLSX.utils.book_new();
  const wsB1 = XLSX.utils.aoa_to_sheet([
    ['名称', '数量', '价格'],
    ['橙子', 15, 4.8],
    ['葡萄', 8, 12.0],
  ]);
  XLSX.utils.book_append_sheet(wbB, wsB1, '销售');
  const wsB2 = XLSX.utils.aoa_to_sheet([
    ['类别', '库存'],
    ['饮料', 200],
    ['零食', 150],
  ]);
  XLSX.utils.book_append_sheet(wbB, wsB2, '库存');
  XLSX.writeFile(wbB, path.join(OUTPUT_DIR, 'simple-merge-b.xlsx'));
  console.log('  [OK] simple-merge-b.xlsx - 合并测试文件B(2个Sheet)');
}

// ─── 6. special-chars.xlsx ─────────────────────
// 拆分列含特殊字符，测试文件名安全处理
{
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([
    ['路径', '文件名', '大小'],
    ['C:/data', 'test1.txt', 1024],
    ['D:\\backup', 'test2.txt', 2048],
    ['<root>', 'test3.txt', 512],
    ['a*b?c', 'test4.txt', 4096],
  ]);

  XLSX.utils.book_append_sheet(wb, ws, '文件');
  const filePath = path.join(OUTPUT_DIR, 'special-chars.xlsx');
  XLSX.writeFile(wb, filePath);
  console.log('  [OK] special-chars.xlsx - 特殊字符路径(\\/:*?<>)');
}

// ─── 7. formula.xlsx ──────────────────────────
// 含公式，测试 fullCalcOnLoad 强制重算
{
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([
    ['名称', '数量', '单价', '合计'],
    ['苹果', 10, 5.5],
    ['香蕉', 20, 3.2],
    ['橙子', 15, 4.8],
  ]);

  // 添加公式
  ws['D2'] = { t: 'n', f: 'B2*C2', v: 55 };
  ws['D3'] = { t: 'n', f: 'B3*C3', v: 64 };
  ws['D4'] = { t: 'n', f: 'B4*C4', v: 72 };
  ws['!ref'] = 'A1:D4';

  XLSX.utils.book_append_sheet(wb, ws, '公式表');
  const filePath = path.join(OUTPUT_DIR, 'formula.xlsx');
  XLSX.writeFile(wb, filePath);
  console.log('  [OK] formula.xlsx - 含公式(测试强制重算)');
}

// ─── 8. large-3000rows.xlsx ────────────────────
// 3000行数据，测试大文件处理和时间片分片
{
  const wb = XLSX.utils.book_new();
  const rows = [['编号', '名称', '数量', '价格', '分类']];
  const categories = ['水果', '蔬菜', '饮料', '零食', '调味品'];
  for (let i = 1; i <= 3000; i++) {
    rows.push([
      i,
      `商品${i}`,
      Math.floor(Math.random() * 100) + 1,
      (Math.random() * 50 + 1).toFixed(2),
      categories[i % 5],
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '大数据');
  const filePath = path.join(OUTPUT_DIR, 'large-3000rows.xlsx');
  XLSX.writeFile(wb, filePath);
  console.log('  [OK] large-3000rows.xlsx - 3000行大文件(时间片测试)');
}

console.log('\n测试数据生成完毕! 目录: ' + OUTPUT_DIR);

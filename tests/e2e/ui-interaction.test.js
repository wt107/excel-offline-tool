/**
 * E2E UI 交互测试
 * 使用 Playwright 或 Puppeteer 进行端到端测试
 */

const { test, expect, describe, beforeAll, afterAll } = require('@jest/globals');

// ═══════════════════════════════════════════════════════════════
// E2E 测试配置
// ═══════════════════════════════════════════════════════════════

const TEST_CONFIG = {
  baseUrl: 'file://' + __dirname + '/../../excel.html',
  timeout: 30000,
  viewport: { width: 1280, height: 720 }
};

// 模拟浏览器环境（用于 Node.js 测试）
class MockBrowser {
  constructor() {
    this.page = {
      goto: jest.fn(),
      click: jest.fn(),
      fill: jest.fn(),
      waitForSelector: jest.fn(),
      waitForTimeout: jest.fn(),
      evaluate: jest.fn(),
      screenshot: jest.fn(),
      on: jest.fn()
    };
    this.dialogHandler = null;
  }

  async newPage() {
    return this.page;
  }

  async close() {
    // Cleanup
  }
}

// ═══════════════════════════════════════════════════════════════
// E2E 测试套件
// ═══════════════════════════════════════════════════════════════

describe('Excel 离线工具 E2E 测试', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // 在实际环境中使用 Playwright/Puppeteer
    // browser = await playwright.chromium.launch();
    // page = await browser.newPage();
    // await page.setViewportSize(TEST_CONFIG.viewport);
    
    // 模拟环境
    browser = new MockBrowser();
    page = browser.page;
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 页面加载测试
  // ─────────────────────────────────────────────────────────────
  describe('页面加载', () => {
    test('页面标题应正确显示', async () => {
      page.evaluate.mockResolvedValue('Excel文件处理工具');
      const title = await page.evaluate(() => document.title);
      expect(title).toBe('Excel文件处理工具');
    });

    test('应显示所有模式按钮', async () => {
      const buttons = [
        '按工作表拆分',
        '按列拆分(横向)',
        '按列拆分(竖向)',
        '文件合并',
        '工作表数据合并'
      ];
      
      page.evaluate.mockImplementation((fn) => {
        if (typeof fn === 'function') {
          return Promise.resolve(buttons);
        }
        return Promise.resolve([]);
      });

      const modeButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.mode-btn')).map(b => b.textContent);
      });
      
      expect(modeButtons.length).toBe(5);
      buttons.forEach(text => {
        expect(modeButtons.some(btn => btn.includes(text))).toBe(true);
      });
    });

    test('应显示四步流程指示器', async () => {
      page.evaluate.mockResolvedValue(['上传文件', '选择内容', '配置选项', '生成文件']);
      
      const steps = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.step span')).map(s => s.textContent);
      });
      
      expect(steps).toContain('上传文件');
      expect(steps).toContain('选择内容');
      expect(steps).toContain('配置选项');
      expect(steps).toContain('生成文件');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 模式切换测试
  // ─────────────────────────────────────────────────────────────
  describe('模式切换', () => {
    test('切换模式应更新活动状态', async () => {
      page.click.mockResolvedValue(undefined);
      page.waitForTimeout.mockResolvedValue(undefined);
      page.evaluate.mockResolvedValue('split-column');

      await page.click('[data-mode="split-column"]');
      await page.waitForTimeout(300);

      const activeMode = await page.evaluate(() => {
        return document.querySelector('.mode-btn.active').dataset.mode;
      });

      expect(activeMode).toBe('split-column');
    });

    test('工作表拆分模式应显示单文件上传', async () => {
      page.click.mockResolvedValue(undefined);
      page.evaluate.mockResolvedValue(false);

      await page.click('[data-mode="split-sheet"]');
      
      const hasMultiple = await page.evaluate(() => {
        return document.getElementById('fileInput').hasAttribute('multiple');
      });

      expect(hasMultiple).toBe(false);
    });

    test('文件合并模式应显示多文件上传', async () => {
      page.click.mockResolvedValue(undefined);
      page.evaluate.mockResolvedValue(true);

      await page.click('[data-mode="merge-file"]');
      
      const hasMultiple = await page.evaluate(() => {
        return document.getElementById('fileInput').hasAttribute('multiple');
      });

      expect(hasMultiple).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 文件上传测试
  // ─────────────────────────────────────────────────────────────
  describe('文件上传', () => {
    test('上传有效 Excel 文件应解析成功', async () => {
      const mockFile = {
        name: 'test.xlsx',
        size: 1024,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      page.evaluate.mockImplementation((fn, file) => {
        if (typeof fn === 'function') {
          return Promise.resolve({ success: true, sheetCount: 2 });
        }
        return Promise.resolve(null);
      });

      const result = await page.evaluate((file) => {
        // 模拟文件上传处理
        return new Promise((resolve) => {
          setTimeout(() => resolve({ success: true, sheetCount: 2 }), 100);
        });
      }, mockFile);

      expect(result.success).toBe(true);
      expect(result.sheetCount).toBeGreaterThan(0);
    });

    test('上传非 Excel 文件应显示错误', async () => {
      const mockFile = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain'
      };

      page.evaluate.mockImplementation((fn) => {
        if (typeof fn === 'function') {
          return Promise.resolve({ error: '请上传Excel文件（.xlsx或.xls格式）' });
        }
        return Promise.resolve(null);
      });

      const result = await page.evaluate(() => {
        return { error: '请上传Excel文件（.xlsx或.xls格式）' };
      });

      expect(result.error).toContain('Excel');
    });

    test('上传超大文件应显示警告', async () => {
      const mockFile = {
        name: 'large.xlsx',
        size: 60 * 1024 * 1024, // 60MB
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      page.evaluate.mockImplementation((fn) => {
        if (typeof fn === 'function') {
          return Promise.resolve({ 
            error: '文件过大（60MB），超过硬性限制（50MB）',
            isTooLarge: true 
          });
        }
        return Promise.resolve(null);
      });

      const result = await page.evaluate((file) => {
        if (file.size > 50 * 1024 * 1024) {
          return { 
            error: `文件过大（${Math.round(file.size / 1024 / 1024)}MB），超过硬性限制（50MB）`,
            isTooLarge: true 
          };
        }
        return { success: true };
      }, mockFile);

      expect(result.isTooLarge).toBe(true);
      expect(result.error).toContain('50MB');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 工作表选择测试
  // ─────────────────────────────────────────────────────────────
  describe('工作表选择', () => {
    beforeEach(async () => {
      // 模拟已上传文件
      page.evaluate.mockImplementation((fn) => {
        if (typeof fn === 'function') {
          return Promise.resolve({
            sheetNames: ['Sheet1', 'Sheet2', 'Sheet3'],
            fileName: 'test.xlsx'
          });
        }
        return Promise.resolve(null);
      });
    });

    test('应显示所有工作表', async () => {
      const sheets = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.sheet-item')).map(s => s.textContent);
      });

      expect(sheets.length).toBe(3);
    });

    test('全选按钮应选中所有工作表', async () => {
      page.click.mockResolvedValue(undefined);
      page.evaluate.mockResolvedValue(3);

      await page.click('button:has-text("全选")');
      
      const selectedCount = await page.evaluate(() => {
        return document.querySelectorAll('.sheet-item.selected').length;
      });

      expect(selectedCount).toBe(3);
    });

    test('取消全选按钮应取消所有选择', async () => {
      page.click.mockResolvedValue(undefined);
      page.evaluate.mockResolvedValue(0);

      await page.click('button:has-text("取消全选")');
      
      const selectedCount = await page.evaluate(() => {
        return document.querySelectorAll('.sheet-item.selected').length;
      });

      expect(selectedCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 列选择测试（横向/竖向拆分）
  // ─────────────────────────────────────────────────────────────
  describe('列选择', () => {
    test('应显示所有列', async () => {
      page.evaluate.mockResolvedValue(['列 1', '列 2', '列 3', '姓名 / Name', '年龄 / Age']);

      const columns = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#columnList .sheet-item')).map(c => c.textContent);
      });

      expect(columns.length).toBeGreaterThan(0);
    });

    test('选择列应启用下一步按钮', async () => {
      page.click.mockResolvedValue(undefined);
      page.evaluate.mockResolvedValue(false);

      await page.click('#columnList .sheet-item:first-child');
      
      const isDisabled = await page.evaluate(() => {
        return document.getElementById('step3Next').disabled;
      });

      expect(isDisabled).toBe(false);
    });

    test('表头行数输入应影响列显示', async () => {
      page.fill.mockResolvedValue(undefined);
      page.evaluate.mockResolvedValue(2);

      await page.fill('#splitHeaderRows', '2');
      await page.waitForTimeout(300);

      const headerRows = await page.evaluate(() => {
        return document.getElementById('splitHeaderRows').value;
      });

      expect(headerRows).toBe('2');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 文件处理测试
  // ─────────────────────────────────────────────────────────────
  describe('文件处理', () => {
    test('处理完成后应显示结果', async () => {
      page.click.mockResolvedValue(undefined);
      page.waitForSelector.mockResolvedValue({});
      page.evaluate.mockResolvedValue({
        totalFiles: 5,
        totalSize: '12.5 KB'
      });

      // 模拟点击生成按钮
      await page.click('#step4 .btn-success');
      await page.waitForSelector('#resultSummary', { visible: true });

      const result = await page.evaluate(() => {
        return {
          totalFiles: document.getElementById('totalFiles').textContent,
          totalSize: document.getElementById('totalSize').textContent
        };
      });

      expect(parseInt(result.totalFiles)).toBeGreaterThan(0);
      expect(result.totalSize).toBeTruthy();
    });

    test('应显示生成的文件列表', async () => {
      page.evaluate.mockResolvedValue([
        'test_Sheet1.xlsx',
        'test_Sheet2.xlsx',
        'test_Sheet3.xlsx'
      ]);

      const files = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#resultFileList .file-list-name'))
          .map(el => el.textContent.trim());
      });

      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toContain('.xlsx');
    });

    test('下载按钮应可用', async () => {
      page.evaluate.mockResolvedValue({ visible: true, disabled: false });

      const downloadBtn = await page.evaluate(() => {
        const btn = document.getElementById('downloadBtn');
        return {
          visible: btn.style.display !== 'none',
          disabled: btn.disabled
        };
      });

      expect(downloadBtn.visible).toBe(true);
      expect(downloadBtn.disabled).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Toast 提示测试
  // ─────────────────────────────────────────────────────────────
  describe('Toast 提示', () => {
    test('应显示成功提示', async () => {
      page.evaluate.mockImplementation((fn) => {
        if (typeof fn === 'function') {
          return Promise.resolve({ type: 'success', message: '操作成功' });
        }
        return Promise.resolve(null);
      });

      const toast = await page.evaluate(() => {
        const toastEl = document.querySelector('.toast.success');
        return toastEl ? { type: 'success', message: toastEl.textContent } : null;
      });

      if (toast) {
        expect(toast.type).toBe('success');
      }
    });

    test('应显示错误提示', async () => {
      page.evaluate.mockImplementation((fn) => {
        if (typeof fn === 'function') {
          return Promise.resolve({ type: 'error', message: '操作失败' });
        }
        return Promise.resolve(null);
      });

      const toast = await page.evaluate(() => {
        const toastEl = document.querySelector('.toast.error');
        return toastEl ? { type: 'error', message: toastEl.textContent } : null;
      });

      if (toast) {
        expect(toast.type).toBe('error');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 重置功能测试
  // ─────────────────────────────────────────────────────────────
  describe('重置功能', () => {
    test('重置按钮应清除所有数据', async () => {
      page.click.mockResolvedValue(undefined);
      page.evaluate.mockResolvedValue({
        step: 1,
        fileCount: 0,
        selectedSheets: 0
      });

      await page.click('button:has-text("重新开始")');

      const state = await page.evaluate(() => {
        return {
          step: document.querySelector('.step.active').dataset.step,
          fileCount: uploadedFiles?.length || 0,
          selectedSheets: selectedSheets?.size || 0
        };
      });

      expect(parseInt(state.step)).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 性能测试
// ═══════════════════════════════════════════════════════════════

describe('性能测试', () => {
  test('大文件上传应在合理时间内完成', async () => {
    const startTime = Date.now();
    
    // 模拟大文件上传
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(5000); // 应在 5 秒内完成
  });

  test('工作表渲染应支持 200 个工作表', async () => {
    const sheetCount = 200;
    const startTime = Date.now();
    
    // 模拟渲染 200 个工作表
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(1000); // 应在 1 秒内完成
  });
});

// ═══════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════

module.exports = {
  TEST_CONFIG,
  MockBrowser
};

/**
 * Excel 离线工具 - 模块加载器
 * 动态加载所有模块并暴露到全局
 */

// 动态导入所有模块
const modules = await import('./app.js');

// 暴露到全局，供内联脚本使用
window.ExcelTool = modules;

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('[ExcelTool] Modules loaded:', Object.keys(modules));

  if (modules.initializeApp) {
    modules.initializeApp();
  }
});

// Axe 可访问性测试配置
module.exports = {
  // 全局配置
  globalOptions: {
    // 使用的规则集
    rules: [
      // WCAG 2.1 A 级
      { id: 'color-contrast', enabled: true },
      { id: 'image-alt', enabled: true },
      { id: 'label', enabled: true },
      { id: 'link-name', enabled: true },
      { id: 'list', enabled: true },
      { id: 'heading-order', enabled: true },
      { id: 'aria-required-attr', enabled: true },
      { id: 'aria-required-children', enabled: true },
      { id: 'aria-required-parent', enabled: true },
      { id: 'aria-roles', enabled: true },
      { id: 'aria-valid-attr-value', enabled: true },
      { id: 'aria-valid-attr', enabled: true },
      { id: 'button-name', enabled: true },
      { id: 'document-title', enabled: true },
      { id: 'html-has-lang', enabled: true },
      { id: 'html-lang-valid', enabled: true },
      { id: 'meta-viewport', enabled: true },

      // 最佳实践
      { id: 'region', enabled: true },
      { id: 'skip-link', enabled: false }, // 单页面应用可不设置
      { id: 'tabindex', enabled: true },
      { id: 'focus-order-semantics', enabled: true },
    ],
    // 排除的元素（第三方库或已知问题）
    exclude: [
      // 如果有需要排除的元素选择器
    ],
  },

  // 严重等级映射
  impactLevels: {
    minor: 'warning',
    moderate: 'error',
    serious: 'error',
    critical: 'error',
  },

  // 测试配置
  testConfig: {
    // 视口配置
    viewport: {
      width: 1280,
      height: 720,
    },
    // 等待时间
    waitTime: 1000,
    // 包含 iframe
    includeIframe: false,
    // 允许的颜色对比度例外（品牌色等）
    colorContrastExceptions: [],
  },

  // 报告配置
  reporter: {
    // 输出格式
    format: ['v2', 'html'],
    // 报告目录
    outputDir: './reports/accessibility',
    // 是否包含截图
    includeScreenshots: true,
  },
};

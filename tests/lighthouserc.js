// Lighthouse CI 配置
module.exports = {
  ci: {
    // 收集配置
    collect: {
      // 静态站点模式
      staticDistDir: '../',
      // 要测试的页面
      url: ['http://localhost:3000/excel.html'],
      // 运行次数（取平均值）
      numberOfRuns: 3,
      // 启动服务器
      startServerCommand: 'npx serve ../ -p 3000 -s',
      // 等待服务器启动
      startServerReadyPattern: 'Accepting connections',
      // 等待时间
      startServerReadyTimeout: 10000,
    },
    // 断言配置
    assert: {
      // 性能预算断言
      assertions: {
        // 性能类别分数
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // 核心 Web 指标
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'time-to-first-byte': ['warn', { maxNumericValue: 600 }],
        'interactive': ['error', { maxNumericValue: 3800 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

        // 资源大小预算
        'resource-summary:document:size': ['error', { maxNumericValue: 200000 }], // 200KB
        'resource-summary:script:size': ['error', { maxNumericValue: 500000 }], // 500KB
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 50000 }], // 50KB
        'resource-summary:image:size': ['error', { maxNumericValue: 100000 }], // 100KB
        'resource-summary:total:size': ['error', { maxNumericValue: 2000000 }], // 2MB

        // 请求数量预算
        'resource-summary:document:count': ['warn', { maxNumericValue: 1 }],
        'resource-summary:script:count': ['warn', { maxNumericValue: 5 }],
        'resource-summary:third-party:count': ['warn', { maxNumericValue: 2 }],
      },
    },
    // 上传配置
    upload: {
      target: 'filesystem',
      outputDir: './reports/lighthouse',
    },
  },
};

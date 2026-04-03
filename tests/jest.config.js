/**
 * Jest 配置文件
 */

module.exports = {
  // 测试环境
  testEnvironment: 'jsdom',
  
  // 文件扩展名
  moduleFileExtensions: ['js', 'json'],
  
  // 不使用转换（原生 ES 模块）
  transform: {},
  
  // 测试匹配模式
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  
  // 覆盖率收集
  collectCoverageFrom: [
    '../src/**/*.js',
    '!../src/**/*.test.js'
  ],
  
  // 覆盖率报告格式
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'json',
    'lcov'
  ],
  
  // 覆盖率输出目录
  coverageDirectory: './reports/coverage',
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // 测试超时
  testTimeout: 30000,
  
  // 设置文件
  setupFilesAfterEnv: ['./jest.setup.js'],
  
  // 模块名映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1'
  },
  
  // 忽略模式
  testPathIgnorePatterns: [
    '/node_modules/',
    '/reports/',
    '/fixtures/'
  ],
  
  // 详细输出
  verbose: true,
  
  // 测试前清理 mock
  clearMocks: true,
  
  // 重置 mock
  resetMocks: false,
  
  // 恢复 mock
  restoreMocks: false
};

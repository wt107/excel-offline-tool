/**
 * DOM 操作工具函数
 * Excel 离线工具 - UI 相关工具
 */

import { ERROR_MESSAGES } from '../core/constants.js';

/**
 * 转义 HTML 特殊字符，防止 XSS 攻击
 * @param {string} text - 原始文本
 * @returns {string} 转义后的 HTML
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 创建并显示 Toast 提示
 * @param {string} message - 提示消息
 * @param {string} [type='info'] - 类型: info, success, warning, error
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.warn('[Toast] Container not found');
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // 3秒后自动移除
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

/**
 * 显示加载遮罩层
 * @param {string} [text='处理中...'] - 提示文字
 */
export function showLoading(text) {
  const loading = document.getElementById('loading');
  const loadingText = document.getElementById('loadingText');
  const progressBarFill = document.getElementById('progressBarFill');

  if (loading) loading.style.display = 'flex';
  if (loadingText) loadingText.textContent = text || '处理中...';
  if (progressBarFill) progressBarFill.style.width = '0%';

  // 隐藏结果区域
  const resultSummary = document.getElementById('resultSummary');
  const fileListCard = document.getElementById('fileListCard');
  const downloadBtn = document.getElementById('downloadBtn');

  if (resultSummary) resultSummary.style.display = 'none';
  if (fileListCard) fileListCard.style.display = 'none';
  if (downloadBtn) downloadBtn.style.display = 'none';
}

/**
 * 隐藏加载遮罩层
 */
export function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'none';
  }
}

/**
 * 更新进度条
 * @param {number} percent - 百分比 (0-100)
 * @param {string} [text] - 可选的进度文字
 */
export function updateProgress(percent, text) {
  const progressBarFill = document.getElementById('progressBarFill');
  const loadingText = document.getElementById('loadingText');

  if (progressBarFill) {
    progressBarFill.style.width = Math.max(0, Math.min(100, percent)) + '%';
  }
  if (text && loadingText) {
    loadingText.textContent = text;
  }
}

/**
 * 节流函数 - 限制执行频率
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制 (ms)
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 防抖函数 - 延迟执行直到停止触发
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间 (ms)
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * 安全地获取元素
 * @param {string} id - 元素 ID
 * @returns {HTMLElement|null} 元素或 null
 */
export function getElement(id) {
  return document.getElementById(id);
}

/**
 * 批量添加事件监听
 * @param {HTMLElement} element - 目标元素
 * @param {Object} events - 事件映射 { eventName: handler }
 */
export function addEventListeners(element, events) {
  if (!element) return;
  Object.entries(events).forEach(([event, handler]) => {
    element.addEventListener(event, handler);
  });
}

/**
 * 切换元素的显示/隐藏
 * @param {HTMLElement|string} element - 元素或 ID
 * @param {boolean} show - 是否显示
 */
export function toggleElement(element, show) {
  const el = typeof element === 'string' ? document.getElementById(element) : element;
  if (el) {
    el.style.display = show ? '' : 'none';
  }
}

/**
 * 创建元素并设置属性
 * @param {string} tag - 标签名
 * @param {Object} [attributes={}] - 属性对象
 * @param {string} [textContent] - 文本内容
 * @returns {HTMLElement} 创建的元素
 */
export function createElement(tag, attributes = {}, textContent) {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  });
  if (textContent !== undefined) {
    element.textContent = textContent;
  }
  return element;
}

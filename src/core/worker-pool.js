/**
 * Web Worker Pool 管理器
 * 管理多个 Worker 实例，处理大文件避免阻塞 UI
 */

export class WorkerPool {
  /**
   * @param {string} scriptUrl - Worker 脚本路径
   * @param {number} [poolSize=2] - Worker 池大小
   */
  constructor(scriptUrl, poolSize = 2) {
    this.scriptUrl = scriptUrl;
    this.poolSize = poolSize;
    this.workers = [];
    this.queue = [];
    this.taskId = 0;
    this.pendingTasks = new Map();
    this.enabled = false;

    this.initialize();
  }

  /**
   * 初始化 Worker 池
   */
  initialize() {
    try {
      if (typeof Worker === 'undefined') {
        console.warn('[WorkerPool] Web Workers not supported');
        return;
      }

      for (let i = 0; i < this.poolSize; i++) {
        this.createWorker();
      }

      this.enabled = this.workers.length > 0;
      if (this.enabled) {
        console.log(`[WorkerPool] Initialized with ${this.workers.length} workers`);
      }
    } catch (e) {
      console.warn('[WorkerPool] Initialization failed:', e.message);
    }
  }

  /**
   * 创建单个 Worker
   * @returns {Worker|null} Worker 实例或 null
   */
  createWorker() {
    try {
      const worker = new Worker(this.scriptUrl);
      worker.busy = false;
      worker.id = this.workers.length;
      worker.onmessage = (e) => this.handleMessage(e, worker);
      worker.onerror = (e) => this.handleError(e, worker);
      this.workers.push(worker);
      return worker;
    } catch (e) {
      console.warn('[WorkerPool] Failed to create worker:', e.message);
      return null;
    }
  }

  /**
   * 处理 Worker 消息
   * @param {MessageEvent} e - 消息事件
   * @param {Worker} worker - Worker 实例
   */
  handleMessage(e, worker) {
    const { type, result, error, percent, text } = e.data;

    for (const [taskId, task] of this.pendingTasks) {
      if (task.worker === worker) {
        if (type === 'progress' && task.onProgress) {
          task.onProgress(percent, text);
        } else if (type === 'complete') {
          worker.busy = false;
          this.pendingTasks.delete(taskId);
          task.resolve({ result });
          this.processQueue();
        } else if (type === 'error') {
          worker.busy = false;
          this.pendingTasks.delete(taskId);
          task.reject(new Error(error));
          this.processQueue();
        }
        break;
      }
    }
  }

  /**
   * 处理 Worker 错误
   * @param {ErrorEvent} e - 错误事件
   * @param {Worker} worker - Worker 实例
   */
  handleError(e, worker) {
    console.error('[WorkerPool] Worker error:', e);
    worker.busy = false;
  }

  /**
   * 执行任务
   * @param {string} action - 动作名称
   * @param {Object} data - 动作数据
   * @param {Function} [onProgress] - 进度回调
   * @returns {Promise<{result: any}>} 执行结果
   */
  execute(action, data, onProgress) {
    return new Promise((resolve, reject) => {
      const taskId = ++this.taskId;
      this.pendingTasks.set(taskId, {
        resolve,
        reject,
        onProgress,
        worker: null
      });
      this.queue.push({ taskId, action, data });
      this.processQueue();
    });
  }

  /**
   * 处理任务队列
   */
  processQueue() {
    while (this.queue.length > 0) {
      const availableWorker = this.workers.find(w => !w.busy);
      if (!availableWorker) break;

      const { taskId, action, data } = this.queue.shift();
      const task = this.pendingTasks.get(taskId);
      if (task) {
        task.worker = availableWorker;
        availableWorker.busy = true;
        availableWorker.postMessage({ id: taskId, action, data });
      }
    }
  }

  /**
   * 检查是否可用
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * 终止所有 Worker
   */
  terminate() {
    this.workers.forEach(w => {
      try {
        w.terminate();
      } catch (e) {
        // Ignore
      }
    });
    this.workers = [];
    this.enabled = false;
  }
}

export default WorkerPool;

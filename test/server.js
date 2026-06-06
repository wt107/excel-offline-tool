/**
 * 轻量级静态文件服务器 - 专为 Playwright 测试提供 HTML 访问
 * 零依赖，仅使用 Node.js 内置模块
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3077;
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls':  'application/vnd.ms-excel',
  '.zip':  'application/zip',
};

const server = http.createServer((req, res) => {
  // 解码URL，处理中文文件名
  const decodedUrl = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT_DIR, decodedUrl === '/' ? 'excel.html' : decodedUrl);

  // 安全检查：防止路径穿越
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found: ' + decodedUrl);
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[Test Server] http://localhost:${PORT} - serving ${ROOT_DIR}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Test Server] Port ${PORT} already in use`);
    process.exit(1);
  }
});

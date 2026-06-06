@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   Excel工具 测试服务器
echo ========================================
echo.

REM 检查端口是否已被占用
netstat -ano | findstr ":3077" >nul 2>&1
if %errorlevel%==0 (
    echo [警告] 端口 3077 已被占用，可能服务器已在运行
    echo   如需重启，请先关闭占用端口的程序
    echo.
)

echo 正在启动Web服务器...
echo.

REM 使用PowerShell启动简易HTTP服务器
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$root = Resolve-Path '%~dp0..'; " ^
"Write-Host '[服务器] 根目录: ' $root; " ^
"Write-Host '[服务器] 启动中...'; " ^
"$listener = New-Object System.Net.HttpListener; " ^
"$listener.Prefixes.Add('http://localhost:3077/'); " ^
"try { $listener.Start() } catch { Write-Host '[错误] 端口3077已被占用或无法启动'; exit 1 }; " ^
"Write-Host ''; " ^
"Write-Host '========================================'; " ^
"Write-Host '  服务器已启动!'; " ^
"Write-Host '  访问地址:'; " ^
"Write-Host '    主程序: http://localhost:3077/excel.html'; " ^
"Write-Host '    单元测试: http://localhost:3077/test/run-tests.html'; " ^
"Write-Host '========================================'; " ^
"Write-Host ''; " ^
"Write-Host '按 Ctrl+C 停止服务器'; " ^
"Write-Host ''; " ^
"$mimes = @{'html'='text/html; charset=utf-8'; 'js'='application/javascript'; 'css'='text/css'; 'json'='application/json'; 'xlsx'='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; 'xls'='application/vnd.ms-excel'; 'zip'='application/zip'; 'png'='image/png'; 'svg'='image/svg+xml'; 'woff2'='font/woff2'; 'woff'='font/woff'; 'ttf'='font/ttf'}; " ^
"while ($listener.IsListening) { " ^
"  $ctx = $listener.GetContext(); " ^
"  $url = $ctx.Request.Url.AbsolutePath; " ^
"  if ($url -eq '/') { $url = '/excel.html' }; " ^
"  $filePath = Join-Path $root $url.TrimStart('/'); " ^
"  $filePath = [System.Uri]::UnescapeDataString($filePath); " ^
"  if ($filePath.StartsWith($root) -and (Test-Path $filePath)) { " ^
"    $ext = [System.IO.Path]::GetExtension($filePath).TrimStart('.').ToLower(); " ^
"    $ct = if ($mimes.ContainsKey($ext)) { $mimes[$ext] } else { 'application/octet-stream' }; " ^
"    $buf = [System.IO.File]::ReadAllBytes($filePath); " ^
"    $ctx.Response.ContentType = $ct; " ^
"    $ctx.Response.ContentLength64 = $buf.Length; " ^
"    $ctx.Response.AddHeader('Access-Control-Allow-Origin', '*'); " ^
"    $ctx.Response.OutputStream.Write($buf, 0, $buf.Length); " ^
"  } else { " ^
"    $ctx.Response.StatusCode = 404; " ^
"    $msg = [System.Text.Encoding]::UTF8.GetBytes('Not Found'); " ^
"    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length); " ^
"  }; " ^
"  $ctx.Response.Close(); " ^
"}"

pause

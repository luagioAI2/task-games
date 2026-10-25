/**
 * 极简静态服务器（零依赖）
 * ES Module 不能用 file:// 直接打开，必须走 http，所以双击 start.bat 会调它。
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".glb": "model/gltf-binary",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function serve(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404 Not Found: " + urlPath);
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Cache-Control": "no-cache" });
    fs.createReadStream(filePath).pipe(res);
  });
}

function start(port, attempt = 0) {
  const server = http.createServer(serve);
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && attempt < 20) {
      start(port + 1, attempt + 1);
    } else {
      console.error("启动失败:", err.message);
      process.exit(1);
    }
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}/index.html`;
    console.log("");
    console.log("  Prize Park 本地版已启动");
    console.log("  " + url);
    console.log("");
    console.log("  关闭这个窗口即可停止游戏。");
    console.log("");
    // 走查 / e2e 时不要弹浏览器窗口（`node server.js 4392 --no-open`）
    if (!process.argv.includes("--no-open")) {
      if (process.platform === "win32") exec(`start "" "${url}"`);
      else if (process.platform === "darwin") exec(`open "${url}"`);
    }
  });
}

/*
 * 端口优先级：命令行参数 → 环境变量 → 8080。
 *
 * ⚠️ 原来**只读 `process.env.PORT`**，而 README / 项目笔记里写的是
 * `node server.js 4395` —— 那个参数被静默忽略，服务器起在 8080。
 * 于是 e2e 连 4395 连不上，或者更糟：4395 上恰好是**别的项目**的服务，
 * 测试跑在别人的 App 上、报出一堆看不懂的错。
 */
start(Number(process.argv[2]) || Number(process.env.PORT) || 8080);

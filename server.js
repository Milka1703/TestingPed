const fs = require("fs");
const http = require("http");
const path = require("path");
const sendResult = require("./api/send-result");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

function loadLocalEnv() {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envPath)) return;

  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function enhanceServerlessResponse(res) {
  res.status = function (statusCode) {
    res.statusCode = statusCode;
    return res;
  };

  res.json = function (payload) {
    sendJson(res, res.statusCode || 200, payload);
  };

  return res;
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end("Method Not Allowed");
    return;
  }

  const requestedPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(ROOT_DIR, requestedPath);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, function (err, content) {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const cacheControl = ext === ".html"
      ? "no-cache"
      : "public, max-age=3600";
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": cacheControl
    });
    if (req.method === "HEAD") res.end();
    else res.end(content);
  });
}

loadLocalEnv();

const server = http.createServer(function (req, res) {
  const requestUrl = new URL(req.url, "http://" + req.headers.host);
  const pathname = decodeURIComponent(requestUrl.pathname);

  // Security headers for all responses
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' https://ip-api.com; " +
    "connect-src 'self' https://ip-api.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "frame-ancestors 'none'"
  );

  if (pathname === "/api/send-result") {
    sendResult(req, enhanceServerlessResponse(res));
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, function () {
  console.log("Testing app is running at http://localhost:" + PORT);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(signal + " received. Shutting down gracefully...");
  server.close(function () {
    console.log("Server closed.");
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(function () {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", function () { gracefulShutdown("SIGINT"); });
process.on("SIGTERM", function () { gracefulShutdown("SIGTERM"); });

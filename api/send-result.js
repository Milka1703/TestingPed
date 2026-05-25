const dns = require("dns");
const nodemailer = require("nodemailer");

// Rate limiting: 5 requests per minute per IP
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map();

function rateLimit(ip) {
  const now = Date.now();
  let record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, record);
  }
  record.count += 1;
  return record.count <= RATE_LIMIT_MAX;
}

// Periodic cleanup of stale entries every 5 minutes
setInterval(function () {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap) {
    if (now > record.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60000).unref();

const DEFAULT_RECIPIENT_EMAIL = "seregina_ld@itmoscow.pro";
const MAX_CSV_LENGTH = 2 * 1024 * 1024;
const DEFAULT_DNS_SERVERS = ["8.8.8.8", "1.1.1.1"];

function readRequestBody(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "string") {
    return Promise.resolve(JSON.parse(req.body));
  }

  return new Promise(function (resolve, reject) {
    let raw = "";

    req.on("data", function (chunk) {
      raw += chunk;
      if (raw.length > MAX_CSV_LENGTH) {
        reject(new Error("Payload is too large"));
        req.destroy();
      }
    });

    req.on("end", function () {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });

    req.on("error", reject);
  });
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const dnsServers = (process.env.SMTP_DNS_SERVERS || DEFAULT_DNS_SERVERS.join(","))
    .split(",")
    .map(function (server) { return server.trim(); })
    .filter(Boolean);

  if (!host || !user || !pass) {
    throw new Error("SMTP не настроен. Заполните SMTP_HOST, SMTP_USER и SMTP_PASS в файле .env");
  }

  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
  if (dnsServers.length) {
    dns.setServers(dnsServers);
  }

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 20000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 20000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30000),
    dnsTimeout: Number(process.env.SMTP_DNS_TIMEOUT || 20000),
    auth: {
      user: user,
      pass: pass
    }
  });
}

function mapSmtpError(err) {
  const message = String(err && err.message ? err.message : err);
  if (message.includes("SMTP settings are not configured") || message.includes("SMTP не настроен")) {
    return message;
  }
  if (message.includes("Application-specific password required") || message.includes("Invalid login")) {
    return "Ошибка входа в SMTP. Для Gmail нужен пароль приложения. Для @itmoscow.pro укажите SMTP вашей почты от IT-отдела.";
  }
  if (message.includes("queryA ETIMEOUT") || message.includes("queryTxt ETIMEOUT") || message.includes("ETIMEOUT")) {
    return "DNS/сеть не смогли найти SMTP-сервер. Проверьте интернет-доступ сервера, SMTP_HOST в .env и при необходимости задайте SMTP_DNS_SERVERS=8.8.8.8,1.1.1.1";
  }
  if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
    return "Не удалось подключиться к SMTP-серверу. Проверьте SMTP_HOST и SMTP_PORT в .env";
  }
  return "Не удалось отправить письмо: " + message;
}

function sanitizeFilename(value) {
  return String(value || "test-result.csv").replace(/[\\/:*?"<>|]+/g, "_");
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Rate limiting check
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || "unknown";

  if (!rateLimit(clientIp)) {
    res.status(429).json({ error: "Слишком много запросов. Пожалуйста, повторите через минуту." });
    return;
  }

  try {
    const body = await readRequestBody(req);
    const csvContent = String(body.csvContent || "");
    const filename = sanitizeFilename(body.filename);
    const recipient = process.env.RESULT_RECIPIENT_EMAIL || DEFAULT_RECIPIENT_EMAIL;

    // Validate required fields
    const requiredFields = ["csvContent", "testType", "participantFullName"];
    const missing = requiredFields.filter(function (field) { return !body[field]; });
    if (missing.length) {
      res.status(400).json({ error: "Missing required fields: " + missing.join(", ") });
      return;
    }

    // Validate field lengths to prevent abuse
    if (String(body.participantFullName).length > 200) {
      res.status(400).json({ error: "participantFullName exceeds maximum length of 200 characters" });
      return;
    }
    if (String(body.testType).length > 100) {
      res.status(400).json({ error: "testType exceeds maximum length of 100 characters" });
      return;
    }

    if (!csvContent) {
      res.status(400).json({ error: "csvContent is required" });
      return;
    }

    if (csvContent.length > MAX_CSV_LENGTH) {
      res.status(413).json({ error: "CSV file is too large" });
      return;
    }

    const transporter = getTransporter();
    const testTitle = body.testTitle || body.testType || "Результат тестирования";
    const participantFullName = body.participantFullName || "Участник";
    const scorePercent = body.scorePercent === undefined ? "" : String(body.scorePercent);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      subject: "Результат тестирования: " + participantFullName,
      text: [
        "Получен результат тестирования.",
        "",
        "Участник: " + participantFullName,
        "Тест: " + testTitle,
        scorePercent ? "Общий результат: " + scorePercent + "%" : "",
        "",
        "CSV-файл приложен к письму."
      ].filter(Boolean).join("\n"),
      attachments: [
        {
          filename: filename,
          content: Buffer.from("\uFEFF" + csvContent, "utf8"),
          contentType: "text/csv; charset=utf-8"
        }
      ]
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: mapSmtpError(err) });
  }
};

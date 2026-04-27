const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const MAX_TEXT_LENGTH = 8000;
const MAX_BODY_BYTES = 128 * 1024;
const CODEX_TIMEOUT_MS = 60_000;
const CODEX_STATUS_TIMEOUT_MS = 10_000;
const CODEX_MODEL = process.env.CODEX_MODEL || "gpt-5.4";

const PUBLIC_DIR = path.join(__dirname, "public");

function getCodexCommandName(platform = process.platform, env = process.env) {
  if (env.CODEX_BIN) {
    return env.CODEX_BIN;
  }

  return platform === "win32" ? "codex.cmd" : "codex";
}

function buildCodexInvocation(codexArgs, options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const codexCommand = getCodexCommandName(platform, env);

  if (platform === "win32" && !env.CODEX_BIN) {
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", codexCommand, ...codexArgs],
      codexCommand
    };
  }

  return {
    command: codexCommand,
    args: codexArgs,
    codexCommand
  };
}

function runCodex(codexArgs, options = {}) {
  const timeoutMs = options.timeoutMs || CODEX_TIMEOUT_MS;
  const invocation = buildCodexInvocation(codexArgs, options);

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd || __dirname,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let didTimeout = false;

    const timer = setTimeout(() => {
      didTimeout = true;
      child.kill();
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(Object.assign(error, { stdout, stderr, codexCommand: invocation.codexCommand }));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout,
        stderr,
        didTimeout,
        codexCommand: invocation.codexCommand
      });
    });

    if (options.input) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

function detectLanguages(text) {
  const hasKorean = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(text);

  if (hasKorean) {
    return {
      sourceLanguage: "Korean",
      targetLanguage: "English",
      directionLabel: "한국어 -> 영어"
    };
  }

  return {
    sourceLanguage: "English",
    targetLanguage: "Korean",
    directionLabel: "영어 -> 한국어"
  };
}

function validateText(value) {
  if (typeof value !== "string") {
    return { ok: false, message: "text must be a string." };
  }

  const text = value.trim();

  if (!text) {
    return { ok: false, message: "번역할 이메일 내용을 입력해 주세요." };
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      message: `입력은 최대 ${MAX_TEXT_LENGTH.toLocaleString("en-US")}자까지 가능합니다.`
    };
  }

  return { ok: true, text };
}

function validateRequestText(value, label = "처리할 이메일 내용을 입력해 주세요.") {
  const validation = validateText(value);

  if (!validation.ok && validation.message === "번역할 이메일 내용을 입력해 주세요.") {
    return { ok: false, message: label };
  }

  return validation;
}

function buildTranslationPrompt(text) {
  const { sourceLanguage, targetLanguage } = detectLanguages(text);

  return [
    "You are a professional business email translator.",
    `Translate the following ${sourceLanguage} business email into ${targetLanguage}.`,
    "",
    "Rules:",
    "- Produce a polite, natural business email translation.",
    "- Preserve names, company names, product names, numbers, dates, email addresses, and URLs.",
    "- Preserve the original subject line, greeting, paragraph breaks, and signature layout when possible.",
    "- Do not add explanations, alternatives, comments, markdown fences, or labels.",
    "- Output only the translated email text.",
    "",
    "Korean reference requirements:",
    "- This is for 비즈니스 이메일 translation.",
    "- 번역문만 출력.",
    "",
    "Email to translate:",
    text
  ].join("\n");
}

function buildPolishPrompt(text) {
  return [
    "You are a professional business English editor.",
    "Rewrite the following English business email so it sounds natural, polished, and appropriate for professional business communication.",
    "",
    "Rules:",
    "- Preserve the original meaning, facts, names, company names, product names, numbers, dates, email addresses, and URLs.",
    "- Improve grammar, clarity, tone, flow, and word choice.",
    "- Keep the message polite, concise, and natural for business email.",
    "- Preserve the original subject line, greeting, paragraph breaks, and signature layout when possible.",
    "- Do not make the email unnecessarily longer.",
    "- Do not add explanations, change summaries, comments, markdown fences, or labels.",
    "- Output only the improved email text.",
    "",
    "Korean reference requirements:",
    "- 이미 작성한 영어 메일을 더 자연스럽고 비즈니스에 어울리는 영어 표현으로 다듬기.",
    "- 결과 이메일만 출력.",
    "",
    "Email to improve:",
    text
  ].join("\n");
}

function normalizeCodexOutput(stdout) {
  return stdout
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith("WARNING: proceeding, even though we could not update PATH:"))
    .join("\n")
    .trim();
}

function parseLoginStatus(stdout, stderr, error) {
  const details = [stdout, stderr, error && error.message].filter(Boolean).join("\n").trim();

  if (/Logged in using\s+(.+)/i.test(details)) {
    const provider = details.match(/Logged in using\s+(.+)/i)[1].trim();

    return {
      loggedIn: true,
      provider,
      message: `Codex Auth 연결됨 (${provider})`
    };
  }

  if (/not logged in|not authenticated|login required|no auth|unauthorized|sign in/i.test(details)) {
    return {
      loggedIn: false,
      provider: null,
      message: "Codex 로그인이 필요합니다."
    };
  }

  if (/not recognized|ENOENT|cannot find|command not found/i.test(details)) {
    return {
      loggedIn: false,
      provider: null,
      message: "Codex CLI를 찾을 수 없습니다."
    };
  }

  return {
    loggedIn: false,
    provider: null,
    message: details || "Codex 로그인 상태를 확인할 수 없습니다."
  };
}

function loginInstruction(platform = process.platform, codexCommand = getCodexCommandName(platform)) {
  if (platform === "win32") {
    return `터미널에서 \`${codexCommand} login\`을 실행해 주세요. PowerShell 실행 정책 오류가 나면 \`codex.cmd login\`을 사용하세요.`;
  }

  return `터미널에서 \`${codexCommand} login\`을 실행해 주세요.`;
}

async function getCodexAuthStatus(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const codexCommand = getCodexCommandName(platform, env);

  try {
    const result = await runCodex(["login", "status"], {
      ...options,
      platform,
      env,
      timeoutMs: options.timeoutMs || CODEX_STATUS_TIMEOUT_MS
    });
    const parsed = parseLoginStatus(result.stdout, result.stderr);

    return {
      ...parsed,
      platform,
      codexCommand,
      instruction: parsed.loggedIn ? "" : loginInstruction(platform, codexCommand)
    };
  } catch (error) {
    const parsed = parseLoginStatus(error.stdout, error.stderr, error);

    return {
      ...parsed,
      platform,
      codexCommand,
      instruction: loginInstruction(platform, codexCommand)
    };
  }
}

function friendlyCodexError(stderr, error) {
  const details = [stderr, error && error.message].filter(Boolean).join("\n").trim();

  if (/login|auth|credential|not authenticated|unauthorized|sign in/i.test(details)) {
    return `${parseLoginStatus("", stderr, error).message} ${loginInstruction()}`;
  }

  if (/not recognized|ENOENT|cannot find/i.test(details)) {
    return "Codex CLI를 찾을 수 없습니다. `codex.cmd --help`가 실행되는지 확인해 주세요.";
  }

  if (/requires a newer version of Codex|Unknown model|invalid_request_error/i.test(details)) {
    return `Codex CLI 모델 실행에 실패했습니다. 현재 앱은 ${CODEX_MODEL} 모델을 사용하도록 설정되어 있습니다. Codex CLI 업데이트 또는 CODEX_MODEL 환경 변수를 확인해 주세요.`;
  }

  return details || "Codex CLI 번역 실행 중 오류가 발생했습니다.";
}

function runCodexPrompt(prompt, outputPrefix, timeoutMessage, emptyMessage) {
  const outputPath = path.join(
    os.tmpdir(),
    `codex-${outputPrefix}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
  );
  const codexArgs = [
    "-a",
    "never",
    "-m",
    CODEX_MODEL,
    "exec",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--output-last-message",
    outputPath,
    "--color",
    "never",
    "-"
  ];

  return runCodex(codexArgs, { input: prompt }).then((result) => {
    if (result.didTimeout) {
      throw new Error(timeoutMessage);
    }

    if (result.code !== 0) {
      throw new Error(friendlyCodexError(result.stderr));
    }

    let translation = "";

    try {
      translation = fs.readFileSync(outputPath, "utf8").trim();
    } catch {
      translation = normalizeCodexOutput(result.stdout);
    } finally {
      fs.rm(outputPath, { force: true }, () => {});
    }

    if (!translation) {
      throw new Error(emptyMessage);
    }

    return translation;
  }).catch((error) => {
    fs.rm(outputPath, { force: true }, () => {});

    if (error.message && /요청 시간이|Codex CLI|Codex 로그인|Codex Auth/u.test(error.message)) {
      throw error;
    }

    throw new Error(friendlyCodexError(error.stderr, error));
  });
}

function translateWithCodex(text) {
  return runCodexPrompt(
    buildTranslationPrompt(text),
    "translation",
    "번역 요청 시간이 초과되었습니다. 입력을 줄이거나 잠시 후 다시 시도해 주세요.",
    "Codex CLI가 빈 번역 결과를 반환했습니다."
  );
}

function polishWithCodex(text) {
  return runCodexPrompt(
    buildPolishPrompt(text),
    "polish",
    "다듬기 요청 시간이 초과되었습니다. 입력을 줄이거나 잠시 후 다시 시도해 주세요.",
    "Codex CLI가 빈 다듬기 결과를 반환했습니다."
  );
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;

    request.setEncoding("utf8");

    request.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk);

      if (bytes > MAX_BODY_BYTES) {
        reject(new Error("요청 본문이 너무 큽니다."));
        request.destroy();
        return;
      }

      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("JSON 형식이 올바르지 않습니다."));
      }
    });

    request.on("error", reject);
  });
}

function contentTypeFor(filePath) {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${HOST}:${PORT}`);
  const urlPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const decodedPath = decodeURIComponent(urlPath);
  const filePath = path.normalize(path.join(PUBLIC_DIR, decodedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": "no-store"
    });
    response.end(data);
  });
}

function createServer() {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${HOST}:${PORT}`);

    if (request.method === "GET" && requestUrl.pathname === "/api/detect") {
      const text = requestUrl.searchParams.get("text") || "";
      sendJson(response, 200, detectLanguages(text));
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/auth/status") {
      const status = await getCodexAuthStatus();
      sendJson(response, 200, status);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/translate") {
      try {
        const authStatus = await getCodexAuthStatus();

        if (!authStatus.loggedIn) {
          sendJson(response, 401, { error: `${authStatus.message} ${authStatus.instruction}`, auth: authStatus });
          return;
        }

        const payload = await readJsonBody(request);
        const validation = validateRequestText(payload.text, "번역할 이메일 내용을 입력해 주세요.");

        if (!validation.ok) {
          sendJson(response, 400, { error: validation.message });
          return;
        }

        const languages = detectLanguages(validation.text);
        const translation = await translateWithCodex(validation.text);

        sendJson(response, 200, {
          sourceLanguage: languages.sourceLanguage,
          targetLanguage: languages.targetLanguage,
          translation
        });
      } catch (error) {
        const message = error && error.message ? error.message : "번역 처리 중 오류가 발생했습니다.";
        const status = /JSON|본문|입력|최대|text must/u.test(message) ? 400 : 500;
        sendJson(response, status, { error: message });
      }
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/polish") {
      try {
        const authStatus = await getCodexAuthStatus();

        if (!authStatus.loggedIn) {
          sendJson(response, 401, { error: `${authStatus.message} ${authStatus.instruction}`, auth: authStatus });
          return;
        }

        const payload = await readJsonBody(request);
        const validation = validateRequestText(payload.text, "다듬을 영문 이메일 내용을 입력해 주세요.");

        if (!validation.ok) {
          sendJson(response, 400, { error: validation.message });
          return;
        }

        const result = await polishWithCodex(validation.text);

        sendJson(response, 200, { result });
      } catch (error) {
        const message = error && error.message ? error.message : "영문 다듬기 처리 중 오류가 발생했습니다.";
        const status = /JSON|본문|입력|최대|text must/u.test(message) ? 400 : 500;
        sendJson(response, status, { error: message });
      }
      return;
    }

    if (request.method === "GET") {
      serveStatic(request, response);
      return;
    }

    response.writeHead(405, { "Allow": "GET, POST" });
    response.end("Method not allowed");
  });
}

if (require.main === module) {
  const server = createServer();

  server.listen(PORT, HOST, () => {
    console.log(`Local business email translator: http://${HOST}:${PORT}`);
    console.log("Use codex.cmd login first if Codex is not authenticated.");
  });
}

module.exports = {
  MAX_TEXT_LENGTH,
  buildCodexInvocation,
  buildPolishPrompt,
  buildTranslationPrompt,
  createServer,
  detectLanguages,
  getCodexAuthStatus,
  getCodexCommandName,
  loginInstruction,
  normalizeCodexOutput,
  parseLoginStatus,
  polishWithCodex,
  translateWithCodex,
  validateRequestText,
  validateText
};

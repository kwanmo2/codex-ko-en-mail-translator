const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MAX_TEXT_LENGTH,
  buildCodexInvocation,
  buildPolishPrompt,
  buildTranslationPrompt,
  detectLanguages,
  getCodexCommandName,
  loginInstruction,
  normalizeCodexOutput,
  parseLoginStatus,
  validateText
} = require("../server");

test("builds Windows Codex invocation through cmd when CODEX_BIN is not set", () => {
  const invocation = buildCodexInvocation(["login", "status"], {
    platform: "win32",
    env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" }
  });

  assert.equal(invocation.command, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(invocation.args, ["/d", "/s", "/c", "codex.cmd", "login", "status"]);
  assert.equal(invocation.codexCommand, "codex.cmd");
});

test("builds POSIX Codex invocation directly", () => {
  const invocation = buildCodexInvocation(["login", "status"], {
    platform: "linux",
    env: {}
  });

  assert.equal(invocation.command, "codex");
  assert.deepEqual(invocation.args, ["login", "status"]);
  assert.equal(invocation.codexCommand, "codex");
});

test("uses CODEX_BIN override on every platform", () => {
  const invocation = buildCodexInvocation(["login", "status"], {
    platform: "win32",
    env: { CODEX_BIN: "C:\\Tools\\codex.exe", ComSpec: "cmd.exe" }
  });

  assert.equal(getCodexCommandName("win32", { CODEX_BIN: "C:\\Tools\\codex.exe" }), "C:\\Tools\\codex.exe");
  assert.equal(invocation.command, "C:\\Tools\\codex.exe");
  assert.deepEqual(invocation.args, ["login", "status"]);
});

test("parses logged-in Codex status", () => {
  assert.deepEqual(parseLoginStatus("Logged in using ChatGPT", ""), {
    loggedIn: true,
    provider: "ChatGPT",
    message: "Codex Auth 연결됨 (ChatGPT)"
  });
});

test("parses missing login status", () => {
  const result = parseLoginStatus("", "not authenticated");

  assert.equal(result.loggedIn, false);
  assert.equal(result.provider, null);
  assert.match(result.message, /로그인/u);
});

test("parses missing CLI status", () => {
  const result = parseLoginStatus("", "", new Error("spawn codex ENOENT"));

  assert.equal(result.loggedIn, false);
  assert.equal(result.provider, null);
  assert.match(result.message, /CLI/u);
});

test("shows OS-specific login instructions", () => {
  assert.match(loginInstruction("win32", "codex.cmd"), /codex\.cmd login/u);
  assert.match(loginInstruction("linux", "codex"), /codex login/u);
});

test("detects Korean input and targets English", () => {
  assert.deepEqual(detectLanguages("안녕하세요. 견적서를 보내드립니다."), {
    sourceLanguage: "Korean",
    targetLanguage: "English",
    directionLabel: "한국어 -> 영어"
  });
});

test("detects English input and targets Korean", () => {
  assert.deepEqual(detectLanguages("Dear Sarah, please find the attached quote."), {
    sourceLanguage: "English",
    targetLanguage: "Korean",
    directionLabel: "영어 -> 한국어"
  });
});

test("rejects empty input", () => {
  const result = validateText("   ");

  assert.equal(result.ok, false);
  assert.match(result.message, /입력/u);
});

test("rejects input over the configured length", () => {
  const result = validateText("a".repeat(MAX_TEXT_LENGTH + 1));

  assert.equal(result.ok, false);
  assert.match(result.message, /최대/u);
});

test("builds a business email prompt with output and preservation rules", () => {
  const prompt = buildTranslationPrompt("안녕하세요.\n홍길동 드림");

  assert.match(prompt, /business email translator/i);
  assert.match(prompt, /비즈니스 이메일/u);
  assert.match(prompt, /번역문만 출력/u);
  assert.match(prompt, /Preserve names, company names, product names, numbers, dates, email addresses, and URLs/u);
  assert.match(prompt, /Output only the translated email text/u);
});

test("builds a business English polish prompt with output and preservation rules", () => {
  const prompt = buildPolishPrompt("Dear Marin,\nPlease check price.\nBest,");

  assert.match(prompt, /business English editor/i);
  assert.match(prompt, /natural, polished, and appropriate for professional business communication/u);
  assert.match(prompt, /Preserve the original meaning, facts, names, company names, product names, numbers, dates, email addresses, and URLs/u);
  assert.match(prompt, /Do not make the email unnecessarily longer/u);
  assert.match(prompt, /Output only the improved email text/u);
  assert.match(prompt, /영어 메일을 더 자연스럽고 비즈니스에 어울리는 영어 표현/u);
});

test("removes known Codex path warning noise from output", () => {
  const output = normalizeCodexOutput("Hello\nWARNING: proceeding, even though we could not update PATH: denied\nWorld");

  assert.equal(output, "Hello\nWorld");
});

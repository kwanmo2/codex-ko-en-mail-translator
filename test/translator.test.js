const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AUTH_STATUS_CACHE_MS,
  MAX_TEXT_LENGTH,
  buildCodexInvocation,
  buildComposePrompt,
  buildPolishPrompt,
  buildTranslationPrompt,
  clearAuthStatusCache,
  detectLanguages,
  formatPhraseRules,
  getCodexAuthStatus,
  getCodexCommandName,
  loginInstruction,
  normalizeCodexOutput,
  parseLoginStatus,
  toneInstructionFor,
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

test("caches successful Codex auth status within the TTL", async () => {
  clearAuthStatusCache();
  let calls = 0;
  const runCodexImpl = async () => {
    calls += 1;
    return { stdout: "Logged in using ChatGPT", stderr: "" };
  };

  const first = await getCodexAuthStatus({
    env: {},
    platform: "linux",
    now: 1_000,
    runCodexImpl
  });
  const second = await getCodexAuthStatus({
    env: {},
    platform: "linux",
    now: 1_000 + AUTH_STATUS_CACHE_MS - 1,
    runCodexImpl
  });

  assert.equal(first.loggedIn, true);
  assert.equal(second.loggedIn, true);
  assert.equal(calls, 1);
  clearAuthStatusCache();
});

test("refreshes Codex auth status after cache TTL expires", async () => {
  clearAuthStatusCache();
  let calls = 0;
  const runCodexImpl = async () => {
    calls += 1;
    return { stdout: "Logged in using ChatGPT", stderr: "" };
  };

  await getCodexAuthStatus({
    env: {},
    platform: "linux",
    now: 1_000,
    runCodexImpl
  });
  await getCodexAuthStatus({
    env: {},
    platform: "linux",
    now: 1_000 + AUTH_STATUS_CACHE_MS + 1,
    runCodexImpl
  });

  assert.equal(calls, 2);
  clearAuthStatusCache();
});

test("does not cache failed Codex auth status", async () => {
  clearAuthStatusCache();
  let calls = 0;
  const runCodexImpl = async () => {
    calls += 1;
    return { stdout: "", stderr: "not authenticated" };
  };

  const first = await getCodexAuthStatus({
    env: {},
    platform: "linux",
    now: 1_000,
    runCodexImpl
  });
  const second = await getCodexAuthStatus({
    env: {},
    platform: "linux",
    now: 1_001,
    runCodexImpl
  });

  assert.equal(first.loggedIn, false);
  assert.equal(second.loggedIn, false);
  assert.equal(calls, 2);
  clearAuthStatusCache();
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

test("detects Korean by full-content character share even when text starts in English", () => {
  assert.deepEqual(detectLanguages("Hello Sarah, 안녕하세요 견적서를 보내드립니다 감사합니다"), {
    sourceLanguage: "Korean",
    targetLanguage: "English",
    directionLabel: "한국어 -> 영어"
  });
});

test("detects English by full-content character share even when text starts in Korean", () => {
  assert.deepEqual(detectLanguages("안녕 Dear Sarah, please find the attached quote and delivery schedule."), {
    sourceLanguage: "English",
    targetLanguage: "Korean",
    directionLabel: "영어 -> 한국어"
  });
});

test("ignores numbers and punctuation when detecting mixed-language input", () => {
  assert.deepEqual(detectLanguages("12345 !!! ??? 가나다라마 abc"), {
    sourceLanguage: "Korean",
    targetLanguage: "English",
    directionLabel: "한국어 -> 영어"
  });
});

test("defaults to English input when language character counts tie or are absent", () => {
  assert.deepEqual(detectLanguages("가나ab 1234 !!!"), {
    sourceLanguage: "English",
    targetLanguage: "Korean",
    directionLabel: "영어 -> 한국어"
  });

  assert.deepEqual(detectLanguages("1234 !!! @@@"), {
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
  const prompt = buildTranslationPrompt("안녕하세요.\n홍길동 드림", {
    tone: "concise",
    phraseRules: [{ avoid: "ASAP", prefer: "at your earliest convenience" }]
  });

  assert.match(prompt, /business email translator/i);
  assert.match(prompt, /비즈니스 이메일/u);
  assert.match(prompt, /번역문만 출력/u);
  assert.match(prompt, /Make the wording concise/u);
  assert.match(prompt, /Avoid: ASAP \| Prefer: at your earliest convenience/u);
  assert.match(prompt, /Preserve names, company names, product names, numbers, dates, email addresses, and URLs/u);
  assert.match(prompt, /Output only the translated email text/u);
});

test("builds a business English polish prompt with output and preservation rules", () => {
  const prompt = buildPolishPrompt("Dear Marin,\nPlease check price.\nBest,", {
    tone: "friendly"
  });

  assert.match(prompt, /business English editor/i);
  assert.match(prompt, /natural, polished, and appropriate for professional business communication/u);
  assert.match(prompt, /warm, approachable business tone/u);
  assert.match(prompt, /Preserve the original meaning, facts, names, company names, product names, numbers, dates, email addresses, and URLs/u);
  assert.match(prompt, /Do not make the email unnecessarily longer/u);
  assert.match(prompt, /Output only the improved email text/u);
  assert.match(prompt, /영어 메일을 더 자연스럽고 비즈니스에 어울리는 영어 표현/u);
});

test("builds a business email compose prompt from notes", () => {
  const prompt = buildComposePrompt("- ask Marin for cable length\n- request price", {
    tone: "followup"
  });

  assert.match(prompt, /professional business email writer/i);
  assert.match(prompt, /notes, bullet points, or rough message/u);
  assert.match(prompt, /courteous follow-up tone/u);
  assert.match(prompt, /Do not invent facts/u);
  assert.match(prompt, /완성된 이메일만 출력/u);
});

test("maps tone instructions and formats phrase rules", () => {
  assert.match(toneInstructionFor("firm"), /clear, firm business tone/u);
  assert.match(toneInstructionFor("unknown"), /polite, professional/u);

  const formatted = formatPhraseRules([
    { avoid: "ASAP", prefer: "at your earliest convenience" },
    { avoid: "", prefer: "" }
  ]);

  assert.equal(formatted, "1. Avoid: ASAP | Prefer: at your earliest convenience");
  assert.equal(formatPhraseRules([]), "No custom phrase preferences were provided.");
});

test("removes known Codex path warning noise from output", () => {
  const output = normalizeCodexOutput("Hello\nWARNING: proceeding, even though we could not update PATH: denied\nWorld");

  assert.equal(output, "Hello\nWorld");
});

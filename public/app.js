const inputText = document.querySelector("#inputText");
const direction = document.querySelector("#direction");
const submitButton = document.querySelector("#submitButton");
const copyButton = document.querySelector("#copyButton");
const result = document.querySelector("#result");
const charCount = document.querySelector("#charCount");
const statusText = document.querySelector("#statusText");
const authStatus = document.querySelector("#authStatus");
const inputLabel = document.querySelector("#inputLabel");
const resultLabel = document.querySelector("#resultLabel");
const translateTab = document.querySelector("#translateTab");
const polishTab = document.querySelector("#polishTab");
const composeTab = document.querySelector("#composeTab");
const toneSelect = document.querySelector("#toneSelect");
const phraseToggle = document.querySelector("#phraseToggle");
const historyToggle = document.querySelector("#historyToggle");
const phraseDrawer = document.querySelector("#phraseDrawer");
const historyDrawer = document.querySelector("#historyDrawer");
const phraseRules = document.querySelector("#phraseRules");
const addPhraseRule = document.querySelector("#addPhraseRule");
const historyList = document.querySelector("#historyList");
const clearHistory = document.querySelector("#clearHistory");
const diffPanel = document.querySelector("#diffPanel");
const diffOriginal = document.querySelector("#diffOriginal");
const diffResult = document.querySelector("#diffResult");

const MAX_TEXT_LENGTH = 8000;
const HISTORY_LIMIT = 20;
const PHRASE_KEY = "businessEmailTool.phraseRules";
const HISTORY_KEY = "businessEmailTool.history";

const MODES = {
  translate: {
    inputLabel: "입력 이메일",
    resultLabel: "번역 결과",
    buttonLabel: "번역",
    placeholder: "번역할 영어 또는 한국어 비즈니스 이메일을 입력하세요.",
    workingStatus: "번역 중...",
    emptyMessage: "번역할 이메일 내용을 입력해 주세요.",
    endpoint: "/api/translate",
    direction: (text) => detectDirection(text)
  },
  polish: {
    inputLabel: "영문 이메일",
    resultLabel: "다듬은 결과",
    buttonLabel: "다듬기",
    placeholder: "더 자연스럽고 비즈니스에 어울리게 다듬을 영어 이메일을 입력하세요.",
    workingStatus: "영문 다듬기 중...",
    emptyMessage: "다듬을 영문 이메일 내용을 입력해 주세요.",
    endpoint: "/api/polish",
    direction: () => "영문 다듬기"
  },
  compose: {
    inputLabel: "이메일 요점",
    resultLabel: "작성 결과",
    buttonLabel: "작성",
    placeholder: "작성할 영어 비즈니스 이메일의 요점, 메모, bullet을 입력하세요.",
    workingStatus: "이메일 작성 중...",
    emptyMessage: "작성할 이메일의 요점을 입력해 주세요.",
    endpoint: "/api/compose",
    direction: () => "이메일 작성"
  }
};

let currentMode = "translate";

function detectDirection(text) {
  const koreanCount = (text.match(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/gu) || []).length;
  const englishCount = (text.match(/[A-Za-z]/g) || []).length;

  return koreanCount > englishCount
    ? "한국어 -> 영어"
    : "영어 -> 한국어";
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
}

function setAuthStatus(payload) {
  authStatus.classList.remove("pending", "connected", "disconnected");

  if (payload.loggedIn) {
    authStatus.textContent = payload.message || "Codex Auth 연결됨";
    authStatus.classList.add("connected");
    return;
  }

  const instruction = payload.instruction ? ` ${payload.instruction}` : "";
  authStatus.textContent = `${payload.message || "Codex 로그인이 필요합니다."}${instruction}`;
  authStatus.classList.add("disconnected");
}

async function refreshAuthStatus() {
  try {
    const response = await fetch("/api/auth/status", {
      headers: {
        "Accept": "application/json"
      }
    });
    const payload = await response.json();

    setAuthStatus(payload);
    return payload;
  } catch {
    const payload = {
      loggedIn: false,
      message: "Codex Auth 상태를 확인할 수 없습니다.",
      instruction: "서버가 실행 중인지 확인해 주세요."
    };

    setAuthStatus(payload);
    return payload;
  }
}

function getPhraseRules() {
  return readJson(PHRASE_KEY, []);
}

function setPhraseRules(rules) {
  writeJson(PHRASE_KEY, rules);
  renderPhraseRules();
}

function renderPhraseRules() {
  const rules = getPhraseRules();
  phraseRules.innerHTML = "";

  if (rules.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-meta";
    empty.textContent = "예: ASAP -> at your earliest convenience";
    phraseRules.appendChild(empty);
  }

  rules.forEach((rule, index) => {
    const row = document.createElement("div");
    row.className = "phrase-row";

    const avoid = document.createElement("input");
    avoid.className = "phrase-input";
    avoid.placeholder = "피할 표현";
    avoid.value = rule.avoid || "";
    avoid.addEventListener("input", () => updatePhraseRule(index, { avoid: avoid.value }));

    const prefer = document.createElement("input");
    prefer.className = "phrase-input";
    prefer.placeholder = "선호 표현";
    prefer.value = rule.prefer || "";
    prefer.addEventListener("input", () => updatePhraseRule(index, { prefer: prefer.value }));

    const remove = document.createElement("button");
    remove.className = "secondary-button";
    remove.type = "button";
    remove.textContent = "삭제";
    remove.addEventListener("click", () => {
      const next = getPhraseRules();
      next.splice(index, 1);
      setPhraseRules(next);
    });

    row.append(avoid, prefer, remove);
    phraseRules.appendChild(row);
  });
}

function updatePhraseRule(index, patch) {
  const rules = getPhraseRules();
  rules[index] = { ...rules[index], ...patch };
  writeJson(PHRASE_KEY, rules);
}

function getHistory() {
  return readJson(HISTORY_KEY, []);
}

function saveHistory(entry) {
  const history = getHistory();
  const next = [
    {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString()
    },
    ...history
  ].slice(0, HISTORY_LIMIT);

  writeJson(HISTORY_KEY, next);
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  historyList.innerHTML = "";

  if (history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-meta";
    empty.textContent = "저장된 최근 작업이 없습니다.";
    historyList.appendChild(empty);
    return;
  }

  history.forEach((item) => {
    const button = document.createElement("button");
    button.className = "history-item";
    button.type = "button";

    const meta = document.createElement("span");
    meta.className = "history-meta";
    meta.textContent = `${modeLabel(item.mode)} · ${toneLabel(item.tone)} · ${new Date(item.createdAt).toLocaleString()}`;

    const preview = document.createElement("span");
    preview.className = "history-preview";
    preview.textContent = item.input;

    button.append(meta, preview);
    button.addEventListener("click", () => restoreHistory(item));
    historyList.appendChild(button);
  });
}

function modeLabel(mode) {
  if (mode === "polish") return "영문 다듬기";
  if (mode === "compose") return "이메일 작성";
  return "번역";
}

function toneLabel(tone) {
  const option = toneSelect.querySelector(`option[value="${tone}"]`);
  return option ? option.textContent : "정중함";
}

function restoreHistory(item) {
  setMode(item.mode || "translate");
  toneSelect.value = item.tone || "polite";
  inputText.value = item.input || "";
  result.textContent = item.output || "";
  copyButton.disabled = !result.textContent;
  setStatus("히스토리 항목을 불러왔습니다.");
  updateInputState();

  if (currentMode === "polish" && result.textContent) {
    renderDiff(inputText.value, result.textContent);
  }
}

function updateInputState() {
  const text = inputText.value;
  direction.textContent = MODES[currentMode].direction(text);
  charCount.textContent = `${text.length.toLocaleString("en-US")} / ${MAX_TEXT_LENGTH.toLocaleString("en-US")}`;
  submitButton.disabled = text.trim().length === 0;
}

function setMode(mode) {
  currentMode = mode;

  const config = MODES[currentMode];
  inputLabel.textContent = config.inputLabel;
  resultLabel.textContent = config.resultLabel;
  submitButton.textContent = config.buttonLabel;
  inputText.placeholder = config.placeholder;
  result.textContent = "";
  copyButton.disabled = true;
  diffPanel.classList.add("hidden");
  setStatus("");

  const tabs = [
    [translateTab, "translate"],
    [polishTab, "polish"],
    [composeTab, "compose"]
  ];

  tabs.forEach(([tab, tabMode]) => {
    const isActive = currentMode === tabMode;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  updateInputState();
}

function requestPayload(text) {
  return {
    text,
    tone: toneSelect.value,
    phraseRules: getPhraseRules()
  };
}

async function submitCurrentMode() {
  const config = MODES[currentMode];
  const text = inputText.value.trim();

  if (!text) {
    setStatus(config.emptyMessage, true);
    inputText.focus();
    return;
  }

  submitButton.disabled = true;
  copyButton.disabled = true;
  result.textContent = "";
  diffPanel.classList.add("hidden");
  setStatus("요청 전송 중...");

  try {
    setStatus(config.workingStatus);

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload(text))
    });

    const payload = await response.json();

    if (!response.ok) {
      if (response.status === 401 && payload.auth) {
        setAuthStatus(payload.auth);
      }

      throw new Error(payload.error || "요청에 실패했습니다.");
    }

    const output = currentMode === "translate" ? payload.translation : payload.result;
    result.textContent = output;

    if (currentMode === "translate") {
      direction.textContent = `${payload.sourceLanguage === "Korean" ? "한국어" : "영어"} -> ${
        payload.targetLanguage === "Korean" ? "한국어" : "영어"
      }`;
    } else {
      direction.textContent = MODES[currentMode].direction(text);
    }

    if (currentMode === "polish") {
      renderDiff(text, output);
    }

    copyButton.disabled = false;
    saveHistory({
      mode: currentMode,
      input: text,
      output,
      tone: toneSelect.value
    });
    setStatus("완료");
  } catch (error) {
    result.textContent = "";
    setStatus(error.message || "처리 중 오류가 발생했습니다.", true);
  } finally {
    updateInputState();
  }
}

function renderDiff(originalText, resultText) {
  const originalTokens = tokenize(originalText);
  const resultTokens = tokenize(resultText);
  const max = Math.max(originalTokens.length, resultTokens.length);

  diffOriginal.innerHTML = "";
  diffResult.innerHTML = "";

  for (let index = 0; index < max; index += 1) {
    appendDiffToken(diffOriginal, originalTokens[index] || "", originalTokens[index] !== resultTokens[index] ? "changed" : "");
    appendDiffToken(diffResult, resultTokens[index] || "", originalTokens[index] !== resultTokens[index] ? "added" : "");
  }

  diffPanel.classList.remove("hidden");
}

function tokenize(text) {
  return text.match(/\S+|\s+/g) || [];
}

function appendDiffToken(container, token, className) {
  if (!token) return;

  const span = document.createElement("span");
  span.className = className ? `diff-token ${className}` : "diff-token";
  span.textContent = token;
  container.appendChild(span);
}

function setPanelToggleState(toggle, isHidden, openTitle, closeTitle) {
  const isExpanded = !isHidden;
  toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  toggle.setAttribute("title", isExpanded ? closeTitle : openTitle);

  const srOnly = toggle.querySelector(".sr-only");
  if (srOnly) {
    srOnly.textContent = isExpanded ? closeTitle : openTitle;
  }
}

async function copyResult() {
  const text = result.textContent;

  if (!text) {
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      setStatus("복사됨");
      return;
    }

    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.left = "-9999px";
    document.body.appendChild(fallback);
    fallback.select();

    const didCopy = document.execCommand("copy");
    document.body.removeChild(fallback);

    if (!didCopy) {
      throw new Error("copy command failed");
    }

    setStatus("복사됨");
  } catch {
    setStatus("복사에 실패했습니다. 결과를 직접 선택해 복사해 주세요.", true);
  }
}

inputText.addEventListener("input", () => {
  updateInputState();
  setStatus("");
});

submitButton.addEventListener("click", submitCurrentMode);
copyButton.addEventListener("click", () => {
  copyResult().catch(() => {
    setStatus("복사에 실패했습니다. 결과를 직접 선택해 복사해 주세요.", true);
  });
});
translateTab.addEventListener("click", () => setMode("translate"));
polishTab.addEventListener("click", () => setMode("polish"));
composeTab.addEventListener("click", () => setMode("compose"));
phraseToggle.addEventListener("click", () => {
  const isHidden = phraseDrawer.classList.toggle("hidden");
  setPanelToggleState(phraseToggle, isHidden, "표현 사전 열기", "표현 사전 닫기");
});
historyToggle.addEventListener("click", () => {
  const isHidden = historyDrawer.classList.toggle("hidden");
  setPanelToggleState(historyToggle, isHidden, "히스토리 열기", "히스토리 닫기");
});
addPhraseRule.addEventListener("click", () => {
  setPhraseRules([...getPhraseRules(), { avoid: "", prefer: "" }]);
});
clearHistory.addEventListener("click", () => {
  writeJson(HISTORY_KEY, []);
  renderHistory();
  setStatus("히스토리를 비웠습니다.");
});

inputText.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    submitCurrentMode();
  }
});

setMode("translate");
renderPhraseRules();
renderHistory();
refreshAuthStatus();

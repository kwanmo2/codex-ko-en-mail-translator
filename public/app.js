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

const MAX_TEXT_LENGTH = 8000;
const MODES = {
  translate: {
    inputLabel: "입력 이메일",
    resultLabel: "번역 결과",
    buttonLabel: "번역",
    placeholder: "번역할 영어 또는 한국어 비즈니스 이메일을 입력하세요.",
    workingStatus: "번역 중...",
    emptyMessage: "번역할 이메일 내용을 입력해 주세요.",
    endpoint: "/api/translate"
  },
  polish: {
    inputLabel: "영문 이메일",
    resultLabel: "다듬은 결과",
    buttonLabel: "다듬기",
    placeholder: "더 자연스럽고 비즈니스에 어울리게 다듬을 영어 이메일을 입력하세요.",
    workingStatus: "영문 다듬기 중...",
    emptyMessage: "다듬을 영문 이메일 내용을 입력해 주세요.",
    endpoint: "/api/polish"
  }
};

let currentMode = "translate";

function detectDirection(text) {
  return /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(text)
    ? "한국어 -> 영어"
    : "영어 -> 한국어";
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

function updateInputState() {
  const text = inputText.value;
  direction.textContent = currentMode === "translate" ? detectDirection(text) : "영문 다듬기";
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
  setStatus("");

  translateTab.classList.toggle("active", currentMode === "translate");
  polishTab.classList.toggle("active", currentMode === "polish");
  translateTab.setAttribute("aria-pressed", currentMode === "translate" ? "true" : "false");
  polishTab.setAttribute("aria-pressed", currentMode === "polish" ? "true" : "false");

  updateInputState();
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
  setStatus(config.workingStatus);

  try {
    const auth = await refreshAuthStatus();

    if (!auth.loggedIn) {
      throw new Error(`${auth.message} ${auth.instruction || ""}`.trim());
    }

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "번역 요청에 실패했습니다.");
    }

    result.textContent = currentMode === "translate" ? payload.translation : payload.result;

    if (currentMode === "translate") {
      direction.textContent = `${payload.sourceLanguage === "Korean" ? "한국어" : "영어"} -> ${
        payload.targetLanguage === "Korean" ? "한국어" : "영어"
      }`;
    } else {
      direction.textContent = "영문 다듬기";
    }

    copyButton.disabled = false;
    setStatus("완료");
  } catch (error) {
    result.textContent = "";
    setStatus(error.message || "번역 처리 중 오류가 발생했습니다.", true);
  } finally {
    updateInputState();
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

inputText.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    submitCurrentMode();
  }
});

setMode("translate");
refreshAuthStatus();

# Codex KO-EN Mail Translator

Codex CLI 인증 세션을 사용하는 로컬 KO-EN 비즈니스 이메일 도구입니다. DeepL을 사용하면서 느꼈던 빠르고 편리한 번역 경험에서 영감을 받아, 한국어와 영어 비즈니스 이메일을 로컬 브라우저에서 바로 번역하고 다듬고 작성할 수 있도록 만들었습니다.

이 프로젝트는 DeepL과 연동되거나 DeepL API를 사용하지 않습니다. 사용자의 로컬 PC에서 실행 중인 Node.js 서버가 현재 OS 사용자 계정의 Codex CLI 인증 상태를 확인하고, 해당 Codex Auth 세션으로 Codex CLI를 호출합니다.

> 이 도구는 개인 로컬 사용을 전제로 합니다. Codex Auth, OpenAI API key, 계정 인증정보를 다른 사용자와 공유하거나 외부 서비스 형태로 노출하지 마세요.

## 주요 기능

- 한국어 비즈니스 이메일을 영어로 번역
- 영어 비즈니스 이메일을 한국어로 번역
- 영어 이메일을 자연스럽고 전문적인 비즈니스 영어로 다듬기
- 요점, 메모, bullet을 기반으로 영어 비즈니스 이메일 초안 작성
- 정중함, 간결함, 친근함, 강한 요청, 사과/양해, 후속 리마인드 톤 선택
- 선호 표현과 금지 표현을 저장해 프롬프트에 반영
- 영문 다듬기 결과에서 변경된 부분 강조
- 브라우저 `localStorage` 기반 최근 작업 히스토리
- 결과 복사 버튼
- Windows, macOS, Linux에서 동작하는 Codex CLI 실행 경로 처리

## 동작 방식

앱은 Node.js 기본 `http` 서버로 `127.0.0.1`에서 실행됩니다. 브라우저가 입력 내용을 로컬 서버 API로 보내면, 서버는 현재 사용자 계정의 Codex CLI를 비대화형으로 호출해 번역, 영문 다듬기, 이메일 작성 결과를 받아옵니다.

기본 주소:

```bash
http://127.0.0.1:3000
```

중앙 서버에서 여러 사용자의 Codex Auth를 대신 처리하는 구조가 아닙니다. 각 사용자는 자기 PC와 자기 OS 사용자 계정에서 Codex CLI 로그인을 완료한 뒤 앱을 실행해야 합니다.

## 요구사항

- Node.js 20 이상
- Codex CLI
- Codex CLI 로그인 세션

Codex CLI가 실행되는지 확인합니다.

Windows:

```powershell
codex.cmd --help
codex.cmd login status
```

macOS/Linux:

```bash
codex --help
codex login status
```

로그인이 필요하면 다음 명령을 실행합니다.

Windows:

```powershell
codex.cmd login
```

macOS/Linux:

```bash
codex login
```

## 설치

저장소를 클론한 뒤 프로젝트 폴더로 이동합니다.

```bash
git clone https://github.com/<your-id>/codex-ko-en-mail-translator.git
cd codex-ko-en-mail-translator
```

현재 프로젝트는 외부 npm 패키지에 의존하지 않습니다. Node.js 버전만 확인하면 바로 실행할 수 있습니다.

```bash
node --version
```

## 실행

프로젝트 폴더에서 서버를 시작합니다.

```bash
npm start
```

브라우저에서 접속합니다.

```bash
http://127.0.0.1:3000
```

다른 포트를 열려면 `PORT` 환경 변수를 지정합니다.

PowerShell:

```powershell
$env:PORT=4000
npm start
```

macOS/Linux:

```bash
PORT=4000 npm start
```

## 사용법

1. `npm start`로 로컬 서버를 실행합니다.
2. 브라우저에서 `http://127.0.0.1:3000`에 접속합니다.
3. 상단의 Codex Auth 상태가 연결됨인지 확인합니다.
4. `번역`, `영문 다듬기`, `이메일 작성` 중 하나를 선택합니다.
5. 필요한 경우 톤을 설정하고, 표현 사전에 선호/금지 표현을 추가합니다.
6. 입력창에 이메일 또는 작성 요점을 입력하고 실행 버튼을 누릅니다.
7. 결과를 복사하거나 히스토리에서 이전 작업을 다시 불러옵니다.

입력 가능한 최대 길이는 8,000자입니다.

## 기능 설명

### 번역

입력 내용에서 한국어와 영어의 비중을 비교해 원문 언어를 판단합니다. 한국어가 더 많으면 한국어에서 영어로, 영어가 더 많거나 비슷하면 영어에서 한국어로 번역합니다.

이름, 회사명, 제품명, 숫자, 날짜, 이메일 주소, URL 등은 가능한 한 보존하도록 프롬프트가 구성되어 있습니다.

### 영문 다듬기

이미 작성한 영어 이메일을 더 자연스럽고 정중한 비즈니스 영어로 정리합니다. 원래 의미와 주요 정보는 유지하면서 문법, 톤, 흐름, 표현을 개선합니다.

결과 아래에는 원문과 결과의 차이를 token 단위로 비교해 변경된 부분을 강조해서 보여줍니다.

### 이메일 작성

요점, 메모, bullet을 입력하면 영어 비즈니스 이메일 초안을 작성합니다. 사용자가 제공하지 않은 가격, 날짜, 약속, 첨부 파일 같은 사실은 임의로 만들지 않도록 프롬프트가 구성되어 있습니다.

### 톤 선택

모든 모드에서 다음 톤을 선택할 수 있습니다.

- 정중함
- 간결함
- 친근함
- 강한 요청
- 사과/양해
- 후속 리마인드

번역 모드에서는 톤보다 원문 의미 보존을 우선합니다.

### 표현 사전

화면의 사전 패널에서 선호 표현과 금지 표현을 저장할 수 있습니다. 이 설정은 브라우저 `localStorage`에 저장되며, 서버 파일에는 저장되지 않습니다.

예시:

```text
피할 표현: ASAP
선호 표현: at your earliest convenience
```

### 히스토리

최근 20개 작업을 브라우저 `localStorage`에 저장하고 다시 불러올 수 있습니다. 저장 항목에는 모드, 입력, 결과, 톤, 생성 시각이 포함됩니다.

민감한 이메일을 남기고 싶지 않다면 히스토리를 비우거나 브라우저 저장소를 삭제하세요.

## 환경 변수

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `3000` | 로컬 서버 포트 |
| `CODEX_MODEL` | `gpt-5.4` | Codex CLI 호출에 사용할 모델 |
| `CODEX_BIN` | 자동 감지 | Codex 실행 파일 경로를 직접 지정할 때 사용 |

예시:

```powershell
$env:CODEX_MODEL="gpt-5.4"
npm start
```

Codex 실행 파일 경로를 직접 지정해야 하는 경우:

```powershell
$env:CODEX_BIN="C:\Tools\codex.exe"
npm start
```

## 자동 실행

이 앱은 각 사용자의 Codex Auth 세션을 사용하므로 시스템 부팅 서비스보다는 사용자 로그인 후 자동 실행 방식이 적합합니다.

### Windows Task Scheduler

PowerShell에서 실행합니다. `$Project` 값은 실제 프로젝트 경로로 바꿉니다.

```powershell
$Project = "C:\path\to\codex-ko-en-mail-translator"
$Node = (Get-Command node).Source

$Action = New-ScheduledTaskAction `
  -Execute $Node `
  -Argument "server.js" `
  -WorkingDirectory $Project

$Trigger = New-ScheduledTaskTrigger -AtLogOn

$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName "CodexKoEnMailTranslator" `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "Local Codex Auth KO-EN mail translator" `
  -Force
```

해제:

```powershell
Unregister-ScheduledTask -TaskName "CodexKoEnMailTranslator" -Confirm:$false
```

### macOS launchd

`~/Library/LaunchAgents/com.local.codex-ko-en-mail-translator.plist` 파일을 만듭니다. 경로는 실제 프로젝트 위치로 바꿉니다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.local.codex-ko-en-mail-translator</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/codex-ko-en-mail-translator/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/path/to/codex-ko-en-mail-translator</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

등록:

```bash
launchctl load ~/Library/LaunchAgents/com.local.codex-ko-en-mail-translator.plist
```

해제:

```bash
launchctl unload ~/Library/LaunchAgents/com.local.codex-ko-en-mail-translator.plist
```

### Linux systemd user service

`~/.config/systemd/user/codex-ko-en-mail-translator.service` 파일을 만듭니다. 경로는 실제 프로젝트 위치로 바꿉니다.

```ini
[Unit]
Description=Local Codex Auth KO-EN mail translator

[Service]
WorkingDirectory=/path/to/codex-ko-en-mail-translator
ExecStart=/usr/bin/node /path/to/codex-ko-en-mail-translator/server.js
Restart=on-failure

[Install]
WantedBy=default.target
```

등록:

```bash
systemctl --user daemon-reload
systemctl --user enable --now codex-ko-en-mail-translator.service
```

상태 확인:

```bash
systemctl --user status codex-ko-en-mail-translator.service
```

해제:

```bash
systemctl --user disable --now codex-ko-en-mail-translator.service
```

## 프롬프트 커스터마이징

프롬프트는 `prompts/` 폴더에 있습니다.

```text
prompts/
  translate.md
  polish.md
  compose.md
```

다음 placeholder를 사용할 수 있습니다.

- `{text}`
- `{toneInstruction}`
- `{phraseRules}`
- `{sourceLanguage}` / `{targetLanguage}`: 번역 프롬프트에서 사용

## 테스트

```bash
npm test
```

테스트는 Codex CLI 실행 명령 구성, 로그인 상태 파싱, 입력 검증, 프롬프트 템플릿 렌더링 규칙 등을 확인합니다.

## 문제 해결

### Codex CLI를 찾을 수 없는 경우

터미널에서 `codex --help` 또는 `codex.cmd --help`가 실행되는지 확인하세요. PATH 문제가 계속되면 `CODEX_BIN` 환경 변수로 실행 파일 경로를 직접 지정하세요.

### 로그인이 필요하다는 오류가 나는 경우

현재 OS 사용자 계정에서 `codex login` 또는 `codex.cmd login`을 실행한 뒤 서버를 다시 시작하거나 브라우저를 새로고침하세요.

### 요청 시간이 초과되는 경우

입력 내용이 너무 길거나 모델 응답이 지연될 수 있습니다. 이메일 내용을 줄인 뒤 다시 시도하세요.

## 보안 및 개인정보

- 이 앱은 기본적으로 `127.0.0.1`에만 바인딩됩니다.
- OpenAI API key나 Codex token을 프로젝트 파일에 저장하지 않습니다.
- 브라우저 클라이언트에 OpenAI API key나 Codex 인증정보를 내려주지 않습니다.
- 이메일 입력과 결과는 Codex CLI 호출을 위해 현재 사용자 계정의 Codex 세션을 통해 처리됩니다.
- 히스토리와 표현 사전은 브라우저 `localStorage`에 저장됩니다.
- 공개 저장소에 `.env`, `.codex`, key 파일, 개인 문서를 커밋하지 마세요.
- 이 도구를 여러 사용자가 한 사람의 Codex Auth로 함께 사용하는 서비스처럼 운영하지 마세요.

## 프로젝트 구조

```text
.
├── prompts/
│   ├── compose.md
│   ├── polish.md
│   └── translate.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── test/
│   └── translator.test.js
├── .gitignore
├── package.json
├── README.md
└── server.js
```

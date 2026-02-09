# /insights-ko

Claude Code Insights 리포트(report.html)를 한글 다크모드 대시보드(report-ko.html)로 변환합니다.

## 실행 방법

1. 먼저 `/insights` 명령어로 report.html을 생성하세요.
2. 아래 스크립트를 실행합니다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/transform-report.js
```

3. 성공하면 `~/.claude/usage-data/report-ko.html`이 생성됩니다.
4. 브라우저에서 확인합니다:

```bash
open ~/.claude/usage-data/report-ko.html
```

## allowed-tools

- Bash
- Read

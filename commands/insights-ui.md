# /insights-ui

Transform Claude Code Insights report (report.html) into a dark-mode dashboard.
Supports English and Korean.

## Steps

1. First, ask the user to select a language using AskUserQuestion:
   - Question: "Which language for the insights dashboard?"
   - Options: "English (en)" and "Korean (ko)"

2. Run `/insights` to generate the base report.html if it doesn't already exist at `~/.claude/usage-data/report.html`.

3. Based on the selected language, run the transform script:

For English:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/transform-report.js --lang en
```

For Korean:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/transform-report.js --lang ko
```

4. Open the generated report in the browser:

For English:
```bash
open ~/.claude/usage-data/report-en.html
```

For Korean:
```bash
open ~/.claude/usage-data/report-ko.html
```

## allowed-tools

- Bash
- Read
- AskUserQuestion

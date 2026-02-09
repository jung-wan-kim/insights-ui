# /insights-ui

Transform Claude Code Insights report (report.html) into a dark-mode dashboard.
Supports English and Korean with full content translation.

## Steps

1. First, ask the user to select a language using AskUserQuestion:
   - Question: "Which language for the insights dashboard?"
   - Options: "English (en)" and "Korean (ko)"

2. Run `/insights` to generate the base report.html if it doesn't already exist at `~/.claude/usage-data/report.html`.

3. Based on the selected language:

### For English (en):
Run the transform script directly (no translation needed):
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/transform-report.js --lang en
```

### For Korean (ko):
Korean requires a 3-step pipeline to translate all content:

**Step 1: Extract data from report.html to JSON**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/transform-report.js --extract --out /tmp/insights-data.json
```

**Step 2: Translate the JSON content**
Read `/tmp/insights-data.json` using the Read tool, then translate ALL the following text fields from English to Korean. Write the translated JSON to `/tmp/insights-data-ko.json`.

Fields to translate:
- `narrative` (full narrative text)
- `keyInsight` (key insight text)
- `winsIntro` (big wins intro paragraph)
- `frictionIntro` (friction intro paragraph)
- `horizonIntro` (horizon intro paragraph)
- `bigWins[].title` and `bigWins[].desc`
- `frictions[].title`, `frictions[].desc`, and `frictions[].examples[]`
- `features[].title`, `features[].desc`, and `features[].why`
- `horizons[].title`, `horizons[].desc`, and `horizons[].tip`
- `glance` object: all values (keys: "what's working", "what's hindering you", "quick wins to try", "ambitious workflows")
- `funEnding.headline` and `funEnding.detail`
- `projectAreas[].desc` (keep `name` and `count` as-is)
- Chart labels in `charts` object: translate bar labels for "Session Types", "What You Wanted", "What Helped Most (Claude's Capabilities)", "Outcomes", "Primary Friction Types", "Inferred Satisfaction (model-estimated)", "Tool Errors Encountered" (keep "Top Tools Used" and "Languages" labels as-is since they are tool/language names)

Translation guidelines:
- Use natural, fluent Korean (not machine-translation style)
- Keep technical terms (tool names, file paths, code references) as-is
- Keep numeric values, dates, and formatting unchanged
- Maintain the same JSON structure exactly

**Step 3: Render the translated JSON**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/transform-report.js --render --lang ko --data /tmp/insights-data-ko.json
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
- Write
- AskUserQuestion

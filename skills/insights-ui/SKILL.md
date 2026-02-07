---
name: insights-ui
description: Use when generating Claude Code insights reports, usage analytics dashboards, or when the user runs /insights-ui command. Creates beautiful dark-themed HTML dashboards with charts and metrics.
---

# Claude Code Insights UI Generator

## Overview

Generates a stunning dark-themed HTML dashboard that visualizes Claude Code usage data including sessions, messages, tool usage, language distribution, activity patterns, achievements, and improvement recommendations.

## When to Use

- User runs `/insights-ui` command
- User asks for Claude Code usage insights or analytics
- User wants to visualize their development journey with Claude Code
- Keywords: insights, analytics, dashboard, usage report, statistics

## Workflow

### Step 1: Language Selection

Ask the user to choose their preferred language:

Use AskUserQuestion with these options:
- **English** - Generate insights report in English
- **Korean (한국어)** - 한국어로 인사이트 리포트 생성

### Step 2: Collect Data

Run the data collection script to gather Claude Code usage metrics:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/insights-ui/scripts/collect-data.sh"
```

The script outputs a JSON file at `/tmp/insights-data.json` containing:
- Session statistics (total sessions, messages, usage time)
- Tool usage breakdown (Bash, Read, Edit, Write, etc.)
- Language distribution (HTML, TypeScript, Markdown, etc.)
- Activity patterns (hourly, weekly, daily heatmap)
- Git statistics (commits, lines added/removed)
- Error distribution
- Achievement highlights
- Improvement recommendations

### Step 3: Generate HTML Dashboard

1. Read the template from `${CLAUDE_PLUGIN_ROOT}/skills/insights-ui/templates/dashboard.html`
2. Read collected data from `/tmp/insights-data.json`
3. Replace the `__INSIGHTS_DATA__` placeholder in the template with the actual JSON data
4. Replace `__LANG__` with the selected language code (`en` or `ko`)
5. Write the final HTML to `/tmp/claude-insights-report.html`

### Step 4: Open in Browser

```bash
open /tmp/claude-insights-report.html
```

### Step 5: Verification & Auto-Fix

After generation, verify:
1. **Data integrity**: No NaN, null, undefined, or empty values in critical fields
2. **Chart validity**: All chart datasets have matching labels and data arrays
3. **HTML validity**: No unclosed tags or syntax errors
4. **i18n completeness**: All strings translated for selected language

If verification fails:
1. Identify the specific issue
2. Apply automatic fix
3. Regenerate the HTML
4. Re-verify (up to 3 attempts total)

### Step 6: Report to User

Present a summary:
- Key metrics discovered
- File location of the generated report
- Any issues found and fixed during verification
- Option to regenerate with different language

## Template Variables

The HTML template uses these data injection points:
- `__INSIGHTS_DATA__` - Full JSON data object
- `__LANG__` - Language code (en/ko)

## Color Scheme

Dark theme matching the reference design:
- Background: `#0d1117`
- Card Background: `#161b22`
- Border: `#30363d`
- Text Primary: `#e6edf3`
- Text Secondary: `#8b949e`
- Accent Blue: `#58a6ff`
- Accent Green: `#3fb950`
- Accent Orange: `#d29922`
- Accent Red: `#f85149`
- Accent Purple: `#bc8cff`

## References

- See `references/design-spec.md` for detailed design specifications
- See `templates/dashboard.html` for the main HTML template
- See `scripts/collect-data.sh` for data collection logic

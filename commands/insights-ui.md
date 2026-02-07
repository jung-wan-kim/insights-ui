---
description: Generate a beautiful dark-themed insights dashboard from your Claude Code usage data
---

# Claude Code Insights UI Generator

You are generating a stunning visual insights dashboard from Claude Code usage data. Follow these steps precisely:

## Step 1: Language Selection

First, ask the user to choose their preferred language using AskUserQuestion:

```
Question: "Which language would you like for the insights report?"
Options:
- "English" - Generate the report in English
- "Korean (한국어)" - 한국어로 리포트를 생성합니다
```

## Step 2: Data Collection

After language selection, run the data collection script:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/insights-ui/scripts/collect-data.sh"
```

This will output a JSON file with all collected metrics.

## Step 3: Generate Report

Use the insights-ui skill to generate the HTML dashboard:

1. Read the collected data JSON
2. Read the HTML template from `${CLAUDE_PLUGIN_ROOT}/skills/insights-ui/templates/dashboard.html`
3. Inject the collected data into the template
4. Replace i18n strings based on the selected language
5. Save the generated HTML to a temporary file
6. Open it in the default browser

## Step 4: Verification

After generating the report:
1. Check that all data values are valid (no NaN, null, or empty)
2. Verify chart configurations are correct
3. Ensure all sections render properly
4. If any issues found, auto-fix and regenerate (up to 3 attempts)

## Step 5: Present Results

Show the user:
- Summary of key metrics found
- Path to the generated HTML file
- Option to regenerate with different settings

## Important Notes

- Always use the skill `insights-ui:insights-ui` for the main workflow
- The dashboard uses Chart.js for visualizations
- Dark theme colors: background #0d1117, cards #161b22, borders #30363d
- Support both English and Korean with complete i18n

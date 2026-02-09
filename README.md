# insights-ui

A Claude Code plugin that transforms the `/insights` report into a **dark-mode dashboard** with support for **English** and **Korean**.

## Before / After

| `/insights` (default) | `/insights-ui` (transformed) |
|---|---|
| Light mode, single column | Dark mode, sidebar + main dashboard |
| 800px layout | Responsive 1400px layout |
| CSS bar charts only | Bar charts + SVG donut charts |
| Static TOC | Sticky navigation |

## Features

- **Bilingual**: English and Korean language support
- **Dark Mode**: GitHub-style dark theme (CSS variables)
- **Dashboard Layout**: Left sidebar (280px) + main content area
- **SVG Donut Charts**: Visual tool/language distribution
- **KST Time Conversion**: PT → KST auto-conversion (Korean mode)
- **Responsive Design**: Works on mobile/tablet/desktop

## Install

### As a Claude Code Plugin

```bash
claude plugins install github:jung-wan-kim/insights-ui
```

### Manual

```bash
git clone https://github.com/jung-wan-kim/insights-ui.git \
  ~/.claude/plugins/local/insights-ui
```

## Usage

1. Run `/insights-ui` in Claude Code.
2. Select your language (English or Korean).
3. The dashboard opens automatically in your browser.

Output files:
- English: `~/.claude/usage-data/report-en.html`
- Korean: `~/.claude/usage-data/report-ko.html`

## Directory Structure

```
insights-ui/
├── .claude-plugin/
│   └── plugin.json            # Plugin manifest
├── commands/
│   └── insights-ui.md         # /insights-ui slash command
├── scripts/
│   └── transform-report.js    # Transform script (Node.js)
├── templates/
│   ├── report-en-template.html  # English dark-mode template
│   └── report-ko-template.html  # Korean dark-mode template
├── package.json
├── LICENSE
└── README.md
```

## Technical Details

- **Zero dependencies**: Uses only Node.js built-in modules (fs, path)
- **Regex-based parsing**: Extracts data from report.html via CSS class patterns
- **Template engine**: Simple `{{PLACEHOLDER}}` replacement + `{{#EACH_BLOCK}}` loops
- **Time conversion** (Korean): PT(UTC-8) → KST(UTC+9) = +17h offset

## License

MIT

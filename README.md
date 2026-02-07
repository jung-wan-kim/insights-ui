# insights-ui

A Claude Code plugin that generates beautiful dark-themed dashboard reports from your Claude Code usage data.

## Features

- Stunning dark-themed analytics dashboard
- Interactive charts (donut, bar, line, heatmap) via Chart.js
- 9 detailed sections: Overview, Timeline, Tools, Languages, Activity, Achievements, Improvements, Recommendations, Future Outlook
- Full i18n support (English / Korean)
- Automatic data collection from Claude Code session data
- Self-validating with auto-fix capability

## Installation

```bash
# Add the marketplace
/plugin marketplace add jung-wankim/insights-ui

# Install the plugin
/plugin install insights-ui@insights-ui-dev
```

## Usage

Simply run the slash command in Claude Code:

```
/insights-ui
```

You'll be prompted to choose your language (English or Korean), then the plugin will:
1. Collect your Claude Code usage data
2. Generate an interactive HTML dashboard
3. Open it in your default browser

## Screenshots

The dashboard includes:
- **Header**: Key metrics cards (sessions, messages, usage time, commits)
- **Sidebar**: Quick stats, summary cards, tool rankings, language distribution
- **Main Content**: Interactive charts and detailed analytics per section

## Plugin Structure

```
insights-ui/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── commands/
│   └── insights-ui.md
├── skills/
│   └── insights-ui/
│       ├── SKILL.md
│       ├── scripts/
│       │   └── collect-data.sh
│       ├── references/
│       │   └── design-spec.md
│       └── templates/
│           └── dashboard.html
├── agents/
│   └── insights-reporter.md
└── README.md
```

## License

MIT

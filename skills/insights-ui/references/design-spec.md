# Design Specification

## Color Palette

### Backgrounds
- Page: `#0d1117`
- Card/Panel: `#161b22`
- Card Hover: `#1c2129`
- Input/Code Block: `#0d1117`
- Sidebar: `#0d1117`

### Borders
- Default: `#30363d`
- Subtle: `#21262d`
- Hover: `#484f58`

### Text
- Primary: `#e6edf3`
- Secondary: `#8b949e`
- Muted: `#6e7681`
- Link: `#58a6ff`

### Accent Colors
- Blue: `#58a6ff` (primary actions, links)
- Green: `#3fb950` (success, positive)
- Orange/Yellow: `#d29922` (warnings, improvements)
- Red: `#f85149` (errors, negative)
- Purple: `#bc8cff` (special highlights)
- Cyan: `#39d2c0` (secondary charts)
- Pink: `#f778ba` (tertiary charts)

### Chart Colors (ordered)
1. `#58a6ff` (Blue)
2. `#3fb950` (Green)
3. `#d29922` (Orange)
4. `#f85149` (Red)
5. `#bc8cff` (Purple)
6. `#39d2c0` (Cyan)
7. `#f778ba` (Pink)

## Typography

- Font Family: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif`
- Title: 2.5rem, font-weight 700
- Subtitle: 1rem, font-weight 400, color secondary
- Section Title: 1.5rem, font-weight 600
- Card Title: 1rem, font-weight 600
- Body: 0.875rem
- Small: 0.75rem
- Monospace: `"SF Mono", "Fira Code", monospace`

## Layout

### Overall Structure
- Max width: 1400px, centered
- Sidebar: 280px fixed left
- Main content: flexible
- Gap: 24px
- Padding: 24px

### Header
- Full width
- Title centered
- Date range below title
- 4 metric cards in a row (equal width)
- Daily averages below cards

### Tab Navigation
- Horizontal tabs below header
- Pills style with rounded borders
- Active tab: blue background
- Tabs: 현황, 타임라인, 도구, 언어, 활동, 성과, 개선, 추천, 전망

### Sidebar (Left)
- Fixed width 280px
- Sections: 핵심 지표, 요약, 도구 TOP 5, 언어 분포
- Sticky positioning

### Summary Cards (in Sidebar)
- Green border-left: "잘 되고 있는 것" / "What's Working"
- Red/Orange border-left: "개선 필요" / "Needs Improvement"
- Blue border-left: "빠른 개선" / "Quick Wins"

### Charts
- Donut chart: Tool usage ratio
- Bar chart: Tool call counts (horizontal)
- Grouped bar chart: Weekly comparison
- Line chart: Cumulative growth
- Heatmap: Daily activity (GitHub-style)
- Stacked bar: Time distribution

### Code Blocks
- Background: `#0d1117`
- Border: `#30363d`
- Copy button top-right
- Syntax highlighting with accent colors
- Font: monospace, 0.85rem

## Responsive
- Desktop: Full sidebar + main content
- Tablet (< 1024px): Sidebar collapses to top
- Mobile (< 768px): Single column stack

## Animations
- Smooth tab transitions
- Chart entrance animations (Chart.js defaults)
- Hover effects on cards (subtle lift shadow)

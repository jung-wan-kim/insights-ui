# insights-ui

> Claude Code Insights를 다크 모드 인터랙티브 대시보드 + MP4 영상으로 변환

[English](README.md)

## 대시보드

![대시보드 미리보기](https://i.imgur.com/Dg0yOxa.png)

## 영상

<img src="https://i.imgur.com/BeVIJZJ.gif" width="100%" alt="데모 영상">

## 주요 기능

- 애니메이션, 카운터, 툴팁이 포함된 다크 모드 인터랙티브 대시보드
- 이중 언어 지원 (영어 / 한국어 전체 번역)
- 파티클 효과와 다이나믹 애니메이션이 적용된 MP4 영상 생성 (Remotion)
- 스크롤 스파이 네비게이션, 접기/펼치기, 차트 정렬

## 설치

```bash
# 1. 마켓플레이스 추가 (최초 1회)
claude plugin marketplace add jung-wan-kim/insights-ui

# 2. 플러그인 설치
claude plugin install insights-ui
```

## 사용법

```bash
/insights-ui:builder
```

두 가지 질문이 표시됩니다:
1. **언어** - English 또는 Korean
2. **영상** - 대시보드만, 또는 대시보드 + MP4 영상

### 출력 파일

| 유형 | 위치 |
|------|------|
| 대시보드 (영문) | `~/.claude/usage-data/report-en.html` |
| 대시보드 (한글) | `~/.claude/usage-data/report-ko.html` |
| 영상 (MP4) | `~/.claude/usage-data/insights-video.mp4` |

## 작동 원리

### 대시보드
1. Claude Code의 `report.html`을 읽습니다 (`/insights`로 생성)
2. 데이터를 구조화된 JSON으로 추출
3. 한국어의 경우: Claude가 모든 텍스트 필드를 번역
4. 인터랙티브 기능이 포함된 다크 모드 HTML 대시보드로 렌더링

### 영상 (Remotion)
1. 추출된 JSON 데이터를 props로 사용
2. 7개 애니메이션 씬 렌더링 (21초, 1080p, 30fps):
   - **타이틀** - 글로우 효과가 적용된 프로젝트명
   - **개요** - 스프링 물리 기반 애니메이션 카운터
   - **상위 도구** - 스피드 라인이 적용된 레이싱 바 차트
   - **언어** - SVG 글로우 필터가 적용된 도넛 차트
   - **성과** - 순차 등장하는 카드
   - **핵심 인사이트** - 펄싱 글로우 텍스트
   - **엔딩** - 파티클 효과와 줌인
3. 모든 씬에 파티클 시스템, 앰비언트 글로우 오브, 스피드 라인 적용

## 디렉토리 구조

```
insights-ui/
├── .claude-plugin/
│   ├── plugin.json          # 플러그인 매니페스트
│   └── marketplace.json     # 마켓플레이스 설정
├── commands/
│   └── builder.md           # /insights-ui:builder 커맨드
├── scripts/
│   └── transform-report.js  # 변환 스크립트 (Node.js)
├── templates/
│   ├── report-en-template.html
│   └── report-ko-template.html
├── video/
│   └── src/
│       ├── InsightsVideo.tsx # Remotion 영상 컴포넌트
│       ├── Root.tsx          # Remotion 엔트리
│       └── types.ts          # TypeScript 타입
├── docs/
│   ├── dashboard-en.png
│   ├── dashboard-ko.png
│   └── demo-video.mp4
└── README.md
```

## 업데이트

```bash
claude plugin marketplace remove insights-ui
claude plugin marketplace add jung-wan-kim/insights-ui
claude plugin uninstall insights-ui@insights-ui
claude plugin install insights-ui
```

## 기술 스택

- **대시보드**: Vanilla HTML/CSS/JS + CSS 애니메이션
- **영상**: [Remotion](https://www.remotion.dev/) (React 기반 프로그래밍 방식 영상 생성)
- **번역**: Claude Code 내장 번역 기능

## 라이선스

MIT

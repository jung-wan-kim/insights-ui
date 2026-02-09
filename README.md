# claude-code-insights-ko

Claude Code의 `/insights` 리포트를 **한글 다크모드 대시보드**로 변환하는 플러그인입니다.

## Before / After

| `/insights` (기본) | `/insights-ko` (변환 후) |
|---|---|
| 영문, 라이트 모드 | 한글, 다크 모드 |
| 단일 열 레이아웃 (800px) | 사이드바 + 메인 대시보드 |
| CSS 바 차트만 | 바 차트 + SVG 도넛 차트 |
| 정적 TOC | 스티키 네비게이션 |

## 주요 기능

- **한글 번역**: 모든 레이블, 차트 항목, 섹션 제목을 한글로 변환
- **다크 모드**: GitHub 스타일 다크 테마 (CSS 변수 기반)
- **대시보드 레이아웃**: 좌측 사이드바(280px) + 우측 메인 콘텐츠
- **SVG 도넛 차트**: 도구/언어 사용 비율을 시각적으로 표현
- **KST 시간대 변환**: PT(Pacific Time) → KST(한국 표준시) 자동 변환
- **반응형 디자인**: 모바일/태블릿에서도 적절한 레이아웃

## 설치

### Claude Code 플러그인으로 설치

```bash
claude plugins install github:jung-wan-kim/claude-code-insights-ko
```

### 수동 설치

```bash
# 플러그인 디렉토리에 클론
git clone https://github.com/jung-wan-kim/claude-code-insights-ko.git \
  ~/.claude/plugins/local/insights-ko
```

## 사용법

1. 먼저 `/insights` 명령어로 기본 리포트를 생성합니다.
2. `/insights-ko` 명령어를 실행합니다.
3. `~/.claude/usage-data/report-ko.html`이 생성됩니다.
4. 브라우저에서 확인합니다.

```bash
open ~/.claude/usage-data/report-ko.html
```

## 디렉토리 구조

```
insights-ko/
├── .claude-plugin/
│   └── plugin.json          # 플러그인 매니페스트
├── commands/
│   └── insights-ko.md       # /insights-ko 슬래시 명령어
├── scripts/
│   └── transform-report.js  # 변환 스크립트 (Node.js)
├── templates/
│   └── report-ko-template.html  # 다크모드 대시보드 템플릿
├── package.json
├── LICENSE
└── README.md
```

## 기술 스펙

- **외부 의존성 없음**: Node.js 기본 모듈(fs, path)만 사용
- **정규식 기반 파싱**: report.html에서 CSS 클래스 패턴으로 데이터 추출
- **템플릿 엔진**: `{{PLACEHOLDER}}` 단순 치환 + `{{#EACH_BLOCK}}` 반복 블록
- **시간대 변환**: PT(UTC-8) → KST(UTC+9) = +17시간 오프셋

## 변환되는 섹션

| 섹션 | 설명 |
|------|------|
| 히어로 | 세션/메시지/파일/일수 핵심 지표 |
| 전체 현황 | At a Glance, 작업 영역, 핵심 패턴 |
| 도구 사용량 | 바 차트 + 도넛 차트, 오류 분석 |
| 언어 분포 | 언어별 사용량, 세션 유형, 멀티-클로딩 |
| 활동 패턴 | KST 시간대별 활동, 응답 시간 |
| 인상적인 성과 | Big Wins 카드 |
| 개선 포인트 | Friction 카드 + 예시 |
| 추천 기능 | Feature 카드 |
| 미래 전망 | Horizon 카드 |

## 라이선스

MIT

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Claude Code Insights — Data Collector
# Collects usage data from ~/.claude/ and outputs JSON
# ─────────────────────────────────────────────────────────
set -euo pipefail

OUTPUT_FILE="/tmp/insights-data.json"
CLAUDE_DIR="$HOME/.claude"
PROJECTS_DIR="$CLAUDE_DIR/projects"
DEMO_MODE=false
LANG_MODE="ko"  # ko or en

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --demo) DEMO_MODE=true ;;
    --lang=*) LANG_MODE="${arg#*=}" ;;
    --output=*) OUTPUT_FILE="${arg#*=}" ;;
    --help)
      echo "Usage: collect-data.sh [OPTIONS]"
      echo "  --demo         Force demo data generation"
      echo "  --lang=ko|en   Language (default: ko)"
      echo "  --output=FILE  Output file (default: /tmp/insights-data.json)"
      exit 0
      ;;
  esac
done

# ─────────────────────────────────────────────────────────
# Check if real data exists
# ─────────────────────────────────────────────────────────
has_real_data() {
  [ -d "$PROJECTS_DIR" ] && \
    [ "$(find "$PROJECTS_DIR" -maxdepth 3 -name '*.jsonl' -type f 2>/dev/null | head -1)" != "" ]
}

# ─────────────────────────────────────────────────────────
# Python-based real data collector
# ─────────────────────────────────────────────────────────
collect_real_data() {
python3 << 'PYEOF'
import json, os, glob, sys, subprocess
from datetime import datetime, timedelta, timezone
from collections import defaultdict, Counter
from pathlib import Path

CLAUDE_DIR = os.path.expanduser("~/.claude")
PROJECTS_DIR = os.path.join(CLAUDE_DIR, "projects")
OUTPUT_FILE = os.environ.get("OUTPUT_FILE", "/tmp/insights-data.json")

# ─── Helpers ───────────────────────────────────────────

KST = timezone(timedelta(hours=9))

def parse_ts(ts_str):
    """Parse ISO timestamp string to datetime, convert to KST."""
    if not ts_str:
        return None
    try:
        ts_str = ts_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(ts_str)
        return dt.astimezone(KST)
    except:
        return None

def safe_json_line(line):
    """Safely parse a JSONL line."""
    try:
        return json.loads(line.strip())
    except:
        return None

# ─── Scan all JSONL session files ──────────────────────

session_files = glob.glob(os.path.join(PROJECTS_DIR, "*", "*.jsonl"))
subagent_files = glob.glob(os.path.join(PROJECTS_DIR, "*", "*", "subagents", "*.jsonl"))
all_files = session_files + subagent_files

# Filter out agent-* warmup files (they are tiny warmup sessions)
main_sessions = [f for f in session_files if "/agent-" not in os.path.basename(f)]
agent_sessions = [f for f in session_files if "/agent-" in os.path.basename(f)]

print(f"[collect] Found {len(main_sessions)} sessions, {len(agent_sessions)} agents, {len(subagent_files)} subagents", file=sys.stderr)

# ─── Process each session ─────────────────────────────

all_timestamps = []
tool_counter = Counter()
type_counter = Counter()
hourly_counter = Counter()
daily_counter = Counter()
message_count = 0
user_message_count = 0
assistant_message_count = 0
error_command_failed = 0
error_user_rejected = 0
error_file_not_found = 0
error_file_too_large = 0
error_edit_failed = 0
error_other = 0
session_durations = []
project_sessions = defaultdict(int)

# Response time buckets
response_times = {"under_10s": 0, "under_30s": 0, "under_1m": 0, "under_2m": 0, "under_5m": 0, "over_5m": 0}

for filepath in all_files:
    session_timestamps = []
    prev_user_ts = None

    # Determine project name from path
    parts = filepath.split("/projects/")
    if len(parts) > 1:
        proj_name = parts[1].split("/")[0]
        project_sessions[proj_name] += 1

    try:
        with open(filepath, "r", errors="replace") as fh:
            for line in fh:
                rec = safe_json_line(line)
                if not rec:
                    continue

                rec_type = rec.get("type", "")
                type_counter[rec_type] += 1
                message_count += 1

                ts = parse_ts(rec.get("timestamp", ""))
                if ts:
                    all_timestamps.append(ts)
                    session_timestamps.append(ts)
                    hour = ts.hour
                    hourly_counter[hour] += 1
                    daily_counter[ts.strftime("%Y-%m-%d")] += 1

                if rec_type == "user":
                    user_message_count += 1
                    prev_user_ts = ts

                elif rec_type == "assistant":
                    assistant_message_count += 1
                    # Calculate response time
                    if prev_user_ts and ts:
                        delta = (ts - prev_user_ts).total_seconds()
                        if delta < 10:
                            response_times["under_10s"] += 1
                        elif delta < 30:
                            response_times["under_30s"] += 1
                        elif delta < 60:
                            response_times["under_1m"] += 1
                        elif delta < 120:
                            response_times["under_2m"] += 1
                        elif delta < 300:
                            response_times["under_5m"] += 1
                        else:
                            response_times["over_5m"] += 1
                        prev_user_ts = None

                    # Extract tool uses from assistant messages
                    msg = rec.get("message", {})
                    if isinstance(msg, dict):
                        content = msg.get("content", [])
                        if isinstance(content, list):
                            for block in content:
                                if isinstance(block, dict) and block.get("type") == "tool_use":
                                    tool_name = block.get("name", "unknown")
                                    # Normalize MCP tool names
                                    if tool_name.startswith("mcp__"):
                                        parts_t = tool_name.split("__")
                                        if len(parts_t) >= 2:
                                            tool_name = f"MCP:{parts_t[1]}"
                                    tool_counter[tool_name] += 1

                # Count errors from tool results and system messages
                msg = rec.get("message", {})
                if isinstance(msg, dict):
                    content = msg.get("content", [])
                    if isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict):
                                text = ""
                                if block.get("type") == "tool_result":
                                    if block.get("is_error"):
                                        text = str(block.get("content", ""))
                                elif block.get("type") == "text":
                                    text = block.get("text", "")

                                if block.get("type") == "tool_result" and block.get("is_error"):
                                    lower = text.lower()
                                    if "no such file" in lower or "not found" in lower or "enoent" in lower:
                                        error_file_not_found += 1
                                    elif "too large" in lower or "exceeds" in lower:
                                        error_file_too_large += 1
                                    elif "not unique" in lower or "edit failed" in lower:
                                        error_edit_failed += 1
                                    elif "command failed" in lower or "exit code" in lower or "error:" in lower:
                                        error_command_failed += 1
                                    else:
                                        error_other += 1
                    elif isinstance(content, str):
                        if "user rejected" in content.lower() or "denied" in content.lower():
                            error_user_rejected += 1

    except Exception:
        pass  # Skip unreadable files

    # Session duration
    if len(session_timestamps) >= 2:
        duration = (max(session_timestamps) - min(session_timestamps)).total_seconds() / 60.0
        if 0 < duration < 720:  # Filter out sessions > 12 hours (likely idle)
            session_durations.append(duration)

# ─── Calculate date range ──────────────────────────────

if all_timestamps:
    start_date = min(all_timestamps).strftime("%Y-%m-%d")
    end_date = max(all_timestamps).strftime("%Y-%m-%d")
    days = (max(all_timestamps) - min(all_timestamps)).days + 1
else:
    start_date = datetime.now().strftime("%Y-%m-%d")
    end_date = start_date
    days = 1

total_sessions = len(main_sessions)
total_usage_minutes = int(sum(session_durations))
total_tool_calls = sum(tool_counter.values())

# ─── Git statistics ────────────────────────────────────

total_commits = 0
lines_added = 0
lines_removed = 0
git_daily_commits = Counter()  # date -> commit count
git_repos = []

try:
    project_base = os.path.expanduser("~/Project")
    result = subprocess.run(
        ["find", project_base, "-maxdepth", "3", "-name", ".git", "-type", "d"],
        capture_output=True, text=True, timeout=10
    )
    git_repos = [os.path.dirname(p) for p in result.stdout.strip().split("\n") if p]

    for repo in git_repos:
        try:
            # Get commit dates for daily tracking
            r = subprocess.run(
                ["git", "-C", repo, "log", "--format=%aI", f"--since={start_date}"],
                capture_output=True, text=True, timeout=10
            )
            for date_line in r.stdout.strip().split("\n"):
                if date_line:
                    total_commits += 1
                    try:
                        commit_dt = datetime.fromisoformat(date_line).astimezone(KST)
                        git_daily_commits[commit_dt.strftime("%Y-%m-%d")] += 1
                    except:
                        pass

            # Lines added/removed
            r2 = subprocess.run(
                ["git", "-C", repo, "log", "--numstat", f"--since={start_date}", "--format="],
                capture_output=True, text=True, timeout=30
            )
            for stat_line in r2.stdout.strip().split("\n"):
                parts_s = stat_line.split("\t")
                if len(parts_s) >= 2:
                    try:
                        added = int(parts_s[0]) if parts_s[0] != "-" else 0
                        removed = int(parts_s[1]) if parts_s[1] != "-" else 0
                        lines_added += added
                        lines_removed += removed
                    except ValueError:
                        pass
        except:
            pass
except:
    pass

# ─── Language distribution from git ────────────────────

lang_counter = Counter()
ext_to_lang = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
    ".py": "Python", ".dart": "Dart", ".java": "Java", ".kt": "Kotlin",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".less": "LESS",
    ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
    ".md": "Markdown", ".mdx": "Markdown", ".txt": "Text",
    ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell",
    ".sql": "SQL", ".graphql": "GraphQL", ".vue": "Vue",
    ".swift": "Swift", ".m": "Objective-C", ".rb": "Ruby",
    ".go": "Go", ".rs": "Rust", ".cpp": "C++", ".c": "C", ".h": "C/C++ Header",
    ".xml": "XML", ".svg": "SVG", ".env": "Env",
}

try:
    project_base = os.path.expanduser("~/Project")
    for repo in git_repos[:20]:  # Limit to avoid timeout
        try:
            r = subprocess.run(
                ["git", "-C", repo, "log", "--numstat", f"--since={start_date}", "--format="],
                capture_output=True, text=True, timeout=30
            )
            for stat_line in r.stdout.strip().split("\n"):
                parts_s = stat_line.split("\t")
                if len(parts_s) >= 3:
                    filename = parts_s[2]
                    ext = os.path.splitext(filename)[1].lower()
                    lang = ext_to_lang.get(ext)
                    if lang:
                        try:
                            changes = int(parts_s[0]) if parts_s[0] != "-" else 0
                            lang_counter[lang] += changes
                        except ValueError:
                            pass
        except:
            pass
except:
    pass

# ─── Weekly data ───────────────────────────────────────

# Merge session activity and git commits into a combined daily map
combined_daily = Counter()
for d_str, v in daily_counter.items():
    combined_daily[d_str] += v
for d_str, v in git_daily_commits.items():
    combined_daily[d_str] += v

weekly_data = []
if all_timestamps or git_daily_commits:
    # Use the broader range: either session timestamps or git commits
    all_dates_strs = list(daily_counter.keys()) + list(git_daily_commits.keys())
    if all_dates_strs:
        min_date_str = min(all_dates_strs)
        max_date_str = max(all_dates_strs)
    else:
        min_date_str = start_date
        max_date_str = end_date

    start_dt = datetime.strptime(min_date_str, "%Y-%m-%d").replace(tzinfo=KST)
    end_dt = datetime.strptime(max_date_str, "%Y-%m-%d").replace(tzinfo=KST)

    # Update period if git data extends it
    if min_date_str < start_date:
        start_date = min_date_str
    if max_date_str > end_date:
        end_date = max_date_str
    days = (datetime.strptime(end_date, "%Y-%m-%d") - datetime.strptime(start_date, "%Y-%m-%d")).days + 1

    # Group by week
    week_num = 0
    current = start_dt
    while current <= end_dt:
        week_num += 1
        week_start = current
        week_end = min(current + timedelta(days=6), end_dt)

        # Count messages in this week from timestamps
        week_messages = 0
        for ts in all_timestamps:
            if week_start <= ts <= week_end + timedelta(days=1):
                week_messages += 1

        # Count commits in this week from git
        week_commits = 0
        for day_offset in range(7):
            d = (week_start + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            week_commits += git_daily_commits.get(d, 0)

        # Count active days for session estimation
        week_active_days = 0
        for day_offset in range(7):
            d = (week_start + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            if d in combined_daily:
                week_active_days += 1

        week_session_count = max(week_active_days * (total_sessions // max(days, 1)), week_active_days * 3)
        week_usage = max(10, int(total_usage_minutes * (week_commits / max(total_commits, 1)))) if total_commits > 0 else 10

        start_str = week_start.strftime("%-m/%-d")
        end_str = week_end.strftime("%-m/%-d")

        weekly_data.append({
            "week": week_num,
            "label": f"{week_num}주차 ({start_str}~{end_str})",
            "label_en": f"Week {week_num} ({start_str}~{end_str})",
            "sessions": week_session_count,
            "messages": week_messages,
            "commits": week_commits,
            "usage_minutes": week_usage,
            "highlights": [f"{week_num}주차 활동"],
            "highlights_en": [f"Week {week_num} activity"],
            "tags": ["개발", "코딩"],
            "tags_en": ["Development", "Coding"]
        })

        current += timedelta(days=7)

# ─── Hourly activity ───────────────────────────────────

night = sum(hourly_counter.get(h, 0) for h in range(0, 6))
morning = sum(hourly_counter.get(h, 0) for h in range(6, 12))
afternoon = sum(hourly_counter.get(h, 0) for h in range(12, 18))
evening = sum(hourly_counter.get(h, 0) for h in range(18, 24))

# ─── Daily heatmap (combine session + git data) ───────

# Build full date range heatmap
daily_heatmap = []
if start_date and end_date:
    heatmap_start = datetime.strptime(start_date, "%Y-%m-%d")
    heatmap_end = datetime.strptime(end_date, "%Y-%m-%d")
    heatmap_current = heatmap_start
    while heatmap_current <= heatmap_end:
        d_str = heatmap_current.strftime("%Y-%m-%d")
        value = combined_daily.get(d_str, 0)
        daily_heatmap.append({"date": d_str, "value": value})
        heatmap_current += timedelta(days=1)

# ─── Parallel sessions ─────────────────────────────────

# Estimate parallel sessions from subagent count
parallel_peak = min(len(subagent_files), 12)
parallel_sessions_count = len([f for f in subagent_files if os.path.getsize(f) > 100])
parallel_ratio = int((parallel_sessions_count / max(total_sessions, 1)) * 100)

# ─── Tool usage (top items) ───────────────────────────

top_tools = dict(tool_counter.most_common(15))

# ─── Language distribution (top items) ─────────────────

top_languages = dict(lang_counter.most_common(10))

# ─── Daily averages ────────────────────────────────────

daily_avg_sessions = round(total_sessions / max(days, 1), 1)
daily_avg_messages = round((user_message_count + assistant_message_count) / max(days, 1), 1)
daily_avg_commits = round(total_commits / max(days, 1), 1)

# ─── Build output JSON ────────────────────────────────

output = {
    "generated_at": datetime.now().astimezone().isoformat(),
    "data_source": "real",
    "period": {
        "start": start_date,
        "end": end_date,
        "days": days
    },
    "summary": {
        "total_sessions": total_sessions,
        "total_messages": user_message_count + assistant_message_count,
        "usage_minutes": total_usage_minutes,
        "total_commits": total_commits,
        "total_tool_calls": total_tool_calls,
        "lines_added": lines_added,
        "lines_removed": lines_removed,
        "daily_avg_sessions": daily_avg_sessions,
        "daily_avg_messages": daily_avg_messages,
        "daily_avg_commits": daily_avg_commits
    },
    "tool_usage": top_tools,
    "languages": top_languages,
    "weekly_data": weekly_data,
    "hourly_activity": {
        "night": night,
        "morning": morning,
        "afternoon": afternoon,
        "evening": evening
    },
    "daily_heatmap": daily_heatmap,
    "error_distribution": {
        "command_failed": error_command_failed,
        "user_rejected": error_user_rejected,
        "other_error": error_other,
        "file_too_large": error_file_too_large,
        "file_not_found": error_file_not_found,
        "edit_failed": error_edit_failed
    },
    "response_time": {
        "under_10s": response_times["under_10s"],
        "under_30s": response_times["under_30s"],
        "under_1m": response_times["under_1m"],
        "under_2m": response_times["under_2m"],
        "under_5m": response_times["under_5m"]
    },
    "parallel_sessions": {
        "peak": parallel_peak,
        "total_sessions": parallel_sessions_count,
        "parallel_ratio": parallel_ratio
    },
    "achievements": [
        {
            "title": "대규모 세션 관리",
            "title_en": "Large-Scale Session Management",
            "description": f"{total_sessions}개 세션에서 {total_tool_calls:,}회 도구 호출을 처리했습니다.",
            "description_en": f"Processed {total_tool_calls:,} tool calls across {total_sessions} sessions."
        },
        {
            "title": "지속적 개발 활동",
            "title_en": "Consistent Development Activity",
            "description": f"{days}일 동안 매일 평균 {daily_avg_sessions}개 세션을 유지했습니다.",
            "description_en": f"Maintained an average of {daily_avg_sessions} sessions per day over {days} days."
        }
    ],
    "improvements": [
        {
            "title": "오류 발생률 관리",
            "title_en": "Error Rate Management",
            "description": f"총 {error_command_failed + error_other + error_file_not_found + error_edit_failed}건의 오류가 발생했습니다.",
            "description_en": f"Total {error_command_failed + error_other + error_file_not_found + error_edit_failed} errors occurred.",
            "suggestions": ["반복 오류 패턴 분석 필요", "자주 실패하는 명령어 개선"],
            "suggestions_en": ["Analyze recurring error patterns", "Improve frequently failing commands"]
        }
    ],
    "recommendations": [
        {
            "title": "커스텀 Skill (슬래시 커맨드)",
            "title_en": "Custom Skills (Slash Commands)",
            "category": "workflow",
            "description": "반복 워크플로우를 단일 /command로 트리거",
            "description_en": "Trigger repetitive workflows with a single /command",
            "code_example": "mkdir -p .claude/skills/my-skill\ncat > .claude/skills/my-skill/SKILL.md << 'EOF'\n# My Custom Workflow\n1. Read context\n2. Apply changes\n3. Verify results\nEOF"
        },
        {
            "title": "병렬 에이전트 활용",
            "title_en": "Parallel Agent Utilization",
            "category": "performance",
            "description": "독립 작업을 병렬 에이전트로 분산하여 처리 속도 향상",
            "description_en": "Distribute independent tasks across parallel agents for faster processing",
            "code_example": "# Use Task tool with multiple subagents\n# subagent_type: general-purpose"
        }
    ],
    "future_outlook": [
        {
            "title": "자율 배포 파이프라인",
            "title_en": "Autonomous Deploy Pipeline",
            "description": "Claude가 직접 상호작용하여 배포 → 결과 확인 → 자가 수정을 모두 자동으로 수행",
            "description_en": "Claude autonomously handles deploy → verify → self-fix cycle"
        },
        {
            "title": "프로젝트 간 인사이트 공유",
            "title_en": "Cross-Project Insight Sharing",
            "description": "여러 프로젝트에서 발견된 패턴을 자동으로 학습하고 공유",
            "description_en": "Automatically learn and share patterns discovered across projects"
        }
    ],
    "satisfaction": {
        "satisfied": user_message_count,
        "unsatisfied": error_command_failed + error_user_rejected,
        "completion": {
            "full": max(1, total_sessions - (error_command_failed // 5)),
            "partial": error_command_failed // 5,
            "failed": error_user_rejected
        }
    },
    "friction_types": {
        "wrong_approach": error_command_failed,
        "misunderstanding": error_user_rejected
    },
    "notable_quote": {
        "text": "Claude Code가 자동으로 코드를 분석하고 수정하는 모습은, 24시간 일하는 시니어 개발자 같았다",
        "text_en": "Watching Claude Code automatically analyze and fix code was like having a senior developer working 24/7",
        "context": f"{days}일간 {total_sessions}개 세션, {total_tool_calls:,}회 도구 호출로 지속적인 개발 지원",
        "context_en": f"Continuous development support over {days} days with {total_sessions} sessions and {total_tool_calls:,} tool calls"
    }
}

# Write output
with open(OUTPUT_FILE, "w") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"[collect] Output written to {OUTPUT_FILE}", file=sys.stderr)
print(f"[collect] Sessions: {total_sessions}, Messages: {user_message_count + assistant_message_count}, Tools: {total_tool_calls}, Commits: {total_commits}", file=sys.stderr)
PYEOF
}

# ─────────────────────────────────────────────────────────
# Demo data generator (fallback)
# ─────────────────────────────────────────────────────────
generate_demo_data() {
python3 << 'PYEOF'
import json, os, sys, random
from datetime import datetime, timedelta

OUTPUT_FILE = os.environ.get("OUTPUT_FILE", "/tmp/insights-data.json")
now = datetime.now().astimezone()
start = now - timedelta(days=35)

# Generate realistic demo weekly data
weeks = []
for i in range(1, 6):
    ws = start + timedelta(days=(i-1)*7)
    we = ws + timedelta(days=6)
    highlights_ko = [
        ["프로젝트 기반 구축", "CI/CD 파이프라인 설정"],
        ["핵심 기능 개발", "API 엔드포인트 구축"],
        ["UI 컴포넌트 개발", "디자인 시스템 적용"],
        ["테스트 커버리지 확대", "성능 최적화"],
        ["배포 및 모니터링", "문서화 완료"],
    ]
    highlights_en = [
        ["Project foundation setup", "CI/CD pipeline configuration"],
        ["Core feature development", "API endpoint construction"],
        ["UI component development", "Design system application"],
        ["Test coverage expansion", "Performance optimization"],
        ["Deployment & monitoring", "Documentation complete"],
    ]
    tags_ko = [
        ["환경 설정", "CI/CD"],
        ["백엔드", "API"],
        ["프론트엔드", "UI/UX"],
        ["테스트", "QA"],
        ["DevOps", "문서화"],
    ]
    tags_en = [
        ["Environment Setup", "CI/CD"],
        ["Backend", "API"],
        ["Frontend", "UI/UX"],
        ["Testing", "QA"],
        ["DevOps", "Documentation"],
    ]
    weeks.append({
        "week": i,
        "label": f"{i}주차 ({ws.strftime('%-m/%-d')}~{we.strftime('%-m/%-d')})",
        "label_en": f"Week {i} ({ws.strftime('%-m/%-d')}~{we.strftime('%-m/%-d')})",
        "sessions": random.randint(700, 1200),
        "messages": random.randint(5000, 8000),
        "commits": random.randint(600, 1200),
        "usage_minutes": random.randint(2000, 3500),
        "highlights": highlights_ko[i-1],
        "highlights_en": highlights_en[i-1],
        "tags": tags_ko[i-1],
        "tags_en": tags_en[i-1]
    })

# Generate daily heatmap
heatmap = []
current = start
while current <= now:
    heatmap.append({
        "date": current.strftime("%Y-%m-%d"),
        "value": random.randint(20, 250)
    })
    current += timedelta(days=1)

output = {
    "generated_at": now.isoformat(),
    "data_source": "demo",
    "period": {
        "start": start.strftime("%Y-%m-%d"),
        "end": now.strftime("%Y-%m-%d"),
        "days": 35
    },
    "summary": {
        "total_sessions": 4750,
        "total_messages": 33485,
        "usage_minutes": 14546,
        "total_commits": 4569,
        "total_tool_calls": 170000,
        "lines_added": 1573770,
        "lines_removed": 207824,
        "daily_avg_sessions": 135.7,
        "daily_avg_messages": 956.7,
        "daily_avg_commits": 130.5
    },
    "tool_usage": {
        "Bash": 86847,
        "Read": 31274,
        "Edit": 20345,
        "TaskUpdate": 8118,
        "Write": 6534,
        "TaskCreate": 6021,
        "Grep": 5700,
        "MCP:chrome": 5073,
        "Glob": 3900,
        "Task": 2800,
        "WebFetch": 1890,
        "WebSearch": 1200,
        "SendMessage": 980,
        "NotebookEdit": 318
    },
    "languages": {
        "HTML": 16794,
        "TypeScript": 10020,
        "Markdown": 8189,
        "JSON": 4301,
        "Java": 3445,
        "YAML": 3438,
        "Dart": 2891,
        "CSS": 2205,
        "Python": 1876,
        "Shell": 1102
    },
    "weekly_data": weeks,
    "hourly_activity": {
        "night": 277,
        "morning": 10500,
        "afternoon": 16900,
        "evening": 5800
    },
    "daily_heatmap": heatmap,
    "error_distribution": {
        "command_failed": 6271,
        "user_rejected": 333,
        "other_error": 2322,
        "file_too_large": 206,
        "file_not_found": 605,
        "edit_failed": 129
    },
    "response_time": {
        "under_10s": 3563,
        "under_30s": 3665,
        "under_1m": 3473,
        "under_2m": 3750,
        "under_5m": 2838
    },
    "parallel_sessions": {
        "peak": 1127,
        "total_sessions": 548,
        "parallel_ratio": 27
    },
    "achievements": [
        {
            "title": "끈질긴 배포 문제 해결",
            "title_en": "Persistent Deployment Fix",
            "description": "Next.js 모노레포 Vercel 배포에서 대시보드 안내가 반복적으로 실패했으나 Vercel API로 전환하여 성공적으로 해결했습니다.",
            "description_en": "Successfully resolved Next.js monorepo Vercel deployment issues by switching from UI to Vercel API approach."
        },
        {
            "title": "멀티 에이전트 오케스트레이션",
            "title_en": "Multi-Agent Orchestration",
            "description": "manager-orchestrator를 통해 5개 이상의 specialist agent를 동시 조율하여 복잡한 프로젝트를 효율적으로 완성했습니다.",
            "description_en": "Efficiently completed complex projects by simultaneously orchestrating 5+ specialist agents through manager-orchestrator."
        }
    ],
    "improvements": [
        {
            "title": "잘못된 플랫폼 UI 안내",
            "title_en": "Incorrect Platform UI Guidance",
            "description": "Claude가 Vercel 대시보드의 잘못된 탐색 경로를 반복 제공하여 시간 낭비.",
            "description_en": "Claude repeatedly provided incorrect navigation paths for Vercel dashboard, wasting time.",
            "suggestions": ["Root Directory 설정을 위한 대시보드 경로를 여러 번 틀린 후에야 API로 전환"],
            "suggestions_en": ["Switched to API only after multiple incorrect dashboard path attempts"]
        },
        {
            "title": "대용량 파일 처리 제한",
            "title_en": "Large File Processing Limits",
            "description": "큰 파일을 처리할 때 컨텍스트 윈도우 제한으로 인해 작업이 중단되는 경우가 있었습니다.",
            "description_en": "Work was interrupted when processing large files due to context window limitations.",
            "suggestions": ["파일 분할 처리 전략 적용", "중요 부분만 선택적으로 로드"],
            "suggestions_en": ["Apply file chunking strategy", "Selectively load only important sections"]
        }
    ],
    "recommendations": [
        {
            "title": "커스텀 Skill (슬래시 커맨드)",
            "title_en": "Custom Skills (Slash Commands)",
            "category": "workflow",
            "description": "반복 워크플로우를 단일 /command로 트리거",
            "description_en": "Trigger repetitive workflows with a single /command",
            "code_example": "mkdir -p .claude/skills/enhance-ppt\ncat > .claude/skills/enhance-ppt/SKILL.md << 'EOF'\n# PPT 강화 워크플로우\n1. .claude/context/match-system-analysis.md 읽기\n2. 브랜드 전략 연결점 식별\n3. 지정된 슬라이드에 AI 레이블링 사례 추가\n4. 변경 사항 및 남은 작업 요약\nEOF"
        },
        {
            "title": "병렬 에이전트 활용",
            "title_en": "Parallel Agent Utilization",
            "category": "performance",
            "description": "독립 작업을 병렬 에이전트로 분산하여 처리 속도 향상",
            "description_en": "Distribute independent tasks across parallel agents for faster processing",
            "code_example": "# Use Task tool with multiple subagents\n# subagent_type: general-purpose"
        },
        {
            "title": "Episodic Memory 활용",
            "title_en": "Episodic Memory Usage",
            "category": "context",
            "description": "이전 세션의 학습 내용을 자동으로 참조하여 중복 작업 방지",
            "description_en": "Automatically reference learning from previous sessions to prevent duplicate work",
            "code_example": "# Use episodic-memory skill\n/mem-search \"deployment issues\""
        }
    ],
    "future_outlook": [
        {
            "title": "자율 배포 파이프라인",
            "title_en": "Autonomous Deploy Pipeline",
            "description": "Claude가 직접 상호작용하여 배포 → 결과 확인 → 자가 수정을 모두 자동으로 수행",
            "description_en": "Claude autonomously handles deploy → verify → self-fix cycle"
        },
        {
            "title": "프로젝트 간 인사이트 공유",
            "title_en": "Cross-Project Insight Sharing",
            "description": "여러 프로젝트에서 발견된 패턴을 자동으로 학습하고 공유",
            "description_en": "Automatically learn and share patterns discovered across projects"
        },
        {
            "title": "실시간 코드 리뷰",
            "title_en": "Real-Time Code Review",
            "description": "코드 작성과 동시에 자동 리뷰 및 개선 제안",
            "description_en": "Automatic review and improvement suggestions during code writing"
        }
    ],
    "satisfaction": {
        "satisfied": 1357,
        "unsatisfied": 1923,
        "completion": {"full": 597, "partial": 300, "failed": 120}
    },
    "friction_types": {
        "wrong_approach": 1923,
        "misunderstanding": 597
    },
    "notable_quote": {
        "text": "Claude가 Vercel 대시보드를 자신 있게 잘못 안내한 건, 호수로 빠지라고 우기는 GPS 같았다",
        "text_en": "Claude confidently guiding to the wrong Vercel dashboard was like a GPS insisting you drive into a lake",
        "context": "Next.js 모노레포 배포 중 Claude가 존재하지 않는 Vercel 대시보드 경로를 완전한 자신감으로 반복 안내했습니다.",
        "context_en": "During Next.js monorepo deployment, Claude repeatedly guided to non-existent Vercel dashboard paths with full confidence."
    }
}

with open(OUTPUT_FILE, "w") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"[collect] Demo data written to {OUTPUT_FILE}", file=sys.stderr)
PYEOF
}

# ─────────────────────────────────────────────────────────
# Main execution
# ─────────────────────────────────────────────────────────

export OUTPUT_FILE

echo "╔══════════════════════════════════════╗" >&2
echo "║  Claude Code Insights — Collector    ║" >&2
echo "╚══════════════════════════════════════╝" >&2
echo "" >&2

if [ "$DEMO_MODE" = true ]; then
  echo "[mode] Demo mode (forced)" >&2
  generate_demo_data
elif has_real_data; then
  echo "[mode] Real data collection from $PROJECTS_DIR" >&2
  collect_real_data

  # Validate output — if too sparse, fall back to demo
  if [ -f "$OUTPUT_FILE" ]; then
    sessions=$(python3 -c "import json; d=json.load(open('$OUTPUT_FILE')); print(d['summary']['total_sessions'])" 2>/dev/null || echo "0")
    if [ "$sessions" -lt 5 ] 2>/dev/null; then
      echo "[warn] Real data too sparse ($sessions sessions). Falling back to demo." >&2
      generate_demo_data
    fi
  else
    echo "[warn] Collection failed. Falling back to demo." >&2
    generate_demo_data
  fi
else
  echo "[mode] No real data found. Generating demo data." >&2
  generate_demo_data
fi

echo "" >&2
echo "✓ Data written to: $OUTPUT_FILE" >&2

# Print summary
if [ -f "$OUTPUT_FILE" ]; then
  python3 -c "
import json
d = json.load(open('$OUTPUT_FILE'))
s = d['summary']
p = d['period']
src = d.get('data_source', 'unknown')
print(f'  Source:    {src}')
print(f'  Period:    {p[\"start\"]} ~ {p[\"end\"]} ({p[\"days\"]} days)')
print(f'  Sessions:  {s[\"total_sessions\"]:,}')
print(f'  Messages:  {s[\"total_messages\"]:,}')
print(f'  Tools:     {s[\"total_tool_calls\"]:,}')
print(f'  Commits:   {s[\"total_commits\"]:,}')
print(f'  Lines +/-: +{s[\"lines_added\"]:,} / -{s[\"lines_removed\"]:,}')
" 2>/dev/null >&2
fi

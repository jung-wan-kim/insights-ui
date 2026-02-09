#!/usr/bin/env node
/**
 * transform-report.js
 *
 * report.html (영문 라이트모드) → report-ko.html (한글 다크모드 대시보드) 변환
 * 외부 의존성 없음 (Node.js fs, path만 사용)
 */

const fs = require('fs');
const path = require('path');

const USAGE_DIR = path.join(process.env.HOME, '.claude', 'usage-data');
const INPUT_PATH = path.join(USAGE_DIR, 'report.html');
const OUTPUT_PATH = path.join(USAGE_DIR, 'report-ko.html');
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'report-ko-template.html');

// ── Korean label translations ──
const SESSION_TYPE_KO = {
  'Iterative Refinement': '반복 개선',
  'Multi Task': '다중 작업',
  'Exploration': '탐색',
  'Quick Question': '빠른 질문',
  'Single Task': '단일 작업',
  'Debugging': '디버깅',
  'Code Review': '코드 리뷰'
};

const FRICTION_TYPE_KO = {
  'Wrong Approach': '잘못된 접근',
  'Misunderstood Request': '요청 오해',
  'Slow Response': '느린 응답',
  'Tool Error': '도구 오류'
};

const ERROR_TYPE_KO = {
  'Command Failed': '명령 실패',
  'Other': '기타',
  'File Not Found': '파일 미발견',
  'User Rejected': '사용자 거부',
  'File Too Large': '파일 과대',
  'Edit Failed': '편집 실패'
};

const TIME_PERIOD_KO = {
  'Morning (6-12)': '오전 (6-12)',
  'Afternoon (12-18)': '오후 (12-18)',
  'Evening (18-24)': '저녁 (18-24)',
  'Night (0-6)': '심야 (0-6)'
};

// ── Utility functions ──
function num(str) {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, ''), 10) || 0;
}

function fmt(n) {
  return n.toLocaleString('ko-KR');
}

function escapeHtml(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

// ── Parse report.html ──
function parseReport(html) {
  const data = {};
  let m;

  // Meta: subtitle line
  const subtitleMatch = html.match(/<p class="subtitle">(.*?)<\/p>/);
  if (subtitleMatch) {
    const sub = subtitleMatch[1];
    const msgMatch = sub.match(/([\d,]+)\s*messages/);
    const sessMatch = sub.match(/([\d,]+)\s*sessions/);
    const dateMatch = sub.match(/(\d{4}-\d{2}-\d{2})\s*to\s*(\d{4}-\d{2}-\d{2})/);
    data.totalMessages = msgMatch ? num(msgMatch[1]) : 0;
    data.totalSessions = sessMatch ? num(sessMatch[1]) : 0;
    data.dateFrom = dateMatch ? dateMatch[1] : '';
    data.dateTo = dateMatch ? dateMatch[2] : '';
  }

  // Stats row
  const statsRegex = /<div class="stat-value">(.*?)<\/div>\s*<div class="stat-label">(.*?)<\/div>/g;
  data.stats = {};
  while ((m = statsRegex.exec(html)) !== null) {
    const label = m[2].trim().toLowerCase();
    data.stats[label] = m[1].trim();
  }

  // Lines changed
  const linesStr = data.stats['lines'] || '+0/-0';
  const linesMatch = linesStr.match(/\+?([\d,]+)\s*\/\s*-?([\d,]+)/);
  data.linesAdded = linesMatch ? num(linesMatch[1]) : 0;
  data.linesRemoved = linesMatch ? num(linesMatch[2]) : 0;

  // Files, Days, Msgs/Day
  data.filesChanged = num(data.stats['files'] || '0');
  data.days = num(data.stats['days'] || '0');
  data.msgsPerDay = data.stats['msgs/day'] || '0';

  // At a Glance sections
  data.glance = {};
  const glanceSections = html.match(/<div class="glance-section">[\s\S]*?<\/div>/g) || [];
  for (const sec of glanceSections) {
    const strongMatch = sec.match(/<strong>(.*?)<\/strong>/);
    const textMatch = sec.match(/<\/strong>([\s\S]*?)(?:<a |$)/);
    if (strongMatch) {
      const key = strongMatch[1].replace(/:$/, '').trim().toLowerCase();
      const text = textMatch ? textMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      data.glance[key] = text;
    }
  }

  // Parse bar charts - find chart-title then collect bar-rows
  data.charts = {};
  const chartBlocks = html.split(/<div class="chart-title"[^>]*>/);
  for (let i = 1; i < chartBlocks.length; i++) {
    const titleEnd = chartBlocks[i].indexOf('</div>');
    const chartTitle = chartBlocks[i].substring(0, titleEnd).trim();
    const rest = chartBlocks[i].substring(titleEnd);

    const bars = [];
    const barRegex = /<div class="bar-label">(.*?)<\/div>[\s\S]*?width:([\d.]+)%[\s\S]*?background:(#[0-9a-fA-F]+)[\s\S]*?<div class="bar-value">([\d,]+)<\/div>/g;
    let bm;
    while ((bm = barRegex.exec(rest)) !== null) {
      bars.push({
        label: bm[1].trim(),
        width: parseFloat(bm[2]),
        color: bm[3],
        value: num(bm[4])
      });
    }
    if (bars.length > 0) {
      data.charts[chartTitle] = bars;
    }
  }

  // Big Wins
  data.bigWins = [];
  const winRegex = /<div class="big-win-title">(.*?)<\/div>\s*<div class="big-win-desc">([\s\S]*?)<\/div>/g;
  while ((m = winRegex.exec(html)) !== null) {
    data.bigWins.push({ title: m[1].trim(), desc: m[2].trim() });
  }

  // Friction categories
  data.frictions = [];
  const frictionRegex = /<div class="friction-title">(.*?)<\/div>\s*<div class="friction-desc">([\s\S]*?)<\/div>\s*(?:<ul class="friction-examples">([\s\S]*?)<\/ul>)?/g;
  while ((m = frictionRegex.exec(html)) !== null) {
    const examples = [];
    if (m[3]) {
      const liRegex = /<li>([\s\S]*?)<\/li>/g;
      let li;
      while ((li = liRegex.exec(m[3])) !== null) {
        examples.push(li[1].trim());
      }
    }
    data.frictions.push({ title: m[1].trim(), desc: m[2].trim(), examples });
  }

  // Features
  data.features = [];
  const featureRegex = /<div class="feature-title">(.*?)<\/div>\s*<div class="feature-oneliner">([\s\S]*?)<\/div>\s*<div class="feature-why">([\s\S]*?)<\/div>/g;
  while ((m = featureRegex.exec(html)) !== null) {
    data.features.push({ title: m[1].trim(), desc: m[2].trim(), why: m[3].trim() });
  }

  // Horizons
  data.horizons = [];
  const horizonRegex = /<div class="horizon-title">(.*?)<\/div>\s*<div class="horizon-possible">([\s\S]*?)<\/div>\s*<div class="horizon-tip">([\s\S]*?)<\/div>/g;
  while ((m = horizonRegex.exec(html)) !== null) {
    data.horizons.push({ title: m[1].trim(), desc: m[2].trim(), tip: m[3].trim() });
  }

  // Narrative
  const narrativeBlock = html.match(/<div class="narrative">([\s\S]*?)<\/div>\s*(?:<div class="key-insight">|$)/);
  data.narrative = '';
  if (narrativeBlock) {
    const pRegex = /<p>([\s\S]*?)<\/p>/g;
    const paragraphs = [];
    while ((m = pRegex.exec(narrativeBlock[1])) !== null) {
      paragraphs.push(m[1].replace(/<[^>]+>/g, '').trim());
    }
    data.narrative = paragraphs.join('\n\n');
  }

  // Key insight
  const keyInsight = html.match(/<div class="key-insight">([\s\S]*?)<\/div>/);
  data.keyInsight = keyInsight ? keyInsight[1].replace(/<[^>]+>/g, '').trim() : '';

  // rawHourCounts (inline JS)
  const hourMatch = html.match(/rawHourCounts\s*=\s*(\{[^}]+\})/);
  data.rawHourCounts = hourMatch ? JSON.parse(hourMatch[1]) : {};

  // Response time
  const medianMatch = html.match(/Median:\s*([\d.]+)s/);
  const avgMatch = html.match(/Average:\s*([\d.]+)s/);
  data.medianResponseTime = medianMatch ? parseFloat(medianMatch[1]) : 0;
  data.avgResponseTime = avgMatch ? parseFloat(avgMatch[1]) : 0;

  // Multi-clauding
  const multiRegex = /<div style="font-size: 24px; font-weight: 700; color: #7c3aed;">([\d,%]+)<\/div>\s*<div[^>]*>(.*?)<\/div>/g;
  data.multiClauding = { overlapEvents: 0, sessionsInvolved: 0, pctMessages: 0 };
  while ((m = multiRegex.exec(html)) !== null) {
    const label = m[2].trim();
    const val = m[1].replace('%', '').replace(/,/g, '');
    if (label.includes('Overlap')) data.multiClauding.overlapEvents = parseInt(val) || 0;
    else if (label.includes('Sessions')) data.multiClauding.sessionsInvolved = parseInt(val) || 0;
    else if (label.includes('Messages')) data.multiClauding.pctMessages = parseInt(val) || 0;
  }

  // Fun ending
  const funHeadline = html.match(/<div class="fun-headline">([\s\S]*?)<\/div>/);
  const funDetail = html.match(/<div class="fun-detail">([\s\S]*?)<\/div>/);
  data.funEnding = {
    headline: funHeadline ? funHeadline[1].replace(/<[^>]+>/g, '').trim() : '',
    detail: funDetail ? funDetail[1].replace(/<[^>]+>/g, '').trim() : ''
  };

  // Project areas
  data.projectAreas = [];
  const areaRegex = /<span class="area-name">(.*?)<\/span>\s*<span class="area-count">(.*?)<\/span>[\s\S]*?<div class="area-desc">([\s\S]*?)<\/div>/g;
  while ((m = areaRegex.exec(html)) !== null) {
    data.projectAreas.push({
      name: escapeHtml(m[1].trim()),
      count: m[2].trim(),
      desc: m[3].trim()
    });
  }

  // Section intros
  const winsIntro = html.match(/<h2 id="section-wins">[\s\S]*?<p class="section-intro">([\s\S]*?)<\/p>/);
  data.winsIntro = winsIntro ? winsIntro[1].trim() : '';
  const frictionIntro = html.match(/<h2 id="section-friction">[\s\S]*?<p class="section-intro">([\s\S]*?)<\/p>/);
  data.frictionIntro = frictionIntro ? frictionIntro[1].trim() : '';
  const horizonIntro = html.match(/<h2 id="section-horizon">[\s\S]*?<p class="section-intro">([\s\S]*?)<\/p>/);
  data.horizonIntro = horizonIntro ? horizonIntro[1].trim() : '';

  return data;
}

// ── KST conversion (PT+17) ──
function convertHourCountsToKST(rawCounts) {
  const kst = {};
  for (const [hour, count] of Object.entries(rawCounts)) {
    const kstHour = (parseInt(hour) + 17) % 24;
    kst[kstHour] = (kst[kstHour] || 0) + count;
  }
  return kst;
}

function getTimePeriodCounts(hourCounts) {
  const periods = {
    '오전 (6-12)': 0, '오후 (12-18)': 0,
    '저녁 (18-24)': 0, '심야 (0-6)': 0
  };
  for (const [hour, count] of Object.entries(hourCounts)) {
    const h = parseInt(hour);
    if (h >= 6 && h < 12) periods['오전 (6-12)'] += count;
    else if (h >= 12 && h < 18) periods['오후 (12-18)'] += count;
    else if (h >= 18 && h < 24) periods['저녁 (18-24)'] += count;
    else periods['심야 (0-6)'] += count;
  }
  return periods;
}

// ── Bar HTML generation ──
function generateBarRows(bars, colorOverride) {
  if (!bars || bars.length === 0) return '<div style="color:var(--text-dim);font-size:12px;">데이터 없음</div>';
  const maxVal = Math.max(...bars.map(b => b.value)) || 1;
  return bars.map(b => {
    const width = ((b.value / maxVal) * 100).toFixed(1);
    const color = colorOverride || b.color;
    const label = SESSION_TYPE_KO[b.label] || FRICTION_TYPE_KO[b.label] || ERROR_TYPE_KO[b.label] || TIME_PERIOD_KO[b.label] || b.label;
    return `      <div class="bar-row">
        <div class="bar-label">${label}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${color}"></div></div>
        <div class="bar-value">${fmt(b.value)}</div>
      </div>`;
  }).join('\n');
}

// ── SVG Donut ──
function generateDonutSVG(items, size) {
  size = size || 120;
  const total = items.reduce(function(s, i) { return s + i.value; }, 0);
  if (total === 0) return '';

  var cx = size / 2, cy = size / 2, r = (size / 2) - 8;
  var circumference = 2 * Math.PI * r;
  var offset = 0;

  var colors = ['#2f81f7', '#388bfd', '#39d2c0', '#3fb950', '#f0883e', '#db61a2', '#d29922', '#8b5cf6'];
  var segments = items.slice(0, 6).map(function(item, i) {
    var pct = item.value / total;
    var dash = pct * circumference;
    var gap = circumference - dash;
    var seg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + colors[i % colors.length] + '" stroke-width="16" stroke-dasharray="' + dash + ' ' + gap + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
    offset += dash;
    return seg;
  });

  var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">\n' +
    '    <circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="16"/>\n' +
    '    ' + segments.join('\n    ') + '\n' +
    '    <text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" fill="#f0f6fc" font-size="18" font-weight="700">' + fmt(total) + '</text>\n' +
    '    <text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" fill="#8b949e" font-size="10">전체</text>\n' +
    '  </svg>';

  var legend = items.slice(0, 6).map(function(item, i) {
    var pct = ((item.value / total) * 100).toFixed(1);
    return '<div class="legend-item"><span class="legend-dot" style="background:' + colors[i % colors.length] + '"></span>' + item.label + ' ' + fmt(item.value) + ' (' + pct + '%)</div>';
  }).join('\n      ');

  return '<div class="donut-wrap">\n    ' + svg + '\n    <div class="donut-legend">\n      ' + legend + '\n    </div>\n  </div>';
}

// ── Calculate derived values ──
function calculateDerived(data) {
  var days = data.days || 1;
  data.sessionsPerDay = (data.totalSessions / days).toFixed(1);
  data.messagesPerDay = (data.totalMessages / days).toFixed(1);

  if (data.dateFrom && data.dateTo) {
    var from = new Date(data.dateFrom);
    var to = new Date(data.dateTo);
    var diffMs = to - from;
    data.totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
    data.dateRangeKo = data.dateFrom + ' ~ ' + data.dateTo;
  }
}

// ── Template rendering ──
function renderTemplate(template, data) {
  var html = template;

  // KST hour data
  var kstCounts = convertHourCountsToKST(data.rawHourCounts);
  var timePeriods = getTimePeriodCounts(kstCounts);

  // Simple value replacements
  var replacements = {
    '{{TOTAL_MESSAGES}}': fmt(data.totalMessages),
    '{{TOTAL_SESSIONS}}': fmt(data.totalSessions),
    '{{DATE_FROM}}': data.dateFrom,
    '{{DATE_TO}}': data.dateTo,
    '{{DATE_RANGE_KO}}': data.dateRangeKo || '',
    '{{TOTAL_DAYS}}': String(data.totalDays || data.days),
    '{{LINES_ADDED}}': fmt(data.linesAdded),
    '{{LINES_REMOVED}}': fmt(data.linesRemoved),
    '{{FILES_CHANGED}}': fmt(data.filesChanged),
    '{{SESSIONS_PER_DAY}}': data.sessionsPerDay,
    '{{MESSAGES_PER_DAY}}': data.messagesPerDay,
    '{{MEDIAN_RESPONSE}}': String(data.medianResponseTime),
    '{{AVG_RESPONSE}}': String(data.avgResponseTime),
    '{{MULTI_OVERLAP}}': fmt(data.multiClauding.overlapEvents),
    '{{MULTI_SESSIONS}}': fmt(data.multiClauding.sessionsInvolved),
    '{{MULTI_PCT}}': String(data.multiClauding.pctMessages),
    '{{NARRATIVE}}': data.narrative,
    '{{KEY_INSIGHT}}': data.keyInsight,
    '{{WINS_INTRO}}': data.winsIntro,
    '{{FRICTION_INTRO}}': data.frictionIntro,
    '{{HORIZON_INTRO}}': data.horizonIntro,
    '{{FUN_HEADLINE}}': data.funEnding.headline,
    '{{FUN_DETAIL}}': data.funEnding.detail,
    '{{GLANCE_WORKING}}': data.glance["what's working"] || '',
    '{{GLANCE_HINDERING}}': data.glance["what's hindering you"] || '',
    '{{GLANCE_QUICKWINS}}': data.glance["quick wins to try"] || '',
    '{{GLANCE_AMBITIOUS}}': data.glance["ambitious workflows"] || ''
  };

  for (var key in replacements) {
    html = html.split(key).join(replacements[key]);
  }

  // Chart bar rows
  var chartMap = {
    '{{CHART_TOOLS}}': 'Top Tools Used',
    '{{CHART_LANGUAGES}}': 'Languages',
    '{{CHART_SESSION_TYPES}}': 'Session Types',
    '{{CHART_WHAT_WANTED}}': 'What You Wanted',
    '{{CHART_WHAT_HELPED}}': "What Helped Most (Claude's Capabilities)",
    '{{CHART_OUTCOMES}}': 'Outcomes',
    '{{CHART_FRICTION_TYPES}}': 'Primary Friction Types',
    '{{CHART_SATISFACTION}}': 'Inferred Satisfaction (model-estimated)',
    '{{CHART_TOOL_ERRORS}}': 'Tool Errors Encountered'
  };

  for (var placeholder in chartMap) {
    var chartData = data.charts[chartMap[placeholder]] || [];
    html = html.split(placeholder).join(generateBarRows(chartData));
  }

  // Time of day bars (KST)
  var maxTimePeriod = Math.max.apply(null, Object.values(timePeriods).concat([1]));
  var timeBarHtml = Object.keys(timePeriods).map(function(label) {
    var count = timePeriods[label];
    var width = ((count / maxTimePeriod) * 100).toFixed(1);
    return '      <div class="bar-row">\n        <div class="bar-label">' + label + '</div>\n        <div class="bar-track"><div class="bar-fill" style="width:' + width + '%;background:#8b5cf6"></div></div>\n        <div class="bar-value">' + fmt(count) + '</div>\n      </div>';
  }).join('\n');
  html = html.split('{{CHART_TIME_OF_DAY}}').join(timeBarHtml);

  // Response time bars
  var responseData = data.charts['User Response Time Distribution'] || [];
  html = html.split('{{CHART_RESPONSE_TIME}}').join(generateBarRows(responseData));

  // SVG Donuts
  var toolData = (data.charts['Top Tools Used'] || []).map(function(b) { return { label: b.label, value: b.value }; });
  html = html.split('{{DONUT_TOOLS}}').join(generateDonutSVG(toolData));

  var langData = (data.charts['Languages'] || []).map(function(b) { return { label: b.label, value: b.value }; });
  html = html.split('{{DONUT_LANGUAGES}}').join(generateDonutSVG(langData));

  // Repeating blocks - Big Wins
  var bigWinMatch = html.match(/{{#EACH_BIG_WIN}}([\s\S]*?){{\/EACH_BIG_WIN}}/);
  if (bigWinMatch) {
    var winHtml = data.bigWins.map(function(w) {
      return bigWinMatch[1].split('{{WIN_TITLE}}').join(w.title).split('{{WIN_DESC}}').join(w.desc);
    }).join('\n');
    html = html.replace(/{{#EACH_BIG_WIN}}[\s\S]*?{{\/EACH_BIG_WIN}}/, winHtml);
  }

  // Frictions
  var frictionMatch = html.match(/{{#EACH_FRICTION}}([\s\S]*?){{\/EACH_FRICTION}}/);
  if (frictionMatch) {
    var frictionHtml = data.frictions.map(function(f) {
      var exHtml = f.examples.map(function(e) { return '<li>' + e + '</li>'; }).join('\n            ');
      return frictionMatch[1].split('{{FRICTION_TITLE}}').join(f.title).split('{{FRICTION_DESC}}').join(f.desc).split('{{FRICTION_EXAMPLES}}').join(exHtml);
    }).join('\n');
    html = html.replace(/{{#EACH_FRICTION}}[\s\S]*?{{\/EACH_FRICTION}}/, frictionHtml);
  }

  // Features
  var featureMatch = html.match(/{{#EACH_FEATURE}}([\s\S]*?){{\/EACH_FEATURE}}/);
  if (featureMatch) {
    var featureHtml = data.features.map(function(f) {
      return featureMatch[1].split('{{FEATURE_TITLE}}').join(f.title).split('{{FEATURE_DESC}}').join(f.desc).split('{{FEATURE_WHY}}').join(f.why);
    }).join('\n');
    html = html.replace(/{{#EACH_FEATURE}}[\s\S]*?{{\/EACH_FEATURE}}/, featureHtml);
  }

  // Horizons
  var horizonMatch = html.match(/{{#EACH_HORIZON}}([\s\S]*?){{\/EACH_HORIZON}}/);
  if (horizonMatch) {
    var horizonHtml = data.horizons.map(function(h) {
      return horizonMatch[1].split('{{HORIZON_TITLE}}').join(h.title).split('{{HORIZON_DESC}}').join(h.desc).split('{{HORIZON_TIP}}').join(h.tip);
    }).join('\n');
    html = html.replace(/{{#EACH_HORIZON}}[\s\S]*?{{\/EACH_HORIZON}}/, horizonHtml);
  }

  // Project Areas
  var areaMatch = html.match(/{{#EACH_PROJECT_AREA}}([\s\S]*?){{\/EACH_PROJECT_AREA}}/);
  if (areaMatch) {
    var areaHtml = data.projectAreas.map(function(a) {
      return areaMatch[1].split('{{AREA_NAME}}').join(a.name).split('{{AREA_COUNT}}').join(a.count).split('{{AREA_DESC}}').join(a.desc);
    }).join('\n');
    html = html.replace(/{{#EACH_PROJECT_AREA}}[\s\S]*?{{\/EACH_PROJECT_AREA}}/, areaHtml);
  }

  // Sidebar top tools
  var topTools = (data.charts['Top Tools Used'] || []).slice(0, 5);
  var sidebarToolsHtml = topTools.map(function(t) {
    return '      <div class="sidebar-stat"><span class="sidebar-stat-label">' + t.label + '</span><span class="sidebar-stat-value">' + fmt(t.value) + '</span></div>';
  }).join('\n');
  html = html.split('{{SIDEBAR_TOP_TOOLS}}').join(sidebarToolsHtml);

  // Sidebar languages
  var topLangs = (data.charts['Languages'] || []).slice(0, 5);
  var sidebarLangsHtml = topLangs.map(function(l) {
    return '      <div class="sidebar-stat"><span class="sidebar-stat-label">' + l.label + '</span><span class="sidebar-stat-value">' + fmt(l.value) + '</span></div>';
  }).join('\n');
  html = html.split('{{SIDEBAR_LANGUAGES}}').join(sidebarLangsHtml);

  // Total tool calls
  var totalToolCalls = (data.charts['Top Tools Used'] || []).reduce(function(s, t) { return s + t.value; }, 0);
  html = html.split('{{TOTAL_TOOL_CALLS}}').join(fmt(totalToolCalls));

  return html;
}

// ── Main ──
function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error('[insights-ko] report.html이 없습니다: ' + INPUT_PATH);
    console.error('먼저 /insights 명령어를 실행하여 리포트를 생성하세요.');
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('[insights-ko] 템플릿 파일이 없습니다: ' + TEMPLATE_PATH);
    process.exit(1);
  }

  console.log('[insights-ko] report.html 파싱 중...');
  var reportHtml = fs.readFileSync(INPUT_PATH, 'utf-8');
  var data = parseReport(reportHtml);
  calculateDerived(data);

  console.log('[insights-ko] 데이터 추출 완료:');
  console.log('  - 메시지: ' + fmt(data.totalMessages));
  console.log('  - 세션: ' + fmt(data.totalSessions));
  console.log('  - 기간: ' + data.dateRangeKo);
  console.log('  - Big Wins: ' + data.bigWins.length + '개');
  console.log('  - Frictions: ' + data.frictions.length + '개');
  console.log('  - Features: ' + data.features.length + '개');
  console.log('  - Horizons: ' + data.horizons.length + '개');
  console.log('  - Charts: ' + Object.keys(data.charts).length + '개');

  console.log('[insights-ko] 템플릿 렌더링 중...');
  var template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  var output = renderTemplate(template, data);

  fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log('[insights-ko] 변환 완료: ' + OUTPUT_PATH);
  console.log('[insights-ko] open ~/.claude/usage-data/report-ko.html 으로 확인하세요.');
}

main();

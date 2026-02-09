#!/usr/bin/env node
/**
 * transform-report.js
 *
 * report.html → dark-mode dashboard (English or Korean)
 * Usage: node transform-report.js --lang en|ko
 * No external dependencies (Node.js fs, path only)
 */

const fs = require('fs');
const path = require('path');

// ── CLI args ──
const args = process.argv.slice(2);
const langIdx = args.indexOf('--lang');
const LANG = (langIdx !== -1 && args[langIdx + 1]) ? args[langIdx + 1] : 'en';

if (!['en', 'ko'].includes(LANG)) {
  console.error('[insights-ui] Unsupported language: ' + LANG);
  console.error('Supported: en, ko');
  process.exit(1);
}

const USAGE_DIR = path.join(process.env.HOME, '.claude', 'usage-data');
const INPUT_PATH = path.join(USAGE_DIR, 'report.html');
const OUTPUT_PATH = path.join(USAGE_DIR, 'report-' + LANG + '.html');
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'report-' + LANG + '-template.html');

// ── i18n labels ──
const I18N = {
  en: {
    sessionType: {},
    frictionType: {},
    errorType: {},
    timePeriod: {
      'Morning (6-12)': 'Morning (6-12)',
      'Afternoon (12-18)': 'Afternoon (12-18)',
      'Evening (18-24)': 'Evening (18-24)',
      'Night (0-6)': 'Night (0-6)'
    },
    timePeriodKeys: {
      morning: 'Morning (6-12)',
      afternoon: 'Afternoon (12-18)',
      evening: 'Evening (18-24)',
      night: 'Night (0-6)'
    },
    noData: 'No data',
    total: 'Total',
    locale: 'en-US',
    log: {
      notFound: '[insights-ui] report.html not found: ',
      templateNotFound: '[insights-ui] Template not found: ',
      parsing: '[insights-ui] Parsing report.html...',
      extracted: '[insights-ui] Data extracted:',
      messages: '  - Messages: ',
      sessions: '  - Sessions: ',
      period: '  - Period: ',
      bigWins: '  - Big Wins: ',
      frictions: '  - Frictions: ',
      features: '  - Features: ',
      horizons: '  - Horizons: ',
      charts: '  - Charts: ',
      rendering: '[insights-ui] Rendering template...',
      done: '[insights-ui] Done: ',
      openWith: '[insights-ui] Open with: open '
    }
  },
  ko: {
    sessionType: {
      'Iterative Refinement': '반복 개선',
      'Multi Task': '다중 작업',
      'Exploration': '탐색',
      'Quick Question': '빠른 질문',
      'Single Task': '단일 작업',
      'Debugging': '디버깅',
      'Code Review': '코드 리뷰'
    },
    frictionType: {
      'Wrong Approach': '잘못된 접근',
      'Misunderstood Request': '요청 오해',
      'Slow Response': '느린 응답',
      'Tool Error': '도구 오류'
    },
    errorType: {
      'Command Failed': '명령 실패',
      'Other': '기타',
      'File Not Found': '파일 미발견',
      'User Rejected': '사용자 거부',
      'File Too Large': '파일 과대',
      'Edit Failed': '편집 실패'
    },
    timePeriod: {
      'Morning (6-12)': '오전 (6-12)',
      'Afternoon (12-18)': '오후 (12-18)',
      'Evening (18-24)': '저녁 (18-24)',
      'Night (0-6)': '심야 (0-6)'
    },
    timePeriodKeys: {
      morning: '오전 (6-12)',
      afternoon: '오후 (12-18)',
      evening: '저녁 (18-24)',
      night: '심야 (0-6)'
    },
    noData: '데이터 없음',
    total: '전체',
    locale: 'ko-KR',
    log: {
      notFound: '[insights-ui] report.html이 없습니다: ',
      templateNotFound: '[insights-ui] 템플릿 파일이 없습니다: ',
      parsing: '[insights-ui] report.html 파싱 중...',
      extracted: '[insights-ui] 데이터 추출 완료:',
      messages: '  - 메시지: ',
      sessions: '  - 세션: ',
      period: '  - 기간: ',
      bigWins: '  - Big Wins: ',
      frictions: '  - Frictions: ',
      features: '  - Features: ',
      horizons: '  - Horizons: ',
      charts: '  - Charts: ',
      rendering: '[insights-ui] 템플릿 렌더링 중...',
      done: '[insights-ui] 변환 완료: ',
      openWith: '[insights-ui] open '
    }
  }
};

const L = I18N[LANG];

// ── Utility functions ──
function num(str) {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, ''), 10) || 0;
}

function fmt(n) {
  return n.toLocaleString(L.locale);
}

function escapeHtml(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

// ── Parse report.html ──
function parseReport(html) {
  const data = {};
  let m;

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

  const statsRegex = /<div class="stat-value">(.*?)<\/div>\s*<div class="stat-label">(.*?)<\/div>/g;
  data.stats = {};
  while ((m = statsRegex.exec(html)) !== null) {
    const label = m[2].trim().toLowerCase();
    data.stats[label] = m[1].trim();
  }

  const linesStr = data.stats['lines'] || '+0/-0';
  const linesMatch = linesStr.match(/\+?([\d,]+)\s*\/\s*-?([\d,]+)/);
  data.linesAdded = linesMatch ? num(linesMatch[1]) : 0;
  data.linesRemoved = linesMatch ? num(linesMatch[2]) : 0;

  data.filesChanged = num(data.stats['files'] || '0');
  data.days = num(data.stats['days'] || '0');
  data.msgsPerDay = data.stats['msgs/day'] || '0';

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

  data.bigWins = [];
  const winRegex = /<div class="big-win-title">(.*?)<\/div>\s*<div class="big-win-desc">([\s\S]*?)<\/div>/g;
  while ((m = winRegex.exec(html)) !== null) {
    data.bigWins.push({ title: m[1].trim(), desc: m[2].trim() });
  }

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

  data.features = [];
  const featureRegex = /<div class="feature-title">(.*?)<\/div>\s*<div class="feature-oneliner">([\s\S]*?)<\/div>\s*<div class="feature-why">([\s\S]*?)<\/div>/g;
  while ((m = featureRegex.exec(html)) !== null) {
    data.features.push({ title: m[1].trim(), desc: m[2].trim(), why: m[3].trim() });
  }

  data.horizons = [];
  const horizonRegex = /<div class="horizon-title">(.*?)<\/div>\s*<div class="horizon-possible">([\s\S]*?)<\/div>\s*<div class="horizon-tip">([\s\S]*?)<\/div>/g;
  while ((m = horizonRegex.exec(html)) !== null) {
    data.horizons.push({ title: m[1].trim(), desc: m[2].trim(), tip: m[3].trim() });
  }

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

  const keyInsight = html.match(/<div class="key-insight">([\s\S]*?)<\/div>/);
  data.keyInsight = keyInsight ? keyInsight[1].replace(/<[^>]+>/g, '').trim() : '';

  const hourMatch = html.match(/rawHourCounts\s*=\s*(\{[^}]+\})/);
  data.rawHourCounts = hourMatch ? JSON.parse(hourMatch[1]) : {};

  const medianMatch = html.match(/Median:\s*([\d.]+)s/);
  const avgMatch = html.match(/Average:\s*([\d.]+)s/);
  data.medianResponseTime = medianMatch ? parseFloat(medianMatch[1]) : 0;
  data.avgResponseTime = avgMatch ? parseFloat(avgMatch[1]) : 0;

  const multiRegex = /<div style="font-size: 24px; font-weight: 700; color: #7c3aed;">([\d,%]+)<\/div>\s*<div[^>]*>(.*?)<\/div>/g;
  data.multiClauding = { overlapEvents: 0, sessionsInvolved: 0, pctMessages: 0 };
  while ((m = multiRegex.exec(html)) !== null) {
    const label = m[2].trim();
    const val = m[1].replace('%', '').replace(/,/g, '');
    if (label.includes('Overlap')) data.multiClauding.overlapEvents = parseInt(val) || 0;
    else if (label.includes('Sessions')) data.multiClauding.sessionsInvolved = parseInt(val) || 0;
    else if (label.includes('Messages')) data.multiClauding.pctMessages = parseInt(val) || 0;
  }

  const funHeadline = html.match(/<div class="fun-headline">([\s\S]*?)<\/div>/);
  const funDetail = html.match(/<div class="fun-detail">([\s\S]*?)<\/div>/);
  data.funEnding = {
    headline: funHeadline ? funHeadline[1].replace(/<[^>]+>/g, '').trim() : '',
    detail: funDetail ? funDetail[1].replace(/<[^>]+>/g, '').trim() : ''
  };

  data.projectAreas = [];
  const areaRegex = /<span class="area-name">(.*?)<\/span>\s*<span class="area-count">(.*?)<\/span>[\s\S]*?<div class="area-desc">([\s\S]*?)<\/div>/g;
  while ((m = areaRegex.exec(html)) !== null) {
    data.projectAreas.push({
      name: escapeHtml(m[1].trim()),
      count: m[2].trim(),
      desc: m[3].trim()
    });
  }

  const winsIntro = html.match(/<h2 id="section-wins">[\s\S]*?<p class="section-intro">([\s\S]*?)<\/p>/);
  data.winsIntro = winsIntro ? winsIntro[1].trim() : '';
  const frictionIntro = html.match(/<h2 id="section-friction">[\s\S]*?<p class="section-intro">([\s\S]*?)<\/p>/);
  data.frictionIntro = frictionIntro ? frictionIntro[1].trim() : '';
  const horizonIntro = html.match(/<h2 id="section-horizon">[\s\S]*?<p class="section-intro">([\s\S]*?)<\/p>/);
  data.horizonIntro = horizonIntro ? horizonIntro[1].trim() : '';

  return data;
}

// ── Time conversion ──
function convertHourCountsToKST(rawCounts) {
  const kst = {};
  for (const [hour, count] of Object.entries(rawCounts)) {
    const kstHour = (parseInt(hour) + 17) % 24;
    kst[kstHour] = (kst[kstHour] || 0) + count;
  }
  return kst;
}

function getTimePeriodCounts(hourCounts) {
  const keys = L.timePeriodKeys;
  const periods = {};
  periods[keys.morning] = 0;
  periods[keys.afternoon] = 0;
  periods[keys.evening] = 0;
  periods[keys.night] = 0;

  for (const [hour, count] of Object.entries(hourCounts)) {
    const h = parseInt(hour);
    if (h >= 6 && h < 12) periods[keys.morning] += count;
    else if (h >= 12 && h < 18) periods[keys.afternoon] += count;
    else if (h >= 18 && h < 24) periods[keys.evening] += count;
    else periods[keys.night] += count;
  }
  return periods;
}

// ── Bar HTML generation ──
function translateLabel(label) {
  return L.sessionType[label] || L.frictionType[label] || L.errorType[label] || L.timePeriod[label] || label;
}

function generateBarRows(bars) {
  if (!bars || bars.length === 0) return '<div style="color:var(--text-dim);font-size:12px;">' + L.noData + '</div>';
  const maxVal = Math.max(...bars.map(b => b.value)) || 1;
  return bars.map(b => {
    const width = ((b.value / maxVal) * 100).toFixed(1);
    const label = translateLabel(b.label);
    return '      <div class="bar-row">\n' +
      '        <div class="bar-label">' + label + '</div>\n' +
      '        <div class="bar-track"><div class="bar-fill" style="width:' + width + '%;background:' + b.color + '"></div></div>\n' +
      '        <div class="bar-value">' + fmt(b.value) + '</div>\n' +
      '      </div>';
  }).join('\n');
}

// ── SVG Donut ──
function generateDonutSVG(items, size) {
  size = size || 120;
  var total = items.reduce(function(s, i) { return s + i.value; }, 0);
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
    '    <text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" fill="#8b949e" font-size="10">' + L.total + '</text>\n' +
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
    if (LANG === 'ko') {
      data.dateRange = data.dateFrom + ' ~ ' + data.dateTo;
    } else {
      data.dateRange = data.dateFrom + ' to ' + data.dateTo;
    }
  }
}

// ── Template rendering ──
function renderTemplate(template, data) {
  var html = template;

  // Time data: KST for ko, PT (original) for en
  var hourCounts = LANG === 'ko' ? convertHourCountsToKST(data.rawHourCounts) : data.rawHourCounts;
  var timePeriods = getTimePeriodCounts(hourCounts);

  var replacements = {
    '{{TOTAL_MESSAGES}}': fmt(data.totalMessages),
    '{{TOTAL_SESSIONS}}': fmt(data.totalSessions),
    '{{DATE_FROM}}': data.dateFrom,
    '{{DATE_TO}}': data.dateTo,
    '{{DATE_RANGE}}': data.dateRange || '',
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

  // Time of day bars
  var maxTimePeriod = Math.max.apply(null, Object.values(timePeriods).concat([1]));
  var timeBarHtml = Object.keys(timePeriods).map(function(label) {
    var count = timePeriods[label];
    var width = ((count / maxTimePeriod) * 100).toFixed(1);
    return '      <div class="bar-row">\n        <div class="bar-label">' + label + '</div>\n        <div class="bar-track"><div class="bar-fill" style="width:' + width + '%;background:#8b5cf6"></div></div>\n        <div class="bar-value">' + fmt(count) + '</div>\n      </div>';
  }).join('\n');
  html = html.split('{{CHART_TIME_OF_DAY}}').join(timeBarHtml);

  var responseData = data.charts['User Response Time Distribution'] || [];
  html = html.split('{{CHART_RESPONSE_TIME}}').join(generateBarRows(responseData));

  // SVG Donuts
  var toolData = (data.charts['Top Tools Used'] || []).map(function(b) { return { label: b.label, value: b.value }; });
  html = html.split('{{DONUT_TOOLS}}').join(generateDonutSVG(toolData));

  var langData = (data.charts['Languages'] || []).map(function(b) { return { label: b.label, value: b.value }; });
  html = html.split('{{DONUT_LANGUAGES}}').join(generateDonutSVG(langData));

  // Repeating blocks
  var bigWinMatch = html.match(/{{#EACH_BIG_WIN}}([\s\S]*?){{\/EACH_BIG_WIN}}/);
  if (bigWinMatch) {
    var winHtml = data.bigWins.map(function(w) {
      return bigWinMatch[1].split('{{WIN_TITLE}}').join(w.title).split('{{WIN_DESC}}').join(w.desc);
    }).join('\n');
    html = html.replace(/{{#EACH_BIG_WIN}}[\s\S]*?{{\/EACH_BIG_WIN}}/, winHtml);
  }

  var frictionMatch = html.match(/{{#EACH_FRICTION}}([\s\S]*?){{\/EACH_FRICTION}}/);
  if (frictionMatch) {
    var frictionHtml = data.frictions.map(function(f) {
      var exHtml = f.examples.map(function(e) { return '<li>' + e + '</li>'; }).join('\n            ');
      return frictionMatch[1].split('{{FRICTION_TITLE}}').join(f.title).split('{{FRICTION_DESC}}').join(f.desc).split('{{FRICTION_EXAMPLES}}').join(exHtml);
    }).join('\n');
    html = html.replace(/{{#EACH_FRICTION}}[\s\S]*?{{\/EACH_FRICTION}}/, frictionHtml);
  }

  var featureMatch = html.match(/{{#EACH_FEATURE}}([\s\S]*?){{\/EACH_FEATURE}}/);
  if (featureMatch) {
    var featureHtml = data.features.map(function(f) {
      return featureMatch[1].split('{{FEATURE_TITLE}}').join(f.title).split('{{FEATURE_DESC}}').join(f.desc).split('{{FEATURE_WHY}}').join(f.why);
    }).join('\n');
    html = html.replace(/{{#EACH_FEATURE}}[\s\S]*?{{\/EACH_FEATURE}}/, featureHtml);
  }

  var horizonMatch = html.match(/{{#EACH_HORIZON}}([\s\S]*?){{\/EACH_HORIZON}}/);
  if (horizonMatch) {
    var horizonHtml = data.horizons.map(function(h) {
      return horizonMatch[1].split('{{HORIZON_TITLE}}').join(h.title).split('{{HORIZON_DESC}}').join(h.desc).split('{{HORIZON_TIP}}').join(h.tip);
    }).join('\n');
    html = html.replace(/{{#EACH_HORIZON}}[\s\S]*?{{\/EACH_HORIZON}}/, horizonHtml);
  }

  var areaMatch = html.match(/{{#EACH_PROJECT_AREA}}([\s\S]*?){{\/EACH_PROJECT_AREA}}/);
  if (areaMatch) {
    var areaHtml = data.projectAreas.map(function(a) {
      return areaMatch[1].split('{{AREA_NAME}}').join(a.name).split('{{AREA_COUNT}}').join(a.count).split('{{AREA_DESC}}').join(a.desc);
    }).join('\n');
    html = html.replace(/{{#EACH_PROJECT_AREA}}[\s\S]*?{{\/EACH_PROJECT_AREA}}/, areaHtml);
  }

  // Sidebar
  var topTools = (data.charts['Top Tools Used'] || []).slice(0, 5);
  var sidebarToolsHtml = topTools.map(function(t) {
    return '      <div class="sidebar-stat"><span class="sidebar-stat-label">' + t.label + '</span><span class="sidebar-stat-value">' + fmt(t.value) + '</span></div>';
  }).join('\n');
  html = html.split('{{SIDEBAR_TOP_TOOLS}}').join(sidebarToolsHtml);

  var topLangs = (data.charts['Languages'] || []).slice(0, 5);
  var sidebarLangsHtml = topLangs.map(function(l) {
    return '      <div class="sidebar-stat"><span class="sidebar-stat-label">' + l.label + '</span><span class="sidebar-stat-value">' + fmt(l.value) + '</span></div>';
  }).join('\n');
  html = html.split('{{SIDEBAR_LANGUAGES}}').join(sidebarLangsHtml);

  var totalToolCalls = (data.charts['Top Tools Used'] || []).reduce(function(s, t) { return s + t.value; }, 0);
  html = html.split('{{TOTAL_TOOL_CALLS}}').join(fmt(totalToolCalls));

  return html;
}

// ── Main ──
function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(L.log.notFound + INPUT_PATH);
    console.error('Run /insights first to generate report.html');
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(L.log.templateNotFound + TEMPLATE_PATH);
    process.exit(1);
  }

  console.log(L.log.parsing);
  var reportHtml = fs.readFileSync(INPUT_PATH, 'utf-8');
  var data = parseReport(reportHtml);
  calculateDerived(data);

  console.log(L.log.extracted);
  console.log(L.log.messages + fmt(data.totalMessages));
  console.log(L.log.sessions + fmt(data.totalSessions));
  console.log(L.log.period + data.dateRange);
  console.log(L.log.bigWins + data.bigWins.length);
  console.log(L.log.frictions + data.frictions.length);
  console.log(L.log.features + data.features.length);
  console.log(L.log.horizons + data.horizons.length);
  console.log(L.log.charts + Object.keys(data.charts).length);

  console.log(L.log.rendering);
  var template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  var output = renderTemplate(template, data);

  fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log(L.log.done + OUTPUT_PATH);
  console.log(L.log.openWith + OUTPUT_PATH);
}

main();

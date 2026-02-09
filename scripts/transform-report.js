#!/usr/bin/env node
/**
 * transform-report.js
 *
 * Modes:
 *   --extract              Parse report.html → JSON (stdout or --out file)
 *   --render --lang en|ko  Render JSON data → dark-mode HTML dashboard
 *                          Reads from --data file or stdin
 *   (no mode flags)        Legacy: extract + render in one step (English only labels)
 *
 * No external dependencies (Node.js fs, path only)
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}
const hasFlag = (name) => args.includes(name);

const MODE_EXTRACT = hasFlag('--extract');
const MODE_RENDER = hasFlag('--render');
const LANG = getArg('--lang') || 'en';
const DATA_PATH = getArg('--data');
const OUT_PATH = getArg('--out');

const USAGE_DIR = path.join(process.env.HOME, '.claude', 'usage-data');
const SCRIPT_DIR = __dirname;

// ── i18n ──
const I18N = {
  en: {
    sessionType: {},
    frictionType: {},
    errorType: {},
    timePeriodKeys: { morning: 'Morning (6-12)', afternoon: 'Afternoon (12-18)', evening: 'Evening (18-24)', night: 'Night (0-6)' },
    noData: 'No data',
    total: 'Total',
    locale: 'en-US'
  },
  ko: {
    sessionType: { 'Iterative Refinement': '반복 개선', 'Multi Task': '다중 작업', 'Exploration': '탐색', 'Quick Question': '빠른 질문', 'Single Task': '단일 작업', 'Debugging': '디버깅', 'Code Review': '코드 리뷰' },
    frictionType: { 'Wrong Approach': '잘못된 접근', 'Misunderstood Request': '요청 오해', 'Slow Response': '느린 응답', 'Tool Error': '도구 오류' },
    errorType: { 'Command Failed': '명령 실패', 'Other': '기타', 'File Not Found': '파일 미발견', 'User Rejected': '사용자 거부', 'File Too Large': '파일 과대', 'Edit Failed': '편집 실패' },
    timePeriodKeys: { morning: '오전 (6-12)', afternoon: '오후 (12-18)', evening: '저녁 (18-24)', night: '심야 (0-6)' },
    noData: '데이터 없음',
    total: '전체',
    locale: 'ko-KR'
  }
};

const L = I18N[LANG] || I18N.en;

// ── Utility ──
function num(str) { return str ? (parseInt(str.replace(/,/g, ''), 10) || 0) : 0; }
function fmt(n) { return n.toLocaleString(L.locale); }
function escapeHtml(s) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'); }

// ── Parse report.html → data object ──
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
  while ((m = statsRegex.exec(html)) !== null) { data.stats[m[2].trim().toLowerCase()] = m[1].trim(); }

  const linesStr = data.stats['lines'] || '+0/-0';
  const linesMatch = linesStr.match(/\+?([\d,]+)\s*\/\s*-?([\d,]+)/);
  data.linesAdded = linesMatch ? num(linesMatch[1]) : 0;
  data.linesRemoved = linesMatch ? num(linesMatch[2]) : 0;
  data.filesChanged = num(data.stats['files'] || '0');
  data.days = num(data.stats['days'] || '0');

  data.glance = {};
  const glanceSections = html.match(/<div class="glance-section">[\s\S]*?<\/div>/g) || [];
  for (const sec of glanceSections) {
    const strongMatch = sec.match(/<strong>(.*?)<\/strong>/);
    const textMatch = sec.match(/<\/strong>([\s\S]*?)(?:<a |$)/);
    if (strongMatch) { data.glance[strongMatch[1].replace(/:$/, '').trim().toLowerCase()] = textMatch ? textMatch[1].replace(/<[^>]+>/g, '').trim() : ''; }
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
    while ((bm = barRegex.exec(rest)) !== null) { bars.push({ label: bm[1].trim(), width: parseFloat(bm[2]), color: bm[3], value: num(bm[4]) }); }
    if (bars.length > 0) data.charts[chartTitle] = bars;
  }

  data.bigWins = [];
  const winRegex = /<div class="big-win-title">(.*?)<\/div>\s*<div class="big-win-desc">([\s\S]*?)<\/div>/g;
  while ((m = winRegex.exec(html)) !== null) { data.bigWins.push({ title: m[1].trim(), desc: m[2].trim() }); }

  data.frictions = [];
  const frictionRegex = /<div class="friction-title">(.*?)<\/div>\s*<div class="friction-desc">([\s\S]*?)<\/div>\s*(?:<ul class="friction-examples">([\s\S]*?)<\/ul>)?/g;
  while ((m = frictionRegex.exec(html)) !== null) {
    const examples = [];
    if (m[3]) { const liRegex = /<li>([\s\S]*?)<\/li>/g; let li; while ((li = liRegex.exec(m[3])) !== null) examples.push(li[1].trim()); }
    data.frictions.push({ title: m[1].trim(), desc: m[2].trim(), examples });
  }

  data.features = [];
  const featureRegex = /<div class="feature-title">(.*?)<\/div>\s*<div class="feature-oneliner">([\s\S]*?)<\/div>\s*<div class="feature-why">([\s\S]*?)<\/div>/g;
  while ((m = featureRegex.exec(html)) !== null) { data.features.push({ title: m[1].trim(), desc: m[2].trim(), why: m[3].trim() }); }

  data.horizons = [];
  const horizonRegex = /<div class="horizon-title">(.*?)<\/div>\s*<div class="horizon-possible">([\s\S]*?)<\/div>\s*<div class="horizon-tip">([\s\S]*?)<\/div>/g;
  while ((m = horizonRegex.exec(html)) !== null) { data.horizons.push({ title: m[1].trim(), desc: m[2].trim(), tip: m[3].trim() }); }

  const narrativeBlock = html.match(/<div class="narrative">([\s\S]*?)<\/div>\s*(?:<div class="key-insight">|$)/);
  data.narrative = '';
  if (narrativeBlock) { const pRegex = /<p>([\s\S]*?)<\/p>/g; const ps = []; while ((m = pRegex.exec(narrativeBlock[1])) !== null) ps.push(m[1].replace(/<[^>]+>/g, '').trim()); data.narrative = ps.join('\n\n'); }

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
    const label = m[2].trim(); const val = m[1].replace('%', '').replace(/,/g, '');
    if (label.includes('Overlap')) data.multiClauding.overlapEvents = parseInt(val) || 0;
    else if (label.includes('Sessions')) data.multiClauding.sessionsInvolved = parseInt(val) || 0;
    else if (label.includes('Messages')) data.multiClauding.pctMessages = parseInt(val) || 0;
  }

  const funHeadline = html.match(/<div class="fun-headline">([\s\S]*?)<\/div>/);
  const funDetail = html.match(/<div class="fun-detail">([\s\S]*?)<\/div>/);
  data.funEnding = { headline: funHeadline ? funHeadline[1].replace(/<[^>]+>/g, '').trim() : '', detail: funDetail ? funDetail[1].replace(/<[^>]+>/g, '').trim() : '' };

  data.projectAreas = [];
  const areaRegex = /<span class="area-name">(.*?)<\/span>\s*<span class="area-count">(.*?)<\/span>[\s\S]*?<div class="area-desc">([\s\S]*?)<\/div>/g;
  while ((m = areaRegex.exec(html)) !== null) { data.projectAreas.push({ name: escapeHtml(m[1].trim()), count: m[2].trim(), desc: m[3].trim() }); }

  const winsIntro = html.match(/<h2 id="section-wins">[\s\S]*?<p class="section-intro">([\s\S]*?)<\/p>/);
  data.winsIntro = winsIntro ? winsIntro[1].trim() : '';
  const frictionIntro = html.match(/<h2 id="section-friction">[\s\S]*?<p class="section-intro">([\s\S]*?)<\/p>/);
  data.frictionIntro = frictionIntro ? frictionIntro[1].trim() : '';
  const horizonIntro = html.match(/<h2 id="section-horizon">[\s\S]*?<p class="section-intro">([\s\S]*?)<\/p>/);
  data.horizonIntro = horizonIntro ? horizonIntro[1].trim() : '';

  return data;
}

// ── Time helpers ──
function convertHourCountsToKST(raw) {
  const kst = {};
  for (const [h, c] of Object.entries(raw)) { const k = (parseInt(h) + 17) % 24; kst[k] = (kst[k] || 0) + c; }
  return kst;
}

function getTimePeriodCounts(hourCounts) {
  const k = L.timePeriodKeys;
  const p = { [k.morning]: 0, [k.afternoon]: 0, [k.evening]: 0, [k.night]: 0 };
  for (const [hour, count] of Object.entries(hourCounts)) {
    const h = parseInt(hour);
    if (h >= 6 && h < 12) p[k.morning] += count;
    else if (h >= 12 && h < 18) p[k.afternoon] += count;
    else if (h >= 18 && h < 24) p[k.evening] += count;
    else p[k.night] += count;
  }
  return p;
}

// ── Bar / Donut HTML ──
function translateLabel(label) { return L.sessionType[label] || L.frictionType[label] || L.errorType[label] || label; }

function generateBarRows(bars) {
  if (!bars || bars.length === 0) return '<div style="color:var(--text-dim);font-size:12px;">' + L.noData + '</div>';
  const mx = Math.max(...bars.map(b => b.value)) || 1;
  return bars.map(b => {
    const w = ((b.value / mx) * 100).toFixed(1);
    return '      <div class="bar-row">\n        <div class="bar-label">' + translateLabel(b.label) + '</div>\n        <div class="bar-track"><div class="bar-fill" style="width:' + w + '%;background:' + b.color + '"></div></div>\n        <div class="bar-value">' + fmt(b.value) + '</div>\n      </div>';
  }).join('\n');
}

function generateDonutSVG(items, size) {
  size = size || 120;
  var total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return '';
  var cx = size / 2, cy = size / 2, r = (size / 2) - 8, circ = 2 * Math.PI * r, offset = 0;
  var colors = ['#2f81f7', '#388bfd', '#39d2c0', '#3fb950', '#f0883e', '#db61a2', '#d29922', '#8b5cf6'];
  var segs = items.slice(0, 6).map((item, i) => { var d = (item.value / total) * circ, g = circ - d; var s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + colors[i % 8] + '" stroke-width="16" stroke-dasharray="' + d + ' ' + g + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>'; offset += d; return s; });
  var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">\n    <circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="16"/>\n    ' + segs.join('\n    ') + '\n    <text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" fill="#f0f6fc" font-size="18" font-weight="700">' + fmt(total) + '</text>\n    <text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" fill="#8b949e" font-size="10">' + L.total + '</text>\n  </svg>';
  var legend = items.slice(0, 6).map((item, i) => '<div class="legend-item"><span class="legend-dot" style="background:' + colors[i % 8] + '"></span>' + item.label + ' ' + fmt(item.value) + ' (' + ((item.value / total) * 100).toFixed(1) + '%)</div>').join('\n      ');
  return '<div class="donut-wrap">\n    ' + svg + '\n    <div class="donut-legend">\n      ' + legend + '\n    </div>\n  </div>';
}

// ── Derived values ──
function calculateDerived(data) {
  var days = data.days || 1;
  data.sessionsPerDay = (data.totalSessions / days).toFixed(1);
  data.messagesPerDay = (data.totalMessages / days).toFixed(1);
  if (data.dateFrom && data.dateTo) {
    data.totalDays = Math.ceil((new Date(data.dateTo) - new Date(data.dateFrom)) / 86400000) + 1;
    data.dateRange = LANG === 'ko' ? data.dateFrom + ' ~ ' + data.dateTo : data.dateFrom + ' to ' + data.dateTo;
  }
}

// ── Render template ──
function renderTemplate(template, data) {
  var html = template;
  var hourCounts = LANG === 'ko' ? convertHourCountsToKST(data.rawHourCounts) : data.rawHourCounts;
  var timePeriods = getTimePeriodCounts(hourCounts);

  var reps = {
    '{{TOTAL_MESSAGES}}': fmt(data.totalMessages), '{{TOTAL_SESSIONS}}': fmt(data.totalSessions),
    '{{DATE_FROM}}': data.dateFrom, '{{DATE_TO}}': data.dateTo, '{{DATE_RANGE}}': data.dateRange || '',
    '{{TOTAL_DAYS}}': String(data.totalDays || data.days),
    '{{LINES_ADDED}}': fmt(data.linesAdded), '{{LINES_REMOVED}}': fmt(data.linesRemoved),
    '{{FILES_CHANGED}}': fmt(data.filesChanged),
    '{{SESSIONS_PER_DAY}}': data.sessionsPerDay, '{{MESSAGES_PER_DAY}}': data.messagesPerDay,
    '{{MEDIAN_RESPONSE}}': String(data.medianResponseTime), '{{AVG_RESPONSE}}': String(data.avgResponseTime),
    '{{MULTI_OVERLAP}}': fmt(data.multiClauding.overlapEvents),
    '{{MULTI_SESSIONS}}': fmt(data.multiClauding.sessionsInvolved),
    '{{MULTI_PCT}}': String(data.multiClauding.pctMessages),
    '{{NARRATIVE}}': data.narrative, '{{KEY_INSIGHT}}': data.keyInsight,
    '{{WINS_INTRO}}': data.winsIntro, '{{FRICTION_INTRO}}': data.frictionIntro, '{{HORIZON_INTRO}}': data.horizonIntro,
    '{{FUN_HEADLINE}}': data.funEnding.headline, '{{FUN_DETAIL}}': data.funEnding.detail,
    '{{GLANCE_WORKING}}': data.glance["what's working"] || '',
    '{{GLANCE_HINDERING}}': data.glance["what's hindering you"] || '',
    '{{GLANCE_QUICKWINS}}': data.glance["quick wins to try"] || '',
    '{{GLANCE_AMBITIOUS}}': data.glance["ambitious workflows"] || ''
  };
  for (var k in reps) html = html.split(k).join(reps[k]);

  var chartMap = { '{{CHART_TOOLS}}': 'Top Tools Used', '{{CHART_LANGUAGES}}': 'Languages', '{{CHART_SESSION_TYPES}}': 'Session Types', '{{CHART_WHAT_WANTED}}': 'What You Wanted', '{{CHART_WHAT_HELPED}}': "What Helped Most (Claude's Capabilities)", '{{CHART_OUTCOMES}}': 'Outcomes', '{{CHART_FRICTION_TYPES}}': 'Primary Friction Types', '{{CHART_SATISFACTION}}': 'Inferred Satisfaction (model-estimated)', '{{CHART_TOOL_ERRORS}}': 'Tool Errors Encountered' };
  for (var p in chartMap) html = html.split(p).join(generateBarRows(data.charts[chartMap[p]] || []));

  var maxTP = Math.max(...Object.values(timePeriods), 1);
  var tpHtml = Object.entries(timePeriods).map(([label, count]) => '      <div class="bar-row">\n        <div class="bar-label">' + label + '</div>\n        <div class="bar-track"><div class="bar-fill" style="width:' + ((count / maxTP) * 100).toFixed(1) + '%;background:#8b5cf6"></div></div>\n        <div class="bar-value">' + fmt(count) + '</div>\n      </div>').join('\n');
  html = html.split('{{CHART_TIME_OF_DAY}}').join(tpHtml);
  html = html.split('{{CHART_RESPONSE_TIME}}').join(generateBarRows(data.charts['User Response Time Distribution'] || []));

  html = html.split('{{DONUT_TOOLS}}').join(generateDonutSVG((data.charts['Top Tools Used'] || []).map(b => ({ label: b.label, value: b.value }))));
  html = html.split('{{DONUT_LANGUAGES}}').join(generateDonutSVG((data.charts['Languages'] || []).map(b => ({ label: b.label, value: b.value }))));

  // Repeating blocks
  function renderBlock(tag, items, replacer) {
    var re = new RegExp('\\{\\{#' + tag + '\\}\\}([\\s\\S]*?)\\{\\{\\/' + tag + '\\}\\}');
    var match = html.match(re);
    if (match) { html = html.replace(re, items.map(item => replacer(match[1], item)).join('\n')); }
  }
  renderBlock('EACH_BIG_WIN', data.bigWins, (tpl, w) => tpl.split('{{WIN_TITLE}}').join(w.title).split('{{WIN_DESC}}').join(w.desc));
  renderBlock('EACH_FRICTION', data.frictions, (tpl, f) => { var ex = f.examples.map(e => '<li>' + e + '</li>').join('\n            '); return tpl.split('{{FRICTION_TITLE}}').join(f.title).split('{{FRICTION_DESC}}').join(f.desc).split('{{FRICTION_EXAMPLES}}').join(ex); });
  renderBlock('EACH_FEATURE', data.features, (tpl, f) => tpl.split('{{FEATURE_TITLE}}').join(f.title).split('{{FEATURE_DESC}}').join(f.desc).split('{{FEATURE_WHY}}').join(f.why));
  renderBlock('EACH_HORIZON', data.horizons, (tpl, h) => tpl.split('{{HORIZON_TITLE}}').join(h.title).split('{{HORIZON_DESC}}').join(h.desc).split('{{HORIZON_TIP}}').join(h.tip));
  renderBlock('EACH_PROJECT_AREA', data.projectAreas, (tpl, a) => tpl.split('{{AREA_NAME}}').join(a.name).split('{{AREA_COUNT}}').join(a.count).split('{{AREA_DESC}}').join(a.desc));

  // Sidebar
  html = html.split('{{SIDEBAR_TOP_TOOLS}}').join((data.charts['Top Tools Used'] || []).slice(0, 5).map(t => '      <div class="sidebar-stat"><span class="sidebar-stat-label">' + t.label + '</span><span class="sidebar-stat-value">' + fmt(t.value) + '</span></div>').join('\n'));
  html = html.split('{{SIDEBAR_LANGUAGES}}').join((data.charts['Languages'] || []).slice(0, 5).map(l => '      <div class="sidebar-stat"><span class="sidebar-stat-label">' + l.label + '</span><span class="sidebar-stat-value">' + fmt(l.value) + '</span></div>').join('\n'));
  html = html.split('{{TOTAL_TOOL_CALLS}}').join(fmt((data.charts['Top Tools Used'] || []).reduce((s, t) => s + t.value, 0)));

  return html;
}

// ── Main ──
function main() {
  // Mode: --extract
  if (MODE_EXTRACT) {
    const inputPath = path.join(USAGE_DIR, 'report.html');
    if (!fs.existsSync(inputPath)) { console.error('[insights-ui] report.html not found. Run /insights first.'); process.exit(1); }
    const data = parseReport(fs.readFileSync(inputPath, 'utf-8'));
    calculateDerived(data);
    const json = JSON.stringify(data, null, 2);
    if (OUT_PATH) {
      fs.writeFileSync(OUT_PATH, json, 'utf-8');
      console.error('[insights-ui] Extracted to ' + OUT_PATH);
    } else {
      process.stdout.write(json);
    }
    return;
  }

  // Mode: --render
  if (MODE_RENDER) {
    if (!['en', 'ko'].includes(LANG)) { console.error('[insights-ui] Unsupported lang: ' + LANG); process.exit(1); }
    const templatePath = path.join(SCRIPT_DIR, '..', 'templates', 'report-' + LANG + '-template.html');
    if (!fs.existsSync(templatePath)) { console.error('[insights-ui] Template not found: ' + templatePath); process.exit(1); }

    let data;
    if (DATA_PATH) {
      data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    } else {
      // read from stdin
      const chunks = [];
      const fd = fs.openSync('/dev/stdin', 'r');
      const buf = Buffer.alloc(65536);
      let n;
      while ((n = fs.readSync(fd, buf)) > 0) chunks.push(buf.slice(0, n));
      fs.closeSync(fd);
      data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    }

    calculateDerived(data);
    const template = fs.readFileSync(templatePath, 'utf-8');
    const output = renderTemplate(template, data);
    const outPath = path.join(USAGE_DIR, 'report-' + LANG + '.html');
    fs.writeFileSync(outPath, output, 'utf-8');
    console.log('[insights-ui] Done: ' + outPath);
    return;
  }

  // Legacy mode: --lang only (no --extract/--render)
  if (!['en', 'ko'].includes(LANG)) { console.error('[insights-ui] Unsupported lang: ' + LANG); process.exit(1); }
  const inputPath = path.join(USAGE_DIR, 'report.html');
  if (!fs.existsSync(inputPath)) { console.error('[insights-ui] report.html not found. Run /insights first.'); process.exit(1); }
  const templatePath = path.join(SCRIPT_DIR, '..', 'templates', 'report-' + LANG + '-template.html');
  if (!fs.existsSync(templatePath)) { console.error('[insights-ui] Template not found: ' + templatePath); process.exit(1); }

  const data = parseReport(fs.readFileSync(inputPath, 'utf-8'));
  calculateDerived(data);
  const output = renderTemplate(fs.readFileSync(templatePath, 'utf-8'), data);
  const outPath = path.join(USAGE_DIR, 'report-' + LANG + '.html');
  fs.writeFileSync(outPath, output, 'utf-8');
  console.log('[insights-ui] Done: ' + outPath);
}

main();

import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
} from "remotion";
import type { InsightsData, ChartItem } from "./types";

const BG = "#0f172a";
const CARD_BG = "#1e293b";
const ACCENT = "#60a5fa";
const WHITE = "#f8fafc";
const MUTED = "#94a3b8";
const GREEN = "#34d399";
const CYAN = "#06b6d4";
const PURPLE = "#a78bfa";

const baseStyle: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: WHITE,
};

// ── Animated Counter ──
const Counter: React.FC<{ value: number; suffix?: string; delay?: number }> = ({
  value,
  suffix = "",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 30 } });
  const display = Math.round(value * Math.min(progress, 1));
  return <>{display.toLocaleString()}{suffix}</>;
};

// ── Scene 1: Title ──
const TitleScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleOpacity = spring({ frame, fps, config: { damping: 20 } });
  const subtitleOpacity = spring({ frame: frame - 15, fps, config: { damping: 20 } });
  const lineWidth = interpolate(frame, [20, 60], [0, 400], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        ...baseStyle,
        background: `radial-gradient(ellipse at 50% 40%, #1e3a5f 0%, ${BG} 70%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            opacity: titleOpacity,
            transform: `translateY(${interpolate(titleOpacity, [0, 1], [30, 0])}px)`,
            letterSpacing: "-1px",
          }}
        >
          Claude Code Insights
        </div>
        <div
          style={{
            width: lineWidth,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
            margin: "20px auto",
          }}
        />
        <div
          style={{
            fontSize: 28,
            color: MUTED,
            opacity: subtitleOpacity,
            transform: `translateY(${interpolate(subtitleOpacity, [0, 1], [20, 0])}px)`,
          }}
        >
          {data.dateFrom} ~ {data.dateTo}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: Key Stats ──
const StatsScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    { label: "Messages", value: data.totalMessages, color: ACCENT },
    { label: "Sessions", value: data.totalSessions, color: CYAN },
    { label: "Files Changed", value: data.filesChanged, color: GREEN },
    { label: "Active Days", value: data.days, color: PURPLE },
  ];

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontSize: 42, fontWeight: 700, marginBottom: 60, opacity: spring({ frame, fps, config: { damping: 20 } }) }}>
        Overview
      </div>
      <div style={{ display: "flex", gap: 40 }}>
        {items.map((item, i) => {
          const delay = i * 8;
          const scale = spring({ frame: frame - delay, fps, config: { damping: 15 } });
          return (
            <div
              key={item.label}
              style={{
                background: CARD_BG,
                borderRadius: 16,
                padding: "40px 50px",
                textAlign: "center",
                transform: `scale(${scale})`,
                opacity: scale,
                border: `1px solid ${item.color}33`,
              }}
            >
              <div style={{ fontSize: 56, fontWeight: 800, color: item.color }}>
                <Counter value={item.value} delay={delay + 10} />
              </div>
              <div style={{ fontSize: 20, color: MUTED, marginTop: 10 }}>{item.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 3: Top Tools Bar Chart ──
const ToolsScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tools = (data.charts["Top Tools Used"] || []).slice(0, 6);
  const maxVal = tools.length > 0 ? tools[0].value : 1;

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG, justifyContent: "center", padding: "0 200px" }}>
      <div style={{ fontSize: 42, fontWeight: 700, marginBottom: 50, opacity: spring({ frame, fps }) }}>
        Top Tools Used
      </div>
      {tools.map((tool, i) => {
        const delay = 10 + i * 6;
        const barProgress = spring({ frame: frame - delay, fps, config: { damping: 20 } });
        const barWidth = (tool.value / maxVal) * 100 * barProgress;
        return (
          <div key={tool.label} style={{ display: "flex", alignItems: "center", marginBottom: 20, opacity: barProgress }}>
            <div style={{ width: 160, fontSize: 20, color: MUTED, textAlign: "right", paddingRight: 20 }}>
              {tool.label}
            </div>
            <div style={{ flex: 1, height: 36, background: `${CARD_BG}`, borderRadius: 8, overflow: "hidden" }}>
              <div
                style={{
                  width: `${barWidth}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${tool.color}, ${tool.color}99)`,
                  borderRadius: 8,
                  transition: "none",
                }}
              />
            </div>
            <div style={{ width: 120, fontSize: 20, fontWeight: 600, color: WHITE, paddingLeft: 16 }}>
              {Math.round(tool.value * barProgress).toLocaleString()}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Scene 4: Languages Donut ──
const LanguagesScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const langs = (data.charts["Languages"] || []).slice(0, 6);
  const total = langs.reduce((s, l) => s + l.value, 0);
  const colors = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"];
  const sweepProgress = spring({ frame: frame - 5, fps, config: { damping: 25, mass: 2 } });

  let cumAngle = -90;
  const segments = langs.map((lang, i) => {
    const angle = (lang.value / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    return { ...lang, startAngle, angle, color: colors[i % colors.length] };
  });

  const r = 160;
  const cx = 480;
  const cy = 400;

  function describeArc(startAngle: number, endAngle: number, radius: number): string {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG }}>
      <div style={{ position: "absolute", top: 80, left: 200, fontSize: 42, fontWeight: 700, opacity: spring({ frame, fps }) }}>
        Languages
      </div>
      <svg width={960} height={800} style={{ position: "absolute", left: 0, top: 100 }}>
        {segments.map((seg, i) => {
          const endAngle = seg.startAngle + seg.angle * sweepProgress;
          return (
            <path
              key={i}
              d={describeArc(seg.startAngle, endAngle, r)}
              fill={seg.color}
              opacity={0.9}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={80} fill={BG} />
      </svg>
      <div style={{ position: "absolute", right: 200, top: 200, display: "flex", flexDirection: "column", gap: 16 }}>
        {segments.map((seg, i) => {
          const delay = 15 + i * 5;
          const opacity = spring({ frame: frame - delay, fps });
          const pct = ((seg.value / total) * 100).toFixed(1);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: seg.color }} />
              <div style={{ fontSize: 22, color: WHITE }}>{seg.label}</div>
              <div style={{ fontSize: 22, color: MUTED, marginLeft: 8 }}>{pct}%</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 5: Big Wins ──
const WinsScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wins = data.bigWins.slice(0, 3);

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG, justifyContent: "center", padding: "0 160px" }}>
      <div style={{ fontSize: 42, fontWeight: 700, marginBottom: 40, opacity: spring({ frame, fps }), color: GREEN }}>
        Big Wins
      </div>
      {wins.map((win, i) => {
        const delay = 10 + i * 15;
        const slideIn = spring({ frame: frame - delay, fps, config: { damping: 20 } });
        return (
          <div
            key={i}
            style={{
              background: CARD_BG,
              borderRadius: 12,
              padding: "24px 32px",
              marginBottom: 16,
              borderLeft: `4px solid ${GREEN}`,
              opacity: slideIn,
              transform: `translateX(${interpolate(slideIn, [0, 1], [60, 0])}px)`,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{win.title}</div>
            <div style={{ fontSize: 17, color: MUTED, lineHeight: 1.5, maxHeight: 60, overflow: "hidden" }}>
              {win.desc.slice(0, 150)}...
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Scene 6: Key Insight ──
const InsightScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame, fps, config: { damping: 20 } });

  return (
    <AbsoluteFill
      style={{
        ...baseStyle,
        background: `radial-gradient(ellipse at 50% 50%, #1e293b 0%, ${BG} 70%)`,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 200px",
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: ACCENT,
          textTransform: "uppercase",
          letterSpacing: 4,
          marginBottom: 30,
          opacity,
        }}
      >
        Key Insight
      </div>
      <div
        style={{
          fontSize: 30,
          lineHeight: 1.6,
          textAlign: "center",
          color: WHITE,
          opacity,
          transform: `translateY(${interpolate(opacity, [0, 1], [20, 0])}px)`,
          maxWidth: 1200,
        }}
      >
        {data.keyInsight}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 7: Fun Ending ──
const EndingScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  const badgeOpacity = spring({ frame: frame - 40, fps });

  return (
    <AbsoluteFill
      style={{
        ...baseStyle,
        background: `radial-gradient(ellipse at 50% 60%, #1a2744 0%, ${BG} 70%)`,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 200px",
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontStyle: "italic",
          textAlign: "center",
          color: "#fbbf24",
          opacity,
          lineHeight: 1.5,
          maxWidth: 1000,
        }}
      >
        {data.funEnding.headline}
      </div>
      <div
        style={{
          marginTop: 60,
          fontSize: 16,
          color: MUTED,
          opacity: badgeOpacity,
          letterSpacing: 2,
        }}
      >
        Powered by Claude Code
      </div>
    </AbsoluteFill>
  );
};

// ── Main Composition ──
export const InsightsVideo: React.FC<InsightsData> = (props) => {
  const data = props;
  if (!data.totalMessages) {
    return (
      <AbsoluteFill style={{ ...baseStyle, background: BG, justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 32, color: MUTED }}>
          No data provided. Use --props to pass insights JSON.
        </div>
      </AbsoluteFill>
    );
  }

  // Scene timing: total 900 frames (30s at 30fps)
  const scenes = [
    { from: 0, duration: 120, Component: TitleScene },     // 0-4s
    { from: 120, duration: 150, Component: StatsScene },    // 4-9s
    { from: 270, duration: 180, Component: ToolsScene },    // 9-15s
    { from: 450, duration: 150, Component: LanguagesScene },// 15-20s
    { from: 600, duration: 120, Component: WinsScene },     // 20-24s
    { from: 720, duration: 90, Component: InsightScene },   // 24-27s
    { from: 810, duration: 90, Component: EndingScene },    // 27-30s
  ];

  return (
    <AbsoluteFill style={{ background: BG }}>
      {scenes.map(({ from, duration, Component }, i) => (
        <Sequence key={i} from={from} durationInFrames={duration}>
          <FadeTransition>
            <Component data={data} />
          </FadeTransition>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// ── Fade transition wrapper ──
const FadeTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {children}
    </AbsoluteFill>
  );
};

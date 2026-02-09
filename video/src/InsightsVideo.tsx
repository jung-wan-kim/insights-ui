import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
  Easing,
} from "remotion";
import type { InsightsData } from "./types";
import React, { useMemo } from "react";

const BG = "#0a0e1a";
const CARD_BG = "#131a2e";
const ACCENT = "#60a5fa";
const WHITE = "#f0f4ff";
const MUTED = "#7b8ba8";
const GREEN = "#34d399";
const CYAN = "#22d3ee";
const PURPLE = "#a78bfa";
const YELLOW = "#fbbf24";
const PINK = "#f472b6";

const baseStyle: React.CSSProperties = {
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: WHITE,
};

// ── Seeded random for deterministic particles ──
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ── Particle Field (background layer) ──
const ParticleField: React.FC<{
  count?: number;
  color?: string;
  speed?: number;
  seed?: number;
}> = ({ count = 60, color = ACCENT, speed = 1, seed = 0 }) => {
  const frame = useCurrentFrame();
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      x: seededRandom(i + seed) * 1920,
      y: seededRandom(i + seed + 100) * 1080,
      size: seededRandom(i + seed + 200) * 4 + 1,
      speedX: (seededRandom(i + seed + 300) - 0.5) * 2 * speed,
      speedY: (seededRandom(i + seed + 400) - 0.5) * 1.5 * speed,
      opacity: seededRandom(i + seed + 500) * 0.5 + 0.1,
      pulse: seededRandom(i + seed + 600) * 3 + 1,
    }));
  }, [count, speed, seed]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {particles.map((p, i) => {
        const px = ((p.x + p.speedX * frame) % 1920 + 1920) % 1920;
        const py = ((p.y + p.speedY * frame) % 1080 + 1080) % 1080;
        const pulseOp = p.opacity * (0.6 + 0.4 * Math.sin(frame * 0.05 * p.pulse));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: color,
              opacity: pulseOp,
              boxShadow: p.size > 3 ? `0 0 ${p.size * 3}px ${color}` : "none",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ── Glow Orbs (ambient background) ──
const GlowOrbs: React.FC<{ colors?: string[] }> = ({
  colors = [ACCENT, PURPLE, CYAN],
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", filter: "blur(80px)", opacity: 0.15 }}>
      {colors.map((c, i) => {
        const angle = frame * 0.008 + (i * Math.PI * 2) / colors.length;
        const x = 960 + Math.cos(angle) * 400;
        const y = 540 + Math.sin(angle * 0.7) * 250;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 200,
              top: y - 200,
              width: 400,
              height: 400,
              borderRadius: "50%",
              background: c,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ── Speed Lines ──
const SpeedLines: React.FC<{ direction?: "left" | "right"; intensity?: number }> = ({
  direction = "right",
  intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const lines = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      y: seededRandom(i + 700) * 1080,
      width: seededRandom(i + 800) * 300 + 100,
      opacity: seededRandom(i + 900) * 0.15 * intensity,
      speed: seededRandom(i + 1000) * 15 + 10,
    }));
  }, [intensity]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {lines.map((l, i) => {
        const progress = (frame * l.speed) % 2400;
        const x = direction === "right" ? progress - 400 : 1920 - progress + 400;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: l.y,
              width: l.width,
              height: 1,
              background: `linear-gradient(${direction === "right" ? "90deg" : "270deg"}, transparent, ${WHITE}40, transparent)`,
              opacity: l.opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ── Animated Counter ──
const Counter: React.FC<{ value: number; delay?: number }> = ({
  value,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 30, mass: 0.8 } });
  const display = Math.round(value * Math.min(progress, 1));
  return <>{display.toLocaleString()}</>;
};

// ── Scene 1: Title (Cinematic) ──
const TitleScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, 120], [1.1, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const titleY = spring({ frame: frame - 10, fps, config: { damping: 12, mass: 0.6 } });
  const lineScale = interpolate(frame, [25, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subY = spring({ frame: frame - 30, fps, config: { damping: 15 } });
  const glowPulse = 0.3 + 0.2 * Math.sin(frame * 0.08);

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG, transform: `scale(${zoom})` }}>
      <GlowOrbs colors={[ACCENT, "#4f46e5", CYAN]} />
      <ParticleField count={80} color={ACCENT} speed={0.8} seed={1} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              opacity: titleY,
              transform: `translateY(${interpolate(titleY, [0, 1], [50, 0])}px)`,
              letterSpacing: "-2px",
              textShadow: `0 0 40px ${ACCENT}${Math.round(glowPulse * 255).toString(16).padStart(2, "0")}`,
            }}
          >
            Claude Code Insights
          </div>
          <div
            style={{
              width: 500 * lineScale,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${ACCENT}, ${CYAN}, transparent)`,
              margin: "24px auto",
              boxShadow: `0 0 20px ${ACCENT}80`,
            }}
          />
          <div
            style={{
              fontSize: 28,
              color: MUTED,
              opacity: subY,
              transform: `translateY(${interpolate(subY, [0, 1], [30, 0])}px)`,
              letterSpacing: 3,
            }}
          >
            {data.dateFrom} — {data.dateTo}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Scene 2: Key Stats (Explosive) ──
const StatsScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    { label: "Messages", value: data.totalMessages, color: ACCENT, icon: "💬" },
    { label: "Sessions", value: data.totalSessions, color: CYAN, icon: "⚡" },
    { label: "Files", value: data.filesChanged, color: GREEN, icon: "📁" },
    { label: "Days", value: data.days, color: PURPLE, icon: "📅" },
  ];

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG }}>
      <GlowOrbs colors={items.map((i) => i.color)} />
      <ParticleField count={50} color={CYAN} speed={1.2} seed={2} />
      <SpeedLines direction="right" intensity={0.5} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 30 }}>
          {items.map((item, i) => {
            const delay = i * 6;
            const pop = spring({ frame: frame - delay - 5, fps, config: { damping: 10, mass: 0.5, stiffness: 200 } });
            const glowIntensity = Math.sin(frame * 0.06 + i) * 0.3 + 0.7;
            return (
              <div
                key={item.label}
                style={{
                  background: `linear-gradient(135deg, ${CARD_BG}, ${item.color}15)`,
                  borderRadius: 20,
                  padding: "44px 48px",
                  textAlign: "center",
                  transform: `scale(${pop}) translateY(${interpolate(pop, [0, 1], [80, 0])}px)`,
                  opacity: pop,
                  border: `1px solid ${item.color}40`,
                  boxShadow: `0 0 ${30 * glowIntensity}px ${item.color}30, inset 0 1px 0 ${WHITE}10`,
                  minWidth: 200,
                }}
              >
                <div style={{ fontSize: 60, fontWeight: 900, color: item.color, letterSpacing: -1 }}>
                  <Counter value={item.value} delay={delay + 15} />
                </div>
                <div style={{ fontSize: 18, color: MUTED, marginTop: 8, fontWeight: 500, letterSpacing: 1 }}>
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Scene 3: Top Tools (Racing Bars) ──
const ToolsScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tools = (data.charts["Top Tools Used"] || []).slice(0, 6);
  const maxVal = tools.length > 0 ? tools[0].value : 1;
  const barColors = [CYAN, ACCENT, PURPLE, GREEN, PINK, YELLOW];

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG }}>
      <ParticleField count={30} color={CYAN} speed={2} seed={3} />
      <SpeedLines direction="right" intensity={0.8} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 180px" }}>
        <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 45, opacity: spring({ frame, fps }), letterSpacing: -1 }}>
          Top Tools
        </div>
        {tools.map((tool, i) => {
          const delay = 8 + i * 5;
          const barProgress = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 120 } });
          const barWidth = (tool.value / maxVal) * 100 * barProgress;
          const color = barColors[i % barColors.length];
          const slideX = interpolate(barProgress, [0, 1], [-40, 0]);
          return (
            <div
              key={tool.label}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 18,
                opacity: barProgress,
                transform: `translateX(${slideX}px)`,
              }}
            >
              <div style={{ width: 130, fontSize: 19, color: MUTED, textAlign: "right", paddingRight: 20, fontWeight: 500 }}>
                {tool.label}
              </div>
              <div style={{ flex: 1, height: 38, background: `${CARD_BG}`, borderRadius: 10, overflow: "hidden", position: "relative" }}>
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${color}dd, ${color})`,
                    borderRadius: 10,
                    boxShadow: `0 0 20px ${color}50`,
                    position: "relative",
                  }}
                />
                {barProgress > 0.5 && (
                  <div
                    style={{
                      position: "absolute",
                      right: `${100 - barWidth + 1}%`,
                      top: 0,
                      width: 4,
                      height: "100%",
                      background: WHITE,
                      opacity: 0.6,
                      filter: "blur(2px)",
                    }}
                  />
                )}
              </div>
              <div style={{ width: 110, fontSize: 20, fontWeight: 700, color: color, paddingLeft: 16 }}>
                {Math.round(tool.value * barProgress).toLocaleString()}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Scene 4: Languages Donut (Spinning) ──
const LanguagesScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const langs = (data.charts["Languages"] || []).slice(0, 6);
  const total = langs.reduce((s, l) => s + l.value, 0);
  const donutColors = ["#10b981", "#22d3ee", "#a78bfa", "#fbbf24", "#f472b6", "#ef4444"];
  const sweepProgress = spring({ frame: frame - 5, fps, config: { damping: 20, mass: 1.5 } });
  const rotation = interpolate(frame, [0, 150], [-10, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  let cumAngle = -90;
  const segments = langs.map((lang, i) => {
    const angle = (lang.value / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    return { ...lang, startAngle, angle, color: donutColors[i % donutColors.length] };
  });

  const svgSize = 380;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r = 155;
  const innerR = 90;

  function describeDonut(startAngle: number, endAngle: number): string {
    const toRad = (a: number) => (a * Math.PI) / 180;
    const outerX1 = cx + r * Math.cos(toRad(startAngle));
    const outerY1 = cy + r * Math.sin(toRad(startAngle));
    const outerX2 = cx + r * Math.cos(toRad(endAngle));
    const outerY2 = cy + r * Math.sin(toRad(endAngle));
    const innerX1 = cx + innerR * Math.cos(toRad(endAngle));
    const innerY1 = cy + innerR * Math.sin(toRad(endAngle));
    const innerX2 = cx + innerR * Math.cos(toRad(startAngle));
    const innerY2 = cy + innerR * Math.sin(toRad(startAngle));
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${outerX1} ${outerY1} A ${r} ${r} 0 ${large} 1 ${outerX2} ${outerY2} L ${innerX1} ${innerY1} A ${innerR} ${innerR} 0 ${large} 0 ${innerX2} ${innerY2} Z`;
  }

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG }}>
      <GlowOrbs colors={donutColors.slice(0, 3)} />
      <ParticleField count={40} color={GREEN} speed={0.6} seed={4} />
      <AbsoluteFill style={{ flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 45, opacity: spring({ frame, fps }), letterSpacing: -1 }}>
          Languages
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 80 }}>
          <div style={{ transform: `rotate(${rotation}deg)` }}>
            <svg width={svgSize} height={svgSize}>
              <defs>
                {segments.map((seg, i) => (
                  <filter key={`glow-${i}`} id={`glow-${i}`}>
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ))}
              </defs>
              {segments.map((seg, i) => {
                const endAngle = seg.startAngle + seg.angle * sweepProgress;
                if (seg.angle * sweepProgress < 0.5) return null;
                return (
                  <path
                    key={i}
                    d={describeDonut(seg.startAngle, endAngle)}
                    fill={seg.color}
                    filter={`url(#glow-${i})`}
                    opacity={0.9}
                  />
                );
              })}
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {segments.map((seg, i) => {
              const delay = 15 + i * 5;
              const slideIn = spring({ frame: frame - delay, fps, config: { damping: 15 } });
              const pct = ((seg.value / total) * 100).toFixed(1);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    opacity: slideIn,
                    transform: `translateX(${interpolate(slideIn, [0, 1], [30, 0])}px)`,
                  }}
                >
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: seg.color, boxShadow: `0 0 10px ${seg.color}80` }} />
                  <div style={{ fontSize: 22, color: WHITE, minWidth: 130, fontWeight: 500 }}>{seg.label}</div>
                  <div style={{ fontSize: 22, color: seg.color, fontWeight: 700 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Scene 5: Big Wins (Stagger Reveal) ──
const WinsScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wins = data.bigWins.slice(0, 3);

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG }}>
      <ParticleField count={35} color={GREEN} speed={1} seed={5} />
      <GlowOrbs colors={[GREEN, CYAN, ACCENT]} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 140px" }}>
        <div
          style={{
            fontSize: 44,
            fontWeight: 900,
            marginBottom: 35,
            opacity: spring({ frame, fps }),
            color: GREEN,
            textShadow: `0 0 30px ${GREEN}60`,
            letterSpacing: -1,
          }}
        >
          Big Wins
        </div>
        {wins.map((win, i) => {
          const delay = 10 + i * 12;
          const slideIn = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120 } });
          return (
            <div
              key={i}
              style={{
                background: `linear-gradient(135deg, ${CARD_BG}, ${GREEN}08)`,
                borderRadius: 14,
                padding: "22px 28px",
                marginBottom: 14,
                borderLeft: `3px solid ${GREEN}`,
                opacity: slideIn,
                transform: `translateX(${interpolate(slideIn, [0, 1], [100, 0])}px) scale(${interpolate(slideIn, [0, 1], [0.95, 1])})`,
                boxShadow: `0 4px 20px ${BG}`,
              }}
            >
              <div style={{ fontSize: 23, fontWeight: 700, marginBottom: 6 }}>{win.title}</div>
              <div style={{ fontSize: 16, color: MUTED, lineHeight: 1.5, maxHeight: 48, overflow: "hidden" }}>
                {win.desc.slice(0, 140)}...
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Scene 6: Key Insight (Cinematic Text) ──
const InsightScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = interpolate(frame, [0, 90], [0.95, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const opacity = spring({ frame: frame - 5, fps, config: { damping: 20 } });
  const glowPulse = 0.3 + 0.15 * Math.sin(frame * 0.06);

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG, transform: `scale(${scale})` }}>
      <GlowOrbs colors={[ACCENT, PURPLE]} />
      <ParticleField count={50} color={PURPLE} speed={0.4} seed={6} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 180px" }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: ACCENT,
            textTransform: "uppercase",
            letterSpacing: 6,
            marginBottom: 30,
            opacity,
            textShadow: `0 0 20px ${ACCENT}${Math.round(glowPulse * 255).toString(16).padStart(2, "0")}`,
          }}
        >
          Key Insight
        </div>
        <div
          style={{
            fontSize: 28,
            lineHeight: 1.7,
            textAlign: "center",
            color: WHITE,
            opacity,
            transform: `translateY(${interpolate(opacity, [0, 1], [30, 0])}px)`,
            maxWidth: 1100,
            fontWeight: 400,
          }}
        >
          {data.keyInsight}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Scene 7: Fun Ending (Dramatic) ──
const EndingScene: React.FC<{ data: InsightsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const textOp = spring({ frame: frame - 5, fps, config: { damping: 15 } });
  const badgeOp = spring({ frame: frame - 35, fps });
  const zoom = interpolate(frame, [0, 90], [1, 1.05], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ ...baseStyle, background: BG, transform: `scale(${zoom})` }}>
      <GlowOrbs colors={[YELLOW, PINK, PURPLE]} />
      <ParticleField count={70} color={YELLOW} speed={1.5} seed={7} />
      <SpeedLines direction="left" intensity={0.4} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 180px" }}>
        <div
          style={{
            fontSize: 34,
            fontStyle: "italic",
            textAlign: "center",
            color: YELLOW,
            opacity: textOp,
            lineHeight: 1.6,
            maxWidth: 950,
            fontWeight: 600,
            textShadow: `0 0 30px ${YELLOW}40`,
            transform: `translateY(${interpolate(textOp, [0, 1], [40, 0])}px)`,
          }}
        >
          {data.funEnding.headline}
        </div>
        <div
          style={{
            marginTop: 50,
            fontSize: 14,
            color: MUTED,
            opacity: badgeOp,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          Powered by Claude Code
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Transition Wrapper (Zoom + Fade) ──
const SceneTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const scaleIn = interpolate(frame, [0, 12], [1.03, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const opacity = Math.min(fadeIn, fadeOut);
  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${fadeIn < 1 ? scaleIn : 1})` }}>
      {children}
    </AbsoluteFill>
  );
};

// ── Main Composition ──
export const InsightsVideo: React.FC<InsightsData> = (props) => {
  const data = props;
  if (!data.totalMessages) {
    return (
      <AbsoluteFill style={{ ...baseStyle, background: BG, justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 32, color: MUTED }}>No data provided. Use --props to pass insights JSON.</div>
      </AbsoluteFill>
    );
  }

  const scenes = [
    { from: 0, duration: 120, Component: TitleScene },
    { from: 120, duration: 150, Component: StatsScene },
    { from: 270, duration: 180, Component: ToolsScene },
    { from: 450, duration: 150, Component: LanguagesScene },
    { from: 600, duration: 120, Component: WinsScene },
    { from: 720, duration: 90, Component: InsightScene },
    { from: 810, duration: 90, Component: EndingScene },
  ];

  return (
    <AbsoluteFill style={{ background: BG }}>
      {scenes.map(({ from, duration, Component }, i) => (
        <Sequence key={i} from={from} durationInFrames={duration}>
          <SceneTransition>
            <Component data={data} />
          </SceneTransition>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

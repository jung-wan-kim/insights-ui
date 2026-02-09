export interface ChartItem {
  label: string;
  width: number;
  color: string;
  value: number;
}

export interface InsightsData {
  totalMessages: number;
  totalSessions: number;
  dateFrom: string;
  dateTo: string;
  stats: {
    messages: string;
    lines: string;
    files: string;
    days: string;
    "msgs/day": string;
  };
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  days: number;
  glance: Record<string, string>;
  charts: Record<string, ChartItem[]>;
  bigWins: Array<{ title: string; desc: string }>;
  frictions: Array<{ title: string; desc: string; examples: string[] }>;
  features: Array<{ title: string; desc: string; why: string }>;
  horizons: Array<{ title: string; desc: string; tip: string }>;
  keyInsight: string;
  medianResponseTime: number;
  avgResponseTime: number;
  multiClauding: {
    overlapEvents: number;
    sessionsInvolved: number;
    pctMessages: number;
  };
  funEnding: {
    headline: string;
    detail: string;
  };
}

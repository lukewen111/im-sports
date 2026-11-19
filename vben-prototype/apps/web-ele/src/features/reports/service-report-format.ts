export interface ChangeSummary {
  direction: 'down' | 'flat' | 'new' | 'none' | 'up';
  text: string;
}

export function formatCount(value: number) {
  return value.toLocaleString('en-US');
}

/** 时长统一为英文缩写：31s / 12min / 1min 12s / 96h 41min，超过 24 小时仍按小时展示 */
export function formatDuration(seconds: null | number): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const rest = total % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  if (minutes > 0) return rest > 0 ? `${minutes}min ${rest}s` : `${minutes}min`;
  return `${rest}s`;
}

export function formatEfficiency(value: null | number): string {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(2);
}

/** 较上期相对变化：上期为 0 且本期有值时展示「新增」，两期均为 0 展示「—」 */
export function summarizeChange(current: null | number, previous: null | number): ChangeSummary {
  if (current === null || previous === null) return { direction: 'none', text: '—' };
  if (previous === 0) {
    return current > 0 ? { direction: 'new', text: '新增' } : { direction: 'flat', text: '—' };
  }
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.05) return { direction: 'flat', text: '0.0%' };
  return {
    direction: percent > 0 ? 'up' : 'down',
    text: `${percent > 0 ? '↑' : '↓'} ${Math.abs(percent).toFixed(1)}%`,
  };
}

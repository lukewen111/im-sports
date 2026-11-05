/* 统一的聊天时间格式：简体中文、24 小时制、不含秒，按浏览器本地时区判定 */
const pad = (value: number) => String(value).padStart(2, '0');

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export function formatChatTime(value?: Date | number | string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  const today = new Date();
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (isSameDay(date, today)) return clock;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (isSameDay(date, yesterday)) return `昨天 ${clock}`;
  if (date.getFullYear() === today.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
}

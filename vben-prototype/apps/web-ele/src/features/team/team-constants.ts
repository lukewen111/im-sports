export const DEFAULT_TEAM_ID = '100001';

export const LEGACY_TEAM_ID_MAP: Record<string, string> = {
  'team-after-sales': '100003',
  'team-default': DEFAULT_TEAM_ID,
  'team-sales': '100002',
};

const avatarPalette = [
  '#1677ff',
  '#7a2cff',
  '#009b72',
  '#e05a1f',
  '#d43f8d',
  '#3976a8',
];

const avatarTones = [
  { bg: '#E3EEFF', fg: '#1F4FB8' },
  { bg: '#FDE7E7', fg: '#B42318' },
  { bg: '#EAF6EC', fg: '#1B7A43' },
  { bg: '#FFF3D6', fg: '#8A5A00' },
  { bg: '#F1EAFE', fg: '#5B3AA8' },
  { bg: '#E4F5F6', fg: '#0F6E7A' },
  { bg: '#FDEBEF', fg: '#A4244A' },
  { bg: '#EDEDEF', fg: '#33333A' },
];

export function normalizeTeamId(id?: string) {
  if (!id) return DEFAULT_TEAM_ID;
  return LEGACY_TEAM_ID_MAP[id] || id;
}

export function nextTeamId(ids: string[]) {
  let maximum = 100_000;
  for (const id of ids) {
    const value = Number(normalizeTeamId(id));
    if (Number.isSafeInteger(value)) maximum = Math.max(maximum, value);
  }
  return String(maximum + 1);
}

export function avatarText(primary?: string, fallback?: string) {
  const source = `${primary || ''}${fallback || ''}`;
  const match = source.match(/[\p{Script=Han}A-Za-z0-9]/u)?.[0];
  return match ? (/^[A-Za-z]$/.test(match) ? match.toUpperCase() : match) : '?';
}

export function avatarColor(id: string) {
  let hash = 0;
  for (const character of id) hash = Math.trunc((hash << 5) - hash + character.codePointAt(0)!);
  return avatarPalette[Math.abs(hash) % avatarPalette.length] ?? '#1677ff';
}

export function avatarTone(id = '') {
  const seed = Array.from(id).reduce((sum, character) => sum + character.codePointAt(0)!, 0);
  const tone = avatarTones[seed % avatarTones.length] ?? avatarTones[0]!;
  return { backgroundColor: tone.bg, color: tone.fg };
}

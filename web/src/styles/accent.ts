export const DEFAULT_ACCENT = '#335eea';
export const ACCENT_COOKIE = 'tsmb_accent';

export function readGuestAccent(): string {
  const value = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${ACCENT_COOKIE}=`));
  return normalizeAccent(value?.slice(ACCENT_COOKIE.length + 1) ?? '') ?? DEFAULT_ACCENT;
}

export function saveGuestAccent(color: string): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ACCENT_COOKIE}=${color}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export const ACCENT_PRESETS = [
  { name: '经典蓝', color: DEFAULT_ACCENT },
  { name: '紫罗兰', color: '#8b5cf6' },
  { name: '玫瑰粉', color: '#e8447a' },
  { name: '珊瑚橙', color: '#ea580c' },
  { name: '翡翠绿', color: '#16a34a' },
  { name: '湖水青', color: '#0891b2' },
] as const;

export function normalizeAccent(value: string): string | null {
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) return '#' + [...hex.slice(1)].map((c) => c + c).join('');
  return null;
}

export function accentTokens(value: string): Record<string, string> {
  const color = normalizeAccent(value) ?? DEFAULT_ACCENT;
  const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const linear = rgb.map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const onAccent = luminance > 0.179 ? '#000000' : '#ffffff';
  const tint = (amount: number) => '#' + rgb.map((channel) =>
    Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0'),
  ).join('');
  return {
    '--color-primary': color,
    '--color-on-primary': onAccent,
    '--color-primary-bg': tint(0.9),
    '--color-primary-10': `rgba(${rgb.join(', ')}, 0.10)`,
    '--color-primary-12': `rgba(${rgb.join(', ')}, 0.12)`,
    '--color-primary-15': `rgba(${rgb.join(', ')}, 0.15)`,
    '--gradient-fm': `linear-gradient(135deg, ${color}, ${color === DEFAULT_ACCENT ? '#6366f1' : tint(0.2)})`,
  };
}

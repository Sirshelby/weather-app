// WMO weather interpretation codes → label, icon asset and animated scene.
// https://open-meteo.com/en/docs (see "WMO Weather interpretation codes")

const ICON = (name) => `./assets/images/icon-${name}.webp`;

const TABLE = [
  { codes: [0], label: 'Clear sky', icon: 'sunny', scene: 'clear' },
  { codes: [1], label: 'Mainly clear', icon: 'partly-cloudy', scene: 'clear' },
  { codes: [2], label: 'Partly cloudy', icon: 'partly-cloudy', scene: 'cloudy' },
  { codes: [3], label: 'Overcast', icon: 'overcast', scene: 'cloudy' },
  { codes: [45, 48], label: 'Fog', icon: 'fog', scene: 'fog' },
  { codes: [51, 53, 55], label: 'Drizzle', icon: 'drizzle', scene: 'rain' },
  { codes: [56, 57], label: 'Freezing drizzle', icon: 'drizzle', scene: 'rain' },
  { codes: [61, 63, 65], label: 'Rain', icon: 'rain', scene: 'rain' },
  { codes: [66, 67], label: 'Freezing rain', icon: 'rain', scene: 'rain' },
  { codes: [71, 73, 75, 77], label: 'Snow', icon: 'snow', scene: 'snow' },
  { codes: [80, 81, 82], label: 'Rain showers', icon: 'rain', scene: 'rain' },
  { codes: [85, 86], label: 'Snow showers', icon: 'snow', scene: 'snow' },
  { codes: [95], label: 'Thunderstorm', icon: 'storm', scene: 'storm' },
  { codes: [96, 99], label: 'Thunderstorm with hail', icon: 'storm', scene: 'storm' },
];

const BY_CODE = new Map();
TABLE.forEach((row) => row.codes.forEach((c) => BY_CODE.set(c, row)));

const INTENSITY = { 51: 'Light', 53: 'Moderate', 55: 'Dense', 61: 'Light', 63: 'Moderate', 65: 'Heavy',
  71: 'Light', 73: 'Moderate', 75: 'Heavy', 80: 'Light', 81: 'Moderate', 82: 'Violent' };

export function describe(code) {
  const row = BY_CODE.get(code) || TABLE[0];
  const prefix = INTENSITY[code];
  return {
    label: prefix ? `${prefix} ${row.label.toLowerCase()}` : row.label,
    icon: ICON(row.icon),
    scene: row.scene,
  };
}

/** Scene name used by the animated background: clear/cloudy split into day & night. */
export function sceneFor(code, isDay) {
  const { scene } = describe(code);
  if (scene === 'clear' || scene === 'cloudy') return `${scene}-${isDay ? 'day' : 'night'}`;
  return scene;
}

// Theme: "auto" (default) switches between light and dark with the time of day;
// "light" / "dark" are manual overrides.
//
// In auto mode we prefer real sunrise/sunset data over a fixed clock:
//   1. If the forecast on screen is in the viewer's own time zone, use its sun times.
//   2. Else, if we saved sun times for the viewer's own location (from geolocation), use those.
//   3. Else, fall back to 07:00–19:00 on the viewer's clock.
import { store } from './storage.js';

const root = document.documentElement;
const meta = document.getElementById('meta-theme-color');
const COLORS = { dark: '#02012c', light: '#eef2fb' };

let preference = store.get('theme', 'auto');
let viewedForecast = null;
let timer;

const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();
const wallMinutes = (s) => { const [h, m] = s.slice(11, 16).split(':').map(Number); return h * 60 + m; };

function sunWindow() {
  const viewerOffset = -new Date().getTimezoneOffset() * 60;
  if (viewedForecast && viewedForecast.utc_offset_seconds === viewerOffset) {
    return { rise: wallMinutes(viewedForecast.daily.sunrise[0]), set: wallMinutes(viewedForecast.daily.sunset[0]) };
  }
  const home = store.get('homeSun');
  if (home && home.offset === viewerOffset) return home;
  return { rise: 7 * 60, set: 19 * 60 };
}

function resolve() {
  if (preference !== 'auto') return preference;
  const now = minutesOfDay(new Date());
  const { rise, set } = sunWindow();
  return now >= rise && now < set ? 'light' : 'dark';
}

function apply() {
  const theme = resolve();
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  meta?.setAttribute('content', COLORS[theme]);
  store.set('lastTheme', theme);

  document.querySelectorAll('[data-theme-choice]').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.themeChoice === preference));
  });
  const label = document.getElementById('theme-label');
  if (label) label.textContent = preference === 'auto' ? `Auto · ${theme === 'light' ? 'Day' : 'Night'}` : preference[0].toUpperCase() + preference.slice(1);
}

export function initTheme() {
  document.querySelectorAll('[data-theme-choice]').forEach((b) => {
    b.addEventListener('click', () => {
      preference = b.dataset.themeChoice;
      store.set('theme', preference);
      apply();
    });
  });
  apply();
  clearInterval(timer);
  timer = setInterval(apply, 60 * 1000); // re-check each minute so it flips at sunset
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
}

/** Called whenever a new forecast is displayed. */
export function updateThemeContext(forecast, { isHome = false } = {}) {
  viewedForecast = forecast;
  if (isHome && forecast?.daily) {
    store.set('homeSun', {
      rise: wallMinutes(forecast.daily.sunrise[0]),
      set: wallMinutes(forecast.daily.sunset[0]),
      offset: forecast.utc_offset_seconds,
    });
  }
  apply();
}

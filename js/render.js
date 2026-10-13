// Rendering for the Forecast view. Pure-ish functions: data in, DOM out.
import { describe, sceneFor } from './weather-codes.js';
import * as U from './units.js';
import { clock, duration, fullDate, hourLabel, locationNow, parseLocal, weekdayLong, weekdayShort } from './time.js';
import { renderScene } from './background.js';
import { h, placeTitle } from './ui.js';

const $ = (id) => document.getElementById(id);
const metric = (name) => document.querySelector(`[data-metric="${name}"]`);

export function setLoading(on) {
  $('dashboard').setAttribute('aria-busy', String(on));
  if (!on) return;
  document.querySelectorAll('.metric dd [data-metric], .metric dd[data-metric]').forEach((el) => { el.textContent = '–'; });
  metric('uv-label').textContent = '';
  $('day-label').textContent = '–';
  $('daily-list').replaceChildren(...Array.from({ length: 7 }, () => h('li', { class: 'day day--skeleton', 'aria-hidden': 'true' })));
  $('hourly-list').replaceChildren(...Array.from({ length: 8 }, () => h('li', { class: 'hour hour--skeleton', 'aria-hidden': 'true' })));
  ['sunrise-time', 'sunset-time'].forEach((id) => { $(id).textContent = '–'; });
  $('sun-now').textContent = '';
  $('sun-daylight').textContent = '';
}

export function renderToday(place, f) {
  const c = f.current;
  const cond = describe(c.weather_code);
  const scene = sceneFor(c.weather_code, c.is_day);

  const today = $('today');
  today.dataset.scene = scene;
  renderScene(today.querySelector('.today__scene'), scene, 0.55);
  renderScene($('sky'), scene, 1);

  $('today-place').textContent = placeTitle(place);
  $('today-date').textContent = fullDate(c.time);
  $('today-condition').textContent = cond.label;
  const icon = $('today-icon');
  icon.src = cond.icon;
  icon.alt = cond.label;
  $('today-temp').textContent = U.temp(c.temperature_2m);
}

export function renderMetrics(f) {
  const c = f.current;
  metric('feels').textContent = U.temp(c.apparent_temperature);
  metric('humidity').textContent = `${Math.round(c.relative_humidity_2m)}%`;
  metric('wind').textContent = U.wind(c.wind_speed_10m);
  metric('precip').textContent = U.precip(c.precipitation);
  metric('visibility').textContent = U.visibility(c.visibility);
  metric('pressure').textContent = U.pressure(c.pressure_msl);
  metric('cloud').textContent = `${Math.round(c.cloud_cover)}%`;

  const uv = c.uv_index ?? 0;
  const level = U.uvLevel(uv);
  metric('uv').textContent = uv < 10 && uv % 1 ? uv.toFixed(1) : Math.round(uv);
  const badge = metric('uv-label');
  badge.textContent = level.label;
  badge.style.setProperty('--uv-color', level.color);
  $('uv-marker').style.left = `${Math.min(uv / 11, 1) * 100}%`;
}

export function renderSun(f) {
  const d = f.daily;
  const rise = parseLocal(d.sunrise[0]);
  const set = parseLocal(d.sunset[0]);
  const now = locationNow(f);

  $('sunrise-time').textContent = clock(d.sunrise[0]);
  $('sunset-time').textContent = clock(d.sunset[0]);
  $('sun-daylight').textContent = `${duration(d.daylight_duration[0])} of daylight`;

  const span = set - rise;
  const p = Math.min(Math.max((now - rise) / span, 0), 1);
  const isDay = now >= rise && now < set;
  $('sun').dataset.phase = isDay ? 'day' : 'night';

  // Position on the elliptical arc (centre 160,130 — rx 140, ry 120)
  const theta = Math.PI * (1 - p);
  const x = 160 + 140 * Math.cos(theta);
  const y = 130 - 120 * Math.sin(theta);
  $('sun-dot').setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  $('arc-clip-rect').setAttribute('width', x.toFixed(1));

  const rel = (ms) => duration(Math.max(ms, 0) / 1000).replace(/^0h /, '');
  let text;
  if (now < rise) text = `Sunrise in ${rel(rise - now)}`;
  else if (isDay) text = `Sunset in ${rel(set - now)}`;
  else text = d.sunrise[1] ? `Sunrise tomorrow ${clock(d.sunrise[1])}` : 'After sunset';
  $('sun-now').textContent = text;
  document.getElementById('sun-arc-desc').textContent =
    `Sun position: ${Math.round(p * 100)}% between sunrise at ${clock(d.sunrise[0])} and sunset at ${clock(d.sunset[0])}. ${text}.`;
}

export function renderDaily(f) {
  const d = f.daily;
  $('daily-list').replaceChildren(...d.time.map((t, i) => {
    const cond = describe(d.weather_code[i]);
    return h('li', { class: 'day' },
      h('span', { class: 'day__name' }, h('abbr', { title: weekdayLong(t), text: weekdayShort(t), style: 'text-decoration:none' })),
      h('img', { class: 'day__icon', src: cond.icon, alt: cond.label, width: 60, height: 60, loading: 'lazy' }),
      h('span', { class: 'day__temps' },
        h('span', { text: U.temp(d.temperature_2m_max[i]), 'aria-label': `High ${U.temp(d.temperature_2m_max[i])}` }),
        h('span', { text: U.temp(d.temperature_2m_min[i]), 'aria-label': `Low ${U.temp(d.temperature_2m_min[i])}` })));
  }));
}

export function renderDayMenu(f, selected, onPick) {
  const menu = $('day-menu');
  const dayName = (i) => (i === 0 ? 'Today' : weekdayLong(f.daily.time[i]));
  $('day-label').textContent = dayName(selected);
  menu.replaceChildren(...f.daily.time.map((t, i) => h('button', {
    class: 'menu__item', role: 'menuitemradio', type: 'button',
    'aria-checked': String(i === selected),
    text: dayName(i),
    onclick: () => onPick(i),
  })));
}

export function renderHourly(f, dayIndex) {
  const date = f.daily.time[dayIndex];
  const hrs = f.hourly;
  const nowHour = f.current.time.slice(0, 13); // "YYYY-MM-DDTHH"
  let rows;
  if (dayIndex === 0) {
    // Today: the next 24 hours from now, running into tomorrow if needed.
    const start = hrs.time.findIndex((t) => t.slice(0, 13) >= nowHour);
    rows = Array.from({ length: 24 }, (_, n) => start + n).filter((i) => i >= 0 && i < hrs.time.length);
  } else {
    rows = hrs.time.flatMap((t, i) => (t.startsWith(date) ? [i] : []));
  }
  $('hourly-list').replaceChildren(...rows.map((i, n) => {
    const cond = describe(hrs.weather_code[i]);
    const isNow = dayIndex === 0 && n === 0;
    const pop = hrs.precipitation_probability?.[i];
    const crossesDay = dayIndex === 0 && n > 0 && hrs.time[i].endsWith('T00:00');
    return h('li', { class: 'hour', dataset: { now: String(isNow) } },
      h('img', { class: 'hour__icon', src: cond.icon, alt: cond.label, width: 40, height: 40, loading: 'lazy' }),
      h('span', { class: 'hour__time' },
        crossesDay ? h('span', { class: 'hour__day', text: weekdayLong(hrs.time[i]) }) : null,
        isNow ? 'Now' : hourLabel(hrs.time[i]),
        pop >= 20 ? h('small', { text: `💧${pop}%`, title: `${pop}% chance of precipitation` }) : null),
      h('span', { class: 'hour__temp', text: U.temp(hrs.temperature_2m[i]) }));
  }));
  $('hourly-list').scrollTop = 0;
}

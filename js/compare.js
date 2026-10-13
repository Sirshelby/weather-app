// Compare Locations: up to 4 places side by side, one batched API request.
import { store, placeKey } from './storage.js';
import { getForecasts } from './api.js';
import { describe } from './weather-codes.js';
import * as U from './units.js';
import { clock, clockFromDate, locationNow, weekdayShort } from './time.js';
import { getFavorites } from './favorites.js';
import { h, placeTitle } from './ui.js';

export const MAX_COMPARE = 4;
const ACCENTS = ['hsl(233 67% 60%)', 'hsl(28 100% 55%)', 'hsl(160 60% 45%)', 'hsl(320 65% 60%)'];
const listeners = new Set();

const pick = ({ name, admin1 = '', country = '', countryCode = '', latitude, longitude }) =>
  ({ name, admin1, country, countryCode, latitude, longitude });

export const getCompare = () => store.get('compare', []);
export const isCompared = (p) => !!p && getCompare().some((c) => placeKey(c) === placeKey(p));
export const onCompareChange = (fn) => listeners.add(fn);

function save(list) {
  store.set('compare', list);
  listeners.forEach((fn) => fn(list));
}

/** @returns {'added'|'removed'|'full'} */
export function toggleCompare(place) {
  const list = getCompare();
  const key = placeKey(place);
  if (list.some((c) => placeKey(c) === key)) {
    save(list.filter((c) => placeKey(c) !== key));
    return 'removed';
  }
  if (list.length >= MAX_COMPARE) return 'full';
  save([...list, pick(place)]);
  return 'added';
}

export function addToCompare(place) {
  return isCompared(place) ? 'exists' : toggleCompare(place);
}

function renderQuickPicks() {
  const wrap = document.getElementById('compare-quick');
  const favs = getFavorites();
  wrap.replaceChildren(...favs.map((f) => {
    const on = isCompared(f);
    return h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(on),
      onclick: () => toggleCompare(f),
    }, h('span', { class: 'chip__main' },
      h('span', { class: 'icon icon--star', 'aria-hidden': 'true' }),
      h('span', { text: `${on ? '✓ ' : '+ '}${f.name}` })));
  }));
}

const stat = (label, value) => h('div', { class: 'cmp__stat' }, h('dt', { text: label }), h('dd', { text: value }));

function card(place, f, i) {
  const tpl = document.getElementById('tpl-compare-card').content.firstElementChild.cloneNode(true);
  const c = f.current;
  const d = f.daily;
  const cond = describe(c.weather_code);
  tpl.style.setProperty('--cmp-accent', ACCENTS[i % ACCENTS.length]);
  tpl.querySelector('.cmp__place').textContent = placeTitle(place);
  tpl.querySelector('.cmp__local').textContent = `Local time ${clockFromDate(locationNow(f))}`;
  const rm = tpl.querySelector('.cmp__remove');
  rm.setAttribute('aria-label', `Remove ${place.name} from comparison`);
  rm.addEventListener('click', () => toggleCompare(place));
  const icon = tpl.querySelector('.cmp__icon');
  icon.src = cond.icon;
  icon.alt = cond.label;
  tpl.querySelector('.cmp__temp').textContent = U.temp(c.temperature_2m);
  tpl.querySelector('.cmp__cond').textContent = `${cond.label} · H ${U.temp(d.temperature_2m_max[0])} L ${U.temp(d.temperature_2m_min[0])}`;
  const uv = U.uvLevel(c.uv_index);
  tpl.querySelector('.cmp__stats').append(
    stat('Feels like', U.temp(c.apparent_temperature)),
    stat('Humidity', `${Math.round(c.relative_humidity_2m)}%`),
    stat('Wind', U.wind(c.wind_speed_10m)),
    stat('Rain chance', `${d.precipitation_probability_max?.[0] ?? '–'}%`),
    stat('UV index', `${Math.round(c.uv_index ?? 0)}${uv.label ? ` · ${uv.label}` : ''}`),
    stat('Pressure', U.pressure(c.pressure_msl)),
    stat('Visibility', U.visibility(c.visibility)),
    stat('Sun', `${clock(d.sunrise[0])} – ${clock(d.sunset[0])}`),
  );
  tpl.querySelector('.cmp__days').append(...d.time.slice(1, 6).map((t, n) => {
    const dc = describe(d.weather_code[n + 1]);
    return h('li', { class: 'cmp__day' },
      h('span', { text: weekdayShort(t) }),
      h('img', { src: dc.icon, alt: dc.label, width: 32, height: 32 }),
      h('span', { text: `${U.temp(d.temperature_2m_max[n + 1])}` }),
      h('span', { text: `${U.temp(d.temperature_2m_min[n + 1])}` }));
  }));
  return tpl;
}

let renderToken = 0;
export async function renderCompare() {
  const grid = document.getElementById('compare-grid');
  const empty = document.getElementById('compare-empty');
  const count = document.getElementById('compare-count');
  const list = getCompare();

  count.hidden = list.length === 0;
  count.textContent = list.length;
  renderQuickPicks();
  empty.hidden = list.length > 0;
  if (!list.length) { grid.replaceChildren(); return; }

  const token = ++renderToken;
  grid.setAttribute('aria-busy', 'true');
  // keep existing cards while loading if count unchanged; otherwise show skeletons
  if (grid.children.length !== list.length) {
    grid.replaceChildren(...list.map(() => h('div', { class: 'card cmp cmp--loading', 'aria-hidden': 'true' })));
  }
  try {
    const forecasts = await getForecasts(list);
    if (token !== renderToken) return;
    grid.replaceChildren(...list.map((p, i) => card(p, forecasts[i], i)));
  } catch {
    if (token !== renderToken) return;
    grid.replaceChildren(h('p', { class: 'compare-empty', text: 'Couldn’t load the comparison. Check your connection and try again.' }));
  } finally {
    if (token === renderToken) grid.removeAttribute('aria-busy');
  }
}

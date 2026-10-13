// Saved locations: persisted list + chip bar with live temperatures.
import { store, placeKey } from './storage.js';
import { getForecasts } from './api.js';
import { describe } from './weather-codes.js';
import { temp } from './units.js';
import { h } from './ui.js';

const MAX = 12;
const listeners = new Set();

const pick = ({ name, admin1 = '', country = '', countryCode = '', latitude, longitude }) =>
  ({ name, admin1, country, countryCode, latitude, longitude });

export const getFavorites = () => store.get('favorites', []);
export const isFavorite = (place) => !!place && getFavorites().some((f) => placeKey(f) === placeKey(place));
export const onFavoritesChange = (fn) => listeners.add(fn);

function save(list) {
  store.set('favorites', list);
  listeners.forEach((fn) => fn(list));
}

/** @returns {'added'|'removed'|'full'} */
export function toggleFavorite(place) {
  const list = getFavorites();
  const key = placeKey(place);
  if (list.some((f) => placeKey(f) === key)) {
    save(list.filter((f) => placeKey(f) !== key));
    return 'removed';
  }
  if (list.length >= MAX) return 'full';
  save([...list, pick(place)]);
  return 'added';
}

export function removeFavorite(key) {
  save(getFavorites().filter((f) => placeKey(f) !== key));
}

/**
 * Render the chip bar. Temperatures are fetched in one batched request and
 * filled in when they arrive, so the bar appears instantly.
 */
export async function renderFavorites({ activeKey, onPick }) {
  const section = document.getElementById('favorites');
  const listEl = document.getElementById('favorites-list');
  const list = getFavorites();
  section.hidden = list.length === 0;
  if (!list.length) { listEl.replaceChildren(); return; }

  const chips = list.map((f) => {
    const key = placeKey(f);
    const tempEl = h('span', { class: 'chip__temp' });
    const icon = h('img', { src: '', alt: '', width: 22, height: 22, hidden: true });
    return {
      tempEl, icon,
      node: h('li', { class: 'chip', dataset: { key, active: String(key === activeKey) } },
        h('button', {
          class: 'chip__main', type: 'button',
          'aria-current': key === activeKey ? 'location' : null,
          onclick: () => onPick(f),
        },
        h('span', { class: 'icon icon--star', 'aria-hidden': 'true' }),
        h('span', { text: f.name }),
        icon,
        tempEl),
        h('button', {
          class: 'chip__remove', type: 'button', 'aria-label': `Remove ${f.name} from saved locations`,
          onclick: () => removeFavorite(key),
        }, h('span', { class: 'icon icon--close', 'aria-hidden': 'true' }))),
    };
  });
  listEl.replaceChildren(...chips.map((c) => c.node));

  try {
    const forecasts = await getForecasts(list);
    forecasts.forEach((f, i) => {
      const d = describe(f.current.weather_code);
      chips[i].tempEl.textContent = temp(f.current.temperature_2m);
      chips[i].icon.src = d.icon;
      chips[i].icon.alt = d.label;
      chips[i].icon.hidden = false;
    });
  } catch {
    /* chips still work without temperatures */
  }
}

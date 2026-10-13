// All network access lives here. Data is always requested in metric and
// converted on the client (see units.js), so switching units is instant and
// cached responses stay valid offline.

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const CURRENT_VARS = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
  'precipitation', 'weather_code', 'cloud_cover', 'pressure_msl',
  'wind_speed_10m', 'wind_direction_10m', 'uv_index', 'visibility',
].join(',');
const HOURLY_VARS = ['temperature_2m', 'weather_code', 'is_day', 'precipitation_probability'].join(',');
const DAILY_VARS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset',
  'daylight_duration', 'uv_index_max', 'precipitation_sum', 'precipitation_probability_max',
].join(',');

export class ApiError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.cause = cause;
  }
}

async function getJSON(url, signal) {
  let res;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Network request failed', { cause: err });
  }
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, { status: res.status });
  const data = await res.json();
  if (data && data.error) throw new ApiError(data.reason || 'API error');
  return data;
}

/** Place search for the autocomplete. Returns [] when nothing matches. */
export async function searchPlaces(query, { signal } = {}) {
  const url = new URL(GEO_URL);
  url.search = new URLSearchParams({ name: query, count: '6', language: 'en', format: 'json' });
  const data = await getJSON(url, signal);
  return (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    admin1: r.admin1 || '',
    country: r.country || '',
    countryCode: r.country_code || '',
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

// Short-lived in-memory cache so favorites, compare and the main view share requests.
const cache = new Map();
const TTL = 10 * 60 * 1000;
const keyFor = (p) => `${(+p.latitude).toFixed(3)},${(+p.longitude).toFixed(3)}`;

/**
 * Forecasts for one or more places. Open-Meteo accepts comma-separated
 * coordinates and returns an array, so N places cost a single request.
 */
export async function getForecasts(places, { signal, fresh = false } = {}) {
  const now = Date.now();
  const missing = places.filter((p) => {
    const hit = cache.get(keyFor(p));
    return fresh || !hit || now - hit.at > TTL;
  });

  if (missing.length) {
    const url = new URL(FORECAST_URL);
    url.search = new URLSearchParams({
      latitude: missing.map((p) => (+p.latitude).toFixed(4)).join(','),
      longitude: missing.map((p) => (+p.longitude).toFixed(4)).join(','),
      current: CURRENT_VARS,
      hourly: HOURLY_VARS,
      daily: DAILY_VARS,
      timezone: 'auto',
      forecast_days: '7',
    });
    const data = await getJSON(url, signal);
    const list = Array.isArray(data) ? data : [data];
    list.forEach((f, i) => cache.set(keyFor(missing[i]), { at: now, data: f }));
  }
  return places.map((p) => cache.get(keyFor(p)).data);
}

export const getForecast = async (place, opts) => (await getForecasts([place], opts))[0];

/** Turn coordinates into a readable place name. Falls back gracefully. */
export async function reverseGeocode(latitude, longitude, { signal } = {}) {
  try {
    const url = new URL(REVERSE_URL);
    url.search = new URLSearchParams({ latitude, longitude, localityLanguage: 'en' });
    const d = await getJSON(url, signal);
    const name = d.city || d.locality || d.principalSubdivision;
    if (name) {
      return {
        name,
        admin1: d.principalSubdivision && d.principalSubdivision !== name ? d.principalSubdivision : '',
        country: d.countryName || '',
        countryCode: d.countryCode || '',
      };
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
  }
  return { name: 'Current location', admin1: '', country: '', countryCode: '' };
}

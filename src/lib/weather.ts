import { env } from '@/lib/env';

/**
 * Meteo et geolocalisation.
 *
 * OpenWeatherMap si une cle est fournie ; sinon repli sur Open-Meteo, qui est
 * gratuit et sans authentification. Le dashboard affiche donc toujours quelque
 * chose, meme sur une installation fraiche.
 */

export interface Weather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windKph: number;
  condition: string;
  icon: string; // identifiant interne, mappe vers une icone dans l'UI
  sunrise: string | null; // "HH:mm"
  sunset: string | null;
  source: 'openweather' | 'open-meteo' | 'unavailable';
}

/** Codes WMO d'Open-Meteo vers nos identifiants d'icone. */
function iconFromWmo(code: number): { icon: string; condition: string } {
  if (code === 0) return { icon: 'clear', condition: 'Ciel degage' };
  if (code <= 2) return { icon: 'partly', condition: 'Partiellement nuageux' };
  if (code === 3) return { icon: 'cloudy', condition: 'Couvert' };
  if (code <= 48) return { icon: 'fog', condition: 'Brouillard' };
  if (code <= 57) return { icon: 'drizzle', condition: 'Bruine' };
  if (code <= 67) return { icon: 'rain', condition: 'Pluie' };
  if (code <= 77) return { icon: 'snow', condition: 'Neige' };
  if (code <= 82) return { icon: 'rain', condition: 'Averses' };
  if (code <= 86) return { icon: 'snow', condition: 'Averses de neige' };
  return { icon: 'storm', condition: 'Orage' };
}

function iconFromOpenWeather(main: string): string {
  const table: Record<string, string> = {
    Clear: 'clear',
    Clouds: 'cloudy',
    Rain: 'rain',
    Drizzle: 'drizzle',
    Thunderstorm: 'storm',
    Snow: 'snow',
    Mist: 'fog',
    Fog: 'fog',
    Haze: 'fog',
  };
  return table[main] ?? 'partly';
}

function toHHmm(unixSeconds: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(unixSeconds * 1000));
  } catch {
    return new Date(unixSeconds * 1000).toISOString().slice(11, 16);
  }
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  timezone: string,
): Promise<Weather> {
  // 1. OpenWeatherMap (si une cle est configuree)
  if (env.openWeatherApiKey) {
    try {
      const url = new URL('https://api.openweathermap.org/data/2.5/weather');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('units', 'metric');
      url.searchParams.set('lang', 'fr');
      url.searchParams.set('appid', env.openWeatherApiKey);

      const response = await fetch(url, {
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const payload = await response.json();
        return {
          temperature: Math.round(payload.main?.temp ?? 0),
          feelsLike: Math.round(payload.main?.feels_like ?? 0),
          humidity: payload.main?.humidity ?? 0,
          windKph: Math.round((payload.wind?.speed ?? 0) * 3.6),
          condition: payload.weather?.[0]?.description ?? '',
          icon: iconFromOpenWeather(payload.weather?.[0]?.main ?? ''),
          sunrise: payload.sys?.sunrise ? toHHmm(payload.sys.sunrise, timezone) : null,
          sunset: payload.sys?.sunset ? toHHmm(payload.sys.sunset, timezone) : null,
          source: 'openweather',
        };
      }
    } catch {
      // On tente le repli.
    }
  }

  // 2. Open-Meteo (sans cle)
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code');
    url.searchParams.set('daily', 'sunrise,sunset');
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('forecast_days', '1');

    const response = await fetch(url, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const payload = await response.json();
      const current = payload.current ?? {};
      const { icon, condition } = iconFromWmo(current.weather_code ?? 0);
      return {
        temperature: Math.round(current.temperature_2m ?? 0),
        feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0),
        humidity: Math.round(current.relative_humidity_2m ?? 0),
        windKph: Math.round(current.wind_speed_10m ?? 0),
        condition,
        icon,
        sunrise: (payload.daily?.sunrise?.[0] as string | undefined)?.slice(11, 16) ?? null,
        sunset: (payload.daily?.sunset?.[0] as string | undefined)?.slice(11, 16) ?? null,
        source: 'open-meteo',
      };
    }
  } catch {
    // Aucune source disponible.
  }

  return {
    temperature: 0,
    feelsLike: 0,
    humidity: 0,
    windKph: 0,
    condition: '',
    icon: 'unavailable',
    sunrise: null,
    sunset: null,
    source: 'unavailable',
  };
}

export interface GeoPlace {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

/** Recherche de ville (Nominatim / OpenStreetMap) — utilisee dans les reglages. */
export async function searchCity(query: string): Promise<GeoPlace[]> {
  if (query.trim().length < 2) return [];
  try {
    const url = new URL(`${env.nominatimUrl}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '6');
    url.searchParams.set('featuretype', 'city');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url, {
      headers: { 'User-Agent': 'LifeofM/1.0 (personal development app)' },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];

    const results = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: Record<string, string>;
    }>;

    return results.map((result) => {
      const address = result.address ?? {};
      return {
        city:
          address.city ??
          address.town ??
          address.village ??
          address.municipality ??
          result.display_name.split(',')[0],
        country: address.country ?? '',
        latitude: Number(result.lat),
        longitude: Number(result.lon),
      };
    });
  } catch {
    return [];
  }
}

/** Coordonnees de repli pour les villes les plus courantes (mode hors ligne). */
export const FALLBACK_CITIES: Record<string, { latitude: number; longitude: number; timezone: string }> = {
  Paris: { latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
  Marseille: { latitude: 43.2965, longitude: 5.3698, timezone: 'Europe/Paris' },
  Lyon: { latitude: 45.764, longitude: 4.8357, timezone: 'Europe/Paris' },
  Bruxelles: { latitude: 50.8503, longitude: 4.3517, timezone: 'Europe/Brussels' },
  Londres: { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
  Casablanca: { latitude: 33.5731, longitude: -7.5898, timezone: 'Africa/Casablanca' },
  Alger: { latitude: 36.7538, longitude: 3.0588, timezone: 'Africa/Algiers' },
  Tunis: { latitude: 36.8065, longitude: 10.1815, timezone: 'Africa/Tunis' },
  Dubai: { latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
  Istanbul: { latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul' },
  'New York': { latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
  Montreal: { latitude: 45.5017, longitude: -73.5673, timezone: 'America/Toronto' },
};

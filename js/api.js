/* ==========================================================================
   HORIZON · api.js
   Aquí está TODA la comunicación con servicios externos:
   1. REST Countries  -> información de los países
   2. Nominatim (OpenStreetMap) -> convierte una ciudad en coordenadas
   3. Open-Meteo      -> clima actual y pronóstico
   Se usa fetch con async/await, manejo de errores, caché y un respaldo local.
   ========================================================================== */

(function () {
  "use strict";

  const { apis, listFields, cacheTtl, regionNames } = HZ.config;
  const { norm, capitalize, sleep } = HZ.utils;
  const cache = HZ.storage.cache;

  /* ------------------------------------------------------------------
     Traducciones: la API devuelve algunos datos en inglés
     ------------------------------------------------------------------ */
  const CAPITALS_ES = {
    Tokyo: "Tokio", Rome: "Roma", Paris: "París", Berlin: "Berlín", Lisbon: "Lisboa", Vienna: "Viena",
    Brussels: "Bruselas", Prague: "Praga", Warsaw: "Varsovia", Moscow: "Moscú", Athens: "Atenas",
    Copenhagen: "Copenhague", Stockholm: "Estocolmo", "Mexico City": "Ciudad de México", Havana: "La Habana",
    Brasília: "Brasilia", Bogotá: "Bogotá", Cairo: "El Cairo", Beijing: "Pekín", Seoul: "Seúl",
    "New Delhi": "Nueva Delhi", Jerusalem: "Jerusalén", Bern: "Berna", Dublin: "Dublín", London: "Londres",
    Edinburgh: "Edimburgo", Luxembourg: "Luxemburgo", Hanoi: "Hanói", Jakarta: "Yakarta", Tehran: "Teherán",
    Baghdad: "Bagdad", Damascus: "Damasco", Kyiv: "Kiev", Bucharest: "Bucarest", Belgrade: "Belgrado",
    Zagreb: "Zagreb", Ljubljana: "Liubliana", Bratislava: "Bratislava", Sofia: "Sofía", Tunis: "Túnez",
    Algiers: "Argel", Tripoli: "Trípoli", Rabat: "Rabat", Nairobi: "Nairobi", Pretoria: "Pretoria",
    "Washington, D.C.": "Washington D. C.", Ottawa: "Ottawa", Canberra: "Canberra", Wellington: "Wellington",
    Asunción: "Asunción", Montevideo: "Montevideo", Santiago: "Santiago", Lima: "Lima", Quito: "Quito",
    Caracas: "Caracas", "Panama City": "Ciudad de Panamá", "San José": "San José", "Guatemala City": "Ciudad de Guatemala",
    Reykjavik: "Reikiavik", Oslo: "Oslo", Helsinki: "Helsinki", Amsterdam: "Ámsterdam", Budapest: "Budapest",
    Bangkok: "Bangkok", "Kuala Lumpur": "Kuala Lumpur", Singapore: "Singapur", Manila: "Manila", Kathmandu: "Katmandú",
    Ankara: "Ankara", Riyadh: "Riad", "Abu Dhabi": "Abu Dabi", Doha: "Doha", Muscat: "Mascate",
  };

  const SUBREGIONS_ES = {
    "Southern Europe": "Europa meridional", "Western Europe": "Europa occidental", "Northern Europe": "Europa septentrional",
    "Eastern Europe": "Europa oriental", "Central Europe": "Europa central", "South America": "Sudamérica",
    "North America": "Norteamérica", "Central America": "Centroamérica", Caribbean: "Caribe",
    "Eastern Asia": "Asia oriental", "South-Eastern Asia": "Sudeste asiático", "Southern Asia": "Asia meridional",
    "Western Asia": "Asia occidental", "Central Asia": "Asia central", "Northern Africa": "Norte de África",
    "Western Africa": "África occidental", "Eastern Africa": "África oriental", "Middle Africa": "África central",
    "Southern Africa": "África meridional", "Australia and New Zealand": "Australia y Nueva Zelanda",
    Melanesia: "Melanesia", Micronesia: "Micronesia", Polynesia: "Polinesia",
  };

  /* Intl.DisplayNames traduce códigos de idioma (spa) y de moneda (EUR) usando el idioma del navegador */
  let languageNames = null;
  let currencyNames = null;
  try {
    languageNames = new Intl.DisplayNames(["es"], { type: "language" });
    currencyNames = new Intl.DisplayNames(["es"], { type: "currency" });
  } catch (error) {
    /* navegadores antiguos: se usa el nombre en inglés de la API */
  }

  function translate(displayNames, code, fallback) {
    try {
      const name = displayNames && displayNames.of(code);
      if (name && name !== code) return capitalize(name);
    } catch (error) {
      /* código no válido: se usa el valor de respaldo */
    }
    return fallback || code;
  }

  /* ------------------------------------------------------------------
     fetch con límite de tiempo
     ------------------------------------------------------------------ */
  async function fetchJSON(url, timeout = 12000) {
    const controller = new AbortController(); // permite cancelar la petición si tarda demasiado
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const failure = new Error(`Error ${response.status} al consultar el servicio`);
        failure.status = response.status;
        throw failure;
      }
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") throw new Error("El servicio tardó demasiado en responder");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ------------------------------------------------------------------
     1. REST Countries
     ------------------------------------------------------------------ */
  /* Convierte la respuesta de la API a un objeto simple con los datos ya traducidos */
  function normalizeCountry(raw) {
    const regionEn = raw.region || "";
    const capitalEn = Array.isArray(raw.capital) && raw.capital.length ? raw.capital[0] : "";
    const spanish = raw.translations && raw.translations.spa;
    const name = (spanish && spanish.common) || raw.name.common;

    const capitalCoords = raw.capitalInfo && raw.capitalInfo.latlng;
    const latlng = capitalCoords && capitalCoords.length === 2 ? capitalCoords : raw.latlng && raw.latlng.length === 2 ? raw.latlng : null;

    const idd = raw.idd && raw.idd.root ? raw.idd.root + (raw.idd.suffixes && raw.idd.suffixes.length === 1 ? raw.idd.suffixes[0] : "") : "";

    return {
      code: raw.cca2,
      name,
      nameEn: raw.name.common,
      official: (spanish && spanish.official) || raw.name.official || name,
      capital: capitalEn ? CAPITALS_ES[capitalEn] || capitalEn : "",
      capitalEn,
      region: regionNames[regionEn] || regionEn,
      regionEn,
      subregion: SUBREGIONS_ES[raw.subregion] || raw.subregion || "",
      population: raw.population || 0,
      area: raw.area || 0,
      languages: raw.languages ? Object.entries(raw.languages).map(([code, label]) => translate(languageNames, code, label)) : [],
      currencies: raw.currencies
        ? Object.entries(raw.currencies).map(([code, info]) => ({
            code,
            name: translate(currencyNames, code, info && info.name),
            symbol: (info && info.symbol) || "",
          }))
        : [],
      flag: (raw.flags && (raw.flags.svg || raw.flags.png)) || "",
      flagAlt: `Bandera de ${name}`,
      latlng,
      timezones: raw.timezones || [],
      tld: (raw.tld && raw.tld[0]) || "",
      callingCode: idd,
    };
  }

  /* Respaldo local: si REST Countries no responde se usa data/paises-respaldo.json */
  let backupPromise = null;
  function loadBackup() {
    if (!backupPromise) {
      backupPromise = fetchJSON("data/paises-respaldo.json").catch((error) => {
        backupPromise = null;
        throw error;
      });
    }
    return backupPromise;
  }

  const byName = (a, b) => a.name.localeCompare(b.name, "es");

  /* Devuelve todos los países. "source" indica de dónde salieron: api, cache o respaldo */
  async function getCountries() {
    const cached = cache.get("countries.v1");
    if (cached) return { countries: cached, source: "cache" };

    try {
      const raw = await fetchJSON(`${apis.countries}/all?fields=${listFields}`);
      if (!Array.isArray(raw) || raw.length === 0) throw new Error("La API devolvió una respuesta vacía");
      const countries = raw.filter((item) => item && item.cca2 && item.name).map(normalizeCountry).sort(byName);
      cache.set("countries.v1", countries, cacheTtl.countries);
      return { countries, source: "api" };
    } catch (error) {
      console.warn("REST Countries no está disponible, se usan los datos de respaldo:", error.message);
      const countries = (await loadBackup()).slice().sort(byName);
      return { countries, source: "respaldo" };
    }
  }

  /* Devuelve el detalle de un país por su código de 2 letras (ES, JP, CO...) */
  async function getCountry(code) {
    code = String(code || "").trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(code)) throw new Error("Código de país no válido");

    const cached = cache.get(`country.${code}`);
    if (cached) return cached;

    try {
      const raw = await fetchJSON(`${apis.countries}/alpha/${encodeURIComponent(code)}`);
      const item = Array.isArray(raw) ? raw[0] : raw;
      if (!item || !item.cca2) throw new Error("No encontramos ese país");
      const country = normalizeCountry(item);
      cache.set(`country.${code}`, country, cacheTtl.country);
      return country;
    } catch (error) {
      const backup = await loadBackup().then((list) => list.find((item) => item.code === code)).catch(() => null);
      if (backup) return { ...backup, fromBackup: true };
      if (error.status === 404) throw new Error("No encontramos ese país");
      throw error;
    }
  }

  /* ------------------------------------------------------------------
     2. Nominatim (geocodificación): "Madrid, España" -> latitud y longitud
     ------------------------------------------------------------------ */
  /* Nominatim permite como máximo 1 consulta por segundo: las peticiones se ponen en fila */
  let geocodeQueue = Promise.resolve();
  let lastGeocodeAt = 0;

  function throttled(task) {
    const run = geocodeQueue.then(async () => {
      const wait = lastGeocodeAt + 1100 - Date.now();
      if (wait > 0) await sleep(wait);
      lastGeocodeAt = Date.now();
      return task();
    });
    geocodeQueue = run.catch(() => {});
    return run;
  }

  async function geocode(query, countryCode) {
    const key = `geo.${norm(query)}.${countryCode || ""}`;
    const cached = cache.get(key);
    if (cached) return cached.found ? cached.value : null;

    const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", "accept-language": "es" });
    if (countryCode) params.set("countrycodes", countryCode.toLowerCase());

    const data = await throttled(() => fetchJSON(`${apis.geocoding}?${params}`));
    const first = Array.isArray(data) && data.length ? data[0] : null;
    const value = first
      ? { lat: parseFloat(first.lat), lon: parseFloat(first.lon), name: first.name || query.split(",")[0].trim(), display: first.display_name }
      : null;

    cache.set(key, { found: Boolean(value), value }, cacheTtl.geocode);
    return value;
  }

  /* ------------------------------------------------------------------
     3. Open-Meteo: clima actual + pronóstico de 7 días
     ------------------------------------------------------------------ */
  /* Códigos meteorológicos oficiales (WMO) -> texto en español e ícono del sprite */
  function weatherInfo(code) {
    if (code === 0) return { label: "Despejado", icon: "sun" };
    if (code === 1) return { label: "Mayormente despejado", icon: "sun" };
    if (code === 2) return { label: "Parcialmente nublado", icon: "cloud-sun" };
    if (code === 3) return { label: "Nublado", icon: "cloud" };
    if (code === 45 || code === 48) return { label: "Niebla", icon: "cloud" };
    if (code >= 51 && code <= 57) return { label: "Llovizna", icon: "cloud-rain" };
    if (code >= 61 && code <= 67) return { label: "Lluvia", icon: "cloud-rain" };
    if (code >= 71 && code <= 77) return { label: "Nieve", icon: "snowflake" };
    if (code >= 80 && code <= 82) return { label: "Chubascos", icon: "cloud-rain" };
    if (code === 85 || code === 86) return { label: "Chubascos de nieve", icon: "snowflake" };
    if (code >= 95) return { label: "Tormenta", icon: "zap" };
    return { label: "Variable", icon: "cloud-sun" };
  }

  async function getWeather(lat, lon) {
    const key = `wx.${lat.toFixed(2)}.${lon.toFixed(2)}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "7",
    });
    const data = await fetchJSON(`${apis.weather}?${params}`);
    if (!data.current || !data.daily) throw new Error("La respuesta del clima llegó incompleta");

    const weather = {
      temp: data.current.temperature_2m,
      feels: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      wind: data.current.wind_speed_10m,
      code: data.current.weather_code,
      time: data.current.time,
      rainToday: data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[0] : null,
      days: data.daily.time.map((date, i) => ({
        date,
        code: data.daily.weather_code[i],
        max: data.daily.temperature_2m_max[i],
        min: data.daily.temperature_2m_min[i],
        rain: data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[i] : null,
      })),
    };
    cache.set(key, weather, cacheTtl.weather);
    return weather;
  }

  HZ.api = { getCountries, getCountry, geocode, getWeather, weatherInfo, normalizeCountry };
})();

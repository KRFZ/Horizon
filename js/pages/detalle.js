/* ==========================================================================
   HORIZON · pages/detalle.js
   Ficha de un destino (?code=ES). Combina las 3 APIs:
   REST Countries (datos del país) -> Nominatim (coordenadas de la ciudad)
   -> Open-Meteo (clima y pronóstico). También permite guardar lugares propios.
   ========================================================================== */

(function () {
  "use strict";

  const { $, esc, icon, capitalize, formatNumber, formatPopulation, parseISO, uid } = HZ.utils;
  const { banner, toast } = HZ.ui;

  const params = new URLSearchParams(location.search);
  const code = (params.get("code") || "").toUpperCase();

  const loading = $("#detail-loading");
  const status = $("#detail-status");
  const root = $("#detail-root");

  let country = null; // país que se está mostrando
  let capitalLocation = null; // coordenadas de la capital
  let requestId = 0; // evita que una respuesta lenta pise a una más reciente

  /* ====================================================================
     1. Datos del país (REST Countries)
     ==================================================================== */
  async function init() {
    status.innerHTML = "";
    loading.hidden = false;
    root.hidden = true;

    if (!code) {
      loading.hidden = true;
      status.innerHTML = banner("No indicaste ningún destino. Elige uno desde la lista de destinos.");
      return;
    }

    try {
      country = await HZ.api.getCountry(code);
    } catch (error) {
      loading.hidden = true;
      const notFound = /encontramos|válido/i.test(error.message);
      status.innerHTML = banner(
        notFound ? "No encontramos ese destino. Vuelve a la lista y elige otro." : "No pudimos cargar la información del destino. Revisa tu conexión e inténtalo de nuevo.",
        { retry: !notFound }
      );
      return;
    }

    HZ.state = { country }; // permite que el botón de favoritos use este país
    HZ.ui.register(country);
    renderCountry();
    loading.hidden = true;
    root.hidden = false;
    renderPlaces();
    loadLocationAndWeather();
  }

  function renderCountry() {
    const c = country;
    document.title = `${c.name} | Detalle del destino | Horizon`;

    $("#hero-img").src = HZ.ui.coverFor(c);
    const flag = $("#dest-flag");
    flag.dataset.fallback = `assets/flags/${c.code.toLowerCase()}.svg`;
    flag.src = c.flag || flag.dataset.fallback;
    flag.alt = c.flagAlt;

    $("#dest-title").textContent = c.name;
    $("#dest-sub").textContent = [c.capital, c.subregion || c.region].filter(Boolean).join(" · ");

    /* Botón de favoritos */
    const fav = $("#fav-btn");
    fav.dataset.code = c.code;
    fav.dataset.name = c.name;
    HZ.ui.updateFavButtons(c.code, HZ.storage.favorites.has(c.code));
    $("#plan-btn").href = `crear-viaje.html?code=${encodeURIComponent(c.code)}`;

    /* Datos rápidos */
    $("#fact-capital").textContent = c.capital || "No tiene";
    $("#fact-pop").textContent = c.population >= 1e6 ? `${formatPopulation(c.population).replace(" M", "")} millones` : formatNumber(c.population);
    $("#fact-lang").textContent = c.languages.length ? c.languages.slice(0, 2).join(", ") + (c.languages.length > 2 ? "…" : "") : "—";
    const currency = c.currencies[0];
    $("#fact-cur").textContent = currency ? `${currency.name}${currency.symbol ? ` (${currency.symbol})` : ""}` : "—";

    /* Pestaña Info */
    $("#about-title").textContent = `Sobre ${c.name}`;
    const parts = [`${c.name} es un país de ${c.region}${c.subregion ? ` (${c.subregion})` : ""}${c.capital ? ` y su capital es ${c.capital}` : ""}.`];
    if (c.population) parts.push(`Tiene ${formatNumber(c.population)} habitantes${c.area ? ` y una superficie de ${formatNumber(c.area)} km²` : ""}.`);
    if (c.languages.length) parts.push(`${c.languages.length > 1 ? "Sus idiomas son" : "Su idioma es"} ${c.languages.map((l) => l.toLowerCase()).join(", ")}.`);
    $("#about-text").textContent = parts.join(" ");

    const rows = [
      ["Nombre oficial", c.official],
      ["Capital", c.capital || "No tiene"],
      ["Región", c.region],
      ["Subregión", c.subregion],
      ["Población", formatNumber(c.population)],
      ["Superficie", c.area ? `${formatNumber(c.area)} km²` : ""],
      ["Idiomas", c.languages.join(", ")],
      ["Moneda", c.currencies.map((m) => `${m.name} (${m.code})`).join(", ")],
      ["Zona horaria", c.timezones[0] || ""],
      ["Dominio de internet", c.tld],
      ["Prefijo telefónico", c.callingCode],
    ];
    $("#data-list").innerHTML = rows.filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("");

    $("#places-country").textContent = c.name;
    $("#forecast-title").textContent = "Pronóstico";
    if (c.fromBackup) status.innerHTML = banner("Mostramos datos de respaldo porque REST Countries no respondió.", { type: "info" });
  }

  /* ====================================================================
     2. Ubicación (Nominatim) y 3. Clima (Open-Meteo)
     ==================================================================== */
  async function loadLocationAndWeather() {
    const query = country.capital ? `${country.capital}, ${country.name}` : country.name;
    const token = ++requestId;
    renderWeatherLoading();

    capitalLocation = null;
    try {
      const found = await HZ.api.geocode(query, country.code);
      if (found) capitalLocation = { name: country.capital || country.name, lat: found.lat, lon: found.lon };
    } catch (error) {
      console.warn("Nominatim no respondió:", error.message);
    }
    /* Plan B: coordenadas que ya trae REST Countries */
    if (!capitalLocation && country.latlng) {
      capitalLocation = { name: country.capital || country.name, lat: country.latlng[0], lon: country.latlng[1] };
    }
    if (token !== requestId) return;

    if (!capitalLocation) {
      showWeatherError("No pudimos ubicar este destino en el mapa, así que no podemos consultar su clima.", false);
      return;
    }
    showLocation(capitalLocation);
  }

  async function showLocation(location) {
    const token = ++requestId;
    renderMap(location);
    renderWeatherLoading();
    $("#city-reset").hidden = location === capitalLocation;
    if (capitalLocation) $("#city-reset").textContent = `Volver a ${capitalLocation.name}`;

    try {
      const weather = await HZ.api.getWeather(location.lat, location.lon);
      if (token !== requestId) return; // llegó una respuesta más nueva
      renderWeather(location, weather);
    } catch (error) {
      if (token !== requestId) return;
      showWeatherError("No pudimos consultar el clima en este momento. Inténtalo de nuevo en unos segundos.", true);
    }
  }

  function renderWeatherLoading() {
    $("#weather-status").innerHTML = "";
    $("#weather-box").classList.add("is-loading");
    $("#forecast-list").innerHTML = HZ.ui.skeletons(5, "day");
  }

  function showWeatherError(message, retry) {
    $("#weather-box").classList.add("is-loading");
    $("#weather-status").innerHTML = banner(message, { retry });
    $("#forecast-list").innerHTML = banner(message, { retry });
  }

  function renderWeather(location, w) {
    const info = HZ.api.weatherInfo(w.code);
    $("#weather-box").classList.remove("is-loading");
    $("#weather-status").innerHTML = "";

    $("#w-place").innerHTML = `${icon("pin")}${esc(location.name)}, ${esc(country.name)}`;
    $("#w-temp").setAttribute("aria-label", `${Math.round(w.temp)} grados Celsius`);
    $("#w-temp-value").textContent = Math.round(w.temp);
    $("#w-cond").innerHTML = `${icon(info.icon)}${info.label}`;
    $("#w-wind").textContent = `${Math.round(w.wind)} km/h`;
    $("#w-feel").textContent = `${Math.round(w.feels)} °C`;
    $("#w-hum").textContent = `${Math.round(w.humidity)} %`;
    $("#w-hum-bar").style.width = `${Math.round(w.humidity)}%`;
    const rain = w.rainToday ?? 0;
    $("#w-rain").textContent = w.rainToday === null ? "—" : `${Math.round(rain)} %`;
    $("#w-rain-bar").style.width = `${Math.round(rain)}%`;
    $("#w-note").textContent = `Datos de Open-Meteo · actualizado a las ${w.time.slice(11, 16)} (hora local del destino).`;

    /* Pronóstico de 5 días */
    $("#forecast-title").textContent = `Pronóstico para ${location.name}`;
    const dayName = new Intl.DateTimeFormat("es", { weekday: "short" });
    $("#forecast-list").innerHTML = w.days
      .slice(0, 5)
      .map((day, i) => {
        const d = HZ.api.weatherInfo(day.code);
        const cool = ["cloud", "cloud-rain", "snowflake"].includes(d.icon) ? "icon--cloud" : "";
        return `<li class="forecast__day${i === 0 ? " is-today" : ""}">
          <span class="forecast__name">${i === 0 ? "Hoy" : capitalize(dayName.format(parseISO(day.date)).replace(".", ""))}</span>
          ${icon(d.icon, cool)}
          <span class="forecast__max">${Math.round(day.max)}°</span>
          <span class="forecast__min">mín. ${Math.round(day.min)}°</span>
          <span class="forecast__rain">${icon("droplet")}${day.rain === null ? "—" : Math.round(day.rain)} %</span>
        </li>`;
      })
      .join("");
  }

  /* Mapa incrustado de OpenStreetMap + coordenadas */
  function renderMap(location) {
    const { lat, lon } = location;
    const dLon = 0.14;
    const dLat = 0.09;
    const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((n) => n.toFixed(5)).join(",");
    $("#map-frame").src = `${HZ.config.apis.osmEmbed}?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lon.toFixed(5)}`;
    $("#loc-city").textContent = location.name;
    $("#loc-country").textContent = country.name;
    $("#loc-lat").textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`;
    $("#loc-lon").textContent = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "O"}`;
    $("#osm-link").href = `${HZ.config.apis.osmView}?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=12/${lat.toFixed(5)}/${lon.toFixed(5)}`;
  }

  /* Buscar el clima de otra ciudad del mismo país (Nominatim -> Open-Meteo) */
  $("#city-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#city-input");
    const message = $("#city-msg");
    const city = input.value.trim();
    if (!country) return;
    if (city.length < 2) {
      message.textContent = "Escribe el nombre de una ciudad.";
      return;
    }
    message.textContent = "Buscando ciudad…";
    try {
      const found = await HZ.api.geocode(`${city}, ${country.name}`, country.code);
      if (!found) {
        message.textContent = `No encontramos "${city}" en ${country.name}. Revisa el nombre e inténtalo de nuevo.`;
        return;
      }
      message.textContent = "";
      showLocation({ name: found.name || city, lat: found.lat, lon: found.lon });
    } catch (error) {
      message.textContent = "No pudimos consultar el servicio de ubicaciones. Inténtalo de nuevo.";
    }
  });

  $("#city-reset").addEventListener("click", () => {
    $("#city-input").value = "";
    $("#city-msg").textContent = "";
    if (capitalLocation) showLocation(capitalLocation);
  });

  /* Reintentar cuando falla el clima o la carga */
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-retry]")) return;
    if (!country) init();
    else loadLocationAndWeather();
  });

  /* ====================================================================
     Lugares guardados por el usuario (localStorage)
     ==================================================================== */
  const typeInfo = (value) => HZ.config.placeTypes.find((t) => t.value === value) || HZ.config.placeTypes[5];

  function renderPlaces() {
    const places = HZ.storage.places.byCountry(country.code);
    $("#places-empty").hidden = places.length !== 0;
    $("#places-list").innerHTML = places
      .map((p) => {
        const t = typeInfo(p.type);
        return `<article class="place-card" data-id="${p.id}">
          <div class="place-card__top"><span class="place-card__icon">${icon(t.icon)}</span><span class="chip ${t.chip}">${esc(p.type)}</span></div>
          <h3>${esc(p.name)}</h3>
          ${p.note ? `<p>${esc(p.note)}</p>` : ""}
          <button class="btn btn--outline btn--sm" type="button" data-place-remove>${icon("trash")}<span>Quitar lugar</span></button>
        </article>`;
      })
      .join("");
  }

  $("#p-type").innerHTML = HZ.config.placeTypes.map((t) => `<option value="${t.value}">${t.value}</option>`).join("");

  $("#place-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#p-name");
    const field = name.closest(".field");
    const value = name.value.trim();
    const duplicate = HZ.storage.places.byCountry(country.code).some((p) => p.name.toLowerCase() === value.toLowerCase());
    const error = !value ? "Escribe el nombre del lugar" : value.length > 60 ? "Usa máximo 60 caracteres" : duplicate ? "Ya guardaste un lugar con ese nombre" : "";
    HZ.ui.setFieldState(name, !error, error);
    if (error) {
      name.focus();
      return;
    }
    HZ.storage.places.add(country.code, { id: uid(), name: value, type: $("#p-type").value, note: $("#p-note").value.trim(), createdAt: new Date().toISOString() });
    event.target.reset();
    field.classList.remove("is-valid");
    renderPlaces();
    toast(`${value} se guardó en tu lista`, "bookmark");
  });

  $("#places-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-place-remove]");
    if (!button) return;
    const card = button.closest(".place-card");
    HZ.storage.places.remove(country.code, card.dataset.id);
    renderPlaces();
    toast("Lugar quitado de tu lista", "info");
  });

  /* Pestañas */
  HZ.ui.initTabs();

  init();
})();

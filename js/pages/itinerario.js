/* ==========================================================================
   HORIZON · pages/itinerario.js
   Itinerario de un viaje (?id=...): actividades por día, guardadas en
   localStorage, resumen con el clima actual (Open-Meteo) y lugares guardados.
   ========================================================================== */

(function () {
  "use strict";

  const { $, $$, esc, icon, formatDate, capitalize, daysBetween, addDays, formatNumber } = HZ.utils;
  const { toast } = HZ.ui;

  const params = new URLSearchParams(location.search);
  const trip = HZ.storage.trips.get(params.get("id") || "");

  const root = $("#trip-root");
  const notFound = $("#trip-empty");
  const dayList = $("#day-list");

  if (!trip) {
    notFound.hidden = false;
    return;
  }
  root.hidden = false;

  const save = () => HZ.storage.trips.save(trip);
  const dayDate = (index) => addDays(trip.startDate, index);
  const totalActivities = () => trip.days.reduce((sum, day) => sum + day.activities.length, 0);

  /* ---------- Encabezado y resumen ---------- */
  function renderHeader() {
    document.title = `${trip.name} | Itinerario | Horizon`;
    $("#trip-title").textContent = trip.name;
    const travelers = trip.travelers === "9+" ? "9 o más viajeros" : `${trip.travelers} ${Number(trip.travelers) === 1 ? "viajero" : "viajeros"}`;
    $("#trip-meta").innerHTML = `
      <li>${icon("calendar")}${formatDate(trip.startDate, { day: "numeric", month: "short" })} – ${formatDate(trip.endDate)}</li>
      <li>${icon("users")}${travelers}</li>
      <li>${icon("plane")}${esc(trip.type)}</li>
      ${trip.budget !== null && trip.budget !== undefined ? `<li>${icon("coin")}Presupuesto: USD ${formatNumber(trip.budget)}</li>` : ""}`;
    $("#edit-btn").href = `crear-viaje.html?edit=${encodeURIComponent(trip.id)}`;

    $("#sum-flag").src = trip.country.flag || `assets/flags/${trip.country.code.toLowerCase()}.svg`;
    $("#sum-flag").dataset.fallback = `assets/flags/${trip.country.code.toLowerCase()}.svg`;
    $("#sum-flag").alt = `Bandera de ${trip.country.name}`;
    $("#sum-place").textContent = trip.country.capital ? `${trip.country.capital}, ${trip.country.name}` : trip.country.name;
    $("#sum-sub").textContent = `${trip.country.region}`;
    $("#sum-link").href = HZ.ui.detailUrl(trip.country.code) + "#clima";
    renderSummary();
  }

  function renderSummary() {
    const days = trip.days.length;
    $("#sum-duration").textContent = `${days} ${days === 1 ? "día" : "días"}`;
    const total = totalActivities();
    $("#sum-activities").textContent = `${total} ${total === 1 ? "planificada" : "planificadas"}`;
  }

  /* ---------- Días y actividades ---------- */
  const byTime = (a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1; // sin hora al final
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  };

  function activitiesHTML(day) {
    if (!day.activities.length) return `<li class="activity-empty">Aún no hay actividades para este día.</li>`;
    return day.activities
      .map(
        (a) => `
      <li class="activity" data-id="${a.id}">
        <span class="activity__time">${a.time ? esc(a.time) : "Sin hora"}</span>
        <div><p class="activity__title">${esc(a.title)}</p>${a.note ? `<p class="activity__note">${esc(a.note)}</p>` : ""}</div>
        <button class="icon-btn" type="button" data-remove-activity aria-label="Eliminar actividad: ${esc(a.title)}">${icon("trash")}</button>
      </li>`
      )
      .join("");
  }

  function dayHTML(day, index) {
    const n = index + 1;
    const label = capitalize(formatDate(dayDate(index), { weekday: "long", day: "numeric", month: "long" }));
    return `
<article class="day" data-day="${index}" aria-labelledby="day-${n}-title">
  <header class="day__head">
    <span class="day__badge">${n}</span>
    <div><h3 id="day-${n}-title">Día ${n}</h3><p>${label}</p></div>
  </header>
  <ul class="activity-list" aria-label="Actividades del día ${n}">${activitiesHTML(day)}</ul>
  <form class="add-activity" novalidate>
    <label class="sr-only" for="time-${n}">Hora</label>
    <input class="input" id="time-${n}" type="time">
    <label class="sr-only" for="act-${n}">Actividad</label>
    <input class="input" id="act-${n}" type="text" placeholder="¿Qué quieres hacer este día?" maxlength="80">
    <button class="btn btn--outline" type="submit">${icon("plus")}Agregar</button>
  </form>
</article>`;
  }

  const renderDays = () => (dayList.innerHTML = trip.days.map(dayHTML).join(""));

  function refreshDay(index) {
    const list = $(`.day[data-day="${index}"] .activity-list`, dayList);
    if (list) list.innerHTML = activitiesHTML(trip.days[index]);
    renderSummary();
    renderSuggestions();
  }

  /* Agregar actividad (formulario de cada día) */
  dayList.addEventListener("submit", (event) => {
    const form = event.target.closest(".add-activity");
    if (!form) return;
    event.preventDefault();
    const index = Number(form.closest(".day").dataset.day);
    const text = $("input[type='text']", form);
    const time = $("input[type='time']", form);
    if (!text.value.trim()) {
      text.focus();
      toast("Escribe el nombre de la actividad", "alert");
      return;
    }
    trip.days[index].activities.push({ id: HZ.utils.uid(), time: time.value, title: text.value.trim(), note: "" });
    trip.days[index].activities.sort(byTime);
    save();
    text.value = "";
    time.value = "";
    refreshDay(index);
    toast("Actividad agregada");
  });

  /* Eliminar actividad */
  dayList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-activity]");
    if (!button) return;
    const index = Number(button.closest(".day").dataset.day);
    const id = button.closest(".activity").dataset.id;
    trip.days[index].activities = trip.days[index].activities.filter((a) => a.id !== id);
    save();
    refreshDay(index);
    toast("Actividad eliminada", "trash");
  });

  /* Agregar un día al final (también mueve la fecha de regreso) */
  $("[data-add-day]").addEventListener("click", () => {
    if (trip.days.length >= HZ.config.maxTripDays) {
      toast(`Un viaje no puede durar más de ${HZ.config.maxTripDays} días`, "alert");
      return;
    }
    trip.days.push({ activities: [] });
    trip.endDate = addDays(trip.endDate, 1);
    save();
    renderHeader();
    renderDays();
    toast(`Día ${trip.days.length} agregado`);
  });

  /* ---------- Lugares guardados del país (de la ficha del destino) ---------- */
  function renderSuggestions() {
    const saved = HZ.storage.places.byCountry(trip.country.code);
    const list = $("#places-suggest");
    const used = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.title)));
    $("#places-suggest-empty").hidden = saved.length !== 0;
    list.innerHTML = saved
      .map(
        (p) => `<li><span>${esc(p.name)}</span>
        <button class="btn btn--outline btn--sm" type="button" data-suggest="${p.id}" ${used.has(p.name) ? "disabled" : ""}>${used.has(p.name) ? "Agregado" : "Agregar"}</button></li>`
      )
      .join("");
  }

  $("#places-suggest").addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggest]");
    if (!button) return;
    const place = HZ.storage.places.byCountry(trip.country.code).find((p) => p.id === button.dataset.suggest);
    if (!place) return;
    trip.days[0].activities.push({ id: HZ.utils.uid(), time: "", title: place.name, note: `Lugar guardado · ${place.type}` });
    trip.days[0].activities.sort(byTime);
    save();
    refreshDay(0);
    toast(`${place.name} se agregó al Día 1`);
  });

  /* ---------- Compartir: copia el itinerario como texto ---------- */
  $("#share-btn").addEventListener("click", async () => {
    const lines = [`${trip.name} · ${trip.country.name}`, `${formatDate(trip.startDate)} al ${formatDate(trip.endDate)}`, ""];
    trip.days.forEach((day, i) => {
      lines.push(`Día ${i + 1} · ${capitalize(formatDate(dayDate(i), { weekday: "long", day: "numeric", month: "long" }))}`);
      if (!day.activities.length) lines.push("  (sin actividades)");
      day.activities.forEach((a) => lines.push(`  ${a.time || "--:--"}  ${a.title}`));
      lines.push("");
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n").trim());
      toast("Itinerario copiado. Ya puedes pegarlo donde quieras", "share");
    } catch (error) {
      toast("No se pudo copiar el itinerario en este navegador", "alert");
    }
  });

  /* ---------- Clima actual del destino (Nominatim + Open-Meteo) ---------- */
  async function loadWeather() {
    const target = $("#sum-weather");
    try {
      let coords = trip.country.latlng ? { lat: trip.country.latlng[0], lon: trip.country.latlng[1] } : null;
      try {
        const query = trip.country.capital ? `${trip.country.capital}, ${trip.country.name}` : trip.country.name;
        coords = (await HZ.api.geocode(query, trip.country.code)) || coords;
      } catch (error) {
        /* si Nominatim falla se usan las coordenadas que ya trae el país */
      }
      if (!coords) throw new Error("Sin coordenadas");
      const weather = await HZ.api.getWeather(coords.lat, coords.lon);
      target.textContent = `${Math.round(weather.temp)} °C · ${HZ.api.weatherInfo(weather.code).label}`;
    } catch (error) {
      target.textContent = "No disponible";
    }
  }

  renderHeader();
  renderDays();
  renderSuggestions();
  loadWeather();
})();

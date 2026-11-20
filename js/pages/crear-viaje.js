/* ==========================================================================
   HORIZON · pages/crear-viaje.js
   Formulario para crear (o editar) un viaje. Valida en el navegador y guarda
   el viaje con su itinerario en localStorage.
   ========================================================================== */

(function () {
  "use strict";

  const { $, $$, norm, esc, todayISO, addDays, daysBetween, uid } = HZ.utils;
  const { setFieldState } = HZ.ui;
  const { maxTripDays } = HZ.config;

  const form = $("#trip-form");
  const f = {
    name: $("#t-name"),
    dest: $("#t-dest"),
    start: $("#t-start"),
    end: $("#t-end"),
    people: $("#t-people"),
    type: $("#t-type"),
    budget: $("#t-budget"),
    notes: $("#t-notes"),
  };
  const alertBox = $("#form-alert");
  const counter = $("#notes-counter");

  let countries = [];
  let editing = null; // viaje que se está editando (si hay)

  /* ---------- Carga de países para el campo Destino ---------- */
  async function loadCountries() {
    try {
      ({ countries } = await HZ.api.getCountries());
      $("#dest-list").innerHTML = countries.map((c) => `<option value="${esc(c.name)}"></option>`).join("");
      prefill();
    } catch (error) {
      $("#dest-hint").textContent = "No pudimos cargar la lista de países. Revisa tu conexión y recarga la página.";
    }
  }

  const findCountry = (text) => {
    const q = norm(text);
    return countries.find((c) => norm(c.name) === q || norm(c.nameEn) === q) || null;
  };

  /* ---------- Opciones de los selectores ---------- */
  f.people.innerHTML =
    `<option value="">Selecciona</option>` +
    Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">${i + 1} ${i === 0 ? "viajero" : "viajeros"}</option>`).join("") +
    `<option value="9+">9 o más viajeros</option>`;
  f.type.innerHTML = `<option value="">Selecciona un tipo de viaje</option>` + HZ.config.tripTypes.map((t) => `<option value="${t}">${t}</option>`).join("");

  f.start.min = todayISO();
  f.end.min = todayISO();

  /* ---------- Reglas de validación ---------- */
  /* Cada regla devuelve [esValido, mensajeDeError] */
  const rules = {
    name() {
      const v = f.name.value.trim();
      if (!v) return [false, "Escribe un nombre para tu viaje"];
      if (v.length < 3) return [false, "El nombre debe tener al menos 3 caracteres"];
      if (v.length > 60) return [false, "El nombre no puede superar los 60 caracteres"];
      return [true];
    },
    dest() {
      const v = f.dest.value.trim();
      if (!v) return [false, "Indica a dónde quieres ir"];
      if (!countries.length) return [false, "La lista de países aún no está disponible. Recarga la página"];
      if (!findCountry(v)) return [false, "Elige un país de la lista de sugerencias"];
      return [true];
    },
    start() {
      if (!f.start.value) return [false, "Selecciona la fecha de salida"];
      const unchanged = editing && editing.startDate === f.start.value;
      if (!unchanged && f.start.value < todayISO()) return [false, "La fecha de salida no puede ser anterior a hoy"];
      return [true];
    },
    end() {
      if (!f.end.value) return [false, "Selecciona la fecha de regreso"];
      if (f.start.value && f.end.value < f.start.value) return [false, "La fecha de regreso debe ser igual o posterior a la de salida"];
      if (f.start.value && daysBetween(f.start.value, f.end.value) + 1 > maxTripDays) return [false, `El viaje no puede durar más de ${maxTripDays} días`];
      return [true];
    },
    people: () => (f.people.value ? [true] : [false, "Selecciona el número de viajeros"]),
    type: () => (f.type.value ? [true] : [false, "Selecciona un tipo de viaje"]),
    budget() {
      if (f.budget.value === "") return [true];
      const n = Number(f.budget.value);
      if (Number.isNaN(n) || n < 0) return [false, "El presupuesto debe ser un número mayor o igual a 0"];
      if (n > 1000000000) return [false, "Escribe un presupuesto más realista"];
      return [true];
    },
    notes: () => (f.notes.value.length <= 300 ? [true] : [false, "Las notas no pueden superar los 300 caracteres"]),
  };

  function check(key) {
    const [ok, message] = rules[key]();
    setFieldState(f[key], ok, message);
    return ok;
  }

  Object.keys(f).forEach((key) => {
    const eventName = f[key].tagName === "SELECT" || f[key].type === "date" ? "change" : "input";
    f[key].addEventListener("blur", () => f[key].value !== "" && check(key));
    f[key].addEventListener(eventName, () => {
      if (f[key].closest(".field").classList.contains("is-invalid") || f[key].value !== "") check(key);
      if (key === "start" && f.end.value) check("end");
    });
  });

  f.notes.addEventListener("input", () => (counter.textContent = `${f.notes.value.length} / 300`));

  /* ---------- Modo editar y destino precargado ---------- */
  function prefill() {
    const params = new URLSearchParams(location.search);

    if (params.get("edit")) {
      editing = HZ.storage.trips.get(params.get("edit"));
      if (editing) {
        $("#form-title").textContent = "Editar viaje";
        $("#form-subtitle").textContent = "Actualiza los datos de tu viaje. Tus actividades se conservan.";
        $("#submit-label").textContent = "Guardar cambios";
        document.title = "Editar viaje | Horizon";
        f.name.value = editing.name;
        f.dest.value = editing.country.name;
        f.start.value = editing.startDate;
        f.end.value = editing.endDate;
        f.people.value = editing.travelers;
        f.type.value = editing.type;
        f.budget.value = editing.budget ?? "";
        f.notes.value = editing.notes || "";
        counter.textContent = `${f.notes.value.length} / 300`;
        f.start.removeAttribute("min");
      }
    } else if (params.get("code")) {
      const country = countries.find((c) => c.code === params.get("code").toUpperCase());
      if (country) f.dest.value = country.name;
    }
  }

  /* ---------- Construcción del viaje ---------- */
  /* Un viaje tiene un día por cada fecha entre la salida y el regreso */
  function buildDays(startDate, endDate, previous = []) {
    const total = daysBetween(startDate, endDate) + 1;
    const days = Array.from({ length: total }, (_, i) => ({ activities: previous[i] ? previous[i].activities : [] }));
    /* Si el viaje se acortó, las actividades de los días eliminados pasan al último día para no perderlas */
    const leftovers = previous.slice(total).flatMap((day) => day.activities);
    if (leftovers.length) days[total - 1].activities.push(...leftovers);
    return days;
  }

  function saveTrip() {
    const country = findCountry(f.dest.value);
    const trip = {
      id: editing ? editing.id : uid(),
      name: f.name.value.trim(),
      country: {
        code: country.code, name: country.name, capital: country.capital,
        region: country.region, regionEn: country.regionEn, flag: country.flag, latlng: country.latlng,
      },
      startDate: f.start.value,
      endDate: f.end.value,
      travelers: f.people.value,
      type: f.type.value,
      budget: f.budget.value === "" ? null : Number(f.budget.value),
      notes: f.notes.value.trim(),
      createdAt: editing ? editing.createdAt : new Date().toISOString(),
      days: buildDays(f.start.value, f.end.value, editing ? editing.days : []),
    };
    return HZ.storage.trips.save(trip) ? trip : null;
  }

  /* ---------- Envío ---------- */
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const invalid = Object.keys(f).filter((key) => !check(key));
    alertBox.classList.toggle("is-visible", invalid.length > 0);
    if (invalid.length) {
      $("#form-alert-text").textContent =
        invalid.length === 1 ? "Hay 1 campo que debes corregir antes de continuar." : `Hay ${invalid.length} campos que debes corregir antes de continuar.`;
      f[invalid[0]].focus();
      return;
    }

    const trip = saveTrip();
    if (!trip) {
      $("#form-alert-text").textContent = "No pudimos guardar el viaje en tu navegador. Revisa que el almacenamiento no esté bloqueado.";
      alertBox.classList.add("is-visible");
      return;
    }

    $("#trip-success-title").textContent = editing ? "¡Cambios guardados!" : "¡Viaje creado!";
    $("#trip-success-name").textContent = trip.name;
    $("#trip-success-link").href = HZ.ui.tripDetailsUrl(trip.id);
    $("[data-reset-trip]").hidden = Boolean(editing);
    $("#trip-success").showModal();
  });

  $("[data-reset-trip]").addEventListener("click", () => {
    form.reset();
    $$(".field", form).forEach((field) => field.classList.remove("is-valid", "is-invalid"));
    counter.textContent = "0 / 300";
    alertBox.classList.remove("is-visible");
    $("#trip-success").close();
    f.name.focus();
  });

  loadCountries();
})();

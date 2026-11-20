/* ==========================================================================
   HORIZON · ui.js
   Comportamientos y plantillas que se usan en varias páginas:
   - Navbar, menús desplegables, avisos (toasts) y ventana de confirmación
   - Pestañas accesibles, botón de favoritos y sesión del usuario
   - Plantillas HTML de las tarjetas (destinos, favoritos y viajes)
   ========================================================================== */

(function () {
  "use strict";

  const { $, $$, esc, icon, formatPopulation, formatDate, daysBetween, todayISO } = HZ.utils;
  const { localCovers, regionCover } = HZ.config;

  /* Registro de países ya dibujados: permite guardar uno en favoritos sin volver a consultar la API */
  const registry = new Map();
  const register = (country) => registry.set(country.code, country);

  /* ------------------------------------------------------------------
     Avisos (toasts)
     ------------------------------------------------------------------ */
  function toast(message, iconName = "check-circle") {
    let region = $("#toast-region");
    if (!region) {
      region = document.createElement("div");
      region.id = "toast-region";
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const item = document.createElement("div");
    item.className = "toast";
    item.innerHTML = `${icon(iconName)}<span>${esc(message)}</span>`;
    region.appendChild(item);
    setTimeout(() => {
      item.classList.add("toast--out");
      setTimeout(() => item.remove(), 320);
    }, 3200);
  }

  /* ------------------------------------------------------------------
     Ventana de confirmación (elemento <dialog>)
     Devuelve una promesa: true si el usuario confirma, false si cancela
     ------------------------------------------------------------------ */
  function confirmDialog({ title, text, confirmLabel = "Eliminar", danger = true }) {
    let dialog = $("#hz-confirm");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "hz-confirm";
      dialog.className = "modal";
      dialog.setAttribute("aria-labelledby", "hz-confirm-title");
      dialog.innerHTML = `
        <form method="dialog">
          <div class="modal__body">
            <span class="modal__icon modal__icon--danger">${icon("trash", "icon--lg")}</span>
            <h2 id="hz-confirm-title"></h2>
            <p id="hz-confirm-text"></p>
          </div>
          <div class="modal__footer">
            <button class="btn btn--outline" value="cancel">Cancelar</button>
            <button class="btn btn--danger" value="ok" id="hz-confirm-ok"></button>
          </div>
        </form>`;
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close("cancel"); // clic en el fondo oscuro
      });
      document.body.appendChild(dialog);
    }
    $("#hz-confirm-title").textContent = title;
    $("#hz-confirm-text").textContent = text;
    const okButton = $("#hz-confirm-ok");
    okButton.textContent = confirmLabel;
    okButton.className = `btn ${danger ? "btn--danger" : "btn--primary"}`;

    return new Promise((resolve) => {
      dialog.returnValue = "";
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
      dialog.showModal();
    });
  }

  /* ------------------------------------------------------------------
     Navbar responsive y menús desplegables
     ------------------------------------------------------------------ */
  function initNav() {
    const toggle = $(".navbar__toggle");
    const menu = $("#nav-menu");
    if (!toggle || !menu) return;
    const mobile = window.matchMedia("(max-width: 900px)");

    const sync = () => {
      if (mobile.matches) menu.hidden = toggle.getAttribute("aria-expanded") !== "true";
      else {
        menu.hidden = false;
        toggle.setAttribute("aria-expanded", "false");
      }
    };
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      menu.hidden = open;
    });
    mobile.addEventListener("change", sync);
    sync();
  }

  function closeMenus(except) {
    $$("[data-menu-toggle][aria-expanded='true']").forEach((button) => {
      if (button === except) return;
      button.setAttribute("aria-expanded", "false");
      const menu = document.getElementById(button.getAttribute("aria-controls"));
      if (menu) menu.hidden = true;
    });
  }

  /* ------------------------------------------------------------------
     Pestañas accesibles (role="tablist")
     ------------------------------------------------------------------ */
  function initTabs(root = document) {
    $$("[role='tablist']", root).forEach((list) => {
      const tabs = $$("[role='tab']", list);

      const select = (tab, focus) => {
        tabs.forEach((item) => {
          const active = item === tab;
          item.setAttribute("aria-selected", String(active));
          item.tabIndex = active ? 0 : -1;
          const panel = document.getElementById(item.getAttribute("aria-controls"));
          if (panel) panel.hidden = !active;
        });
        if (focus) tab.focus();
      };

      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => select(tab));
        tab.addEventListener("keydown", (event) => {
          let next = null;
          if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
          if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
          if (event.key === "Home") next = tabs[0];
          if (event.key === "End") next = tabs[tabs.length - 1];
          if (next) {
            event.preventDefault();
            select(next, true);
          }
        });
      });

      /* Abre la pestaña indicada en la URL: detalle.html?code=ES#clima */
      const fromHash = tabs.find((tab) => `#${tab.getAttribute("aria-controls").replace("panel-", "")}` === location.hash);
      if (fromHash) select(fromHash);
    });
  }

  /* ------------------------------------------------------------------
     Sesión del usuario (sessionStorage)
     ------------------------------------------------------------------ */
  function syncSession() {
    const current = HZ.storage.session.get();
    $$("[data-session-hello]").forEach((el) => {
      el.hidden = !current;
      if (current) el.textContent = `Hola, ${current.name}`;
    });
    $$("[data-session-login]").forEach((el) => (el.hidden = Boolean(current)));
    $$("[data-session-logout]").forEach((el) => (el.hidden = !current));
  }

  /* Cuenta de favoritos y viajes en la página "Explorar" */
  function syncCounts() {
    $$("[data-count]").forEach((el) => {
      const total = el.dataset.count === "favoritos" ? HZ.storage.favorites.all().length : HZ.storage.trips.all().length;
      el.textContent = total === 1 ? "1 guardado" : `${total} guardados`;
    });
  }

  /* ------------------------------------------------------------------
     Favoritos: botón corazón (funciona en cualquier página)
     ------------------------------------------------------------------ */
  function updateFavButtons(code, active) {
    $$(`[data-fav-toggle][data-code="${code}"]`).forEach((button) => {
      button.setAttribute("aria-pressed", String(active));
      const name = button.dataset.name || "el destino";
      button.setAttribute("aria-label", active ? `Quitar ${name} de favoritos` : `Agregar ${name} a favoritos`);
      const label = $(".fav-btn__text", button);
      if (label) label.textContent = active ? button.dataset.textOn || "En favoritos" : button.dataset.textOff || "Agregar a favoritos";
    });
  }

  function favButton(country, { text = false, extraClass = "" } = {}) {
    const active = HZ.storage.favorites.has(country.code);
    const label = active ? `Quitar ${country.name} de favoritos` : `Agregar ${country.name} a favoritos`;
    const content = text
      ? `${icon("heart")}<span class="fav-btn__text">${active ? "Guardado" : "Favorito"}</span>`
      : icon("heart");
    const kind = text ? "btn btn--ghost btn--sm" : "icon-btn";
    return `<button class="${kind} fav-btn ${extraClass}" type="button" data-fav-toggle data-code="${country.code}" data-name="${esc(country.name)}" data-text-on="Guardado" data-text-off="Favorito" aria-pressed="${active}" aria-label="${esc(label)}" title="${esc(label)}">${content}</button>`;
  }

  /* ------------------------------------------------------------------
     Plantillas HTML
     ------------------------------------------------------------------ */
  /* Ilustración de portada: la del país si existe, o la de su región */
  function coverFor(country) {
    const code = (country.code || "").toLowerCase();
    if (localCovers.includes(code)) return `assets/img/cover-${code}.svg`;
    return `assets/img/cover-${regionCover[country.regionEn] || "fr"}.svg`;
  }

  /* <img> de bandera con respaldo local si la imagen de la API no carga */
  function flagImg(country, width = 60, height = 40) {
    const fallback = `assets/flags/${(country.code || "").toLowerCase()}.svg`;
    const src = country.flag || fallback;
    return `<img src="${esc(src)}" alt="${esc(country.flagAlt || "Bandera de " + country.name)}" width="${width}" height="${height}" loading="lazy" data-fallback="${fallback}">`;
  }

  const detailUrl = (code) => `detalle.html?code=${encodeURIComponent(code)}`;

  /* Tarjeta vertical (destinos destacados) */
  function countryCard(country) {
    register(country);
    return `
<article class="dest-card">
  <div class="dest-card__media">
    <img src="${coverFor(country)}" alt="" width="800" height="500" loading="lazy">
    ${favButton(country, { extraClass: "dest-card__fav" })}
    <span class="flag-chip">${flagImg(country)}</span>
  </div>
  <div class="dest-card__body">
    <h3 class="dest-card__title"><a href="${detailUrl(country.code)}">${esc(country.name)}</a></h3>
    <p class="dest-card__capital">Capital: ${esc(country.capital || "No tiene")}</p>
    <ul class="meta-list">
      <li>${icon("globe")}${esc(country.region)}</li>
      <li>${icon("users")}${formatPopulation(country.population)} hab.</li>
    </ul>
    <div class="dest-card__footer">
      <a class="btn btn--primary btn--sm btn--block" href="${detailUrl(country.code)}">Ver detalles</a>
    </div>
  </div>
</article>`;
  }

  /* Tarjeta horizontal (resultados de búsqueda) */
  function countryRow(country) {
    register(country);
    return `
<article class="dest-row">
  <a class="dest-row__media" href="${detailUrl(country.code)}" tabindex="-1" aria-hidden="true">
    <img src="${coverFor(country)}" alt="" width="800" height="500" loading="lazy">
    <span class="flag-chip">${flagImg(country)}</span>
  </a>
  <div class="dest-row__body">
    <h3 class="dest-row__title"><a href="${detailUrl(country.code)}">${esc(country.name)}</a></h3>
    <p class="dest-row__sub">Capital: ${esc(country.capital || "No tiene")}</p>
    <ul class="meta-list">
      <li>${icon("globe")}${esc(country.region)}</li>
      <li>${icon("users")}${formatPopulation(country.population)} hab.</li>
      ${country.languages && country.languages.length ? `<li>${icon("language")}${esc(country.languages.slice(0, 2).join(" y "))}</li>` : ""}
    </ul>
  </div>
  <div class="dest-row__actions">
    ${favButton(country, { text: true })}
    <a class="btn btn--primary btn--sm" href="${detailUrl(country.code)}">Ver detalles</a>
    ${icon("chevron-right", "dest-row__chev")}
  </div>
</article>`;
  }

  /* Fila de la lista de favoritos */
  function favRow(fav) {
    const added = formatDate(fav.addedAt.slice(0, 10));
    return `
<article class="dest-row fav-row" data-code="${fav.code}">
  <a class="dest-row__media" href="${detailUrl(fav.code)}" tabindex="-1" aria-hidden="true">
    <img src="${coverFor(fav)}" alt="" width="800" height="500" loading="lazy">
    <span class="flag-chip">${flagImg(fav)}</span>
  </a>
  <div class="dest-row__body">
    <h3 class="dest-row__title"><a href="${detailUrl(fav.code)}">${esc(fav.name)}</a></h3>
    <p class="dest-row__sub">Capital: ${esc(fav.capital || "No tiene")}</p>
    <ul class="meta-list">
      <li>${icon("pin")}${esc(fav.capital ? fav.capital + ", " + fav.name : fav.name)}</li>
      <li>${icon("plane")}${esc(fav.region)}</li>
      <li>${icon("calendar")}Agregado el ${added}</li>
    </ul>
  </div>
  <div class="dest-row__actions">
    <button class="icon-btn fav-btn" type="button" data-fav-remove data-code="${fav.code}" data-name="${esc(fav.name)}" aria-pressed="true" aria-label="Quitar ${esc(fav.name)} de favoritos" title="Quitar de favoritos">${icon("heart")}</button>
    <a class="icon-btn" href="${detailUrl(fav.code)}" aria-label="Ver detalles de ${esc(fav.name)}" title="Ver detalles">${icon("chevron-right")}</a>
  </div>
</article>`;
  }

  /* Estado de un viaje según sus fechas */
  function tripStatus(trip) {
    const today = todayISO();
    if (trip.endDate < today) return { cls: "done", label: "Completado" };
    if (trip.startDate <= today) return { cls: "now", label: "En curso" };
    const left = daysBetween(today, trip.startDate);
    return { cls: "next", label: left === 1 ? "Mañana" : left <= 30 ? `Faltan ${left} días` : "Próximo" };
  }

  const tripDetailsUrl = (id) => `itinerario.html?id=${encodeURIComponent(id)}`;

  /* Tarjeta de un viaje */
  function tripCard(trip) {
    const status = tripStatus(trip);
    const days = daysBetween(trip.startDate, trip.endDate) + 1;
    const activities = trip.days.reduce((total, day) => total + day.activities.length, 0);
    const travelers = trip.travelers === "9+" ? "9 o más viajeros" : `${trip.travelers} ${Number(trip.travelers) === 1 ? "viajero" : "viajeros"}`;
    const dates = `${formatDate(trip.startDate, { day: "numeric", month: "short" })} – ${formatDate(trip.endDate)}`;
    const description = trip.notes ? esc(trip.notes) : `${days} ${days === 1 ? "día" : "días"} · ${activities} ${activities === 1 ? "actividad" : "actividades"}`;
    return `
<article class="trip-card" data-id="${trip.id}">
  <div class="trip-card__media"><img src="${coverFor(trip.country)}" alt="" width="800" height="500" loading="lazy"></div>
  <div class="trip-card__body">
    <span class="badge badge--${status.cls}">${status.label}</span>
    <h3><a class="trip-card__link" href="${tripDetailsUrl(trip.id)}">${esc(trip.name)}</a></h3>
    <p class="trip-card__desc">${description}</p>
    <ul class="meta-list">
      <li>${icon("pin")}${esc(trip.country.name)}</li>
      <li>${icon("calendar")}${dates}</li>
      <li>${icon("plane")}${esc(trip.type)} · ${travelers}</li>
    </ul>
  </div>
  <div class="trip-card__menu has-menu">
    <button class="icon-btn" type="button" data-menu-toggle aria-expanded="false" aria-controls="trip-menu-${trip.id}" aria-haspopup="true" aria-label="Opciones del viaje ${esc(trip.name)}">${icon("dots")}</button>
    <div class="menu" id="trip-menu-${trip.id}" hidden>
      <a class="menu__item" href="${tripDetailsUrl(trip.id)}">${icon("map")}Ver itinerario</a>
      <a class="menu__item" href="crear-viaje.html?edit=${encodeURIComponent(trip.id)}">${icon("edit")}Editar viaje</a>
      <div class="menu__sep" role="separator"></div>
      <button class="menu__item menu__item--danger" type="button" data-trip-delete data-id="${trip.id}">${icon("trash")}Eliminar</button>
    </div>
  </div>
</article>`;
  }

  /* Marcadores de carga (esqueletos) y avisos de estado */
  const skeletons = (count, kind = "card") =>
    Array.from({ length: count }, () => `<div class="skeleton skeleton--${kind}" aria-hidden="true"></div>`).join("");

  function banner(message, { type = "error", retry = false } = {}) {
    return `<div class="status-banner status-banner--${type}" role="${type === "error" ? "alert" : "status"}">
      ${icon(type === "error" ? "alert" : "info")}<p>${esc(message)}</p>
      ${retry ? `<button class="btn btn--outline btn--sm" type="button" data-retry>${icon("refresh")}Reintentar</button>` : ""}
    </div>`;
  }

  /* ------------------------------------------------------------------
     Validación visual de campos: marca el campo en rojo o verde y muestra el mensaje
     ------------------------------------------------------------------ */
  function setFieldState(input, valid, message) {
    const field = input.closest(".field");
    if (!field) return valid;
    field.classList.toggle("is-invalid", !valid);
    field.classList.toggle("is-valid", valid && input.value.trim() !== "");
    input.setAttribute("aria-invalid", String(!valid));
    const error = $(".field__error", field);
    if (error && message) $("span", error).textContent = message;
    return valid;
  }

  /* ------------------------------------------------------------------
     Eventos globales (un solo escuchador para todos los botones de la página)
     ------------------------------------------------------------------ */
  function initGlobalEvents() {
    document.addEventListener("click", (event) => {
      /* Menús desplegables */
      const toggle = event.target.closest("[data-menu-toggle]");
      if (toggle) {
        const menu = document.getElementById(toggle.getAttribute("aria-controls"));
        const open = toggle.getAttribute("aria-expanded") === "true";
        closeMenus(toggle);
        toggle.setAttribute("aria-expanded", String(!open));
        if (menu) menu.hidden = open;
        return;
      }
      if (!event.target.closest(".menu")) closeMenus();

      /* Corazón de favoritos */
      const fav = event.target.closest("[data-fav-toggle]");
      if (fav) {
        const country = registry.get(fav.dataset.code) || (HZ.state && HZ.state.country);
        if (!country) return;
        const active = HZ.storage.favorites.toggle(country);
        updateFavButtons(country.code, active);
        toast(active ? `${country.name} se agregó a tus favoritos` : `${country.name} se quitó de tus favoritos`, active ? "heart" : "info");
        syncCounts();
        return;
      }

      /* Cerrar sesión */
      if (event.target.closest("[data-session-logout]")) {
        HZ.storage.session.end();
        syncSession();
        toast("Sesión cerrada", "info");
        document.dispatchEvent(new CustomEvent("hz:session-changed"));
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenus();
    });

    /* Si la imagen de una bandera no carga, se usa la copia local (una sola vez) */
    document.addEventListener(
      "error",
      (event) => {
        const img = event.target;
        if (img.tagName === "IMG" && img.dataset.fallback) {
          const fallback = img.dataset.fallback;
          img.removeAttribute("data-fallback");
          img.src = fallback;
        }
      },
      true
    );
  }

  function init() {
    initNav();
    initGlobalEvents();
    syncSession();
    syncCounts();
  }

  HZ.ui = {
    init, toast, confirmDialog, initTabs, syncSession, syncCounts, closeMenus,
    coverFor, flagImg, favButton, updateFavButtons, countryCard, countryRow, favRow, tripCard, tripStatus,
    skeletons, banner, setFieldState, register, detailUrl, tripDetailsUrl,
  };

  init();
})();

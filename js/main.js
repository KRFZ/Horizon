/* ==========================================================================
   HORIZON · main.js
   Interacciones SIMULADAS para la segunda entrega (maqueta HTML/CSS).
   Aquí todavía no hay APIs ni localStorage: los botones solo muestran
   la respuesta visual que tendrán en la versión final.
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const icon = (name, cls = "") => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* ---------- Toasts ---------- */
  let toastRegion = $("#toast-region");
  if (!toastRegion) {
    toastRegion = document.createElement("div");
    toastRegion.id = "toast-region";
    toastRegion.className = "toast-region";
    toastRegion.setAttribute("role", "status");
    toastRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(toastRegion);
  }

  function showToast(message, iconName = "check-circle") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `${icon(iconName)}<span></span>`;
    $("span", toast).textContent = message;
    toastRegion.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("toast--out");
      setTimeout(() => toast.remove(), 320);
    }, 3200);
  }

  /* Cualquier botón con data-toast muestra un aviso simulado */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toast]");
    if (!btn) return;
    e.preventDefault();
    showToast(btn.dataset.toast, btn.dataset.toastIcon || "check-circle");
  });

  /* ---------- Menú móvil ---------- */
  const navToggle = $(".navbar__toggle");
  const navMenu = $("#nav-menu");
  const mobileMq = window.matchMedia("(max-width: 900px)");

  function syncNav() {
    if (!navMenu || !navToggle) return;
    if (mobileMq.matches) {
      navMenu.hidden = navToggle.getAttribute("aria-expanded") !== "true";
    } else {
      navMenu.hidden = false;
      navToggle.setAttribute("aria-expanded", "false");
    }
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const open = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!open));
      navMenu.hidden = open;
    });
    mobileMq.addEventListener("change", syncNav);
    syncNav();
  }

  /* ---------- Menús desplegables ---------- */
  function closeMenus(except) {
    $$("[data-menu-toggle][aria-expanded='true']").forEach((btn) => {
      if (btn === except) return;
      btn.setAttribute("aria-expanded", "false");
      const menu = document.getElementById(btn.getAttribute("aria-controls"));
      if (menu) menu.hidden = true;
    });
  }

  document.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-menu-toggle]");
    if (toggle) {
      const menu = document.getElementById(toggle.getAttribute("aria-controls"));
      const open = toggle.getAttribute("aria-expanded") === "true";
      closeMenus(toggle);
      toggle.setAttribute("aria-expanded", String(!open));
      if (menu) menu.hidden = open;
      return;
    }
    if (!e.target.closest(".menu")) closeMenus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenus();
  });

  /* ---------- Favoritos (corazón) ---------- */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".fav-btn:not([data-remove-fav])");
    if (!btn) return;
    const pressed = btn.getAttribute("aria-pressed") === "true";
    btn.setAttribute("aria-pressed", String(!pressed));
    const name = btn.dataset.name || "El destino";
    const label = $(".fav-btn__text", btn);
    if (label) label.textContent = pressed ? btn.dataset.textOff || "Agregar a favoritos" : btn.dataset.textOn || "En favoritos";
    btn.setAttribute("aria-label", pressed ? `Agregar ${name} a favoritos` : `Quitar ${name} de favoritos`);
    showToast(pressed ? `${name} se quitó de tus favoritos` : `${name} se agregó a tus favoritos`, pressed ? "info" : "heart");
  });

  /* ---------- Guardar lugares de interés ---------- */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-save-place]");
    if (!btn) return;
    const pressed = btn.getAttribute("aria-pressed") === "true";
    btn.setAttribute("aria-pressed", String(!pressed));
    $("span", btn).textContent = pressed ? "Guardar lugar" : "Lugar guardado";
    showToast(pressed ? "Lugar quitado de tu lista" : `${btn.dataset.savePlace} se guardó en tu lista`, pressed ? "info" : "bookmark");
  });

  /* ---------- Pestañas ---------- */
  $$("[role='tablist']").forEach((list) => {
    const tabs = $$("[role='tab']", list);

    function select(tab, focus) {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (e) => {
        let next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") next = tabs[0];
        if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) {
          e.preventDefault();
          select(next, true);
        }
      });
    });

    /* Abrir pestaña indicada en la URL (#clima, #pronostico…) */
    const fromHash = tabs.find((t) => "#" + t.getAttribute("aria-controls").replace("panel-", "") === location.hash);
    if (fromHash) select(fromHash);
  });

  /* Enlaces internos a pestañas: data-go-tab="tab-clima" */
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-go-tab]");
    if (!link) return;
    const tab = document.getElementById(link.dataset.goTab);
    if (tab) {
      tab.click();
      tab.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  /* ---------- Modales de confirmación ---------- */
  let pendingRemoval = null;

  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open-modal]");
    if (opener) {
      const dlg = document.getElementById(opener.dataset.openModal);
      if (!dlg) return;
      closeMenus();
      const row = opener.closest("[data-removable]");
      pendingRemoval = row || null;
      const target = $("[data-modal-target]", dlg);
      if (target && row) target.textContent = row.dataset.removable;
      dlg.showModal();
      return;
    }
    const closer = e.target.closest("[data-close-modal]");
    if (closer) {
      closer.closest("dialog").close();
      return;
    }
    if (e.target.matches("dialog.modal")) e.target.close();
  });

  document.addEventListener("click", (e) => {
    const confirmBtn = e.target.closest("[data-confirm-remove]");
    if (!confirmBtn || !pendingRemoval) return;
    const row = pendingRemoval;
    const name = row.dataset.removable;
    confirmBtn.closest("dialog").close();
    row.classList.add("is-removing");
    setTimeout(() => {
      const list = row.parentElement;
      row.remove();
      updateCounters(list);
      showToast(`${name} se eliminó (simulado)`, "trash");
    }, 350);
    pendingRemoval = null;
  });

  function updateCounters(list) {
    const remaining = list ? list.children.length : 0;
    const counter = $("[data-counter]");
    if (counter) counter.textContent = remaining;
    const footer = $("[data-footer-count]");
    if (footer) footer.textContent = remaining === 0 ? "0 de 0" : `1 - ${remaining} de ${remaining}`;
    const empty = $("[data-empty-state]");
    if (empty) {
      empty.hidden = remaining !== 0;
      const footerBar = $(".list-footer");
      if (footerBar) footerBar.hidden = remaining === 0;
    }
  }

  /* ---------- Inicio de sesión (simulado) ---------- */
  const loginForm = $("#login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#login-email", loginForm);
      const pass = $("#login-pass", loginForm);
      let ok = true;
      setFieldState(email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()), "Escribe un correo válido, por ejemplo nombre@correo.com");
      setFieldState(pass, pass.value.length >= 6, "La contraseña debe tener al menos 6 caracteres");
      ok = !$(".is-invalid", loginForm);
      if (ok) {
        showToast("Sesión iniciada (simulada). Te llevamos a explorar…");
        setTimeout(() => (location.href = "explorar.html"), 1100);
      } else {
        $(".is-invalid .input", loginForm).focus();
      }
    });
  }

  /* ---------- Utilidades de validación ---------- */
  function setFieldState(input, valid, message) {
    const field = input.closest(".field");
    if (!field) return valid;
    field.classList.toggle("is-invalid", !valid);
    field.classList.toggle("is-valid", valid && input.value.trim() !== "");
    input.setAttribute("aria-invalid", String(!valid));
    const err = $(".field__error", field);
    if (err && message) $("span", err).textContent = message;
    return valid;
  }

  /* ---------- Filtros de destinos ---------- */
  const resultsList = $("#results-list");
  if (resultsList) {
    const rows = $$(".dest-row", resultsList);
    const qInput = $("#f-q");
    const regionSel = $("#f-region");
    const langSel = $("#f-lang");
    const sortSel = $("#f-sort");
    const countEl = $("#result-count");
    const empty = $("#results-empty");
    const loadMore = $("#load-more");

    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const params = new URLSearchParams(location.search);
    if (params.get("q")) qInput.value = params.get("q");
    if (params.get("region")) regionSel.value = params.get("region");

    function apply() {
      const q = norm(qInput.value.trim());
      const region = regionSel.value;
      const lang = langSel.value;
      let visible = 0;

      rows.forEach((row) => {
        const haystack = norm(`${row.dataset.name} ${row.dataset.capital}`);
        const match =
          (!q || haystack.includes(q)) &&
          (!region || row.dataset.region === region) &&
          (!lang || row.dataset.langs.split(",").includes(lang));
        row.hidden = !match;
        if (match) visible++;
      });

      const sorted = rows.slice().sort((a, b) => {
        if (sortSel.value === "pop-desc") return b.dataset.pop - a.dataset.pop;
        if (sortSel.value === "pop-asc") return a.dataset.pop - b.dataset.pop;
        return a.dataset.name.localeCompare(b.dataset.name, "es");
      });
      sorted.forEach((row) => resultsList.appendChild(row));

      countEl.textContent = visible;
      empty.hidden = visible !== 0;
      if (loadMore) loadMore.hidden = visible === 0;
    }

    [qInput, regionSel, langSel, sortSel].forEach((el) => el.addEventListener("input", apply));
    $("#filters-form").addEventListener("submit", (e) => {
      e.preventDefault();
      apply();
    });
    $$("[data-clear-filters]").forEach((b) =>
      b.addEventListener("click", () => {
        qInput.value = "";
        regionSel.value = "";
        langSel.value = "";
        sortSel.value = "name";
        apply();
        qInput.focus();
      })
    );
    apply();
  }

  /* ---------- Formulario: crear un viaje ---------- */
  const tripForm = $("#trip-form");
  if (tripForm) {
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
    const today = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    f.start.min = iso(today);
    f.end.min = iso(today);

    const rules = {
      name: () => {
        const v = f.name.value.trim();
        if (!v) return [false, "Escribe un nombre para tu viaje"];
        if (v.length < 3) return [false, "El nombre debe tener al menos 3 caracteres"];
        if (v.length > 60) return [false, "El nombre no puede superar los 60 caracteres"];
        return [true];
      },
      dest: () => {
        const v = f.dest.value.trim();
        if (!v) return [false, "Indica a dónde quieres ir"];
        if (v.length < 2) return [false, "Escribe al menos 2 letras del destino"];
        return [true];
      },
      start: () => {
        if (!f.start.value) return [false, "Selecciona la fecha de salida"];
        if (f.start.value < iso(today)) return [false, "La fecha de salida no puede ser anterior a hoy"];
        return [true];
      },
      end: () => {
        if (!f.end.value) return [false, "Selecciona la fecha de regreso"];
        if (f.start.value && f.end.value < f.start.value) return [false, "La fecha de regreso debe ser igual o posterior a la de salida"];
        return [true];
      },
      people: () => (f.people.value ? [true] : [false, "Selecciona el número de viajeros"]),
      type: () => (f.type.value ? [true] : [false, "Selecciona un tipo de viaje"]),
      budget: () => {
        if (f.budget.value === "") return [true];
        const n = Number(f.budget.value);
        if (Number.isNaN(n) || n < 0) return [false, "El presupuesto debe ser un número mayor o igual a 0"];
        if (n > 1000000000) return [false, "Escribe un presupuesto más realista"];
        return [true];
      },
      notes: () => (f.notes.value.length <= 300 ? [true] : [false, "Las notas no pueden superar los 300 caracteres"]),
    };

    function check(key) {
      const [ok, msg] = rules[key]();
      setFieldState(f[key], ok, msg);
      return ok;
    }

    Object.keys(f).forEach((key) => {
      const ev = f[key].tagName === "SELECT" || f[key].type === "date" ? "change" : "input";
      f[key].addEventListener("blur", () => f[key].value !== "" && check(key));
      f[key].addEventListener(ev, () => {
        if (f[key].closest(".field").classList.contains("is-invalid") || f[key].value !== "") check(key);
        if (key === "start" && f.end.value) check("end");
      });
    });

    const counter = $("#notes-counter");
    f.notes.addEventListener("input", () => (counter.textContent = `${f.notes.value.length} / 300`));

    tripForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const results = Object.keys(f).map((k) => [k, check(k)]);
      const invalid = results.filter(([, ok]) => !ok);
      alertBox.classList.toggle("is-visible", invalid.length > 0);
      if (invalid.length) {
        $("#form-alert-text").textContent =
          invalid.length === 1 ? "Hay 1 campo que debes corregir antes de continuar." : `Hay ${invalid.length} campos que debes corregir antes de continuar.`;
        f[invalid[0][0]].focus();
        return;
      }
      $("#trip-success-name").textContent = f.name.value.trim();
      $("#trip-success").showModal();
    });

    $("[data-reset-trip]")?.addEventListener("click", () => {
      tripForm.reset();
      $$(".field", tripForm).forEach((fl) => fl.classList.remove("is-valid", "is-invalid"));
      counter.textContent = "0 / 300";
      alertBox.classList.remove("is-visible");
      $("#trip-success").close();
      f.name.focus();
    });
  }

  /* ---------- Itinerario: actividades y días ---------- */
  function addActivity(list, time, title, note) {
    const li = document.createElement("li");
    li.className = "activity";
    li.innerHTML = `
      <span class="activity__time"></span>
      <div><p class="activity__title"></p><p class="activity__note"></p></div>
      <button class="icon-btn" type="button" data-remove-activity aria-label="Eliminar actividad">${icon("trash")}</button>`;
    $(".activity__time", li).textContent = time || "Sin hora";
    $(".activity__title", li).textContent = title;
    $(".activity__note", li).textContent = note || "Actividad agregada por ti";
    list.appendChild(li);
  }

  document.addEventListener("submit", (e) => {
    const form = e.target.closest(".add-activity");
    if (!form) return;
    e.preventDefault();
    const text = $("input[type='text']", form);
    const time = $("input[type='time']", form);
    if (!text.value.trim()) {
      text.focus();
      showToast("Escribe el nombre de la actividad", "alert");
      return;
    }
    addActivity($(".activity-list", form.closest(".day")), time.value, text.value.trim());
    text.value = "";
    time.value = "";
    showToast("Actividad agregada al día (simulado)");
  });

  document.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove-activity]");
    if (rm) {
      rm.closest(".activity").remove();
      showToast("Actividad eliminada", "trash");
      return;
    }
    const suggest = e.target.closest("[data-suggest]");
    if (suggest) {
      const list = $(".day .activity-list");
      if (list) {
        addActivity(list, "", suggest.dataset.suggest, "Sugerido desde tus favoritos");
        suggest.disabled = true;
        suggest.textContent = "Agregado";
        showToast(`${suggest.dataset.suggest} se agregó al Día 1`);
      }
      return;
    }
    if (e.target.closest("[data-add-day]")) {
      const days = $$(".day");
      const n = days.length + 1;
      const section = document.createElement("article");
      section.className = "day";
      section.setAttribute("aria-labelledby", `day-${n}-title`);
      section.innerHTML = `
        <header class="day__head"><span class="day__badge">${n}</span>
          <div><h3 id="day-${n}-title">Día ${n}</h3><p>Aún sin actividades. ¡Agrega la primera!</p></div></header>
        <ul class="activity-list" aria-label="Actividades del día ${n}"></ul>
        <form class="add-activity" novalidate>
          <label class="sr-only" for="time-${n}">Hora</label>
          <input class="input" id="time-${n}" type="time">
          <label class="sr-only" for="act-${n}">Actividad</label>
          <input class="input" id="act-${n}" type="text" placeholder="¿Qué quieres hacer este día?" maxlength="80">
          <button class="btn btn--outline" type="submit">${icon("plus")}Agregar</button>
        </form>`;
      days[days.length - 1].after(section);
      showToast(`Día ${n} agregado al itinerario`);
    }
  });

  /* ---------- Cargar más (simulado) ---------- */
  $$("[data-load-more]").forEach((b) => b.addEventListener("click", () => showToast("Simulación: aquí se cargarían más destinos desde la API", "info")));
})();

/* ==========================================================================
   HORIZON · pages/destinos.js
   Explorador de destinos: carga los países desde REST Countries, y permite
   buscar, filtrar por región e idioma, ordenar y cargar más resultados.
   ========================================================================== */

(function () {
  "use strict";

  const { $, $$, norm, debounce, esc } = HZ.utils;
  const { skeletons, banner, countryRow } = HZ.ui;
  const PAGE_SIZE = HZ.config.pageSize;

  const list = $("#results-list");
  const status = $("#results-status");
  const empty = $("#results-empty");
  const countEl = $("#result-count");
  const loadMore = $("#load-more");
  const qInput = $("#f-q");
  const regionSel = $("#f-region");
  const langSel = $("#f-lang");
  const sortSel = $("#f-sort");

  let all = []; // todos los países
  let filtered = []; // los que cumplen los filtros
  let shown = PAGE_SIZE; // cuántos se están mostrando

  /* ---------- Carga inicial ---------- */
  async function load() {
    status.innerHTML = "";
    empty.hidden = true;
    loadMore.hidden = true;
    list.innerHTML = skeletons(5, "row");
    try {
      const { countries, source } = await HZ.api.getCountries();
      all = countries;
      fillFilterOptions();
      readUrlParams();
      if (source === "respaldo") {
        status.innerHTML = banner("No pudimos conectar con REST Countries. Mostramos una lista de respaldo con algunos destinos.", { type: "info" });
      }
      apply();
    } catch (error) {
      list.innerHTML = "";
      countEl.textContent = "0";
      status.innerHTML = banner("No pudimos cargar los destinos. Revisa tu conexión e inténtalo de nuevo.", { retry: true });
    }
  }

  /* Las regiones y los idiomas del filtro salen de los datos reales */
  function fillFilterOptions() {
    const regions = [...new Set(all.map((c) => c.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    const langs = [...new Set(all.flatMap((c) => c.languages))].sort((a, b) => a.localeCompare(b, "es"));
    regionSel.innerHTML = `<option value="">Todas</option>` + regions.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
    langSel.innerHTML = `<option value="">Todos</option>` + langs.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
  }

  /* Lee ?q=Japón&region=Europa de la URL (así funciona el buscador del inicio) */
  function readUrlParams() {
    const params = new URLSearchParams(location.search);
    if (params.get("q")) qInput.value = params.get("q");
    const region = params.get("region");
    if (region && [...regionSel.options].some((o) => o.value === region)) regionSel.value = region;
  }

  /* ---------- Filtrar y ordenar ---------- */
  function apply() {
    const q = norm(qInput.value);
    filtered = all.filter((c) => {
      const text = norm(`${c.name} ${c.nameEn} ${c.capital} ${c.capitalEn}`);
      return (!q || text.includes(q)) && (!regionSel.value || c.region === regionSel.value) && (!langSel.value || c.languages.includes(langSel.value));
    });

    filtered.sort((a, b) => {
      if (sortSel.value === "pop-desc") return b.population - a.population;
      if (sortSel.value === "pop-asc") return a.population - b.population;
      return a.name.localeCompare(b.name, "es");
    });

    shown = PAGE_SIZE;
    render();
  }

  function render() {
    list.innerHTML = filtered.slice(0, shown).map(countryRow).join("");
    countEl.textContent = filtered.length;
    empty.hidden = filtered.length !== 0;
    loadMore.hidden = shown >= filtered.length;
    const remaining = filtered.length - shown;
    if (remaining > 0) $("[data-load-more]").textContent = `Cargar más destinos (${remaining} restantes)`;
  }

  /* ---------- Eventos ---------- */
  const applyDebounced = debounce(apply, 200); // espera a que el usuario termine de escribir
  qInput.addEventListener("input", applyDebounced);
  [regionSel, langSel, sortSel].forEach((el) => el.addEventListener("change", apply));
  $("#filters-form").addEventListener("submit", (event) => {
    event.preventDefault();
    apply();
  });

  $$("[data-clear-filters]").forEach((button) =>
    button.addEventListener("click", () => {
      qInput.value = "";
      regionSel.value = "";
      langSel.value = "";
      sortSel.value = "name";
      apply();
      qInput.focus();
    })
  );

  $("[data-load-more]").addEventListener("click", () => {
    shown += PAGE_SIZE;
    render();
  });

  status.addEventListener("click", (event) => {
    if (event.target.closest("[data-retry]")) load();
  });

  load();
})();

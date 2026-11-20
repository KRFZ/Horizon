/* ==========================================================================
   HORIZON · pages/favoritos.js
   Lista de favoritos guardados en localStorage: ver, eliminar y paginar.
   ========================================================================== */

(function () {
  "use strict";

  const { $, icon } = HZ.utils;
  const { favRow, toast, confirmDialog } = HZ.ui;
  const PAGE_SIZE = HZ.config.favoritesPageSize;

  const list = $("#fav-list");
  const empty = $("#fav-empty");
  const footer = $("#fav-footer");
  const range = $("#fav-range");
  const pager = $("#fav-pager");
  let page = 1;

  function render() {
    const favorites = HZ.storage.favorites.all();
    const pages = Math.max(1, Math.ceil(favorites.length / PAGE_SIZE));
    page = Math.min(page, pages);

    const start = (page - 1) * PAGE_SIZE;
    const visible = favorites.slice(start, start + PAGE_SIZE);
    list.innerHTML = visible.map(favRow).join("");

    empty.hidden = favorites.length !== 0;
    footer.hidden = favorites.length === 0;
    range.textContent = favorites.length ? `${start + 1} - ${start + visible.length} de ${favorites.length}` : "";

    /* Paginación */
    let buttons = `<button class="pagination__item" type="button" data-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Página anterior">${icon("chevron-left")}</button>`;
    for (let n = 1; n <= pages; n++) {
      buttons += `<button class="pagination__item" type="button" data-page="${n}" ${n === page ? 'aria-current="page"' : ""}>${n}</button>`;
    }
    buttons += `<button class="pagination__item" type="button" data-page="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="Página siguiente">${icon("chevron-right")}</button>`;
    pager.innerHTML = buttons;
  }

  /* Quitar un favorito (con confirmación) */
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-fav-remove]");
    if (!button) return;
    const { code, name } = button.dataset;
    const ok = await confirmDialog({
      title: `¿Quitar ${name} de favoritos?`,
      text: "Se eliminará de tu lista. Podrás volver a guardarlo cuando quieras desde Explorar destinos.",
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    const row = button.closest(".fav-row");
    row.classList.add("is-removing");
    setTimeout(() => {
      HZ.storage.favorites.remove(code);
      render();
      toast(`${name} se quitó de tus favoritos`, "trash");
    }, 350);
  });

  pager.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    page = Number(button.dataset.page);
    render();
  });

  render();
})();

/* ==========================================================================
   HORIZON · pages/mis-viajes.js
   Lista de viajes guardados en localStorage: ver y eliminar.
   ========================================================================== */

(function () {
  "use strict";

  const { $ } = HZ.utils;
  const { tripCard, toast, confirmDialog } = HZ.ui;

  const grid = $("#trip-grid");
  const empty = $("#trips-empty");
  const summary = $("#trips-summary");

  function render() {
    const trips = HZ.storage.trips.all();
    grid.innerHTML = trips.map(tripCard).join("");
    empty.hidden = trips.length !== 0;
    summary.textContent = trips.length
      ? `${trips.length} ${trips.length === 1 ? "viaje guardado" : "viajes guardados"}`
      : "Aún no has creado ningún viaje.";
  }

  /* Eliminar un viaje (con confirmación) */
  grid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-trip-delete]");
    if (!button) return;
    const trip = HZ.storage.trips.get(button.dataset.id);
    if (!trip) return;
    HZ.ui.closeMenus();
    const ok = await confirmDialog({
      title: `¿Eliminar "${trip.name}"?`,
      text: "Se borrarán sus fechas y actividades. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar viaje",
    });
    if (!ok) return;
    const card = button.closest(".trip-card");
    card.classList.add("is-removing");
    setTimeout(() => {
      HZ.storage.trips.remove(trip.id);
      render();
      toast("Viaje eliminado", "trash");
    }, 300);
  });

  render();
})();

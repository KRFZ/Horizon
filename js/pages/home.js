/* ==========================================================================
   HORIZON · pages/home.js
   Página de inicio: destinos destacados (REST Countries) e inicio de sesión
   simulado que se guarda en sessionStorage.
   ========================================================================== */

(function () {
  "use strict";

  const { $, capitalize } = HZ.utils;
  const { toast, skeletons, banner, setFieldState, countryCard } = HZ.ui;

  /* ---------- Destinos destacados ---------- */
  const grid = $("#featured-grid");

  async function loadFeatured() {
    grid.innerHTML = skeletons(4);
    try {
      const { countries } = await HZ.api.getCountries();
      const picks = HZ.config.featured.map((code) => countries.find((c) => c.code === code)).filter(Boolean);
      if (!picks.length) throw new Error("No se encontraron los destinos destacados");
      grid.innerHTML = picks.map(countryCard).join("");
    } catch (error) {
      grid.innerHTML = banner("No pudimos cargar los destinos destacados. Revisa tu conexión e inténtalo de nuevo.", { retry: true });
    }
  }

  grid.addEventListener("click", (event) => {
    if (event.target.closest("[data-retry]")) loadFeatured();
  });
  loadFeatured();

  /* ---------- Inicio de sesión (sessionStorage) ---------- */
  const form = $("#login-form");
  const panelLogin = $("#login-panel");
  const panelWelcome = $("#login-welcome");

  function showSessionState() {
    const current = HZ.storage.session.get();
    panelLogin.hidden = Boolean(current);
    panelWelcome.hidden = !current;
    if (current) $("#welcome-name").textContent = current.name;
  }

  /* "nombre.apellido@correo.com" -> "Nombre" */
  const nameFromEmail = (email) => capitalize(email.split("@")[0].split(/[._-]+/)[0]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("#login-email");
    const pass = $("#login-pass");
    setFieldState(email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()), "Escribe un correo válido, por ejemplo nombre@correo.com");
    setFieldState(pass, pass.value.length >= 6, "La contraseña debe tener al menos 6 caracteres");
    if ($(".is-invalid", form)) {
      $(".is-invalid .input", form).focus();
      return;
    }
    HZ.storage.session.start({ name: nameFromEmail(email.value.trim()), email: email.value.trim(), guest: false });
    HZ.ui.syncSession();
    toast("Sesión iniciada. Te llevamos a explorar…");
    setTimeout(() => (location.href = "explorar.html"), 900);
  });

  /* Entrar como invitado: guarda una sesión sin datos y sigue al enlace */
  $("#guest-btn").addEventListener("click", () => {
    HZ.storage.session.start({ name: "Invitado", email: "", guest: true });
  });

  document.addEventListener("hz:session-changed", showSessionState);
  showSessionState();
})();

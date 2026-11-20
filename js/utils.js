/* ==========================================================================
   HORIZON · utils.js
   Funciones pequeñas y reutilizables: selección de elementos, texto seguro,
   formatos de números y fechas.
   ========================================================================== */

(function () {
  "use strict";

  /* Atajos para seleccionar elementos del DOM */
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  /* Escapa caracteres especiales para insertar texto en HTML sin riesgos (evita inyección de código) */
  function esc(value) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value ?? "").replace(/[&<>"']/g, (ch) => map[ch]);
  }

  /* Pasa a minúsculas y quita tildes: "Japón" -> "japon". Sirve para buscar sin importar acentos */
  function norm(text) {
    return String(text ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

  /* Ícono del sprite SVG que está al inicio de cada página */
  const icon = (name, extraClass = "") =>
    `<svg class="icon ${extraClass}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

  /* 47400000 -> "47,4 M" | 850000 -> "850.000" */
  function formatPopulation(n) {
    if (!n) return "—";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " M";
    return n.toLocaleString("es");
  }

  const formatNumber = (n) => Number(n || 0).toLocaleString("es");

  /* ---------- Fechas ---------- */
  /* Se trabaja con textos "AAAA-MM-DD" para evitar problemas de zona horaria */
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const todayISO = () => toISO(new Date());

  function parseISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(iso, amount) {
    const date = parseISO(iso);
    date.setDate(date.getDate() + amount);
    return toISO(date);
  }

  const daysBetween = (from, to) => Math.round((parseISO(to) - parseISO(from)) / 86400000);

  function formatDate(iso, options) {
    return new Intl.DateTimeFormat("es", options || { day: "numeric", month: "short", year: "numeric" }).format(parseISO(iso));
  }

  /* ---------- Otros ---------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* Espera a que el usuario deje de escribir antes de ejecutar la función */
  function debounce(fn, wait = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  HZ.utils = {
    $, $$, esc, norm, capitalize, icon, formatPopulation, formatNumber,
    toISO, todayISO, parseISO, addDays, daysBetween, formatDate, uid, debounce, sleep,
  };
})();

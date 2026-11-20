/* ==========================================================================
   HORIZON · config.js
   Configuración global. Todos los demás archivos leen estos valores desde
   el objeto HZ.config, así que si cambia una URL o una clave se modifica
   en un solo lugar.
   ========================================================================== */

window.HZ = window.HZ || {};

(function () {
  "use strict";

  const HORA = 60 * 60 * 1000;
  const DIA = 24 * HORA;

  HZ.config = {
    /* APIs públicas y gratuitas (no requieren clave) */
    apis: {
      countries: "https://api.restcountries.com/countries/v5", // REST Countries v5: información de países
      geocoding: "https://nominatim.openstreetmap.org/search", // OpenStreetMap Nominatim: nombre de ciudad -> coordenadas
      weather: "https://api.open-meteo.com/v1/forecast", // Open-Meteo: clima actual y pronóstico
      osmEmbed: "https://www.openstreetmap.org/export/embed.html", // Mapa incrustado
      osmView: "https://www.openstreetmap.org/",
    },


    countriesApiKey: "rc_live_bc1b18d2b30741f482ef0d640fd746db",

    /* Campos utilizados por HORIZON en el esquema de REST Countries v5. */
    countriesResponseFields: [
      "names.common", "names.official", "names.translations", "codes.alpha_2",
      "capitals", "region", "subregion", "population", "area.kilometers",
      "languages", "currencies", "flag.url_svg", "flag.url_png",
      "coordinates.lat", "coordinates.lng", "timezones", "tlds", "calling_codes"
    ].join(","),

    /* Claves con las que se guarda la información en el navegador */
    keys: {
      favorites: "horizon.favoritos",
      trips: "horizon.viajes",
      places: "horizon.lugares",
      session: "horizon.sesion",
      cache: "horizon.cache.",
    },

    /* Tiempo que se conservan en caché las respuestas de cada API */
    cacheTtl: {
      countries: DIA,
      country: DIA,
      geocode: 30 * DIA,
      weather: 15 * 60 * 1000,
    },

    pageSize: 12, // destinos que se muestran por tanda en la lista
    favoritesPageSize: 6,
    maxTripDays: 60,

    /* Destinos destacados del inicio (códigos ISO de 2 letras) */
    featured: ["JP", "IT", "CO", "CA"],

    /* Países que tienen ilustración propia; el resto usa la de su región */
    localCovers: ["es", "jp", "it", "co", "ca", "fr", "mx", "br", "ar", "pe", "pt", "de", "cl", "th", "ma"],
    regionCover: { Europe: "fr", Americas: "ar", Asia: "th", Africa: "ma", Oceania: "pt", Antarctic: "ca" },

    /* Traducciones de la región que devuelve la API */
    regionNames: {
      Africa: "África",
      Americas: "Américas",
      Asia: "Asia",
      Europe: "Europa",
      Oceania: "Oceanía",
      Antarctic: "Antártida",
    },

    tripTypes: ["Vacaciones", "Aventura", "Cultural", "Familiar", "Romántico", "Naturaleza", "Gastronómico", "Negocios"],

    placeTypes: [
      { value: "Museo", icon: "museum", chip: "" },
      { value: "Parque", icon: "tree", chip: "chip--teal" },
      { value: "Monumento", icon: "landmark", chip: "chip--orange" },
      { value: "Restaurante", icon: "utensils", chip: "" },
      { value: "Playa", icon: "sun", chip: "chip--teal" },
      { value: "Otro", icon: "pin", chip: "chip--orange" },
    ],
  };
})();

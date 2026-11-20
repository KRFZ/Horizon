# Horizon: plataforma web para la exploración y planificación de viajes

Aplicación web **frontend** (HTML, CSS y JavaScript) para explorar países, consultar su clima,
guardar destinos favoritos y organizar un itinerario de viaje.
Proyecto académico de Electiva Disciplinar I · Corporación Universitaria Latinoamericana.

**Web publicada:** _(pega aquí el enlace de GitHub Pages)_

## APIs públicas utilizadas
| API | Para qué se usa |
|---|---|
| [REST Countries](https://restcountries.com) | Información de los países (nombre, capital, región, población, idiomas, moneda, bandera) |
| [Nominatim (OpenStreetMap)](https://nominatim.org) | Convierte el nombre de una ciudad en coordenadas |
| [Open-Meteo](https://open-meteo.com) | Clima actual y pronóstico de 5 días |

## Persistencia en el navegador
- `localStorage`: favoritos, viajes con su itinerario, lugares guardados y caché de las APIs.
- `sessionStorage`: sesión del usuario (demostración, sin servidor).

## Estructura
```
├── index.html, explorar.html, destinos.html, detalle.html, favoritos.html,
│   mis-viajes.html, crear-viaje.html, itinerario.html, acerca-de.html
├── css/   base · components · pages · responsive
├── js/
│   ├── config.js    URLs de las APIs y constantes
│   ├── utils.js     funciones de ayuda (texto, fechas, formatos)
│   ├── storage.js   localStorage / sessionStorage / caché
│   ├── api.js       conexión con las 3 APIs (fetch + async/await)
│   ├── ui.js        navbar, avisos, pestañas, plantillas de tarjetas
│   └── pages/       un script por pantalla
├── data/paises-respaldo.json   respaldo si REST Countries no responde
└── assets/          logo, mascota, banderas y portadas (SVG)
```

## Cómo ejecutarlo
Abre el sitio publicado, o en local con un servidor estático (por ejemplo la extensión
Live Server de VS Code). No requiere instalación ni claves de API.

## Integrantes
- Isaac Enrique Vargas Meriño
- Keiner Enrique Rosales Fernández

Docente: Edgar Morrillo Vergel

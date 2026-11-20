/* ==========================================================================
   HORIZON · storage.js
   Todo lo que se guarda en el navegador pasa por este archivo.
   - localStorage  -> favoritos, viajes, lugares y caché (permanece al cerrar el navegador)
   - sessionStorage -> sesión del usuario (se borra al cerrar la pestaña)
   Los datos se guardan como texto JSON, por eso se usa JSON.stringify / JSON.parse.
   ========================================================================== */

(function () {
  "use strict";

  const K = HZ.config.keys;

  /* Lee y convierte de JSON. Si algo falla (dato dañado, almacenamiento bloqueado) devuelve el valor por defecto */
  function read(store, key, fallback) {
    try {
      const raw = store.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("No se pudo leer", key, error);
      return fallback;
    }
  }

  function write(store, key, value) {
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("No se pudo guardar", key, error);
      return false;
    }
  }

  /* ---------- Favoritos ---------- */
  /* Se guarda una "foto" del país para poder mostrar la lista sin volver a consultar la API */
  const favorites = {
    all() {
      return read(localStorage, K.favorites, []);
    },
    has(code) {
      return this.all().some((item) => item.code === code);
    },
    add(country) {
      const list = this.all();
      if (list.some((item) => item.code === country.code)) return false; // evita duplicados
      list.unshift({
        code: country.code,
        name: country.name,
        capital: country.capital,
        region: country.region,
        regionEn: country.regionEn,
        flag: country.flag,
        flagAlt: country.flagAlt,
        addedAt: new Date().toISOString(),
      });
      return write(localStorage, K.favorites, list);
    },
    remove(code) {
      return write(localStorage, K.favorites, this.all().filter((item) => item.code !== code));
    },
    /* Si ya estaba lo quita; si no estaba lo agrega. Devuelve true cuando quedó guardado */
    toggle(country) {
      if (this.has(country.code)) {
        this.remove(country.code);
        return false;
      }
      this.add(country);
      return true;
    },
  };

  /* ---------- Viajes (con su itinerario) ---------- */
  const trips = {
    all() {
      return read(localStorage, K.trips, []);
    },
    get(id) {
      return this.all().find((trip) => trip.id === id) || null;
    },
    /* Si el viaje ya existe lo reemplaza; si no, lo agrega al inicio */
    save(trip) {
      const list = this.all();
      const index = list.findIndex((item) => item.id === trip.id);
      if (index >= 0) list[index] = trip;
      else list.unshift(trip);
      return write(localStorage, K.trips, list);
    },
    remove(id) {
      return write(localStorage, K.trips, this.all().filter((trip) => trip.id !== id));
    },
  };

  /* ---------- Lugares guardados por el usuario, agrupados por país ---------- */
  const places = {
    all() {
      return read(localStorage, K.places, {});
    },
    byCountry(code) {
      return this.all()[code] || [];
    },
    add(code, place) {
      const data = this.all();
      data[code] = [place, ...(data[code] || [])];
      return write(localStorage, K.places, data);
    },
    remove(code, id) {
      const data = this.all();
      data[code] = (data[code] || []).filter((place) => place.id !== id);
      return write(localStorage, K.places, data);
    },
  };

  /* ---------- Sesión (sessionStorage) ---------- */
  const session = {
    get() {
      return read(sessionStorage, K.session, null);
    },
    start(user) {
      return write(sessionStorage, K.session, { ...user, since: new Date().toISOString() });
    },
    end() {
      try {
        sessionStorage.removeItem(K.session);
      } catch (error) {
        /* sin acción */
      }
    },
  };

  /* ---------- Caché de respuestas de las APIs ---------- */
  /* Cada entrada guarda su fecha de vencimiento. Así se evita repetir peticiones y la app resiste mejor si una API va lenta */
  const cache = {
    get(name) {
      const entry = read(localStorage, K.cache + name, null);
      if (!entry) return null;
      if (entry.expires < Date.now()) {
        try {
          localStorage.removeItem(K.cache + name);
        } catch (error) {
          /* sin acción */
        }
        return null;
      }
      return entry.value;
    },
    set(name, value, ttl) {
      const entry = { expires: Date.now() + ttl, value };
      if (write(localStorage, K.cache + name, entry)) return true;
      this.clear(); // si no hay espacio, se limpia la caché y se reintenta una vez
      return write(localStorage, K.cache + name, entry);
    },
    clear() {
      try {
        Object.keys(localStorage)
          .filter((key) => key.startsWith(K.cache))
          .forEach((key) => localStorage.removeItem(key));
      } catch (error) {
        /* sin acción */
      }
    },
  };

  HZ.storage = { favorites, trips, places, session, cache };
})();

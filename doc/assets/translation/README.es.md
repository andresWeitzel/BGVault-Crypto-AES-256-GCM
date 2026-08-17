<div align="center">
  <img src="../home_readme.png" alt="Improve Product Statistics Bot — Monitor" width="680" />
</div>

<div align="right">
  <img width="26" height="26" src="../icons/backend/javascript-typescript/svg/nodejs-color.svg" alt="Node.js" />
  &nbsp;
  <img width="26" height="26" src="../icons/backend/javascript-typescript/svg/express-mark.svg" alt="Express" />
  &nbsp;
  <img width="26" height="26" src="../icons/devops/png/docker.png" alt="Docker" />
  &nbsp;
  <img width="26" height="26" src="../icons/devops/png/npm.png" alt="npm" />
  &nbsp;
  <img width="26" height="26" src="../icons/devops/png/git.png" alt="Git" />
  &nbsp;
  <img width="26" height="26" src="../icons/devops/svg/github-mark.svg" alt="GitHub" />
</div>

<br>

<div align="right">
  <a href="./README.es.md" target="_blank">
    <img src="./arg-flag.svg" width="48" height="36" alt="Español" />
  </a>
  &nbsp;
  <a href="../../../README.md" target="_blank">
    <img src="./eeuu-flag.png" width="48" height="36" alt="English" />
  </a>
</div>

<div align="center">

# Improve Product Statistics Bot ![(status-completed)](../icons/badges/status-completed.svg)

</div>

Este es un software de operación que **visita, mide, alerta y reporta**: un bot de automatización 24/7 que abre tus publicaciones una y otra vez para que las vistas y las estadísticas del producto mejoren. Armado con **Node.js**, **Puppeteer**, **Express** y **Socket.IO**, corre el ciclo headless, registra cada OK/fallo y te deja el control con **Monitor** en vivo, panel de **Acciones** (Gmail + WhatsApp / CallMeBot) y **Base de datos** en el puerto **9008**. Lo metés en **Docker** local y que labure mientras vos vendés.

**UI local:** [http://localhost:9008](http://localhost:9008/)

* [Video de pruebas funcionales](https://www.youtube.com/watch?v=Fk-FQI7kQJA&list=PLNYRp4eRA2Uk&index=2) <a href="https://www.youtube.com/watch?v=Fk-FQI7kQJA&list=PLNYRp4eRA2Uk&index=2" target="_blank"><img src="../icons/social-networks/yt.svg" width="20" alt="YouTube" /></a>

<br>

## Índice 📜

<details>
  <summary> Ver detalle </summary>

<br>

<div align="right">

`Última actualización: 13/08/26`

</div>

### Sección 1) Descripción, configuración y tecnologías

* [1.0) Descripción.](#10-descripción-)
* [1.1) Ejecución.](#11-ejecución-)
* [1.2) Estructura.](#12-estructura-)
* [1.3) Tecnologías.](#13-tecnologías-)

### Sección 2) Flujo de uso

* [2.0) Flujo de la app.](#20-flujo-de-la-app-)
* [2.1) Monitor.](#21-monitor-)
* [2.2) Acciones (Gmail y CallMeBot).](#22-acciones-gmail-y-callmebot-)
* [2.3) Base de datos.](#23-base-de-datos-)
* [2.4) Política de notificaciones.](#24-política-de-notificaciones-)

### Sección 3) Pruebas, Docker y referencias

* [3.0) Prueba funcional.](#30-prueba-funcional-)
* [3.1) Docker (recomendado en Windows).](#31-docker-recomendado-en-windows-)
* [3.2) Contribuir.](#32-contribuir-)
* [3.3) Licencia.](#33-licencia-)

</details>

<br>

## Sección 1) Descripción, configuración y tecnologías

### 1.0) Descripción [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

Es un **autoincrementador de visitas de Marketplace**: un bot de automatización pensado para empujar vistas y mantener en movimiento las estadísticas del producto mientras vos te dedicás a vender. No es un chatbot: es software de operación que visita, mide, alerta y reporta.

Para qué existe:

* En Marketplace, el posicionamiento y la prueba social premian publicaciones **activas**. Refrescar a mano no escala.
* Este bot convierte esa rutina en un **motor continuo de visitas**: abrir URL → permanecer en la página → registrar resultado → siguiente producto → repetir.
* Mirás todo desde un panel local y recibís **Gmail / WhatsApp** cuando algo falla o cuando cierra el día.

Qué entrega el producto:

* **Ciclo automático de visitas:** Puppeteer (+ stealth) abre cada listing configurado, se queda el tiempo suficiente y registra OK o fallo.
* **Multiplataforma:** Facebook Marketplace en vivo (`enabled: true`); MercadoLibre ya implementado y en espera (`enabled: false`) hasta que baje captcha / verificación.
* **Monitor en vivo (`/`):** totales, tasa de éxito, gráficos, filtros, historial, últimas fallas y desglose por producto — Socket.IO, sin spamear F5.
* **Panel Acciones (`/actions.html`):** estado de canales, secretos ocultos, tests de WhatsApp, simulacro de alerta, reporte diario (preview / Gmail / WA / ambos) e historial de envíos.
* **Base de datos (`/admin.html`):** meta de visitas y del log de acciones, con vaciado seguro solo del historial de visitas.
* **Notificaciones inteligentes:** digest ~**21:00 AR** (Gmail + WhatsApp); si hay fallo, WhatsApp al instante o **Gmail ya** cuando CallMeBot encola.
* **Config sin tocar código:** URLs en `facebook.urls.json` / `mercadolibre.urls.json`; secretos en `.env`.
* **Siempre encendido:** `npm run dev` para afinar, o **Docker Desktop** 24/7 en **9008** para operación local seria.

**Requisitos:** Node ≥ 18, Docker Desktop (recomendado), App Password de Gmail y/o CallMeBot, navegador moderno para la UI.

</details>

### 1.1) Ejecución [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

* Clonar el repo:

```bash
git clone https://github.com/andresWeitzel/improve-product-statistics-bot.git
cd improve-product-statistics-bot
cp .env.example .env
cp facebook.urls.example.json facebook.urls.json
cp mercadolibre.urls.example.json mercadolibre.urls.json
```

Las URLs van en los JSON locales (`facebook.urls.json` / `mercadolibre.urls.json`, gitignored). Los `*.urls.example.json` son solo placeholders.

#### Gmail (App Password)

Para el **reporte diario** y el **fallback de fallos** cuando CallMeBot encola.

1. Activá [verificación en 2 pasos](https://myaccount.google.com/security).
2. Creá una [contraseña de aplicación](https://myaccount.google.com/apppasswords) (Mail).
3. En `.env`:

```env
MAIL_ENABLED=true
MAIL_USER=tu-correo@gmail.com
MAIL_PASS=xxxx xxxx xxxx xxxx
MAIL_TO=tu-correo@gmail.com
MAIL_FROM=Improve Product Stats <tu-correo@gmail.com>
MAIL_FAIL_ENABLED=true
REPORT_HOUR=21
REPORT_PLATFORM=facebook
```

> `MAIL_PASS` es la App Password de 16 caracteres, no la contraseña normal de Gmail.

#### WhatsApp (API CallMeBot)

Para tests, alertas de fallo y el reporte diario por WhatsApp.

1. Activá el bot según: [CallMeBot — Free WhatsApp API](https://www.callmebot.com/blog/free-api-whatsapp-messages/).
2. Completá en `.env`:

```env
WHATSAPP_ENABLED=true
WHATSAPP_PHONE=54911xxxxxxxx
WHATSAPP_APIKEY=tu-apikey
WHATSAPP_REPORT_ENABLED=true
```

> Free ≈ **16 msgs / 240 min**. Si encola → fallback a Gmail en fallos.

Pruebas rápidas:

```bash
npm run whatsapp:test
npm run report:preview
```

#### Docker (recomendado en Windows, 24/7)

```text
1) Docker Desktop → Engine running
2) Start-Bot-Docker.bat
3) Día a día → Start/Stop del contenedor
```

`docker-compose` carga `.env` y monta los JSON de URLs + `data/`.

No uses `npm run dev` y Docker juntos en el puerto **9008**.

#### Desarrollo local (opcional)

```bash
npm install
npm run dev
```

Abrí [http://localhost:9008](http://localhost:9008/).

</details>

### 1.2) Estructura [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

Misma estructura que el README en inglés: `public/`, `src/platforms`, `src/notifications`, `src/db`, `scripts/`, `doc/assets/`, `Start-Bot-Docker.bat` / `.ps1` (raíz), `Dockerfile`, `docker-compose.yml`, `*.urls.example.json` (los `*.urls.json` reales van gitignored).

Persistencia en `data/` (gitignored): `visits.json`, `actions.json`, perfiles de browser.

</details>

### 1.3) Tecnologías [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

| **Tecnología** | **Versión** | **Propósito** |
| ------------- | ------------- | ------------- |
| [Node.js](https://nodejs.org/) | **≥ 18 / 20 (Docker)** | **Runtime** |
| [Express](https://expressjs.com/) | **4.x** | **API HTTP + UI estática** |
| [Socket.IO](https://socket.io/) | **4.x** | **Monitor en vivo** |
| [Puppeteer](https://pptr.dev/) + stealth | **21.x** | **Visitas headless** |
| [Nodemailer](https://nodemailer.com/) | **9.x** | **Gmail (App Password)** |
| [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) | **API** | **Alertas WhatsApp** |
| [Docker](https://www.docker.com/) | **Desktop** | **Contenedor local 24/7** |
| HTML/CSS/JS vanilla | **ES modules** | **Monitor / Acciones / Admin** |

</details>

<br>

## Sección 2) Flujo de uso

### 2.0) Flujo de la app [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

Arranque → carga DB → agenda reporte → bots activos visitan → UI Monitor / Acciones / Admin.

</details>

### 2.1) Monitor [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

<p align="center">
  <img src="../monitor_readme.png" alt="Monitor" width="720" />
</p>

Métricas, gráficos, filtros e historial. Vaciar visitas solo desde **Base de datos**.

</details>

### 2.2) Acciones (Gmail y CallMeBot) [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

<p align="center">
  <img src="../actions_readme.png" alt="Acciones" width="720" />
</p>

* Destino/número ocultos con **Mostrar / Ocultar**.
* Test WA, alerta de fallo, reporte (vista previa / Gmail / WA / ambos).
* Historial en `data/actions.json` con filtros.
* Cupo CallMeBot free ≈ 16 msgs / 240 min; si encola → fallback Gmail.

<p align="center">
  <img src="../whatsapp_report_readme.png" alt="Reporte WhatsApp" width="420" />
</p>

</details>

### 2.3) Base de datos [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

<p align="center">
  <img src="../admin_readme.png" alt="Base de datos" width="720" />
</p>

| Archivo | Contenido |
|---------|-----------|
| `data/visits.json` | Visitas |
| `data/actions.json` | Envíos / tests / reportes |

Vaciar visitas **no** borra el log de acciones.

</details>

### 2.4) Política de notificaciones [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

| Evento | Canal |
|--------|-------|
| Reporte diario 21:00 AR | Gmail + WhatsApp |
| Fallo de visita | WA si inmediato; si no, Gmail |
| `whatsapp:test` | Solo conectividad |

Variables clave: ver `.env.example` (`MAIL_*`, `WHATSAPP_*`, `REPORT_HOUR`).

</details>

<br>

## Sección 3) Pruebas, Docker y referencias

### 3.0) Prueba funcional [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

#### 3.0.1) Video del funcionamiento

Cómo trabaja el bot (Monitor, Acciones, Base de datos, visitas y notificaciones):

<p align="center">
  <a href="https://www.youtube.com/watch?v=Fk-FQI7kQJA&list=PLNYRp4eRA2Uk&index=2" target="_blank">
    <img src="https://img.youtube.com/vi/Fk-FQI7kQJA/maxresdefault.jpg" alt="Improve Product Statistics Bot — funcionamiento" width="720" />
  </a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=Fk-FQI7kQJA&list=PLNYRp4eRA2Uk&index=2">Ver en YouTube</a>
</p>

#### 3.0.2) Checklist

1. UI en `:9008` conectada.
2. `npm run whatsapp:test`
3. `npm run whatsapp:fail:preview` / `whatsapp:fail`
4. `npm run report:preview` / `report:send:gmail`

</details>

### 3.1) Docker (recomendado en Windows) [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

```text
1) Docker Desktop → Engine running
2) Start-Bot-Docker.bat
3) Start/Stop desde Docker Desktop
```

| Flag | Efecto |
|------|--------|
| (ninguno) | Build + `up -d` |
| `-SkipStart` | Solo build |
| `-Clean` | `compose down` antes |

Puerto `9008`, volumen `./data`, Chromium en `/usr/bin/chromium`.

</details>

### 3.2) Contribuir [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

Fork → branch → commit → PR. No subir `.env` ni secretos.

</details>

### 3.3) Licencia [🔝](#índice-)

<details>
  <summary>Ver detalle</summary>

<br>

ISC — [Andrés Weitzel](https://github.com/andresWeitzel).

</details>

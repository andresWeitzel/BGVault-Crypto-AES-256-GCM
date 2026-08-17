# 🔐 BGVault — Sistema de Gestión de Credenciales Encriptadas (AES-256-GCM)

Vault REST para almacenar de forma segura **contraseñas, API keys, tokens y notas**. Cada credencial se cifra con **AES-256-GCM** antes de persistirse; los listados y el GET por id solo devuelven metadatos. El texto plano nunca viaja en query string: sale únicamente por `POST /reveal` con autenticación.

Desarrollado con Node.js y Express, usando **solo `node:crypto`** para criptografía (sin `bcrypt`, `crypto-js` ni KMS externos).

## 📋 Características

- ✅ **Vault de credenciales**: no es un encriptador suelto — es una API para crear, listar, revelar, verificar y eliminar credenciales
- ✅ **Cuatro tipos**: `password`, `api_key`, `token` y `note`, cada uno con payload validado
- ✅ **AES-256-GCM**: cifrado autenticado; el tag GCM detecta manipulación del ciphertext
- ✅ **AAD ligado a la credencial**: Additional Authenticated Data `credential:<id>:<type>:<version>` — un blob no se puede reubicar en otro id, tipo o versión
- ✅ **Envelope encryption**: cada versión tiene una DEK aleatoria de 32 bytes; `ENCRYPTION_KEY` solo envuelve esa DEK (PBKDF2). Revelar una versión no deriva la clave maestra sobre el payload
- ✅ **Generador CSPRNG**: `POST /api/generate` arma passwords, API keys y tokens con `crypto.randomInt`
- ✅ **PBKDF2**: 100.000 iteraciones con SHA-256 al **envolver** la DEK (no en cada byte del payload)
- ✅ **IV de 12 bytes (NIST)** en payload y en el wrap de la DEK
- ✅ **Persistencia SQLite**: las credenciales y versiones sobreviven al reinicio (`node:sqlite`, sin ORM)
- ✅ **TTL y one-time reveal**: `expiresAt` y `maxReveals` por versión; reveal/verify vencidos o agotados responden **410** sin desencriptar
- ✅ **Versionado y rotación**: cada cambio de payload crea una versión nueva; la anterior sigue revelable
- ✅ **Auditoría**: generate, create, get, patch, reveal, verify, rotate, delete, versions, register, login y logout quedan en `audit_events` (sin plaintext)
- ✅ **IDs UUID**: se abandonó el `index` numérico; cada credencial tiene identidad estable
- ✅ **Metadatos en claro, payload cifrado**: `name`, `service` y `tags` se pueden filtrar y **editar con PATCH**; la clave/contraseña no aparece en GET
- ✅ **Listados paginados**: `GET /api/credentials` y `GET /api/audit` usan `limit` (máx. 200) y `offset`
- ✅ **Rotación de KEK**: `ENCRYPTION_KEY_NEXT` + `npm run rewrap-keys` reenvuelve `wrapped_dek` sin tocar el payload
- ✅ **Autenticación JWT**: register/login emiten un Bearer HS256 con `jti`; `POST /api/auth/logout` lo revoca hasta `exp`
- ✅ **Aislamiento por usuario**: cada credencial y cada evento de auditoría pertenece a un `user_id`; un JWT ajeno recibe 404, no 403
- ✅ **Sobre JSON uniforme**: éxitos llevan `requestId` + `timestamp`; errores son `{ error: { code, message }, requestId, timestamp }`
- ✅ **Rate limit**: tope en register/login, reveal/verify y (opcional) global por IP vía `RATE_LIMIT_IP_MAX` (`X-RateLimit-*`, **429** `RATE_LIMITED`)
- ✅ **Sin clave por defecto**: el servidor no arranca con `default-key-change-me…`; exige `ENCRYPTION_KEY` y `JWT_SECRET` (≥ 32 caracteres)
- ✅ **Collection de Postman**: casos de éxito (201/200) y error (400/401/404/409/410) con scripts `pm.test` ejecutables desde el Runner
- ✅ **Módulo reutilizable**: `src/crypto/lib.js` se copia a otros proyectos Node sin dependencias extra
- ✅ **Setup de entorno**: `npm run setup-env` genera o completa `.env`

Las cuentas viven en la tabla `users`. Versiones antiguas sin `wrapped_dek` se siguen revelando con el cifrado directo (legado).

Para rotar `ENCRYPTION_KEY` sin re-cifrar payloads: definí `ENCRYPTION_KEY_NEXT`, corré `npm run rewrap-keys`, copiá la clave nueva sobre `ENCRYPTION_KEY` y borré `NEXT`. Mientras `NEXT` esté definida, `seal` usa esa clave y `open` acepta ambas.

## 🛠️ Tecnologías

- **Node.js**: runtime (22.13+ — incluye `node:sqlite`)
- **Express**: API HTTP
- **node:crypto**: único motor criptográfico
- **node:sqlite**: persistencia, versiones y audit log
- **AES-256-GCM**: cifrado simétrico con autenticación
- **Postman Collection v2.1**: pruebas de contrato de la API

## 📦 Instalación

1. Clonar el repositorio o descargar el proyecto
2. Instalar dependencias y generar el entorno:

```bash
npm install
npm run setup-env
npm run server
```

`setup-env` escribe `.env` en la raíz con:

| Variable | Rol |
|----------|-----|
| `PORT` | Puerto HTTP (por defecto `3000`) |
| `ENCRYPTION_KEY` | Clave maestra de cifrado (≥ 32 caracteres, aleatoria) |
| `ENCRYPTION_KEY_NEXT` | KEK nueva opcional; con ella activa, `seal` usa NEXT y `open` acepta ambas |
| `JWT_SECRET` | Firma HMAC-SHA256 de los tokens (distinta de `ENCRYPTION_KEY`) |
| `JWT_EXPIRES_IN` | Segundos de vida del JWT (por defecto `28800` = 8 h; min 60, máx 7 días) |
| `SQLITE_PATH` | Ruta del archivo SQLite (por defecto `data/bgvault.sqlite`) |
| `RATE_LIMIT_AUTH_MAX` | Tope de register/login por IP (por defecto `60`) |
| `RATE_LIMIT_AUTH_WINDOW_MS` | Ventana de auth en ms (por defecto `600000` = 10 min) |
| `RATE_LIMIT_REVEAL_MAX` | Tope de reveal/verify por usuario (por defecto `120`) |
| `RATE_LIMIT_REVEAL_WINDOW_MS` | Ventana de reveal/verify en ms (por defecto `60000` = 1 min) |
| `RATE_LIMIT_IP_MAX` | Tope **global** de `/api/*` por IP; vacío = desactivado. Se setea en Render sin cambiar código |
| `RATE_LIMIT_IP_WINDOW_MS` | Ventana del tope global (por defecto `600000` = 10 min) |

En la collection de Postman el usuario de demo es `demo@bgvault.local` / `bgvault-dev-password` (se crea en el Runner). En producción usá valores distintos y largos.

**⚠️ IMPORTANTE**: no subas `.env` al repositorio (está en `.gitignore`).

## ⚙️ Configuración

### Archivo `.env`

Podés crearlo de tres formas:

#### Opción 1: Setup (recomendado)

```bash
npm run setup-env
```

Si faltan claves, genera `ENCRYPTION_KEY` y `JWT_SECRET` (32 bytes en hex cada una). Si ya existen, las conserva.

#### Opción 2: Copiar el ejemplo

```bash
cp .env.example .env
```

Completá `ENCRYPTION_KEY` y `JWT_SECRET` (mínimo 32 caracteres cada una).

#### Opción 3: Variables de entorno del sistema

```bash
export ENCRYPTION_KEY="tu-clave-segura-de-32-caracteres-minimo"
export JWT_SECRET="otro-secreto-distinto-de-32-caracteres-min"
export PORT=3000
```

El servidor carga `.env` al arrancar, pero **no pisa** variables ya definidas en el proceso.

### Clave de encriptación

No hay clave hardcodeada. Si `ENCRYPTION_KEY` o `JWT_SECRET` faltan, miden menos de 32 caracteres, o `ENCRYPTION_KEY` es la antigua clave insegura de demo, el proceso **termina con error** y pide `npm run setup-env`. `JWT_SECRET` **no** se deriva de `ENCRYPTION_KEY`: si se filtra uno, el otro sigue sirviendo.

## 🚀 Uso

### Iniciar el servidor

```bash
npm run server
```

El vault queda en `http://localhost:3000` (o el `PORT` configurado). En consola:

```
BGVault corriendo en http://localhost:3000
Auth: JWT Bearer (POST /api/auth/register, /login; POST /api/auth/logout)
```

### Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run setup-env` | Genera o completa `.env` (`ENCRYPTION_KEY`, `JWT_SECRET`) |
| `npm run server` | Inicia el vault Express |
| `npm run client:post` | Registra/loguea `demo@bgvault.local` y crea una credencial `password` |
| `npm run client:get` | Lista credenciales del usuario demo (solo metadatos) |
| `npm run decrypt-env` | Muestra variables `*_ENCRYPTED` del `.env`, si existen |
| `npm run rewrap-keys` | Reenvuelve `wrapped_dek` con `ENCRYPTION_KEY_NEXT` (no toca el payload) |
| `npm test` | Tests nativos (`node --test`): auth, logout/`jti`, aislamiento, PATCH, paginación, 410 |

## ☁️ Deploy (Render Free)

Sandbox público **sin pago mensual**. Misma API que en local. Lo que configura el hosting está en `render.yaml`.

### Qué hace Render y qué no

| Sí | No (Free) |
|----|-----------|
| HTTPS `https://bgvault-xxxx.onrender.com` | Disco persistente (la SQLite vive en `/tmp`) |
| `npm install` + `node src/server.js` | SSH, jobs, `rewrap-keys` en el server |
| Env `ENCRYPTION_KEY` / `JWT_SECRET` / rate limit | Postgres (no hace falta: el vault usa SQLite) |
| Health `GET /health` | Datos de ayer: al dormir (~15 min) o redeploy, la base arranca **vacía** |
| Rate limit por IP (`RATE_LIMIT_IP_MAX`) | 24/7 sin cold start (primera pega ~30–60 s) |

Cada uno se registra aparte: no ve el password ni el id de otro **mientras** el contenedor está despierto. Cerrar Postman **no** borra la base; la borra el sleep/redeploy.

### A. Blueprint (recomendado)

El repo tiene que estar en GitHub **con estos cambios pusheados** (`render.yaml` en la misma carpeta que `package.json`).

1. [dashboard.render.com](https://dashboard.render.com) → Login (GitHub)
2. **New** → **Blueprint**
3. Autorizá el repo de BGVault
4. **Branch:** `master` (o la que uses)
5. **Blueprint path:** `render.yaml` (raíz). Si GitHub tiene carpetas de más, **Root Directory** = carpeta del `package.json`
6. Apply. Plan **Free**. `ENCRYPTION_KEY` y `JWT_SECRET` se **generan solos** (`generateValue`, ≥ 32 caracteres, distintos)
7. Esperá **Live** (unos minutos). Copiá la URL `https://….onrender.com`

### B. A mano (si no usás Blueprint)

**New** → **Web Service** → el repo →:

| Campo | Valor |
|-------|--------|
| Language / runtime | Node |
| Branch | `master` |
| Root Directory | (vacío si `package.json` está en la raíz del repo) |
| Build Command | `npm install` |
| Start Command | `node src/server.js` |
| Instance type | **Free** |
| Health Check Path | `/health` |

**Environment** (Environment → Add):

| Key | Value |
|-----|--------|
| `NODE_VERSION` | `22.13.0` |
| `HOST` | `0.0.0.0` |
| `SQLITE_PATH` | `/tmp/bgvault.sqlite` |
| `ENCRYPTION_KEY` | Generate / 32+ chars **distinto** de JWT |
| `JWT_SECRET` | Generate / 32+ chars **distinto** de la KEK |
| `RATE_LIMIT_IP_MAX` | `40` (o `10` si querés más cerrado) |
| `RATE_LIMIT_IP_WINDOW_MS` | `600000` |
| `RATE_LIMIT_AUTH_MAX` | `20` |
| `RATE_LIMIT_AUTH_WINDOW_MS` | `600000` |
| `RATE_LIMIT_REVEAL_MAX` | `120` |
| `RATE_LIMIT_REVEAL_WINDOW_MS` | `60000` |

`PORT` lo pone Render. No lo hardcodees a 3000.

No agregues **Persistent Disk**, **Postgres** ni **Key Value**.

### Probar

La primera request puede tardar un minuto (cold start).

```bash
curl -si "https://<servicio>.onrender.com/health"
```

Esperado: **200**, `"status":"OK"`. Después:

```bash
curl -s -X POST "https://<servicio>.onrender.com/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@bgvault.local","password":"bgvault-dev-password"}'
```

Postman: collection `collections/bgvault.postman_collection.json` → variable `baseUrl` = `https://<servicio>.onrender.com` (timeout ≥ 90 s en el primer Health). El Runner completo suele superar 40 hits: o subís `RATE_LIMIT_IP_MAX` o corrés la collection en local.

Si alguien se pasa del tope por IP: **429** `RATE_LIMITED` (`Demasiadas solicitudes para esta IP`). Otra IP no se bloquea.

## 🔑 Autenticación

`GET /health` es público. `POST /api/auth/register` y `POST /api/auth/login` también (emiten el token).

Todas las rutas `/api/credentials*`, `/api/audit*`, `POST /api/generate`, `GET /api/auth/me` y `POST /api/auth/logout` exigen:

```
Authorization: Bearer <accessToken>
```

Sin header, con un token inválido, expirado, sin `jti` o de un usuario borrado: **401** `UNAUTHORIZED`. Tras logout, el mismo token responde **401** `TOKEN_REVOKED`.

El JWT es **HS256** firmado con `JWT_SECRET` (`node:crypto.createHmac`) y lleva `jti`. La contraseña de la cuenta se guarda con **scrypt** (`N=16384, r=8, p=1`); nunca viaja de vuelta en JSON. Un login fallido responde **401** `INVALID_CREDENTIALS` (no dice si el email existe).

Un usuario **no ve** las credenciales de otro: list, get, patch, reveal, rotate y audit filtran por `user_id`. Si el id existe pero es de otro dueño, la API responde **404** (no 403), para no filtrar existencia.

## 📦 Contrato de respuesta

Toda respuesta JSON incluye `timestamp` y `requestId` (también en el header `X-Request-Id`). Si mandás `X-Request-Id` (8–128 caracteres `A-Za-z0-9._:-`), se reutiliza; si no, se genera un UUID.

**Éxito** — el recurso va en `credential` / `credentials` / `user`. Reveal suma `payload` al lado de `credential` (el GET nunca lleva `payload`).

**Error:**

```json
{
  "error": {
    "code": "CREDENTIAL_EXPIRED",
    "message": "Credencial vencida"
  },
  "requestId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

| `code` | Status | Cuándo |
|--------|--------|--------|
| `VALIDATION` | 400 | Body o query inválido |
| `JSON_INVALID` | 400 | JSON mal formado |
| `UNAUTHORIZED` | 401 | JWT ausente, inválido, sin `jti` o usuario borrado |
| `TOKEN_REVOKED` | 401 | Logout: el `jti` está en `revoked_tokens` |
| `INVALID_CREDENTIALS` | 401 | Login con email/password incorrectos |
| `CREDENTIAL_NOT_FOUND` | 404 | Credencial inexistente o de otro usuario |
| `VERSION_NOT_FOUND` | 404 | Número de versión inexistente |
| `ROUTE_NOT_FOUND` | 404 | Ruta HTTP desconocida |
| `EMAIL_TAKEN` | 409 | Register con email ya usado |
| `CREDENTIAL_EXPIRED` | 410 | `expiresAt` vencido (sin desencriptar) |
| `REVEAL_LIMIT` | 410 | `maxReveals` agotado (sin desencriptar) |
| `RATE_LIMITED` | 429 | Tope de register/login, reveal/verify o `RATE_LIMIT_IP_MAX` por IP |
| `INTERNAL` | 500 | Fallo no controlado (mensaje genérico) |

Los 500 loguean el `requestId` en consola para correlacionar. No se usa el texto de `message` como API estable: el cliente debe ramificar por `code`.

Register/login: 60 req / 10 min por IP (`RATE_LIMIT_AUTH_MAX`). Reveal y verify: 120 / min por usuario. Tope global opcional: `RATE_LIMIT_IP_MAX` requests a `/api/*` por IP y ventana (`RATE_LIMIT_IP_WINDOW_MS`). Headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; en 429 también `Retry-After`.

## 📡 API Endpoints

### Base URL

```
http://localhost:3000
```

---

### 1. Health Check

Verifica que el proceso esté vivo. No requiere auth.

**GET** `/health`

**Respuesta 200:**
```json
{
  "status": "OK",
  "persistence": "sqlite",
  "auth": "jwt",
  "crypto": "envelope",
  "requestId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

---

### 2. Registrar usuario

Crea la cuenta, hashea la contraseña con scrypt y devuelve un JWT. El email se normaliza a minúsculas.

**POST** `/api/auth/register`  
**Auth:** no  
**Status:** `201`

**Body:**
```json
{
  "email": "demo@bgvault.local",
  "password": "bgvault-dev-password"
}
```

| Campo | Requerido | Regla |
|-------|-----------|-------|
| `email` | sí | Formato básico, máximo 254 caracteres |
| `password` | sí | Entre 8 y 128 caracteres |

**Respuesta 201:**
```json
{
  "message": "Usuario registrado",
  "user": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "email": "demo@bgvault.local",
    "createdAt": "2026-08-16T01:35:56.264Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

La respuesta **nunca** incluye `password` ni `passwordHash`.

**Errores:**

| Status | Cuándo |
|--------|--------|
| 400 | `VALIDATION` — falta email/password, email inválido, password corto |
| 409 | `EMAIL_TAKEN` — email ya registrado |
| 429 | `RATE_LIMITED` — tope de register/login por IP |

---

### 3. Iniciar sesión

**POST** `/api/auth/login`  
**Auth:** no  
**Status:** `200`

Mismo body que register. Respuesta idéntica salvo `message`: `"Sesión iniciada"`.

**Errores:** `400` `VALIDATION` si faltan campos; `401` `INVALID_CREDENTIALS` si el email no existe o la contraseña no coincide; `429` `RATE_LIMITED` si se supera el tope por IP.

---

### 4. Perfil (me)

**GET** `/api/auth/me`  
**Auth:** Bearer JWT

**Respuesta 200:**
```json
{
  "user": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "email": "demo@bgvault.local",
    "createdAt": "2026-08-16T01:35:56.264Z"
  },
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

---

### 5. Cerrar sesión (logout)

Invalida el JWT actual. Cada token lleva un `jti` (UUID); al cerrar sesión se guarda en `revoked_tokens` hasta que expire. Un login nuevo emite **otro** `jti`.

**POST** `/api/auth/logout`  
**Auth:** Bearer JWT  
Body: no hace falta.

**Respuesta 200:**
```json
{
  "message": "Sesión cerrada",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

Usos posteriores del mismo token: **401** `TOKEN_REVOKED`. Un token sin `jti` (legado) o con firma inválida sigue siendo **401** `UNAUTHORIZED`.

---

### 6. Generar secreto

Arma un valor aleatorio con `crypto.randomInt` (CSPRNG). **No lo guarda**: copialo al `payload` de create/rotate si querés persistirlo.

**POST** `/api/generate`  
**Auth:** Bearer JWT

**Body:**
```json
{
  "kind": "password",
  "length": 24,
  "uppercase": true,
  "lowercase": true,
  "digits": true,
  "symbols": true,
  "excludeAmbiguous": true
}
```

Body mínimo por kind (el resto usa defaults: password 20 con símbolos; `api_key` 32 y `token` 48 **sin** símbolos):

```json
{ "kind": "api_key" }
```

```json
{ "kind": "token" }
```

| Campo | Default | Notas |
|-------|---------|-------|
| `kind` | `password` | `password` \| `api_key` \| `token` (`note` no aplica) |
| `length` | 20 / 32 / 48 según kind | entero 12–128 |
| `uppercase` `lowercase` `digits` | `true` | — |
| `symbols` | `true` en password, `false` en api_key/token | `!@#$%^&*_-+=?` |
| `excludeAmbiguous` | `true` | omite `I`, `O`, `l`, `0`, `1` |

**Respuesta 200:**
```json
{
  "kind": "password",
  "length": 24,
  "value": "wK7#mP9qR2xHvNt8s@BdYf3a",
  "options": {
    "uppercase": true,
    "lowercase": true,
    "digits": true,
    "symbols": true,
    "excludeAmbiguous": true
  },
  "requestId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

Garantiza al menos un carácter de cada juego activo. **400** si `kind` es inválido, `length` sale de rango o todos los juegos están en `false`.

---

### 7. Crear credencial

Cifra el `payload` con **envelope encryption**: DEK aleatoria AES-256-GCM (AAD = `credential:<id>:<type>:<version>`) y wrap de esa DEK con `ENCRYPTION_KEY` (AAD = `dek:<id>:<version>`). Guarda el registro como **versión 1**.

**POST** `/api/credentials`  
**Auth:** requerida  
**Status:** `201`

**Body (password):**
```json
{
  "type": "password",
  "name": "Gmail personal",
  "service": "Gmail",
  "tags": ["email"],
  "payload": {
    "password": "miContraseña123",
    "username": "usuario@example.com"
  }
}
```

TTL / un solo uso (opcionales, a nivel **versión**, no dentro de `payload`):

```json
{
  "type": "password",
  "name": "OTP",
  "maxReveals": 1,
  "expiresAt": "2027-12-31T00:00:00.000Z",
  "payload": {
    "password": "once",
    "username": "usuario@example.com"
  }
}
```

**Parámetros:**

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `type` | sí | `password` \| `api_key` \| `token` \| `note` |
| `name` | sí | Nombre visible (metadato en claro) |
| `service` | no | Servicio o producto asociado |
| `tags` | no | Array de strings |
| `payload` | sí | Objeto sensible (se cifra entero) |
| `expiresAt` | no | ISO-8601 futuro; esa **versión** deja de revelarse al vencer |
| `maxReveals` | no | Entero 1–10000; cada reveal/verify consume un uso |

Omitidos: sin caducidad y revelaciones ilimitadas. `null` en rotate limpia el valor heredado.

**`payload` según `type`:**

| type | Campo requerido | Campos opcionales |
|------|-----------------|-------------------|
| `password` | `payload.password` | `payload.username` (y extras libres) |
| `api_key` | `payload.key` | extras libres |
| `token` | `payload.token` | extras libres (`payload.expiresAt`, etc.); **no** es el `expiresAt` de la **versión** |
| `note` | `payload.text` | extras libres |

Las claves extra se cifran enteras con el blob. Solo fallan las requeridas de la tabla.

**Respuesta 201:**
```json
{
  "message": "Credencial almacenada",
  "credential": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "password",
    "name": "Gmail personal",
    "service": "Gmail",
    "tags": ["email"],
    "currentVersion": 1,
    "version": 1,
    "expiresAt": null,
    "maxReveals": null,
    "revealCount": 0,
    "revealsRemaining": null,
    "expired": false,
    "createdAt": "2026-08-16T01:35:56.264Z",
    "updatedAt": "2026-08-16T01:35:56.264Z"
  },
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

La respuesta **nunca** incluye `payload` ni ciphertext.

**Errores:**

| Status | Cuándo |
|--------|--------|
| 400 | `type` inválido, falta `name`, `payload` incompleto, `tags` mal formados, `expiresAt` pasado, `maxReveals` inválido |
| 401 | Sin JWT, token inválido o expirado |

```json
{
  "error": { "code": "VALIDATION", "message": "name es requerido" },
  "requestId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

---

### 8. Listar credenciales

Devuelve solo metadatos. Se puede filtrar.

**GET** `/api/credentials`  
**GET** `/api/credentials?type=password`  
**GET** `/api/credentials?service=Gmail`  
**GET** `/api/credentials?limit=50&offset=0`  
**Auth:** requerida

**Query:**

| Param | Descripción |
|-------|-------------|
| `type` | Filtra por tipo |
| `service` | Filtra por servicio (match exacto) |
| `limit` | Tamaño de página (1–200, por defecto 50) |
| `offset` | Desde qué registro (por defecto 0) |

**Respuesta 200:**
```json
{
  "credentials": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "type": "password",
      "name": "Gmail personal",
      "service": "Gmail",
      "tags": ["email"],
      "currentVersion": 1,
      "version": 1,
      "expiresAt": null,
      "maxReveals": null,
      "revealCount": 0,
      "revealsRemaining": null,
      "expired": false,
      "createdAt": "2026-08-16T01:35:56.264Z",
      "updatedAt": "2026-08-16T01:35:56.264Z"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0,
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

Otros tipos de ejemplo para crear:

```json
{
  "type": "api_key",
  "name": "Stripe live",
  "service": "Stripe",
  "payload": { "key": "sk_live_demo_not_a_real_key" }
}
```

```json
{
  "type": "token",
  "name": "GitHub PAT",
  "service": "GitHub",
  "payload": {
    "token": "ghp_demoReplaceMeNotARealPat",
    "expiresAt": "2028-01-01T00:00:00.000Z"
  }
}
```

`payload.expiresAt` queda cifrado con el token. El TTL que dispara **410** es el `expiresAt` de primer nivel (junto a `name` / `maxReveals`).

```json
{
  "type": "note",
  "name": "WiFi oficina",
  "payload": { "text": "SSID: HQ / clave: …" }
}
```

---

### 9. Obtener metadatos por id

**GET** `/api/credentials/:id`  
**Auth:** requerida

**Respuesta 200:**
```json
{
  "credential": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "password",
    "name": "Gmail personal",
    "service": "Gmail",
    "tags": ["email"],
    "currentVersion": 1,
    "version": 1,
    "expiresAt": null,
    "maxReveals": null,
    "revealCount": 0,
    "revealsRemaining": null,
    "expired": false,
    "createdAt": "2026-08-16T01:35:56.264Z",
    "updatedAt": "2026-08-16T01:35:56.264Z"
  },
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

No incluye `payload` ni ciphertext.

**Respuesta 404:**
```json
{
  "error": { "code": "CREDENTIAL_NOT_FOUND", "message": "Credencial no encontrada" },
  "requestId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

---

### 10. Editar metadatos (PATCH)

Cambia `name`, `service` o `tags` **sin** rotar el payload ni incrementar la versión. `type`, `expiresAt` y `maxReveals` no se editan acá: el tipo es inmutable y el ciclo de vida se hereda o se cambia en **rotate**.

**PATCH** `/api/credentials/:id`  
**Auth:** requerida

**Body** (al menos un campo):
```json
{
  "name": "Gmail trabajo",
  "service": "Google Workspace",
  "tags": ["email", "trabajo"]
}
```

`service: null` (o `""`) limpia el servicio. `tags: []` deja la credencial sin tags.

**Respuesta 200:**
```json
{
  "message": "Metadatos actualizados",
  "credential": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "password",
    "name": "Gmail trabajo",
    "service": "Google Workspace",
    "tags": ["email", "trabajo"],
    "currentVersion": 1,
    "version": 1,
    "expiresAt": null,
    "maxReveals": null,
    "revealCount": 0,
    "revealsRemaining": null,
    "expired": false,
    "createdAt": "2026-08-16T01:35:56.264Z",
    "updatedAt": "2026-08-16T01:40:00.000Z"
  },
  "timestamp": "2026-08-16T01:40:00.000Z"
}
```

La respuesta **nunca** incluye `payload` ni ciphertext. La versión no cambia.

**Errores:**

| Status | Cuándo |
|--------|--------|
| 400 | `VALIDATION` — body vacío, campos extra (`payload`, `type`, …), `name` vacío, `tags` mal formados |
| 401 | `UNAUTHORIZED` — sin JWT |
| 404 | `CREDENTIAL_NOT_FOUND` — id inexistente o de otro usuario |

---

### 11. Revelar credencial (POST)

Desencripta el payload y lo devuelve. Es **POST** a propósito: el valor no queda en access logs de query string.

**POST** `/api/credentials/:id/reveal`  
**Auth:** requerida  
Body: no hace falta.

**Respuesta 200:**
```json
{
  "credential": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "password",
    "name": "Gmail personal",
    "service": "Gmail",
    "tags": ["email"],
    "currentVersion": 1,
    "version": 1,
    "expiresAt": null,
    "maxReveals": null,
    "revealCount": 1,
    "revealsRemaining": null,
    "expired": false,
    "createdAt": "2026-08-16T01:35:56.264Z",
    "updatedAt": "2026-08-16T01:35:56.264Z"
  },
  "payload": {
    "password": "miContraseña123",
    "username": "usuario@example.com"
  },
  "requestId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

**404** `CREDENTIAL_NOT_FOUND` si el id no existe **o pertenece a otro usuario**. **401** `UNAUTHORIZED` sin JWT.

**410** `CREDENTIAL_EXPIRED` si `expiresAt` ya pasó. **410** `REVEAL_LIMIT` si `maxReveals` se agotó. En ambos casos **no** se desencripta y no hay `payload`. **429** `RATE_LIMITED` si se supera el tope de reveal/verify.

GET/list de una versión quemada o vencida siguen devolviendo metadatos (`expired`, `revealsRemaining`).

---

### 12. Verificar una contraseña

Compara un candidato contra el payload almacenado. **Solo aplica a `type=password`**.

**POST** `/api/credentials/:id/verify`  
**Auth:** requerida

**Body:**
```json
{
  "password": "miContraseña123",
  "username": "usuario@example.com"
}
```

`username` es opcional: si lo mandás, también se verifica. El body va **en la raíz** (`password`, `username?`, `version?`), **no** anidado en `payload`. Verify **consume** un uso de `maxReveals` (desencripta el payload).

**Respuesta 200 (válida):**
```json
{
  "credential": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "password",
    "name": "Gmail personal",
    "service": "Gmail",
    "tags": ["email"],
    "currentVersion": 1,
    "version": 1,
    "expiresAt": null,
    "maxReveals": null,
    "revealCount": 1,
    "revealsRemaining": null,
    "expired": false,
    "createdAt": "2026-08-16T01:35:56.264Z",
    "updatedAt": "2026-08-16T01:35:56.264Z"
  },
  "isValid": true,
  "verified": {
    "password": true,
    "username": true
  },
  "message": "Valores válidos",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

**Respuesta 200 (inválida):** `isValid: false`, `message`: `"Valores inválidos"`.

**Errores:**

| Status | Cuándo |
|--------|--------|
| 400 | `VALIDATION` — el registro no es `password`, o falta `password` en el body |
| 401 | `UNAUTHORIZED` — sin JWT |
| 404 | `CREDENTIAL_NOT_FOUND` — id inexistente o de otro usuario |
| 410 | `CREDENTIAL_EXPIRED` / `REVEAL_LIMIT` — misma regla que reveal |
| 429 | `RATE_LIMITED` — tope de reveal/verify |

---

### 13. Eliminar credencial

**DELETE** `/api/credentials/:id`  
**Auth:** requerida

**Respuesta 200:**
```json
{
  "message": "Credencial eliminada",
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

**404** si no existía.

---

### 14. Rotar credencial (nueva versión)

Cifra un payload nuevo, incrementa `currentVersion` y **conserva** las versiones anteriores. El tipo no cambia. `expiresAt` y `maxReveals` de la versión nueva se **heredan** de la actual salvo que los mandes (o `null` para ilimitado). `revealCount` de la versión nueva arranca en 0.

**POST** `/api/credentials/:id/rotate`  
**Auth:** requerida

**Body:** el `payload` debe cumplir el **mismo `type`** que ya tiene la credencial (`password` → `payload.password`, `api_key` → `payload.key`, `token` → `payload.token`, `note` → `payload.text`).

```json
{
  "payload": {
    "password": "nuevaContraseña456!",
    "username": "usuario@example.com"
  }
}
```

Opcional: nuevo ciclo de vida de **esta** versión (si omitís los campos, se heredan):

```json
{
  "payload": {
    "password": "nuevaContraseña456!",
    "username": "usuario@example.com"
  },
  "expiresAt": "2027-12-31T00:00:00.000Z",
  "maxReveals": 3
}
```

`expiresAt: null` o `maxReveals: null` limpia el valor heredado (sin caducidad / revelaciones ilimitadas).

**Respuesta 200:**
```json
{
  "message": "Credencial rotada",
  "credential": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "password",
    "name": "Gmail personal",
    "service": "Gmail",
    "tags": ["email"],
    "currentVersion": 2,
    "version": 2,
    "expiresAt": null,
    "maxReveals": null,
    "revealCount": 0,
    "revealsRemaining": null,
    "expired": false,
    "createdAt": "2026-08-16T01:35:56.264Z",
    "updatedAt": "2026-08-16T01:40:00.000Z"
  },
  "timestamp": "2026-08-16T01:40:00.000Z"
}
```

**400** si `payload` no cumple el tipo. **404** si el id no existe.

---

### 15. Listar versiones

Devuelve el historial **sin** ciphertext ni plaintext.

**GET** `/api/credentials/:id/versions`  
**Auth:** requerida

**Respuesta 200:**
```json
{
  "credential": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "currentVersion": 2
  },
  "versions": [
    {
      "version": 1,
      "createdAt": "2026-08-16T01:35:56.264Z",
      "expiresAt": null,
      "maxReveals": null,
      "revealCount": 0,
      "revealsRemaining": null,
      "expired": false
    },
    {
      "version": 2,
      "createdAt": "2026-08-16T01:40:00.000Z",
      "expiresAt": null,
      "maxReveals": null,
      "revealCount": 0,
      "revealsRemaining": null,
      "expired": false
    }
  ],
  "timestamp": "2026-08-16T01:40:00.000Z"
}
```

---

### 16. Revelar una versión concreta

El reveal usa la versión actual si no mandás `version`. El número de versión va en el **body**, no en la URL.

**POST** `/api/credentials/:id/reveal`

```json
{
  "version": 1
}
```

**Respuesta 200:** `credential` (con `version` y `currentVersion`) más `payload`.  
**404** `VERSION_NOT_FOUND` si ese número no existe.

Verify también acepta `"version": 1` opcional (por defecto, la actual).

---

### 17. Auditoría

Lista eventos de register, login, logout, generate, create, get, patch, reveal, verify, rotate, delete y versions **del usuario autenticado**. **Nunca** guarda plaintext, ciphertext ni DEKs.

**GET** `/api/audit`  
**GET** `/api/audit?action=rotate`  
**GET** `/api/audit?credentialId=<uuid>&limit=50&offset=0`  
**Auth:** requerida

**Respuesta 200:**
```json
{
  "events": [
    {
      "id": 12,
      "at": "2026-08-16T01:40:00.000Z",
      "action": "rotate",
      "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "credentialId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "version": 2,
      "ok": true,
      "detail": { "from": 1, "to": 2 }
    }
  ],
  "limit": 50,
  "offset": 0,
  "count": 1,
  "timestamp": "2026-08-16T01:40:00.000Z"
}
```

`limit` máximo: 200.

---

### Códigos HTTP (resumen)

| Código | Significado |
|--------|-------------|
| 200 | Login, me, logout, generate, listar, get, patch, versions, reveal, verify, rotate, delete, audit |
| 201 | Usuario o credencial creados |
| 400 | Validación (email, password de cuenta, tipo, name, payload, expiresAt, maxReveals, verify sobre no-password) |
| 401 | JWT ausente, inválido, expirado; o login con credenciales incorrectas |
| 404 | Credencial ajena, inexistente, o ruta inexistente |
| 409 | Email ya registrado |
| 410 | Versión vencida o sin revelaciones restantes |
| 429 | Rate limit en register/login, reveal/verify o `RATE_LIMIT_IP_MAX` por IP |

## 🧪 Collection de Postman

La collection **Crypto AES-256-GCM Vault** cubre el contrato con `pm.test` en cada request: Health (+ `X-Request-Id`), Auth (401/400/409, logout/`TOKEN_REVOKED`), Generate, Create, list/paginación, PATCH de metadatos, aislamiento, Reveal, Lifecycle (one-time `REVEAL_LIMIT` y TTL `CREDENTIAL_EXPIRED`), verify, rotación, auditoría paginada y delete.

Archivo: `collections/bgvault.postman_collection.json`  
El `_postman_id` se mantiene fijo para que reimportar **actualice** la collection y no abra otra.

### Cómo ejecutarla

1. Local: `npm run setup-env` y `npm run server`. Render: cambiá `baseUrl` a `https://<servicio>.onrender.com` (timeout alto en Health).
2. En Postman: **Import** → `collections/bgvault.postman_collection.json` (si ya existe, **Replace**)
3. **Runner** → **Run collection** (en orden). Auth registra `demo@bgvault.local` (o hace login si ya existe) y guarda `accessToken`
4. Guardá (Ctrl+S) si Postman te pide persistir variables

La collection envía `Authorization: Bearer {{accessToken}}` en vault y me. Health, register, login, 401, 404 de ruta y JSON inválido van con `noauth` cuando corresponde.

Los tests comprueban status y `error.code`, que GET/list no filtren `payload` ni ciphertext, que PATCH no rote el secreto ni la versión, que un segundo usuario reciba **404** (no 403), paginación `limit`/`offset` en list y audit, y que reveal/verify desencripten el valor esperado. El caso TTL espera ~3 s a que venza `expiresAt`.

El re-wrap de DEKs (`npm run rewrap-keys`) no está en Postman: es un CLI de operador, no un endpoint.

Si el Runner dice **Environment: none**, está bien: el token se guarda en **variables de la collection**.

## 📝 Ejemplos de uso

### Ejemplo 1: curl

```bash
export BASE="http://localhost:3000"

# Salud (X-Request-Id en header y body)
curl -si "$BASE/health" -H "X-Request-Id: demo-req-0001"

# Registrar (o login si el email ya existe)
curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@bgvault.local","password":"bgvault-dev-password"}'

TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@bgvault.local","password":"bgvault-dev-password"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

AUTH="Authorization: Bearer $TOKEN"

# Perfil
curl -s "$BASE/api/auth/me" -H "$AUTH"

# Generar password
curl -s -X POST "$BASE/api/generate" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"kind":"password","length":24}'

# Crear password — copiá el `credential.id` de la respuesta para PATCH/reveal/verify/rotate
curl -s -X POST "$BASE/api/credentials" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{
    "type": "password",
    "name": "Gmail personal",
    "service": "Gmail",
    "tags": ["email"],
    "payload": { "password": "miContraseña123", "username": "usuario@example.com" }
  }'

# Crear API key (`payload.key`)
curl -s -X POST "$BASE/api/credentials" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{
    "type": "api_key",
    "name": "Stripe live",
    "service": "Stripe",
    "payload": { "key": "sk_live_demo_not_a_real_key" }
  }'

# Crear token (`payload.token`; extras van en el blob, no son el TTL de la versión)
curl -s -X POST "$BASE/api/credentials" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{
    "type": "token",
    "name": "GitHub PAT",
    "service": "GitHub",
    "payload": { "token": "ghp_demoReplaceMeNotARealPat", "expiresAt": "2028-01-01T00:00:00.000Z" }
  }'

# Listar (sin plaintext)
curl -s "$BASE/api/credentials?limit=50&offset=0" -H "$AUTH"

# Filtrar
curl -s "$BASE/api/credentials?type=password" -H "$AUTH"

# Editar metadatos (no toca el payload). Reemplazá <id> por el UUID de la password
curl -s -X PATCH "$BASE/api/credentials/<id>" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"Gmail trabajo","tags":["email","trabajo"]}'

# Revelar (reemplazá el id; body vacío = versión actual)
curl -s -X POST "$BASE/api/credentials/<id>/reveal" \
  -H "$AUTH"

# One-time / TTL (a nivel versión, no dentro de payload)
curl -s -X POST "$BASE/api/credentials" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{
    "type": "password",
    "name": "OTP",
    "maxReveals": 1,
    "expiresAt": "2027-12-31T00:00:00.000Z",
    "payload": { "password": "once" }
  }'

# Verificar password — solo `type=password`; body plano (no anidar en payload)
curl -s -X POST "$BASE/api/credentials/<id>/verify" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{ "password": "miContraseña123", "username": "usuario@example.com" }'

# Rotar — el payload tiene que coincidir con el type de esa credencial
curl -s -X POST "$BASE/api/credentials/<id>/rotate" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{ "payload": { "password": "nuevaContraseña456!", "username": "usuario@example.com" } }'

# Versiones
curl -s "$BASE/api/credentials/<id>/versions" -H "$AUTH"

# Revelar versión histórica
curl -s -X POST "$BASE/api/credentials/<id>/reveal" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{ "version": 1 }'

# Auditoría
curl -s "$BASE/api/audit?action=rotate" -H "$AUTH"

# Eliminar
curl -s -X DELETE "$BASE/api/credentials/<id>" \
  -H "$AUTH"

# Cerrar sesión (el mismo TOKEN deja de servir; hace falta un login nuevo)
curl -s -X POST "$BASE/api/auth/logout" -H "$AUTH"
```

### Ejemplo 2: scripts npm

```bash
npm run setup-env
npm run server          # en otra terminal
npm run client:post     # crea una credencial password de demo
npm run client:get      # lista metadatos
npm run rewrap-keys     # solo con ENCRYPTION_KEY_NEXT definida
npm run decrypt-env     # solo si hay *_ENCRYPTED en .env
npm test                # auth, logout, aislamiento, PATCH, 410
```

## 📁 Estructura del proyecto

```
bgvault/
├── src/
│   ├── config/
│   │   └── env.js                   # Carga .env y valida ENCRYPTION_KEY / JWT_SECRET / NEXT
│   ├── auth/
│   │   ├── password.js              # scrypt (hash / verify)
│   │   └── jwt.js                   # JWT HS256 + jti
│   ├── middleware/
│   │   ├── requireAuth.js           # Bearer JWT, jti no revocado
│   │   ├── requestId.js             # X-Request-Id (UUID o correlacioná el tuyo)
│   │   └── rateLimit.js             # tope in-memory (auth + reveal + IP opcional)
│   ├── http/
│   │   ├── respond.js               # envelope { error: { code, message } }
│   │   └── paging.js                # limit/offset (list y audit)
│   ├── db/
│   │   └── sqlite.js                # node:sqlite, schema, WAL, migrate
│   ├── store/
│   │   ├── usersStore.js            # Cuentas
│   │   ├── credentialsStore.js      # Credenciales + versiones (scoped)
│   │   ├── auditStore.js            # Audit log (scoped)
│   │   └── revokedTokensStore.js    # jti revocados hasta exp
│   ├── controllers/
│   │   ├── authController.js        # register, login, me, logout
│   │   ├── generateController.js    # POST /api/generate
│   │   ├── credentialController.js  # CRUD, patch, reveal, verify, rotate, versions
│   │   └── auditController.js
│   ├── crypto/
│   │   ├── lib.js                   # encrypt / decrypt AES-256-GCM + AAD (wrap de DEK)
│   │   ├── envelope.js              # seal / open / rewrap de DEK por versión
│   │   ├── generate.js              # CSPRNG passwords / api_key / token
│   │   └── crypto-cli.js            # CLI: cifrar / descifrar un valor
│   ├── routes/
│   │   ├── authRoutes.js            # /api/auth
│   │   ├── generateRoutes.js        # /api/generate
│   │   ├── credentialRoutes.js      # /api/credentials
│   │   └── auditRoutes.js           # /api/audit
│   ├── app.js                       # Express, headers, 404/JSON inválido
│   ├── server.js                    # load env, sqlite, listen
│   └── setup/
│       ├── setup-env.js             # Genera o completa .env
│       ├── rewrap-keys.js           # Reenvuelve DEKs con ENCRYPTION_KEY_NEXT
│       └── decrypt-env.js           # Muestra *_ENCRYPTED
├── data/
│   └── .gitkeep                     # bgvault.sqlite (gitignored)
├── collections/
│   └── bgvault.postman_collection.json
├── test/
│   └── api.test.js                  # node --test (auth, jti, vault)
├── scripts/
│   └── client/
│       └── client.sh                # Cliente bash (post / get)
├── .env.example
├── .nvmrc
├── render.yaml
├── package.json
└── README.md
```

## 🔄 Reutilización del módulo de encriptación

La lógica de cifrado está aislada en un módulo independiente, pensado para copiarse a otros servicios Node.

### Archivo a copiar

- **`src/crypto/lib.js`** — `encrypt(text, key, aad)` y `decrypt(blob, key, aad)` (el vault lo usa para **envolver la DEK**)
- **`src/crypto/envelope.js`** — `seal` / `open` del payload (opcional si copiás solo el cifrador simple)

### Dependencias

**Ninguna dependency de npm.** Solo `node:crypto`.

### Uso

```javascript
const { encrypt, decrypt } = require('./src/crypto/lib');

const clave = process.env.ENCRYPTION_KEY;
const aad = 'credential:<id>:password:1';

const cifrado = encrypt('mi contraseña', clave, aad);
const plano = decrypt(cifrado, clave, aad);
```

- Si no pasás `key`, usa `process.env.ENCRYPTION_KEY`.
- `aad` es opcional, pero **el mismo valor** tiene que usarse al cifrar y al descifrar.
- El vault ata AAD a `credential:<uuid>:<type>:<version>`.

### CLI

```bash
node src/crypto/crypto-cli.js "texto a cifrar"
node src/crypto/crypto-cli.js --decrypt "salt:iv:tag:encrypted"
```

Usa `ENCRYPTION_KEY` del entorno o el tercer argumento.

### Características del módulo

- ✅ **AES-256-GCM** con tag de autenticación
- ✅ **PBKDF2** 100.000 iteraciones, SHA-256, salida de 32 bytes
- ✅ **Salt** aleatorio de 64 bytes por mensaje
- ✅ **IV** aleatorio de 12 bytes (NIST); `decrypt` acepta IV legado de 16 bytes
- ✅ **AAD** opcional vía `cipher.setAAD` / `decipher.setAAD`
- ✅ **Formato** `salt:iv:tag:encrypted` (todo hex)
- ✅ **Sin clave default**: falla si `ENCRYPTION_KEY` no está o es la clave insegura histórica

## 🔒 Seguridad

### Encriptación

| Pieza | Detalle |
|-------|---------|
| Payload | AES-256-GCM con **DEK aleatoria** de 32 bytes (`dek:iv:tag:ciphertext`) |
| Wrap de DEK | AES-256-GCM + PBKDF2 sobre `ENCRYPTION_KEY` (o `ENCRYPTION_KEY_NEXT` si está definida) |
| AAD payload | `credential:<id>:<type>:<version>` |
| AAD DEK | `dek:<id>:<version>` |
| Legado | versiones sin `wrapped_dek` se abren con `lib.decrypt` directo |
| Autenticación | Tag GCM (integridad + autenticidad) |
| Generador | `crypto.randomInt`, sin `Math.random` |

### Qué no se filtra

- GET y list **no** devuelven ciphertext, `wrappedDek` ni plaintext
- Reveal/verify de una versión vencida o quemada: **410** sin `payload`
- Reveal es POST: la credencial no queda en la URL
- No hay `?decrypt=true`
- `X-Powered-By` deshabilitado; `X-Content-Type-Options: nosniff`; `X-Frame-Options: DENY`
- Body JSON limitado a 32 KB

### Cuentas y tokens

| Pieza | Detalle |
|-------|---------|
| Contraseña de usuario | scrypt, N=16384, r=8, p=1, salt de 16 bytes |
| JWT | HS256, `jti` UUID, `JWT_SECRET` independiente |
| Logout | `revoked_tokens` guarda el `jti` hasta `exp` |
| Comparación | `timingSafeEqual` en firma y en hash |
| Aislamiento | `credentials.user_id` y `audit_events.user_id` |

### Rotación de `ENCRYPTION_KEY`

El payload nunca se re-cifra. Solo se vuelve a envolver la DEK (`wrapped_dek`).

1. Generá una clave nueva (≥ 32 caracteres) y definí `ENCRYPTION_KEY_NEXT` en `.env`
2. Reiniciá el servidor (queda aceptando ambas KEK; los `seal` nuevos ya usan NEXT)
3. `npm run rewrap-keys` — reescribe `wrapped_dek` con la clave nueva
4. Copiá `ENCRYPTION_KEY_NEXT` sobre `ENCRYPTION_KEY`, borré `NEXT`, reiniciá

Versiones legado (sin `wrapped_dek`) no se reenvuelven: rotá esas credenciales primero para pasarlas a envelope. `open` prueba `ENCRYPTION_KEY` y, si está, `ENCRYPTION_KEY_NEXT`.

### Recomendaciones

1. **Claves**: `ENCRYPTION_KEY` y `JWT_SECRET` ≥ 32 caracteres, **distintos**, nunca en el código
2. **`.env`**: fuera de git
3. **HTTPS** en cualquier red que no sea loopback
4. **Cuentas**: no reutilices `demo@bgvault.local` fuera de desarrollo
5. **Producción**: rotá `JWT_SECRET` si se filtra (invalida todas las sesiones); rotá `ENCRYPTION_KEY` con el flujo de `ENCRYPTION_KEY_NEXT`

## ⚠️ Limitaciones

- **Sin refresh token**: el access token se revoca con logout (`jti`) o al vencer `exp`. No hay familia de refresh ni rotación de sesión
- **Sin roles/admin**: todos los usuarios son dueños de su vault; no hay sharing. El re-wrap es un CLI de operador, no un endpoint de usuario
- **SQLite local**: un proceso, un archivo; no está pensado para un clúster
- Pensado como vault profesional de desarrollo y base de un producto, no como HSM de producción

## 🛠️ Desarrollo

### Requisitos

- Node.js **22.13+** (usa `node:sqlite`; recomendado 22 o 24/26)
- npm
- Postman (para la collection) o Bash/Git Bash (para `client.sh`)
- `npm test` no necesita servidor aparte: levanta la app en un puerto efímero con SQLite `:memory:`

### Módulos nativos utilizados

- `node:crypto` — AES-GCM, scrypt, HMAC-SHA256, UUID, `timingSafeEqual`, generación de claves
- `node:sqlite` — persistencia, versiones y auditoría
- `node:fs` / `node:path` — `.env`, setup y directorio `data/`
- `node:readline` — reservado para flujos interactivos de setup

## 📄 Licencia

ISC

## 👤 Autor

Proyecto BGVault: gestión de credenciales con criptografía nativa de Node.js.

---

**Nota**: este proyecto no usa librerías externas de criptografía (`bcrypt`, `crypto-js`, etc.). Todo el cifrado pasa por `node:crypto`.

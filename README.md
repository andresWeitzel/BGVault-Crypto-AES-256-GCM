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
- ✅ **Versionado y rotación**: cada cambio de payload crea una versión nueva; la anterior sigue revelable
- ✅ **Auditoría**: generate, create, get, reveal, verify, rotate, delete y versions quedan en `audit_events` (sin plaintext)
- ✅ **IDs UUID**: se abandonó el `index` numérico; cada credencial tiene identidad estable
- ✅ **Metadatos en claro, payload cifrado**: `name`, `service` y `tags` se pueden filtrar; la clave/contraseña no aparece en GET
- ✅ **Autenticación JWT**: `POST /api/auth/register` y `/login` emiten un Bearer HS256 (HMAC nativo); el hash de la cuenta es **scrypt**, no bcrypt
- ✅ **Aislamiento por usuario**: cada credencial y cada evento de auditoría pertenece a un `user_id`; un JWT ajeno recibe 404, no 403
- ✅ **Reveal por POST**: nada de `?decrypt=true` en la URL (evita logs de proxies y browsers)
- ✅ **Sin clave por defecto**: el servidor no arranca con `default-key-change-me…`; exige `ENCRYPTION_KEY` y `JWT_SECRET` (≥ 32 caracteres)
- ✅ **Collection de Postman**: casos de éxito (201/200) y error (400/401/404/409) con scripts `pm.test` ejecutables desde el Runner
- ✅ **Módulo reutilizable**: `src/crypto/lib.js` se copia a otros proyectos Node sin dependencias extra
- ✅ **Setup de entorno**: `npm run setup-env` genera o completa `.env`

El almacén es un archivo SQLite (`data/bgvault.sqlite`). Las cuentas viven en la tabla `users`. Versiones antiguas sin `wrapped_dek` se siguen revelando con el cifrado directo (legado).

TTL / reveal de un solo uso y rotación de `ENCRYPTION_KEY` (re-wrap de DEKs) quedan para más adelante.

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
| `JWT_SECRET` | Firma HMAC-SHA256 de los tokens (distinta de `ENCRYPTION_KEY`) |
| `JWT_EXPIRES_IN` | Segundos de vida del JWT (por defecto `28800` = 8 h; min 60, máx 7 días) |
| `SQLITE_PATH` | Ruta del archivo SQLite (por defecto `data/bgvault.sqlite`) |

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
Auth: JWT Bearer (POST /api/auth/register o /api/auth/login)
```

### Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run setup-env` | Genera o completa `.env` (`ENCRYPTION_KEY`, `JWT_SECRET`) |
| `npm run server` | Inicia el vault Express |
| `npm run client:post` | Registra/loguea `demo@bgvault.local` y crea una credencial `password` |
| `npm run client:get` | Lista credenciales del usuario demo (solo metadatos) |
| `npm run decrypt-env` | Muestra variables `*_ENCRYPTED` del `.env`, si existen |

## 🔑 Autenticación

`GET /health` es público. `POST /api/auth/register` y `POST /api/auth/login` también (emiten el token).

Todas las rutas `/api/credentials*`, `/api/audit*`, `POST /api/generate` y `GET /api/auth/me` exigen:

```
Authorization: Bearer <accessToken>
```

Sin header, con un token inválido, expirado o de un usuario borrado: **401** `No autorizado`.

El JWT es **HS256** firmado con `JWT_SECRET` (`node:crypto.createHmac`). La contraseña de la cuenta se guarda con **scrypt** (`N=16384, r=8, p=1`); nunca viaja de vuelta en JSON. Un login fallido responde siempre `Credenciales inválidas` (no dice si el email existe).

Un usuario **no ve** las credenciales de otro: list, get, reveal, rotate y audit filtran por `user_id`. Si el id existe pero es de otro dueño, la API responde **404** (no 403), para no filtrar existencia.

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
| 400 | Falta email/password, email inválido, password corto |
| 409 | `Email ya registrado` |

---

### 3. Iniciar sesión

**POST** `/api/auth/login`  
**Auth:** no  
**Status:** `200`

Mismo body que register. Respuesta idéntica salvo `message`: `"Sesión iniciada"`.

**Errores:** `400` si faltan campos; `401` `Credenciales inválidas` si el email no existe o la contraseña no coincide.

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

### 5. Generar secreto

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
  "value": "k7#mP9qR2wX!",
  "options": {
    "uppercase": true,
    "lowercase": true,
    "digits": true,
    "symbols": true,
    "excludeAmbiguous": true
  },
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

Garantiza al menos un carácter de cada juego activo. **400** si `kind` es inválido, `length` sale de rango o todos los juegos están en `false`.

---

### 6. Crear credencial

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

**Parámetros:**

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `type` | sí | `password` \| `api_key` \| `token` \| `note` |
| `name` | sí | Nombre visible (metadato en claro) |
| `service` | no | Servicio o producto asociado |
| `tags` | no | Array de strings |
| `payload` | sí | Objeto sensible (se cifra entero) |

**`payload` según `type`:**

| type | Campo requerido | Campos opcionales |
|------|-----------------|-------------------|
| `password` | `payload.password` | `payload.username` |
| `api_key` | `payload.key` | — |
| `token` | `payload.token` | `payload.expiresAt`, etc. |
| `note` | `payload.text` | — |

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
| 400 | `type` inválido, falta `name`, `payload` incompleto, `tags` mal formados |
| 401 | Sin JWT, token inválido o expirado |

```json
{
  "error": "name es requerido",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

---

### 7. Listar credenciales

Devuelve solo metadatos. Se puede filtrar.

**GET** `/api/credentials`  
**GET** `/api/credentials?type=password`  
**GET** `/api/credentials?service=Gmail`  
**Auth:** requerida

**Query:**

| Param | Descripción |
|-------|-------------|
| `type` | Filtra por tipo |
| `service` | Filtra por servicio (match exacto) |

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
      "createdAt": "2026-08-16T01:35:56.264Z",
      "updatedAt": "2026-08-16T01:35:56.264Z"
    }
  ],
  "count": 1,
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

Otros tipos de ejemplo para crear:

```json
{
  "type": "api_key",
  "name": "Stripe live",
  "service": "Stripe",
  "payload": { "key": "sk_live_..." }
}
```

```json
{
  "type": "token",
  "name": "GitHub PAT",
  "service": "GitHub",
  "payload": { "token": "ghp_..." }
}
```

```json
{
  "type": "note",
  "name": "WiFi oficina",
  "payload": { "text": "SSID: HQ / clave: …" }
}
```

---

### 8. Obtener metadatos por id

**GET** `/api/credentials/:id`  
**Auth:** requerida

**Respuesta 200:** mismo objeto `credential` (sin payload).

**Respuesta 404:**
```json
{
  "error": "Credencial no encontrada",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

---

### 9. Revelar credencial (POST)

Desencripta el payload y lo devuelve. Es **POST** a propósito: el valor no queda en access logs de query string.

**POST** `/api/credentials/:id/reveal`  
**Auth:** requerida  
Body: no hace falta.

**Respuesta 200:**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "type": "password",
  "name": "Gmail personal",
  "service": "Gmail",
  "payload": {
    "password": "miContraseña123",
    "username": "usuario@example.com"
  },
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

**404** si el id no existe **o pertenece a otro usuario**. **401** sin JWT.

---

### 10. Verificar una contraseña

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

`username` es opcional: si lo mandás, también se verifica.

**Respuesta 200 (válida):**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
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
| 400 | El registro no es `password`, o falta `password` en el body |
| 401 | Sin JWT |
| 404 | Id inexistente |

---

### 11. Eliminar credencial

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

### 12. Rotar credencial (nueva versión)

Cifra un payload nuevo, incrementa `currentVersion` y **conserva** las versiones anteriores. El tipo no cambia.

**POST** `/api/credentials/:id/rotate`  
**Auth:** requerida

**Body:**
```json
{
  "payload": {
    "password": "nuevaContraseña456!",
    "username": "usuario@example.com"
  }
}
```

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
    "createdAt": "2026-08-16T01:35:56.264Z",
    "updatedAt": "2026-08-16T01:40:00.000Z"
  },
  "timestamp": "2026-08-16T01:40:00.000Z"
}
```

**400** si `payload` no cumple el tipo. **404** si el id no existe.

---

### 13. Listar versiones

Devuelve el historial **sin** ciphertext ni plaintext.

**GET** `/api/credentials/:id/versions`  
**Auth:** requerida

**Respuesta 200:**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "currentVersion": 2,
  "versions": [
    { "version": 1, "createdAt": "2026-08-16T01:35:56.264Z" },
    { "version": 2, "createdAt": "2026-08-16T01:40:00.000Z" }
  ],
  "timestamp": "2026-08-16T01:40:00.000Z"
}
```

---

### 14. Revelar una versión concreta

El reveal usa la versión actual si no mandás `version`. El número de versión va en el **body**, no en la URL.

**POST** `/api/credentials/:id/reveal`

```json
{
  "version": 1
}
```

**Respuesta 200:** incluye `version`, `currentVersion` y `payload`.  
**404** `Versión no encontrada` si ese número no existe.

Verify también acepta `"version": 1` opcional (por defecto, la actual).

---

### 15. Auditoría

Lista eventos de register, login, generate, create, get, reveal, verify, rotate, delete y versions **del usuario autenticado**. **Nunca** guarda plaintext, ciphertext ni DEKs.

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
| 200 | Login, me, generate, listar, get, versions, reveal, verify, rotate, delete, audit |
| 201 | Usuario o credencial creados |
| 400 | Validación (email, password de cuenta, tipo, name, payload, verify sobre no-password) |
| 401 | JWT ausente, inválido, expirado; o login con credenciales incorrectas |
| 404 | Credencial ajena, inexistente, o ruta inexistente |
| 409 | Email ya registrado |

## 🧪 Collection de Postman

La collection **Crypto AES-256-GCM Vault** cubre el contrato: Health, Auth (401 / register / login / me), Generate, Create de los 4 tipos, validaciones 400, aislamiento entre usuarios (404 a credencial ajena), listado sin plaintext, reveal, verify, rotación, historial, auditoría y delete.

Archivo: `collections/bgvault.postman_collection.json`  
El `_postman_id` se mantiene fijo para que reimportar **actualice** la collection y no abra otra.

### Cómo ejecutarla

1. `npm run setup-env` y `npm run server`
2. En Postman: **Import** → `collections/bgvault.postman_collection.json` (si ya existe, **Replace**)
3. **Runner** → **Run collection** (en orden). Auth registra `demo@bgvault.local` (o hace login si ya existe) y guarda `accessToken`
4. Guardá (Ctrl+S) si Postman te pide persistir variables

La collection envía `Authorization: Bearer {{accessToken}}` en vault y me. Health, register, login y los 401 van con `noauth`.

Los tests comprueban status, que GET/list no filtren `payload` ni ciphertext, que un segundo usuario no vea credenciales ajenas, y que reveal/verify desencripten el valor esperado.

Si el Runner dice **Environment: none**, está bien: el token se guarda en **variables de la collection**.

## 📝 Ejemplos de uso

### Ejemplo 1: curl

```bash
export BASE="http://localhost:3000"

# Salud
curl -s "$BASE/health"

# Registrar (o login si el email ya existe)
curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@bgvault.local","password":"bgvault-dev-password"}'

TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@bgvault.local","password":"bgvault-dev-password"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

AUTH="Authorization: Bearer $TOKEN"

# Generar password
curl -s -X POST "$BASE/api/generate" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"kind":"password","length":24}'

# Perfil
curl -s "$BASE/api/auth/me" -H "$AUTH"

# Crear API key
curl -s -X POST "$BASE/api/credentials" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{
    "type": "api_key",
    "name": "Stripe live",
    "service": "Stripe",
    "payload": { "key": "sk_live_demo" }
  }'

# Listar (sin plaintext)
curl -s "$BASE/api/credentials" -H "$AUTH"

# Filtrar
curl -s "$BASE/api/credentials?type=password" -H "$AUTH"

# Revelar (reemplazá el id)
curl -s -X POST "$BASE/api/credentials/<id>/reveal" \
  -H "$AUTH"

# Verificar password
curl -s -X POST "$BASE/api/credentials/<id>/verify" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{ "password": "miContraseña123" }'

# Rotar
curl -s -X POST "$BASE/api/credentials/<id>/rotate" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{ "payload": { "password": "nueva", "username": "usuario@example.com" } }'

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
```

### Ejemplo 2: scripts npm

```bash
npm run setup-env
npm run server          # en otra terminal
npm run client:post     # crea una credencial password de demo
npm run client:get      # lista metadatos
npm run decrypt-env     # solo si hay *_ENCRYPTED en .env
```

## 📁 Estructura del proyecto

```
bgvault/
├── src/
│   ├── config/
│   │   └── env.js                   # Carga .env y valida ENCRYPTION_KEY / JWT_SECRET
│   ├── auth/
│   │   ├── password.js              # scrypt (hash / verify)
│   │   └── jwt.js                   # JWT HS256 nativo
│   ├── middleware/
│   │   └── requireAuth.js           # Bearer JWT + carga del usuario
│   ├── db/
│   │   └── sqlite.js                # node:sqlite, schema, WAL, migrate user_id / wrapped_dek
│   ├── store/
│   │   ├── usersStore.js            # Cuentas
│   │   ├── credentialsStore.js      # Credenciales + versiones (scoped)
│   │   └── auditStore.js            # Audit log (scoped)
│   ├── controllers/
│   │   ├── authController.js        # register, login, me
│   │   ├── generateController.js    # POST /api/generate
│   │   ├── credentialController.js  # CRUD, reveal, verify, rotate, versions
│   │   └── auditController.js
│   ├── crypto/
│   │   ├── lib.js                   # encrypt / decrypt AES-256-GCM + AAD (wrap de DEK)
│   │   ├── envelope.js              # seal / open con DEK por versión
│   │   ├── generate.js              # CSPRNG passwords / api_key / token
│   │   └── crypto-cli.js            # CLI: cifrar / descifrar un valor
│   ├── routes/
│   │   ├── authRoutes.js            # /api/auth
│   │   ├── generateRoutes.js        # /api/generate
│   │   ├── credentialRoutes.js      # /api/credentials
│   │   └── auditRoutes.js           # /api/audit
│   ├── server.js                    # Express, headers, 404/JSON inválido
│   └── setup/
│       ├── setup-env.js             # Genera o completa .env
│       └── decrypt-env.js           # Muestra *_ENCRYPTED
├── data/
│   └── .gitkeep                     # bgvault.sqlite (gitignored)
├── collections/
│   └── bgvault.postman_collection.json
├── scripts/
│   └── client/
│       └── client.sh                # Cliente bash (post / get)
├── .env.example
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
| Wrap de DEK | AES-256-GCM + PBKDF2 sobre `ENCRYPTION_KEY` (`salt:iv:tag:encrypted`) |
| AAD payload | `credential:<id>:<type>:<version>` |
| AAD DEK | `dek:<id>:<version>` |
| Legado | versiones sin `wrapped_dek` se abren con `lib.decrypt` directo |
| Autenticación | Tag GCM (integridad + autenticidad) |
| Generador | `crypto.randomInt`, sin `Math.random` |

### Qué no se filtra

- GET y list **no** devuelven ciphertext, `wrappedDek` ni plaintext
- Reveal es POST: la credencial no queda en la URL
- No hay `?decrypt=true`
- `X-Powered-By` deshabilitado; `X-Content-Type-Options: nosniff`; `X-Frame-Options: DENY`
- Body JSON limitado a 32 KB

### Cuentas y tokens

| Pieza | Detalle |
|-------|---------|
| Contraseña de usuario | scrypt, N=16384, r=8, p=1, salt de 16 bytes |
| JWT | HS256, HMAC-SHA256, `JWT_SECRET` independiente |
| Comparación | `timingSafeEqual` en firma y en hash |
| Aislamiento | `credentials.user_id` y `audit_events.user_id` |

### Recomendaciones

1. **Claves**: `ENCRYPTION_KEY` y `JWT_SECRET` ≥ 32 caracteres, **distintos**, nunca en el código
2. **`.env`**: fuera de git
3. **HTTPS** en cualquier red que no sea loopback
4. **Cuentas**: no reutilices `demo@bgvault.local` fuera de desarrollo
5. **Producción**: rotá `JWT_SECRET` si se filtra (invalida todas las sesiones)

## ⚠️ Limitaciones

- **JWT sin refresh/revocación**: el token vale hasta `exp`; borrar el usuario invalida `me` y el vault en el acto, pero un JWT ya emitido sigue verificándose hasta que el `sub` desaparece
- **Sin roles/admin**: todos los usuarios son dueños de su vault; no hay sharing
- **Sin re-wrap de DEK**: cambiar `ENCRYPTION_KEY` no rota las DEKs ya envueltas; las versiones nuevas usan la clave actual
- **SQLite local**: un proceso, un archivo; no está pensado para un clúster
- Pensado como vault profesional de desarrollo y base de un producto, no como HSM de producción

## 🛠️ Desarrollo

### Requisitos

- Node.js **22.13+** (usa `node:sqlite`; recomendado 22 o 24/26)
- npm
- Postman (para la collection) o Bash/Git Bash (para `client.sh`)

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

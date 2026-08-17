# 🔐 BGVault — Sistema de Gestión de Credenciales Encriptadas (AES-256-GCM)

Vault REST para almacenar de forma segura **contraseñas, API keys, tokens y notas**. Cada credencial se cifra con **AES-256-GCM** antes de persistirse; los listados y el GET por id solo devuelven metadatos. El texto plano nunca viaja en query string: sale únicamente por `POST /reveal` con autenticación.

Desarrollado con Node.js y Express, usando **solo `node:crypto`** para criptografía (sin `bcrypt`, `crypto-js` ni KMS externos).

## 📋 Características

- ✅ **Vault de credenciales**: no es un encriptador suelto — es una API para crear, listar, revelar, verificar y eliminar credenciales
- ✅ **Cuatro tipos**: `password`, `api_key`, `token` y `note`, cada uno con payload validado
- ✅ **AES-256-GCM**: cifrado autenticado; el tag GCM detecta manipulación del ciphertext
- ✅ **AAD ligado a la credencial**: Additional Authenticated Data `credential:<id>:<type>` — un blob no se puede reubicar en otro id o tipo
- ✅ **IV de 12 bytes (NIST)** y salt de 64 bytes únicos por cada cifrado
- ✅ **PBKDF2**: 100.000 iteraciones con SHA-256 para derivar la clave AES-256
- ✅ **IDs UUID**: se abandonó el `index` numérico; cada credencial tiene identidad estable
- ✅ **Metadatos en claro, payload cifrado**: `name`, `service` y `tags` se pueden filtrar; la clave/contraseña no aparece en GET
- ✅ **Reveal por POST**: nada de `?decrypt=true` en la URL (evita logs de proxies y browsers)
- ✅ **Autenticación de servicio**: header `X-API-Key` o `Authorization: Bearer`, comparado con `timingSafeEqual`
- ✅ **Sin clave por defecto**: el servidor no arranca con `default-key-change-me…`; exige `ENCRYPTION_KEY` (≥ 32 caracteres) y `API_KEY`
- ✅ **Collection de Postman**: casos de éxito (201/200) y error (400/401/404) con scripts `pm.test` ejecutables desde el Runner
- ✅ **Módulo reutilizable**: `src/crypto/lib.js` se copia a otros proyectos Node sin dependencias extra
- ✅ **Setup de entorno**: `npm run setup-env` genera o completa `.env`

El almacén actual es **en memoria** (las credenciales se pierden al reiniciar). Persistencia y usuarios multi-tenant son la siguiente fase.

## 🛠️ Tecnologías

- **Node.js**: runtime (18+ recomendado)
- **Express**: API HTTP
- **node:crypto**: único motor criptográfico
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
| `API_KEY` | Clave de acceso a `/api/credentials*` |

En desarrollo local la API key de la collection es `bgvault-dev-api-key-local` (la misma que espera Postman). En producción usá valores distintos y largos.

**⚠️ IMPORTANTE**: no subas `.env` al repositorio (está en `.gitignore`).

## ⚙️ Configuración

### Archivo `.env`

Podés crearlo de tres formas:

#### Opción 1: Setup (recomendado)

```bash
npm run setup-env
```

Si faltan claves, genera `ENCRYPTION_KEY` (32 bytes en hex) y completa `API_KEY`. Si ya existen, las conserva.

#### Opción 2: Copiar el ejemplo

```bash
cp .env.example .env
```

Completá `ENCRYPTION_KEY` (mínimo 32 caracteres) y, si hace falta, `API_KEY`.

#### Opción 3: Variables de entorno del sistema

```bash
export ENCRYPTION_KEY="tu-clave-segura-de-32-caracteres-minimo"
export API_KEY="tu-api-key-de-servicio"
export PORT=3000
```

El servidor carga `.env` al arrancar, pero **no pisa** variables ya definidas en el proceso.

### Clave de encriptación

No hay clave hardcodeada. Si `ENCRYPTION_KEY` falta, mide menos de 32 caracteres o es la antigua clave insegura de demo, el proceso **termina con error** y pide `npm run setup-env`.

## 🚀 Uso

### Iniciar el servidor

```bash
npm run server
```

El vault queda en `http://localhost:3000` (o el `PORT` configurado). En consola:

```
BGVault corriendo en http://localhost:3000
Auth: header X-API-Key o Authorization: Bearer
```

### Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run setup-env` | Genera o completa `.env` (`ENCRYPTION_KEY`, `API_KEY`) |
| `npm run server` | Inicia el vault Express |
| `npm run client:post` | Crea una credencial `password` de demo (requiere `API_KEY`) |
| `npm run client:get` | Lista credenciales (solo metadatos) |
| `npm run decrypt-env` | Muestra variables `*_ENCRYPTED` del `.env`, si existen |

## 🔑 Autenticación

`GET /health` es público.

Todas las rutas `/api/credentials*` exigen API key. Sin ella o con una inválida: **401**.

```
X-API-Key: bgvault-dev-api-key-local
```

o:

```
Authorization: Bearer bgvault-dev-api-key-local
```

La comparación usa `crypto.timingSafeEqual` para no filtrar la key por timing.

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
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

---

### 2. Crear credencial

Cifra el `payload` con AES-256-GCM (AAD = `credential:<id>:<type>`) y guarda el registro.

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
| 401 | Sin API key o key inválida |

```json
{
  "error": "name es requerido",
  "timestamp": "2026-08-16T01:35:56.264Z"
}
```

---

### 3. Listar credenciales

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

### 4. Obtener metadatos por id

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

### 5. Revelar credencial (POST)

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

**404** si el id no existe. **401** sin API key.

---

### 6. Verificar una contraseña

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
| 401 | Sin API key |
| 404 | Id inexistente |

---

### 7. Eliminar credencial

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

### Códigos HTTP (resumen)

| Código | Significado |
|--------|-------------|
| 200 | Listar, get, reveal, verify, delete |
| 201 | Credencial creada |
| 400 | Validación (tipo, name, payload, verify sobre no-password) |
| 401 | Falta o no coincide `API_KEY` |
| 404 | Credencial o ruta inexistente |

## 🧪 Collection de Postman

La collection **Crypto AES-256-GCM Vault** cubre el contrato completo: Health, Auth (401), Create de los 4 tipos, validaciones 400, listado sin plaintext, reveal, verify y delete.

Archivo: `collections/bgvault.postman_collection.json`  
El `_postman_id` se mantiene fijo para que reimportar **actualice** la collection y no abra otra.

### Cómo ejecutarla

1. `npm run setup-env` y `npm run server`
2. En Postman: **Import** → `collections/bgvault.postman_collection.json` (si ya existe, **Replace**)
3. Click en la collection → pestaña **Variables** → `apiKey` (**Current value**) = `bgvault-dev-api-key-local`
4. Guardá (Ctrl+S)
5. **Runner** → **Run collection** (en orden)

La collection envía `X-API-Key: {{apiKey}}` en todo excepto Health y los casos 401 (a propósito, para afirmar el 401).

Los tests comprueban status, que GET/list no filtren `payload` ni ciphertext, formato de cifrado cuando aplica, y que reveal/verify desencripten el valor esperado.

Si el Runner dice **Environment: none**, está bien: la key vive en **variables de la collection**, no en un environment aparte.

## 📝 Ejemplos de uso

### Ejemplo 1: curl

```bash
export API_KEY="bgvault-dev-api-key-local"
export BASE="http://localhost:3000"

# Salud
curl -s "$BASE/health"

# Crear API key
curl -s -X POST "$BASE/api/credentials" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "type": "api_key",
    "name": "Stripe live",
    "service": "Stripe",
    "payload": { "key": "sk_live_demo" }
  }'

# Listar (sin plaintext)
curl -s "$BASE/api/credentials" -H "X-API-Key: $API_KEY"

# Filtrar
curl -s "$BASE/api/credentials?type=password" -H "X-API-Key: $API_KEY"

# Revelar (reemplazá el id)
curl -s -X POST "$BASE/api/credentials/<id>/reveal" \
  -H "X-API-Key: $API_KEY"

# Verificar password
curl -s -X POST "$BASE/api/credentials/<id>/verify" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{ "password": "miContraseña123" }'

# Eliminar
curl -s -X DELETE "$BASE/api/credentials/<id>" \
  -H "X-API-Key: $API_KEY"
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
│   │   └── env.js                   # Carga .env y valida ENCRYPTION_KEY / API_KEY
│   ├── middleware/
│   │   └── requireApiKey.js         # Auth X-API-Key / Bearer + timingSafeEqual
│   ├── store/
│   │   └── credentialsStore.js      # Almacén in-memory (Map por UUID)
│   ├── controllers/
│   │   └── credentialController.js  # Create, list, get, reveal, verify, delete
│   ├── crypto/
│   │   ├── lib.js                   # encrypt / decrypt AES-256-GCM + AAD
│   │   └── crypto-cli.js            # CLI: cifrar / descifrar un valor
│   ├── routes/
│   │   └── credentialRoutes.js      # /api/credentials
│   ├── server.js                    # Express, headers, 404/JSON inválido
│   └── setup/
│       ├── setup-env.js             # Genera o completa .env
│       └── decrypt-env.js           # Muestra *_ENCRYPTED
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

- **`src/crypto/lib.js`** — `encrypt(text, key, aad)` y `decrypt(blob, key, aad)`

### Dependencias

**Ninguna dependency de npm.** Solo `node:crypto`.

### Uso

```javascript
const { encrypt, decrypt } = require('./src/crypto/lib');

const clave = process.env.ENCRYPTION_KEY;
const aad = 'credential:<id>:password';

const cifrado = encrypt('mi contraseña', clave, aad);
const plano = decrypt(cifrado, clave, aad);
```

- Si no pasás `key`, usa `process.env.ENCRYPTION_KEY`.
- `aad` es opcional, pero **el mismo valor** tiene que usarse al cifrar y al descifrar.
- El vault ata AAD a `credential:<uuid>:<type>`.

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
| Algoritmo | AES-256-GCM |
| Derivación | PBKDF2, 100.000 iteraciones, SHA-256 |
| Salt | 64 bytes aleatorios / mensaje |
| IV | 12 bytes aleatorios / mensaje |
| AAD | `credential:<id>:<type>` en el vault |
| Autenticación | Tag GCM (integridad + autenticidad) |

### Qué no se filtra

- GET y list **no** devuelven ciphertext ni plaintext
- Reveal es POST: la credencial no queda en la URL
- No hay `?decrypt=true`
- `X-Powered-By` deshabilitado; `X-Content-Type-Options: nosniff`; `X-Frame-Options: DENY`
- Body JSON limitado a 32 KB

### Recomendaciones

1. **Claves**: `ENCRYPTION_KEY` ≥ 32 caracteres; nunca en el código
2. **`.env`**: fuera de git
3. **HTTPS** en cualquier red que no sea loopback
4. **API_KEY** distinta por entorno; rotarla si se filtra
5. **Producción**: no uses `bgvault-dev-api-key-local`

## ⚠️ Limitaciones

- **Memoria**: las credenciales se pierden al reiniciar el proceso
- **Un solo `API_KEY`**: no hay usuarios, roles ni tenants todavía
- **Sin rotación / versionado** de credenciales ni envelope encryption con KMS
- **Sin persistencia** (SQLite/Postgres es la siguiente fase)
- Pensado como vault de desarrollo y base de un producto, no como caja fuerte de producción cerrada

## 🛠️ Desarrollo

### Requisitos

- Node.js 18+ (recomendado)
- npm
- Postman (para la collection) o Bash/Git Bash (para `client.sh`)

### Módulos nativos utilizados

- `node:crypto` — cifrado, UUID, `timingSafeEqual`, generación de claves
- `node:fs` / `node:path` — `.env` y setup
- `node:readline` — reservado para flujos interactivos de setup

## 📄 Licencia

ISC

## 👤 Autor

Proyecto BGVault: gestión de credenciales con criptografía nativa de Node.js.

---

**Nota**: este proyecto no usa librerías externas de criptografía (`bcrypt`, `crypto-js`, etc.). Todo el cifrado pasa por `node:crypto`.

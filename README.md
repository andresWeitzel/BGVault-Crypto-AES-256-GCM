# 🔐 Sistema de Gestión de Contraseñas Encriptadas

Sistema de gestión de contraseñas que utiliza encriptación AES-256-GCM para almacenar de forma segura contraseñas, usuarios y servicios. Desarrollado con Node.js y Express, utilizando únicamente módulos nativos de Node.js para todas las operaciones criptográficas.

## 📋 Características

- ✅ **Encriptación AES-256-GCM**: Todas las contraseñas se encriptan antes de almacenarse
- ✅ **Almacenamiento en memoria**: Los datos se almacenan en memoria durante la ejecución del servidor
- ✅ **API RESTful**: Endpoints para almacenar, obtener y verificar contraseñas
- ✅ **Scripts de cliente**: Scripts bash para interactuar con la API
- ✅ **Configuración interactiva**: Setup interactivo para crear archivos `.env` con valores encriptados
- ✅ **Solo módulos nativos**: Usa únicamente `node:crypto` de Node.js, sin dependencias externas de criptografía

## 🛠️ Tecnologías

- **Node.js**: Runtime de JavaScript
- **Express**: Framework web para Node.js
- **node:crypto**: Módulo nativo de Node.js para operaciones criptográficas
- **AES-256-GCM**: Algoritmo de encriptación simétrica con autenticación

## 📦 Instalación

1. Clonar el repositorio o descargar el proyecto
2. Instalar dependencias:

```bash
npm install
```

## ⚙️ Configuración

### Configurar archivo .env

El proyecto requiere un archivo `.env` en la raíz con valores encriptados. Puedes crearlo de dos formas:

#### Opción 1: Setup interactivo (Recomendado)

```bash
npm run setup-env
```

Este comando te pedirá:
- Contraseña a encriptar (requerida)
- Usuario (opcional)
- Servicio (opcional)

Y creará automáticamente el archivo `.env` con los valores encriptados.

#### Opción 2: El script de cliente lo crea automáticamente

Si ejecutas `npm run client:post` sin tener un archivo `.env`, el script te pedirá los valores interactivamente y creará el archivo automáticamente.

### Clave de encriptación

Por defecto, el proyecto usa la clave: `default-key-change-me-in-production-32chars!!`

**⚠️ IMPORTANTE**: En producción, configura la variable de entorno `ENCRYPTION_KEY` con una clave segura:

```bash
export ENCRYPTION_KEY="tu-clave-segura-de-32-caracteres-minimo"
```

## 🚀 Uso

### Iniciar el servidor

```bash
npm run server
```

El servidor se iniciará en `http://localhost:3000` (o el puerto especificado en `PORT`).

### Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run server` | Inicia el servidor Express |
| `npm run client:post` | Envía una contraseña al servidor usando valores del `.env` |
| `npm run client:get` | Obtiene todas las contraseñas almacenadas |
| `npm run setup-env` | Configura el archivo `.env` con valores encriptados |
| `npm run decrypt-env` | Muestra los valores desencriptados del archivo `.env` |

## 📡 API Endpoints

### Base URL
```
http://localhost:3000
```

### 1. Health Check

Verifica el estado del servidor.

**GET** `/health`

**Respuesta:**
```json
{
  "status": "OK",
  "timestamp": "2026-01-16T13:35:56.264Z"
}
```

### 2. Almacenar Contraseña

Almacena una nueva contraseña encriptada.

**POST** `/api/passwords`

**Body:**
```json
{
  "password": "miContraseña123",
  "username": "usuario@example.com",
  "service": "Gmail"
}
```

**Parámetros:**
- `password` (requerido): Contraseña a almacenar
- `username` (opcional): Nombre de usuario o email
- `service` (opcional): Nombre del servicio

**Respuesta exitosa (200):**
```json
{
  "message": "Contraseña almacenada correctamente (encriptada con AES-256-GCM)",
  "count": 1,
  "timestamp": "2026-01-16T13:35:56.264Z"
}
```

**Respuesta de error (400):**
```json
{
  "error": "La contraseña es requerida",
  "timestamp": "2026-01-16T13:35:56.264Z"
}
```

### 3. Obtener Contraseñas

Obtiene todas las contraseñas almacenadas (encriptadas).

**GET** `/api/passwords`

**Query Parameters:**
- `decrypt` (opcional): Si es `true`, desencripta y muestra los valores

**Ejemplo:**
```
GET /api/passwords
GET /api/passwords?decrypt=true
```

**Respuesta (sin desencriptar):**
```json
{
  "message": "Contraseñas almacenadas (encriptadas con AES-256-GCM)",
  "note": "Para ver valores desencriptados, agrega ?decrypt=true a la URL",
  "passwords": [
    {
      "index": 0,
      "passwordEncrypted": "salt:iv:tag:encrypted",
      "usernameEncrypted": "salt:iv:tag:encrypted",
      "serviceEncrypted": "salt:iv:tag:encrypted",
      "timestamp": "2026-01-16T13:35:56.264Z"
    }
  ],
  "count": 1,
  "timestamp": "2026-01-16T13:35:56.264Z"
}
```

**Respuesta (con decrypt=true):**
```json
{
  "message": "Contraseñas almacenadas (encriptadas con AES-256-GCM)",
  "note": "Valores desencriptados mostrados",
  "passwords": [
    {
      "index": 0,
      "passwordEncrypted": "salt:iv:tag:encrypted",
      "usernameEncrypted": "salt:iv:tag:encrypted",
      "serviceEncrypted": "salt:iv:tag:encrypted",
      "password": "miContraseña123",
      "username": "usuario@example.com",
      "service": "Gmail",
      "timestamp": "2026-01-16T13:35:56.264Z"
    }
  ],
  "count": 1,
  "timestamp": "2026-01-16T13:35:56.264Z"
}
```

### 4. Verificar Contraseña

Verifica si una contraseña coincide con una almacenada.

**POST** `/api/passwords/verify`

**Body:**
```json
{
  "password": "miContraseña123",
  "index": 0
}
```

**Parámetros:**
- `password` (requerido): Contraseña a verificar
- `index` (requerido): Índice de la contraseña almacenada

**Respuesta exitosa (200):**
```json
{
  "isValid": true,
  "message": "Contraseña válida",
  "index": 0,
  "timestamp": "2026-01-16T13:35:56.264Z"
}
```

**Respuesta de error (400):**
```json
{
  "error": "La contraseña y el índice son requeridos",
  "timestamp": "2026-01-16T13:35:56.264Z"
}
```

**Respuesta de error (404):**
```json
{
  "error": "Contraseña no encontrada en el índice especificado",
  "timestamp": "2026-01-16T13:35:56.264Z"
}
```

### 5. Verificar Todos los Campos

Verifica password, username y service de un registro.

**POST** `/api/passwords/verify-all`

**Body:**
```json
{
  "password": "miContraseña123",
  "username": "usuario@example.com",
  "service": "Gmail",
  "index": 0
}
```

**Parámetros:**
- `index` (requerido): Índice del registro a verificar
- `password` (opcional): Contraseña a verificar
- `username` (opcional): Usuario a verificar
- `service` (opcional): Servicio a verificar

**Respuesta exitosa (200):**
```json
{
  "index": 0,
  "verified": {
    "password": true,
    "username": true,
    "service": true
  },
  "allValid": true,
  "message": "Todos los valores coinciden",
  "timestamp": "2026-01-16T13:35:56.264Z"
}
```

## 📝 Ejemplos de Uso

### Ejemplo 1: Usando curl

```bash
# Almacenar una contraseña
curl -X POST http://localhost:3000/api/passwords \
  -H "Content-Type: application/json" \
  -d '{
    "password": "miContraseña123",
    "username": "usuario@example.com",
    "service": "Gmail"
  }'

# Obtener todas las contraseñas
curl http://localhost:3000/api/passwords

# Obtener contraseñas desencriptadas
curl "http://localhost:3000/api/passwords?decrypt=true"

# Verificar una contraseña
curl -X POST http://localhost:3000/api/passwords/verify \
  -H "Content-Type: application/json" \
  -d '{
    "password": "miContraseña123",
    "index": 0
  }'
```

### Ejemplo 2: Usando los scripts npm

```bash
# Configurar el archivo .env
npm run setup-env

# Enviar contraseña usando valores del .env
npm run client:post

# Obtener todas las contraseñas
npm run client:get

# Ver valores desencriptados del .env
npm run decrypt-env
```

## 📁 Estructura del Proyecto

```
crypto/
├── src/
│   ├── controllers/
│   │   └── passwordController.js    # Lógica de negocio para contraseñas
│   ├── crypto/
│   │   ├── lib.js                   # Módulo reutilizable de encriptación (AES-256-GCM)
│   │   └── crypto-cli.js            # CLI wrapper para encriptación/desencriptación
│   ├── routes/
│   │   └── passwordRoutes.js      # Definición de rutas de la API
│   ├── server.js                    # Servidor Express principal
│   └── setup/
│       ├── setup-env.js             # Script para configurar .env
│       └── decrypt-env.js           # Script para desencriptar .env
├── scripts/
│   └── client/
│       └── client.sh                # Script bash para cliente
├── package.json
└── README.md
```

## 🔄 Reutilización del Módulo de Encriptación

El módulo de encriptación ha sido diseñado para ser reutilizable en otros proyectos Node.js. La lógica de encriptación está separada en un módulo independiente que puedes copiar fácilmente.

### Archivo a copiar

Para reutilizar el módulo de encriptación en otro proyecto, solo necesitas copiar un archivo:

- **`src/crypto/lib.js`** - Módulo reutilizable con las funciones `encrypt()` y `decrypt()`

### Dependencias

**No requiere dependencias externas**. El módulo utiliza únicamente `node:crypto`, que es un módulo nativo de Node.js disponible en todas las versiones modernas.

### Instalación en otro proyecto

1. **Copia el archivo** `src/crypto/lib.js` a tu otro proyecto (puedes colocarlo en cualquier ubicación, por ejemplo: `src/utils/crypto-lib.js` o `lib/encrypt.js`)

2. **Importa el módulo** en tu código:

```javascript
const { encrypt, decrypt } = require('./src/crypto/lib'); // Ajusta la ruta según donde lo coloques
```

### Ejemplo de uso

```javascript
const { encrypt, decrypt } = require('./src/crypto/lib');

// Encriptar un texto
const textoPlano = 'mi secreto';
const textoCifrado = encrypt(textoPlano);
console.log('Texto cifrado:', textoCifrado);

// Desencriptar
const textoDesencriptado = decrypt(textoCifrado);
console.log('Texto desencriptado:', textoDesencriptado);

// Usar una clave personalizada
const clavePersonalizada = 'mi-clave-super-segura-de-32-caracteres-min';
const cifradoConClave = encrypt(textoPlano, clavePersonalizada);
const desencriptadoConClave = decrypt(cifradoConClave, clavePersonalizada);
```

### Configuración de clave

El módulo utiliza una clave por defecto si no se especifica una. Para usar una clave personalizada:

1. **Opción 1**: Pasar la clave como segundo parámetro:
   ```javascript
   encrypt(texto, 'mi-clave-personalizada');
   decrypt(textoCifrado, 'mi-clave-personalizada');
   ```

2. **Opción 2**: Configurar la variable de entorno `ENCRYPTION_KEY`:
   ```bash
   export ENCRYPTION_KEY="tu-clave-segura-de-32-caracteres-minimo"
   ```
   El módulo la detectará automáticamente.

### Características del módulo

- ✅ **AES-256-GCM**: Algoritmo de encriptación simétrica con autenticación
- ✅ **Derivación de clave**: PBKDF2 con 100,000 iteraciones
- ✅ **Salt único**: Cada encriptación genera un salt aleatorio de 64 bytes
- ✅ **IV único**: Cada encriptación genera un IV aleatorio de 16 bytes
- ✅ **Sin dependencias**: Solo usa módulos nativos de Node.js
- ✅ **Formato estándar**: Los datos encriptados usan formato `salt:iv:tag:encrypted` (todo en hex)

### Notas importantes

- El formato de datos encriptados es compatible entre proyectos que usen este módulo
- Asegúrate de usar la misma clave para encriptar y desencriptar
- En producción, siempre usa una clave segura de al menos 32 caracteres
- El módulo es completamente independiente y no requiere ninguna otra parte del proyecto

## 🔒 Seguridad

### Encriptación

- **Algoritmo**: AES-256-GCM (Advanced Encryption Standard con Galois/Counter Mode)
- **Derivación de clave**: PBKDF2 con 100,000 iteraciones y SHA-256
- **Salt**: 64 bytes aleatorios por cada encriptación
- **IV**: 16 bytes aleatorios por cada encriptación
- **Autenticación**: GCM proporciona autenticación integrada

### Formato de datos encriptados

Los datos encriptados se almacenan en formato:
```
salt:iv:tag:encrypted
```

Donde todos los componentes están en hexadecimal.

### Recomendaciones de seguridad

1. **Clave de encriptación**: Usa una clave segura de al menos 32 caracteres en producción
2. **Variable de entorno**: Configura `ENCRYPTION_KEY` como variable de entorno, nunca la hardcodees
3. **Archivo .env**: No subas el archivo `.env` al repositorio (debe estar en `.gitignore`)
4. **HTTPS**: En producción, usa HTTPS para todas las comunicaciones
5. **Almacenamiento**: Los datos se almacenan en memoria, se pierden al reiniciar el servidor

## ⚠️ Limitaciones

- **Almacenamiento en memoria**: Los datos se pierden al reiniciar el servidor
- **Sin persistencia**: No hay base de datos, todo se almacena en memoria
- **Sin autenticación**: La API no tiene autenticación/autorización
- **Desarrollo**: Este proyecto está diseñado para desarrollo/ejemplos, no para producción directa

## 🛠️ Desarrollo

### Requisitos

- Node.js 14+ (recomendado 18+)
- npm o yarn
- Bash (para scripts de cliente en Linux/Mac/Git Bash)

### Módulos nativos utilizados

- `node:crypto`: Para todas las operaciones criptográficas
- `node:fs`: Para lectura/escritura de archivos
- `node:path`: Para manejo de rutas
- `node:readline`: Para entrada interactiva

## 📄 Licencia

ISC

## 👤 Autor

Proyecto desarrollado para gestión segura de contraseñas.

---

**Nota**: Este proyecto utiliza únicamente módulos nativos de Node.js para criptografía, sin dependencias externas como `bcrypt` o `crypto-js`.


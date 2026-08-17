#!/bin/bash

# Script para enviar y obtener contraseñas del servidor
# Uso: ./client.sh post
#      ./client.sh get

SERVER_URL="http://localhost:3000"

# Cargar configuración desde archivo .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONFIG_FILE="${PROJECT_ROOT}/.env"

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para desencriptar valores usando Node.js
decrypt_value() {
    local encrypted_value="$1"
    local encryption_key="${2:-${ENCRYPTION_KEY:-default-key-change-me-in-production-32chars!!}}"
    
    if [ -z "$encrypted_value" ]; then
        return 1
    fi
    
    # Usar Node.js para desencriptar, pasando el path del proyecto como argumento
    node -e "
        const path = require('node:path');
        const fs = require('node:fs');
        const projectRoot = process.argv[1];
        const encryptedValue = process.argv[2];
        const key = process.argv[3];
        
        const encryptPath = path.resolve(projectRoot, 'src', 'crypto', 'crypto-cli.js');
        
        if (!fs.existsSync(encryptPath)) {
            console.error('Error: No se encontró el archivo de encriptación en:', encryptPath);
            process.exit(1);
        }
        
        const { decrypt } = require(encryptPath);
        try {
            console.log(decrypt(encryptedValue, key));
        } catch (e) {
            console.error('Error:', e.message);
            process.exit(1);
        }
    " "$PROJECT_ROOT" "$encrypted_value" "$encryption_key" 2>/dev/null
}

# Función para encriptar valores usando Node.js
encrypt_value() {
    local plain_value="$1"
    local encryption_key="${2:-${ENCRYPTION_KEY:-default-key-change-me-in-production-32chars!!}}"
    
    if [ -z "$plain_value" ]; then
        return 1
    fi
    
    # Crear archivo temporal para capturar errores (compatible con Windows y Linux)
    local error_file="${TMPDIR:-/tmp}/encrypt_error_$$.log"
    [ -z "$TMPDIR" ] && [ ! -d "/tmp" ] && error_file="${PROJECT_ROOT}/.encrypt_error_$$.log"
    
    # Usar Node.js para encriptar, pasando el path del proyecto como argumento
    local result=$(node -e "
        const path = require('node:path');
        const fs = require('node:fs');
        const projectRoot = process.argv[1];
        const plainValue = process.argv[2];
        const key = process.argv[3];
        
        // Construir el path del módulo de encriptación
        const encryptPath = path.resolve(projectRoot, 'src', 'crypto', 'crypto-cli.js');
        
        // Verificar que el archivo existe
        if (!fs.existsSync(encryptPath)) {
            console.error('Error: No se encontró el archivo de encriptación en:', encryptPath);
            process.exit(1);
        }
        
        const { encrypt } = require(encryptPath);
        
        if (!plainValue) {
            console.error('Error: Valor vacío para encriptar');
            process.exit(1);
        }
        
        try {
            const result = encrypt(plainValue, key);
            console.log(result);
        } catch (e) {
            console.error('Error al encriptar:', e.message);
            process.exit(1);
        }
    " "$PROJECT_ROOT" "$plain_value" "$encryption_key" 2>"$error_file")
    
    local exit_code=$?
    local has_errors=0
    
    # Verificar si hay errores en el archivo
    if [ -s "$error_file" ]; then
        has_errors=1
        cat "$error_file" >&2
    fi
    
    # Limpiar archivo temporal
    [ -f "$error_file" ] && rm -f "$error_file"
    
    # Si hubo errores o el código de salida no es 0
    if [ $exit_code -ne 0 ] || [ $has_errors -eq 1 ]; then
        return 1
    fi
    
    # Verificar que el resultado tenga el formato esperado (salt:iv:tag:encrypted)
    if [[ "$result" == *:*:*:* ]]; then
        echo "$result"
        return 0
    else
        echo "Error: Formato de encriptación inválido" >&2
        [ -n "$result" ] && echo "Resultado recibido: $result" >&2
        return 1
    fi
}

# Función para crear el archivo .env pidiendo valores al usuario
create_env_file() {
    local encryption_key="${ENCRYPTION_KEY:-default-key-change-me-in-production-32chars!!}"
    
    echo -e "${BLUE}🔐 Configuración del archivo .env con valores encriptados${NC}" >&2
    echo -e "${YELLOW}⚠️  IMPORTANTE: Guarda la clave de encriptación de forma segura!${NC}" >&2
    echo -e "${BLUE}   Clave actual: ${encryption_key:0:10}...${NC}" >&2
    echo "" >&2
    
    # Solicitar contraseña (requerida)
    local password=""
    while [ -z "$password" ]; do
        echo -n "Contraseña a encriptar: "
        read -s password
        echo ""
        if [ -z "$password" ]; then
            echo -e "${YELLOW}⚠ La contraseña es requerida${NC}" >&2
        fi
    done
    
    # Solicitar usuario (opcional)
    echo -n "Usuario (opcional, Enter para omitir): "
    read username
    if [ -z "$username" ]; then
        username="N/A"
    fi
    
    # Solicitar servicio (opcional)
    echo -n "Servicio (opcional, Enter para omitir): "
    read service
    if [ -z "$service" ]; then
        service="N/A"
    fi
    
    echo "" >&2
    echo -e "${BLUE}📝 Encriptando valores...${NC}" >&2
    
    # Encriptar valores
    local encrypted_password=$(encrypt_value "$password" "$encryption_key")
    local encrypt_error_password=$?
    local encrypted_username=$(encrypt_value "$username" "$encryption_key")
    local encrypt_error_username=$?
    local encrypted_service=$(encrypt_value "$service" "$encryption_key")
    local encrypt_error_service=$?
    
    # Verificar si hubo errores o si el resultado contiene "Error"
    if [ $encrypt_error_password -ne 0 ] || [ -z "$encrypted_password" ] || [[ "$encrypted_password" == *"Error"* ]]; then
        echo -e "${YELLOW}⚠ Error al encriptar la contraseña${NC}" >&2
        [ -n "$encrypted_password" ] && echo "$encrypted_password" >&2
        return 1
    fi
    
    if [ $encrypt_error_username -ne 0 ] || [ -z "$encrypted_username" ] || [[ "$encrypted_username" == *"Error"* ]]; then
        echo -e "${YELLOW}⚠ Error al encriptar el usuario${NC}" >&2
        [ -n "$encrypted_username" ] && echo "$encrypted_username" >&2
        return 1
    fi
    
    if [ $encrypt_error_service -ne 0 ] || [ -z "$encrypted_service" ] || [[ "$encrypted_service" == *"Error"* ]]; then
        echo -e "${YELLOW}⚠ Error al encriptar el servicio${NC}" >&2
        [ -n "$encrypted_service" ] && echo "$encrypted_service" >&2
        return 1
    fi
    
    # Crear contenido del archivo .env
    cat > "$CONFIG_FILE" << EOF
# Archivo de configuración para el cliente (valores encriptados)
# Este archivo fue creado automáticamente
# Edita estas variables según tus necesidades
# Para configurar nuevos valores, ejecuta: npm run setup-env
# Para ver valores desencriptados, ejecuta: npm run decrypt-env

PASSWORD_ENCRYPTED=${encrypted_password}
USERNAME_ENCRYPTED=${encrypted_username}
SERVICE_ENCRYPTED=${encrypted_service}

# Clave de encriptación (NO compartas este archivo!)
# ENCRYPTION_KEY=${encryption_key}
EOF
    
    echo -e "${GREEN}✅ Archivo .env creado exitosamente!${NC}" >&2
    echo -e "${BLUE}   Ubicación: ${CONFIG_FILE}${NC}" >&2
    echo "" >&2
}

# Función para cargar variables desde archivo .env
load_env_file() {
    local file="$1"
    if [ -f "$file" ]; then
        # Leer el archivo .env ignorando comentarios y líneas vacías
        # Usar set -a para auto-exportar todas las variables
        set -a
        while IFS= read -r line || [ -n "$line" ]; do
            # Ignorar líneas vacías y comentarios
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
            # Procesar línea KEY=VALUE
            if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
                key="${BASH_REMATCH[1]// /}"
                value="${BASH_REMATCH[2]}"
                # Remover comillas si existen al inicio y final
                value="${value#\"}"
                value="${value%\"}"
                value="${value#\'}"
                value="${value%\'}"
                
                # Si la variable termina en _ENCRYPTED, intentar desencriptarla
                if [[ "$key" =~ _ENCRYPTED$ ]]; then
                    # Obtener el nombre de variable sin _ENCRYPTED
                    base_key="${key%_ENCRYPTED}"

                    # Si el valor tiene el formato esperado (salt:iv:tag:cipher)
                    if [[ "$value" == *:*:*:* ]]; then
                        decrypted_value=$(decrypt_value "$value")
                        if [ $? -eq 0 ] && [ -n "$decrypted_value" ]; then
                            # Exportar con el nombre sin _ENCRYPTED usando el valor desencriptado
                            eval "$base_key=\"$decrypted_value\""
                        else
                            echo "⚠ Advertencia: No se pudo desencriptar $key, usando valor tal cual" >&2
                            # Fallback: usar el valor tal cual (por si está en texto plano o el formato cambió)
                            eval "$base_key=\"$value\""
                        fi
                    else
                        # El valor no parece encriptado, usarlo tal cual
                        eval "$base_key=\"$value\""
                    fi
                else
                    # Variable normal, asignar directamente
                    eval "$key=\"$value\""
                fi
            fi
        done < "$file"
        set +a
    fi
}

# Cargar configuración desde archivo .env
if [ -f "$CONFIG_FILE" ]; then
    load_env_file "$CONFIG_FILE"
else
    echo -e "${YELLOW}⚠ No se encontró .env${NC}" >&2
    echo -e "${BLUE}   Ejecuta: npm run setup-env${NC}" >&2
    exit 1
fi

AUTH_EMAIL="${AUTH_EMAIL:-demo@bgvault.local}"
AUTH_PASSWORD="${AUTH_PASSWORD:-bgvault-dev-password}"
PASSWORD="${PASSWORD:-demo-password}"
USERNAME="${USERNAME:-demo-user}"
SERVICE="${SERVICE:-demo-service}"

extract_token() {
    echo "$1" | python -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null
}

ensure_token() {
    curl -s -o /dev/null \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${AUTH_EMAIL}\",\"password\":\"${AUTH_PASSWORD}\"}" \
        "${SERVER_URL}/api/auth/register" >/dev/null 2>&1

    local login_body
    login_body=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${AUTH_EMAIL}\",\"password\":\"${AUTH_PASSWORD}\"}" \
        "${SERVER_URL}/api/auth/login")

    ACCESS_TOKEN=$(extract_token "$login_body")
    if [ -z "$ACCESS_TOKEN" ]; then
        echo -e "${YELLOW}⚠ No se pudo iniciar sesión${NC}" >&2
        echo "$login_body" >&2
        exit 1
    fi
}

# Función para hacer GET request
get_passwords() {
    ensure_token
    echo -e "${BLUE}Listando credenciales: ${SERVER_URL}/api/credentials${NC}"
    echo ""
    
    response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        "${SERVER_URL}/api/credentials")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ Respuesta exitosa (HTTP $http_code)${NC}"
        echo ""
        echo "$body" | python -m json.tool 2>/dev/null || echo "$body"
    else
        echo -e "${YELLOW}⚠ Error HTTP $http_code${NC}"
        echo "$body"
    fi
}

# Función para hacer POST request
post_password() {
    local password="$1"
    local username="${2:-N/A}"
    local service="${3:-N/A}"
    
    if [ -z "$password" ]; then
        echo -e "${YELLOW}⚠ Error: Debes proporcionar una contraseña${NC}"
        echo "Uso: ./client.sh post 'password' [username] [service]"
        exit 1
    fi
    
    data="{\"type\":\"password\",\"name\":\"${service}\",\"service\":\"${service}\",\"payload\":{\"password\":\"${password}\",\"username\":\"${username}\"}}"
    
    echo -e "${BLUE}Creando credencial en: ${SERVER_URL}/api/credentials${NC}"
    echo ""

    ensure_token
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -d "$data" \
        "${SERVER_URL}/api/credentials")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo -e "${GREEN}✓ Credencial creada (HTTP $http_code)${NC}"
        echo ""
        echo "$body" | python -m json.tool 2>/dev/null || echo "$body"
    else
        echo -e "${YELLOW}⚠ Error HTTP $http_code${NC}"
        echo "$body"
    fi
}

# Main
case "$1" in
    post)
        # Usar las variables definidas al inicio del script
        post_password "$PASSWORD" "$USERNAME" "$SERVICE"
        ;;
    get)
        get_passwords
        ;;
    *)
        echo -e "${YELLOW}Uso:${NC}"
        echo "  bash scripts/client/client.sh post  - Crear una credencial tipo password"
        echo "  bash scripts/client/client.sh get   - Listar credenciales (sin payload)"
        echo ""
        echo -e "${BLUE}Desde npm:${NC}"
        echo "  npm run client:post"
        echo "  npm run client:get"
        echo ""
        echo "Requiere un usuario. El script registra/loguea ${AUTH_EMAIL} si hace falta."
        exit 1
        ;;
esac


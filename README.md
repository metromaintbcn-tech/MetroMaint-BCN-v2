# 🚇 MetroMaint BCN

Aplicación Web Progresiva (PWA) para la gestión de mantenimiento de equipos de ventilación y bombeo en la red de Metro de Barcelona. Diseñada para ser utilizada por operarios in-situ con soporte de Inteligencia Artificial.

![Version](https://img.shields.io/badge/version-1.3.1-blue)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Firebase%20%7C%20Gemini%20AI-red)

## 📋 Características Principales

*   **Gestión de Inventario:** CRUD completo de Pozos de Agotamiento (PA/PE), Ventilaciones (VE/VT) y Fosas Sépticas (FS).
*   **Modo Offline:** Persistencia de datos local y sincronización inteligente.
*   **Asistente IA (Gemini):** Análisis de datos, detección de anomalías en consumos y sugerencias de mantenimiento mediante chat.
*   **Herramientas de Campo:**
    *   📸 Escáner OCR para digitalizar placas de características.
    *   ⏱️ Cronómetro integrado para cálculos de caudal/llenado.
    *   📳 Vibrómetro digital usando acelerómetros del dispositivo.
*   **Modo Admin Discreto:** Área oculta protegida por PIN para operaciones masivas (Importar CSV, Reset BD, Backups).

## 🚀 Instalación y Despliegue para los 20 Operarios

### 1. Acceso Web
La aplicación está alojada en la nube. Los operarios solo necesitan el enlace web.
*   **URL:** `https://tu-proyecto.web.app` (Sustituir por la real tras deploy).

### 2. Instalación en Móvil (PWA)
Para que funcione como una App nativa (pantalla completa, sin barra de navegador):
*   **Android:** Abrir en Chrome -> Menú (3 puntos) -> "Instalar aplicación" o "Añadir a pantalla de inicio".
*   **iPhone (iOS):** Abrir en Safari -> Botón Compartir (cuadrado con flecha) -> "Añadir a la pantalla de inicio".

---

## ⚠️ AVISO DE SEGURIDAD EN VERCEL (Variables de Entorno)

Al configurar las variables en Vercel, verás un aviso amarillo que dice:
> *"This key, which is prefixed with VITE_ ... might expose sensitive information"*

**ESTO ES NORMAL. NO BORRES EL PREFIJO `VITE_`.**

1.  **VITE_FIREBASE_API_KEY:** Es pública por diseño. Firebase usa reglas de seguridad en la base de datos, no oculta la clave.
2.  **VITE_API_KEY (Gemini):** Es necesaria en el navegador para que la IA funcione sin servidor intermedio.
    *   *Recomendación:* Ve a la consola de Google Cloud y restringe esta API Key para que solo acepte peticiones desde tu dominio (`https://tu-app.vercel.app`).

---

## 🆘 Guía de Mantenimiento del Código (Para el Administrador)

Si necesitas guardar cambios y los botones automáticos fallan, sigue este **"Método Manual Infalible"**:

1.  Abre este repositorio en GitHub.com.
2.  Navega al archivo que has modificado (ej. `App.tsx`).
3.  Pulsa el icono del **Lápiz ✏️** (Editar).
4.  Borra el contenido antiguo y pega el código nuevo de tu editor.
5.  Pulsa el botón verde **"Commit changes"** abajo del todo.

### Gestión de Datos (Backup)
*   **NO** uses GitHub para guardar los datos de los pozos (esos van a Firebase).
*   Para hacer copia de seguridad de los datos: Abre la App -> Menú Hamburguesa -> Candado (PIN 8386) -> Botón **"Backup"** (Verde).

---

## 🔒 Zona Desarrollador (Admin)

Para acceder a las herramientas administrativas en la app:
1.  Abrir el menú hamburguesa.
2.  Pulsar el candado 🔒 pequeño junto a la versión `v1.3.1`.
3.  Introducir el PIN de servicio técnico.

## 🛠️ Tecnologías

*   **Frontend:** React 19, TailwindCSS, Lucide Icons, Recharts.
*   **Backend / DB:** Firebase Firestore (NoSQL).
*   **AI Engine:** Google Gemini 2.5 Flash & Vision.

---
*Desarrollado para el equipo de mantenimiento de Metro BCN.*
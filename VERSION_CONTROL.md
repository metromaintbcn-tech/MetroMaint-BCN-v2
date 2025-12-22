# PUNTO DE RESTAURACIÓN - VERSIÓN ESTABLE v1.4.7

**Fecha:** Actualidad
**Estado:** Estable / Producción
**Descripción:** 
Solución al error "API Key must be set" y "Fallo en el escáner" en entornos de producción mediante el flujo de selección de claves oficial.

## 🚀 Mejoras de Estabilidad (v1.4.7)
1. **Gestión de Clave IA:** Implementado el flujo de selección de clave mediante `window.aistudio.openSelectKey()` para garantizar el acceso a la API en el navegador.
2. **Resiliencia de Conexión:** Acceso seguro a `process.env.API_KEY` y verificación de estado con `hasSelectedApiKey`.
3. **Instanciación "Just-in-Time":** Se garantiza que `GoogleGenAI` se cree dentro de cada función de servicio para capturar la clave más reciente.
4. **UI de Activación:** Añadido banner y botón de activación de IA para guiar al operario si la clave no está configurada.

## ✅ Características Validadas
- **Escáner OCR:** Recuperado tras corregir el acceso a la clave.
- **Asistente IA:** Recuperado tras corregir el acceso a la clave.
- **Seguridad:** Cumplimiento estricto de las directrices de inyección de claves en entornos AI Studio.

---
**AVISO:** Si la IA sigue sin responder después de activar, asegúrate de haber seleccionado una clave de un proyecto de Google Cloud con facturación activa.
# ¿CÓMO PUBLICAR LA APP PARA LOS 20 OPERARIOS?

Ahora mismo tienes el código, pero necesitas un enlace web (URL). Como ya configuraste Firebase Database, lo más fácil es usar **Firebase Hosting**.

Sigue estos pasos (puedes necesitar descargar el código a tu ordenador si IAStudio no permite terminal):

## OPCIÓN A: Si puedes descargar el código (Recomendada)

1. **Descarga** todo este proyecto a tu ordenador.
2. Abre una terminal (pantalla negra) en la carpeta del proyecto.
3. Asegúrate de tener Node.js instalado.
4. Ejecuta este comando para instalar la herramienta de Firebase:
   ```bash
   npm install -g firebase-tools
   ```
5. Inicia sesión con tu cuenta de Google:
   ```bash
   firebase login
   ```
6. Conecta el código con tu proyecto (elige el que creaste 'metromaint-bcn'):
   ```bash
   firebase init hosting
   ```
   *(Preguntará cosas: Dile que use el directorio actual `.` o `dist`, dile que SÍ es una "single-page app", y dile que NO sobrescriba index.html)*
7. **¡Publicar!**
   ```bash
   firebase deploy
   ```

🎉 **¡LISTO!** La terminal te dará un enlace (ejemplo: `https://metromaint-bcn.web.app`).

## OPCIÓN B: Usar Vercel (Muy fácil)

1. Descarga el código.
2. Súbelo a GitHub (si tienes cuenta).
3. Ve a [Vercel.com](https://vercel.com), regístrate gratis.
4. Dale a "Add New Project" e importa tu repositorio de GitHub.
5. Vercel te dará el enlace automáticamente.

---

## CÓMO INSTALAR EN EL MÓVIL (PWA)

Una vez tengas el enlace (ej: `metromaint.web.app`), mándalo por WhatsApp a los operarios.

1. Abren el enlace en Chrome (Android) o Safari (iPhone).
2. **Android:** Les saldrá un aviso abajo "Añadir a pantalla de inicio" o en el menú de 3 puntos -> "Instalar aplicación".
3. **iPhone:** Tienen que darle al botón "Compartir" (cuadrado con flecha) -> "Añadir a la pantalla de inicio".

¡Al hacerlo, aparecerá el icono del Metro en su menú y funcionará a pantalla completa como una app real!

# Cerca · Demo interactiva

Prototipo académico del Grupo 6. Interfaz de telemedicina con datos ficticios, sin instalación, servidor ni base de datos. Conserva el diseño celeste y blanco, menú desplegable y ajustes de accesibilidad.

## Ver en tu computador

Abre `index.html` con Chrome, Edge o Firefox. No necesitas Python. Extrae el ZIP antes de abrirlo.

## Publicar en GitHub Pages

1. Crea un repositorio **público** llamado `cerca-demo` en GitHub. Puedes marcar la opción de añadir un README para que se cree la rama `main`.
2. En el repositorio, abre **Add file → Upload files**.
3. Sube el contenido de esta carpeta (no el ZIP ni la carpeta contenedora). `index.html`, `app.js`, `demo.js`, `styles.css` y `favicon.svg` deben quedar directamente en la raíz del repositorio. Incluye también `.nojekyll` si aparece; no es indispensable para estos archivos.
4. Confirma con **Commit changes** en la rama `main`.
5. Abre **Settings → Pages**.
6. En **Source**, elige **Deploy from a branch**. En **Branch**, selecciona `main` y `/(root)`. Pulsa **Save**.
7. Espera a que termine la publicación. En esa misma página aparecerá **Visit site**, con el enlace para compartir. El enlace habitual es `https://TU-USUARIO.github.io/cerca-demo/`.

Puede tardar hasta 10 minutos. Fuente: https://docs.github.com/en/pages/quickstart

## Recorrido sugerido (3 minutos)

1. Entra **Como paciente** y explora la cita de ejemplo.
2. Abre el menú, agenda otra hora y confirma la reserva.
3. Revisa **Mis citas** y cancela una hora si quieres.
4. Explora **Mi ficha clínica** y la vista previa de consulta.
5. Abre **Accesibilidad** y prueba el texto grande y alto contraste.
6. Desde el menú, pulsa **Cambiar de perfil**. Entra como profesional y registra una atención de ejemplo para Elena.
7. Cambia a Administración para ver el envío simulado y a Auditoría para revisar los eventos del recorrido.

## Alcance

- Los perfiles se eligen sin contraseña; no hay autenticación real.
- Las citas, fichas, auditoría e intercambio son simulaciones en memoria del navegador.
- Los cambios permanecen al cambiar de perfil, pero se reinician al recargar o pulsar **Reiniciar demo**.
- Cada visitante tiene su propia copia: no se comparten reservas ni registros entre personas, pestañas o equipos.
- Solo las preferencias de accesibilidad se guardan en el navegador, cuando permite almacenamiento local.
- La consulta es una vista de ejemplo: no usa cámara ni micrófono.
- La descarga JSON contiene datos ficticios y no representa una integración FHIR validada.
- Esta demo muestra la experiencia de uso; no implementa ni valida la arquitectura de servidor del informe. La versión local completa se conserva por separado.

No ingreses datos reales de salud en esta demostración.

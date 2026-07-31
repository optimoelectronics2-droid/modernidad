# Guía de instalación para Android (Capacitor)

Convierte SIGR Pro en una app Android nativa con notificaciones locales reales.

---

## Requisitos

- [Node.js](https://nodejs.org/) 18+
- [Android Studio](https://developer.android.com/studio) con SDK 34+
- Java 17+ (incluido con Android Studio)
- Un dispositivo Android físico (o emulador) con Android 8+ (API 26+)

---

## 1. Instalar dependencias

```bash
cd "C:\Users\Brailin\Downloads\apuntes"
npm install
```

## 2. Inicializar Capacitor (solo la primera vez)

```bash
npx cap init
```

Si ya existe `capacitor.config.json`, omite este paso.

## 3. Agregar la plataforma Android

```bash
npx cap add android
```

Esto crea la carpeta `android/` con un proyecto Android Studio completo.

## 4. Copiar la web al proyecto nativo

```bash
npx cap copy
```

## 5. Configurar el icono de notificación pequeña

### 5.1 Crear el archivo `ic_stat_icon.png`

Necesitas un icono PNG blanco/transparente de 24x24dp (48x48px para mdpi).  
Colócalo en la carpeta de recursos correcta:

Crea las carpetas si no existen:

```bash
mkdir -p android/app/src/main/res/drawable
```

Copia tu icono (o usa uno generado):

```bash
# Si tienes ImageMagick o similar, genera uno desde SVG:
# convert -resize 48x48 icono.svg android/app/src/main/res/drawable/ic_stat_icon.png
```

**Importante:** El icono debe ser blanco sobre fondo transparente, en formato PNG.  
Las dimensiones recomendadas por densidad:

| Densidad | Tamaño | Carpeta |
|----------|--------|---------|
| mdpi     | 24x24  | `drawable-mdpi/` |
| hdpi     | 36x36  | `drawable-hdpi/` |
| xhdpi    | 48x48  | `drawable-xhdpi/` |
| xxhdpi   | 72x72  | `drawable-xxhdpi/` |
| xxxhdpi  | 96x96  | `drawable-xxxhdpi/` |

También puedes colocar una sola versión en `drawable/` (sin sufijo de densidad) y
Android la escalará automáticamente.

### 5.2 (Opcional) Copiar sonido de notificación

Si deseas un sonido personalizado, coloca `beep.wav` en:

```
android/app/src/main/res/raw/beep.wav
```

## 6. Sincronizar y abrir Android Studio

```bash
npx cap sync android
npx cap open android
```

## 7. Configurar permisos en Android (manual)

### 7.1 Notificaciones

Android 13+ (API 33+) requiere permiso explícito `POST_NOTIFICATIONS`.  
En `android/app/src/main/AndroidManifest.xml`, agrega DENTRO de `<manifest>`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

El plugin `@capacitor/local-notifications` ya lo solicita en tiempo de ejecución
cuando la app inicia, pero el permiso en el manifest es necesario para que
Google Play lo reconozca.

### 7.2 Alarmas exactas (Android 12+)

Para que las notificaciones se disparen a la hora EXACTA incluso con el
teléfono en reposo, agrega:

```xml
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />
```

### 7.3 Desactivar optimización de batería

Para evitar que el sistema cancele las notificaciones programadas:

```xml
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

Además, en tiempo de ejecución el usuario debe ir a:
**Ajustes → Aplicaciones → SIGR Pro → Batería → Sin restricciones**

O desde la app misma, puedes invocar:

```
Intent( Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS )
```

(Esto está fuera del alcance de este README; el plugin no lo maneja automáticamente).

## 8. Compilar APK

Desde Android Studio:

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. El APK firmado (o no firmado) aparecerá en:
   `android/app/build/outputs/apk/debug/app-debug.apk`

O desde terminal:

```bash
cd android
./gradlew assembleDebug
```

El APK estará en: `android/app/build/outputs/apk/debug/app-debug.apk`

Para release (firmado):

```bash
./gradlew assembleRelease
```

(Requiere keystore configurado en `android/app/build.gradle`.)

## 9. Instalar en dispositivo

- Copia el APK a tu teléfono y ábrelo para instalar.
- O desde Android Studio: conecta el dispositivo por USB y presiona ▶︎ Run.

---

## Actualizar la app después de cambios

Cada vez que modifiques archivos de la web (JS, CSS, HTML):

```bash
npx cap copy
npx cap sync android   # si agregaste/quitaste plugins
```

Luego recompila en Android Studio o con:

```bash
cd android && ./gradlew assembleDebug
```

---

## Notas importantes

- **Las notificaciones se disparan aunque la app esté cerrada** porque el sistema
  operativo Android mantiene la programación a nivel nativo (AlarmManager /
  WorkManager).
- **Las notificaciones repetitivas** (diarias, semanales, mensuales, anuales) se
  reprograman automáticamente por el plugin sin necesidad de que la app esté
  abierta.
- **Si el usuario desliza** la notificación sin abrir la app, el recordatorio
  subyacente sigue en estado `sent`. La app mostrará la próxima ocurrencia
  (si es repetitiva) al abrirse.
- **La cancelación** de una notificación (al completar/cancelar/borrar un
  recordatorio) ocurre por ID numérico. El ID se genera con un hash del tag
  `reminder-{id}`.
- **Compatibilidad hacia atrás:** En navegador web (sin Capacitor), todo sigue
  funcionando exactamente como antes usando la Notification API del navegador
  y el fallback visual.
- La app **no registra service worker** (se desregistra al iniciar) para evitar
  conflictos con la caché. Esto es intencional.

---

## Estructura de archivos creados/modificados

```
package.json                 ← Nuevo (dependencias)
capacitor.config.json        ← Nuevo (config Capacitor)
README-INSTALAR-ANDROID.md   ← Este archivo
js/services/NotificationService.js  ← Modificado (soporte nativo)
js/services/ReminderService.js      ← Modificado (conexión con notificaciones nativas)
js/app.js                    ← Modificado (init: permisos)
index.html                   ← Modificado (v=3 cache busting)
```

---

## Referencias

- [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)
- [Capacitor Android](https://capacitorjs.com/docs/android)
- [Android SCHEDULE_EXACT_ALARM](https://developer.android.com/about/versions/12/behavior-changes-12#exact-alarm-permission)

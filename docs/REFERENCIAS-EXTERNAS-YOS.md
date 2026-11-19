# Referencias externas para YOS

## Decisión de implementación

YOS Xtream conserva su código fuente propio como base para Android (celular y TV Box) y webOS (televisores LG). Se implementarán patrones generales de interfaz —navegación con control remoto, búsqueda, favoritos, listas y reproducción— con el diseño y la marca YOS. No se copiará el APK ni se desactivará el control de versión de una app de terceros.

## Repositorios revisados

- [`yecos/XUPER`](https://github.com/yecos/XUPER): se presenta como rediseño educativo basado en una APK de terceros. No se confirmó una licencia que permita reutilizar su código. Sus instrucciones de captura de tráfico y bypass de SSL pinning quedan fuera del alcance de YOS.
- [`cristianco7/XUPER-HYDRA-PORT-WEBOS`](https://github.com/cristianco7/XUPER-HYDRA-PORT-WEBOS): el código original del repositorio declara MIT, por lo que puede reutilizarse si se conserva el aviso y la licencia. La licencia excluye explícitamente recursos gráficos, marca XuperTV y binarios FFmpeg. YOS no los incorporará.
- [`Leandro-codes/xuperiptv`](https://github.com/Leandro-codes/xuperiptv): reproductor M3U independiente con ideas de navegación para TV. No se encontró una licencia de reutilización verificable; se toma como referencia funcional, no como fuente para copiar archivos.
- [`muguiwara23/Xuper-PC`](https://github.com/muguiwara23/Xuper-PC): proyecto IPTV/PC con una guía Android. No se verificó que sea el código de la app Xuper Hydra ni una licencia para reutilizarlo; queda como referencia, no como fuente para copiar archivos.

## Funciones propias que se conservan o mejoran

- Inicio de sesión Xtream y listas M3U autorizadas.
- Catálogo de TV, películas y series, con búsqueda y favoritos.
- Controles de reproducción y navegación por D-pad / Magic Remote.
- Diseño adaptable a celular, Android TV Box y televisores LG.
- En Android, credenciales cifradas y sesión persistente hasta **Cerrar sesión**; en webOS, no se almacenan credenciales.
- Sin actualización obligatoria ni bloqueo de versión dentro de YOS. Las versiones nuevas se instalarán cuando el usuario decida hacerlo.

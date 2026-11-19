# Cambios

Todas las versiones de **Block of the Dead**. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones usan [SemVer](https://semver.org/lang/es/).

## [1.1.0] - 2026-11-19

### Añadido
- **Pantalla de ajustes**, en el menú y en la pausa:
  - volumen de la música y de los efectos por separado;
  - calidad gráfica: automática, alta o baja;
  - sacudidas de pantalla, que se pueden activar o desactivar;
  - contador de FPS.
- **Estadísticas del jugador**:
  - tiempo jugado, partidas y niveles ganados;
  - líneas por tipo (sencillas, dobles, triples y cuádruples) y mejor combo;
  - zombies derrotados por tipo.
- **Exportar e importar la partida**: un código para copiar y pegar, o un archivo `.json`. Sirve para pasar el progreso a otro dispositivo o navegador, y comprueba que la copia esté completa y sin modificar.
- **Versión visible** en el menú principal.
- **Pruebas automáticas en GitHub Actions**: se ejecutan en cada subida, en un Chromium sin ventana.
- **8 pruebas nuevas**, 58 en total.

### Cambiado
- Los botones de sonido y música del menú y de la pausa se sustituyen por el botón **Ajustes**.

## [1.0.0] - 2026-11-19

### Añadido
- **Primera versión jugable**: las piezas que caen se convierten en defensas contra los zombies.
- **8 defensas**, que se desbloquean nivel a nivel y se asignan a cada pieza antes de jugar.
- **9 tipos de zombie**, incluidos el gigante y el rey gigante.
- **10 niveles en 2 mundos**: El jardín y La noche en el cementerio, con lápidas y niebla.
- **Progresión**: tutorial, barra de oleadas, rodillos de jardín, combos, cobertizo de mejoras, 13 logros y almanaque.
- **Modo supervivencia** con oleadas infinitas.
- **Presentación**: estilo cartoon con dibujos SVG originales, sonido y música con Web Audio, controles táctiles y pantalla completa.
- **Pruebas automáticas** en `tests.html`.

[1.1.0]: https://github.com/ComarcaDev/block-of-the-dead/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ComarcaDev/block-of-the-dead/releases/tag/v1.0.0

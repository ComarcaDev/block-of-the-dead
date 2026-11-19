# Cambios

Todas las versiones de **Block of the Dead**. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones usan [SemVer](https://semver.org/lang/es/).

## [1.2.0] - 2026-11-19

### Añadido
- **Guardar pieza (hold)**:
  - se guarda la pieza actual y se recupera más tarde, una vez por pieza;
  - funciona con la tecla C o Mayús, con el botón táctil ⇄, deslizando hacia arriba o tocando el recuadro "Guardada";
  - también sirve con las piezas compradas en la tienda.
- **Dificultad: fácil, normal y difícil**:
  - se elige antes de cada nivel;
  - cambia la velocidad de caída, la vida y la velocidad de los zombies, y los cerebros que ganas;
  - los récords de los niveles y de supervivencia se guardan por separado para cada dificultad. Los de la v1.0 y la v1.1 cuentan como dificultad normal.
- **Reto diario**:
  - cada fecha genera un nivel con su mundo, sus oleadas y sus piezas, igual para todos los jugadores;
  - cada día tiene una regla especial: solo minas y muros, sin rodillos, zombies rápidos, lluvia de cerebros, niebla total o llega el jefe;
  - se guardan el récord del día, la racha de días seguidos y la mejor racha;
  - se juega siempre en dificultad normal, con todas las defensas y sin mejoras del cobertizo.
- **7 pruebas nuevas**, 65 en total.

### Corregido
- En el móvil, el botón "Megabomba" de la tienda ya no se monta sobre los botones del panel.

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

[1.2.0]: https://github.com/ComarcaDev/block-of-the-dead/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/ComarcaDev/block-of-the-dead/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ComarcaDev/block-of-the-dead/releases/tag/v1.0.0

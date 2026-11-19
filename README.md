# Block of the Dead

[![Pruebas](https://github.com/ComarcaDev/block-of-the-dead/actions/workflows/tests.yml/badge.svg)](https://github.com/ComarcaDev/block-of-the-dead/actions/workflows/tests.yml)

Juego de navegador que mezcla piezas que caen con defensa contra zombies. Las piezas que colocas se convierten en defensas. Los zombies llegan por la derecha y tienes que impedir que alcancen tu casa.

## Cómo ejecutarlo

Abre `index.html` con doble clic. No hace falta instalar nada ni usar un servidor.

También se puede jugar en línea, en GitHub Pages: https://comarcadev.github.io/block-of-the-dead/

Para probar con atajos de depuración, abre `index.html?debug`. Con este modo todos los niveles están desbloqueados y puedes usar estas teclas:

- **K**: mata a todos los zombies.
- **B**: suma 100 cerebros.
- **N**: gana el nivel.

## Pruebas automáticas

Abre `tests.html` con doble clic. Comprueba las reglas del juego y el guardado, y marca cada prueba en verde o en rojo. Pásalas después de cada cambio.

Las pruebas usan sus propias claves de guardado, así que no tocan tu partida.

En GitHub, las pruebas se ejecutan solas en cada subida (GitHub Actions, `.github/workflows/tests.yml`). Para ejecutarlas en local sin ventana hace falta Node.js:

```
npm install --no-save playwright
npx playwright install chromium
node ci/run-tests.mjs
```

## Guardar pieza, dificultad y reto diario

- **Guardar pieza**: con la tecla C o Mayús, el botón táctil ⇄ o deslizando hacia arriba, guardas la pieza actual para usarla más tarde. Se puede hacer una vez por pieza.
- **Dificultad**: fácil, normal o difícil, a elegir antes de cada nivel. Los récords se guardan por separado para cada dificultad.
  - **Valores**: están en `DIFFICULTY`, en `js/config.js`.
- **Reto diario** (botón ★ del menú): cada día hay un nivel nuevo, igual para todos los jugadores, con una regla especial. Se guardan el récord del día y la racha de días seguidos.
  - **Reglas**: se generan en `makeDaily`, en `js/levels.js`.

## Ajustes, estadísticas y copias

- **Ajustes** (menú o pausa):
  - volumen de la música y de los efectos;
  - calidad gráfica (automática, alta o baja);
  - sacudidas de pantalla;
  - contador de FPS.
- **Estadísticas**: tiempo jugado, partidas, líneas por tipo, mejor combo y zombies derrotados por tipo.
- **Copia de tu partida** (en Ajustes):
  - **exportar**: crea un código para copiar o descarga un archivo `.json`;
  - **importar**: pega el código o carga el archivo en otro dispositivo o navegador. Antes de reemplazar el progreso se comprueba que la copia esté completa y pide confirmación.

Los cambios de cada versión están en [CHANGELOG.md](CHANGELOG.md).

## Estabilidad

- **Errores**: si algo falla, el juego sigue funcionando. Si el fallo se repite, se detiene y muestra "Algo salió mal" con opciones para reiniciar o volver al menú.
- **Efectos e imágenes**: hay un máximo de efectos e imágenes en memoria. Los límites están en `FX_LIMITS` dentro de `js/config.js`.
- **Calidad automática**: si el equipo va lento, el juego baja la calidad solo, salvo que en Ajustes la hayas fijado en alta o baja. El contador de FPS aparece con `?debug` o activándolo en Ajustes.
- **Guardado**: lleva número de versión y tiene una copia de seguridad (`botd_save_bak`). Si tenías progreso de una versión anterior, se conserva al actualizar.

## Cómo se juega

| Pieza | Defensa | Qué hace |
|---|---|---|
| I | Muro | Mucha resistencia |
| O | Búnker | Resistencia máxima |
| T | Lanzaguisantes | El bloque central dispara por su carril |
| L / J | Mina | Explota al ser mordida |
| S / Z | Baba | Frena a los zombies que la muerden |

- Al completar una línea, explota: daña a los zombies de ese carril y de los carriles vecinos, y te da cerebros.
- En la tienda gastas cerebros en:
  - elegir la siguiente pieza;
  - un bloque de 1×1;
  - una megabomba que limpia un área de 3×3.
- Pierdes si los bloques llegan al techo o si 3 zombies entran en tu casa.

**Progresión**

- **Defensas**: al empezar solo tienes el muro, el búnker y el lanzaguisantes. Las piezas cuya defensa aún no tienes caen como tierra. Cada nivel ganado por primera vez desbloquea una defensa nueva:
  - nivel 1: mina;
  - nivel 2: baba;
  - nivel 7: megabomba en la tienda.
- **Rodillos de jardín**: cada carril tiene un rodillo junto a la casa. Si un zombie llega a la casa, el rodillo arrasa el carril, pero solo una vez. Los rodillos que no uses dan puntos al ganar.
- **Barra de oleadas**: abajo a la derecha se ve el avance del nivel, con banderas en las grandes oleadas. Antes de cada gran oleada aparece un aviso y salen varios zombies casi a la vez.
- **Tutorial**: la primera vez que juegas el nivel 1, un tutorial te guía paso a paso. Se puede saltar.
- **Elección de defensas**: antes de cada nivel eliges qué defensa dará cada pieza, entre las que tengas desbloqueadas. Cada pieza tiene un **bloque activo**, el que dispara o genera cerebros.
- **Defensas nuevas**:
  - **planta de hielo** (nivel 3): sus guisantes frenan;
  - **cactus** (nivel 4): pincha a quien lo muerde;
  - **girasol de cerebros** (nivel 6): genera cerebros.
- **Mundo 2 · La noche en el cementerio** (niveles 6–10):
  - **lápidas**: ocupan sitio en la zona de construcción y solo se van con una línea o con la bomba;
  - **niebla**: tapa parte de la zona de aparición;
  - **zombies nuevos**: con cubo, con puerta (escudo contra guisantes), excavador (va bajo tierra) y con globo (vuela por encima);
  - **jefe final**: el rey gigante, en el nivel 10.
- **Combos**: si colocas varias piezas seguidas que completan línea, los cerebros se multiplican: ×1,5 en el segundo combo, ×2 en el tercero… Colocar una pieza que no completa línea rompe el combo.
- **Cobertizo**: los cerebros que te sobran al ganar (y al acabar una supervivencia) se guardan. Con ellos compras mejoras para siempre:
  - más daño de los guisantes;
  - muros más resistentes;
  - más alcance de las minas;
  - más cerebros al empezar;
  - una vida extra;
  - un rodillo de reserva.
- **Supervivencia**: se desbloquea al ganar el nivel 5. Son oleadas infinitas en los 12 carriles:
  - cada oleada trae más zombies y con más vida;
  - las piezas caen cada vez más rápido;
  - hay un jefe cada 10 oleadas;
  - se guarda tu récord.
- **Logros**: 13 retos (cuádruple, combo x5, ganar sin perder vidas, cazar 1000 zombies…). Al conseguir uno aparece un aviso.
- Todos los valores se ajustan en `js/config.js`: `COMBO_STEP`, `UPGRADES` y `SURVIVAL`.
- **Almanaque**: menú → Almanaque. Las defensas y zombies se desbloquean al descubrirlos y muestran sus datos.
- **Dónde cambiarlo**:
  - qué defensa se desbloquea en cada nivel: `UNLOCKS` en `js/levels.js`;
  - qué oleadas son grandes: añade `big: true` a la oleada.

**Controles de teclado**

| Acción | Teclas |
|---|---|
| Mover | ←/→ o A/D |
| Girar | ↑, W o X |
| Girar al revés | Z o Q |
| Bajar rápido | ↓ o S |
| Soltar la pieza | Espacio |
| Guardar la pieza | C o Mayús |
| Pausa | P o Esc |
| Tienda | 1, 2 y 3 |

**Controles en el móvil**: usa los botones de la parte de abajo o el dedo sobre el tablero. Toca para girar, arrastra para mover y desliza hacia abajo para soltar.

## Estructura

```
index.html        página, panel y pantallas
css/styles.css    estilos (incluye la versión para móvil)
js/config.js      valores de equilibrio: vidas, daños, velocidades, costes de la tienda
js/i18n.js        todos los textos (español; preparado para añadir inglés)
js/levels.js      los 5 niveles y sus oleadas
js/pieces.js      piezas, rotación y bolsa de 7
js/board.js       rejilla, colisiones y líneas
js/game.js        lógica de la partida
js/defenses.js    comportamiento de cada defensa
js/zombies.js     comportamiento de los zombies
js/projectiles.js guisantes
js/assets.js      carga de las imágenes SVG
js/render.js      dibujo cartoon, animaciones y efectos
js/audio.js       sonido y música (Web Audio)
js/input.js       teclado, botones táctiles y gestos
js/ui.js          menús, HUD y tienda
js/tutorial.js    tutorial guiado del nivel 1
js/progress.js    cobertizo de mejoras y logros
js/storage.js     guardado del progreso (localStorage)
js/main.js        arranque y bucle principal
```

## Gráficos

Los dibujos están en `assets/svg/`. Puedes sustituir cualquiera por tu propio SVG con el mismo nombre:

- **Defensas**: `wall`, `bunker`, `hedge`, `shooter-head`, `mine`, `slime`, `single`, `bomb`.
- **Zombies**, que se dibujan por partes para animarlos:
  - piezas comunes: `zombie-head`, `zombie-jaw`, `zombie-torso`, `zombie-arm`, `zombie-leg`;
  - variantes del corredor y del gigante: `runner-*`, `boss-*`;
  - `cone`, el cono que se pone encima.
- **Escenario**: `house`, `tombstone`, `pea`, `brain`, `cloud`.

El ambiente de cada nivel se elige con el campo `ambient` en `js/levels.js`. Puede ser `day` (día), `sunset` (atardecer) o `night` (noche).

Para jugar en pantalla completa, pulsa la tecla F o el botón ⛶.

## Ajustes rápidos

- **Dificultad**: cambia la vida, la velocidad o el daño de cada zombie y defensa en `js/config.js`.
- **Niveles**: en `js/levels.js` puedes cambiar estos valores de cada nivel:
  - `fall`: la velocidad de caída;
  - `lanes`: los carriles activos;
  - `waves`: las oleadas.
- **Añadir inglés**: crea `BOTD.I18N.strings.en` en `js/i18n.js` con las mismas claves que el español.

## Licencia

Código y gráficos bajo licencia MIT; consulta el archivo `LICENSE`. Todos los dibujos son originales y se crearon para este juego.

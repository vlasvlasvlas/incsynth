# In C / Mundo Real

**In C / Mundo Real** es una reinterpretación generativa y participativa de
[*In C*](https://en.wikipedia.org/wiki/In_C), la obra abierta compuesta por
Terry Riley en 1964.

La aplicación reúne tres músicos virtuales frente a una secuencia común de 53
patrones. Cada músico repite el patrón que ocupa y decide de manera
independiente cuándo avanzar al siguiente. Para hacerlo escucha simultáneamente:

1. Su propia fuente de datos del mundo real.
2. Su posición y el tiempo que lleva en el patrón.
3. Las posiciones y movimientos recientes de los otros músicos.
4. La memoria y la forma colectiva producida dentro de la sala.

La obra no consiste en convertir un dato directamente en una nota. Su centro es
la convivencia: cada músico tiene autonomía, pero ninguna decisión ocurre de
manera completamente aislada.

- **Demo:** https://vlasvlasvlas.github.io/incysynth/
- **Código:** https://github.com/vlasvlasvlas/incysynth

## El principio original de In C

La partitura original está formada por 53 figuras musicales breves dispuestas
en un orden fijo. Los intérpretes comienzan juntos, pero cada uno puede repetir
una figura tantas veces como considere necesario antes de pasar a la siguiente.

No hay un director que determine todos los avances. Cada músico debe:

- sostener su propia pulsación;
- escuchar el conjunto;
- decidir cuánto repetir;
- avanzar solamente hacia la figura siguiente;
- evitar alejarse excesivamente del grupo;
- aceptar coincidencias, unísonos, desfases y encuentros no planificados.

El resultado no nace de una sincronización perfecta. Nace de muchas decisiones
locales que comparten una misma sala.

Esta aplicación conserva ese principio. Los datos externos aportan impulsos,
pero no gobiernan por sí solos. La música surge de la fricción entre esos
impulsos, el tiempo de repetición y la escucha entre músicos.

## Los tres músicos

La formación actual contiene tres voces independientes:

- **Cuerdas:** ataque suave y material sostenido.
- **Percusión:** comportamiento seco e impulsivo.
- **Melodía:** figuras agudas y puntuales.

Cada músico posee:

- posición propia dentro de los 53 patrones;
- fuente de datos independiente;
- estado musical;
- historial de repeticiones y avances;
- tiempo de permanencia en el patrón;
- canal individual de escucha de vecinos;
- síntesis, volumen, color y comportamiento visual propios.

Los músicos no comparten una única decisión global. Cada uno calcula su
situación desde su propia posición.

## Cómo escucha cada músico

Cada músico mantiene un canal de análisis independiente. Ese canal observa:

- qué patrón está tocando;
- qué patrón tocaba anteriormente;
- quién es su vecino más cercano;
- quién está delante;
- quién está detrás;
- la distancia en patrones con cada vecino;
- si comparte unísono con alguien;
- si otro músico acaba de avanzar;
- si abre el frente del grupo;
- si sostiene la cola;
- si permanece dentro de la zona central de convivencia.

La diferencia es importante: el músico situado en el patrón 2 no percibe la
sala de la misma manera que uno situado en el patrón 5.

### Zona de convivencia

La implementación toma como referencia la recomendación interpretativa de no
separarse demasiado del conjunto.

- A una distancia de **0 patrones**, los músicos comparten unísono.
- Entre **1 y 3 patrones**, la escucha es cercana y conserva autonomía.
- Entre **4 y 6 patrones**, aparece una tensión útil.
- A distancias mayores, aparece aislamiento.

Si un músico abre demasiado el grupo, recibe presión para esperar a quienes
quedaron detrás. Si está demasiado atrasado, recibe una presión moderada para
recuperar distancia. Dentro de la zona cercana, puede permanecer, repetir o
avanzar según su propia combinación de señales.

### Escuchar un avance

Cuando un músico cercano avanza, deja un acontecimiento perceptible para los
demás. Ese movimiento no obliga a copiarlo. Produce una influencia breve:

- puede habilitar un avance;
- puede modificar la tensión;
- puede romper una repetición demasiado estable;
- puede ser ignorado si el músico todavía no maduró su patrón.

La influencia es local y temporal, como escuchar físicamente que otro
intérprete cambió de figura.

## Repetición y tiempo habitado

Repetir no es un error ni una ausencia de decisión. Es el material fundamental
de la obra.

Cada patrón necesita ser habitado antes de que un músico pueda abandonarlo. La
implementación utiliza tres momentos temporales:

- **Permanencia mínima: 30 segundos.** Antes de ese tiempo el avance autónomo
  está cerrado.
- **Maduración objetivo: 46 segundos.** A partir de allí la demanda comienza a
  relajarse.
- **Permanencia extensa: 74 segundos.** El tiempo acumulado empieza a ejercer
  una presión importante para evitar inmovilidad indefinida.

Estos valores no significan que todos los patrones duren exactamente lo mismo.
Las duraciones reales dependen de las figuras, las fuentes, los vecinos, la
memoria y el azar probabilístico. El objetivo es sostener una interpretación de
largo aliento, aproximadamente entre 30 y 50 minutos, en vez de recorrer los 53
patrones en pocos minutos.

### Memoria de repetición

Cada músico conserva un historial corto de sus decisiones.

La memoria permite distinguir:

- una repetición reciente que todavía transforma la escucha;
- una repetición estable que merece continuar;
- una permanencia prolongada que comienza a estancarse;
- una secuencia de varios ciclos sin avance;
- un cambio externo que ocurre después de muchas repeticiones.

La presión antiestancamiento aparece lentamente. No fuerza un avance inmediato:
se suma como una condición más dentro de la decisión individual.

## Cómo se decide un avance

Al terminar una ejecución del patrón, el músico construye primero un puntaje de
escucha. Ese puntaje reúne varias contribuciones:

### 1. Dato externo

Cada fuente se transforma en verbos musicales:

- **ENTRA:** habilita actividad.
- **AVANZA:** aporta presión de desplazamiento.
- **RETIENE:** favorece permanecer.
- **MUTA:** modifica el timbre.
- **SALE:** puede retirar temporalmente una voz.

### 2. Huella

Los patrones tocados dejan una marca temporal en la sala. La huella representa
memoria compartida: una región puede atraer, saturarse o indicar que una figura
ya fue intensamente habitada.

### 3. Cohesión

El músico compara su posición con el centro del grupo. La cohesión evita que una
voz se desconecte completamente del recorrido colectivo.

### 4. Separación

Cuando varias voces quedan demasiado pegadas, puede aparecer una presión leve
para abrir espacio. Esto evita que el sistema confunda convivencia con
sincronización permanente.

### 5. Momentum

Los avances recientes generan una corriente colectiva. El momentum resume si la
sala está quieta o atravesando una etapa de desplazamiento.

### 6. Impacto

Un avance produce una onda breve o *shockwave*. Los músicos cercanos pueden
sentir ese acontecimiento durante los ciclos siguientes.

### 7. Forma triangular

Las tres posiciones forman un triángulo conceptual en la vista circular. El
sistema mide:

- área actual;
- expansión;
- contracción;
- estabilidad;
- colapso;
- dispersión.

Una forma inmóvil durante mucho tiempo puede favorecer una transformación. Una
dispersión excesiva puede frenar al músico adelantado. Una contracción puede
activar separación o destrabe.

### 8. Escucha vecinal

Esta contribución es diferente para cada músico. Considera quién está delante,
quién detrás, quién acaba de avanzar y cuál es el rol local de la voz dentro del
grupo.

### 9. Secuencia personal

El historial de repeticiones y cambios de señal puede sumar una presión gradual
cuando una voz permanece demasiado tiempo sin producir una transformación.

### 10. Frenos

La distancia excesiva, una retención fuerte o una intervención manual negativa
pueden reducir el puntaje.

## Puntaje, demanda y probabilidad

El puntaje bruto no se utiliza directamente como probabilidad de avance.

Primero se aplica una **demanda de avance**:

- al comienzo del patrón la demanda es alta;
- la demanda disminuye cuando el patrón madura;
- antes de la permanencia mínima la probabilidad final es cero;
- después de una permanencia extensa, el tiempo puede ayudar a liberar el
  patrón.

El procedimiento general es:

```text
datos externos
  + huella
  + cohesión
  + separación
  + momentum
  + impacto
  + geometría
  + escucha vecinal
  + memoria personal
  - frenos
  = puntaje de escucha

puntaje de escucha
  + tiempo habitado
  + demanda de maduración
  = probabilidad final de avance
```

Finalmente se realiza una decisión probabilística. Dos situaciones idénticas
pueden producir respuestas distintas, pero nunca fuera de las restricciones de
orden: un músico solo puede permanecer o avanzar al patrón siguiente.

## Estados musicales

Cada músico atraviesa una máquina de estados:

- **DORMIDO:** no participa.
- **ARMADO:** tiene una fuente conectada y espera suficiente señal.
- **SONANDO:** interpreta y puede evaluar un avance.
- **RETENIDO:** la fuente o la sala favorecen repetir.
- **DESCANSANDO:** reduce temporalmente su actividad.
- **DESBORDADO:** demasiadas entradas producen mayor inestabilidad.
- **PERIFÉRICO:** la lente país reduce su audibilidad o centralidad.

Los estados afectan interpretación, volumen, posibilidad de avance y respuesta
visual.

## Fuentes del mundo real

La aplicación utiliza APIs públicas sin claves privadas:

- **Open-Meteo:** temperatura, cambio térmico y viento de una ciudad elegida.
- **CoinGecko:** precio, cambio y volatilidad de grupos de activos.
- **RSS públicos:** titulares, palabras y categorías semánticas.
- **World Bank Open Data:** indicadores sociales, ambientales y económicos con
  sus códigos oficiales.
- **UNHCR Refugee Data Finder API:** población refugiada por país de origen.

Las fuentes no tocan notas directamente. Se normalizan y se convierten en
presiones musicales que cada músico interpreta desde su propia situación.

### Lente país

La lente país modifica la audibilidad de los músicos a partir de un indicador
seleccionado. Entre otros, están disponibles:

- desigualdad;
- pobreza extrema;
- emisiones de CO2;
- mortalidad infantil;
- expectativa de vida;
- acceso a agua potable;
- gasto militar;
- refugiados de origen;
- alfabetización;
- acceso a internet.

Los datos provienen de World Bank, excepto refugiados, que utiliza directamente
UNHCR. La aplicación busca el último registro real disponible y muestra el año
y la fuente utilizados.

## Intervenciones del convocante

El usuario puede intervenir sin reemplazar la autonomía del sistema:

- avanzar un músico un patrón;
- elegir al azar un músico para avanzar;
- redistribuir las fuentes entre los tres músicos;
- redistribuir y empujar el conjunto;
- modificar presión, permiso, timbre, volumen, aura y brillo;
- cambiar ciudad, activos, país, indicador y selección de noticias.

Los avances manuales no pasan por la compuerta temporal. Son gestos explícitos
del convocante.

## Ritmo y pulso compartido

La obra parte de **70 BPM**. El tempo se escribe directamente como un número en
el panel RITMO; no hay un deslizador que pueda moverlo accidentalmente.

La grilla común se ejecuta con `Tone.Transport`, de modo que el pulso y los
límites de cada patrón comparten el mismo reloj de audio. La volatilidad puede
reducir levemente el acento, pero no desplaza ni omite el pulso.

El pulso de medición usa por defecto un timbre electrónico breve. Desde el
panel de RITMO (dispuesto en una grilla compacta) se pueden cambiar:

- BPM;
- forma de onda del pulso;
- frecuencia;
- volumen;
- **bombo (kick) sincronizado opcional**, para aportar mayor tracción rítmica.

La voz de percusión autónoma también utiliza por defecto **Pulso FM**, un ataque
sintético corto con modulación de frecuencia, en lugar del sonido de madera o
clave.

## Sintetizador acompañante

Existe una cuarta voz manual que no participa de las decisiones autónomas de la
sala. Sirve para acompañar la obra con notas sostenidas o drones.

Las teclas numéricas forman una escala ascendente de Do:

| Tecla | Nota |
|------:|:-----|
| 1 | C4 |
| 2 | D4 |
| 3 | E4 |
| 4 | F4 |
| 5 | G4 |
| 6 | A4 |
| 7 | B4 |
| 8 | C5 |
| 9 | D5 |
| 0 | E5 |

Controles disponibles:

- encendido y apagado;
- modo HOLD;
- soltar todas las notas;
- síntesis subtractiva, AM o FM;
- onda senoidal, triangular, sierra o cuadrada;
- ataque, decay, sustain y release;
- filtro;
- reverb;
- volumen.

En modo HOLD, una tecla activa la nota y una segunda pulsación la libera.

## Visualizaciones

### Partitura

Muestra los 53 patrones horizontalmente y cada músico en su propia línea.

Incluye:

- posición actual;
- zona Riley alrededor del centro;
- líneas de escucha;
- distancia entre músicos;
- contribución del mundo y de la sala;
- probabilidad final;
- ondas de avance;
- huellas de patrones anteriores.

### Círculo

Distribuye cada músico sobre un eje radial. La distancia al centro representa el
avance dentro de la obra.

Incluye:

- triángulo formado por los tres músicos;
- centro de masa;
- huella radial;
- hilos de cohesión;
- ondas de impacto;
- probabilidad de avance;
- estado de expansión o contracción de la forma.

## Arquitectura

```text
src/
├── audio/
│   ├── Engine.js             Secuenciación autónoma con Tone.js
│   ├── PlayableSynth.js      Sintetizador manual 1–0
│   ├── Pulse.js              Pulso compartido
│   └── presets.js            Presets de síntesis
├── data/
│   ├── config.json           Formación instrumental
│   ├── mappings.json         Pesos, umbrales y tiempos
│   ├── paises.json           Países e indicadores oficiales
│   └── patterns.json         Los 53 patrones
├── data-sources/             Adaptadores de APIs públicas
├── logic/
│   ├── Instrumento.js        Memoria y decisión individual
│   ├── LaSala.js             Convivencia y escucha compartida
│   └── StateMachine.js       Estados musicales
├── ui/
│   ├── CircleView.js         Vista radial
│   ├── PartituraView.js      Vista horizontal
│   └── controls.js           Controles del sidebar
└── main.js                   Composición e integración general
```

## Ejecución local

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev
```

La aplicación queda disponible en:

```text
http://localhost:5173/incysynth/
```

Para generar la versión estática:

```bash
npm run build
```

Los archivos de producción se generan en `dist/`.

## Despliegue

El repositorio incluye un workflow de GitHub Actions que construye y publica la
aplicación en GitHub Pages cuando se actualiza `main`.

## Idea central

Los datos no sustituyen a los músicos. Funcionan como circunstancias.

La composición aparece cuando cada voz transforma esas circunstancias mediante
repetición, memoria, atención y convivencia. El sistema no pregunta solamente
“¿qué dicen los datos?”, sino:

> ¿Qué hace un músico con ese impulso después de escuchar dónde está, cuánto
> tiempo lleva allí y qué están haciendo los otros?

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

- **Cuerdas (Vocoder / Coral):** texturaominosa y profunda, voces procesadas de material sostenido que asientan la obra.
- **Percusión (Vibráfono / Campana):** ataque inmediato y decaimiento lento, funciona como reloj y motor secuencial.
- **Melodía (Rhodes onírico):** figuras agudas y armónicos metálicos suaves, con largo sustain y protagonismo melódico.

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

El sistema utiliza dos capas de memoria para evaluar el tiempo histórico de los músicos en la obra:

1. **Memoria corta (secuencia personal):** El historial reciente de repeticiones y cambios de señal que permite distinguir si una repetición está justificada o se está estancando, pudiendo aportar presión gradual en la decisión individual.
2. **Memoria larga (huella histórica):** La sala conserva un registro de qué patrones fueron habitados con mayor intensidad durante la pieza (con un tiempo de decaimiento de varios minutos). Un patrón "agotado" presiona a la voz para abandonarlo, mientras que un territorio "fresco" genera atracción natural.

## Cómo se decide un avance

Al terminar una ejecución del patrón, el músico construye primero un puntaje de
escucha. Ese puntaje reúne varias contribuciones:

### 1. Dato externo

Cada fuente de datos (clima, cripto, noticias) no toca una "nota" directamente, sino que se normaliza y se traduce a "verbos" que alteran el comportamiento del instrumento en tiempo real:

- **ENTRA:** Autoriza la actividad del músico. Si la señal de entrada cae demasiado, el instrumento entra en estado "Descansando" y su volumen cae drásticamente.
- **AVANZA:** Acumula la presión que le indica al músico que debe pasar al siguiente patrón de la partitura. Al ocurrir un avance, la posición cambia y se emite un "impacto" o *shockwave* que otros músicos pueden sentir.
- **RETIENE:** Controla los "silencios voluntarios". Si esta señal es alta, el músico aumenta la probabilidad matemática de omitir (no tocar) determinadas notas dentro de su patrón repitente. Esto otorga al instrumento una respiración natural en lugar de sonar como un loop rígido de computadora.
- **MUTA:** Interviene directamente en el sintetizador. Abre la frecuencia de corte (cutoff) del filtro paso bajo: valores altos de Muta hacen que el sonido del instrumento se vuelva drásticamente más brillante, afilado y agresivo, destacándolo armónicamente en la mezcla.
- **SALE:** Reduce la presencia de la voz, llevándola al silencio o retirándola temporalmente del ensamble.

Además, los parámetros macros como la **Lente País** afectan la "Audibilidad" de todo el canal, hundiendo o elevando el volumen base del instrumento según si el país elegido tiene un indicador extremo, promedio o central. Finalmente, el nivel general de **Volatilidad** en el mundo externo degrada directamente el volumen del "Reloj Maestro" (el pulso metronómico), enmascarándolo cuando el mundo exterior está agitado.

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

Primero se aplica la **Maduración temporal**:

El tiempo habitado funciona como una compuerta o *modulador*, no como un reemplazo de las variables de la sala. Antes de la **permanencia mínima (30s)**, la probabilidad de avance es estrictamente cero. Al superar el **objetivo (46s)**, la compuerta se abre completamente. Finalmente, al excederse hacia la **permanencia máxima (74s)**, se añade un *bonus de urgencia* para evitar el estancamiento permanente.

Esta modulación garantiza que las señales de la sala (geometría, cohesión, stigmergía) y del mundo real decidan *hacia dónde y por qué* se avanza, pero el tiempo determina *cuándo* están autorizados a hacerlo.

El procedimiento general es:

```text
datos externos
  + huella (stigmergía)
  + cohesión
  + separación
  + momentum
  + impacto
  + geometría
  + escucha vecinal
  + memoria larga
  - frenos
  = puntaje de escucha

probabilidad bruta = puntaje de escucha × maduración temporal × variación de ciclo aleatoria
probabilidad final = cap_dinámico(probabilidad bruta)
```

El límite o *cap dinámico* empieza en 65% (para asegurar fricción al inicio) y crece hacia el 90% a medida que el músico se acerca al patrón 53, favoreciendo una resolución más fluida hacia el clímax de la pieza. Adicionalmente, el sistema contempla **silencios voluntarios**: la señal de retención permite que los intérpretes omitan aleatoriamente la ejecución de algunas notas dentro de un patrón repitente, otorgándole a la pieza una respiración orgánica en lugar de una repetición rígida.

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
estructural de una nación (ej. PBI, Gini, Desempleo). Este filtro macroeconómico
rota automáticamente cada 60 segundos eligiendo un país y un indicador al azar,
y clasifica el resultado en tres estados:

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

Existe una voz manual adicional que no participa de las decisiones autónomas de
la sala. Sirve para acompañar la obra con notas sostenidas o drones.

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

## Cuarto músico

La app incluye una capa opcional de IA llamada **CUARTO MÚSICO**. No agrega un
instrumentista nuevo ni reemplaza las reglas de la sala: escucha a los tres
músicos y modula el sistema según el nivel del dial.

La tarjeta de control tiene un switch master **IA ON/OFF** y un dial de
intensidad (0–100%). OFF fuerza 0%; ON vuelve al último nivel activo.

### Cómo funciona cada capa

```
0%   → reglas puras (sin IA)
>10% → Capa 1: VAE Timbre
>30% → Capa 2: LSTM de Estilo (suma Capa 1)
>50% → Capa 3: GNN Social     (suma Capas 1 y 2)
tog  → Capa 4: Escucha FFT    (toggle independiente del dial)
```

Cada capa agrega o sustrae un pequeño delta (±0.08–0.12) a la probabilidad de
avance del instrumento. Las capas no se reemplazan: se acumulan.

#### Capa 1 — VAE de Timbre (>10%)

Un autoencoder variacional entrenado offline mapea el estado del músico
(posición, audibilidad, retención, volatilidad) a un punto en un espacio de 4
dimensiones. El decoder produce parámetros de síntesis FM/AM (harmonicidad,
índice de modulación, filtro, envolvente) que se interpolan suavemente desde el
preset base.

Resultado: el timbre muta de forma continua según el contexto. Un músico
desbordado suena diferente a uno periférico. El cambio es audible, no computable.

#### Capa 2 — LSTM de Estilo Temporal (>30%)

Cada músico mantiene en memoria los últimos 20 ciclos de los demás (9 features:
posición, estado, señal, verbos, repeticiones). Un LSTM pequeño —entrenado en
vivo en el navegador— aprende a predecir si cada compañero avanzará o repetirá.

La diferencia entre predicción y acción real es la **sorpresa**. Cuando un
músico es más impredecible de lo esperado, eso empuja ligeramente hacia adelante;
cuando es muy predecible (sorpresa baja), frena. El sistema arranca sin saber
nada y calibra su confianza a medida que acumula muestras (~3 minutos para
confianza máxima).

#### Capa 3 — GNN Social (>50%)

Un grafo de 3 nodos (uno por músico) con message-passing en JS puro. Cada nodo
agrega las diferencias de feature con sus vecinos, aplica una transformación
lineal + ReLU y produce una presión social: ¿cuánto te están "jalando" o
"frenando" los otros desde la perspectiva de la red?

Resultado: emergen roles dinámicos. Dos músicos pueden estar "pegados" mientras
el tercero explora por delante. El líder recibe freno suave; los rezagados,
impulso. Los roles rotan a medida que la partitura avanza.

#### Capa 4 — Escucha Ambiente FFT (toggle independiente)

Analiza el audio del micrófono del oyente con Web Audio API (sin modelo ML).
Clasifica el entorno en bandas de frecuencia y lo traduce a verbos musicales:

| Condición de la sala | Verbo → Efecto |
|---|---|
| Silencio total | RETIENE → frena los músicos |
| Impulso súbito (aplauso, golpe) | ENTRA → impulso de avance |
| Graves dominantes (tráfico, bajo) | AVANZA → presión de avance |
| Estática o agudos aislados | SALE → retira presión |
| Ambiente suave general | RETIENE leve |

El oyente pasa a ser parte de la obra sin saberlo.

### Session Logger

Siempre activo. Registra cada ciclo de decisión (posición, motivo, z-vector VAE,
predicción LSTM, presión GNN, verbo FFT) en RAM y hace backup a `localStorage`
cada 30 eventos. El botón **GUARDAR LOG** descarga el JSON completo.

Esos logs son la materia prima para las fases futuras: entrenar RAVE con audio
real del sistema y diseñar la política de aprendizaje por refuerzo (MARL).

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
│   ├── raveCapture.js        Grabación de audio para corpus RAVE
│   ├── PlayableSynth.js      Sintetizador manual 1–0
│   ├── Pulse.js              Pulso compartido
│   └── presets.js            Presets de síntesis
├── data/
│   ├── config.json           Formación instrumental
│   ├── mappings.json         Pesos, umbrales y tiempos
│   ├── paises.json           Países e indicadores oficiales
│   └── patterns.json         Los 53 patrones
├── data-sources/             Adaptadores de APIs públicas
├── ai/
│   ├── cuartoMusico.js       Orquestador: dial, capas, logger
│   ├── vaeTimbre.js          Capa 1: decoder VAE de timbre en JS puro
│   ├── lstmEstilo.js         Capa 2: LSTM online de estilo temporal
│   ├── gnnSocial.js          Capa 3: GNN de roles sociales en JS puro
│   ├── yamnet.js             Capa 4: Escucha ambiente por FFT (Web Audio)
│   ├── sessionLogger.js      Logger de ciclos para calibración y RAVE/MARL
│   ├── marl/
│   │   └── rewardFunction.js Función de recompensa MARL (Fase 6)
│   └── pesos/
│       └── vae_decoder.json  Pesos del decoder VAE (205 KB)
├── logic/
│   ├── Instrumento.js        Memoria y decisión individual
│   ├── LaSala.js             Convivencia y escucha compartida
│   └── StateMachine.js       Estados musicales
├── ui/
│   ├── CircleView.js         Vista radial
│   ├── PartituraView.js      Vista horizontal
│   ├── cuartoMusicoControl.js Control del cuarto músico
│   └── controls.js           Controles del sidebar
└── main.js                   Composición e integración general

lab/
├── 01_vae_timbre/            Scripts de entrenamiento VAE (PyTorch/MPS)
└── 05_rave/
    └── preparar_corpus.py   Convierte audio.webm + sync.json → chunks WAV
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
## License

MIT License — © 2026 [Vladimiro Bellini](https://github.com/vlasvlasvlas). Free to use and modify, attribution required.

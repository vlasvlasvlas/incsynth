# In C: fidelidad musical y lectura de la interfaz

## Resultado y alcance

Se reemplazaron las 53 figuras del repertorio anterior mediante transcripción visual de la primera página de `terryriley-inc.pdf`, aportado por el usuario. Se realizó una segunda pasada visual por todas las filas, comprobando alturas, octavas, orden, figuras rítmicas, puntillos, silencios, adornos y ligaduras. Esta segunda pasada corrigió, entre otros detalles, las alturas de la figura 14 y las seis semicorcheas iniciales de la 32.

Esto es un cotejo realizado por el mismo revisor en dos pasadas, **no una certificación editorial ni dos transcripciones independientes**. Las revisiones delegadas no completaron una doble transcripción por límite de uso; no se presentan como evidencia de unanimidad de tres expertos. No se hizo una escucha completa de una interpretación de principio a fin.

Fuente: `terryriley-inc.pdf`, archivo aportado para esta revisión.
SHA256: `456cf0757c4a68aac7abfa1411576e7701d3e02c98268bdb8deedb597baa26f6`.
La página 1 contiene las figuras; las páginas 2 y 3, las instrucciones de interpretación. Este archivo identifica la edición efectivamente cotejada; no demuestra por sí solo autenticidad editorial.

La [transcripción legible](in-c-transcripcion.txt) enumera cada evento de las 53 figuras. El [registro de verificación](in-c-verificacion.json) conserva conteos, duración total y huella de cada figura. Los datos que usa el motor están en [patterns.json](../src/data/patterns.json). Las huellas detectan modificaciones posteriores; **un hash o una prueba que pasa no demuestra que una nota esté bien leída**. La evidencia musical es el cotejo visual con el PDF.

## 1. Relación con la obra original

La identidad de la obra combina material escrito preciso y libertad de interpretación. Las 53 figuras no son sugerencias de notas para improvisar: los intérpretes recorren la misma secuencia, repitiendo cada figura y escuchándose. La autonomía está principalmente en las repeticiones, entradas, silencios, dinámica y relaciones con el conjunto.

| Aspecto | Instrucciones del PDF | Esta aplicación y valoración |
| --- | --- | --- |
| Material | 53 figuras en secuencia, interpretadas cuidadosamente. | Ahora el repertorio está retranscrito desde la página 1, con silencios, ligaduras y adornos explícitos. Antes había diferencias importantes de altura, duración y orden. |
| Repeticiones | Cada intérprete decide cuánto repetir; no apresurarse. | Cada voz toma decisiones al terminar la figura. Es una traducción algorítmica de la autonomía. Los controles manuales ahora esperan ese límite y no acumulan saltos. |
| Escucha | Escucha atenta, descansos ocasionales para oír a los demás. | La aplicación calcula posiciones, memoria y señales. Modela ciertas relaciones, pero no equivale a escuchar musicalmente el sonido del conjunto. |
| Distancia | Mantenerse aproximadamente a dos o tres figuras de los demás. | La lógica admite distancias mayores como tensión. Es una diferencia expresiva que conviene declarar; no debe presentarse como regla de Riley. |
| Pulso y desfase | Pulso estricto; unísonos, cánones y desplazamientos rítmicos. El pulso de Do agudo en corcheas puede ayudar. | El reloj musical compartido y las entradas escalonadas son compatibles con esa lógica. El tempo y la instrumentación electrónica son elecciones permitidas. |
| Cantidad | Cualquier cantidad e instrumentos; el texto propone unos 35 si es posible. | Tres voces son admisibles, aunque ofrecen una densidad y diversidad menores. |
| Transformaciones | Se permiten transposiciones de octava y aumentación rítmica. | No justifican alterar arbitrariamente alturas ni borrar notas aisladas. Se retiró la omisión aleatoria de notas; se conservan descansos por frases. |
| Datos externos | No forman parte de las instrucciones. | Clima, mercados y noticias son la propuesta propia de Mundo Real. Son una reinterpretación de la agencia de los intérpretes. |
| Final | Esperar en 53; varios crescendos y diminuendos; salida individual. | Se preservó la espera común incluso al desactivar la evolución expresiva. La coda temporizada y el reinicio de instalación siguen siendo decisiones de esta versión; no reproducen literalmente todo el final indicado. |

**Valoración:** la propuesta tiene sentido como reinterpretación generativa de In C. Para respetar su espíritu, la interfaz debe hacer perceptibles la repetición, la escucha y el entrelazado; un indicador de progreso por sí solo puede sugerir una carrera hacia 53. Corregir el material escrito era prioritario. La fidelidad de las notas no convierte todas las reglas generativas en reglas originales del compositor.

## 2. Cómo se muestra lo que toca cada intérprete

Se agregó una ficha por intérprete con la figura actual y una miniatura de su contorno y ritmo. Al hacer clic se abre una lectura ampliada: nombre de nota y octava, duración, silencios, adornos y continuidad de ligaduras. El resaltado sigue el evento que está ejecutando el motor en el reloj de audio, no el próximo evento que el planificador ya preparó.

La figura completa sigue visible; el detalle largo se puede desplazar. Abrir y cerrar es una consulta, sin avanzar ni cambiar el sonido. Se distinguen vista previa detenida, espera, ejecución, silencio escrito y descanso de frase. El color conserva la identidad del instrumento.

Es una **lectura rítmica con barras**, no una reproducción de la notación manuscrita ni un pentagrama. Esta elección ayuda a quien no lee música: altura vertical representa registro y ancho representa duración. Un futuro pentagrama sería útil para cotejar visualmente la edición, pero no es necesario para identificar notas y eventos en esta vista. La audibilidad también depende del volumen, envolventes y efectos: el resaltado indica ejecución, no una medición de la señal acústica.

## 3. Control de las figuras y decisiones interpretativas

Se conservó Do central como C4. Las ligaduras tienen un solo ataque y mantienen la duración sumada; el lector puede mostrar sus segmentos escritos sin reatacarlos. Los silencios ocupan su duración completa. Las duraciones se programan en unidades musicales para conservarse al cambiar el tempo.

Los adornos Do4 de las figuras 1 y 2 se conservan explícitamente. **La partitura no fija su duración exacta en milisegundos ni una fracción métrica.** El motor les asigna aproximadamente el primer octavo de la duración de la nota principal, sin alargar la figura. Esta es una convención de realización, documentada, y no una precisión atribuida a Riley.

Puntos especialmente comprobados:

- 1–2: adornos Do4 antes de Mi4, sin convertirlos en notas ordinarias del mismo valor.
- 6 y 8: notas largas ligadas; 7 y 9: silencios completos y Do4 de la figura 7.
- 13: puntillos, silencio y Sol4 ligado; 14: Do5, Si4, Sol4, Fa♯4.
- 17: silencio de semicorchea; 19: silencio y Sol5 de negra con puntillo; 20: La3.
- 22–26: cinco repeticiones con puntillo de la altura característica de cada figura y duración precisa de la cola.
- 32: seis semicorcheas, la última Fa4 ligada a blanca con puntillo, luego Sol4 de negra con puntillo.
- 35: diez semicorcheas iniciales, silencios, Si♭4, registro agudo con Si5 natural, Fa♯5, Fa5 natural final y tres ligaduras; duración total: 29 negras.
- 42: Do5, Si4, La4, Do5; 44: Mi5 ligado y Do5 final.
- 48: Sol4 redonda con puntillo, Sol4 redonda, Fa4 redonda ligada a negra.
- 49–53: Si♭ explícito y orden de notas; 53 empieza Si♭4–Sol4.

## Validación

Resultado de esta revisión: **34 pruebas aprobadas**, compilación de producción correcta y comprobación visual del lector en ejecución y detenido. La compilación advierte del tamaño de algunos paquetes, sin impedir la generación.

Las pruebas automáticas verifican la programación de silencios, adornos y ligaduras, el avance al terminar una figura, la correspondencia del lector con el reloj de audio y la integridad de las 53 figuras cotejadas. Las pruebas del repertorio incluyen puntos de control concretos y el registro de cada figura. La compilación de producción también se verifica.

La comprobación en navegador cubre la apertura del lector, los nombres y duraciones visibles, la indicación de ejecución y la vuelta a vista previa al detener. Esta validación no sustituye una interpretación completa escuchada ni una revisión musicológica independiente.

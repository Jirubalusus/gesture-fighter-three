# Gesture Fighter Three

Prototype de pelea 2.5D en **Three.js** donde los ataques salen de gestos táctiles.

## Estado

Sí es posible crear el juego: el navegador permite leer gestos con Pointer Events y Three.js va bien para un escenario 2.5D. Lo que no conviene prometer en un MVP es reconocimiento perfecto tipo IA: por ahora hay un reconocedor geométrico robusto, editable y testeable. La base está lista para añadir más plantillas o entrenar un modelo más adelante.

## Controles

- **Hadoken:** pulsa/arrastra dibujando un `3`, termina con un flick en la dirección y suelta.
- **Escudo:** dibuja un círculo cerrado.
- **Swipe derecha/izquierda:** dash.
- **Swipe arriba:** uppercut.
- **Reset:** reinicia el combate.

Funciona con dedo en móvil y con ratón en desktop.

## Desarrollo

```bash
npm install
npm run test:gestures
npm run build
npm run dev -- --host 0.0.0.0 --port 5173
```

## Estructura

- `src/main.js` — escena Three.js, combate, input táctil, HUD.
- `src/gestureRecognizer.js` — suavizado, resampling, normalización y clasificación de gestos.
- `scripts/test-gestures.mjs` — tests sintéticos para `3`, círculo y swipes.
- `src/styles.css` — UI mobile-first.

## Próximos pasos recomendados

1. Añadir modo entrenamiento que pinte la plantilla ideal del gesto.
2. Guardar gestos reales del usuario para afinar plantillas.
3. Añadir más combos: cuarto de luna, Z, doble swipe, carga larga.
4. Sustituir cuerpos geométricos por modelos low-poly propios.
5. Añadir rollback/online solo si el loop local queda divertido.

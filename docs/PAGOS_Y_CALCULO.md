# Pagos, cálculo y protección del servidor (V8)

Este documento explica **qué hace cada fórmula, dónde está el código y cómo probarla**.
Todo el cálculo vive en el **backend** (el navegador solo muestra lo que el servidor responde).

| Requerimiento | Matemática | Código |
|---|---|---|
| Costo total | P(x) = B·x·C − D(p) | `backend/lib/pricing.js` → `totalCost` · `controllers/checkoutController.js` |
| Comisión del Agente | L(E,T) = b·E + m·T (lineal) | `controllers/reportController.js` → `agentCommission` |
| Ingresos por mes 2026 | área bajo la curva ∫ f(t) dt | `lib/calculus.js` → `integrate` · `reportController.monthlyRevenue` |
| Aforo | límite por la izquierda s = inscritos/aforo → 1⁻ | `lib/capacity.js` + función SQL `sales_state_for` |
| Precios dinámicos | r = dI/dt y máximos locales | `lib/pricing.js` → `evaluateDynamicPrice` · `controllers/pricingController.js` |
| Precio ideal | D(x)=M−kx · I(x)=Mx−kx² · I′=0 ⇒ x\*=M/2k · I″=−2k<0 | `lib/optimization.js` · `controllers/priceSuggestionController.js` |
| Fila virtual | T(x) = k/(C−x)+Tb · T′(x) = k/(C−x)² | `lib/traffic.js` → `virtualQueueGate` (middleware) |

## 1. Costo total P(x) = (B·x·C) − D(p)

- **x** entradas (1 a 6 por compra) · **B** precio base del evento (`events.price_cop`).
- **C** coeficiente de la zona, función a trozos: general = 1,0 · preferencial = 1,5 · VIP = 2,5 (tabla `zones`).
- **D(p)** = descuento por puntos + oferta de nuevo ingreso:
  - Puntos: 1 punto = $25. Máximo 30 % del subtotal.
  - Nuevo ingreso: 10 % en la **primera compra** de una cuenta sin inscripciones ni pagos (`is_new_member`).
  - Tope global: entre ambos nunca superan el 50 % del subtotal.
- Se ganan **1 punto por cada $1.000 pagados** (sobre el total).

**Ejemplo real (verificado en el navegador):** cuenta nueva con 100 puntos, Color Fest ($35.000), 2 entradas VIP, usando puntos:

```
Subtotal = 35.000 · 2 · 2,5            = 175.000
Puntos   = 100 pts · $25               =   2.500
Nuevo ingreso = 10 % de 175.000        =  17.500
P(2) = 175.000 − 2.500 − 17.500        = 155.000   → gana 155 puntos
```

**Seguridad del cálculo:** el servidor recalcula todo y la función SQL `confirm_checkout` lo **vuelve a validar bajo bloqueo** (precio, zona, aforo, puntos, oferta). Una restricción `chk_payment_math` impide guardar un pago cuyo total no sea `subtotal − descuentos`.

### Flujo de pago
1. `POST /api/checkout/quote` → cotiza sin cobrar (el modal lo llama cada vez que cambias cantidad, zona o puntos).
2. `POST /api/checkout` → pasarela simulada → `confirm_checkout` (una sola transacción: pago + entradas + puntos). Si la base rechaza, el cobro simulado se anula.
3. `POST /api/unregister` → cancela **todas** las entradas de esa compra, marca el pago como `reembolsado` y devuelve/retira los puntos.

### Tarjetas de prueba (pasarela simulada, no se cobra nada)
| Método | Aprobado | Rechazado |
|---|---|---|
| Tarjeta | `4242 4242 4242 4242`, cualquier fecha futura y CVV de 3 dígitos | número terminado en `0002` |
| Nequi | celular de 10 dígitos que empiece por 3 | celular terminado en `0000` |
| PSE | cualquier banco de la lista | — |

El número completo y el CVV **nunca se guardan**: la base solo conserva marca y últimos 4 dígitos.

## 2. Comisión del Agente (función lineal)

`L(E, T) = b·E + m·T` con **b = $40.000 por evento** y **m = $1.200 por entrada** (tabla `commission_rules`, editable).
E = eventos no cancelados de los que es Agente (EVENTO.id_agente) · T = entradas con reserva «Confirmada» en esos eventos (en V10 ya no hay check-in). Se guarda en `AGENTE.comision`. Se ve en **Dashboard del Agente → Mi liquidación**, con el desglose por evento.

## 3. Reporte de ingresos 2026 (integral)

f(t) = ingresos del día t (COP/día). Ingreso del mes = ∫ f(t) dt ≈ Σ f(tᵢ)·Δt con Δt = 1 día; el acumulado F(t) = ∫₀ᵗ f(t) dt.
El reporte compara el resultado con un `SUM()` directo de SQL y muestra **«Verificado»** si coinciden al peso. También calcula la regla del trapecio (`approxTrapezoidCop`) como comparación.
Se ve en **Admin → Finanzas y estadísticas → Ingresos por mes**. API: `GET /api/admin/reports/revenue?year=2026`.

## 4. Aforo y precios dinámicos

**Aforo (límite por la izquierda).** Con s = inscritos/aforo acercándose a 1 por la izquierda, el estado del evento cambia solo, por triggers en la base:
`disponible` → **`ultimos_cupos`** cuando quedan ≤ máx(1, ⌈10 % del aforo⌉) → **`agotado`** al llegar a 0. Se actualiza al inscribir, cancelar o cambiar el aforo. Nunca se vende más de lo que cabe (bloqueo `FOR UPDATE`).

**Precios dinámicos.** I(t) = ingresos acumulados del evento; r = dI/dt (diferencia finita por intervalo de 60 min).
Un **máximo local** es un punto con r₍ᵢ₋₁₎ < rᵢ ≥ r₍ᵢ₊₁₎ (la derivada pasa de + a −). Si el último pico confirmado supera 150.000 COP/h **y** 1,25 veces el promedio reciente, el precio sube un paso (+5 %, redondeado a $500) con tope de +30 % sobre el precio base fijado por el Agente. Si la demanda se enfría (r ≤ 0,5·promedio), baja un paso. Hay 60 min de espera entre ajustes y cada cambio queda en `price_adjustments`.
Corre solo cada 60 s y tras cada venta; el Agente puede verlo en **Cupos y aforo → Demanda** (gráfica de r con los máximos marcados) y aplicarlo a mano.

## 5. Fila virtual (modelo de saturación)

`T(x) = k/(C − x) + Tb` y `T′(x) = k/(C − x)²`, con x = usuarios pagando a la vez.
Valores por defecto: C = 100, k = 200, Tb = 120 ms, umbral crítico T′ = 0,5 → el sistema se protege cuando **x ≥ C − √(k/umbral) = 80**.
El middleware `virtualQueueGate` va delante de `/checkout` y `/checkout/quote`:
- con turno vigente (cabecera `X-Queue-Ticket`) → pasa;
- si T′(x+1) ≤ umbral → recibe turno y pasa;
- si T′(x+1) > umbral → responde **429 `QUEUE_REQUIRED`** y el modal muestra la **Fila Virtual** (posición, personas delante, espera estimada y explicación con las fórmulas). El front consulta `/api/queue/status/:ticket` cada 2 s y entra solo al pago cuando le toca.

**Cómo verlo funcionando:** entra como Admin → *Tráfico del servidor* → mueve el control a 95 usuarios → **Simular**. Luego, en otra ventana, entra como usuario e intenta pagar: verás la fila. Pulsa **Detener** y el usuario pasa al pago.
> El estado de la fila vive en la memoria del proceso (sirve para un solo servidor). Para varios servidores habría que moverlo a Redis.

## 6. Precio ideal del boleto (cálculo diferencial)

Herramienta del Agente: en **Gestión de eventos → Crear/Editar evento** aparece el panel **«Precio ideal sugerido»**. Calcula solo el precio que maximiza los ingresos y tiene el botón **Usar este precio**. En «Ver el cálculo y ajustar M y k» se ven (y se pueden cambiar) los dos parámetros del modelo.

| Paso | Fórmula | Código |
|---|---|---|
| Demanda (boletos vendidos al precio x) | D(x) = M − k·x | `demand` |
| Ingresos | I(x) = x·D(x) = M·x − k·x² | `revenue` |
| 1.ª derivada (tasa de cambio) | I′(x) = M − 2k·x | `revenueFirstDerivative` |
| Punto crítico: I′(x) = 0 | M − 2k·x = 0 ⇒ **x\* = M / 2k** | `optimizeRevenue` |
| 2.ª derivada (garantía) | I″(x) = −2k **< 0** | `revenueSecondDerivative` |

M = mercado máximo (personas que irían si fuera gratis). k = sensibilidad (boletos que se pierden por cada $1 de aumento).

**Garantía del sistema (criterio de la 2.ª derivada).** Antes de sugerir nada, `optimizeRevenue` calcula I″ = −2k y **exige que sea negativa**: si M ≤ 0 o k ≤ 0 lanza un error y no devuelve precio (con k ≤ 0 la parábola no abriría hacia abajo y no habría máximo). Como I″ es constante y negativa en todo x, la parábola es cóncava hacia abajo y **x\* es un máximo global**, no solo local. Además se hace una comprobación numérica independiente: I(x\*−h) < I(x\*) y I(x\*+h) < I(x\*). Resultado: ingreso máximo I(x\*) = M²/4k con demanda D(x\*) = M/2. Dato útil: x\* = M/2k es **la mitad del precio al que nadie compraría** (M/k).

**Ejemplo:** M = 1.500 y k = 0,015 → D(x) = 1500 − 0,015x · I′(x) = 1500 − 0,03x · x\* = 1500/0,03 = **$50.000** · I″ = −0,03 < 0 ✓ · se venderían 750 boletos e ingresarían $37,5 M.

**De dónde salen M y k** (`estimateDemandModel`):
1. **Historial:** regresión por mínimos cuadrados con eventos *pagos del mismo tipo* que ya tienen ventas (llenado = inscritos/aforo contra precio; M = intercepto × aforo, k = pendiente × aforo). Se usa solo con ≥ 4 eventos, ≥ 3 precios distintos, pendiente negativa y R² ≥ 0,3.
2. **Estimación inicial** si no hay curva confiable: M = 1,5 × aforo y a $100.000 nadie compra (k = M/100.000). Es un punto de partida: ajústalo con lo que sepas de tu público.
3. **Manual:** lo que escribas en M y/o k manda; el campo vacío es automático.

**Dos ajustes honestos al óptimo teórico** (`recommendPrice`): (a) *aforo* — no se pueden vender más boletos que cupos; si D(x\*) > aforo, el precio recomendado sube hasta (M − aforo)/k, el mínimo que no sobrepasa los cupos; (b) el precio se redondea a $500 eligiendo el vecino que más ingresa. La API devuelve tanto el óptimo exacto (`optimum.price`) como el recomendado (`recommended.price`).

**Cautelas que muestra la pantalla:** si el precio sugerido queda muy lejos de lo que ya cobraste, avisa que el modelo *extrapola*; con pocos datos la confianza es «baja». El modelo es lineal y solo describe el precio base (zona general): las zonas preferencial y VIP lo multiplican por C. No cambia nada por sí solo: el Agente decide si lo usa.

API: `POST /api/events/price-suggestion` con `{ typeCode, capacity, eventId?, currentPrice?, M?, k? }`. Código: `backend/lib/optimization.js` (matemática pura), `backend/controllers/priceSuggestionController.js` (historial + respuesta), `js/pages/manager/price-ideal.js` (panel).

## Base de datos

**(V10)** Ejecuta en el *SQL Editor* de Neon, en este orden: `010_modelo_er.sql` → `011_soporte_negocio.sql` → `012_catalogos.sql` → `013_datos_demo.sql` → `014_verificaciones.sql` (ver `docs/MODELO_ER.md`). Texto de la V9: `001_schema.sql` → `002_seed.sql` → `004_payments.sql` → `005_payments_checks.sql` (verificación).
`004_payments.sql` se puede ejecutar varias veces sin romper nada. Agrega: `zones`, `payments`, `loyalty_ledger`, `commission_rules`, `price_adjustments`, la vista `v_agent_activity`, columnas `users.loyalty_points`, `events.base_price_cop`, `events.sales_state`, `attendees.payment_id/zone_code`, y las funciones `confirm_checkout` / `cancel_registration`. `000_reset.sql` borra todo (incluido lo nuevo).

## Pruebas

```
npm test                            # cálculo, precios, tráfico y pasarela (rápidas)
npm i -D @electric-sql/pglite       # opcional: activa además las pruebas de integración con Postgres real en memoria
```

## Lo que NO cubre todavía (por tu decisión)

- **Login real y permisos en la API:** el servidor confía en el `userId` que manda el navegador y las rutas de administración no exigen sesión. Es lo primero que hay que cerrar antes de publicar.
- Las cuentas creadas con el registro *mock* no existen en la base: al pagar responde «Tu cuenta no existe en la base de datos». Usa cuentas del seed o créalas desde Admin.
- La contraseña de Neon que venía en el `.env` de V7 debe **rotarse** (está en el historial de lo que compartiste).

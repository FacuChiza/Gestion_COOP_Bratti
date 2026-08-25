# Sistema de Aportes — Cooperadora Escolar Bratti
### Documento de contexto completo del proyecto

> **Para qué sirve este documento:** contiene todo el contexto del proyecto (qué es,
> cómo funciona, qué se construyó, cuánto cuesta y qué falta) para poder redactar a
> partir de él un informe, un presupuesto o una presentación para los directivos.
> Está pensado para ser leído por alguien que no participó del desarrollo.
>
> **Última actualización:** agosto 2026

---

## 1. Resumen ejecutivo

La Cooperadora de la **Escuela Técnica N° 34 "Bratti"** (Merlo, San Luis) gestionaba
los aportes voluntarios de las familias de forma manual. Se construyó una plataforma
web que permite:

- Que las familias **aporten online en menos de un minuto**, sin registrarse ni recordar
  contraseñas (escanean un QR o entran a la web, ponen el DNI del alumno y pagan).
- Que los directivos **administren todo desde un panel**, sin conocimientos técnicos:
  ver quién aportó y quién no, registrar pagos en efectivo, cambiar los montos,
  descargar informes en Excel y generar el resumen anual en PDF.

**Estado:** funcionando en producción con los 475 alumnos reales cargados.
Falta únicamente conectar la cuenta de cobro institucional para recibir dinero real.

**URL:** https://gestion-coop-bratti.vercel.app

---

## 2. El problema que resuelve

| Antes | Ahora |
|---|---|
| Cobro manual, en efectivo, en la escuela | Pago online 24/7 desde el celular |
| Registro en papel o planillas sueltas | Base de datos única y ordenada |
| No se sabía con certeza quién debía | Panel con estado de cada alumno en tiempo real |
| Recordatorios de boca en boca | Recordatorios automáticos por mail |
| Rendición de cuentas artesanal | Informes en Excel y resumen anual en PDF |

**Principio rector del diseño:** el aporte es **voluntario**. Toda la plataforma está
pensada para que aportar sea lo más fácil e invisible posible, sin presionar ni poner
trabas. El vocabulario es deliberado: se habla de *aportes* y *aportantes*, nunca de
*cuotas*, *deudores* ni *cobros*.

---

## 3. Cómo funciona hoy

### 3.1 Para la familia (aportante)

1. Escanea el **QR** pegado en la escuela (o entra a la web).
2. Escribe el **nombre o DNI del alumno** → aparecen sugerencias mientras tipea.
3. Ve el aporte del mes y elige cómo colaborar:
   - **Aporte del mes** — $10.000
   - **Aporte anual** — $100.000 (todo el ciclo de una vez)
   - **Débito automático** — $10.000/mes, se cobra solo (carga la tarjeta una vez)
   - **Monto libre** — colabora con lo que puede (mínimo $100)
   - **Transferencia** — a la cuenta de la cooperadora, sin comisión
4. Paga por Mercado Pago (acepta tarjeta de cualquier banco, dinero en cuenta o
   efectivo en Rapipago/Pago Fácil).
5. Recibe por mail el **comprobante oficial** con el logo de la escuela, descargable en PDF.

> **Sin registro, sin cuenta, sin contraseña.** Los datos del aportante se completan
> solos con lo que devuelve Mercado Pago.

**Descuento por hermanos:** si una familia tiene 2 o más alumnos, el sistema aplica
automáticamente $8.000 por alumno en lugar de $10.000.

### 3.2 Para los directivos (panel de administración)

Acceso con usuario y contraseña en `/admin`. Siete secciones:

| Sección | Para qué |
|---|---|
| **Alumnos** | Listado con estado del aporte del mes; editar, dar de baja, registrar aportes en efectivo |
| **Alertas** | Familias con 3 o más aportes sin realizar (umbral configurable) |
| **Aportes recibidos** | Todo lo cobrado, filtrable por ciclo lectivo; anular con motivo; ver comprobantes |
| **Padrón** | Importar la lista de alumnos desde un archivo (carga anual) |
| **QR** | Generar y descargar el QR para imprimir y pegar en la escuela |
| **Informes** | Resumen anual en PDF + exportes en Excel + prueba de envío de mails |
| **Ajustes** | Cambiar montos, umbrales, datos bancarios; generación mensual manual |

**Arriba de todo:** resumen económico con lo recaudado del mes y del año, lo pendiente
de cobro, alumnos activos y porcentaje al día.

### 3.3 Automatismos

| Proceso | Cuándo | Qué hace |
|---|---|---|
| **Generación mensual** | Día 1 de cada mes | Crea el aporte del mes para cada alumno activo y marca vencidos los del mes anterior |
| **Recordatorios** | Diario | Avisa a quien pasó un mes desde su último aporte, y alerta a quien acumula 3 o más |

Los recordatorios **respetan el ritmo de cada familia** (no se manda todo el mismo día)
y **excluyen a quienes tienen débito automático**.

---

## 4. Etapas de evolución del proyecto

### Etapa 1 — MVP inicial
Sistema con registro de familias, portal con usuario y contraseña, planes por turno
(diurno/nocturno), pagos por Mercado Pago y panel administrativo básico.

### Etapa 2 — Robustez y operabilidad
- Panel administrativo completo: editar alumnos y aportantes, anular aportes con
  auditoría, descuentos, exportes.
- **Parámetros editables por los directivos** sin tocar código.
- Automatización mensual y recordatorios inteligentes (anti-spam).
- Seguridad: acceso con sesión propia, protección de la base de datos por usuario.

### Etapa 3 — Rediseño centrado en la experiencia *(el cambio más importante)*

**Diagnóstico:** el registro pedía 8 datos antes de poder aportar. En un cobro
voluntario y de baja frecuencia (una vez por mes), cada campo extra es una familia
que abandona. Además, nadie recuerda una contraseña que usa 12 veces al año.

**Decisión:** invertir el modelo. La escuela ya tiene el padrón de alumnos, así que
en lugar de pedirle a cada familia que cargue sus datos, **se precarga el padrón** y
la familia solo "reconoce" a su hijo y paga.

**Resultado:** el flujo pasó de 8 campos + contraseña a **cero registro**.

Cambios asociados:
- Eliminación del portal con login y del registro.
- Buscador con sugerencias en vivo.
- Precios reales ($10.000 / $8.000 hermanos / $100.000 anual) editables.
- Comprobante formal descargable con el logo institucional.
- Informes en Excel formateados (antes CSV) y resumen anual en PDF.
- Vocabulario revisado en toda la plataforma.
- Manejo del ciclo lectivo año a año.

### Etapa 4 — Pendiente: puesta en producción real
Conectar las cuentas institucionales de cobro y hacer la prueba con dinero real.

---

## 5. Cómo se maneja el paso de los años

El **DNI del alumno es su identidad permanente**. Una vez al año, la cooperadora sube
el padrón actualizado que le da la escuela y el sistema resuelve todo solo:

| Situación | Qué pasa al reimportar |
|---|---|
| Pasan de curso | Se actualiza el curso automáticamente (mismo DNI) |
| Repiten | Queda igual |
| Ingresantes nuevos | Se agregan |
| Egresados / se van | Con la opción **"cierre de ciclo"** se dan de baja solos |

Los alumnos dados de baja **conservan todo su historial** de aportes; simplemente dejan
de generar aportes nuevos y no aparecen en los listados activos.

Los aportes quedan separados por ciclo lectivo: hay un **selector de año** para que lo
histórico no se mezcle con lo actual.

---

## 6. Estado actual (datos reales)

| Dato | Valor |
|---|---|
| Alumnos cargados y activos | **475** |
| Alumnos con DNI | 473 (2 pendientes de completar) |
| Cursos | 13 de día (1° a 7°) + 6 de adultos = **19 divisiones** |
| Aporte mensual | $10.000 |
| Aporte con hermanos | $8.000 por alumno |
| Aporte anual | $100.000 |
| Umbral de alerta | 3 aportes sin realizar |

**Recaudación potencial mensual estimada:** ~$4.750.000 si aportara el 100% de las
familias (475 × $10.000, sin descuentos por hermanos). En la práctica, al ser
voluntario, el porcentaje de adhesión real es la variable a medir.

### Qué está funcionando
✅ Padrón cargado · ✅ Pago online (las 4 modalidades) · ✅ Panel completo ·
✅ Comprobantes por mail · ✅ Informes Excel y PDF · ✅ Automatismos mensuales ·
✅ QR listo para imprimir

### Qué falta
🔴 Cuenta de cobro institucional (Mercado Pago con CUIT de la cooperadora)
🔴 Credenciales de producción + webhook (hoy están las de prueba)
🔴 Contraseña de administración robusta
🟡 Backups automáticos · 🟡 Dominio propio · 🟡 WhatsApp · 🟡 Prueba con dinero real

---

## 7. Costos

### 7.1 Comisión por cobro (único costo inevitable)

Se descuenta de cada aporte cobrado online:

| Modalidad de acreditación | Comisión aprox. | De $10.000 quedan |
|---|---|---|
| Inmediata | ~6,3–6,5% + IVA | ~$9.200 |
| **Diferida (~14 días)** | ~3,25–3,5% + IVA | ~$9.580 |

> **Recomendación:** usar acreditación **diferida**. La cooperadora no necesita el
> dinero al instante y se ahorra casi 3 puntos porcentuales.

**Transferencia bancaria y efectivo: comisión $0.** Por eso conviene mantenerlas
visibles como alternativa.

### 7.2 Servicios de la plataforma

| Servicio | Función | Plan gratis | Plan pago |
|---|---|---|---|
| Vercel | Hosting del sitio | ✅ Alcanza | ~USD 20/mes |
| Supabase | Base de datos | ✅ Alcanza, **sin backups** | ~USD 25/mes |
| Resend | Envío de mails | ✅ 3.000/mes (sobra) | ~USD 20/mes |
| Dominio .com.ar | Dirección propia | ❌ | ~$5.000–10.000/año |
| Twilio | WhatsApp | ❌ | Cuenta paga + costo por mensaje |

### 7.3 Escenarios

| Escenario | Costo mensual | Qué incluye |
|---|---|---|
| **Mínimo** | $0 (solo comisión MP) | Todo en planes gratuitos. Sin backups automáticos |
| **Recomendado** | ~USD 25 + dominio anual | Suma backups automáticos y dirección propia |
| **Completo** | ~USD 45–70 | Suma WhatsApp y hosting profesional |

> Los precios en dólares y las comisiones cambian con frecuencia: verificar antes de
> presentar cifras definitivas.

---

## 8. Qué necesita gestionar la cooperadora

Para que el sistema sea **institucional y no dependa de una persona**:

1. **CUIT de la cooperadora** — requisito para todo lo demás.
2. **Cuenta bancaria institucional** — para recibir transferencias directas.
3. **Cuenta de Mercado Pago con ese CUIT** — es donde entra el dinero.
4. **Email institucional** (ej. `cooperadora@…`) — para abrir todas las cuentas de
   servicios a nombre de la institución.
5. **Decisión sobre backups** — plan pago de la base o rutina de respaldo manual.
6. **Decisión sobre el dominio** — nombre y compra.

> ⚠️ **Punto crítico de continuidad:** hoy los servicios están a nombre del
> desarrollador. Si no se migran a cuentas institucionales, la cooperadora podría
> perder el acceso al sistema y a los datos ante cualquier cambio de personas.

---

## 9. Consideraciones legales y de privacidad

El sistema almacena **nombre, DNI y curso de 475 alumnos menores de edad**, además de
datos de contacto de los adultos responsables.

- Aplica la **Ley 25.326 de Protección de Datos Personales**.
- Recomendable: definir por escrito quién accede al panel, para qué se usan los datos
  y por cuánto tiempo se conservan.
- Hoy el acceso administrativo es **un único usuario compartido**; si van a acceder
  varios directivos, conviene evaluar accesos individuales para poder auditar quién
  hizo cada cosa.
- El sistema **no almacena datos de tarjetas**: todo el procesamiento de pagos ocurre
  en Mercado Pago.

---

## 10. Aspectos técnicos (resumen no técnico)

- **Aplicación web** accesible desde cualquier celular o computadora, sin instalar nada.
- **Base de datos en la nube** con seguridad a nivel de registro: cada familia solo
  puede ver lo suyo.
- **Procesamiento de pagos delegado en Mercado Pago** (la plataforma nunca ve ni
  guarda datos de tarjetas).
- **Confirmación automática de pagos:** cuando Mercado Pago confirma un cobro, el
  sistema registra el aporte solo, sin intervención humana, con protección contra
  duplicados.
- **Código versionado** en un repositorio, con historial completo de cambios y
  posibilidad de volver atrás.
- **Despliegue automático:** cada mejora se publica sola tras validarse.

---

## 11. Resultados esperados

**Cuantitativos (a medir tras la puesta en marcha):**
- % de familias que adhieren al aporte
- % que elige débito automático (indicador de recurrencia asegurada)
- Recaudación mensual y su evolución
- Reducción del tiempo administrativo dedicado al cobro

**Cualitativos:**
- Transparencia: cada aporte con comprobante y trazabilidad
- Rendición de cuentas simple ante la comunidad educativa
- Menor carga operativa para los directivos
- Mayor comodidad para las familias

---

## 12. Preguntas abiertas para definir con los directivos

1. ¿Se avanza con el CUIT y las cuentas institucionales? ¿Quién las gestiona?
2. ¿Acreditación inmediata o diferida en Mercado Pago? *(recomendado: diferida)*
3. ¿Se aprueba el gasto de backups (~USD 25/mes) o se opta por respaldo manual?
4. ¿Se compra dominio propio? ¿Con qué nombre?
5. ¿Quiénes tendrán acceso al panel administrativo?
6. ¿Cómo y cuándo se comunica el lanzamiento a las familias?
7. ¿Se avanza con WhatsApp más adelante o alcanza con el mail?
8. ¿Quién queda como responsable del sistema dentro de la cooperadora?

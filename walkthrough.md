# Technical Walkthrough - Parallel Sessions & Redigitation (June 15, 2026)

## 1. Sobre el Bug de Actualización de Cierre
### Problema
Al actualizar un cierre ya guardado (CLOSED) o re-enviarlo por correo, salía:
```
Error al guardar: failed to save cash closing: {"error":"No hay ninguna sesión abierta para cerrar."}
```

### Causa
- `generateReportObject()` no incluía el `id` del reporte existente.
- El backend `POST /cash-closing` no extraía `id` del `req.body` ni manejaba actualizaciones de reportes CLOSED.
- Al llegar sin `id` y con `totalSales > 0`, el backend asumía CIERRE y buscaba una sesión OPEN, que no existía porque el reporte ya estaba cerrado.

### Solución
- **`types.ts`**: `id?: number` agregado a `CashClosingReport`.
- **`CashClosingScreen.tsx`**: `generateReportObject()` incluye `...(existingReport?.id ? { id: existingReport.id } : {})`.
- **`routes.js`**: `if (id)` block al inicio del handler. Si hay `id`, hace UPDATE directo (sin buscar OPEN) usando `reportStatus` inferido y seteando `closing_timestamp` si corresponde.

### Archivos
| File | Change |
|---|---|
| `types.ts` | `id?: number` |
| `CashClosingScreen.tsx` | Incluir `id` en objeto |
| `server/routes.js` | `if (id)` block con status + timestamp |

---

## 2. Parallel Sessions (Multi-OPEN)
### Problema
Antes solo se permitía una sesión OPEN por sucursal. Abrir caja con fecha pasada mientras había una OPEN actual **pisaba** la sesión existente (le cambiaba la `date`).

### Solución Backend (`POST /cash-closing`)
Cambiar la búsqueda de OPEN existente de:
```sql
WHERE branch_id = ? AND status = "OPEN" LIMIT 1
```
a:
```sql
WHERE branch_id = ? AND status = "OPEN" AND date = ? LIMIT 1
```
Esto permite crear una OPEN nueva para el 11 aunque ya exista una OPEN para el 15.

### Solución Backend (`POST /orders`)
Auto-asignación de órdenes sin `cashReportId` debe ir a la OPEN de HOY:
```sql
WHERE branch_id = ? AND status = "OPEN" AND date = CURDATE() ORDER BY id DESC LIMIT 1
```
Mismo cambio en `PUT /orders/:id` (orphan linking).

### Solución Frontend (`App.tsx`)
- **`isCashOpeningMissing`** / **`checkCashOpening`** / **`todaySessionFilter`**: Originalmente verificaban si existía OPEN para **hoy** (`r.date === todayStr`). Desde June 20, 2026 se cambió a buscar **cualquier** OPEN (sin filtro de fecha), porque un turno (turno) puede cruzar medianoche y la sesión del día anterior sigue siendo válida.
- **Reminder automático**: También busca cualquier OPEN.
- **`handleStartNewOrder`**: Usa `isCurrentUserAdmin` (Admin o SuperAdmin) en vez de solo `UserRole.Admin`.

### Archivos
| File | Change |
|---|---|
| `server/routes.js` | `date = ?` en OPEN lookup, `date = CURDATE()` en orders |
| `App.tsx` | `isCashOpeningMissing` / `checkCashOpening` / `todaySessionFilter`: cualquier OPEN. `isCurrentUserAdmin` |

---

## 3. Filtro de Órdenes por Sesión y Rol

### Arquitectura del Filtro (`App.tsx` `filteredOrders`)
El filtro determina qué órdenes ve cada usuario según su rol y modo:

```typescript
const todaySessionFilter = [...cashClosingReports]
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .find(r => r.branchId === selectedBranchId && r.status === 'OPEN');
const redigitationSession = redigitationMode
    ? { id: redigitationMode.cashReportId, date: redigitationMode.date }
    : null;
const sessionToUse = redigitationMode
    ? redigitationSession
    : (isAdmin && !showRedigitatedOrders ? todaySessionFilter : activeSession);
```

> **Nota**: `todaySessionFilter` ya no filtra por `r.date === todayStr`. Busca el OPEN más reciente sin importar la fecha, igual que `activeSession`. Esto permite que un turno que cruza medianoche (abierto el 19, sigue abierto el 20) se mantenga como sesión activa.

### Comportamiento por escenario:

| Escenario | `sessionToUse` | Órdenes visibles |
|---|---|---|
| Admin en **modo redigitar** | Sesión seleccionada en `redigitationMode` | Solo las vinculadas a esa sesión |
| Admin **normal** (sin toggle) | OPEN más reciente | Las de la sesión activa (puede ser de ayer si el turno cruzó medianoche) |
| Admin con **VER REDIGITADAS** | No aplica (usa `isRedigitated`) | Solo activas redigitadas |
| **No admin** | `activeSession` (cualquier OPEN) | Las de la sesión activa |

### `isRedigitated`
```typescript
const isRedigitated = isActive && o.cashReportId != null && redigitatedSessionIds.has(o.cashReportId);
```
Solo aplica a órdenes **activas** (no completadas). Se usa para el toggle "VER REDIGITADAS".

### `redigitatedSessionIds`
Set persistido en `localStorage` que rastrea qué sesiones han sido redigitadas. Permite ocultar/mostrar órdenes redigitadas incluso después de salir del modo.

### Archivos
| File | Change |
|---|---|
| `App.tsx` | `filteredOrders` con `todaySessionFilter` y `redigitationSession` |

---

## 4. Flujo Completo de Redigitación
1. Admin cierra sesión de hoy (si hay una OPEN).
2. Admin abre caja con fecha pasada (ej. 2026-06-11) desde el modal con date picker.
3. Aparece ícono de apertura faltante (porque no hay OPEN de hoy).
4. Admin entra a AdminPanel → "Redigitar Órdenes".
5. `RedigitationScreen` muestra sesiones OPEN con `date < CURDATE()`.
6. Admin selecciona la del 11 → entra en `redigitationMode`.
7. Las órdenes nuevas se vinculan a `cashReportId` del 11.
8. Admin abre caja de **hoy** (desde el modal que sigue apareciendo).
9. Meseros ven y crean órdenes normalmente → se vinculan a la OPEN de hoy.
10. Admin cierra sesión del 11 (seleccionando fecha 11 en CashClosingScreen) y luego cierra la de hoy al final del día.

---

## 5. Closing Warning Banner
### Problema
Cuando se seleccionaba una fecha en CashClosingScreen y existía una OPEN de otra fecha, el banner advertía "CIERRE DE X AÚN NO REALIZADO" incluso si la otra OPEN era de **hoy** (válida en paralelo).

### Fix
```tsx
{globalOpenSession && globalOpenSession.date < selectedDate && (
```
Cambio de `!==` a `<`. Solo advierte si hay una OPEN con fecha **anterior** a la seleccionada (deberías cerrar lo viejo primero). No molesta si la otra OPEN es de hoy.

### Archivo
| File | Change |
|---|---|
| `CashClosingScreen.tsx` | `globalOpenSession.date < selectedDate` |

---

## 6. Database Backup
### Frontend
- Botón "Respaldo de Base de Datos" en MasterSettings (verde, abajo de acciones destructivas).
- `api.backupDatabase()` → `GET /admin/backup-database` → recibe `Blob` → descarga.

### Backend
```javascript
router.get('/admin/backup-database', async (req, res) => {
    // Construye comando mysqldump con socket dinámico
    // Pipea stdout a la respuesta
    // Maneja errores con stderr + exit code
});
```
Filename: `backup_YYYY-MM-DD_HH-MM.sql`

### Archivos
| File | Change |
|---|---|
| `server/routes.js` | Endpoint `GET /admin/backup-database` |
| `api.ts` | `backupDatabase()` método |
| `MasterSettingsScreen.tsx` | Botón + handler |

---

## 7. Selective Deletion Refresh
### Problema
Después del borrado selectivo, el historial de cierres no se refrescaba porque:
- El backend emite `orders_updated` por socket (no `data_updated`).
- Si el socket se pierde, el refresh nunca ocurre.
- El heartbeat no corre en vista `master_settings`.

### Fix
Se agregó callback `onDataCleared` a `MasterSettingsScreenProps`. App.tsx lo pasa como `() => fetchAllData(true)`. Al terminar el borrado exitosamente, se llama `onDataCleared()` forzando refresh inmediato sin depender del socket.

### Archivos
| File | Change |
|---|---|
| `MasterSettingsScreen.tsx` | `onDataCleared` prop, llamado tras `confirmClear()` |
| `App.tsx` | Pasa `onDataCleared={() => fetchAllData(true)}` |

---

## 8. TS Errors Corregidos
### `constants.ts` — `areaId` faltante
```typescript
// Antes: sin areaId
{ id: i + 1, name: `J${i + 1}`, area: 'JARDÍN', branchId: 1 }
// Después:
{ id: i + 1, name: `J${i + 1}`, area: 'JARDÍN', areaId: 1, branchId: 1 }
```
Valores: JARDÍN=1, TERRAZA=2, SALÓN=3 (coincide con migración DB).

### `App.tsx` — `'delivery'` en `CurrentView`
Faltaba `'delivery'` en el type union. Agregado para que el `DeliveryDashboard` sea accesible sin error de TypeScript.

---

## 9. Clear-Data Diagnostics (June 16, 2026)
### Problema
Al borrar una sesión de caja desde el wizard de Master Settings, las órdenes vinculadas no siempre se borraban (quedaban huérfanas). El código de borrado es correcto, pero no había visibilidad de lo que ocurría.

### Solución
Se agregaron logs detallados en `POST /admin/clear-data`:

```
[CLEAR-DATA] Targeted Sales deletion: 1 session(s) - IDs: [5]
[CLEAR-DATA] Parsed numeric IDs: [5]
[CLEAR-DATA] Found 0 order(s) linked to these sessions
[CLEAR-DATA] ⚠️ NO se encontraron órdenes con cash_report_id IN (5)
```

Cuando se encuentran 0 órdenes, corre diagnóstico automático:
- `SELECT id, date, status FROM cash_closing_reports WHERE id IN (...)` — verifica que las sesiones existan
- `SELECT cash_report_id, COUNT(*) FROM orders WHERE cash_report_id IS NOT NULL GROUP BY cash_report_id` — distribución de IDs
- `SELECT DATA_TYPE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE ...` — tipo de la columna

### Archivo
| File | Change |
|---|---|
| `server/routes.js` | Logs + diagnóstico en `POST /admin/clear-data` |

---

## 10. No Scrollbar en MasterSettings (June 16, 2026)
### Problema
En Chromium Linux con temas GTK, ninguna regla CSS logra ocultar la barra de scroll. La clase `scrollbar-hide` y sus variantes con `!important` no funcionan porque GTK pinta su propio scrollbar nativo.

### Solución
Se eliminó el scrollbar por completo:

1. **Wrapper** `flex-1 relative overflow-hidden` rodea el scroll container.
2. **Scroll container** cambió de `overflow-y: auto` a `overflow-y: hidden` vía inline style.
3. **Mouse wheel**: Nuevo handler `handleWheel` que captura `onWheel`, hace `e.preventDefault()` y ajusta `scrollRef.current.scrollTop += e.deltaY`.
4. **Drag-to-scroll**: Se mantiene el existente (mouse events con `pageY`).

```tsx
// Nuevo handler
const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollTop += e.deltaY;
};
```

### CSS adicional
Se mejoró `index.css` para los navegadores que sí respetan CSS:
```css
.scrollbar-hide {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    scrollbar-color: transparent transparent !important;
}
.scrollbar-hide::-webkit-scrollbar {
    width: 0px !important; display: none !important;
}
```

### Archivos
| File | Change |
|---|---|
| `components/MasterSettingsScreen.tsx` | Wrapper `overflow-hidden`, `overflowY: hidden`, `onWheel`, `handleWheel` |
| `index.css` | `.scrollbar-hide` reforzado con `!important` + Firefox |

---

## 11. Logout Toast Flash (June 16, 2026)
### Problema
En `handleLogout` se llamaba `toast('Sesión cerrada correctamente')` justo antes de `window.location.reload()`. El toast se alcanzaba a ver 1ms antes de que el reload destruyera el componente, causando un destello molesto.

### Solución
Simplemente se eliminó la línea del `toast()`. El page reload ya deja claro que se cerró la sesión.

### Archivo
| File | Change |
|---|---|
| `App.tsx` | `handleLogout` — eliminado `toast(...)` |

---

## 12. Deploy Instructions
```bash
# 1. Build frontend
npm run build

# 2. Upload to VPS
#    - dist/ (compiled frontend)
#    - server/routes.js (backend)
#    - server/db.js (backend — timezone config)

# 3. Restart backend
pm2 restart all
```

---

## 13. Timezone El Salvador (UTC-6) — Fix Modal Apertura (June 18, 2026)

### Problema
Desde la implementación de redigitación, el modal "Apertura de Caja" se mostraba siempre aunque ya existiera una sesión OPEN. El admin no podía trabajar sin cerrarlo manualmente cada 5 minutos.

### Causa Raíz
La redigitación cambió la lógica de `isCashOpeningMissing` y `checkCashOpening` de buscar **cualquier** sesión OPEN a buscar una **específica de hoy** con `r.date === todayStr`. Pero `todayStr` se calculaba con:
```typescript
new Date().toISOString().split('T')[0] // Fecha UTC
```

Mientras las fechas se guardaban con la fecha **local** del browser (desde `CashOpeningModal`). En UTC-6 (El Salvador), después de las 6 PM la fecha UTC ya es el día siguiente, causando que nunca coincidieran.

### Solución

#### 1. Backend — MySQL Timezone
`server/db.js`:
```javascript
timezone: '-06:00' // El Salvador (UTC-6, no DST)
```
Esto asegura que `NOW()`, `CURDATE()` y demás funciones SQL usen la hora de El Salvador.

#### 2. Backend — routes.js
`getLocalDate()` reemplazado por `getElSalvadorDate()` que calcula la fecha con offset dinámico UTC-6, usando el client offset del server.

#### 3. Frontend — Nuevo helper `utils/dates.ts`
```typescript
const SV_TIMEZONE = 'America/El_Salvador';

export function getElSalvadorDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SV_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return formatter.format(new Date());
}

export function formatToElSalvadorDate(date: Date | string): string {
  // Same pattern but accepts a date parameter
}
```
Usa `Intl.DateTimeFormat` con `timeZone: 'America/El_Salvador'` para obtener la fecha correcta independientemente de la zona horaria del browser.

#### 4. Frontend — Archivos actualizados
| Archivo | Cambio |
|---|---|
| `App.tsx` | 4 comparaciones UTC → El Salvador (`checkCashOpening`, `handleSaveCashOpening`, `filteredOrders`, `isCashOpeningMissing`). `isToday` e `isSameDateAsActiveSession` también corregidos. |
| `components/CashOpeningModal.tsx` | `getLocalDateString()` reemplazado por `getElSalvadorDateString()` |
| `components/CashClosingScreen.tsx` | `getTodayDateString()` ahora usa El Salvador |
| `components/CashAuditScreen.tsx` | `todayStr` con `getElSalvadorDateString()`, `orderDate` con `formatToElSalvadorDate()` |
| `components/DeliveryDashboard.tsx` | Rango de fechas de hoy con El Salvador |
| `components/DailySummaryScreen.tsx` | `max` del input date |
| `components/MasterSettingsScreen.tsx` | Backup filename con fecha El Salvador |
| `components/PendingBalancesScreen.tsx` | Default date range |
| `components/AuditLogsScreen.tsx` | Default date range |
| `components/ChefStatsModal.tsx` | Default date range |
| `components/PaymentControl.tsx` | Cálculos de fechas de vencimiento |

### Archivos Creados
- `utils/dates.ts` — Helpers de fecha para El Salvador

### Archivos Modificados
- `server/db.js` — `timezone: '-06:00'`
- `server/routes.js` — `getElSalvadorDate()`
- `App.tsx` — todas las comparaciones de fecha
- `components/CashOpeningModal.tsx`
- `components/CashClosingScreen.tsx`
- `components/CashAuditScreen.tsx`
- `components/DeliveryDashboard.tsx`
- `components/DailySummaryScreen.tsx`
- `components/MasterSettingsScreen.tsx`
- `components/PendingBalancesScreen.tsx`
- `components/AuditLogsScreen.tsx`
- `components/ChefStatsModal.tsx`
- `components/PaymentControl.tsx`

---

## 14. Cross-Midnight — Turno continuo sin bloqueo (June 20, 2026)

### Problema
A las 12:01 AM, `checkCashOpening`, `todaySessionFilter` e `isCashOpeningMissing` buscaban una OPEN con `date === todayStr` (fecha actual de El Salvador). Como el turno abierto ayer tenía la fecha de ayer, no encontraban ninguna OPEN para hoy → modal de apertura → meseros bloqueados.

### Causa
Las 3 funciones filtraron por `r.date === todayStr` (introducido durante la implementación de redigitación para ignorar sesiones OPEN de fechas pasadas). Pero un turno normal puede cruzar medianoche, y la sesión del día anterior sigue siendo perfectamente válida.

### Fix
Se eliminó el filtro `&& r.date === todayStr` de las 3 funciones. Ahora todas buscan cualquier OPEN de la sucursal, igual que ya hacía `activeSession` (línea 830 de App.tsx):

```typescript
// Antes:
const todayOpenForBranch = cashClosingReports.filter(r => 
    Number(r.branchId) === Number(branchId) && r.date === todayStr && r.status === 'OPEN'
);

// Después:
const openForBranch = cashClosingReports.filter(r => 
    Number(r.branchId) === Number(branchId) && r.status === 'OPEN'
);
```

### Archivo
| File | Change |
|---|---|
| `App.tsx` | `checkCashOpening`, `todaySessionFilter`, `isCashOpeningMissing` — removido filtro `date === todayStr` |

---

## 15. PaymentControl — Días de Gracia editables con valor 0 (June 20, 2026)

### Problema
El input de "Días de Gracia" no era completamente editable:
1. El operador `||` trataba `0` como falsy, entonces `parseInt("0") || 3` siempre daba `3` sin importar que el usuario eligiera `0`.
2. No se podía borrar el campo para escribir un nuevo valor porque `parseInt('')` = `NaN`, la condición del `onChange` fallaba, y React revertía al valor anterior.
3. `max={30}` limitaba arbitrariamente.

### Fix

#### 1. `||` → `??` en todos los lugares donde se usa `paymentGraceDays`
```typescript
// Antes:
parseInt(data.globalSettings.payment_grace_days) || prev.paymentGraceDays || 3

// Después:
parseInt(data.globalSettings.payment_grace_days) ?? prev.paymentGraceDays ?? 3
```

#### 2. `graceDays` cambió de `number` a `string`
(Consistente con `paymentDay` que ya era string)
```typescript
// Antes:
const [graceDays, setGraceDays] = useState(settings.paymentGraceDays || 3);

// Después:
const [graceDays, setGraceDays] = useState(String(settings.paymentGraceDays ?? 3));
```

#### 3. `onChange` permite vacío y cualquier número ≥ 0
```typescript
onChange={e => {
    const v = e.target.value;
    if (v === '' || (!isNaN(parseInt(v)) && parseInt(v) >= 0)) setGraceDays(v);
}}
```

#### 4. Render con `parseInt()` explícito
```tsx
// Antes (concatenación de string):
{graceDays + 1}

// Después (suma numérica):
{parseInt(graceDays) + 1}
```

### Comportamiento
- `graceDays = 0` → bloqueo inmediato al día siguiente del vencimiento
- `graceDays = 5` → 5 días de gracia antes de bloquear
- Sin límite máximo

### Archivos
| File | Change |
|---|---|
| `App.tsx` | `paymentGraceDays` asignación: `||` → `??` |
| `components/PaymentControl.tsx` | `graceDays` como string, `onChange` editable, `||` → `??`, render con `parseInt()` |

---

## 16. Editar Fecha de Apertura de Caja (July 2, 2026)

### Problema
Admin aperturaba caja con fecha equivocada (ej: 29 en vez de 30). Las órdenes del día real quedaban atadas al `cash_report_id` equivocado. No aparecían en el cierre de la fecha correcta. Solución manual: cambiar fecha directo en DB con DBeaver.

### Solución

#### Backend — Nuevo endpoint `PUT /cash-closing/:id/date`
```javascript
router.put('/cash-closing/:id/date', async (req, res) => {
    // Verifica reporte existe
    // Previene UNIQUE conflict (branch_id + date)
    // UPDATE date + re-liga órdenes huérfanas
    // Emite data_updated
});
```

#### Frontend API — `api.ts`
```typescript
async updateCashClosingDate(id: number, newDate: string, branchId: number) {
    return this._put(`/cash-closing/${id}/date`, { newDate, branchId });
}
```

#### UI — CashClosingScreen
- Botón lápiz al lado del date picker (solo si hay reporte existente).
- Click → PIN modal (Admin/SuperAdmin).
- PIN válido → date picker modal.
- Confirmar → API call → state actualizado.

### Archivos
| File | Change |
|---|---|
| `server/routes.js` | `PUT /cash-closing/:id/date` endpoint |
| `api.ts` | `updateCashClosingDate()` method |
| `CashClosingScreen.tsx` | Botón editar + PIN modal + date edit modal |

---

## 17. AdminPanel — Iconos sólidos para mobile/PWA (July 2, 2026)

### Problema
Los botones del menú usaban fondos semi-transparentes (`bg-amber-600/25`, `border-amber-500/40`). En navegadores móviles y PWA, el alpha compositing causaba artefactos visuales ("chorretones de pintura"), sobre todo en los items del final del panel.

### Solución
Se reemplazaron todos los colores por variantes sólidas, igual que en RestauranteOS.V1:
```typescript
// Antes:
amber: 'bg-amber-600/25 border-amber-500/40 text-amber-500 active:bg-amber-600 active:text-white',
// Después:
amber: 'bg-amber-950 border-amber-700 text-amber-500 active:bg-amber-600 active:text-white',
```

Adicionalmente:
- `h-28 md:h-32` → `aspect-square` (sizing consistente)
- `rounded-3xl` → `rounded-[24px] md:rounded-[32px]`
- Se agregó `active:scale-90` (feedback táctil)
- Iconos: `w-8 md:w-10` → `w-8 md:w-8 lg:w-9`

### Archivo
| File | Change |
|---|---|
| `components/AdminPanel.tsx` | colorMap con bg/border sólidos, `aspect-square`, `active:scale-90` |

---

## 18. CashClosingHistoryScreen — Sort por fecha (July 2, 2026)

### Problema
`sortedReports` ordenaba por `report.createdAt` en vez de `report.date`. En sesiones retroactivas el orden no era cronológicamente correcto.

### Fix
```typescript
// Antes:
const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
// Después:
const dateA = a.date ? new Date(a.date + 'T12:00:00') : new Date(0);
```

### Archivo
| File | Change |
|---|---|
| `components/CashClosingHistoryScreen.tsx` | Sort por `report.date` |

---

## 19. Priorizar OPEN en existingReport + DELETE de sesión vacía (July 17, 2026)

### Problema
Cuando existían dos sesiones de caja para la misma fecha (ej: una CLOSED id=5 del turno real y una OPEN id=6 fantasma), el banner "CIERRE DE X AÚN NO REALIZADO" apuntaba a la fecha correcta, pero `existingReport` ordenaba CLOSED primero. Al hacer clic en "Ir a Sesión Abierta", el usuario veía la sesión ya cerrada y no podía tomar acción sobre la OPEN.

### Fix existingReport
`CashClosingScreen.tsx` — Cambio de prioridad en el sort:
```typescript
// Antes: CLOSED first
if (a.status === 'CLOSED' && b.status !== 'CLOSED') return -1;

// Después: OPEN first
if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
```

### DELETE de sesión vacía

#### Backend — `DELETE /cash-closing/:id`
```javascript
router.delete('/cash-closing/:id', async (req, res) => {
    // Verifica reporte existe
    // Solo permite si status === 'OPEN'
    // Solo permite si COUNT(orders) === 0
    // DELETE + emit data_updated
});
```

#### Frontend API — `api.ts`
```typescript
async deleteCashClosing(id: number) {
    return fetch(`${API_URL}/cash-closing/${id}`, { method: 'DELETE' });
}
```

#### UI — CashClosingScreen
- Ícono de papelera al lado del lápiz de editar fecha.
- Visible solo si `existingReport.status === 'OPEN' && existingReport.totalOrders === 0`.
- Click → PIN modal Admin → confirmación → DELETE API → sesión removida del state.

### Archivos
| File | Change |
|---|---|
| `server/routes.js` | `DELETE /cash-closing/:id` endpoint |
| `api.ts` | `deleteCashClosing()` method |
| `CashClosingScreen.tsx` | Sort OPEN first en existingReport + botón papelera con PIN + delete handler |

---

## 20. Promociones — Fix POST 500, Toggle, Precio Fijo en Carrito y Total en Vivo (Aug 1, 2026)

### Problema 1 — `POST /promotions` devolvía 500
`formatDate` construía el datetime con espacios sueltos:
```javascript
return `${year} -${month} -${day} ${hours}:${minutes}:${seconds} `;
//        "2026 -07 -31 18:00:00 "  →  MySQL: Incorrect datetime value
```
**Fix**: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`. Además, si el valor es `YYYY-MM-DD` puro (viene del `input type="date"`), se usa tal cual con `00:00:00` para evitar que `new Date("YYYY-MM-DD")` (que parsea UTC) corra el día hacia atrás en UTC-6.

### Problema 2 — No había toggle activar/desactivar
Solo se podía eliminar (soft-delete). Se agregó un switch en cada fila:
```tsx
const { is_active, ...rest } = p as any;
const payload = { ...rest, isActive: !p.isActive };
await api.updatePromotion(p.id, payload);
```
Se descarta `is_active` porque el backend prioriza `is_active` sobre `isActive` (el GET devuelve ambos).

### Problema 3 — Fechas no editables al editar promo
`dateStrings: true` en `db.js` → el GET devuelve `start_date` como `"2026-07-31 00:00:00"` (con espacio, sin `T`). Los inputs usaban `.split('T')[0]` → valor inválido. Fix: `.split(' ')[0].split('T')[0]`.

### Problema 4 — Badge de promo visible pero el total no descontaba (tipo COMBO)
Dos funciones con lógica divergente:
- `getItemPromoInfo` (badge): mostraba cualquier tipo excepto `QUANTITY`.
- `calculatePromotions` (total): solo procesaba `QUANTITY` + `['HAPPY_HOUR','EVENT','CATEGORY','GLOBAL','BIRTHDAY']`.

Una promo tipo **COMBO** con precio fijo mostraba el badge verde pero `discountTotal = 0`. Fix: constante compartida `DISCOUNTABLE_TYPES = [..., 'COMBO']` usada por ambas.

### Problema 5 — Breakdown muestra descuento pero el TOTAL no lo resta
`appliedDiscounts` se recalcula en vivo (`useMemo` sobre `order.items` y `promotions`), pero el total usaba `order.total` persistido, que no se actualizaba si la promo se activaba después de agregar ítems.

**Fix `liveTotal`** en OrderScreen:
```typescript
const liveTotal = useMemo(() => {
    const itemsTotal = order.items.reduce((s, i) => s + i.total, 0);
    const discountTotal = appliedDiscounts.reduce((s, d) => s + d.amount, 0);
    return Math.max(0, itemsTotal + (order.deliveryFee || 0) - discountTotal - manualDiscount);
}, [order.items, appliedDiscounts, order.deliveryFee, manualDiscount]);
```
PaymentModal recibe `orderTotal={liveTotal + manualDiscount}` (el modal resta la cortesía internamente).

### Problema 6 — Consistencia DB al cobrar
`onCompleteOrder` guardaba `activeOrder.total` (viejo). Ahora recalcula con las promos en vivo:
```typescript
const finalDiscountTotal = finalDiscounts.reduce((s, d) => s + d.amount, 0);
const finalTotal = Math.max(0, items + deliveryFee - finalDiscountTotal);
```
Convención verificada (lo que se ve = lo que se guarda):
- Carrito TOTAL A PAGAR = `items + envío − promo − cortesía`
- Ticket = `total − cortesía + propina + comisión` (el `total` del ticket no incluye cortesía)
- DB `total` = `items + envío − promo` (la cortesía va en `manual_discount`)
- Reportes = `SUM(total − manual_discount)` ✓

### Cambios adicionales
- `isPromoActive()` / `matchesItem()` / `getItemPromoInfo()` extraídos en `promotionEngine.ts`.
- Hora/día del engine usan El Salvador (`getElSalvadorDateString` + `Intl.DateTimeFormat('America/El_Salvador')`).
- Ventanas nocturnas: `end_time < start_time` cruza medianoche (06:00→01:00 cubre el día + madrugada).

### Archivos
| File | Change |
|---|---|
| `server/routes.js` | `formatDate` corregido + preserva `YYYY-MM-DD` |
| `components/PromotionsManager.tsx` | Toggle activar/desactivar + inputs fecha |
| `utils/promotionEngine.ts` | Refactor, `DISCOUNTABLE_TYPES` con COMBO, `getItemPromoInfo`, El Salvador, ventanas nocturnas |
| `components/OrderScreen.tsx` | Badge promo + precio efectivo, `liveTotal`, PaymentModal, `finalOrder.total` |
| `App.tsx` | `onCompleteOrder` recalcula `discount`/`total` |

---

## 21. Clientes — Desactivar en vez de borrar (Aug 2, 2026)

### Problema
No había forma de desactivar clientes, solo borrar (DELETE). La admin creó duplicados del mismo cliente por error y quería dejar uno solo. Por regla general de integridad de datos, los clientes con ventas pasadas no deben borrarse (rompería historial), así que se implementa **desactivación**.

### Backend — `server/routes.js`
Auto-migración (igual que `birth_date`):
```javascript
ALTER TABLE customers ADD COLUMN is_active BOOLEAN DEFAULT TRUE
```
Nuevo endpoint:
```javascript
router.put('/customers/:id/status', async (req, res) => {
    const { isActive } = req.body;
    await pool.execute('UPDATE customers SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
    req.io.emit('customers_updated');
    res.json({ id, isActive: !!isActive });
});
```
`GET /customers` con `search` ahora filtra `WHERE is_active = 1` (el AI parse no devuelve desactivados). `initial-data` mapea `c.isActive = !!c.is_active`.

### Frontend
- `types.ts`: `isActive?: boolean` en `Customer`.
- `api.ts`: `setCustomerStatus(id, isActive)` → PUT `/customers/:id/status`.
- `ManageCustomersScreen.tsx`: switch verde/gris por cliente + badges **ACTIVO/INACTIVO**; toast movido a `position="top"` (por defecto el componente usa `bottom`).
- `StartScreen.tsx`: el `filteredCustomers` del wizard (paso de cliente) y las 2 búsquedas `existing` del AI parse ahora excluyen `c.isActive === false`, para que las meseras no asignen clientes desactivados a órdenes nuevas.

### Convención
Los clientes con historial NO se borran: se desactivan. Los desactivados desaparecen del buscador de órdenes nuevas pero su historial permanece intacto en reportes/tickets.

### Archivos
| File | Change |
|---|---|
| `server/routes.js` | Migración `is_active`, `PUT /customers/:id/status`, `GET /customers` filtra inactivos en search |
| `components/ManageCustomersScreen.tsx` | Switch activar/desactivar + badges ACTIVO/INACTIVO + toast top |
| `components/StartScreen.tsx` | Buscador de cliente excluye inactivos |
| `api.ts` | `setCustomerStatus()` |
| `types.ts` | `isActive?` en `Customer` |

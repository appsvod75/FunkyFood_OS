# Project Handover - Security & Multi-Branch Logic (July 2, 2026)

## Current Status
The system now **uses El Salvador timezone (UTC-6)** across all layers: MySQL connection, backend date computation, and frontend date comparisons. All cash opening/ closing, order filtering, and date comparisons use `America/El_Salvador` timezone consistently.
The system supports **parallel cash sessions** (multiple OPEN sessions per branch by date), **order redigitation** (linking orders to past-date sessions), and **role-based order filtering**. Selective sales deletion and database backup are available from Master Settings.

## Key Accomplishments

### 1. Parallel Cash Sessions (Multi-OPEN) & Cross-Midnight Continuity
- **Before**: Only one OPEN session per branch. Opening cash on a past date would silently UPDATE the existing session's date, corrupting data.
- **After**: Multiple OPEN sessions allowed per branch, one per date. You can have an OPEN session for June 11 (redigitation) and for today simultaneously.
- **Backend `POST /cash-closing`**: Now checks for existing OPEN by `branch_id + date` instead of just `branch_id`.
- **`POST /orders`**: Auto-assigns new orders to the OPEN session of `CURDATE()` (today), not any OPEN session. Redigitated orders use explicit `cashReportId`.
- **`PUT /orders/:id`**: Orphan linking also targets today's OPEN session.
- **`isCashOpeningMissing`** / **`checkCashOpening`** / **`todaySessionFilter`**: Changed from filtering by `r.date === todayStr` to looking for **any** OPEN session (regardless of date). This allows a shift that spans midnight to continue without blocking waiters or showing the cash-opening modal. After midnight the session opened yesterday is still found and treated as valid.
- **Files**: `server/routes.js`, `App.tsx`

### 2. Redigitation Flow (Complete)
- **Button in AdminPanel**: "Redigitar Órdenes" visible for Admin/SuperAdmin.
- **RedigitationScreen**: Lists past-date OPEN sessions (`date < CURDATE()`). User selects one → enters redigitation mode.
- **Order creation**: New orders receive `cashReportId` from the selected past session (bypasses auto-assignment).
- **Banner in OrderScreen**: Shows `🔴 REDIGITANDO ÓRDENES — Fecha: YYYY-MM-DD` with "SALIR" button.
- **Role-based filtering**:
  - Non-admins: Never see redigitated orders (filtered by `activeSession` logic).
  - Admin in redigitation mode: Sees ONLY orders from the selected redigitation session.
  - Admin normal: Sees only orders from today's OPEN session.
  - Admin toggled "VER REDIGITADAS": Sees only active redigitated orders.
- **Files**: `App.tsx`, `server/routes.js`, `components/RedigitationScreen.tsx`, `components/OrderScreen.tsx`, `components/AdminPanel.tsx`, `components/StartScreen.tsx`

### 3. Selective Sales Deletion (Wizard)
- **3 Steps**: Branch → Date Range → Session selection with checkboxes.
- **Surgical deletion**: Only deletes orders and cash sessions by ID, no TRUNCATE.
- **Endpoint**: `GET /admin/cash-sessions` (fetch sessions by branch + date range).
- **Modified**: `POST /admin/clear-data` accepts `cashReportIds` array.
- **Refresh guarantee**: After deletion, `onDataCleared` callback forces `fetchAllData()` immediately (not reliant on socket events).
- **Files**: `server/routes.js`, `api.ts`, `components/MasterSettingsScreen.tsx`, `App.tsx`

### 4. Database Backup
- **Button in Master Settings**: "Respaldo de Base de Datos" (emerald green).
- **Backend**: `GET /admin/backup-database` runs `mysqldump` and returns `.sql` file.
- **Filename**: `backup_YYYY-MM-DD_HH-MM.sql`.
- **File**: `server/routes.js`

### 5. Fixes & Corrections
- **`CashClosingReport` type**: Added `id?: number` field.
- **`generateReportObject()`**: Now includes `id` for existing reports (enables updates of CLOSED reports).
- **Backend `if (id)` block**: Properly handles status changes and `closing_timestamp` for updates/closes.
- **Fresh install tables (`constants.ts`)**: Added `areaId` to `INITIAL_TABLES` matching DB migration (JARDÍN=1, TERRAZA=2, SALÓN=3).
- **`CurrentView` type**: Added `'delivery'` (was missing, causing TS error).
- **SuperAdmin bypass**: SuperAdmin can now create orders without today's cash opening (`isCurrentUserAdmin` instead of `UserRole.Admin` check).
- **Closing warning banner**: Only shows if there's an OPEN session with date BEFORE the selected date (not for parallel today sessions).

### 6. Clear-Data Diagnostics & Logging
- **Problem**: Selective deletion sometimes skipped orders (orphaned them) without explanation.
- **Solution**: Added detailed `console.log` at each step of `POST /admin/clear-data` — raw IDs received, parsed IDs, order count found.
- **Diagnostic on 0 orders**: If no orders found, queries:
  - Whether target sessions exist in `cash_closing_reports`
  - Distribution of all `cash_report_id` values across orders (`GROUP BY cash_report_id`)
  - Column type info from `information_schema` to detect type mismatches.
- **File**: `server/routes.js`

### 7. No Scrollbar in MasterSettings (JS-Only Scroll)
- **Problem**: Browser scrollbar always visible in MasterSettingsScreen (especially on Chromium Linux with GTK themes).
- **Solution**: Wrapped scroll container in `overflow: hidden` parent, used `overflowY: 'hidden'` inline on the inner div. Scrolling handled entirely via JavaScript:
  - **Drag-to-scroll** (existing, via mouse events)
  - **Mouse wheel** (new `onWheel` handler adjusts `scrollTop`)
- **CSS fallback**: `index.css` `.scrollbar-hide` improved with `!important`, `scrollbar-width: none`, `scrollbar-color: transparent`, and all `::-webkit-scrollbar` pseudo-elements explicitly hidden.
- **Files**: `components/MasterSettingsScreen.tsx`, `index.css`

### 8. Logout Toast Flash Removed
- **Problem**: `handleLogout` called `toast('Sesión cerrada correctamente')` immediately followed by `window.location.reload()`, causing a 1ms flash of the toast before the page reloaded.
- **Solution**: Removed the `toast()` call. The page reload alone is sufficient to show the login screen.
- **File**: `App.tsx`

### 9. Timezone El Salvador (UTC-6) — Fix Modal Apertura (June 18, 2026)
- **Problem**: `isCashOpeningMissing` y `checkCashOpening` usaban `new Date().toISOString().split('T')[0]` (fecha **UTC**) para comparar con fechas guardadas en hora local. En huso UTC-6, después de las 6 PM la fecha UTC ya es el día siguiente, causando que el modal de apertura se mostrara siempre aunque ya hubiera una sesión OPEN.
- **Root Cause**: La redigitación cambió la búsqueda de "cualquier OPEN" a "OPEN de hoy específicamente". La comparación de fecha exacta `r.date === todayStr` fallaba por el desfase UTC/local.
- **Backend fix**:
  - `server/db.js`: `timezone: '-06:00'` en la conexión MySQL para que `NOW()` y `CURDATE()` usen El Salvador.
  - `server/routes.js`: `getLocalDate()` reemplazado por `getElSalvadorDate()` con offset UTC-6 dinámico.
- **Frontend fix**:
  - `utils/dates.ts`: Nuevo helper `getElSalvadorDateString()` y `formatToElSalvadorDate()` usando `Intl.DateTimeFormat` con `timeZone: 'America/El_Salvador'`.
  - `App.tsx`: 4 comparaciones de fecha corregidas (`checkCashOpening`, `handleSaveCashOpening`, `filteredOrders`, `isCashOpeningMissing`). También `isToday` e `isSameDateAsActiveSession`.
  - `components/CashOpeningModal.tsx`: Fecha por defecto con El Salvador.
  - `components/CashClosingScreen.tsx`: `getTodayDateString()` usa El Salvador.
  - `components/CashAuditScreen.tsx`: `todayStr` y filtro de órdenes.
  - `components/DeliveryDashboard.tsx`, `DailySummaryScreen.tsx`, `MasterSettingsScreen.tsx`, `PendingBalancesScreen.tsx`, `AuditLogsScreen.tsx`, `ChefStatsModal.tsx`, `PaymentControl.tsx`: Fechas por defecto y comparaciones usando El Salvador.

### 10. PaymentControl — Días de Gracia editables con valor 0 (June 20, 2026)
- **Problem**: No se podía cambiar el valor de "Días de Gracia" en PaymentControl. El operador `||` trataba `0` como falsy, entonces `parseInt("0") || 3` siempre daba `3`. Además, el input no permitía borrar el campo (`parseInt('')` = `NaN`, la condición fallaba).
- **Fix**:
  - Cambiar todos los `||` por `??` en `App.tsx` y `PaymentControl.tsx` para que `0` sea un valor válido.
  - `graceDays` cambió de `number` a `string` (consistente con `paymentDay`) para permitir borrar el input.
  - `onChange` del input acepta vacío (`v === ''`) y cualquier número ≥ 0 (sin `max`).
  - Todos los render que usaban `{graceDays + 1}` se cambiaron a `{parseInt(graceDays) + 1}` para evitar concatenación de strings.
- **Con `graceDays = 0`**: Bloqueo inmediato al día siguiente del vencimiento del pago.
- **Files**: `App.tsx`, `components/PaymentControl.tsx`

### 11. Cross-Midnight — Turno continuo sin bloqueo (June 20, 2026)
- **Problem**: A las 12:01 AM, `checkCashOpening`, `todaySessionFilter` e `isCashOpeningMissing` buscaban una OPEN con `date === todayStr` (fecha actual). Como el turno abierto ayer tenía la fecha de ayer, no encontraban ninguna OPEN para hoy → modal de apertura → meseros bloqueados.
- **Fix**: Las 3 funciones ahora buscan **cualquier** OPEN de la sucursal, sin filtrar por fecha (usando `r.status === 'OPEN'` sin `r.date === todayStr`). La función `activeSession` (línea 830) ya hacía esto correctamente; las otras 3 se alinearon.
- **Comportamiento**: Un turno abierto el 19 sigue siendo válido el 20. El modal no aparece, los meseros no se bloquean, las órdenes nuevas se vinculan a la misma sesión abierta.
- **Files**: `App.tsx`

### 12. Editar Fecha de Apertura de Caja (July 2, 2026)
- **Problem**: Admin aperturaba caja con fecha equivocada (ej: 29 en vez de 30). Las órdenes del día real quedaban atadas al `cash_report_id` equivocado y no aparecían en el cierre de la fecha correcta. Solución manual era cambiar la fecha directo en DB con DBeaver.
- **Backend**: Nuevo endpoint `PUT /cash-closing/:id/date` que:
  - Verifica que el reporte exista
  - Previene duplicados (choca con UNIQUE `branch_id + date`)
  - Actualiza la fecha y re-vincula órdenes huérfanas
  - Emite `data_updated` por socket
- **Frontend API**: Nuevo método `updateCashClosingDate(id, newDate, branchId)`
- **UI en CashClosingScreen**: Botón de lápiz al lado del date picker (visible cuando hay un reporte existente). Flujo: click → PIN modal → date picker → confirmar → se actualiza la fecha y el picker se mueve automáticamente.
- **Files**: `server/routes.js`, `api.ts`, `components/CashClosingScreen.tsx`

### 13. CashClosingHistoryScreen — Sort por fecha (July 2, 2026)
- **Problem**: `sortedReports` ordenaba por `report.createdAt` en vez de `report.date`. En sesiones retroactivas el orden no era cronológico correcto.
- **Fix**: Cambiado de `new Date(a.createdAt)` a `new Date(a.date + 'T12:00:00')`.
- **File**: `components/CashClosingHistoryScreen.tsx`

### 14. AdminPanel — Iconos sólidos para mobile/PWA (July 2, 2026)

### 15. Priorizar OPEN en CashClosingScreen + DELETE de sesión vacía (July 17, 2026)
- **Problema**: Si existían dos sesiones para la misma fecha (una CLOSED y una OPEN), `existingReport` mostraba la CLOSED porque la ordenaba primero. Al hacer clic en "Ir a Sesión Abierta" el usuario veía la sesión ya cerrada y no podía hacer nada con la OPEN huérfana.
- **Fix `existingReport`**: Cambiado el sort de `CLOSED first` a `OPEN first`, así cuando hay sesiones duplicadas el usuario ve la que necesita acción.
- **DELETE de sesión vacía**:
  - Nuevo endpoint `DELETE /cash-closing/:id` (backend) que solo permite borrar sesiones OPEN sin órdenes vinculadas.
  - Nuevo método `api.deleteCashClosing(id)` (frontend).
  - Ícono de papelera en CashClosingScreen al lado del lápiz de editar fecha, visible solo si `status === 'OPEN' && totalOrders === 0`.
  - Flujo: click → PIN modal Admin → confirmación → DELETE → sesión removida del state.
- **Files**: `server/routes.js`, `api.ts`, `components/CashClosingScreen.tsx`
- **Problem**: Los botones del menú usaban fondos semi-transparentes (`bg-amber-600/25`, `border-amber-500/40`). En navegadores móviles y PWA el alpha compositing causaba artefactos visuales ("chorretones de pintura"), especialmente en los items del final del panel.
- **Fix**: Cambiados todos los colores a sólidos (`bg-amber-950`, `border-amber-700`) como en RestauranteOS.V1. También se agregó `aspect-square` para sizing consistente y `active:scale-90` para feedback táctil.
- **Files**: `components/AdminPanel.tsx`

## Deployment
- **Backend**: Upload `server/routes.js` and `server/db.js` to VPS → `pm2 restart all`.
- **Frontend**: Run `npm run build` → upload `dist/` to VPS.

## Multi-Branch Strategy
- **Global Data**: Products, Categories, Customers shared across all branches.
- **Isolated Data**: Orders, Cash Reports, Tables are branch-specific.
- **Action Plan**: Create a second Branch, assign Admin, replicate tables.

## Pending Actions & Recommendations
- **[NUEVA TAREA] Combo editable por total — armado al vuelo (Aug 1, 2026)**: La admin quiere combos que la mesera **arme al vuelo**. Flujo: al seleccionar un combo de este tipo en el carrito → se abre un **modal** con botón "ARMAR COMBO", **búsqueda de productos** y campos de cantidad. La mesera agrega producto A x6, producto B x8, producto C xN, etc., **sin sobrepasar el total de unidades del combo** (ej. 24 cervezas), con el modal mostrando la **suma en vivo** de lo armado. Al confirmar, esas cantidades exactas son las que se **descuentan de inventario** (producto por producto, ya soportado por `combo_selections`). El combo incluye además un **alimento cobrado dentro del combo** que va a **cocina/KDS** como item real (línea KDS independiente con su propio completado).
  - **Especificación de configuración (AdminPanel)**: al marcar un producto como combo, agregar una **tercera opción "ARMABLE"** donde el admin **solo marca que es armable + define la cantidad total permitida** (ej. 24) **sin tener que definir qué productos lleva**. Guardar como tipo nuevo en `combo_definition` (JSON, ej. `{ type: 'editable', totalQty: 24 }`) — retrocompatible con los combos fijos/dinámicos existentes.
  - **Flujo de venta (OrderScreen)**: al tocar un combo armable, **antes de pasar al carrito** se abre el modal de armado al vuelo; al terminar, **en el carrito se muestra el detalle de cómo quedó armado** (lista de productos y cantidades — el render de `item.comboSelections` en el carrito ya existe y lo mostraría automáticamente).
  - Implementar en `AdminPanel.tsx` (form), `ComboSelectionModal` o nuevo modal de armado, `OrderScreen` / KDS / backend.
- **Costo Ponderado**: Optimize `averageCost` calculation in `groupedInventory` to use weighted average (`Sum(Qty * CP) / TotalQty`) instead of first item's cost.
- **Margen dinámico**: Make margin chip color dynamic (`text-red-500` if negative, `text-emerald-500` if positive).
- Monitor cross-midnight reporting accuracy (verify that closing a session that spans midnight correctly reports all orders).
- Verify cash closing history isolation between branches.

## Complete File Manifest
| File | Changes |
|---|---|
| `server/routes.js` | Multi-OPEN sessions, redigitation backend, clear-data + diagnostics, backup DB, `PUT /cash-closing/:id/date`, `DELETE /cash-closing/:id` |
| `App.tsx` | Filtering logic, `isCashOpeningMissing` / `checkCashOpening` / `todaySessionFilter` (any OPEN, not by date), SuperAdmin bypass, `onDataCleared`, logout toast removed, `paymentGraceDays` `??` fix |
| `api.ts` | `backupDatabase()` method, `clearData()` filters, `updateCashClosingDate()`, `deleteCashClosing()` |
| `types.ts` | `id?: number` in `CashClosingReport` |
| `components/CashClosingScreen.tsx` | `generateReportObject()` includes `id`, banner date comparison, botón editar fecha con PIN, sort OPEN first en existingReport, + botón eliminar sesión vacía con PIN |
| `components/CashClosingHistoryScreen.tsx` | Sort por `report.date` en vez de `report.createdAt` |
| `components/AdminPanel.tsx` | Iconos sólidos (sin opacidad), `aspect-square`, `active:scale-90` |
| `components/MasterSettingsScreen.tsx` | Backup button, `onDataCleared` prop, no-scrollbar JS-only scroll, `handleWheel`, `style={{ overflowY: 'hidden' }}` |
| `components/StartScreen.tsx` | `isAdmin` prop usage |
| `constants.ts` | `areaId` in `INITIAL_TABLES` |
| `index.css` | `.scrollbar-hide` improved for Firefox + aggressive webkit hiding |
| `server/db.js` | `timezone: '-06:00'` for MySQL connection (El Salvador) |
| `utils/dates.ts` | New helper: `getElSalvadorDateString()`, `formatToElSalvadorDate()` |
| `components/CashOpeningModal.tsx` | Default date uses El Salvador timezone |
| `components/CashClosingScreen.tsx` | `getTodayDateString()` uses El Salvador |
| `components/CashAuditScreen.tsx` | `todayStr` and order date filter with El Salvador |
| `components/DeliveryDashboard.tsx` | Today range for delivery history |
| `components/DailySummaryScreen.tsx` | `max` date input with El Salvador |
| `components/MasterSettingsScreen.tsx` | Backup filename date with El Salvador |
| `components/PendingBalancesScreen.tsx` | Default date range with El Salvador |
| `components/AuditLogsScreen.tsx` | Default date range with El Salvador |
| `components/ChefStatsModal.tsx` | Default date range with El Salvador |
| `components/PaymentControl.tsx` | Due date calculations with El Salvador, grace days `||` → `??` + string state + input editable |

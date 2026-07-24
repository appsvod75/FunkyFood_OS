# Guía de Replicación: KDS Analytics (Historial y Estadísticas)

Este documento detalla los pasos necesarios para calcar el sistema de Historial (vista de comandas) y Estadísticas de Chef en otras versiones de la plataforma.

## 1. Base de Datos (MySQL)

Es indispensable tener el campo `chef` en la tabla `orders` para registrar quién termina el pedido, y el campo `ready_at` para medir tiempos.

```sql
ALTER TABLE orders ADD COLUMN chef VARCHAR(100) DEFAULT NULL AFTER waiter_id;
-- Nota: Asegúrate de que ready_at exista para registrar el TIMESTAMP de cuando cocina marca "TERMINAR".
```

## 2. Backend (server/routes.js)

Añadir el endpoint de reportes para calcular productividad y volumen por cocinero.

```javascript
// Endpoint para obtener estadísticas de rendimiento por cocinero
router.get('/reports/chef-performance', async (req, res) => {
    const { branchId, startDate, endDate } = req.query;
    try {
        let sql = `
            SELECT 
                chef as chefName,
                COUNT(*) as totalOrders,
                AVG(TIMESTAMPDIFF(SECOND, created_at, ready_at)) as avgPrepTimeSeconds
            FROM orders
            WHERE chef IS NOT NULL AND ready_at IS NOT NULL
        `;
        const params = [];

        if (branchId) {
            sql += ' AND branch_id = ?';
            params.push(branchId);
        }
        if (startDate) {
            sql += ' AND created_at >= ?';
            params.push(startDate + ' 00:00:00');
        }
        if (endDate) {
            sql += ' AND created_at <= ?';
            params.push(endDate + ' 23:59:59');
        }

        sql += ' GROUP BY chef ORDER BY totalOrders DESC';

        const stats = await query(sql, params);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

## 3. Frontend: Servicio API (api.ts)

Registrar el método para consumir el nuevo endpoint.

```typescript
async getChefPerformance(filters: { startDate?: string, endDate?: string, branchId?: number }) {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.branchId) params.append('branchId', filters.branchId.toString());
    return this.get(`/reports/chef-performance?${params}`);
}
```

## 4. Nuevos Componentes UI

### A. KdsHistoryModal.tsx (Estilo Comandas)
Este componente debe mostrar las órdenes de "Hoy" usando la misma estética de los tickets del KDS. 
- **Filtro Crítico:** Mostrar órdenes con `kitchenStatus === 'served'` (activas) O que estén en el array de `completedOrders`.
- **Diseño:** Usar `columns-X` (CSS columns) para el layout masonry.

### B. ChefStatsModal.tsx (Estadísticas Compactas)
Muestra tarjetas con el volumen y tiempo promedio.
- **Formato de tiempo:** Convertir segundos a `Xm Ys`.
- **Visual:** Incluir una barra de progreso relativa al volumen del chef con más órdenes.

## 5. Integración en KdsScreen.tsx

1.  **Estados:**
    ```tsx
    const [showHistory, setShowHistory] = useState(false);
    const [showStats, setShowStats] = useState(false);
    ```
2.  **Lógica Intermedia (historyOrders):**
    Combinar órdenes activas servidas con las completadas para que el historial no se vea vacío si no han pagado.
    ```tsx
    const historyOrders = useMemo(() => {
        const servedActive = activeOrders.filter(o => o.kitchenStatus === 'served');
        return [...servedActive, ...completedOrders];
    }, [activeOrders, completedOrders]);
    ```
3.  **Botones en Cabecera:** Añadir botones con iconos `ClipboardListIcon` y `ChartBarIcon` para abrir los modales.
4.  **Render de Modales:** Colocar los modales al final del JSX del KdsScreen.

---
**Nota para el desarrollador:** El diseño debe mantener el "Dark Mode" premium y las animaciones de `animate-in fade-in` para una experiencia fluida.

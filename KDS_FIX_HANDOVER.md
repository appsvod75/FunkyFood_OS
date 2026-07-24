# Handover de Corrección: Persistencia de Chef en KDS

Este documento detalla la corrección realizada para solucionar el problema del KDS donde las órdenes se quedaban "bloqueadas" en estado "En Proceso" después de una sincronización o refresco.

## Problema
El campo `chef` (quien toma la orden en el KDS) no se persistía en la base de datos. Al ocurrir un evento de Socket.io o un refresco, el estado local de la orden se sobrescribía con los datos de la DB, perdiendo el nombre del chef. Como el KDS solo permite "TERMINAR" si el usuario actual coincide con el `order.chef`, el botón se volvía inactivo.

## Solución Requerida

### 1. Base de Datos
Es necesario añadir la columna `chef` a la tabla `orders`.

**SQL:**
```sql
ALTER TABLE orders ADD COLUMN chef VARCHAR(100) DEFAULT NULL AFTER waiter_id;
```

### 2. Backend (server/routes.js)
Se debe actualizar la ruta `PUT /orders/:id` para que guarde el campo `chef` si viene en el payload.

**Cambio en SQL de actualización:**
```javascript
if (updates.chef !== undefined) { 
    fields.push('chef = ?'); 
    values.push(updates.chef); 
}
```

### 3. Auto-Migración (Opcional pero recomendado)
Añadir un bloque de código al inicio del servidor para crear la columna automáticamente.

```javascript
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SELECT chef FROM orders LIMIT 1");
    } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
            await conn.query("ALTER TABLE orders ADD COLUMN chef VARCHAR(100) DEFAULT NULL AFTER waiter_id");
        }
    } finally {
        conn.release();
    }
})();
```

## Nota sobre Roles
El sistema actual utiliza el rol `Cocinero` para filtrar quién aparece en la barra superior del KDS. Esta corrección no altera los roles, solo asegura que la asignación de la orden sea permanente hasta que se complete.

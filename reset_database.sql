-- ==========================================
-- SCRIPT DE LIMPIEZA TOTAL (RESET DE PEDIDOS)
-- ==========================================
-- Úsalo solo para borrar TODAS las ventas y reiniciar contadores (ej. antes de producción).

SET FOREIGN_KEY_CHECKS = 0; -- Desactivar seguridad de llaves foráneas temporalmente

-- 1. Vaciar tablas de detalles (Hijos)
TRUNCATE TABLE order_item_extras;
TRUNCATE TABLE order_items;
TRUNCATE TABLE payments;
TRUNCATE TABLE order_audit_logs;

-- 2. Vaciar tabla principal (Padre)
TRUNCATE TABLE orders;

-- (Opcional) Si tuvieras tabla de cortes de caja en DB, agrégala aquí.
-- TRUNCATE TABLE cash_closing_reports; 

SET FOREIGN_KEY_CHECKS = 1; -- Reactivar seguridad

-- Confirmación visual (opcional si lo corres en DBeaver te dirá filas afectadas)
SELECT "Limpieza completada. Contadores reiniciados a 0." as status;

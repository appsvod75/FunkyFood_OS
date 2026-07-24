# FunkyFood OS V1 - Contexto de Desarrollo

> **PARA EL SIGUIENTE AGENTE:** Lee este archivo PRIMERO para entender el estado del proyecto y evitar "resetear" el conocimiento.

## 1. Resumen del Proyecto
Sistema de Punto de Venta (POS) para restaurantes, construido con React (Frontend) y Node.js/Express (Backend) con base de datos MySQL. La aplicación está diseñada para ser desplegada en un VPS Ubuntu.

## 2. Pila Tecnológica
- **Frontend:** React 18+, Vite, TailwindCSS.
    - **Estado:** Gestión manual en `App.tsx` (sin Redux/Context global complejo, estado pasado por props).
    - **Routing:** Manual basado en estado `currentView` en `App.tsx` (No usa React Router).
    - **Real-time:** Socket.io-client.
- **Backend:** Node.js, Express.
    - **Base de Datos:** MySQL (driver `mysql2`).
    - **Real-time:** Socket.io.
    - **Ubicación:** Carpeta `/server`.
    - **Lógica Principal:** Todo el manejo de rutas y consultas está en `server/routes.js` que es el "cerebro" del backend.

## 3. Workflow de Despliegue (CRÍTICO) 🚀
La aplicación ya está en producción en un VPS.

1.  **Frontend:**
    - Si modificas archivos `.tsx`, `.css`, etc., debes ejecutar `npm run build` localmente para generar la carpeta `dist`.
    - El usuario subirá la carpeta `dist` al VPS.

2.  **Backend:**
    - Si modificas `server/routes.js`, `server/index.js` o cualquier archivo del backend:
    - **AVISAR AL USUARIO:** "He modificado el backend".
    - El usuario subirá los archivos modificados vía **FileZilla** al VPS.
    - El usuario reiniciará el proceso con PM2 (`pm2 restart ...`).

## 4. Estado Actual & Mapa Mental
### Arquitectura de Archivos Clave
- `App.tsx`: **CEREBRO DEL FRONTEND**. Aquí ocurre la carga inicial (`api.getInitialData`), la gestión de websockets (`new_order`, `order_updated`) y el renderizado condicional de vistas (`StartScreen`, `OrderScreen`, `AdminPanel`, etc.).
- `server/routes.js`: **CEREBRO DEL BACKEND**. Contiene todos los endpoints API (`/orders`, `/products`, etc.) y las consultas SQL directas.
- `database_schema.sql`: Estructura de la BD. Referencia para nombres de tablas y columnas.
- `types.ts`: Interfaces TypeScript compartidas. Mantenlas sincronizadas con la BD.

### Funcionalidades Clave Implementadas
- **Órdenes:** Creación, edición, estados (activo/completado) y estados de cocina (pending/ready/served).
- **Cocina (KDS):** Pantalla dedicada (`KdsScreen`) con actualizaciones en tiempo real via Sockets.
- **Impresión:** Integración con Google Apps Script via Webhooks (configurado en `branches` y `company_settings`).
- **Auditoría:** Tabla `order_audit_logs` para rastrear eliminaciones.
- **Monitor de Mesas:** Vista de alta densidad (`TableMonitorScreen.tsx`) para seguimiento de disponibilidad y tiempos.
- **Etiquetas de Observación:** Sistema predictivo con autocompletado visual (glow) y reactividad instantánea vía sockets.

- **Monitor de Mesas:** Implementación de tablero de control con diseño compacto (Ajustado a pedidos del usuario: "hojita", BUSY/FREE, alta densidad).
- **Menú Digital:** Mejoras en la navegación para staff y corrección de bloqueos de redirección.
- **Predictivos:** Implementación de resaltado dinámico para etiquetas de observación durante la escritura.

## 5. Reglas de Oro
1.  **Idioma:** Español coloquial ("bro", "hermano").
2.  **Riesgo:** Si tocas `server/routes.js`, recuerda que requiere reinicio manual en VPS por parte del usuario.
3.  **Persistencia:** La app carga todo al inicio (`/initial-data`). Si agregas tablas nuevas, actualiza `api.getInitialData` en `server/routes.js` y `api.ts` frontend.
4.  **Layout:** El contenedor `main` en `App.tsx` ya tiene `pt-14 sm:pt-16` para despejar el Header fijo. NO agregues paddings superiores grandes en las pantallas individuales para evitar espacios muertos.

---
*Este archivo fue generado para asegurar la continuidad del proyecto entre sesiones.*

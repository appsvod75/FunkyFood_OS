# Chrome Android Rendering Bug Fix — Prompt para Agente

## Contexto del Problema

Esta es una aplicación React + Vite + TailwindCSS. En navegadores Chrome de Android (especialmente versiones viejas o dispositivos con GPU limitada), **algunas vistas se renderizan completamente en negro o semi-negro**, aunque la funcionalidad sigue operando correctamente por debajo.

Esto es un **bug de renderizado de GPU de Chrome** (llamado Tile Glitch o Paint Glitch) que se dispara específicamente cuando una vista combina demasiados efectos CSS pesados al mismo tiempo:
- `backdrop-blur-*` (filtros de desenfoque sobre fondos)
- `blur-*` (desenfoque en elementos decorativos)
- `bg-*/opacity` con transparencias compuestas (ej: `bg-gray-900/40`)
- Animaciones de entrada `animate-in fade-in` o `slide-in-from-*`
- `overflow-hidden` con `z-index` altos anidados

**La solución es simple:** reemplazar esos efectos costosos con fondos sólidos oscuros equivalentes, manteniendo el diseño visual lo más cercano posible pero sin exigirle a la GPU ese trabajo extra.

---

## Reglas de Sustitución a Aplicar

Estas son las reglas de reemplazo que tienes que seguir en cada archivo que se mencione más abajo:

| ❌ Clase TW Original | ✅ Reemplazar por |
|---|---|
| `backdrop-blur-md` | eliminar completamente |
| `backdrop-blur-xl` | eliminar completamente |
| `backdrop-blur-3xl` | eliminar completamente |
| `backdrop-blur-none` | eliminar completamente |
| `blur-2xl` | eliminar completamente |
| `blur-sm` | eliminar completamente |
| `blur-*` en elementos decorativos (`<div>` sin contenido) | eliminar completamente |
| `bg-gray-900/40` | `bg-gray-800` |
| `bg-gray-900/60` | `bg-gray-800` |
| `bg-black/90 backdrop-blur-3xl` | `bg-black/95` |
| `animate-in fade-in` | `transition-all` |
| `animate-in slide-in-from-left` | eliminar el `animate-in slide-in-from-left` (mantener el `duration-*` si existe) |
| `animate-in zoom-in` | eliminar completamente |
| `border-white/5` en elementos de lista | se puede cambiar a `border-gray-700` si el fondo también se volvió sólido |
| `bg-white/5` en elementos hover/fondo | `bg-gray-700` |
| `hover:bg-white/5` | `hover:bg-gray-700` |

**IMPORTANTE:** Sólo aplica las sustituciones en los archivos listados abajo. No modifiques archivos no mencionados.

---

## Archivos en los que debes trabajar

### 1. `AdminPanel.tsx`

Busca y corrige estos patrones:

- **Chips / badges de estado** en el header del editor de pedidos (donde se muestra info del servicio, mesa, mesero, cliente): Estas chips usan algo como `bg-amber-500/10` o `bg-green-500/10` + `backdrop-blur`. Cámbialos a un fondo sólido equivalente como `bg-amber-900/60` o `bg-gray-800` manteniendo el color del texto y borde.
- **Modales del admin** (el `AdminModal` interno): Revisa si el overlay usa `backdrop-blur` y elimínalo. El fondo del modal en sí (`bg-gray-900/80` por ejemplo) cámbialo a `bg-gray-900`.
- **Iconos del Dashboard**: Busca el objeto `colorMap` que define los colores de los botones (Productos, Categorías, etc.). Reemplaza las opacidades `/25` y `/30` por fondos sólidos oscuros (ej: `bg-amber-950 border-amber-700`).
- **Animaciones de entrada** de las vistas del panel: Si hay `animate-in fade-in` en el contenedor padre de cada vista, sustitúyelo por `transition-all duration-300`.
- **Overlay del carrito / cart panel**: Si tiene `backdrop-blur` o fondo con transparencia compuesta, aplica la misma sustitución.

### 2. Componente del Carrito (si existe como archivo separado, ej: `Cart.tsx` o `CartPanel.tsx`)

- Busca los **botones de eliminar ítem** (el icono de basura). Revisa si tienen `backdrop-blur` en su contenedor padre. Elimínalo.
- El contenedor principal del carrito: Si usa `bg-*/opacity + backdrop-blur`, sustitúyelo por fondo sólido.

### 3. Componente del Header del Pedido / Editor de Pedido (donde van las chips de selección: servicio, mesa, mesero, cliente)

Este es el componente más crítico. Aquí las "chips" seleccionables (pequeñas etiquetas verdes/amarillas que indican la selección actual) probablemente tienen:
```
bg-green-500/10 border-green-500/30 backdrop-blur-sm
```
Cámbialas a:
```
bg-green-900/70 border-green-500/30
```
O cualquier fondo oscuro sólido que sea visualmente cercano al original.

---

## Lo que NO debes tocar

- El componente de **Monitor de Mesas** (si existe en esta app)
- El componente de **Inventario** (no existe en esta app)
- Los estilos de `index.css` o el archivo de configuración de Tailwind
- Cualquier animación que sea `transition-*` (esas son ligeras y no causan el bug)
- El color o tipografía del texto

---

## Proceso Recomendado

1. Leer cada archivo listado arriba antes de editar.
2. Buscar con `grep` las clases `backdrop-blur`, `blur-`, `animate-in`, `bg-*/` con opacidad (`/40`, `/60`, `/80`) para localizar todos los candidatos.
3. Aplicar las sustituciones de la tabla de arriba.
4. Correr `npm run build` al terminar y verificar que compile sin errores.
5. No es necesario hacer pruebas visuales en navegador durante el proceso; el usuario validará el resultado en su dispositivo Android.

---

## Verificación Final

Una vez aplicados los cambios, el usuario debe:
1. Subir la nueva carpeta `dist/` al servidor VPS.
2. Abrir la app en Chrome Android y navegar a las vistas del panel de admin (header de pedido con chips, y el carrito).
3. Verificar que ya no aparecen pantallas negras o elementos invisibles.

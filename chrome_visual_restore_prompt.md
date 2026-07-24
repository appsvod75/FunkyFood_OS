# Chrome Rendering Fix — Reversión (Restaurar Efectos Visuales)

## Contexto

Este prompt es el **INVERSO** del archivo `chrome_render_fix_prompt.md`. En algún momento se eliminaron efectos de `backdrop-blur`, `blur-*` y `animate-in` de varias vistas para corregir un bug de renderizado de GPU en Chrome Android. Cuando ese bug esté corregido en el navegador (o si se quiere probar en un entorno diferente), este prompt restaura la estética original.

**Proyecto:** FunkyFood_OS  
**Archivo principal a restaurar:** `components/ManageInventoryScreen.tsx`

---

## Cambios a Revertir en `ManageInventoryScreen.tsx`

Aplica las siguientes sustituciones exactas, en el orden que se listan:

### 1. Tarjeta de Estadísticas (`StatHeaderCard` - línea ~18)

```diff
- <div className="bg-gray-800 p-4 rounded-[24px] border border-white/5 ...
+ <div className="bg-gray-900/40 backdrop-blur-md p-4 rounded-[24px] border border-white/5 ...
```
```diff
- <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full -mr-12 -mt-12 group-hover:bg-amber-500/20 transition-all">
+ <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-amber-500/20 transition-all">
```

### 2. Contenedor raíz del return (~línea 290)

```diff
- <div className="flex flex-col h-full overflow-hidden transition-all duration-300">
+ <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
```

### 3. Halo detrás del Search Bar (~línea 334)

```diff
- <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-transparent rounded-[24px] opacity-0 group-focus-within:opacity-100 transition-duration-500">
+ <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-transparent rounded-[24px] blur opacity-0 group-focus-within:opacity-100 transition-duration-500">
```

### 4. Input de búsqueda (~línea 341)

```diff
- className="w-full h-12 py-2 pl-12 pr-4 bg-gray-800 border border-gray-700 rounded-[20px] text-white font-black uppercase outline-none focus:border-amber-500/40 placeholder:text-gray-500 text-[10px] shadow-lg transition-all relative z-20"
+ className="w-full h-12 py-2 pl-12 pr-4 bg-gray-900/60 backdrop-blur-xl border border-white/5 rounded-[20px] text-white font-black uppercase outline-none focus:border-amber-500/40 placeholder:text-gray-600 text-[10px] shadow-lg transition-all relative z-20"
```

### 5. Filas de la lista de inventario (~línea 377)

```diff
- className={`group relative flex flex-col sm:grid ... bg-gray-800 rounded-[16px] px-4 py-2 sm:h-12 border border-gray-700 transition-all hover:bg-gray-700 cursor-pointer ${selectedDetailId === item.productId ? 'ring-2 ring-amber-500/50 bg-gray-700' : ''}`}
+ className={`group relative flex flex-col sm:grid ... bg-gray-900/40 backdrop-blur-md rounded-[16px] px-4 py-2 sm:h-12 border border-white/5 transition-all hover:bg-white/5 cursor-pointer ${selectedDetailId === item.productId ? 'ring-2 ring-amber-500/50 bg-amber-500/5 border-amber-500/20' : ''}`}
```

### 6. Contenedor del panel de detalle lateral (~línea 428)

Cambiar de:
```
hidden sm:flex sm:bg-transparent ... bg-black/80 sm:bg-transparent
```
A:
```diff
- <div className={`fixed inset-0 sm:static sm:w-[380px] z-[200] flex items-end sm:items-stretch transition-all duration-500 ${selectedDetailItem ? 'bg-black/80 sm:bg-transparent pointer-events-auto' : 'hidden sm:flex sm:bg-transparent pointer-events-none sm:pointer-events-auto'}`}>
+ <div className={`fixed inset-0 sm:static sm:w-[380px] sm:bg-transparent z-[200] flex items-end sm:items-stretch transition-all duration-500 ${selectedDetailItem ? 'bg-black/40 backdrop-blur-xl pointer-events-auto' : 'bg-transparent backdrop-blur-none pointer-events-none sm:pointer-events-auto'}`}>
```
Y también (la capa oscura clickeable de atrás):
```diff
- <div className={`absolute inset-0 sm:hidden bg-black/60 transition-opacity duration-300 ${!selectedDetailItem ? 'opacity-0' : 'opacity-100'}`} onClick={...}>
+ <div className={`absolute inset-0 sm:hidden bg-black/60 ${!selectedDetailItem ? 'hidden' : ''}`} onClick={...}>
```
Y el panel en sí (agregar `z-10`... se puede dejar igual, ya estaba):
```diff
- <div className={`bg-gray-900 w-full h-[85vh] sm:h-auto ... z-10 ${!selectedDetailItem ? 'translate-y-full sm:translate-y-0' : 'translate-y-0'}`}>
+ <div className={`bg-gray-900 w-full h-[85vh] sm:h-auto ... ${!selectedDetailItem ? 'translate-y-full sm:translate-y-0' : 'translate-y-0'}`}>
```

### 7. Círculo decorativo de valorización (~línea 447)

```diff
- <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/20 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700">
+ <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/20 blur-2xl rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700">
```

### 8. Modal ERP — fondo del overlay (~línea 632)

```diff
- <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[500] p-4 sm:p-8 overflow-hidden">
+ <div className="fixed inset-0 bg-black/90 backdrop-blur-3xl flex items-center justify-center z-[500] p-4 sm:p-8 overflow-hidden">
```

### 9. Línea decorativa del modal ERP (~línea 635)

```diff
- <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent">
+ <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent blur-sm">
```

### 10. Círculo decorativo fondo modal ERP (~línea 875)

```diff
- <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full pointer-events-none -mr-40 -mb-40">
+ <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full pointer-events-none -mr-40 -mb-40">
```

---

## Proceso

1. Abrir `components/ManageInventoryScreen.tsx`
2. Aplicar los 10 cambios en orden
3. Correr `npm run build`
4. Verificar que compila sin errores
5. Subir la nueva carpeta `dist/` al servidor

> **NOTA:** Antes de aplicar este prompt, confirmar que el bug de Chrome ya fue corregido probando con una versión reciente de Chrome Android. Si la pantalla sigue negra con los efectos blur activados, el bug persiste y este prompt NO debe aplicarse.

# POS Minimarket SaaS — Guía de instalación local

## Pasos para correr localmente (npm run dev)

### 1. Instalar Node.js (solo la primera vez)
Descarga desde https://nodejs.org → botón verde "LTS" → instala normalmente.

### 2. Configurar Supabase

Ve a https://supabase.com → crea un proyecto nuevo → espera que termine.

**Ejecutar el SQL del esquema:**
- En Supabase: menú izquierdo → "SQL Editor" → "New query"
- Pega TODO el contenido de `supabase/schema_completo.sql`
- Click en "Run" (▶)

Esto crea las 7 tablas + datos de prueba + función RPC + políticas de seguridad.

**Crear un usuario de prueba:**
- En Supabase: menú izquierdo → "Authentication" → "Users" → "Add user" → "Create new user"
- Email: `admin@prueba.com` | Contraseña: `123456`
- Copia el UUID que aparece en la columna "UID"

**Vincular usuario con el establecimiento (en SQL Editor):**
```sql
INSERT INTO usuarios (id, establecimiento_id, nombre, rol)
VALUES ('PEGA-EL-UUID-AQUI', 1, 'Admin Local', 'admin');
```

### 3. Configurar variables de entorno

En Supabase: "Settings" (engranaje) → "API"

Copia:
- **Project URL** → es tu `SUPABASE_URL`
- **anon public** → es tu `SUPABASE_ANON_KEY`

Crea el archivo `.env.local` en la raíz del proyecto:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 4. Instalar dependencias y correr

Abre la Terminal dentro de la carpeta `pos-minimarket-saas`:
```bash
npm install
npm run dev
```

Abre en el navegador: http://localhost:3000

---

## Flujo de suscripción (tu modelo SaaS)

### Para activar un cliente nuevo
```sql
-- Activar con 30 días
UPDATE establecimientos
SET estado_suscripcion = TRUE,
    fecha_vencimiento = CURRENT_DATE + INTERVAL '30 days'
WHERE id = 1;
```

### Para simular suscripción vencida (prueba local)
```sql
UPDATE establecimientos
SET fecha_vencimiento = '2024-01-01'
WHERE id = 1;
```
→ Al hacer login, el sistema redirige automáticamente a /suscripcion-vencida

### Para reactivar después de pago
```sql
UPDATE establecimientos
SET estado_suscripcion = TRUE,
    fecha_vencimiento = CURRENT_DATE + INTERVAL '30 days'
WHERE id = 1;
```

### Para suspender manualmente (sin esperar vencimiento)
```sql
UPDATE establecimientos SET estado_suscripcion = FALSE WHERE id = 1;
```

---

## Estructura del proyecto

```
src/
├── app/
│   ├── login/page.tsx              ← Pantalla de login
│   ├── pos/page.tsx                ← Pantalla principal del POS (protegida)
│   ├── suscripcion-vencida/page.tsx ← Pantalla de bloqueo SaaS
│   ├── layout.tsx                  ← Layout global con AuthProvider
│   └── globals.css
├── components/pos/
│   ├── POSScreen.tsx               ← Componente orquestador
│   ├── CartPanel.tsx               ← Panel del carrito
│   └── ProductCard.tsx             ← Tarjeta de producto
├── hooks/index.ts                  ← useInventario + useCarrito
├── lib/
│   ├── supabase.ts                 ← Cliente Supabase
│   └── auth-context.tsx            ← AuthProvider + verificación de suscripción
├── middleware.ts                   ← Protege rutas sin sesión
└── types/index.ts                  ← Tipos TypeScript + calcularEstadoSuscripcion()
supabase/
└── schema_completo.sql             ← Esquema completo + datos de prueba
```

---

## Datos de prueba incluidos

El SQL ya carga automáticamente:
- **Establecimiento 1:** "Minimarket El Ahorro" — suscripción activa 90 días
- **Establecimiento 2:** "Tienda Demo Vencida" — suscripción vencida (para probar bloqueo)
- **3 vendedores:** Doña Carmen, Sr. Marcos, La Tiendita
- **7 categorías** con íconos
- **17 productos** con código de barras, precios y stock real

-- ================================================================
-- ESQUEMA COMPLETO — POS Minimarket SaaS Multivendedor
-- Ejecutar en: Supabase → SQL Editor (en orden)
-- ================================================================


-- ── 1. ESTABLECIMIENTOS (con campos de suscripción SaaS) ─────────
CREATE TABLE establecimientos (
  id                    SERIAL PRIMARY KEY,
  nombre                VARCHAR(100) NOT NULL,
  ruc_nit               VARCHAR(20) UNIQUE,
  direccion             TEXT,
  -- ── Campos SaaS de control de acceso ──────────────────────────
  estado_suscripcion    BOOLEAN DEFAULT TRUE,      -- TRUE = activo, FALSE = suspendido manualmente
  fecha_vencimiento     DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  url_pago              TEXT,                      -- Link externo de pago (MercadoPago, PayPal, etc.)
  -- ── Metadata ──────────────────────────────────────────────────
  creado_en             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ── 2. VENDEDORES ────────────────────────────────────────────────
CREATE TABLE vendedores (
  id                    SERIAL PRIMARY KEY,
  establecimiento_id    INT REFERENCES establecimientos(id) ON DELETE CASCADE,
  nombre                VARCHAR(100) NOT NULL,
  telefono              VARCHAR(20),
  porcentaje_comision   NUMERIC(5,2) DEFAULT 0.00,
  creado_en             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ── 3. CATEGORÍAS ────────────────────────────────────────────────
CREATE TABLE categorias (
  id                    SERIAL PRIMARY KEY,
  establecimiento_id    INT REFERENCES establecimientos(id) ON DELETE CASCADE,
  nombre                VARCHAR(50) NOT NULL,
  icono                 VARCHAR(50)
);


-- ── 4. PRODUCTOS ─────────────────────────────────────────────────
CREATE TABLE productos (
  id                    SERIAL PRIMARY KEY,
  establecimiento_id    INT REFERENCES establecimientos(id) ON DELETE CASCADE,
  vendedor_id           INT REFERENCES vendedores(id) ON DELETE RESTRICT,
  categoria_id          INT REFERENCES categorias(id) ON DELETE SET NULL,
  codigo_barras         VARCHAR(50),
  nombre                VARCHAR(150) NOT NULL,
  precio_venta          NUMERIC(10,2) NOT NULL,
  precio_costo          NUMERIC(10,2),
  stock_actual          INT DEFAULT 0,
  stock_minimo          INT DEFAULT 5,
  creado_en             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ── 5. VENTAS ────────────────────────────────────────────────────
CREATE TABLE ventas (
  id                    SERIAL PRIMARY KEY,
  establecimiento_id    INT REFERENCES establecimientos(id) ON DELETE CASCADE,
  numero_comprobante    VARCHAR(50) NOT NULL,
  total                 NUMERIC(10,2) NOT NULL,
  metodo_pago           VARCHAR(50),
  fecha_venta           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ── 6. DETALLE DE VENTAS ─────────────────────────────────────────
CREATE TABLE detalle_ventas (
  id                    SERIAL PRIMARY KEY,
  venta_id              INT REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id           INT REFERENCES productos(id) ON DELETE RESTRICT,
  vendedor_id           INT REFERENCES vendedores(id) ON DELETE RESTRICT,
  cantidad              INT NOT NULL,
  precio_unitario       NUMERIC(10,2) NOT NULL,
  subtotal              NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);


-- ── 7. USUARIOS DE SISTEMA (cajeros/admins por establecimiento) ───
-- Supabase Auth maneja la contraseña. Esta tabla extiende el perfil.
CREATE TABLE usuarios (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  establecimiento_id    INT REFERENCES establecimientos(id) ON DELETE CASCADE,
  nombre                VARCHAR(100),
  rol                   VARCHAR(20) DEFAULT 'cajero' CHECK (rol IN ('admin', 'cajero')),
  creado_en             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ================================================================
-- DATOS DE PRUEBA — para desarrollo local (npm run dev)
-- ================================================================

-- Establecimiento de prueba (suscripción activa)
INSERT INTO establecimientos (nombre, ruc_nit, direccion, estado_suscripcion, fecha_vencimiento, url_pago)
VALUES ('Minimarket El Ahorro', '1791234567001', 'Av. Amazonas 123, Quito', TRUE, CURRENT_DATE + 90, 'https://mpago.la/tu-link-de-pago');

-- Establecimiento con suscripción VENCIDA (para probar el bloqueo)
INSERT INTO establecimientos (nombre, ruc_nit, direccion, estado_suscripcion, fecha_vencimiento, url_pago)
VALUES ('Tienda Demo Vencida', '9999999999001', 'Demo', FALSE, '2024-01-01', 'https://mpago.la/tu-link-de-pago');

-- Vendedores del local 1
INSERT INTO vendedores (establecimiento_id, nombre, telefono, porcentaje_comision) VALUES
  (1, 'Doña Carmen',  '0991234567', 0.00),
  (1, 'Sr. Marcos',   '0997654321', 0.00),
  (1, 'La Tiendita',  '0993456789', 0.00);

-- Categorías del local 1
INSERT INTO categorias (establecimiento_id, nombre, icono) VALUES
  (1, 'Bebidas',    '🥤'),
  (1, 'Snacks',     '🍟'),
  (1, 'Lácteos',    '🥛'),
  (1, 'Panadería',  '🍞'),
  (1, 'Higiene',    '🧼'),
  (1, 'Granos',     '🌾'),
  (1, 'Conservas',  '🥫');

-- Productos del local 1
INSERT INTO productos (establecimiento_id, vendedor_id, categoria_id, codigo_barras, nombre, precio_venta, precio_costo, stock_actual, stock_minimo) VALUES
  (1, 1, 1, '7501055300105', 'Coca-Cola 600ml',        1.25, 0.85, 48, 10),
  (1, 1, 1, '7501055300106', 'Agua mineral 500ml',     0.75, 0.40, 60, 15),
  (1, 1, 1, '7501031311309', 'Jugo de naranja 1L',     1.50, 1.00, 24,  5),
  (1, 2, 1, '7501055300201', 'Cerveza Pilsener 600ml', 1.80, 1.20, 36,  8),
  (1, 2, 4, '7750495100124', 'Pan de molde blanco',    2.20, 1.40, 15,  5),
  (1, 2, 4, '7750495100125', 'Croissant de mantequilla',0.90,0.55, 20,  8),
  (1, 2, 2, '7622210100087', 'Galletas chocochips',    1.10, 0.70, 30, 10),
  (1, 3, 2, '7500435126678', 'Papas fritas grande',    1.40, 0.90, 25,  8),
  (1, 3, 2, '7622210060191', 'Chocolate de leche',     0.85, 0.50, 40, 10),
  (1, 1, 6, '7750001122334', 'Arroz 1kg',              1.65, 1.10, 50, 10),
  (1, 1, 6, '7750001122335', 'Fideos tallarín 400g',   1.20, 0.75, 35, 10),
  (1, 3, 7, '7501077001108', 'Atún en agua 180g',      2.50, 1.70, 18,  5),
  (1, 3, 7, '7750495200015', 'Sardinas en tomate',     1.80, 1.15, 22,  5),
  (1, 2, 5, '7501055400020', 'Jabón de tocador',       0.95, 0.55, 28, 10),
  (1, 3, 5, '7501055400021', 'Papel higiénico x4',     2.80, 1.90, 20,  5),
  (1, 1, 3, '7750435001256', 'Leche entera 1L',        1.10, 0.72, 30, 10),
  (1, 1, 3, '7750435001257', 'Queso fresco 250g',      2.40, 1.60,  8,  3);


-- ================================================================
-- FUNCIÓN RPC — registrar_venta (transacción atómica)
-- ================================================================
CREATE OR REPLACE FUNCTION registrar_venta(
  establecimiento_id  INT,
  numero_comprobante  TEXT,
  total               NUMERIC,
  metodo_pago         TEXT,
  detalles            JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  nueva_venta_id INT;
  detalle        JSONB;
  prod_stock     INT;
BEGIN
  INSERT INTO ventas (establecimiento_id, numero_comprobante, total, metodo_pago)
  VALUES (registrar_venta.establecimiento_id, registrar_venta.numero_comprobante,
          registrar_venta.total, registrar_venta.metodo_pago)
  RETURNING id INTO nueva_venta_id;

  FOR detalle IN SELECT * FROM jsonb_array_elements(registrar_venta.detalles) LOOP
    SELECT stock_actual INTO prod_stock
    FROM productos WHERE id = (detalle->>'producto_id')::INT FOR UPDATE;

    IF prod_stock IS NULL THEN
      RAISE EXCEPTION 'Producto % no encontrado', detalle->>'producto_id';
    END IF;
    IF prod_stock < (detalle->>'cantidad')::INT THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %', detalle->>'producto_id';
    END IF;

    INSERT INTO detalle_ventas (venta_id, producto_id, vendedor_id, cantidad, precio_unitario)
    VALUES (nueva_venta_id, (detalle->>'producto_id')::INT, (detalle->>'vendedor_id')::INT,
            (detalle->>'cantidad')::INT, (detalle->>'precio_unitario')::NUMERIC);

    UPDATE productos SET stock_actual = stock_actual - (detalle->>'cantidad')::INT
    WHERE id = (detalle->>'producto_id')::INT;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'venta_id', nueva_venta_id,
                             'comprobante', registrar_venta.numero_comprobante);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '%', SQLERRM;
END;
$$;


-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE establecimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendedores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_ventas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios          ENABLE ROW LEVEL SECURITY;

-- Política: cada usuario solo ve los datos de su establecimiento
CREATE POLICY "ver_propio_establecimiento" ON productos FOR ALL
  USING (establecimiento_id = (SELECT establecimiento_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "ver_ventas_propias" ON ventas FOR ALL
  USING (establecimiento_id = (SELECT establecimiento_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "ver_vendedores_propios" ON vendedores FOR ALL
  USING (establecimiento_id = (SELECT establecimiento_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "ver_categorias_propias" ON categorias FOR ALL
  USING (establecimiento_id = (SELECT establecimiento_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "ver_perfil_propio" ON usuarios FOR ALL
  USING (id = auth.uid());


-- ================================================================
-- VISTA — reporte de ganancias por vendedor
-- ================================================================
CREATE OR REPLACE VIEW reporte_ganancias_vendedor AS
SELECT
  v.establecimiento_id,
  v.fecha_venta::DATE                                               AS fecha,
  vnd.id                                                            AS vendedor_id,
  vnd.nombre                                                        AS vendedor_nombre,
  COUNT(DISTINCT dv.venta_id)                                       AS total_transacciones,
  SUM(dv.cantidad)                                                  AS unidades_vendidas,
  SUM(dv.subtotal)                                                  AS ingresos_brutos,
  SUM(dv.cantidad * COALESCE(p.precio_costo, 0))                   AS costo_total,
  SUM(dv.subtotal) - SUM(dv.cantidad * COALESCE(p.precio_costo,0)) AS ganancia_neta
FROM detalle_ventas dv
JOIN ventas      v   ON dv.venta_id    = v.id
JOIN vendedores  vnd ON dv.vendedor_id = vnd.id
JOIN productos   p   ON dv.producto_id = p.id
GROUP BY v.establecimiento_id, v.fecha_venta::DATE, vnd.id, vnd.nombre
ORDER BY fecha DESC, ganancia_neta DESC;

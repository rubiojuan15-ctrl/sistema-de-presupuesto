const pool = require("./postgres");

async function ensureSchema(client = pool) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            usuario TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS presupuestos (
            id SERIAL PRIMARY KEY,
            cliente TEXT NOT NULL DEFAULT '',
            telefono TEXT DEFAULT '',
            direccion TEXT DEFAULT '',
            trabajo TEXT NOT NULL DEFAULT '',
            observaciones TEXT DEFAULT '',
            materiales NUMERIC(14,2) NOT NULL DEFAULT 0,
            manodeobra NUMERIC(14,2) NOT NULL DEFAULT 0,
            total NUMERIC(14,2) NOT NULL DEFAULT 0,
            sena NUMERIC(14,2) NOT NULL DEFAULT 0,
            saldo NUMERIC(14,2) NOT NULL DEFAULT 0,
            fecha TEXT DEFAULT '',
            fechavencimiento TEXT DEFAULT '',
            estado TEXT DEFAULT 'Pendiente',
            imagenes TEXT DEFAULT '',
            usuarioid INTEGER
        );

        CREATE TABLE IF NOT EXISTS gastos (
            id SERIAL PRIMARY KEY,
            fecha TEXT NOT NULL,
            concepto TEXT NOT NULL,
            monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
            usuarioid INTEGER
        );

        CREATE TABLE IF NOT EXISTS pagos (
            id SERIAL PRIMARY KEY,
            presupuestoid INTEGER NOT NULL,
            fecha TEXT NOT NULL,
            monto NUMERIC(14,2) NOT NULL CHECK (monto > 0)
        );
        CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        usuarioid INTEGER NOT NULL,
        token TEXT NOT NULL,
        expiracion TIMESTAMP NOT NULL,
        usado BOOLEAN DEFAULT FALSE,

        CONSTRAINT fk_password_resets_usuario
            FOREIGN KEY (usuarioid)
            REFERENCES usuarios(id)
            ON DELETE CASCADE
         );
        CREATE TABLE IF NOT EXISTS pagos_huerfanos_migracion (
            id SERIAL PRIMARY KEY,
            sqlite_pago_id INTEGER NOT NULL,
            sqlite_presupuesto_id INTEGER NOT NULL,
            fecha TEXT NOT NULL,
            monto NUMERIC(14,2) NOT NULL,
            motivo TEXT NOT NULL,
            UNIQUE (sqlite_pago_id, sqlite_presupuesto_id)
        );

        CREATE INDEX IF NOT EXISTS presupuestos_usuarioid_idx
            ON presupuestos (usuarioid);
        CREATE INDEX IF NOT EXISTS gastos_usuarioid_idx
            ON gastos (usuarioid);
        CREATE INDEX IF NOT EXISTS pagos_presupuestoid_idx
            ON pagos (presupuestoid);
            CREATE INDEX IF NOT EXISTS password_resets_usuarioid_idx
        ON password_resets (usuarioid);

        CREATE INDEX IF NOT EXISTS password_resets_token_idx
        ON password_resets (token); 
    `);

    await client.query(`
        ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email TEXT;
        ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS emailverificado BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS emailverificaciontoken TEXT;
        ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS emailverificacionexpira TIMESTAMP;
    `);

    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_idx
            ON usuarios (LOWER(email))
            WHERE email IS NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_verificacion_token_idx
            ON usuarios (emailverificaciontoken)
            WHERE emailverificaciontoken IS NOT NULL;
    `);
}

module.exports = ensureSchema;

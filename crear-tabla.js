require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function crearTabla() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS presupuestos (
            id SERIAL PRIMARY KEY,
            cliente TEXT,
            telefono TEXT,
            direccion TEXT,
            trabajo TEXT,
            observaciones TEXT,
            materiales INTEGER,
            manoDeObra INTEGER,
            total INTEGER,
            sena INTEGER DEFAULT 0,
            saldo INTEGER DEFAULT 0,
            fecha TEXT,
            fechaVencimiento TEXT,
            estado TEXT,
            imagenes TEXT,
            usuarioId INTEGER
        );
    `);

    console.log("Tabla presupuestos creada");

    
    await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    );
`);

console.log("Tabla usuarios creada");

await pool.query(`
    CREATE TABLE IF NOT EXISTS gastos (
        id SERIAL PRIMARY KEY,
        fecha TEXT,
        concepto TEXT,
        monto NUMERIC(12,2),
        usuarioId INTEGER
    );
`);

console.log("Tabla gastos creada");

await pool.query(`
    CREATE TABLE IF NOT EXISTS pagos (
        id SERIAL PRIMARY KEY,
        presupuestoId INTEGER,
        fecha TEXT,
        monto NUMERIC(12,2)
    );
`);

console.log("Tabla pagos creada");
await pool.end();
}

crearTabla().catch(console.error);
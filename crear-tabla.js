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

    await pool.end();

}

crearTabla().catch(console.error);
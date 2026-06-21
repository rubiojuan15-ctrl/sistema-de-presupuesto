require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function listar() {

    const resultado = await pool.query(
        "SELECT * FROM presupuestos"
    );

    console.log(resultado.rows);

    await pool.end();
}

listar().catch(console.error);
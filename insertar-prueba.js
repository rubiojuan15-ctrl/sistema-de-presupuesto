require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function insertar() {

    const resultado = await pool.query(
        `
        INSERT INTO presupuestos
        (
            cliente,
            trabajo,
            total,
            estado
        )
        VALUES
        (
            $1, $2, $3, $4
        )
        RETURNING *
        `,
        [
            "PRUEBA JUAN",
            "Migracion PostgreSQL",
            12345,
            "Pendiente"
        ]
    );

    console.log(resultado.rows[0]);

    await pool.end();
}

insertar().catch(console.error);
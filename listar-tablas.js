require("dotenv").config();

const pool = require("./database/postgres");

async function listarTablas() {
  try {
    const resultado = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(resultado.rows);
  } catch (error) {
    console.error(error);
  } finally {
    pool.end();
  }
}

listarTablas();
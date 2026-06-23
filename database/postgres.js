require("dotenv").config();

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    throw new Error("Falta DATABASE_URL en el archivo .env");
}

const useSsl = process.env.DATABASE_SSL !== "false";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false
});

pool.on("error", (error) => {
    console.error("Error inesperado de PostgreSQL:", error);
});

module.exports = pool;

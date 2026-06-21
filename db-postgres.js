require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.query("SELECT NOW()", (err, res) => {

    if (err) {

        console.error("Error PostgreSQL:", err);

    } else {

        console.log("Conectado a PostgreSQL");
        console.log(res.rows[0]);

    }

    pool.end();

});
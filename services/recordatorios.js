const pool = require("../database/postgres");
const mailer = require("../utils/mailer");

async function enviarRecordatorios() {
    try {

        const resultado = await pool.query(`
            SELECT
                p.id,
                p.cliente,
                p.trabajo,
                p.estado,
                p.fechavencimiento,
                u.email,
                u.usuario
            FROM presupuestos p
            INNER JOIN usuarios u
                ON p.usuarioid = u.id
            WHERE
                p.fechavencimiento IS NOT NULL
                AND p.estado <> 'Cobrado'
                AND p.fechavencimiento = CURRENT_DATE + INTERVAL '1 day'
            ORDER BY u.id
        `);

        console.log(`[CRON] ${resultado.rowCount} presupuestos encontrados`);

        console.table(resultado.rows);

    } catch (error) {

        console.error("[CRON]", error);

    }
}

module.exports = {
    enviarRecordatorios
};

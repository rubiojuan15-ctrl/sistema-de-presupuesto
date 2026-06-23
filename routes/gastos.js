const express = require("express");
const pool = require("../database/postgres");
const auth = require("../middlewares/auth");

const router = express.Router();

router.use(auth);

router.get("/", async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            SELECT id, fecha, concepto, monto, usuarioid AS "usuarioId"
            FROM gastos
            WHERE usuarioid = $1
            ORDER BY fecha DESC, id DESC
            `,
            [req.usuario.id]
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al obtener gastos");
    }
});

router.post("/", async (req, res) => {
    const fecha = String(req.body.fecha || "");
    const concepto = String(req.body.concepto || "").trim();
    const monto = Number(req.body.monto);

    if (!fecha || !concepto || !Number.isFinite(monto) || monto < 0) {
        return res.status(400).send("Datos de gasto inválidos");
    }

    try {
        const resultado = await pool.query(
            `
            INSERT INTO gastos (fecha, concepto, monto, usuarioid)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            `,
            [fecha, concepto, monto, req.usuario.id]
        );
        res.status(201).json({ ok: true, id: resultado.rows[0].id });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al guardar el gasto");
    }
});

router.get("/resumen", async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            SELECT COALESCE(SUM(monto), 0) AS "totalGastos"
            FROM gastos
            WHERE usuarioid = $1
            `,
            [req.usuario.id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al calcular gastos");
    }
});

router.get("/resumen-mensual", async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            SELECT COALESCE(SUM(monto), 0) AS "totalGastosMes"
            FROM gastos
            WHERE usuarioid = $1
              AND fecha ~ '^\\d{4}-\\d{2}-\\d{2}$'
              AND fecha::date >= date_trunc('month', CURRENT_DATE)::date
              AND fecha::date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
            `,
            [req.usuario.id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al calcular gastos mensuales");
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const resultado = await pool.query(
            "DELETE FROM gastos WHERE id = $1 AND usuarioid = $2",
            [req.params.id, req.usuario.id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).send("Gasto no encontrado");
        }

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al eliminar el gasto");
    }
});

module.exports = router;

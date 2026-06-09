const express = require("express");
const router = express.Router();
const db = require("../database/db");

// LISTAR GASTOS
router.get("/", (req, res) => {

    db.all(
        `
        SELECT *
        FROM gastos
        ORDER BY fecha DESC, id DESC
        `,
        [],
        (err, rows) => {

            if (err) {
                return res.status(500).json(err);
            }

            res.json(rows);

        }
    );

});

// CREAR GASTO
router.post("/", (req, res) => {

    const {
        fecha,
        concepto,
        monto,
        usuarioId
    } = req.body;

    db.run(
        `
        INSERT INTO gastos
        (
            fecha,
            concepto,
            monto,
            usuarioId
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            fecha,
            concepto,
            monto,
            usuarioId
        ],
        function(err) {

            if (err) {
                return res.status(500).json(err);
            }

            res.json({
                ok: true,
                id: this.lastID
            });

        }
    );

});
router.get("/resumen", (req, res) => {

    db.get(
        `
        SELECT
            COALESCE(SUM(monto), 0) AS totalGastos
        FROM gastos
        `,
        [],
        (err, row) => {

            if (err) {
                return res.status(500).json(err);
            }

            res.json(row);

        }
    );

});
router.delete("/:id", (req, res) => {

    db.run(
        `
        DELETE FROM gastos
        WHERE id = ?
        `,
        [req.params.id],
        function(err) {

            if (err) {
                return res.status(500).json(err);
            }

            res.json({
                ok: true
            });

        }
    );

});
router.get("/resumen-mensual", (req, res) => {

    db.all(
        `
        SELECT
            id,
            fecha,
            estado,
            total
        FROM presupuestos
        `,
        [],
        (err, rows) => {

            if (err) {
                return res.status(500).json(err);
            }

            res.json(rows);

        }
    );

});

module.exports = router;

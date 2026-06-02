const express = require("express");
const router = express.Router();

const db = require("../database/db");

router.post("/", (req, res) => {
    
    router.get("/", (req, res) => {

    db.all(
        `
        SELECT *
        FROM gastos
        ORDER BY id DESC
        `,
        [],
        (err, rows) => {

            if (err) {

                return res
                    .status(500)
                    .json(err);

            }

            res.json(rows);

        }
    );

});

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

                return res
                    .status(500)
                    .json(err);

            }

            res.json({
                ok: true,
                id: this.lastID
            });

        }
    );

});

module.exports = router;
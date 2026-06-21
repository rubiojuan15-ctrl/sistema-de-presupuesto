const pool = require("../database/postgres");
const db = require("../database/db");
const auth = require("../middlewares/auth");
const express = require("express");
const router = express.Router();
const multer = require("multer");

router.get('/', (req, res) => {
    res.send('Ruta presupuestos funcionando');
});
router.get("/test-postgres", async (req, res) => {

    try {

        const resultado =
            await pool.query(
                "SELECT * FROM presupuestos ORDER BY id DESC"
            );

        res.json(resultado.rows);

    } catch (error) {

        console.error(error);

        res.status(500).send(error.message);

    }

});
const storage = multer.diskStorage({
    
        destination: function(req, file, cb) {
    
            cb(null, "uploads");
    
        },
    
        filename: function(req, file, cb) {
    
            cb(
                null,
                Date.now() +
                "-" +
                file.originalname
            );
    
        }
    
    });
const upload = multer({
    storage
});

router.get("/obtener-presupuestos", auth, async (req, res) => {

    try {

        const usuarioId = req.usuario.id;

        const resultado = await pool.query(
            `
            SELECT *
            FROM presupuestos
            WHERE usuarioId = $1
            ORDER BY id DESC
            `,
            [usuarioId]
        );

        res.json(resultado.rows);

    } catch (error) {

        console.error(error);

        res.status(500).send("Error al obtener presupuestos");

    }

});
//guardar presupuesto
router.post(
    "/guardar-presupuesto", auth, upload.array("imagen", 10),
    async (req, res) => {
        console.log(req.usuario);
        const cliente =
            req.body.cliente;

        const telefono =
            req.body.telefono || "";

        const direccion =
            req.body.direccion || "";

        const trabajo =
            req.body.trabajo;

        const observaciones =
            req.body.observaciones || "";

        const materiales =
            Number(req.body.materiales);

        const manoDeObra = Number(req.body.manoDeObra);

        const sena = Number(req.body.sena || 0);

        const saldo = Number(req.body.saldo || 0);

        const total =
            materiales + manoDeObra;

        const fecha =
            req.body.fecha;

        const fechaVencimiento =
            req.body.fechaVencimiento || "";

        const estado =
            req.body.estado;
        const usuarioId =
            req.usuario.id;

        const imagenes =

            req.files.map((file) => {

                return "/uploads/" + file.filename;

        }).join(",");
        // VALIDACIONES

            if (!cliente || !trabajo) {

                return res
                    .status(400)
                    .send("Faltan datos");

            }

            if (!Number.isFinite(materiales) || !Number.isFinite(manoDeObra) || materiales < 0 || manoDeObra < 0) {

                return res
                    .status(400)
                    .send("Valores inválidos");

            }

            if (!usuarioId) {

                return res
                    .status(401)
                    .send("Usuario no autorizado");

            }
            console.log(
                "SEÑA:",
                req.body.sena
            );

            console.log(
                "SALDO:",
                req.body.saldo
            );
            console.log("INSERT NUEVO CON SENA");
        try {

    await pool.query(
        `
        INSERT INTO presupuestos
        (
            cliente,
            telefono,
            direccion,
            trabajo,
            observaciones,
            materiales,
            manoDeObra,
            total,
            sena,
            saldo,
            fecha,
            fechaVencimiento,
            estado,
            imagenes,
            usuarioId
        )
        VALUES
        (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
        )
        `,
        [
            cliente,
            telefono,
            direccion,
            trabajo,
            observaciones,
            materiales,
            manoDeObra,
            total,
            sena,
            saldo,
            fecha,
            fechaVencimiento,
            estado,
            imagenes,
            usuarioId
        ]
    );

    res.status(201).send("Guardado");

        } catch (err) {

            console.error(err);

            res.status(500).send("Error al guardar");

        }

    }

);
router.put(
    "/editar-presupuesto/:id",
    auth,
    (req, res) => {

        const id = req.params.id;

        const {
            cliente,
            telefono,
            direccion,
            trabajo,
            observaciones,
            materiales,
            manoDeObra,
            total,
            sena,
            saldo,
            fechaVencimiento,
            estado
        } = req.body;

        db.run(
            `
            UPDATE presupuestos
            SET
                cliente = ?,
                telefono = ?,
                direccion = ?,
                trabajo = ?,
                observaciones = ?,
                materiales = ?,
                manoDeObra = ?,
                total = ?,
                sena = ?,
                saldo = ?,
                fechaVencimiento = ?,
                estado = ?
            WHERE id = ?
            `,
            [
                cliente,
                telefono,
                direccion,
                trabajo,
                observaciones,
                materiales,
                manoDeObra,
                total,
                sena,
                saldo,
                fechaVencimiento,
                estado,
                id
            ],
            function(err) {

                if (err) {

                    console.log(err);

                    return res
                        .status(500)
                        .send("Error al editar");

                }

                res.send("Presupuesto actualizado");

            }

        );

    }
);
router.put("/cobrar/:id",
    auth,
    (req, res) => {

        const id = req.params.id;

        const monto =
            Number(req.body.monto);

        db.get(

            `
            SELECT
                total,
                sena
            FROM presupuestos
            WHERE id = ?
            `,

            [id],

            (err, presupuesto) => {

                if (err) {

                    console.log(err);

                    return res
                        .status(500)
                        .send("Error");

                }

                if (!presupuesto) {

                    return res
                        .status(404)
                        .send("No encontrado");

                }
                const total =
                    Number(presupuesto.total);

                let nuevaSena =
                    Number(
                        presupuesto.sena || 0
                    ) + monto;

                if (nuevaSena > total) {

                    nuevaSena = total;

                }
                if (monto <= 0) {

                        return res
                            .status(400)
                            .send("Monto inválido");

                    }

                const nuevoSaldo =
                    total - nuevaSena;
                

                const nuevoEstado =

                    nuevoSaldo <= 0
                    ? "Cobrado total"
                    : "Saldo pendiente";

                db.run(

                    `
                    INSERT INTO pagos
                    (
                        presupuestoId,
                        fecha,
                        monto
                    )
                    VALUES
                    (
                        ?, ?, ?
                    )
                    `,

                    [
                        id,
                        new Date()
                            .toISOString()
                            .split("T")[0],
                        monto
                    ],

                    (err2) => {

                        if (err2) {

                            console.log(err2);

                            return res
                                .status(500)
                                .send("Error");

                        }

                        res.send(
                            "Pago registrado"
                        );

                    }

                );

            }

        );

    }
);
router.get(
    "/resumen",
    auth,
    (req, res) => {

        db.get(
            `
            SELECT

                SUM(total) AS totalPresupuestado,

                SUM(sena) AS totalCobrado,

                SUM(saldo) AS saldoPendiente

            FROM presupuestos
            `,
            [],
            (err, resumen) => {

                if (err) {

                    console.log(err);

                    return res
                        .status(500)
                        .send("Error");

                }

                db.get(
                    `
                    SELECT
                        COUNT(*) AS vencidos
                    FROM presupuestos
                    WHERE
                        fechaVencimiento < date('now')
                        AND estado != 'Cobrado total'
                    `,
                    [],
                    (err2, vencidos) => {

                        if (err2) {

                            console.log(err2);

                            return res
                                .status(500)
                                .send("Error");

                        }

                        res.json({

                            totalPresupuestado:
                                resumen.totalPresupuestado || 0,

                            totalCobrado:
                                resumen.totalCobrado || 0,

                            saldoPendiente:
                                resumen.saldoPendiente || 0,

                            vencidos:
                                vencidos.vencidos || 0

                        });

                    }
                );

            }
        );

    }
);
router.get(
    "/pagos/:id",
    auth,
    (req, res) => {

        const id = req.params.id;

        db.all(

            `
            SELECT *
            FROM pagos
            WHERE presupuestoId = ?
            ORDER BY id DESC
            `,

            [id],

            (err, rows) => {

                if (err) {

                    console.log(err);

                    return res
                        .status(500)
                        .send("Error");

                }

                res.json(rows);

            }

        );

    }
);
router.get("/resumen-mensual", (req, res) => {

    db.all(
        `
        SELECT total, fecha
        FROM presupuestos
        WHERE estado = 'Cobrado total'
        `,
        [],
        (err, rows) => {

            if (err) {
                return res.status(500).json(err);
            }

            const ahora = new Date();

            const mesActual = ahora.getMonth() + 1;
            const anioActual = ahora.getFullYear();

            let totalCobradoMes = 0;

            rows.forEach(p => {

                const partes = p.fecha.split("/");

                const mes = Number(partes[1]);
                const anio = Number(partes[2]);

                if (
                    mes === mesActual &&
                    anio === anioActual
                ) {
                    totalCobradoMes += Number(p.total);
                }

            });

            res.json({
                totalCobradoMes
            });

        }
    );

});
router.get("/debug-cobrados", (req, res) => {

    db.all(
        `
        SELECT
            id,
            fecha,
            estado,
            total,
            sena,
            saldo
        FROM presupuestos
        WHERE estado = 'Cobrado total'
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

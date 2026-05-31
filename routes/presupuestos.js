const db = require("../database/db");
const auth = require("../middlewares/auth");
const express = require("express");
const router = express.Router();
const multer = require("multer");

router.get('/', (req, res) => {
    res.send('Ruta presupuestos funcionando');
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

router.get("/obtener-presupuestos", auth, (req, res) => {
    const usuarioId = req.usuario.id;
    const busqueda = req.query.busqueda || "";
    const terminosBusqueda = busqueda
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const estado = req.query.estado || "";
    const vencimiento = req.query.vencimiento || "";
    const hoy = new Date();
    const hoyISO = hoy.toISOString().slice(0, 10);
    const finSemana = new Date(hoy);
    finSemana.setDate(hoy.getDate() + 7);
    const finSemanaISO = finSemana.toISOString().slice(0, 10);
    let filtroVencimiento = "";
    const parametrosVencimiento = [];

    if (vencimiento === "hoy") {

        filtroVencimiento = "AND fechaVencimiento = ?";
        parametrosVencimiento.push(hoyISO);

    } else if (vencimiento === "semana") {

        filtroVencimiento = "AND fechaVencimiento >= ? AND fechaVencimiento <= ?";
        parametrosVencimiento.push(hoyISO, finSemanaISO);

    } else if (vencimiento === "atrasados") {

        filtroVencimiento = "AND fechaVencimiento < ? AND estado != ?";
        parametrosVencimiento.push(hoyISO, "Cobrado total");

    }

    const filtroBusqueda = terminosBusqueda
        .map(() => `
            AND (
                cliente LIKE ?
                OR telefono LIKE ?
            )
        `)
        .join("");

    const parametrosBusqueda = terminosBusqueda.flatMap((termino) => [
        "%" + termino + "%",
        "%" + termino + "%"
    ]);

        db.all(`
           SELECT *
            FROM presupuestos
           WHERE usuarioId = ?
            ${filtroBusqueda}
            AND estado LIKE ?
            ${filtroVencimiento}
            ORDER BY id DESC
        `,
    [
        usuarioId,
        ...parametrosBusqueda,
        "%" + estado + "%",
        ...parametrosVencimiento
    ],
    (err, rows) => {

        if (err) {

            console.log(err);

            return res.status(500).send("Error al obtener presupuestos");

        }

        res.json(rows);

    });
    

});
//guardar presupuesto
router.post(
    "/guardar-presupuesto", auth, upload.array("imagen", 10),
    (req, res) => {
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
        db.run(
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [   //array
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
            ],
            function(err) {

                if (err) {

                    console.log(err);

                    return res
                        .status(500)
                        .send("Error al guardar");

                }

                res.status(201).send("Guardado");

            }

        );

    }

);

module.exports = router;

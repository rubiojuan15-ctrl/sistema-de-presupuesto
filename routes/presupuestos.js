const express = require("express");
const multer = require("multer");
const pool = require("../database/postgres");
const auth = require("../middlewares/auth");

const router = express.Router();

const presupuestoColumns = `
    id,
    cliente,
    telefono,
    direccion,
    trabajo,
    observaciones,
    materiales,
    manodeobra AS "manoDeObra",
    total,
    sena,
    saldo,
    fecha,
    fechavencimiento AS "fechaVencimiento",
    estado,
    imagenes,
    usuarioid AS "usuarioId"
`;

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, "uploads"),
    filename: (_req, file, callback) => {
        const safeName = file.originalname.replace(/[^\w.-]+/g, "_");
        callback(null, `${Date.now()}-${safeName}`);
    }
});
const upload = multer({
    storage,
    limits: { files: 10, fileSize: 10 * 1024 * 1024 }
});

router.get("/", (_req, res) => {
    res.send("Ruta presupuestos funcionando");
});

router.get("/obtener-presupuestos", auth, async (req, res) => {
    const busqueda = String(req.query.busqueda || "").trim();
    const estado = String(req.query.estado || "").trim();
    const vencimiento = String(req.query.vencimiento || "").trim();
    const values = [req.usuario.id];
    const conditions = ["usuarioid = $1"];

    if (busqueda) {
        values.push(`%${busqueda}%`);
        conditions.push(
            `(cliente ILIKE $${values.length} OR trabajo ILIKE $${values.length})`
        );
    }

    if (estado) {
        values.push(estado);
        conditions.push(`estado = $${values.length}`);
    }

    if (vencimiento === "vencidos") {
        conditions.push(`
            fechavencimiento ~ '^\\d{4}-\\d{2}-\\d{2}$'
            AND fechavencimiento::date < CURRENT_DATE
            AND estado <> 'Cobrado total'
        `);
    } else if (vencimiento === "hoy") {
        conditions.push(`
            fechavencimiento ~ '^\\d{4}-\\d{2}-\\d{2}$'
            AND fechavencimiento::date = CURRENT_DATE
        `);
    }

    try {
        const resultado = await pool.query(
            `
            SELECT ${presupuestoColumns}
            FROM presupuestos
            WHERE ${conditions.join(" AND ")}
            ORDER BY id DESC
            `,
            values
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al obtener presupuestos");
    }
});

router.post(
    "/guardar-presupuesto",
    auth,
    upload.array("imagen", 10),
    async (req, res) => {
        const cliente = String(req.body.cliente || "").trim();
        const telefono = String(req.body.telefono || "").trim();
        const direccion = String(req.body.direccion || "").trim();
        const trabajo = String(req.body.trabajo || "").trim();
        const observaciones = String(req.body.observaciones || "").trim();
        const materiales = Number(req.body.materiales);
        const manoDeObra = Number(req.body.manoDeObra);
        const senaSolicitada = Number(req.body.sena || 0);
        const fecha = String(req.body.fecha || "");
        const fechaVencimiento = String(req.body.fechaVencimiento || "");
        const estadoSolicitado = String(req.body.estado || "Pendiente");

        if (!cliente || !trabajo) {
            return res.status(400).send("Faltan cliente o trabajo");
        }
        if (
            !Number.isFinite(materiales) ||
            !Number.isFinite(manoDeObra) ||
            !Number.isFinite(senaSolicitada) ||
            materiales < 0 ||
            manoDeObra < 0 ||
            senaSolicitada < 0
        ) {
            return res.status(400).send("Valores inválidos");
        }

        const total = materiales + manoDeObra;
        const sena = Math.min(senaSolicitada, total);
        const saldo = total - sena;
        const estado = saldo === 0 && total > 0
            ? "Cobrado total"
            : estadoSolicitado;
        const imagenes = (req.files || [])
            .map((file) => `/uploads/${file.filename}`)
            .join(",");

        try {
            const resultado = await pool.query(
                `
                INSERT INTO presupuestos (
                    cliente, telefono, direccion, trabajo, observaciones,
                    materiales, manodeobra, total, sena, saldo, fecha,
                    fechavencimiento, estado, imagenes, usuarioid
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15
                )
                RETURNING id
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
                    req.usuario.id
                ]
            );
            res.status(201).json({ id: resultado.rows[0].id });
        } catch (error) {
            console.error(error);
            res.status(500).send("Error al guardar el presupuesto");
        }
    }
);

router.put("/editar-presupuesto/:id", auth, async (req, res) => {
    const materiales = Number(req.body.materiales);
    const manoDeObra = Number(req.body.manoDeObra);
    const senaSolicitada = Number(req.body.sena || 0);

    if (
        !Number.isFinite(materiales) ||
        !Number.isFinite(manoDeObra) ||
        !Number.isFinite(senaSolicitada) ||
        materiales < 0 ||
        manoDeObra < 0 ||
        senaSolicitada < 0
    ) {
        return res.status(400).send("Valores inválidos");
    }

    const total = materiales + manoDeObra;
    const sena = Math.min(senaSolicitada, total);
    const saldo = total - sena;
    const estado = saldo === 0 && total > 0
        ? "Cobrado total"
        : String(req.body.estado || "Pendiente");

    try {
        const resultado = await pool.query(
            `
            UPDATE presupuestos
            SET cliente = $1,
                telefono = $2,
                direccion = $3,
                trabajo = $4,
                observaciones = $5,
                materiales = $6,
                manodeobra = $7,
                total = $8,
                sena = $9,
                saldo = $10,
                fecha = $11,
                fechavencimiento = $12,
                estado = $13
            WHERE id = $14 AND usuarioid = $15
            `,
            [
                String(req.body.cliente || "").trim(),
                String(req.body.telefono || "").trim(),
                String(req.body.direccion || "").trim(),
                String(req.body.trabajo || "").trim(),
                String(req.body.observaciones || "").trim(),
                materiales,
                manoDeObra,
                total,
                sena,
                saldo,
                String(req.body.fecha || ""),
                String(req.body.fechaVencimiento || ""),
                estado,
                req.params.id,
                req.usuario.id
            ]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).send("Presupuesto no encontrado");
        }
        res.send("Presupuesto actualizado");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al editar el presupuesto");
    }
});

router.put("/cobrar/:id", auth, async (req, res) => {
    const montoSolicitado = Number(req.body.monto);

    if (!Number.isFinite(montoSolicitado) || montoSolicitado <= 0) {
        return res.status(400).send("Monto inválido");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const resultado = await client.query(
            `
            SELECT total, sena
            FROM presupuestos
            WHERE id = $1 AND usuarioid = $2
            FOR UPDATE
            `,
            [req.params.id, req.usuario.id]
        );
        const presupuesto = resultado.rows[0];

        if (!presupuesto) {
            await client.query("ROLLBACK");
            return res.status(404).send("Presupuesto no encontrado");
        }

        const total = Number(presupuesto.total);
        const senaActual = Math.max(0, Number(presupuesto.sena || 0));
        const monto = Math.min(montoSolicitado, Math.max(0, total - senaActual));

        if (monto <= 0) {
            await client.query("ROLLBACK");
            return res.status(409).send("El presupuesto ya está cobrado");
        }

        const nuevaSena = senaActual + monto;
        const nuevoSaldo = Math.max(0, total - nuevaSena);
        const nuevoEstado = nuevoSaldo === 0
            ? "Cobrado total"
            : "Saldo pendiente";
        const fecha = new Date().toISOString().slice(0, 10);

        await client.query(
            `
            UPDATE presupuestos
            SET sena = $1, saldo = $2, estado = $3
            WHERE id = $4
            `,
            [nuevaSena, nuevoSaldo, nuevoEstado, req.params.id]
        );
        await client.query(
            `
            INSERT INTO pagos (presupuestoid, fecha, monto)
            VALUES ($1, $2, $3)
            `,
            [req.params.id, fecha, monto]
        );
        await client.query("COMMIT");
        res.json({ monto, sena: nuevaSena, saldo: nuevoSaldo, estado: nuevoEstado });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).send("Error al registrar el pago");
    } finally {
        client.release();
    }
});

router.get("/resumen", auth, async (req, res) => {
    try {
        const [resumen, vencidos] = await Promise.all([
            pool.query(
                `
                SELECT
                    COALESCE(SUM(total), 0) AS "totalPresupuestado",
                    COALESCE(SUM(sena), 0) AS "totalCobrado",
                    COALESCE(SUM(saldo), 0) AS "saldoPendiente"
                FROM presupuestos
                WHERE usuarioid = $1
                `,
                [req.usuario.id]
            ),
            pool.query(
                `
                SELECT COUNT(*) AS vencidos
                FROM presupuestos
                WHERE usuarioid = $1
                  AND estado <> 'Cobrado total'
                  AND fechavencimiento ~ '^\\d{4}-\\d{2}-\\d{2}$'
                  AND fechavencimiento::date < CURRENT_DATE
                `,
                [req.usuario.id]
            )
        ]);
        res.json({
            ...resumen.rows[0],
            vencidos: Number(vencidos.rows[0].vencidos)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al calcular el resumen");
    }
});

router.get("/pagos/:id", auth, async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            SELECT pa.id, pa.fecha, pa.monto
            FROM pagos pa
            JOIN presupuestos pr ON pr.id = pa.presupuestoid
            WHERE pa.presupuestoid = $1 AND pr.usuarioid = $2
            ORDER BY pa.id DESC
            `,
            [req.params.id, req.usuario.id]
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al obtener los pagos");
    }
});

router.get("/resumen-mensual", auth, async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            SELECT COALESCE(SUM(pa.monto), 0) AS "totalCobradoMes"
            FROM pagos pa
            JOIN presupuestos pr ON pr.id = pa.presupuestoid
            WHERE pr.usuarioid = $1
              AND pa.fecha ~ '^\\d{4}-\\d{2}-\\d{2}$'
              AND pa.fecha::date >= date_trunc('month', CURRENT_DATE)::date
              AND pa.fecha::date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
            `,
            [req.usuario.id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al calcular el resumen mensual");
    }
});

router.delete("/eliminar-presupuesto/:id", auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const exists = await client.query(
            "SELECT id FROM presupuestos WHERE id = $1 AND usuarioid = $2 FOR UPDATE",
            [req.params.id, req.usuario.id]
        );
        if (exists.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).send("Presupuesto no encontrado");
        }
        await client.query("DELETE FROM pagos WHERE presupuestoid = $1", [
            req.params.id
        ]);
        await client.query("DELETE FROM presupuestos WHERE id = $1", [
            req.params.id
        ]);
        await client.query("COMMIT");
        res.send("Eliminado");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).send("Error al eliminar el presupuesto");
    } finally {
        client.release();
    }
});

router.put("/cambiar-estado/:id", auth, async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            UPDATE presupuestos
            SET estado = $1
            WHERE id = $2 AND usuarioid = $3
            `,
            [String(req.body.estado || ""), req.params.id, req.usuario.id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).send("Presupuesto no encontrado");
        }
        res.send("Estado actualizado");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al actualizar el estado");
    }
});

module.exports = { router, presupuestoColumns };

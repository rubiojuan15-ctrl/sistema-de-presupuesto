const fs = require("fs");
const path = require("path");
const express = require("express");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const cors = require("cors");
require("dotenv").config();

const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const pool = require("./database/postgres");
const ensureSchema = require("./database/schema");
const auth = require("./middlewares/auth");
const authRoutes = require("./routes/auth");
const { router: presupuestosRoutes, presupuestoColumns } = require("./routes/presupuestos");
const gastosRoutes = require("./routes/gastos");

const app = express();
app.use(cors({
    origin: [
        "https://localhost",
        "capacitor://localhost",
        "http://localhost",
        "https://sistema-de-presupuesto.onrender.com"
    ],
    credentials: true
}));
const port = Number(process.env.PORT || 3000);

process.chdir(__dirname);
fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
    const etiqueta = `backend:request:${req.method}:${req.originalUrl}:${Date.now()}`;
    console.time(etiqueta);
    res.on("finish", () => {
        console.timeEnd(etiqueta);
    });
    next();
});

app.use(authRoutes);
app.use("/presupuestos", presupuestosRoutes);
app.use("/gastos", gastosRoutes);

app.get("/presupuestos/generar-pdf/:id", auth, async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            SELECT ${presupuestoColumns}
            FROM presupuestos
            WHERE id = $1 AND usuarioid = $2
            `,
            [req.params.id, req.usuario.id]
        );
        const presupuesto = resultado.rows[0];

        if (!presupuesto) {
            return res.status(404).send("Presupuesto no encontrado");
        }

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="presupuesto-${presupuesto.id}.pdf"`
        );
        doc.pipe(res);

        doc.fontSize(26).text("PRESUPUESTO", { align: "center" });
        doc.moveDown(1.5);
        doc.fontSize(12).text(`Fecha: ${presupuesto.fecha || "-"}`);
        doc.text(`Vencimiento: ${presupuesto.fechaVencimiento || "-"}`);
        doc.moveDown();
        doc.fontSize(17).text("Cliente");
        doc.fontSize(12).text(presupuesto.cliente || "-");
        doc.text(`Teléfono: ${presupuesto.telefono || "-"}`);
        doc.text(`Dirección: ${presupuesto.direccion || "-"}`);
        doc.moveDown();
        doc.fontSize(17).text("Trabajo");
        doc.fontSize(12).text(presupuesto.trabajo || "-");
        doc.moveDown();
        doc.fontSize(17).text("Observaciones");
        doc.fontSize(12).text(presupuesto.observaciones || "-");
        doc.moveDown();
        doc.fontSize(14).text(
            `Materiales: $${Number(presupuesto.materiales).toLocaleString("es-AR")}`
        );
        doc.text(
            `Mano de obra: $${Number(presupuesto.manoDeObra).toLocaleString("es-AR")}`
        );
        doc.text(`Seña: $${Number(presupuesto.sena).toLocaleString("es-AR")}`);
        doc.text(`Saldo: $${Number(presupuesto.saldo).toLocaleString("es-AR")}`);
        doc.moveDown();
        doc.fontSize(22).text(
            `TOTAL: $${Number(presupuesto.total).toLocaleString("es-AR")}`,
            { align: "right" }
        );
        doc.end();
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).send("Error al generar el PDF");
        }
    }
});

app.get("/exportar-excel", auth, async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            SELECT ${presupuestoColumns}
            FROM presupuestos
            WHERE usuarioid = $1
            ORDER BY id DESC
            `,
            [req.usuario.id]
        );
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Presupuestos");
        sheet.columns = [
            { header: "Cliente", key: "cliente", width: 25 },
            { header: "Teléfono", key: "telefono", width: 18 },
            { header: "Dirección", key: "direccion", width: 30 },
            { header: "Trabajo", key: "trabajo", width: 30 },
            { header: "Observaciones", key: "observaciones", width: 40 },
            { header: "Materiales", key: "materiales", width: 15 },
            { header: "Mano de obra", key: "manoDeObra", width: 15 },
            { header: "Total", key: "total", width: 15 },
            { header: "Seña", key: "sena", width: 15 },
            { header: "Saldo", key: "saldo", width: 15 },
            { header: "Fecha", key: "fecha", width: 15 },
            { header: "Vencimiento", key: "fechaVencimiento", width: 15 },
            { header: "Estado", key: "estado", width: 18 }
        ];
        resultado.rows.forEach((row) => sheet.addRow(row));
        sheet.getRow(1).font = { bold: true };

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="presupuestos.xlsx"'
        );
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).send("Error al exportar presupuestos");
        }
    }
});

app.get("/backup", auth, async (req, res) => {
    try {
        const [presupuestos, gastos, pagos] = await Promise.all([
            pool.query(
                `SELECT ${presupuestoColumns} FROM presupuestos WHERE usuarioid = $1 ORDER BY id`,
                [req.usuario.id]
            ),
            pool.query(
                `
                SELECT id, fecha, concepto, monto, usuarioid AS "usuarioId"
                FROM gastos WHERE usuarioid = $1 ORDER BY id
                `,
                [req.usuario.id]
            ),
            pool.query(
                `
                SELECT pa.id, pa.presupuestoid AS "presupuestoId", pa.fecha, pa.monto
                FROM pagos pa
                JOIN presupuestos pr ON pr.id = pa.presupuestoid
                WHERE pr.usuarioid = $1
                ORDER BY pa.id
                `,
                [req.usuario.id]
            )
        ]);
        const date = new Date().toISOString().slice(0, 10);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="presupuestos-backup-${date}.json"`
        );
        res.json({
            version: 1,
            generatedAt: new Date().toISOString(),
            presupuestos: presupuestos.rows,
            gastos: gastos.rows,
            pagos: pagos.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al generar el respaldo");
    }
});

app.use((error, _req, res, _next) => {
    console.error(error);
    if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).send("Una imagen supera los 10 MB");
    }
    res.status(500).send("Error interno");
});
app.get("/ia/test", async (req, res) => {
    try {

        const respuesta = await openai.responses.create({
            model: "gpt-5.5",
            input: "Respondé únicamente con la palabra HOLA"
        });

        res.json(respuesta);

    } catch (e) {

        console.error(e);

        res.status(500).json({
            error: e.message
        });

    }
});
async function start() {
    await ensureSchema();
    return app.listen(port, () => {
        console.log(`Servidor funcionando en http://localhost:${port}`);
    });
}

if (require.main === module) {
    start().catch((error) => {
        console.error("No se pudo iniciar el servidor:", error);
        process.exitCode = 1;
    });
}

module.exports = { app, start };

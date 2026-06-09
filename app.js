//imports
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const express = require("express");
const app = express();

// Permite iniciar el servidor desde cualquier carpeta.
process.chdir(__dirname);

const authRoutes = require("./routes/auth");

const presupuestosRoutes = require("./routes/presupuestos");

const gastosRoutes = require("./routes/gastos");

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

app.use(authRoutes);

app.use("/presupuestos", presupuestosRoutes);

app.use("/gastos", gastosRoutes);

const db = require("./database/db");

const PDFDocument = require("pdfkit");

const auth = require("./middlewares/auth");
const backupsDir = path.join(__dirname, "backups");
const databaseFile = path.join(__dirname, "presupuestos.db");

fs.mkdirSync(backupsDir, { recursive: true });

const fechaBackup =

    new Date()

    .toISOString()

    .replace(/:/g, "-");

try {
    fs.copyFileSync(
        databaseFile,
        path.join(backupsDir, `backup-${fechaBackup}.db`)
    );

    console.log("Backup creado");
} catch (err) {
    console.error("No se pudo crear el backup:", err.message);
}

app.get("/backup", (req, res, next) => {
    res.setHeader(
        "Content-Disposition",
        'attachment; filename="presupuestos-backup.db"'
    );

    res.sendFile(databaseFile, { dotfiles: "allow" }, (err) => {
        if (err) {
            next(err);
        }
    });

});
//SQLLITE

console.log(
    "BASE:",
    databaseFile
);
db.run(`
    CREATE TABLE IF NOT EXISTS presupuestos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente TEXT,
        telefono TEXT,
        direccion TEXT,
        trabajo TEXT,
        observaciones TEXT,
        materiales INTEGER,
        manoDeObra INTEGER,
        total INTEGER,
        fecha TEXT,
        fechaVencimiento TEXT,
        estado TEXT,
        imagenes text,
        usuarioId INTEGER
    )

`);
db.all("PRAGMA table_info(presupuestos)", [], (err, columnas) => {

    if (err) {

        return console.log(err);

    }

    const existentes = columnas.map((columna) => columna.name);

    [
        ["telefono", "TEXT"],
        ["direccion", "TEXT"],
        ["observaciones", "TEXT"],
        ["fechaVencimiento", "TEXT"]
    ].forEach(([nombre, tipo]) => {

        if (!existentes.includes(nombre)) {

            db.run(
                `ALTER TABLE presupuestos ADD COLUMN ${nombre} ${tipo}`
            );

        }

    });

});
db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        usuario TEXT,

        password TEXT

    )
`);

db.run(
    "UPDATE presupuestos SET estado = ? WHERE estado = ?",
    ["Cobrado total", "Cobrado"]
);
app.put("/presupuestos/editar-presupuesto/:id", auth, (req, res) => {

    const id = req.params.id;

    const cliente =
    req.body.cliente;

    const telefono =
        req.body.telefono;

    const direccion =
        req.body.direccion;

    const trabajo =
        req.body.trabajo;

    const observaciones =
        req.body.observaciones;

    const materiales =
        Number(req.body.materiales);

    const manoDeObra =
        Number(req.body.manoDeObra);

    const total =
        materiales + manoDeObra;

    const fecha =
        req.body.fecha;

    const fechaVencimiento =
        req.body.fechaVencimiento;

    const estado =
    req.body.estado;
    db.run(`
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
            fecha = ?,
            fechaVencimiento = ?,
            estado = ?
        WHERE id = ?
        AND usuarioId = ?
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
        fecha,
        fechaVencimiento,
        estado,
        id,
        req.usuario.id
    ],
    function(err) {
        if (err) {
            console.log(err);

            return res
                .status(500)
                .send("Error al actualizar");
        }

        if (this.changes === 0) {
            return res
                .status(404)
                .send("Presupuesto no encontrado");
        }

        res.send("Actualizado");
    });
});

app.get("/presupuestos/generar-pdf/:id", (req, res) => {

    const id = req.params.id;

    db.get(
        "SELECT * FROM presupuestos WHERE id = ?",
        [id],
        (err, presupuesto) => {

            if (err || !presupuesto) {

                return res
                    .status(404)
                    .send("Presupuesto no encontrado");

            }

            const doc = new PDFDocument();

            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            res.setHeader(
                "Content-Disposition",
                `inline; filename=presupuesto-${id}.pdf`
            );

            doc.pipe(res);

            // TITULO

            doc
                .fontSize(28)
                .text("PRESUPUESTO", {

                    align: "center"

                });

            doc.moveDown(2);

            // FECHA

            const fecha =
                new Date().toLocaleDateString();

            doc
                .fontSize(12)
                .text("Fecha: " + fecha);

            doc.moveDown();

            doc
                .fontSize(12)
                .text("Vencimiento: " + (presupuesto.fechaVencimiento || "-"));

            doc.moveDown();

            // CLIENTE

            doc
                .fontSize(18)
                .text("Cliente:");

            doc
                .fontSize(14)
                .text(presupuesto.cliente);

            doc.moveDown();

            doc
                .fontSize(18)
                .text("Telefono:");

            doc
                .fontSize(14)
                .text(presupuesto.telefono || "-");

            doc.moveDown();

            doc
                .fontSize(18)
                .text("Direccion:");

            doc
                .fontSize(14)
                .text(presupuesto.direccion || "-");

            doc.moveDown();

            // TRABAJO

            doc
                .fontSize(18)
                .text("Trabajo:");

            doc
                .fontSize(14)
                .text(presupuesto.trabajo);

            doc.moveDown(2);

            doc
                .fontSize(18)
                .text("Observaciones de trabajo:");

            doc
                .fontSize(14)
                .text(presupuesto.observaciones || "-");

            doc.moveDown(2);

            // COSTOS

            doc
                .fontSize(18)
                .text("Detalle");

            doc.moveDown();

            doc
                .fontSize(14)
                .text(
                    "Materiales: $" +
                    presupuesto.materiales
                );

            doc
                .fontSize(14)
                .text(
                    "Mano de obra: $" +
                    presupuesto.manoDeObra
                );

            doc.moveDown(2);

            // TOTAL

            doc
                .fontSize(24)
                .text(
                    "TOTAL: $" +
                    presupuesto.total,
                    {
                        align: "right"
                    }
                );

            doc.moveDown(3);

            // FIRMA

            doc
                .fontSize(12)
                .text(
                    "Firma ____________________",
                    {
                        align: "right"
                    }
                );

            doc.end();

        }
    );

});
app.delete("/presupuestos/eliminar-presupuesto/:id", auth, (req, res) => {

    const id = req.params.id;

    db.run(
        "DELETE FROM presupuestos WHERE id = ? AND usuarioId = ?",
        [id, req.usuario.id],
        function(err) {

            if (err) {

                console.log(err);

                return res
                    .status(500)
                    .send("Error al eliminar");

            }

            if (this.changes === 0) {

                return res
                    .status(404)
                    .send("Presupuesto no encontrado");

            }

            res.send("Eliminado");

        }
    );

});
app.put("/presupuestos/cambiar-estado/:id", auth, (req, res) => {

    const id = req.params.id;

    const { estado } = req.body;

    db.run(
        `
        UPDATE presupuestos
        SET estado = ?
        WHERE id = ?
        AND usuarioId = ?
        `,
        [estado, id, req.usuario.id],
        function(err) {

            if (err) {

                console.log(err);

                return res
                    .status(500)
                    .send("Error al actualizar estado");

            }

            if (this.changes === 0) {

                return res
                    .status(404)
                    .send("Presupuesto no encontrado");

            }

            res.send("Estado actualizado");

        }
    );

});

app.get("/exportar-excel", async (req, res) => {

    const workbook =
        new ExcelJS.Workbook();

    const sheet =
        workbook.addWorksheet(
            "Presupuestos"
        );

    sheet.columns = [

        {
            header: "Cliente",
            key: "cliente",
            width: 25
        },

        {
            header: "Telefono",
            key: "telefono",
            width: 18
        },

        {
            header: "Direccion",
            key: "direccion",
            width: 30
        },

        {
            header: "Trabajo",
            key: "trabajo",
            width: 25
        },

        {
            header: "Observaciones de trabajo",
            key: "observaciones",
            width: 35
        },

        {
            header: "Total",
            key: "total",
            width: 15
        },

        {
            header: "Fecha",
            key: "fecha",
            width: 15
        },

        {
            header: "Vencimiento",
            key: "fechaVencimiento",
            width: 15
        },

        {
            header: "Estado",
            key: "estado",
            width: 15
        }

    ];

    db.all(
        "SELECT * FROM presupuestos",
        [],
        async (err, rows) => {
            if (err) {
                console.error(err);
                return res
                    .status(500)
                    .send("Error al exportar presupuestos");
            }

            rows.forEach((p) => {

                sheet.addRow({

                    cliente:
                        p.cliente,

                    telefono:
                        p.telefono,

                    direccion:
                        p.direccion,

                    trabajo:
                        p.trabajo,

                    observaciones:
                        p.observaciones,

                    total:
                        p.total,

                    fecha:
                        p.fecha,

                    fechaVencimiento:
                        p.fechaVencimiento,

                    estado:
                        p.estado

                });

            });

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );

            res.setHeader(
                "Content-Disposition",
                "attachment; filename=presupuestos.xlsx"
            );

            try {
                await workbook.xlsx.write(res);
                res.end();
            } catch (writeErr) {
                console.error(writeErr);

                if (!res.headersSent) {
                    res.status(500).send("Error al generar el archivo Excel");
                }
            }

        }
    );

});

//no borrar porque es el código que ejecuta al servidor 
app.listen(3000, () => {
    console.log("Servidor funcionando en http://localhost:3000");
});

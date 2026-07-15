const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const pool = require("../database/postgres");
const auth = require("../middlewares/auth");

const router = express.Router();

function archivosDeImagenes(valor) {
    return String(valor || "")
        .split(",")
        .map((imagen) => imagen.trim())
        .filter((imagen) => imagen.startsWith("/uploads/"))
        .map((imagen) => path.basename(imagen));
}

router.delete("/me", auth, async (req, res) => {
    const password = String(req.body?.password || "");
    const confirmacion = String(req.body?.confirmacion || "").trim();

    if (!password || confirmacion !== "ELIMINAR") {
        return res.status(400).json({
            error: "Ingresá tu contraseña y escribí ELIMINAR para confirmar."
        });
    }

    let client;
    let imagenes = [];

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const usuario = await client.query(
            "SELECT password FROM usuarios WHERE id = $1 FOR UPDATE",
            [req.usuario.id]
        );
        const passwordCorrecta = usuario.rowCount > 0 &&
            await bcrypt.compare(password, usuario.rows[0].password);

        if (!passwordCorrecta) {
            await client.query("ROLLBACK");
            return res.status(401).json({ error: "La contraseña actual no es correcta." });
        }

        const presupuestos = await client.query(
            "SELECT imagenes FROM presupuestos WHERE usuarioid = $1",
            [req.usuario.id]
        );
        imagenes = presupuestos.rows.flatMap((presupuesto) =>
            archivosDeImagenes(presupuesto.imagenes)
        );

        await client.query(
            "DELETE FROM pagos WHERE presupuestoid IN (SELECT id FROM presupuestos WHERE usuarioid = $1)",
            [req.usuario.id]
        );
        await client.query("DELETE FROM password_resets WHERE usuarioid = $1", [req.usuario.id]);
        await client.query("DELETE FROM gastos WHERE usuarioid = $1", [req.usuario.id]);
        await client.query("DELETE FROM presupuestos WHERE usuarioid = $1", [req.usuario.id]);
        await client.query("DELETE FROM usuarios WHERE id = $1", [req.usuario.id]);

        await client.query("COMMIT");

        for (const imagen of imagenes) {
            fs.unlink(path.join(__dirname, "..", "uploads", imagen), () => {});
        }

        return res.json({ mensaje: "Cuenta eliminada correctamente." });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK");
        }
        console.error("Error al eliminar cuenta:", error);
        return res.status(500).json({ error: "No se pudo eliminar la cuenta." });
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;

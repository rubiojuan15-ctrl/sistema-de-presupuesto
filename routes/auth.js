const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../database/postgres");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const crypto = require("crypto");
const transporter = require("../utils/mailer");

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
    return EMAIL_RE.test(email);
}

async function enviarEmailRecuperacion(email, token) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const appUrl = process.env.APP_URL || "https://sistema-de-presupuesto.onrender.com";

    if (!apiKey || !from) throw new Error("Falta configurar el servicio de email");

    const enlace = `${appUrl}/?reset=${encodeURIComponent(token)}`;
    const respuesta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from,
            to: [email],
            subject: "Recuperá tu contraseña",
            html: `<p>Recibimos una solicitud para cambiar tu contraseña.</p><p><a href="${enlace}">Crear una contraseña nueva</a></p><p>El enlace vence en 15 minutos.</p>`
        })
    });

    if (!respuesta.ok) throw new Error(`Error del servicio de email: ${respuesta.status}`);
}

router.post("/login", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const usuario = String(req.body.usuario || "").trim();
    const password = String(req.body.password || "");

    if (!password || (!email && !usuario)) {
        return res.status(400).send("Faltan credenciales o contraseña");
    }

    try {
        const resultado = email
            ? await pool.query(
                  "SELECT id, usuario, email, password FROM usuarios WHERE LOWER(email) = $1",
                  [email]
              )
            : await pool.query(
                  "SELECT id, usuario, email, password FROM usuarios WHERE usuario = $1",
                  [usuario]
              );
        const row = resultado.rows[0];

        if (!row || !(await bcrypt.compare(password, row.password))) {
            return res.status(401).send("Usuario o contraseña incorrectos");
        }

        const token = jwt.sign(
            { id: row.id },
            process.env.JWT_SECRET || "secreto123",
            { expiresIn: "7d" }
        );

        res.json({
            token,
            usuario: row.usuario,
            email: row.email || "",
            id: row.id
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al iniciar sesión");
    }
});

router.post("/registro", async (req, res) => {
    const usuario = String(req.body.usuario || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (usuario.length < 3 || password.length < 6) {
        return res
            .status(400)
            .send("El usuario debe tener 3 caracteres y la contraseña 6");
    }

    if (!email || !isValidEmail(email)) {
        return res.status(400).send("Ingresá un email válido");
    }

    try {
        const existente = await pool.query(
            `
            SELECT usuario, email
            FROM usuarios
            WHERE usuario = $1 OR LOWER(email) = $2
            LIMIT 1
            `,
            [usuario, email]
        );

        if (existente.rowCount > 0) {
            const row = existente.rows[0];
            if (row.usuario === usuario) {
                return res.status(409).send("El usuario ya existe");
            }
            return res.status(409).send("El email ya está registrado");
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query(
            `
            INSERT INTO usuarios (usuario, email, password)
            VALUES ($1, $2, $3)
            `,
            [usuario, email, passwordHash]
        );

        res.status(201).send("Usuario creado");
    } catch (error) {
        console.error(error);
        const detalle = error.code === "42703"
            ? "Falta actualizar la base de datos (columna email)"
            : "Error al crear el usuario";
        res.status(500).send(detalle);
    }
});

router.post("/olvide-password", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const mensaje = "Si el email está registrado, recibirás un enlace en unos minutos.";

    if (!isValidEmail(email)) return res.status(400).send("Ingresá un email válido");

    try {
        const resultado = await pool.query(
            "SELECT id, email, password FROM usuarios WHERE LOWER(email) = $1 LIMIT 1",
            [email]
        );
        const usuario = resultado.rows[0];

        if (usuario) {
            const token = jwt.sign(
                { id: usuario.id, purpose: "password-reset", version: usuario.password.slice(-12) },
                process.env.JWT_SECRET || "secreto123",
                { expiresIn: "15m" }
            );
            await enviarEmailRecuperacion(usuario.email, token);
        }

        res.send(mensaje);
    } catch (error) {
        console.error(error);
        res.status(503).send("No pudimos enviar el email en este momento");
    }
});

router.post("/restablecer-password", async (req, res) => {
    const resetToken = String(req.body.token || "");
    const password = String(req.body.password || "");

    if (password.length < 6) return res.status(400).send("La contraseña debe tener al menos 6 caracteres");

    try {
        const datos = jwt.verify(resetToken, process.env.JWT_SECRET || "secreto123");
        if (datos.purpose !== "password-reset") return res.status(400).send("Enlace inválido");

        const resultado = await pool.query("SELECT password FROM usuarios WHERE id = $1", [datos.id]);
        const usuario = resultado.rows[0];
        if (!usuario || usuario.password.slice(-12) !== datos.version) {
            return res.status(400).send("El enlace ya no es válido");
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE usuarios SET password = $1 WHERE id = $2", [passwordHash, datos.id]);
        res.send("Contraseña actualizada");
    } catch (error) {
        res.status(400).send("El enlace venció o no es válido");
    }
});
router.post("/olvide-password", async (req, res) => {

    const email = normalizeEmail(req.body.email);

    if (!email || !isValidEmail(email)) {
        return res.status(400).send("Ingresá un email válido");
    }

    try {

        const usuario = await pool.query(
            "SELECT id, usuario FROM usuarios WHERE LOWER(email) = $1",
            [email]
        );

        // Por seguridad siempre respondemos lo mismo
        if (usuario.rowCount === 0) {
            return res.send("Si el correo existe, recibirás un enlace para recuperar tu contraseña.");
        }

        const token = crypto.randomBytes(32).toString("hex");

        const expiracion = new Date(
            Date.now() + 30 * 60 * 1000
        ); // 30 minutos

        await pool.query(
            `
            INSERT INTO password_resets
            (usuarioid, token, expiracion)
            VALUES ($1,$2,$3)
            `,
            [
                usuario.rows[0].id,
                token,
                expiracion
            ]
        );

        const enlace =
            `${process.env.APP_URL}/reset-password.html?token=${token}`;

        await transporter.sendMail({

            from: process.env.EMAIL_USER,

            to: email,

            subject: "Recuperar contraseña",

            html: `
                <h2>Recuperación de contraseña</h2>

                <p>Hola ${usuario.rows[0].usuario}.</p>

                <p>Hacé clic en el siguiente botón para crear una nueva contraseña.</p>

                <p>
                    <a href="${enlace}">
                        Recuperar contraseña
                    </a>
                </p>

                <p>Este enlace vence en 30 minutos.</p>
            `
        });

        res.send("Si el correo existe, recibirás un enlace para recuperar tu contraseña.");

    } catch (error) {

        console.error(error);

        res.status(500).send("Error al enviar el correo.");

    }

});
router.post("/reset-password", async (req, res) => {

    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).send("Datos incompletos");
    }

    if (password.length < 6) {
        return res.status(400).send("La contraseña debe tener al menos 6 caracteres");
    }

    try {

        const resultado = await pool.query(

            `
            SELECT *
            FROM password_resets
            WHERE token = $1
            AND usado = FALSE
            `,
            [token]

        );

        if (resultado.rowCount === 0) {

            return res.status(400).send("El enlace ya no es válido");

        }

        const reset = resultado.rows[0];

        if (new Date(reset.expiracion) < new Date()) {

            return res.status(400).send("El enlace ha vencido");

        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(

            `
            UPDATE usuarios
            SET password = $1
            WHERE id = $2
            `,
            [
                passwordHash,
                reset.usuarioid
            ]

        );

        await pool.query(

            `
            UPDATE password_resets
            SET usado = TRUE
            WHERE id = $1
            `,
            [reset.id]

        );

        res.send("Contraseña actualizada correctamente");

    } catch (error) {

        console.error(error);

        res.status(500).send("Error al actualizar la contraseña");

    }

});
module.exports = router;

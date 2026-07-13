const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../database/postgres");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const crypto = require("crypto");
const mailer = require("../utils/mailer");

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
    return EMAIL_RE.test(email);
}

function isStrongPassword(password) {
    return password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password) &&
        /[^A-Za-z0-9]/.test(password);
}

function baseUsuarioDesdeNombre(nombre) {
    return String(nombre || "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "")
        .slice(0, 40);
}

async function generarUsuarioDisponible(nombre) {
    const base = baseUsuarioDesdeNombre(nombre);
    if (base.length < 3) return null;

    const existentes = await pool.query(
        "SELECT LOWER(usuario) AS usuario FROM usuarios WHERE LOWER(usuario) = $1 OR LOWER(usuario) LIKE $2",
        [base, `${base}%`]
    );
    const ocupados = new Set(existentes.rows.map(row => row.usuario));

    if (!ocupados.has(base)) return base;

    let sufijo = 2;
    while (ocupados.has(`${base}${sufijo}`)) sufijo += 1;
    return `${base}${sufijo}`;
}

function crearTokenVerificacion() {
    return crypto.randomBytes(32).toString("hex");
}

function fechaExpiracionVerificacion() {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function urlAplicacion() {
    return (process.env.APP_URL || "https://sistema-de-presupuesto.onrender.com").replace(/\/$/, "");
}

async function enviarEmailVerificacion(email, token) {
    const from = process.env.EMAIL_FROM || process.env.SENDGRID_FROM;
    if (!process.env.SENDGRID_API_KEY || !from) {
        throw new Error("Falta configurar SENDGRID_API_KEY y EMAIL_FROM");
    }

    const enlace = `${urlAplicacion()}/verificar-email?token=${encodeURIComponent(token)}`;
    await mailer.send({
        to: email,
        from,
        subject: "Verificá tu email",
        html: `
            <h2>Confirmá tu cuenta</h2>
            <p>Para activar tu cuenta, verificá tu email dentro de las próximas 24 horas.</p>
            <p><a href="${enlace}" style="display:inline-block;padding:12px 20px;color:#fff;background:#925f3d;border-radius:8px;text-decoration:none;font-weight:700">Verificar email</a></p>
            <p>Si no creaste esta cuenta, podés ignorar este correo.</p>
        `
    });
}

function paginaVerificacion(titulo, mensaje) {
    return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#f3f1ea;font-family:system-ui,sans-serif;color:#17221d"><main style="max-width:420px;margin:24px;padding:32px;background:#fff;border-radius:20px;box-shadow:0 12px 36px rgba(0,0,0,.12);text-align:center"><h1 style="margin-top:0">${titulo}</h1><p>${mensaje}</p></main></body></html>`;
}

/*async function enviarEmailRecuperacion(email, token) {
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
}*/

router.post("/login", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const usuario = String(req.body.usuario || "").trim();
    const password = String(req.body.password || "");

    if (!password || (!email && !usuario)) {
        return res.status(400).send("Faltan credenciales o contraseña");
    }

    const medicionLogin = `backend:login:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    console.time(medicionLogin);

    try {
        console.time(`${medicionLogin}:postgres`);
        const resultado = email
            ? await pool.query(
                  "SELECT id, usuario, email, password, emailverificado FROM usuarios WHERE LOWER(email) = $1",
                  [email]
              )
            : await pool.query(
                  "SELECT id, usuario, email, password, emailverificado FROM usuarios WHERE usuario = $1",
                  [usuario]
              );
        console.timeEnd(`${medicionLogin}:postgres`);
        const row = resultado.rows[0];

        console.time(`${medicionLogin}:bcrypt`);
        const passwordCorrecta = row ? await bcrypt.compare(password, row.password) : false;
        console.timeEnd(`${medicionLogin}:bcrypt`);

        if (!row || !passwordCorrecta) {
            return res.status(401).send("Usuario o contraseña incorrectos");
        }

        if (!row.emailverificado) {
            return res.status(403).json({
                code: "EMAIL_NO_VERIFICADO",
                email: row.email,
                mensaje: "Verificá tu email para poder ingresar. Revisá tu correo o solicitá un nuevo enlace."
            });
        }

        console.time(`${medicionLogin}:jwt`);
        const token = jwt.sign(
            { id: row.id },
            process.env.JWT_SECRET || "secreto123",
            { expiresIn: "7d" }
        );
        console.timeEnd(`${medicionLogin}:jwt`);

        res.json({
            token,
            usuario: row.usuario,
            email: row.email || "",
            id: row.id
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al iniciar sesión");
    } finally {
        console.timeEnd(medicionLogin);
    }
});

router.get("/registro/usuario-sugerido", async (req, res) => {
    const nombre = String(req.query.nombre || "").trim();

    if (baseUsuarioDesdeNombre(nombre).length < 3) {
        return res.json({ usuario: "" });
    }

    try {
        const usuario = await generarUsuarioDisponible(nombre);
        res.json({ usuario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "No se pudo generar el usuario" });
    }
});

router.post("/registro", async (req, res) => {
    const nombre = String(req.body.nombre || "").trim();
    let usuario = baseUsuarioDesdeNombre(nombre);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const confirmarPassword = String(req.body.confirmarPassword || "");

    if (nombre.length < 3 || usuario.length < 3) {
        return res.status(400).send("Ingresá tu nombre completo");
    }

    if (!isStrongPassword(password)) {
        return res.status(400).send("La contraseña debe tener 8 caracteres, mayúscula, minúscula, número y símbolo");
    }

    if (password !== confirmarPassword) {
        return res.status(400).send("Las contraseñas no coinciden");
    }

    if (!email || !isValidEmail(email)) {
        return res.status(400).send("Ingresá un email válido");
    }

    try {
        usuario = await generarUsuarioDisponible(nombre);
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
        const tokenVerificacion = crearTokenVerificacion();
        const expiraVerificacion = fechaExpiracionVerificacion();
        await pool.query(
            `
            INSERT INTO usuarios (
                usuario, email, password, emailverificado,
                emailverificaciontoken, emailverificacionexpira
            )
            VALUES ($1, $2, $3, FALSE, $4, $5)
            `,
            [usuario, email, passwordHash, tokenVerificacion, expiraVerificacion]
        );

        await enviarEmailVerificacion(email, tokenVerificacion);

        res.status(201).json({
            usuario,
            mensaje: "Cuenta creada. Revisá tu email para verificarla."
        });
    } catch (error) {
        console.error(error);
        if (error.code === "23505") {
            return res.status(409).send("El email ya está registrado");
        }
        const detalle = error.code === "42703"
            ? "Falta actualizar la base de datos (columna email)"
            : "Error al crear el usuario";
        res.status(500).send(detalle);
    }
});

router.get("/verificar-email", async (req, res) => {
    const token = String(req.query.token || "");
    if (!token) {
        return res.status(400).send(paginaVerificacion("Enlace inválido", "El enlace de verificación no es válido."));
    }

    try {
        const resultado = await pool.query(
            `
            UPDATE usuarios
            SET emailverificado = TRUE,
                emailverificaciontoken = NULL,
                emailverificacionexpira = NULL
            WHERE emailverificaciontoken = $1
              AND emailverificacionexpira > NOW()
              AND emailverificado = FALSE
            RETURNING id
            `,
            [token]
        );

        if (resultado.rowCount === 0) {
            return res.status(400).send(paginaVerificacion("Enlace vencido", "Este enlace ya fue usado o venció. Solicitá uno nuevo desde la pantalla de inicio de sesión."));
        }

        res.send(paginaVerificacion("Email verificado", "Tu cuenta ya está activa. Podés volver a la aplicación e iniciar sesión."));
    } catch (error) {
        console.error(error);
        res.status(500).send(paginaVerificacion("No pudimos verificar el email", "Intentá nuevamente más tarde."));
    }
});

router.post("/reenviar-verificacion", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const mensaje = "Si la cuenta existe y aún no está verificada, enviamos un nuevo enlace a tu correo.";

    if (!isValidEmail(email)) {
        return res.status(400).send("Ingresá un email válido");
    }

    try {
        const usuario = await pool.query(
            "SELECT id, email FROM usuarios WHERE LOWER(email) = $1 AND emailverificado = FALSE LIMIT 1",
            [email]
        );

        if (usuario.rowCount === 0) {
            return res.send(mensaje);
        }

        const token = crearTokenVerificacion();
        const expira = fechaExpiracionVerificacion();
        await pool.query(
            "UPDATE usuarios SET emailverificaciontoken = $1, emailverificacionexpira = $2 WHERE id = $3",
            [token, expira, usuario.rows[0].id]
        );
        await enviarEmailVerificacion(usuario.rows[0].email, token);
        res.send(mensaje);
    } catch (error) {
        console.error(error);
        res.status(503).send("No se pudo enviar el email de verificación. Intentá nuevamente.");
    }
});

/*router.post("/olvide-password", async (req, res) => {
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
});*/

/*router.post("/restablecer-password", async (req, res) => {
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
});*/
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
        const enlace = `${process.env.APP_URL}/reset-password.html?token=${token}`;
            try {
                await mailer.send({
                    to: email,
                    from: "estudiojr995@gmail.com",
                    subject: "Recuperar contraseña",
                    html: `
                        <h2>Recuperación de contraseña</h2>

                        <p>Hola ${usuario.rows[0].usuario}.</p>

                        <p>Hacé clic en el siguiente enlace para crear una nueva contraseña:</p>

                        <p>
                            <a href="${enlace}">
                                Recuperar contraseña
                            </a>
                        </p>

                        <p>Este enlace vence en 30 minutos.</p>
                    `
                });
            } 
            catch (error) {
                console.error("SENDGRID:", error.response?.body || error);
                return res.status(500).send("No se pudo enviar el correo.");
            }
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

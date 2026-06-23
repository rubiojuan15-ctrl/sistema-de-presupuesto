const jwt = require("jsonwebtoken");

function auth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
        ? header.slice(7)
        : header || req.query.token;

    if (!token) {
        return res.status(401).send("No autorizado");
    }

    try {
        req.usuario = jwt.verify(
            token,
            process.env.JWT_SECRET || "secreto123"
        );
        next();
    } catch {
        res.status(401).send("Token inválido");
    }
}

module.exports = auth;

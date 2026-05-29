const jwt = require("jsonwebtoken");

function auth(req, res, next) {

    const token =
        req.headers.authorization;

    if (!token) {

        return res
            .status(401)
            .send("No autorizado");

    }

    try {

        const decoded =
            jwt.verify(
                token,
                "secreto123"
            );

        req.usuario =
            decoded;

        next();

    } catch {

        res
            .status(401)
            .send("Token inválido");

    }

}

module.exports = auth;
const { Resend } = require("resend");

// Reemplazá re_xxxxxxxxx por tu API Key real
const resend = new Resend(process.env.RESEND_API_KEY || "re_MJwjLjvt_9M215x9WR6BD3sfRG6YZ2wp1");

module.exports = resend;
const Filesystem = window.Capacitor?.Plugins?.Filesystem;
const BiometricAuth = window.Capacitor?.Plugins?.BiometricAuth;
const sistema = document.getElementById("sistema");
const API = "https://sistema-de-presupuesto.onrender.com";
const busqueda = document.getElementById("busqueda");
const cliente = document.getElementById("cliente");
const telefono = document.getElementById("telefono");
const direccion = document.getElementById("direccion");
const imagen = document.getElementById("imagen");
const trabajo = document.getElementById("trabajo");
const observaciones = document.getElementById("observaciones");
const fechaVencimiento = document.getElementById("fechaVencimiento");
const materiales = document.getElementById("materiales");
const manoDeObra = document.getElementById("manoDeObra");
const total = document.getElementById("total");
const sena = document.getElementById("sena");
const saldo = document.getElementById("saldo");
const lista = document.getElementById("lista");
const estado = document.getElementById("estado");
const filtroEstado = document.getElementById("filtroEstado");
const filtroVencimiento = document.getElementById("filtroVencimiento");
const usuario = document.getElementById("usuario");
const email = document.getElementById("email");
const password = document.getElementById("password");
const recordarme = document.getElementById("recordarme");

let accionIdActual = null;
let salirAplicacion = false;
let idEditando = null;
let grafico = null;
let graficoMensual = null;
let idCobroActual = null;
let resolverConfirmacion = null;

const totalFacturado =
    document.getElementById("totalFacturado");

const cantidadPresupuestos =
    document.getElementById("cantidadPresupuestos");

const promedio =
    document.getElementById("promedio");

const cantidadPendientes = document.getElementById("cantidadPendientes");


function token() {

    return localStorage.getItem("token") || "";

}

const INACTIVIDAD_MS = 15 * 60 * 1000;
const AVISO_INACTIVIDAD_MS = 60 * 1000;
let temporizadorInactividad = null;
let temporizadorCierreInactividad = null;
let avisoInactividadActivo = false;
let contadorMediciones = 0;
let pullInicioY = 0;
let pullActivo = false;
let pullListo = false;
let pullActualizando = false;
let temporizadorUsuarioSugerido = null;
let consultaUsuarioSugerido = 0;

function iniciarMedicion(nombre) {
    const etiqueta = `${nombre} #${++contadorMediciones}`;
    console.time(etiqueta);
    return () => console.timeEnd(etiqueta);
}

function sesionAutenticada() {
    return Boolean(
        localStorage.getItem("token") &&
        localStorage.getItem("usuarioId") &&
        (
            localStorage.getItem("logueado") === "si" ||
            sessionStorage.getItem("logueado") === "si"
        )
    );
}

function esAndroidNativo() {
    return window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === "android";
}

function haySesionGuardada() {
    return Boolean(localStorage.getItem("token") && localStorage.getItem("usuarioId"));
}

function cargarDatos(origen = "manual") {
    const fin = iniciarMedicion(`frontend:${origen}:carga-datos-total`);
    return Promise.allSettled([
        cargarPresupuestos(),
        cargarResumenGastos(),
        cargarGastos(),
        cargarResumenMensual()
    ]).finally(fin);
}

function cargarDatosEnSegundoPlano(origen = "login") {
    const iniciarCarga = () => {
        cargarDatos(origen);
    };

    if ("requestIdleCallback" in window) {
        window.requestIdleCallback(iniciarCarga, { timeout: 500 });
        return;
    }

    setTimeout(iniciarCarga, 0);
}

function obtenerClaseEstado(estadoActual) {
    const estadoNormalizado = String(estadoActual || "").trim().toLowerCase();

    if (estadoNormalizado === "pendiente" || estadoNormalizado === "saldo pendiente") {
        return "estado-pill--pendiente";
    }

    if (estadoNormalizado === "en proceso") {
        return "estado-pill--proceso";
    }

    if (estadoNormalizado === "cobrado" || estadoNormalizado === "cobrado total") {
        return "estado-pill--cobrado";
    }

    if (estadoNormalizado === "vencido") {
        return "estado-pill--vencido";
    }

    return "estado-pill--neutral";
}

function actualizarClaseEstado(selector) {
    selector.className = `estado-pill ${obtenerClaseEstado(selector.value)}`;
}

function obtenerIndicadorPull() {
    let indicador = document.getElementById("pullRefreshIndicador");
    if (indicador) return indicador;

    indicador = document.createElement("div");
    indicador.id = "pullRefreshIndicador";
    indicador.className = "pull-refresh-indicator";
    indicador.textContent = "Deslizá para actualizar";
    document.body.appendChild(indicador);
    return indicador;
}

function ocultarIndicadorPull() {
    pullActivo = false;
    pullListo = false;
    pullActualizando = false;
    document.body.classList.remove("pull-refresh-visible", "pull-refresh-ready", "pull-refresh-loading");

    const indicador = document.getElementById("pullRefreshIndicador");
    if (indicador) {
        indicador.textContent = "Deslizá para actualizar";
    }
}

function pantallaLoginVisible() {
    const login = document.getElementById("login");
    return Boolean(login && getComputedStyle(login).display !== "none");
}

function hayModalAbierto() {
    return Boolean(document.querySelector(".modal-logout.mostrar"));
}

function sistemaVisible() {
    const sistema = document.getElementById("sistema");
    return Boolean(
        sistema &&
        getComputedStyle(sistema).display !== "none" &&
        !pantallaLoginVisible()
    );
}

function puedeIniciarActualizacionPorDeslizamiento(evento) {
    const objetivo = evento.target;
    return (
        sesionAutenticada() &&
        sistemaVisible() &&
        !hayModalAbierto() &&
        window.scrollY <= 0 &&
        !pullActualizando &&
        !avisoInactividadActivo &&
        !objetivo.closest?.("input, textarea, select, button, .modal-logout")
    );
}

async function refrescarPorDeslizamiento() {
    if (!sesionAutenticada() || !sistemaVisible() || hayModalAbierto()) {
        ocultarIndicadorPull();
        return;
    }

    pullActualizando = true;
    const indicador = obtenerIndicadorPull();
    indicador.textContent = "Actualizando...";
    document.body.classList.add("pull-refresh-loading");

    try {
        await cargarDatos("pull-to-refresh");
        mostrarNotificacion("Datos actualizados");
    } finally {
        pullActualizando = false;
        pullListo = false;
        document.body.classList.remove("pull-refresh-visible", "pull-refresh-ready", "pull-refresh-loading");
        indicador.textContent = "Deslizá para actualizar";
    }
}

function configurarActualizacionPorDeslizamiento() {
    obtenerIndicadorPull();

    window.addEventListener("touchstart", evento => {
        if (evento.touches.length !== 1 || !puedeIniciarActualizacionPorDeslizamiento(evento)) return;
        pullInicioY = evento.touches[0].clientY;
        pullActivo = true;
        pullListo = false;
    }, { passive: true });

    window.addEventListener("touchmove", evento => {
        if (!pullActivo || evento.touches.length !== 1) return;
        if (!puedeIniciarActualizacionPorDeslizamiento(evento)) {
            ocultarIndicadorPull();
            return;
        }


        const distancia = evento.touches[0].clientY - pullInicioY;
        if (distancia < 20) return;

        document.body.classList.add("pull-refresh-visible");
        const indicador = obtenerIndicadorPull();

        if (distancia >= 90) {
            pullListo = true;
            indicador.textContent = "Soltá para actualizar";
            document.body.classList.add("pull-refresh-ready");
        } else {
            pullListo = false;
            indicador.textContent = "Deslizá para actualizar";
            document.body.classList.remove("pull-refresh-ready");
        }

        evento.preventDefault();
    }, { passive: false });

    window.addEventListener("touchend", () => {
        if (!pullActivo) return;

        pullActivo = false;
        if (pullListo) {
            refrescarPorDeslizamiento();
            return;
        }

        pullListo = false;
        document.body.classList.remove("pull-refresh-visible", "pull-refresh-ready");
    }, { passive: true });
}

function mostrarSistemaAutenticado(origen = "login") {
    const fin = iniciarMedicion(`frontend:${origen}:mostrar-sistema`);
    document
        .getElementById("login")
        .style.display = "none";

    document
        .getElementById("sistema")
        .style.display = "block";

    actualizarMenuUsuario();
    fin();
    iniciarControlInactividad();
    cargarDatosEnSegundoPlano(origen);
}

async function prepararBotonBiometria() {
    const boton = document.getElementById("btnBiometria");
    if (!boton || !esAndroidNativo() || !BiometricAuth || !haySesionGuardada()) return;

    try {
        const estado = await BiometricAuth.isAvailable();
        boton.hidden = !estado.available;
        if (!estado.available && estado.message) {
            boton.title = estado.message;
        }
    } catch (error) {
        console.error(error);
        boton.hidden = true;
    }
}

async function entrarConBiometria() {
    if (!haySesionGuardada()) {
        alert("Primero ingresa con tu usuario y contrasena para activar el acceso biometrico.");
        return;
    }

    try {
        await BiometricAuth.authenticate({
            title: "Sistema de Presupuestos",
            subtitle: "Usa tu huella, rostro o PIN del dispositivo"
        });

        localStorage.setItem("logueado", "si");
        sessionStorage.removeItem("logueado");
        mostrarSistemaAutenticado("biometria");
    } catch (error) {
        if (error?.message) {
            alert(error.message);
            return;
        }
        alert("No se pudo autenticar con biometria.");
    }
}

function mostrarAvisoInactividad() {
    if (!sesionAutenticada()) return;
    avisoInactividadActivo = true;
    document.getElementById("modalInactividad")?.classList.add("mostrar");
    clearTimeout(temporizadorCierreInactividad);
    temporizadorCierreInactividad = setTimeout(cerrarSesionPorInactividad, AVISO_INACTIVIDAD_MS);
}

function ocultarAvisoInactividad() {
    avisoInactividadActivo = false;
    document.getElementById("modalInactividad")?.classList.remove("mostrar");
    clearTimeout(temporizadorCierreInactividad);
}

function continuarSesion() {
    ocultarAvisoInactividad();
    reiniciarTemporizadorInactividad();
}

function cerrarSesionPorInactividad() {
    ocultarAvisoInactividad();
    localStorage.removeItem("logueado");
    sessionStorage.removeItem("logueado");
    localStorage.removeItem("token");
    localStorage.removeItem("usuarioId");
    localStorage.removeItem("usuario");
    localStorage.removeItem("email");
    clearTimeout(temporizadorInactividad);
    location.reload();
}

function reiniciarTemporizadorInactividad() {
    if (!sesionAutenticada() || avisoInactividadActivo) return;
    clearTimeout(temporizadorInactividad);
    temporizadorInactividad = setTimeout(mostrarAvisoInactividad, INACTIVIDAD_MS);
}

function iniciarControlInactividad() {
    if (!sesionAutenticada()) return;
    reiniciarTemporizadorInactividad();
}

["click", "touchstart", "keydown", "scroll", "pointerdown"].forEach(evento => {
    window.addEventListener(evento, reiniciarTemporizadorInactividad, { passive: true });
});

const consultaTemaSistema = window.matchMedia("(prefers-color-scheme: dark)");

function temaDelSistema() {
    return consultaTemaSistema.matches ? "dark" : "light";
}

function aplicarTema(tema, preferencia = localStorage.getItem("tema") || "auto") {
    document.documentElement.dataset.theme = tema;

    const opciones = {
        auto: document.getElementById("temaAuto"),
        light: document.getElementById("temaClaro"),
        dark: document.getElementById("temaOscuro")
    };

    Object.entries(opciones).forEach(([valor, boton]) => {
        if (boton) boton.setAttribute("aria-pressed", String(valor === preferencia));
    });
}

function seleccionarTema(preferencia) {
    if (!["auto", "light", "dark"].includes(preferencia)) return;

    const temaAnterior = document.documentElement.dataset.theme;
    const temaActual = preferencia === "auto" ? temaDelSistema() : preferencia;
    localStorage.setItem("tema", preferencia);
    aplicarTema(temaActual, preferencia);

    if (temaAnterior !== temaActual) actualizarGraficosTema();
}

function sincronizarTemaSistema() {
    const preferencia = localStorage.getItem("tema") || "auto";
    const temaAnterior = document.documentElement.dataset.theme;
    const temaActual = preferencia === "auto" ? temaDelSistema() : preferencia;

    aplicarTema(temaActual, preferencia);

    if (temaAnterior && temaAnterior !== temaActual) {
        actualizarGraficosTema();
    }
}

if (consultaTemaSistema.addEventListener) {
    consultaTemaSistema.addEventListener("change", () => {
        if ((localStorage.getItem("tema") || "auto") === "auto") sincronizarTemaSistema();
    });
} else if (consultaTemaSistema.addListener) {
    consultaTemaSistema.addListener(() => {
        if ((localStorage.getItem("tema") || "auto") === "auto") sincronizarTemaSistema();
    });
}
async function actualizarMenuUsuario() {
    const nombre = localStorage.getItem("usuario") || "Usuario";
    const emailUsuario = localStorage.getItem("email") || "Sin email cargado";
    const nombreElemento = document.getElementById("menuUsuarioNombre");
    const emailElemento = document.getElementById("menuUsuarioEmail");
    const avatarElemento = document.getElementById("usuarioAvatar");

    if (nombreElemento) {
        nombreElemento.textContent = "Hola, " + nombre;
    }

    if (emailElemento) {
        emailElemento.textContent = emailUsuario;
    }

    if (avatarElemento && emailUsuario !== "Sin email cargado") {
        try {
            const datosEmail = new TextEncoder().encode(emailUsuario.trim().toLowerCase());
            const hashBuffer = await crypto.subtle.digest("SHA-256", datosEmail);
            const hash = Array.from(new Uint8Array(hashBuffer))
                .map(byte => byte.toString(16).padStart(2, "0"))
                .join("");
            avatarElemento.src = `https://www.gravatar.com/avatar/${hash}?s=96&d=mp`;
        } catch (error) {
            avatarElemento.src = "avatar.png";
        }
    }
}

async function avatarPorEmail(emailUsuario) {
    if (!emailUsuario) return "avatar.png";

    try {
        const datosEmail = new TextEncoder().encode(emailUsuario.trim().toLowerCase());
        const hashBuffer = await crypto.subtle.digest("SHA-256", datosEmail);
        const hash = Array.from(new Uint8Array(hashBuffer))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
        return `https://www.gravatar.com/avatar/${hash}?s=160&d=mp`;
    } catch (error) {
        return "avatar.png";
    }
}

async function actualizarLoginRecordado() {
    const usuarioGuardado = localStorage.getItem("usuarioRecordado") || localStorage.getItem("usuario") || "";
    const emailGuardado = localStorage.getItem("emailRecordado") || localStorage.getItem("email") || "";
    const hayUsuario = Boolean(usuarioGuardado || emailGuardado);

    const perfil = document.getElementById("loginPerfilRecordado");
    const identidad = document.getElementById("loginIdentidadCampos");
    const cambiar = document.getElementById("cambiarUsuarioLogin");
    const crearCuenta = document.getElementById("crearCuentaLogin");
    const nombre = document.getElementById("loginNombreRecordado");
    const emailTexto = document.getElementById("loginEmailRecordado");
    const avatar = document.getElementById("loginAvatar");

    if (perfil) perfil.hidden = !hayUsuario;
    if (identidad) identidad.hidden = hayUsuario;
    if (cambiar) cambiar.hidden = !hayUsuario;
    if (crearCuenta) crearCuenta.hidden = hayUsuario;
    if (recordarme) recordarme.checked = hayUsuario;

    if (!hayUsuario) return;

    if (usuarioGuardado) usuario.value = usuarioGuardado;
    if (emailGuardado) email.value = emailGuardado;
    if (nombre) nombre.textContent = usuarioGuardado || emailGuardado;
    if (emailTexto) emailTexto.textContent = emailGuardado;
    if (avatar) avatar.src = await avatarPorEmail(emailGuardado);
}

function cambiarUsuarioLogin() {
    localStorage.removeItem("usuarioRecordado");
    localStorage.removeItem("emailRecordado");
    usuario.value = "";
    email.value = "";
    password.value = "";
    recordarme.checked = false;
    actualizarLoginRecordado();
    usuario.focus();
}

function togglePasswordLogin() {
    const visible = password.type === "text";
    password.type = visible ? "password" : "text";
}

sincronizarTemaSistema();
function calcularTotal() {

    let resultado =
        Number(materiales.value) +
        Number(manoDeObra.value);

    let valorSena =
        Number(sena.value) || 0;

    let saldoPendiente =
        resultado - valorSena;

    total.innerText =
        "Total: $" + resultado;

    saldo.innerText =
        "Saldo: $" + saldoPendiente;

    return resultado;
}

materiales.addEventListener("input", calcularTotal);

manoDeObra.addEventListener("input", calcularTotal);

sena.addEventListener("input", calcularTotal);

busqueda.addEventListener(
    "input",
    cargarPresupuestos
);

filtroEstado.addEventListener(
    "change",
    cargarPresupuestos
);

filtroVencimiento.addEventListener(
    "change",
    cargarPresupuestos
);
function limpiarFormulario() {

    cliente.value = "";
    telefono.value = "";
    direccion.value = "";
    trabajo.value = "";
    observaciones.value = "";
    document.getElementById("descripcionIA").value = "";
    fechaVencimiento.value = "";

    materiales.value = "";
    manoDeObra.value = "";
    sena.value = "";

    estado.value = "Pendiente";

    imagen.value = "";

    total.innerText = "Total: $0";
    saldo.innerText = "Saldo: $0";

    idEditando = null;

}
//guardar presupuestos
async function guardarPresupuesto() {
    if (
        cliente.value === "" ||
        trabajo.value === "" ||
        materiales.value === "" ||
        manoDeObra.value === ""
    ) {
            alert("Completa todos los campos");
            return;
        }
    const formData = new FormData();

        formData.append(
            "cliente",
            cliente.value
        );

        formData.append(
            "telefono",
            telefono.value
        );

        formData.append(
            "direccion",
            direccion.value
        );

        formData.append(
            "trabajo",
            trabajo.value
        );

        formData.append(
            "observaciones",
            observaciones.value
        );

        formData.append(
            "materiales",
            materiales.value
        );

        formData.append(
            "manoDeObra",
            manoDeObra.value
        );

        formData.append(
            "total",
            calcularTotal()
        );

        formData.append(
            "fecha",
            new Date().toLocaleDateString()
        );

        formData.append(
            "fechaVencimiento",
            fechaVencimiento.value
        );

        formData.append(
            "estado",
            estado.value
        );
        formData.append(
            "sena",
            sena.value || 0
        );

        formData.append(
            "saldo",
            calcularTotal() -
            (Number(sena.value) || 0)
        );
        
        
        console.log(imagen.files);
       for (let file of imagen.files) {        
        formData.append(
            "imagen",
            file
        );

    }
    if (idEditando) {
        

    const respuesta = await fetch(API + "/presupuestos/editar-presupuesto/" + idEditando, {

        method: "PUT",

        headers: {
            "Content-Type": "application/json",
            authorization: token()
        },
            //PUT
        body: JSON.stringify({

            cliente: cliente.value,

            telefono: telefono.value,

            direccion: direccion.value,

            trabajo: trabajo.value,

            observaciones: observaciones.value,

            materiales: materiales.value,

            manoDeObra: manoDeObra.value,

            total: calcularTotal(),

            sena: sena.value || 0,

            saldo: calcularTotal() - (Number(sena.value) || 0),

            fecha: new Date().toLocaleDateString(),

            fechaVencimiento: fechaVencimiento.value,

            estado: estado.value

        })
    });
      if (!respuesta.ok) {
            alert ("Error al editar")
            return;
        }
        alert("Presupuesto actualizado");
        idEditando = null;
        limpiarFormulario();
    }     
    else {

        const respuesta = await fetch(API + "/presupuestos/guardar-presupuesto", {

            method: "POST",
             headers: {

            authorization:
                localStorage.getItem(
                    "token"
                )

        },
            body: formData

        });
        if (!respuesta.ok) {
            alert(await respuesta.text() || "Error al guardar");
            return;
        }
        alert("Presupuesto guardado");
    }
    limpiarFormulario();
    cargarPresupuestos();
    cargarResumenGastos();
    cargarGastos();
    cargarResumenMensual();
}

//cargar presupuestos
async function cargarPresupuestos() {

    const finTotal = iniciarMedicion("frontend:cargarPresupuestos:total");
    const finFetch = iniciarMedicion("frontend:cargarPresupuestos:fetch");
    const respuesta = await fetch(API + "/presupuestos/obtener-presupuestos?busqueda=" +

        busqueda.value +
        
        "&estado=" +

        filtroEstado.value +

        "&vencimiento=" +

        filtroVencimiento.value +

            "&usuarioId=" +

        localStorage.getItem(
            "usuarioId"
        ),
        {
            headers: {
                authorization: token()
            }
        }
    );
    finFetch();

    if (!respuesta.ok) {
        if (respuesta.status === 401) {
            confirmarLogout();
        }
        finTotal();
        return;
    }

    const finJson = iniciarMedicion("frontend:cargarPresupuestos:json");
    const presupuestos = await respuesta.json();
    finJson();
    const finRender = iniciarMedicion("frontend:cargarPresupuestos:render");
    
    const hoy = new Date();

            const mesActual =
                hoy.getMonth() + 1;

            const anioActual =
                hoy.getFullYear();

            const facturacionMes =
                presupuestos
                    .filter(p => {

            if (!p.fecha) return false;

            const partes =
                p.fecha.split("/");

            const mes =
                Number(partes[1]);

            const anio =
                Number(partes[2]);

            return (
                mes === mesActual &&
                anio === anioActual
            );

        })
        .reduce(
            (total, p) =>
                total + Number(p.total || 0),
            0
        );

document.getElementById("facturacionMes").textContent = "$" +
    facturacionMes.toLocaleString(
        "es-AR"
    );
    
    const clientes = {};

        presupuestos.forEach(p => {

            if (!p.cliente) return;

            if (!clientes[p.cliente]) {

                clientes[p.cliente] = 0;

            }

            clientes[p.cliente] += Number(
                p.total || 0
            );

        });

        let mejorCliente = "-";
        let mayorMonto = 0;

        Object.entries(clientes).forEach(

            ([cliente, monto]) => {

                if (monto > mayorMonto) {

                    mayorMonto = monto;
                    mejorCliente = cliente;

                }

            }

        );
        console.log(document.getElementById("mejorCliente")
);
        document.getElementById("mejorCliente").textContent = mejorCliente;
        document.getElementById("montoMejorCliente").textContent = "$" + mayorMonto.toLocaleString("es-AR");
        const meses = {};

            presupuestos.forEach(p => {

                if (!p.fecha) return;

                const partes = p.fecha.split("/");

                const clave =
                    partes[1] + "/" + partes[2];

                if (!meses[clave]) {

                    meses[clave] = 0;

                }

                meses[clave] += Number(
                    p.total || 0
                );

            });

            let mejorMes = "-";
            let mayorFacturacion = 0;

            Object.entries(meses).forEach(

                ([mes, monto]) => {

                    if (monto > mayorFacturacion) {

                        mayorFacturacion = monto;
                        mejorMes = mes;

                    }

                }

            );

            document.getElementById(
                "mejorMes"
            ).textContent = mejorMes;

            document.getElementById(
                "montoMejorMes"
            ).textContent =
                "$" +
                mayorFacturacion.toLocaleString(
                    "es-AR"
                );
    const porCobrar = presupuestos
    .filter(
        p =>
            p.estado !== "Cobrado total" &&
            p.estado !== "Cobrado"
    )
    .reduce(
        (total, p) =>
            total + Number(p.saldo || 0),
        0
    );
    console.log(
    document.getElementById("dashPorCobrar")
);
            console.log("POR COBRAR:", porCobrar);
            console.log(presupuestos);

        document.getElementById(
            "dashPorCobrar"
        ).textContent =
            "$" +
            porCobrar.toLocaleString("es-AR");
    
    const resumenRespuesta = await fetch(API + "/presupuestos/resumen",
        {
            headers: {
                authorization: token()
            }
        }
    );

        const resumen = await resumenRespuesta.json();

        console.log(resumen);

        document.getElementById(
            "dashPresupuestado"
        ).textContent =
            "$" +
            Number(
                resumen.totalPresupuestado
            ).toLocaleString("es-AR");

        document.getElementById(
            "dashCobrado"
        ).textContent =
            "$" +
            Number(
                resumen.totalCobrado
            ).toLocaleString("es-AR");

        document.getElementById(
            "dashPendiente"
        ).textContent =
            "$" +
            Number(
                resumen.saldoPendiente
            ).toLocaleString("es-AR");

        document.getElementById(
            "dashVencidos"
        ).textContent =
            resumen.vencidos;
        const gastosRespuesta =
            await fetch(API + "/gastos/resumen", {
                headers: { authorization: token() }
            });

        const gastosDatos =
            await gastosRespuesta.json();

        const ganancia =
            Number(resumen.totalCobrado || 0)
            -
            Number(gastosDatos.totalGastos || 0);

        document.getElementById(
            "gananciaReal"
        ).textContent =
            "$" +
            ganancia.toLocaleString("es-AR");

        const totalPresupuestado = Number(resumen.totalPresupuestado || 0);
        const totalCobrado = Number(resumen.totalCobrado || 0);
        const tasaCobro = totalPresupuestado > 0
            ? (totalCobrado / totalPresupuestado) * 100
            : 0;
        const margenNeto = totalCobrado > 0
            ? (ganancia / totalCobrado) * 100
            : 0;
        const tasaCobroEl =
    document.getElementById("tasaCobro");

        if (tasaCobroEl) {
            tasaCobroEl.textContent =
                tasaCobro.toFixed(0) + "%";
        }

        const margenNetoEl =
            document.getElementById("margenNeto");

        if (margenNetoEl) {
            margenNetoEl.textContent =
                margenNeto.toFixed(0) + "%";
        }
    const fechaHoy = new Date()
        .toISOString()
        .split("T")[0];

    const alertas =
    document.getElementById(
        "alertas"
    );

    alertas.innerHTML = "";

    presupuestos.forEach(p => {

    if (!p.fechaVencimiento) {

        return;

    }

    if (
        p.fechaVencimiento === fechaHoy
    ) {

        alertas.innerHTML += `
            <div class="alerta">
                &#9888;&#65039; Vence hoy:
                ${p.cliente}
            </div>
        `;

    }

    if (
        p.fechaVencimiento < fechaHoy
        &&
        p.estado !==
        "Cobrado total"
    ) {

        alertas.innerHTML += `
            <div class="
                alerta
                alerta-atrasada
            ">
                &#128680; Atrasado:
                ${p.cliente}
            </div>
        `;

    }

    });

    lista.innerHTML = "";
    const pendientesCantidad =
    presupuestos.filter(
        p => p.estado === "Pendiente"
    ).length;

    const enProceso =
    presupuestos.filter(
        p => p.estado === "En proceso"
    ).length;

    const totalFacturadoMonto =
    presupuestos.reduce(
        (total, p) =>
        total + Number(p.total || 0),
        0
    );
    document.getElementById(
        "totalFacturado"
    ).textContent =
    "$" +
    totalFacturadoMonto.toLocaleString(
        "es-AR"
    );
 
    const trabajosPendientes = presupuestos.filter(
        p => p.estado !== "Cobrado total"
    );

    document.querySelectorAll("#totalFacturado").forEach(elemento => {
        elemento.textContent =
            "$" + totalFacturadoMonto.toLocaleString("es-AR");
    });

    cantidadPresupuestos.textContent =
        presupuestos.length;

    const promedioTotal = presupuestos.length > 0
        ? totalFacturadoMonto / presupuestos.length
        : 0;

    promedio.textContent = "$" + promedioTotal.toFixed(0);

    cantidadPendientes.textContent = trabajosPendientes.length;

    if (trabajosPendientes.length > 0) {

    mostrarNotificacion(

        `Tenes ${trabajosPendientes.length} trabajos pendientes`

    );

}
    presupuestos.forEach(p => {

    lista.innerHTML += `
        
        <tr class="budget-card-row">
            <td class="budget-card-client" data-label="Cliente">
                ${p.cliente}
            </td>

            <td class="budget-card-work" data-label="Trabajo">
                ${p.trabajo}
            </td>

            <td class="budget-card-total" data-label="Total">
                $${Number(p.total).toLocaleString("es-AR")}
            </td>

            <td class="budget-card-deposit" data-label="Seña">
                $${Number(p.sena || 0).toLocaleString("es-AR")}
            </td>

            <td class="budget-card-balance" data-label="Saldo">
                $${Number(p.saldo || p.total).toLocaleString("es-AR")}
            </td>

            <td class="budget-card-date" data-label="Vencimiento">
                ${p.fechaVencimiento || "-"}
            </td>
            <td class="budget-card-status" data-label="Estado">

                <select
                    class="estado-pill ${obtenerClaseEstado(p.estado)}"
                    onchange="
                        actualizarClaseEstado(this);
                        cambiarEstado(
                            ${p.id},
                            this.value
                        )
                    "
                >

                    <option
                        value="Pendiente"
                        ${p.estado === "Pendiente"
                            ? "selected"
                            : ""}
                    >
                        Pendiente
                    </option>

                    <option
                        value="En proceso"
                        ${p.estado === "En proceso"
                            ? "selected"
                            : ""}
                    >
                        En proceso
                    </option>

                    <option
                        value="Entregado"
                        ${p.estado === "Entregado"
                            ? "selected"
                            : ""}
                    >
                        Entregado
                    </option>

                    <option
                        value="Seña"
                        ${p.estado === "Seña"
                            ? "selected"
                            : ""}
                    >
                        Seña
                    </option>

                    <option
                        value="Saldo pendiente"
                        ${p.estado === "Saldo pendiente"
                            ? "selected"
                            : ""}
                    >
                        Saldo pendiente
                    </option>

                    <option
                        value="Cobrado total"
                        ${p.estado === "Cobrado total" || p.estado === "Cobrado"
                            ? "selected"
                            : ""}
                    >
                        Cobrado total
                    </option>

                </select>

            </td>

            <td class="budget-card-actions" data-label="Acciones">                <button class="btn-accion-tabla" type="button" title="Ver detalle" aria-label="Ver detalle" onclick="verDetalle(${p.id})">
                    &#128065;
                </button>

                <button class="btn-accion-tabla" type="button" title="Editar" aria-label="Editar" onclick="editarPresupuesto(${p.id})">
                    &#9999;&#65039;
                </button>

                <button class="btn-accion-tabla" type="button" title="Mas acciones" aria-label="Mas acciones" onclick="masAcciones(${p.id})">
                    &#9881;&#65039;
                </button>

            </td>

        </tr>
                          
    `;

});

crearGrafico(presupuestos);

crearGraficoMensual(
    presupuestos
)

finRender();
finTotal();
};
//editar presupuestos
async function editarPresupuesto(id) {

    const respuesta = await fetch(API + "/presupuestos/obtener-presupuestos?usuarioId=" +
            localStorage.getItem("usuarioId")
        ,
        {
            headers: {
                authorization: token()
            }
        }
        );

    const presupuestos = await respuesta.json();
    

    const presupuesto = presupuestos.find(p => p.id == id);

    if (!presupuesto) {

        alert("No se encontrÃ³ presupuesto");

        return;

    }

    cliente.value = presupuesto.cliente;

    telefono.value = presupuesto.telefono || "";

    direccion.value = presupuesto.direccion || "";

    trabajo.value = presupuesto.trabajo;

    observaciones.value = presupuesto.observaciones || "";

    fechaVencimiento.value = presupuesto.fechaVencimiento || "";

    materiales.value = presupuesto.materiales;

    manoDeObra.value = presupuesto.manoDeObra;

    estado.value = presupuesto.estado;

    sena.value = presupuesto.sena || 0;
    saldo.value = presupuesto.saldo || presupuesto.total;

    calcularTotal();

    idEditando = id;
        window.scrollTo({

        top: 0,

        behavior: "smooth"

    });
    cliente.focus();

}
async function registrarPago(id) {

    cerrarModalAcciones();

    idCobroActual = id;

    const input = document.getElementById("montoCobro");
    const error = document.getElementById("errorCobro");

    if (input) {
        input.value = "";
    }

    if (error) {
        error.textContent = "";
    }

    document
        .getElementById("modalCobro")
        .classList.add("mostrar");

    setTimeout(() => input?.focus(), 50);

}

async function confirmarCobro() {

    const input = document.getElementById("montoCobro");
    const error = document.getElementById("errorCobro");
    const monto = Number(input?.value || 0);

    if (isNaN(monto) || monto <= 0) {

        if (error) {
            error.textContent = "Ingresa un monto valido.";
        }

        return;

    }

    if (!idCobroActual) {
        cerrarModalCobro();
        return;
    }

    const respuesta = await fetch(API + "/presupuestos/cobrar/" + idCobroActual,

        {

            method: "PUT",

            headers: {

                "Content-Type":
                    "application/json",

                authorization:
                    token()

            },

            body: JSON.stringify({

                monto: Number(monto)

            })

        }

    );

    if (!respuesta.ok) {

        alert("Error al registrar pago");

        return;

    }

    alert("Pago registrado");
    cerrarModalCobro();
    cargarResumenGastos();
    cargarPresupuestos();
    cargarGastos();
    cargarResumenMensual();

}

function cerrarModalCobro() {
    idCobroActual = null;
    document
        .getElementById("modalCobro")
        .classList.remove("mostrar");
}
async function eliminarPresupuesto(id) {

    cerrarModalAcciones();

    const confirmado = await pedirConfirmacion({
        titulo: "Eliminar presupuesto",
        texto: "Esta accion elimina el presupuesto y no se puede deshacer.",
        aceptar: "Eliminar"
    });

    if (!confirmado) {
        return;
    }
    await fetch(API + "/presupuestos/eliminar-presupuesto/" + id, {

        method: "DELETE",

        headers: {
            authorization: token()
        }

    });
    cargarPresupuestos();
}
function descargarPDF(id) {

    cerrarModalAcciones();

    window.open(
    API + "/presupuestos/generar-pdf/" + id +
        "?token=" + encodeURIComponent(token()),
        "_blank"
    );

}
async function cambiarEstado(id, estado) {

    console.log("[CAMBIAR_ESTADO] frontend envía", { id, estado });

    const respuesta = await fetch(API + "/presupuestos/cambiar-estado/" + id,
        {

            method: "PUT",

            headers: {
                "Content-Type":
                    "application/json",
                authorization:
                    token()
            },

            body: JSON.stringify({
                estado
            })

        }
    );

    if (!respuesta.ok) {
        const mensaje = await respuesta.text();
        console.error("[CAMBIAR_ESTADO] error del backend", {
            id,
            estado,
            status: respuesta.status,
            mensaje
        });
        mostrarNotificacion(mensaje || "No se pudo actualizar el estado");
        return;
    }

    console.log("[CAMBIAR_ESTADO] actualizado", { id, estado });

    cargarPresupuestos();

}
function obtenerColorCss(variable) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim();
}

function formatoMoneda(valor) {
    return "$" + Number(valor || 0).toLocaleString("es-AR");
}

function opcionesGraficos() {
    const colorTexto = obtenerColorCss("--ink");
    const colorSuave = obtenerColorCss("--ink-soft");
    const colorLinea = obtenerColorCss("--line");

    return { colorTexto, colorSuave, colorLinea };
}

function actualizarGraficosTema() {
    if (grafico || graficoMensual) {
        cargarPresupuestos();
    }
}

function crearGrafico(presupuestos) {

    const canvas =
        document.getElementById("grafico");

    const ctx =
        canvas.getContext("2d");

    const estados = [
        "Pendiente",
        "En proceso",
        "Entregado",
        "Seña",
        "Saldo pendiente",
        "Cobrado total"
    ];

    const valores = estados.map(estadoNombre => {
        return presupuestos
            .filter(p => {
                if (estadoNombre === "Cobrado total") {
                    return p.estado === "Cobrado total" || p.estado === "Cobrado";
                }

                return p.estado === estadoNombre;
            })
            .reduce((acc, p) => acc + Number(p.total || 0), 0);
    });

    const { colorTexto, colorSuave } = opcionesGraficos();

    if (grafico) {

        grafico.destroy();

    }

    grafico = new Chart(ctx, {

        type: "doughnut",

        data: {

            labels: estados,

            datasets: [{

                data: valores,
                backgroundColor: [
                    "#d99a35",
                    "#4f83cc",
                    "#7a6fd6",
                    "#d47a4a",
                    "#b95050",
                    "#3f9f6b"
                ],
                borderColor: obtenerColorCss("--paper"),
                borderWidth: 3,
                hoverOffset: 8

            }]

        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: colorTexto,
                        boxWidth: 12,
                        padding: 16,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return context.label + ": " + formatoMoneda(context.raw);
                        }
                    }
                }
            },
            animation: {
                duration: 650,
                easing: "easeOutQuart"
            }
        }

    });

}

function crearGraficoMensual(presupuestos) {

    const meses = {};

    presupuestos.forEach(p => {

        if (!p.fecha) return;

        const partes =
            p.fecha.split("/");

        if (partes.length < 3) return;

        const mes =
            partes[1] + "/" + partes[2];

        if (!meses[mes]) {

            meses[mes] = 0;

        }

        meses[mes] += Number(p.total || 0);

    });

    const labels =
        Object.keys(meses);

    const datos =
        Object.values(meses);

    const canvas =
        document.getElementById(
            "graficoMensual"
        );

    const ctx =
        canvas.getContext("2d");

    const { colorTexto, colorSuave, colorLinea } = opcionesGraficos();

    if (graficoMensual) {

        graficoMensual.destroy();

    }

    graficoMensual = new Chart(ctx, {

        type: "bar",

        data: {

            labels,

            datasets: [{

                label: "Facturacion mensual",

                data: datos,
                backgroundColor: "rgba(63, 159, 107, .72)",
                borderColor: "#3f9f6b",
                borderWidth: 2,
                borderRadius: 10,
                maxBarThickness: 52

            }]

        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return formatoMoneda(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: colorSuave },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: colorSuave,
                        callback(value) {
                            return formatoMoneda(value);
                        }
                    },
                    grid: { color: colorLinea }
                }
            },
            animation: {
                duration: 650,
                easing: "easeOutQuart"
            }
        }

    });

}
async function login() {

    const finLogin = iniciarMedicion("frontend:login:total");
    const finFetch = iniciarMedicion("frontend:login:fetch");
    document.getElementById("btnReenviarVerificacion").hidden = true;
    const respuesta =
        await fetch(API +"/login", {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({

                usuario:
                    usuario.value.trim(),

                email:
                    email.value.trim(),

                password:
                    password.value

            })

        });
    finFetch();
    if (respuesta.ok) {
        const finJson = iniciarMedicion("frontend:login:json");
        const datos = await respuesta.json();
        finJson();

        /*alert("Bienvenido");*/
       if (recordarme.checked) {
        localStorage.setItem("logueado", "si");
        } else {
            sessionStorage.setItem("logueado", "si");
        }
        localStorage.setItem(
            "token",
            datos.token
        );
        localStorage.setItem(
            "usuarioId",
            datos.id
        );
        if (datos.usuario) {
            localStorage.setItem("usuario", datos.usuario);
        }
        if (datos.email) {
            localStorage.setItem("email", datos.email);
        }
        if (document.getElementById("recordarme")?.checked) {
            localStorage.setItem("usuarioRecordado", datos.usuario || usuario.value.trim());
            localStorage.setItem("emailRecordado", datos.email || email.value.trim());
        } else {
            localStorage.removeItem("usuarioRecordado");
            localStorage.removeItem("emailRecordado");
        }
        mostrarSistemaAutenticado("login");
        prepararBotonBiometria();
    } else {

        const contenido = await respuesta.text();
        let detalle = {};
        try {
            detalle = JSON.parse(contenido);
        } catch (_) {
            // Algunas respuestas existentes del servidor son texto plano.
        }

        if (detalle.code === "EMAIL_NO_VERIFICADO") {
            if (detalle.email) email.value = detalle.email;
            document.getElementById("btnReenviarVerificacion").hidden = false;
            mostrarNotificacion(detalle.mensaje);
        } else {
            alert(detalle.mensaje || contenido || "Usuario incorrecto");
        }

    }
    finLogin();
}

async function reenviarVerificacion() {
    const emailVerificacion = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVerificacion)) {
        mostrarNotificacion("Ingresá el email de la cuenta para reenviar la verificación.");
        return;
    }

    const respuesta = await fetch(API + "/reenviar-verificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailVerificacion })
    });
    const mensaje = await respuesta.text();
    mostrarNotificacion(mensaje || "No se pudo reenviar el email de verificación.");
}
function abrirRecuperarPassword() {
    document.getElementById("emailRecuperacion").value =
        email.value.trim() || localStorage.getItem("emailRecordado") || "";
    document.getElementById("modalRecuperarPassword").classList.add("mostrar");
}

function cerrarRecuperarPassword() {
    document.getElementById("modalRecuperarPassword").classList.remove("mostrar");
}

async function solicitarRecuperacionPassword() {
    const emailRecuperacion = document.getElementById("emailRecuperacion").value.trim();
    const respuesta = await fetch(API + "/olvide-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailRecuperacion })
    });
    const mensaje = await respuesta.text();
    if (!respuesta.ok) return mostrarNotificacion(mensaje);
    cerrarRecuperarPassword();
    mostrarNotificacion(mensaje);
}

async function restablecerPassword() {
    const nueva = document.getElementById("nuevaPassword").value;
    const repetir = document.getElementById("repetirNuevaPassword").value;
    if (nueva.length < 6) return mostrarNotificacion("La contraseña debe tener al menos 6 caracteres");
    if (nueva !== repetir) return mostrarNotificacion("Las contraseñas no coinciden");

    const resetToken = new URLSearchParams(location.search).get("reset");
    const respuesta = await fetch(API + "/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: nueva })
    });
    const mensaje = await respuesta.text();
    if (!respuesta.ok) return mostrarNotificacion(mensaje);
    history.replaceState({}, "", location.pathname);
    document.getElementById("modalNuevaPassword").classList.remove("mostrar");
    mostrarNotificacion(mensaje + ". Ya podés iniciar sesión.");
}

function abrirRegistro() {
    document.getElementById("modalRegistro").classList.add("mostrar");
    document.getElementById("nombreRegistro").focus();
}

function cerrarRegistro() {
    document.getElementById("modalRegistro").classList.remove("mostrar");
    document.getElementById("errorRegistro").textContent = "";
}

function requisitosPassword(password) {
    return [
        password.length >= 8,
        /[A-Z]/.test(password),
        /[a-z]/.test(password),
        /\d/.test(password),
        /[^A-Za-z0-9]/.test(password)
    ];
}

function actualizarSeguridadRegistro() {
    const requisitos = requisitosPassword(document.getElementById("passwordRegistro").value);
    const ids = [
        "requisitoLongitud",
        "requisitoMayuscula",
        "requisitoMinuscula",
        "requisitoNumero",
        "requisitoSimbolo"
    ];

    ids.forEach((id, indice) => {
        const item = document.getElementById(id);
        item.classList.toggle("cumplido", requisitos[indice]);
        item.setAttribute("aria-label", `${requisitos[indice] ? "Cumplido" : "Pendiente"}: ${item.textContent}`);
    });
}

function normalizarUsuarioSugerido(nombre) {
    return nombre
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "")
        .slice(0, 40);
}

function actualizarUsuarioSugerido() {
    const nombre = document.getElementById("nombreRegistro").value;
    const destino = document.getElementById("usuarioSugeridoRegistro");
    const base = normalizarUsuarioSugerido(nombre);
    const consultaActual = ++consultaUsuarioSugerido;
    clearTimeout(temporizadorUsuarioSugerido);

    if (base.length < 3) {
        destino.textContent = "—";
        return;
    }

    destino.textContent = base;
    temporizadorUsuarioSugerido = setTimeout(async () => {
        try {
            const respuesta = await fetch(`${API}/registro/usuario-sugerido?nombre=${encodeURIComponent(nombre)}`);
            const datos = await respuesta.json();
            if (respuesta.ok && consultaActual === consultaUsuarioSugerido && datos.usuario) {
                destino.textContent = datos.usuario;
            }
        } catch (error) {
            console.warn("No se pudo actualizar el usuario sugerido", error);
        }
    }, 250);
}

function alternarVisibilidadPassword(idInput, boton) {
    const input = document.getElementById(idInput);
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    boton.setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
    boton.setAttribute("aria-pressed", String(!visible));
}

async function registrarse() {
    const nombre = document.getElementById("nombreRegistro").value.trim();
    const emailVal = document.getElementById("emailRegistro").value.trim();
    const passwordVal = document.getElementById("passwordRegistro").value;
    const confirmarPassword = document.getElementById("confirmarPasswordRegistro").value;
    const errorRegistro = document.getElementById("errorRegistro");
    errorRegistro.textContent = "";

    if (nombre.length < 3) {
        errorRegistro.textContent = "Ingresá tu nombre y apellido.";
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        errorRegistro.textContent = "Ingresá un email válido.";
        return;
    }

    if (requisitosPassword(passwordVal).some(requisito => !requisito)) {
        errorRegistro.textContent = "La contraseña no cumple todos los requisitos.";
        return;
    }

    if (passwordVal !== confirmarPassword) {
        errorRegistro.textContent = "Las contraseñas no coinciden.";
        return;
    }

    try {
        const respuesta = await fetch(API + "/registro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nombre,
                email: emailVal,
                password: passwordVal,
                confirmarPassword
            })
        });
        const contenido = await respuesta.text();
        let datos = {};
        try {
            datos = JSON.parse(contenido);
        } catch (_) {
            // Las respuestas de error existentes del servidor son texto plano.
        }

        if (!respuesta.ok) {
            errorRegistro.textContent = datos.mensaje || contenido || "No se pudo crear la cuenta.";
            return;
        }

        cerrarRegistro();
        document.getElementById("email").value = emailVal;
        document.getElementById("usuario").value = datos.usuario || "";
        document.getElementById("password").value = "";
        document.getElementById("btnReenviarVerificacion").hidden = false;
        mostrarNotificacion(`${datos.mensaje || "Cuenta creada."} Tu usuario es: ${datos.usuario}`);
    } catch (error) {
        console.error(error);
        errorRegistro.textContent = "No se pudo conectar con el servidor.";
    }
}
if (sesionAutenticada()) {

    mostrarSistemaAutenticado("sesion-guardada");

} else {

    document
        .getElementById("login")
        .style.display = "block";

    document
        .getElementById("sistema")
        .style.display = "none";

}
prepararBotonBiometria();
function logout() {

    if (!sesionAutenticada()) {
        return;
    }

    document
        .getElementById(
            "modalLogout"
        )
        .classList.add(
            "mostrar"
        );

}
function abrirImagen(src) {

    document
        .getElementById("modalImagen")
        .style.display = "flex";

    document
        .getElementById("imagenGrande")
        .src = src;

}

document
    .getElementById("modalImagen")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById("modalImagen")
                .style.display = "none";

        }
    )
    async function exportarExcel() {

    const url =
        "https://sistema-de-presupuesto.onrender.com/exportar-excel?token=" +
        encodeURIComponent(token());

    window.open(
        url,
        "_system"
    );

}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {

            registrations.forEach((registration) => {

                registration.unregister();

            });

        });

    navigator.serviceWorker
        .register("/service-worker.js")
        .then(() => {

            console.log(
                "PWA lista"
            );

        });

    navigator.serviceWorker.ready.then((registration) => {

        registration.update();

    });

}
function compararImagenes(
    antes,
    despues
) {

    document
        .getElementById("comparador")
        .style.display = "flex";

    document
        .getElementById("antes")
        .src = antes;

    document
        .getElementById("despues")
        .src = despues;

}
document
    .getElementById("sliderComparador")
    .addEventListener(
        "input",
        (e) => {

            document
                .getElementById("despues")
                .style.clipPath =

                `inset(
                    0
                    ${100 - e.target.value}%
                    0
                    0
                )`;

        }
    );
    document
    .getElementById("comparador")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById("comparador")
                .style.display = "none";

        }
    );

    function normalizarTelefonoWhatsApp(valor) {

        let numero = String(valor || "")
            .replace(/\D/g, "");

        if (numero.startsWith("00")) {

            numero = numero.slice(2);

        }

        if (numero.startsWith("0")) {

            numero = numero.slice(1);

        }

        if (numero.startsWith("15")) {

            numero = numero.slice(2);

        }

        if (numero.startsWith("54") && !numero.startsWith("549")) {

            numero = "549" + numero.slice(2);

        }

        if (!numero.startsWith("54")) {

            numero = "549" + numero;

        }

        return numero;

    }

    async function enviarWhatsApp(id) {

        cerrarModalAcciones();

        const respuesta =
            await fetch(API + "/presupuestos/obtener-presupuestos?usuarioId=" +

                localStorage.getItem(
                    "usuarioId"
                ),

                {

                    headers: {

                        authorization:
                            localStorage.getItem(
                                "token"
                            )

                    }

                }

            );

        const presupuestos = await respuesta.json();
        

        const p =
            presupuestos.find(
                x => x.id === id
            );

        if (!p) {

            alert("No se encontrÃ³ presupuesto");

            return;

        }

        const telefonoWhatsApp =
            normalizarTelefonoWhatsApp(p.telefono);

        if (!telefonoWhatsApp) {

            alert("Este cliente no tiene telefono cargado");

            return;

        }

        const mensaje =

    `Hola ${p.cliente},

    Te envÃ­o tu presupuesto.

    Telefono:
    ${p.telefono || "-"}

    Direccion:
    ${p.direccion || "-"}

    Trabajo:
    ${p.trabajo}

    Observaciones de trabajo:
    ${p.observaciones || "-"}

    Vencimiento:
    ${p.fechaVencimiento || "-"}

    Total:
    $${p.total}

    Estado:
    ${p.estado}`;

        const url =

            "https://wa.me/" +

            telefonoWhatsApp +

            "?text=" +

            encodeURIComponent(
                mensaje
            );

        window.open(
            url,
            "_blank"
        );

    }
function mostrarNotificacion(texto) {

    const n =
        document.getElementById(
            "notificacion"
        );

    n.innerText = texto;

    n.style.display = "block";

    setTimeout(() => {

        n.style.display = "none";

    }, 4000);

}
async function verHistorial(id) {

    cerrarModalAcciones();

    const respuesta = await fetch(API + "/presupuestos/pagos/" + id,

        {

            headers: {

                authorization:
                    token()

            }

        }

    );

    const pagos =
        await respuesta.json();

    if (!pagos.length) {

        alert(
            "No hay pagos registrados"
        );

        return;

    }

    let texto = "";

    pagos.forEach((p) => {

        texto +=

            p.fecha +

            "  +$" +

            Number(
                p.monto
            ).toLocaleString("es-AR")

            +

            "\n";

    });

    alert(texto);

}
async function verDetalle(id) {

    const respuesta = await fetch(API + "/presupuestos/obtener-presupuestos?usuarioId=" +
        localStorage.getItem("usuarioId"),
        {
            headers: {
                authorization: token()
            }
        }
    );

    const presupuestos = await respuesta.json();

    const p =
        presupuestos.find(
            x => x.id == id
        );

    if (!p) return;

    alert(

`Cliente: ${p.cliente}

Telefono: ${p.telefono || "-"}

Direccion: ${p.direccion || "-"}

Observaciones:
${p.observaciones || "-"}

Fecha:
${p.fecha || "-"}`

    );

}   
function masAcciones(id) {
    accionIdActual = id;
    window.accionIdActual = id;
    document
        .getElementById(
            "modalAcciones"
        )
        .classList.add(
            "mostrar"
        );

}

function mostrarFormularioGasto() {

    document
        .getElementById("formularioGasto")
        .style.display = "block";

}
async function guardarGasto() {

    const concepto =
        document.getElementById("conceptoGasto").value;

    const monto =
        Number(
            document.getElementById("montoGasto").value
        );

    const respuesta = await fetch(API + "/gastos", {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
                authorization: token()
            },

            body: JSON.stringify({

                fecha: new Date()
                    .toISOString()
                    .slice(0, 10),

                concepto,

                monto

            })

        });

    if (!respuesta.ok) {
        alert(await respuesta.text() || "Error al guardar el gasto");
        return;
    }

    const datos = await respuesta.json();

    alert(
        "Gasto guardado. ID: " +
        datos.id
    );
    cargarGastos();
    cargarResumenGastos();
    cargarPresupuestos();

}
async function cargarResumenGastos() {

    const fin = iniciarMedicion("frontend:cargarResumenGastos");
    const respuesta =
        await fetch(API + "/gastos/resumen", {
            headers: { authorization: token() }
        });

    const datos =
        await respuesta.json();

    const gastos =
        Number(datos.totalGastos || 0);

    document.getElementById(
        "totalGastos"
    ).textContent =
        "$" +
        gastos.toLocaleString("es-AR");
    fin();

}
async function cargarGastos() {

    const fin = iniciarMedicion("frontend:cargarGastos");
    const respuesta =
        await fetch(API + "/gastos", {
            headers: { authorization: token() }
        });

    const gastos =
        await respuesta.json();

    const lista =
        document.getElementById("listaGastos");

    lista.innerHTML = "";

    gastos.forEach(gasto => {

        const fecha =
            new Date(gasto.fecha)
            .toLocaleDateString("es-AR");

        lista.innerHTML += `
            <tr>
                <td>${fecha}</td>
                <td>${gasto.concepto}</td>
                <td>$${Number(gasto.monto).toLocaleString("es-AR")}</td>
                <td>
                    <button onclick="eliminarGasto(${gasto.id})">
                         ❌
                    </button>
                </td>
            </tr>
        `;

    });

    fin();
}
async function eliminarGasto(id) {

    const confirmado = await pedirConfirmacion({
        titulo: "Eliminar gasto",
        texto: "Esta accion elimina el gasto registrado.",
        aceptar: "Eliminar"
    });

    if (!confirmado) {
        return;
    }

    await fetch(API + `/gastos/${id}`, {
        method: "DELETE",
        headers: { authorization: token() }
    });

    cargarGastos();
    cargarResumenGastos();
    cargarPresupuestos();
    cargarResumenMensual();

}

function pedirConfirmacion({ titulo, texto, aceptar }) {
    const modal = document.getElementById("modalConfirmacion");
    document.getElementById("modalConfirmacionTitulo").textContent = titulo;
    document.getElementById("modalConfirmacionTexto").textContent = texto;
    document.getElementById("modalConfirmacionAceptar").textContent = aceptar;
    modal.classList.add("mostrar");

    return new Promise(resolve => {
        resolverConfirmacion = resolve;
    });
}

function cerrarModalConfirmacion(confirmado) {
    document
        .getElementById("modalConfirmacion")
        .classList.remove("mostrar");

    if (resolverConfirmacion) {
        resolverConfirmacion(Boolean(confirmado));
        resolverConfirmacion = null;
    }
}
async function cargarResumenMensual() {

    const fin = iniciarMedicion("frontend:cargarResumenMensual");

    const [gastosRespuesta, cobradoRespuesta] =
        await Promise.all([
            fetch(API + "/gastos/resumen-mensual", {
                headers: { authorization: token() }
            }),
            fetch(API +  "/presupuestos/resumen-mensual",
                {
                    headers: { authorization: token() }
                }
            )
        ]);

    const gastosDatos =
        await gastosRespuesta.json();

    const gastosMes =
        Number(gastosDatos.totalGastosMes || 0);

    document.getElementById(
        "gastosMes"
    ).textContent =
        "$" +
        gastosMes.toLocaleString("es-AR");

    const cobradoDatos =
        await cobradoRespuesta.json();

    const cobradoMes =
        Number(
            cobradoDatos.totalCobradoMes || 0
        );

    const gananciaMes =
        cobradoMes - gastosMes;

    document.getElementById(
        "gananciaMes"
    ).textContent =
        "$" +
        gananciaMes.toLocaleString("es-AR");
    fin();

}
async function descargarBackup() {

    const url =
        "https://sistema-de-presupuesto.onrender.com/backup?token=" +
        encodeURIComponent(token());

    window.open(url, "_blank");

}
document
    .getElementById("busqueda")
    .addEventListener(
        "input",
        cargarPresupuestos
    );

document
    .getElementById("filtroEstado")
    .addEventListener(
        "change",
        cargarPresupuestos
    );

document
    .getElementById("filtroVencimiento")
    .addEventListener(
        "change",
        cargarPresupuestos
    );
async function probarCapacitor() {

    alert(typeof window.Capacitor);

    console.log(window.Capacitor);

    if (window.Capacitor) {

        alert("Capacitor OK");

    } else {

        alert("Capacitor NO");

    }

}
async function descargarArchivoInvisible() {
    
  const url = "https://sistema-de-presupuesto.onrender.com/exportar-excel?token=" + encodeURIComponent(token());

  try {
        const response = await fetch(url);
        const blob = await response.blob();

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64Data = reader.result.split(',')[1];
          const nombreArchivo = `Archivo_${Date.now()}.xlsx`; 

          // Usamos el plugin desde window.Capacitor y pasamos 'DOCUMENTS' como string
          await window.Capacitor.Plugins.Filesystem.writeFile({
            path: nombreArchivo,
            data: base64Data,
            directory: 'DOCUMENTS' 
          });

          alert(`Descarga completa. Guardado en Documentos/${nombreArchivo}`);
        };
  }
  catch (error) {
        console.error("Error al descargar en segundo plano:", error);
        alert("Hubo un error al guardar el archivo.");
  }
}
window.salirAplicacion = false;

if (window.Capacitor?.isNativePlatform?.()) {

    window.Capacitor.Plugins.App.addListener(
    "backButton",
    () => {

        if (
            localStorage.getItem("logueado") !== "si"
        ) {
            window.Capacitor?.Plugins?.App?.exitApp();
            return;
        }

        salirAplicacion = true;

        logout();

    }
);

}
function toggleMenu() {

    document
        .getElementById(
            "menuUsuario"
        )
        .classList.toggle(
            "mostrar"
        );

}
function cerrarModalLogout() {

    document
        .getElementById(
            "modalLogout"
        )
        .classList.remove(
            "mostrar"
        );

}

function abrirMiCuenta() {
    document.getElementById("menuUsuario").classList.remove("mostrar");
    document.getElementById("passwordEliminarCuenta").value = "";
    document.getElementById("confirmacionEliminarCuenta").value = "";
    document.getElementById("errorEliminarCuenta").textContent = "";
    document.getElementById("modalMiCuenta").classList.add("mostrar");
}

function cerrarMiCuenta() {
    document.getElementById("modalMiCuenta").classList.remove("mostrar");
}

async function eliminarMiCuenta() {
    const password = document.getElementById("passwordEliminarCuenta").value;
    const confirmacion = document.getElementById("confirmacionEliminarCuenta").value.trim();
    const error = document.getElementById("errorEliminarCuenta");
    const boton = document.getElementById("botonEliminarCuenta");

    error.textContent = "";
    if (!password || confirmacion !== "ELIMINAR") {
        error.textContent = "Ingresá tu contraseña y escribí ELIMINAR para confirmar.";
        return;
    }

    boton.disabled = true;
    boton.textContent = "Eliminando...";

    try {
        const respuesta = await fetch(API + "/usuarios/me", {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                authorization: token()
            },
            body: JSON.stringify({ password, confirmacion })
        });
        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(datos.error || "No se pudo eliminar la cuenta.");
        }

        cerrarMiCuenta();
        localStorage.clear();
        sessionStorage.clear();
        clearTimeout(temporizadorInactividad);
        clearTimeout(temporizadorCierreInactividad);
        ocultarAvisoInactividad();
        document.getElementById("sistema").style.display = "none";
        document.getElementById("login").style.display = "block";
        mostrarNotificacion("Cuenta eliminada correctamente.");
    } catch (problema) {
        error.textContent = problema.message || "No se pudo eliminar la cuenta.";
    } finally {
        boton.disabled = false;
        boton.textContent = "Eliminar mi cuenta";
    }
}

function confirmarLogout() {

    localStorage.removeItem("logueado");
    sessionStorage.removeItem("logueado");
    localStorage.removeItem("token");
    localStorage.removeItem("usuarioId");
    localStorage.removeItem("usuario");
    localStorage.removeItem("email");
    clearTimeout(temporizadorInactividad);
    clearTimeout(temporizadorCierreInactividad);
    ocultarAvisoInactividad();

    if (salirAplicacion) {

        salirAplicacion = false;

        window.Capacitor?.Plugins?.App?.exitApp();

        return;
    }

    location.reload();

}
function cerrarModalAcciones() {
    const modal = document.getElementById("modalAcciones");

    if (modal) {
        modal.classList.remove("mostrar");
    }
}
configurarActualizacionPorDeslizamiento();
const usuarioRecordado = localStorage.getItem("usuarioRecordado") || "";
const emailRecordado = localStorage.getItem("emailRecordado") || "";
if (usuarioRecordado || emailRecordado) {
    usuario.value = usuarioRecordado;
    email.value = emailRecordado;
    document.getElementById("recordarme").checked = true;
}
if (new URLSearchParams(location.search).get("reset")) {
    document.getElementById("modalNuevaPassword").classList.add("mostrar");
}
async function generarPresupuestoIA(datos) {
    const urlIA = window.Capacitor?.isNativePlatform?.()
        ? API + "/ia/presupuesto"
        : "/ia/presupuesto";
    const response = await fetch(urlIA, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            authorization: token()
        },
        body: JSON.stringify({ descripcion: datos })
    });
    const esJson = response.headers.get("content-type")?.includes("application/json");
    const resultado = esJson ? await response.json() : null;

    if (!response.ok) {
        throw new Error(resultado?.error || "El servidor no devolvió una respuesta válida");
    }
    if (!resultado) {
        throw new Error("El servidor no devolvió una respuesta JSON válida");
    }

    return resultado;
}

function formatearMaterialesIA(materialesGenerados) {
    return materialesGenerados.map((material) => {
        const cantidad = Number(material.cantidad) || 0;
        const precioUnitario = Number(material.precioUnitario) || 0;
        const subtotal = Number(material.subtotal) || (cantidad * precioUnitario);
        return `- ${material.descripcion}: ${cantidad} x $${precioUnitario} = $${subtotal}`;
    }).join("\n");
}

async function generarPresupuestoConIA() {
    const descripcionIA = document.getElementById("descripcionIA");
    const botonGenerarIA = document.getElementById("botonGenerarIA");
    const descripcion = descripcionIA.value.trim();

    if (!descripcion) {
        mostrarNotificacion("Describí el trabajo antes de generar el presupuesto");
        descripcionIA.focus();
        return;
    }

    botonGenerarIA.disabled = true;
    botonGenerarIA.textContent = "Generando...";

    try {
        const presupuesto = await generarPresupuestoIA(descripcion);
        const materialesGenerados = Array.isArray(presupuesto.materiales) ? presupuesto.materiales : [];
        const totalMateriales = materialesGenerados.reduce((acumulado, material) => {
            const subtotal = Number(material.subtotal);
            const calculado = (Number(material.cantidad) || 0) * (Number(material.precioUnitario) || 0);
            return acumulado + (Number.isFinite(subtotal) ? subtotal : calculado);
        }, 0);

        trabajo.value = presupuesto.trabajo || "";
        materiales.value = totalMateriales;
        manoDeObra.value = Number(presupuesto.manoDeObra) || 0;
        observaciones.value = [
            presupuesto.observaciones,
            materialesGenerados.length ? `Materiales sugeridos:\n${formatearMaterialesIA(materialesGenerados)}` : ""
        ].filter(Boolean).join("\n\n");
        calcularTotal();
        mostrarNotificacion("Sugerencia generada. Revisá los importes antes de guardar.");
    } catch (error) {
        console.error("Error al generar la sugerencia de presupuesto:", error);
        mostrarNotificacion(error.message || "No se pudo generar el presupuesto");
    } finally {
        botonGenerarIA.disabled = false;
        botonGenerarIA.textContent = "Generar con IA";
    }
}
// --- EXPORTAR FUNCIONES AL HTML ---
// Esto permite que los onclick="" del HTML sigan funcionando como antes

window.login = login;
window.reenviarVerificacion = reenviarVerificacion;
window.entrarConBiometria = entrarConBiometria;
window.continuarSesion = continuarSesion;
window.cerrarSesionPorInactividad = cerrarSesionPorInactividad;
window.abrirRecuperarPassword = abrirRecuperarPassword;
window.cerrarRecuperarPassword = cerrarRecuperarPassword;
window.solicitarRecuperacionPassword = solicitarRecuperacionPassword;
window.restablecerPassword = restablecerPassword;
window.abrirRegistro = abrirRegistro;
window.cerrarRegistro = cerrarRegistro;
window.actualizarSeguridadRegistro = actualizarSeguridadRegistro;
window.actualizarUsuarioSugerido = actualizarUsuarioSugerido;
window.alternarVisibilidadPassword = alternarVisibilidadPassword;
window.registrarse = registrarse;
window.logout = logout;
window.guardarPresupuesto = guardarPresupuesto;
window.limpiarFormulario = limpiarFormulario;
window.cambiarEstado = cambiarEstado;
window.verDetalle = verDetalle;
window.editarPresupuesto = editarPresupuesto;
window.masAcciones = masAcciones;
window.exportarExcel = exportarExcel;
window.descargarBackup = descargarBackup;
window.descargarArchivoInvisible = descargarArchivoInvisible;
window.abrirImagen = abrirImagen;
window.mostrarFormularioGasto = mostrarFormularioGasto;
window.guardarGasto = guardarGasto;
window.eliminarGasto = eliminarGasto;
window.probarCapacitor = probarCapacitor;
window.toggleMenu = toggleMenu;
window.seleccionarTema = seleccionarTema;
window.cerrarModalLogout = cerrarModalLogout;
window.confirmarLogout = confirmarLogout;
window.abrirMiCuenta = abrirMiCuenta;
window.cerrarMiCuenta = cerrarMiCuenta;
window.eliminarMiCuenta = eliminarMiCuenta;
window.registrarPago = registrarPago;
window.confirmarCobro = confirmarCobro;
window.cerrarModalCobro = cerrarModalCobro;
window.cerrarModalConfirmacion = cerrarModalConfirmacion;
window.verHistorial = verHistorial;
window.descargarPDF = descargarPDF;
window.enviarWhatsApp = enviarWhatsApp;
window.cerrarModalAcciones = cerrarModalAcciones;
window.generarPresupuestoConIA = generarPresupuestoConIA;

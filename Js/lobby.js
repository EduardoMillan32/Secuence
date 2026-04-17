// Js/lobby.js

let miJugadorId = null;
let miJugadorRef = null;
let miJugador = { nombre: "", color: null, listo: false };
let jugadoresEnSala = [];
let juegoIniciadoVisualmente = false;

// NUEVO: Candado de seguridad para evitar el bucle infinito
let partidaIniciada = false; 

const salaRef = baseDatos.ref('sala_activa/jugadores');
const estadoJuegoRef = baseDatos.ref('sala_activa/estado');

const pantallaLogin = document.getElementById('pantalla-login');
const pantallaLobby = document.getElementById('pantalla-lobby');
const pantallaJuego = document.getElementById('pantalla-juego');
const btnListo = document.getElementById('btn-listo');
const mensajeValidacion = document.getElementById('mensaje-validacion');
const nombresEquiposRef = baseDatos.ref('sala_activa/nombresEquipos');
let nombresEquipos = { rojo: "Rojo", azul: "Azul", verde: "Verde" };

// Escuchamos si alguien cambia un nombre de equipo
nombresEquiposRef.on('value', (snapshot) => {
    if (snapshot.exists()) {
        nombresEquipos = snapshot.val();
    } else {
        // NUEVO: Si la base de datos se limpia, restauramos los valores por defecto
        nombresEquipos = { rojo: "Rojo", azul: "Azul", verde: "Verde" };
    }
    
    // Si ya elegí color y mi compañero cambió el nombre secreto...
    const spanEditable = document.getElementById('nombre-editable');
    if (spanEditable && miJugador.color && nombresEquipos[miJugador.color]) {
        // ...actualizo mi pantalla, PERO solo si no soy yo el que está escribiendo
        if (document.activeElement !== spanEditable) {
            spanEditable.innerText = nombresEquipos[miJugador.color];
        }
    }
});

function entrarLobby() {
    const nombre = document.getElementById('input-nombre').value.trim();
    if (nombre === "") return alert("Por favor ingresa un nombre válido.");
    
    miJugador.nombre = nombre;
    miJugadorRef = salaRef.push(); 
    miJugadorId = miJugadorRef.key; 
    miJugadorRef.set(miJugador);
    miJugadorRef.onDisconnect().remove().then(() => {
        baseDatos.ref('sala_activa/estado').onDisconnect().update({
            abandonado: true,
            nombreAbandono: miJugador.nombre
        });
    });

    pantallaLogin.classList.remove('activa');
    pantallaLogin.classList.add('oculta');
    pantallaLobby.classList.remove('oculta');
    pantallaLobby.classList.add('activa');
}

function seleccionarColor(color) {
    miJugador.color = color;
    btnListo.disabled = false; 
    
    // Si ya hay un nombre secreto lo usamos, si no, usamos la primera letra mayúscula del color
    const nombreDefault = color.charAt(0).toUpperCase() + color.slice(1);
    const nombreMostrar = nombresEquipos[color] || nombreDefault;

    const titulo = document.getElementById('titulo-equipo');
    titulo.innerHTML = `Equipo: <span id="nombre-editable" contenteditable="true" spellcheck="false" style="outline: none;">${nombreMostrar}</span>`;
    
    const spanEditable = document.getElementById('nombre-editable');
    spanEditable.addEventListener('input', function() {
        cambiarNombreEquipo(this.innerText);
    });

    if (miJugadorRef) miJugadorRef.set(miJugador);
    actualizarVistaLobby(); // Refrescamos nuestra lista local
}

function alternarListo() {
    miJugador.listo = !miJugador.listo;
    btnListo.innerText = miJugador.listo ? "Esperando a los demás..." : "Estoy Listo";
    btnListo.style.backgroundColor = miJugador.listo ? "#7f8c8d" : "#2ecc71";
    if (miJugadorRef) miJugadorRef.set(miJugador);
}

// A. Escuchar la Base de Datos
salaRef.on('value', (snapshot) => {
    jugadoresEnSala = []; 
    const datos = snapshot.val();
    
    if (datos) {
        Object.keys(datos).forEach(key => {
            let jugador = datos[key];
            if (jugador && jugador.nombre && jugador.nombre !== "undefined") {
                jugador.id = key; 
                jugadoresEnSala.push(jugador);
            }
        });
    } else {
        estadoJuegoRef.set(null);
        partidaIniciada = false; 
    }

    // --- NUEVO: EL CONSERJE AUTOMÁTICO ---
    // Si soy el ÚNICO jugador en la sala, significa que la sala estaba vacía antes de mí.
    // Por lo tanto, limpio toda la "basura" de juegos abandonados de Firebase.
    if (jugadoresEnSala.length === 1 && jugadoresEnSala[0].id === miJugadorId) {
        nombresEquiposRef.remove(); // Borra nombres como "Dinamita"
        estadoJuegoRef.set(null);   // Borra estados de partidas viejas
        tableroRef.set(null);       // Borra fichas atascadas
        baseDatos.ref('sala_activa/mazo').remove(); // Borra el mazo viejo
    }
    
    actualizarVistaLobby();
    verificarReglasParaIniciar(); 
});

// B. Actualizar Vista
function actualizarVistaLobby() {
    const lista = document.getElementById('lista-jugadores');
    lista.innerHTML = "";
    jugadoresEnSala.forEach(jugador => {
        const li = document.createElement('li');
        
        // LA MAGIA DEL SECRETO: Siempre mostramos el color original en la lista
        let colorPublico = 'Pensando...';
        if (jugador.color === 'rojo') colorPublico = 'Rojo';
        if (jugador.color === 'azul') colorPublico = 'Azul';
        if (jugador.color === 'verde') colorPublico = 'Verde';

        li.innerText = `${jugador.nombre} - Equipo: ${colorPublico} - ${jugador.listo ? '✅ LISTO' : '⏳ Esperando'}`;
        lista.appendChild(li);
    });
}

// C. Verificar Reglas e Iniciar
function verificarReglasParaIniciar() {
    // EL PARCHE: Si el candado está cerrado, ignora esta función y evita el bucle
    if (partidaIniciada) return; 

    const totalJugadores = jugadoresEnSala.length;
    if (totalJugadores === 0) return;

    const todosListos = jugadoresEnSala.every(j => j.listo);
    if (!todosListos) {
        mensajeValidacion.innerText = "Faltan jugadores por confirmar.";
        return;
    }

    let conteo = { rojo: 0, azul: 0, verde: 0 };
    jugadoresEnSala.forEach(j => { if(j.color) conteo[j.color]++; });
    const equiposActivos = Object.values(conteo).filter(cantidad => cantidad > 0);
    const numEquipos = equiposActivos.length;
    
    let juegoValido = false;
    if (numEquipos === 2) {
        if (totalJugadores % 2 === 0 && equiposActivos[0] === equiposActivos[1]) juegoValido = true;
        else mensajeValidacion.innerText = "Para 2 equipos, deben ser pares y estar equilibrados.";
    } else if (numEquipos === 3) {
        if (totalJugadores % 3 === 0 && equiposActivos[0] === equiposActivos[1] && equiposActivos[1] === equiposActivos[2]) juegoValido = true;
        else mensajeValidacion.innerText = "Para 3 equipos, deben tener la misma cantidad.";
    } else {
        mensajeValidacion.innerText = "Debe haber al menos 2 equipos para jugar.";
    }

    if (juegoValido) {
        mensajeValidacion.innerText = "¡Todo listo! Iniciando partida...";
        
        if (jugadoresEnSala[0].id === miJugadorId) {
            console.log("Soy el Anfitrión. Organizando turnos y repartiendo...");
            
            partidaIniciada = true; 
            tableroRef.set(null); 
            
            // --- NUEVO: CREAR ORDEN DE TURNOS INTERCALADO ---
            let verdes = jugadoresEnSala.filter(j => j.color === 'verde');
            let azules = jugadoresEnSala.filter(j => j.color === 'azul');
            let rojos = jugadoresEnSala.filter(j => j.color === 'rojo');
            
            let ordenTurnos = [];
            // Calculamos cuántos jugadores hay por equipo (serán iguales por la validación previa)
            let maxPorEquipo = Math.max(verdes.length, azules.length, rojos.length);
            
            for (let i = 0; i < maxPorEquipo; i++) {
                // Orden solicitado: Verde -> Azul -> Rojo
                if (verdes[i]) ordenTurnos.push(verdes[i].id);
                if (azules[i]) ordenTurnos.push(azules[i].id);
                if (rojos[i]) ordenTurnos.push(rojos[i].id);
            }

            // --- NUEVO: ELEGIR INICIO ALEATORIO ---
            let indiceAleatorio = Math.floor(Math.random() * ordenTurnos.length);
            let primerTurnoId = ordenTurnos[indiceAleatorio];

            inicializarReglas(totalJugadores, numEquipos);
            let mazoMaestro = obtenerMazoBarajado(); 

            jugadoresEnSala.forEach(jugador => {
                let mano = [];
                for(let i = 0; i < configuracionJuego.cartasPorJugador; i++) {
                    mano.push(mazoMaestro.pop()); 
                }
                baseDatos.ref(`sala_activa/jugadores/${jugador.id}`).update({ mano: mano });
            });

            baseDatos.ref('sala_activa/mazo').set(mazoMaestro);
            
            // Guardamos la lista oficial de turnos en Firebase
            estadoJuegoRef.set({
                iniciado: true,
                jugadoresTotales: totalJugadores,
                equiposTotales: numEquipos,
                turnoActual: primerTurnoId, // El ID elegido al azar
                ordenTurnos: ordenTurnos,     // La lista intercalada
                marcaTiempo: Date.now() 
            });
        }
    }
}

// D. Escuchar Inicio y Victorias
estadoJuegoRef.on('value', (snapshot) => {
    const estado = snapshot.val();
    if (miJugador.nombre === "") return; 

    // Referencias a los nuevos bloques de la mano
    const bloqueCartas = document.getElementById('interfaz-cartas');
    const bloqueVictoria = document.getElementById('interfaz-victoria-mano');

    if (estado && estado.abandonado) {
        bloqueCartas.classList.add('oculta');
        bloqueVictoria.classList.remove('oculta');
        
        document.getElementById('texto-victoria-mano').innerText = 
            `PARTIDA TERMINADA: ${estado.nombreAbandono} abandonó la sala. 🚪`;
        
        const btnRevancha = document.getElementById('btn-revancha');
        btnRevancha.innerText = "Volver al Lobby principal";
        btnRevancha.disabled = false; // Todos pueden volver si alguien se fue
        return;
    }
    
    // 1. CONDICIÓN DE REINICIO/LOBBY (Cuando el anfitrión resetea el juego)
    if (!estado || !estado.iniciado) {
        if (juegoIniciadoVisualmente) {
            juegoIniciadoVisualmente = false;
            partidaIniciada = false;
            
            // Restauramos la interfaz de la mano
            bloqueCartas.classList.remove('oculta');
            bloqueVictoria.classList.add('oculta');
            
            // Regresamos físicamente al lobby
            pantallaJuego.classList.remove('activa');
            pantallaJuego.classList.add('oculta');
            pantallaLobby.classList.remove('oculta');
            pantallaLobby.classList.add('activa');
            
            if (miJugadorRef) miJugadorRef.update({ listo: false });
        }
        return;
    }

    // 2. CONDICIÓN DE VICTORIA: ¡Aquí ocurre la magia!
    if (estado.victoria) {
        // Ocultamos las cartas pero nos quedamos en el tablero
        bloqueCartas.classList.add('oculta');
        
        // Mostramos el mensaje de ganador y el botón de revancha
        bloqueVictoria.classList.remove('oculta');
        const nombreGanador = nombresEquipos[estado.victoria] || estado.victoria;
        document.getElementById('texto-victoria-mano').innerText = `¡GANA EL EQUIPO ${nombreGanador.toUpperCase()}! 🎉`;
        
        // Solo el anfitrión puede ver el botón de revancha activo (opcional)
        const btnRevancha = document.getElementById('btn-revancha');
        if (jugadoresEnSala[0].id !== miJugadorId) {
            btnRevancha.innerText = "Esperando al anfitrión...";
            btnRevancha.disabled = true;
        } else {
            btnRevancha.innerText = "Volver al Lobby para Revancha 🔄";
            btnRevancha.disabled = false;
        }
        return; 
    }
    
    // 3. INICIO NORMAL (Igual que antes)
    if (estado.iniciado === true && !juegoIniciadoVisualmente) {
        partidaIniciada = true; 
        juegoIniciadoVisualmente = true;
        reiniciarEstadoJuegoLocal(); 
        inicializarReglas(estado.jugadoresTotales, estado.equiposTotales);
        inicializarManoFirebase();

        setTimeout(() => {
            pantallaLobby.classList.add('oculta');
            pantallaJuego.classList.remove('oculta');
            pantallaJuego.classList.add('activa');
        }, 1000);
    }
});

window.volverAlLobby = function() {
    if (jugadoresEnSala[0].id === miJugadorId) {
        estadoJuegoRef.set(null); // Esto gatilla la condición 1 de arriba para todos
        tableroRef.set(null);
        nombresEquiposRef.remove();
        baseDatos.ref('sala_activa/mazo').set(null);
        jugadoresEnSala.forEach(j => {
             baseDatos.ref(`sala_activa/jugadores/${j.id}/mano`).remove();
        });
    }
}

window.cambiarNombreEquipo = function(nuevoNombre) {
    if (!miJugador.color || nuevoNombre.trim() === "") return;
    
    // Solo actualizamos el nombre de NUESTRO equipo
    nombresEquiposRef.child(miJugador.color).set(nuevoNombre.trim());
};
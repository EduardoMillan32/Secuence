// Js/lobby.js

let miJugadorId = null;
let miJugadorRef = null;
let miJugador = { nombre: "", color: null, listo: false };
let jugadoresEnSala = [];
let juegoIniciadoVisualmente = false;
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

nombresEquiposRef.on('value', (snapshot) => {
    if (snapshot.exists()) {
        nombresEquipos = snapshot.val();
    } else {
        nombresEquipos = { rojo: "Rojo", azul: "Azul", verde: "Verde" };
    }
    
    const spanEditable = document.getElementById('nombre-editable');
    if (spanEditable && miJugador.color && nombresEquipos[miJugador.color]) {
        if (document.activeElement !== spanEditable) {
            spanEditable.innerText = nombresEquipos[miJugador.color];
        }
    }
});

function entrarLobby() {
    const nombre = document.getElementById('input-nombre').value.trim();
    // MEJORA: Usamos Toast en lugar de Alert
    if (nombre === "") return mostrarToast("Por favor ingresa un nombre válido.", "warning");
    
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
    
    const nombreDefault = color.charAt(0).toUpperCase() + color.slice(1);
    const nombreMostrar = nombresEquipos[color] || nombreDefault;

    const titulo = document.getElementById('titulo-equipo');
    titulo.innerHTML = `Equipo: <span id="nombre-editable" contenteditable="true" spellcheck="false" style="outline: none;">${nombreMostrar}</span>`;
    
    const spanEditable = document.getElementById('nombre-editable');
    spanEditable.addEventListener('input', function() {
        cambiarNombreEquipo(this.innerText);
    });

    // MEJORA: Resaltar visualmente el botón seleccionado
    document.querySelectorAll('.btn-color').forEach(btn => btn.classList.remove('color-activo'));
    document.querySelector('.btn-color.' + color).classList.add('color-activo');

    if (miJugadorRef) miJugadorRef.set(miJugador);
    actualizarVistaLobby(); 
}

function alternarListo() {
    miJugador.listo = !miJugador.listo;
    btnListo.innerText = miJugador.listo ? "Esperando a los demás..." : "Estoy Listo";
    btnListo.style.backgroundColor = miJugador.listo ? "#7f8c8d" : "#2ecc71";
    if (miJugadorRef) miJugadorRef.set(miJugador);
}

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

    if (jugadoresEnSala.length === 1 && jugadoresEnSala[0].id === miJugadorId) {
        nombresEquiposRef.remove(); 
        estadoJuegoRef.set(null);   
        tableroRef.set(null);       
        baseDatos.ref('sala_activa/mazo').remove(); 
    }
    
    actualizarVistaLobby();
    verificarReglasParaIniciar(); 
});

function actualizarVistaLobby() {
    const lista = document.getElementById('lista-jugadores');
    lista.innerHTML = "";
    jugadoresEnSala.forEach(jugador => {
        const li = document.createElement('li');
        
        let colorPublico = 'Pensando...';
        // MEJORA: Añadimos emojis indicativos a la lista
        if (jugador.color === 'rojo') colorPublico = '🔴 Rojo';
        if (jugador.color === 'azul') colorPublico = '🔵 Azul';
        if (jugador.color === 'verde') colorPublico = '🟢 Verde';

        li.innerText = `${jugador.nombre} - Equipo: ${colorPublico} - ${jugador.listo ? '✅ LISTO' : '⏳ Esperando'}`;
        lista.appendChild(li);
    });
}

function verificarReglasParaIniciar() {
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
            
            let verdes = jugadoresEnSala.filter(j => j.color === 'verde');
            let azules = jugadoresEnSala.filter(j => j.color === 'azul');
            let rojos = jugadoresEnSala.filter(j => j.color === 'rojo');
            
            let ordenTurnos = [];
            let maxPorEquipo = Math.max(verdes.length, azules.length, rojos.length);
            
            for (let i = 0; i < maxPorEquipo; i++) {
                if (verdes[i]) ordenTurnos.push(verdes[i].id);
                if (azules[i]) ordenTurnos.push(azules[i].id);
                if (rojos[i]) ordenTurnos.push(rojos[i].id);
            }

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
            
            estadoJuegoRef.set({
                iniciado: true,
                jugadoresTotales: totalJugadores,
                equiposTotales: numEquipos,
                turnoActual: primerTurnoId,
                ordenTurnos: ordenTurnos,
                marcaTiempo: Date.now() 
            });
        }
    }
}

estadoJuegoRef.on('value', (snapshot) => {
    const estado = snapshot.val();
    if (miJugador.nombre === "") return; 

    const bloqueCartas = document.getElementById('interfaz-cartas');
    const bloqueVictoria = document.getElementById('interfaz-victoria-mano');

    if (estado && estado.abandonado) {
        bloqueCartas.classList.add('oculta');
        bloqueVictoria.classList.remove('oculta');
        
        document.getElementById('texto-victoria-mano').innerText = 
            `PARTIDA TERMINADA: ${estado.nombreAbandono} abandonó la sala. 🚪`;
        
        const btnRevancha = document.getElementById('btn-revancha');
        btnRevancha.innerText = "Volver al Lobby principal";
        btnRevancha.disabled = false; 
        return;
    }
    
    if (!estado || !estado.iniciado) {
        if (juegoIniciadoVisualmente) {
            juegoIniciadoVisualmente = false;
            partidaIniciada = false;
            
            bloqueCartas.classList.remove('oculta');
            bloqueVictoria.classList.add('oculta');
            
            pantallaJuego.classList.remove('activa');
            pantallaJuego.classList.add('oculta');
            pantallaLobby.classList.remove('oculta');
            pantallaLobby.classList.add('activa');
            
            if (miJugadorRef) miJugadorRef.update({ listo: false });
        }
        return;
    }

    if (estado.victoria) {
        bloqueCartas.classList.add('oculta');
        bloqueVictoria.classList.remove('oculta');
        
        const nombreGanador = nombresEquipos[estado.victoria] || estado.victoria;
        document.getElementById('texto-victoria-mano').innerText = `¡GANA EL EQUIPO ${nombreGanador.toUpperCase()}! 🎉`;
        
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
        estadoJuegoRef.set(null); 
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
    nombresEquiposRef.child(miJugador.color).set(nuevoNombre.trim());
};
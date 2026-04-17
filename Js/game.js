// Js/game.js
const TAMANO_TABLERO = 10;
let secuenciasLogradas = { roja: 0, azul: 0, verde: 0 };

// NUEVAS VARIABLES MULTIJUGADOR
const tableroRef = baseDatos.ref('sala_activa/tablero');
let turnoActualId = null;
let miTurno = false;
let listaOrdenTurnos = [];

// Escuchamos la lista oficial de turnos que generó el anfitrión
baseDatos.ref('sala_activa/estado/ordenTurnos').on('value', (snapshot) => {
    listaOrdenTurnos = snapshot.val() || [];
});

// 1. ESCUCHAR DE QUIÉN ES EL TURNO
baseDatos.ref('sala_activa/estado/turnoActual').on('value', (snapshot) => {
    turnoActualId = snapshot.val();
    miTurno = (turnoActualId === miJugadorId);
    
    // Efecto visual en la caja de la mano para saber de quién es el turno
    const manoElement = document.getElementById('mano-jugador');
    const tituloMano = manoElement.querySelector('h3');
    
    if (miTurno) {
        manoElement.style.borderColor = "#2ecc71"; // Borde verde
        manoElement.style.boxShadow = "0 0 15px #2ecc71";
        tituloMano.innerText = "Tu Mano (¡ES TU TURNO!)";
    } else {
        manoElement.style.borderColor = "#e74c3c"; // Borde rojo
        manoElement.style.boxShadow = "none";
        
        // Buscamos el nombre del jugador que está pensando
        let jugadorTurno = jugadoresEnSala.find(j => j.id === turnoActualId);
        let nombreTurno = jugadorTurno ? jugadorTurno.nombre : "el oponente";
        tituloMano.innerText = `Esperando a ${nombreTurno}...`;
    }
});

// 2. ESCUCHAR EL TABLERO (Cuando alguien pone una ficha)
tableroRef.on('child_added', (snapshot) => {
    const indice = snapshot.key;
    const color = snapshot.val();
    colocarFichaVisual(indice, color);
    verificarSequence(color); // Validamos si ese movimiento formó un sequence
});

// 3. ESCUCHAR EL TABLERO (Cuando alguien quita una ficha con un Jack)
tableroRef.on('child_removed', (snapshot) => {
    const indice = snapshot.key;
    quitarFichaVisual(indice);
});

// Función de apoyo para el anfitrión en el lobby
function obtenerMazoBarajado() {
    let mazoNuevo = [];
    const palos = ['S', 'H', 'D', 'C']; 
    const valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Q', 'K'];
    
    palos.forEach(palo => {
        valores.forEach(valor => mazoNuevo.push(valor + palo));
    });

    const jacksEspeciales = ['J1S', 'J1H', 'J1D', 'J1C', 'J2S', 'J2H', 'J2D', 'J2C'];
    mazoNuevo = [...mazoNuevo, ...mazoNuevo, ...jacksEspeciales, ...jacksEspeciales];
    
    for (let i = mazoNuevo.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mazoNuevo[i], mazoNuevo[j]] = [mazoNuevo[j], mazoNuevo[i]];
    }
    return mazoNuevo;
}

// 4. LÓGICA DEL JUEGO: INTENTAR PONER FICHA
function intentarPonerFicha(indiceTablero, cartaTablero) {
    if (!miTurno) return alert("¡Paciencia! Aún no es tu turno.");
    if (cartaSeleccionadaIdx === null) return alert("¡Primero selecciona una carta de tu mano!");

    const cartaEnMano = manoPropia[cartaSeleccionadaIdx];
    const casillas = document.querySelectorAll('.casilla');
    const casillaActual = casillas[indiceTablero];
    const tieneFicha = casillaActual.querySelector('.ficha');

    if (cartaTablero === "LIBRE") return alert("Las esquinas son comodines para todos.");

    if (cartaEnMano.startsWith("J2")) {
        if (tieneFicha) {
            if (casillaActual.classList.contains('protegida')) {
                alert("No puedes quitar una ficha de un Sequence ya completado.");
            } else {
                tableroRef.child(indiceTablero).remove(); 
                actualizarManoTrasJugada(); // (pasarTurno ya no está aquí)
            }
        } else {
            alert("Usa el Jack sobre una ficha del oponente.");
        }
        return;
    }

    if (tieneFicha) return alert("Esta casilla ya está ocupada.");

    let jugadaValida = (cartaEnMano === cartaTablero || cartaEnMano.startsWith("J1"));

    if (jugadaValida) {
        tableroRef.child(indiceTablero).set(miJugador.color); 
        actualizarManoTrasJugada(); // (pasarTurno ya no está aquí)
    } else {
        alert("Esa carta no coincide con esta casilla.");
    }
}

// ==========================================
// FUNCIONES VISUALES (Las que obedecen a Firebase)
// ==========================================
function colocarFichaVisual(indice, color) {
    const casillas = document.querySelectorAll('.casilla');
    const ficha = document.createElement('div');
    ficha.classList.add('ficha', `ficha-${color}`); 
    casillas[indice].appendChild(ficha);
}

function quitarFichaVisual(indice) {
    const casillas = document.querySelectorAll('.casilla');
    const ficha = casillas[indice].querySelector('.ficha');
    if (ficha) casillas[indice].removeChild(ficha);
}

// ==========================================
// SISTEMA DE CARTAS Y TURNOS EN LA NUBE
// ==========================================
function actualizarManoTrasJugada() {
    // Quitamos la carta usada
    manoPropia.splice(cartaSeleccionadaIdx, 1);
    cartaSeleccionadaIdx = null;

    // Pedimos carta nueva a la nube
    baseDatos.ref('sala_activa/mazo').once('value').then((snapshot) => {
        let mazoActual = snapshot.val() || [];
        if (mazoActual.length > 0) {
            manoPropia.push(mazoActual.pop());
            baseDatos.ref('sala_activa/mazo').set(mazoActual); 
        }
        
        // Guardamos la mano en la nube...
        miJugadorRef.child('mano').set(manoPropia).then(() => {
            // ¡AHORA SÍ! Una vez que nuestra mano está a salvo en la nube, pasamos el turno
            pasarTurno();
        });
    });
}

function pasarTurno() {
    // Buscamos nuestra posición en la lista oficial de turnos
    let indiceActual = listaOrdenTurnos.indexOf(miJugadorId);
    
    // El siguiente es el que sigue en la lista (si llegamos al final, vuelve al 0)
    let siguienteIndice = (indiceActual + 1) % listaOrdenTurnos.length;
    let siguienteJugadorId = listaOrdenTurnos[siguienteIndice];
    
    // Le avisamos a Firebase de quién es el nuevo turno
    baseDatos.ref('sala_activa/estado/turnoActual').set(siguienteJugadorId);
}

// ==========================================
// VALIDACIÓN DE VICTORIA (La matemática se queda igual)
// ==========================================
function verificarSequence(colorJugador) {
    const casillas = document.querySelectorAll('.casilla');
    const esDelJugador = (indice) => {
        const c = casillas[indice];
        return c.querySelector(`.ficha-${colorJugador}`) || mapaCartas[indice] === "LIBRE"; 
    };

    for (let f = 0; f < TAMANO_TABLERO; f++) {
        for (let c = 0; c <= TAMANO_TABLERO - 5; c++) {
            let combo = [];
            for (let i = 0; i < 5; i++) combo.push(f * TAMANO_TABLERO + (c + i));
            if (combo.every(esDelJugador)) marcarSequence(combo, colorJugador);
        }
    }
    for (let c = 0; c < TAMANO_TABLERO; c++) {
        for (let f = 0; f <= TAMANO_TABLERO - 5; f++) {
            let combo = [];
            for (let i = 0; i < 5; i++) combo.push((f + i) * TAMANO_TABLERO + c);
            if (combo.every(esDelJugador)) marcarSequence(combo, colorJugador);
        }
    }
    for (let f = 0; f <= TAMANO_TABLERO - 5; f++) {
        for (let c = 0; c <= TAMANO_TABLERO - 5; c++) {
            let combo = [];
            for (let i = 0; i < 5; i++) combo.push((f + i) * TAMANO_TABLERO + (c + i));
            if (combo.every(esDelJugador)) marcarSequence(combo, colorJugador);
        }
    }
    for (let f = 0; f <= TAMANO_TABLERO - 5; f++) {
        for (let c = 4; c < TAMANO_TABLERO; c++) {
            let combo = [];
            for (let i = 0; i < 5; i++) combo.push((f + i) * TAMANO_TABLERO + (c - i));
            if (combo.every(esDelJugador)) marcarSequence(combo, colorJugador);
        }
    }
}

function marcarSequence(indices, colorJugador) {
    const casillas = document.querySelectorAll('.casilla');
    let fichasNuevasParaSequence = 0;

    // CORRECCIÓN: Ahora buscamos 'protegida-rojo' con "o"
    indices.forEach(indice => {
        if (!casillas[indice].classList.contains('protegida-rojo') &&
            !casillas[indice].classList.contains('protegida-azul') &&
            !casillas[indice].classList.contains('protegida-verde')) {
            fichasNuevasParaSequence++;
        }
    });

    if (fichasNuevasParaSequence === 5 || fichasNuevasParaSequence === 4) {
        indices.forEach(indice => {
            casillas[indice].classList.add(`protegida-${colorJugador}`);
        });

        secuenciasLogradas[colorJugador]++;

        if (secuenciasLogradas[colorJugador] >= configuracionJuego.sequencesParaGanar) {
            // 1. Cancelamos la orden de abandono para que no salte el aviso al salir
            baseDatos.ref('sala_activa/estado').onDisconnect().cancel();
            
            // 2. Registramos la victoria legal en Firebase
            baseDatos.ref('sala_activa/estado/victoria').set(colorJugador);
        }

        console.log(`¡Sequence REAL completado para equipo ${colorJugador}! Total: ${secuenciasLogradas[colorJugador]}`);

        if (secuenciasLogradas[colorJugador] >= configuracionJuego.sequencesParaGanar) {
            baseDatos.ref('sala_activa/estado/victoria').set(colorJugador);
        }
    }
}

// Función para limpiar el tablero visualmente y reiniciar marcadores
function reiniciarEstadoJuegoLocal() {
    // 1. Reiniciar contadores de secuencias
    secuenciasLogradas = { roja: 0, azul: 0, verde: 0 };
    
    // 2. Limpiar el tablero visual (reutilizamos la función de tablero.js)
    if (typeof generarTablero === 'function') {
        generarTablero();
    }
    
    console.log("Tablero visual y puntuaciones reiniciadas.");
}

function descartarYRobarSinPasarTurno() {
    // Quitamos la carta muerta de la mano
    manoPropia.splice(cartaSeleccionadaIdx, 1);
    cartaSeleccionadaIdx = null;

    // Pedimos carta nueva a la nube
    baseDatos.ref('sala_activa/mazo').once('value').then((snapshot) => {
        let mazoActual = snapshot.val() || [];
        if (mazoActual.length > 0) {
            manoPropia.push(mazoActual.pop());
            baseDatos.ref('sala_activa/mazo').set(mazoActual); 
        }
        
        // Guardamos la mano en la nube...
        miJugadorRef.child('mano').set(manoPropia).then(() => {
            // IMPORTANTE: ¡Aquí NO pasamos el turno! Simplemente actualizamos la vista
            renderizarMano();
        });
    });
}

window.intentarDescartarCartaMuerta = function() {
    if (!miTurno) return alert("¡Paciencia! Aún no es tu turno.");
    if (cartaSeleccionadaIdx === null) return alert("Selecciona la carta que quieres descartar.");

    const cartaEnMano = manoPropia[cartaSeleccionadaIdx];
    if (cartaEnMano.startsWith("J")) return alert("Los Jacks son comodines, nunca pueden ser cartas muertas.");

    const casillas = document.querySelectorAll('.casilla');
    let indicesCarta = [];
    
    // Buscamos las casillas que corresponden a esa carta
    casillas.forEach((casilla, index) => {
        if (casilla.dataset.carta === cartaEnMano) indicesCarta.push(index);
    });

    // Contamos cuántas de esas casillas ya tienen ficha
    let ocupadas = 0;
    indicesCarta.forEach(indice => {
        if (casillas[indice].querySelector('.ficha')) ocupadas++;
    });

    // Validamos la regla matemática de las cartas muertas
    if (ocupadas === indicesCarta.length && indicesCarta.length > 0) {
        alert("¡Efectivamente! Es una carta muerta. Toma una nueva y continúa con tu turno.");
        
        // ¡Usamos la nueva función que no pasa el turno!
        descartarYRobarSinPasarTurno(); 
        
    } else {
        alert("Esta carta NO es una carta muerta. Aún hay espacios libres en el tablero para ella.");
    }
};
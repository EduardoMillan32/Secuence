// Js/game.js
const TAMANO_TABLERO = 10;

let secuenciasLogradas = { rojo: 0, azul: 0, verde: 0 };

const tableroRef = baseDatos.ref('sala_activa/tablero');
let turnoActualId = null;
let miTurno = false;
let listaOrdenTurnos = [];

baseDatos.ref('sala_activa/estado/ordenTurnos').on('value', (snapshot) => {
    listaOrdenTurnos = snapshot.val() || [];
});

baseDatos.ref('sala_activa/estado/turnoActual').on('value', (snapshot) => {
    turnoActualId = snapshot.val();
    miTurno = (turnoActualId === miJugadorId);
    
    const manoElement = document.getElementById('mano-jugador');
    const tituloMano = manoElement.querySelector('h3');
    
    // MEJORA VISUAL: Usamos clases CSS para transiciones suaves en los turnos
    if (miTurno) {
        manoElement.classList.add('mi-turno');
        manoElement.classList.remove('esperando-turno');
        tituloMano.innerText = "Tu Mano (¡ES TU TURNO!)";
    } else {
        manoElement.classList.remove('mi-turno');
        manoElement.classList.add('esperando-turno');
        
        let jugadorTurno = jugadoresEnSala.find(j => j.id === turnoActualId);
        let nombreTurno = jugadorTurno ? jugadorTurno.nombre : "el oponente";
        tituloMano.innerText = `Esperando a ${nombreTurno}...`;
    }
});

tableroRef.on('child_added', (snapshot) => {
    const indice = snapshot.key;
    const color = snapshot.val();
    colocarFichaVisual(indice, color);
    verificarSequence(color);
});

tableroRef.on('child_removed', (snapshot) => {
    const indice = snapshot.key;
    quitarFichaVisual(indice);
});

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

function intentarPonerFicha(indiceTablero, cartaTablero) {
    // REEMPLAZO DE ALERTS POR TOASTS
    if (!miTurno) return mostrarToast("¡Paciencia! Aún no es tu turno.", "warning");
    if (cartaSeleccionadaIdx === null) return mostrarToast("¡Primero selecciona una carta de tu mano!", "warning");

    const cartaEnMano = manoPropia[cartaSeleccionadaIdx];
    const casillas = document.querySelectorAll('.casilla');
    const casillaActual = casillas[indiceTablero];
    const tieneFicha = casillaActual.querySelector('.ficha');

    if (cartaTablero === "LIBRE") return mostrarToast("Las esquinas son comodines para todos.", "info");

    if (cartaEnMano.startsWith("J2")) {
        if (tieneFicha) {
            if (casillaActual.classList.contains('protegida-rojo') || 
                casillaActual.classList.contains('protegida-azul') || 
                casillaActual.classList.contains('protegida-verde')) {
                mostrarToast("No puedes quitar una ficha de un Sequence ya completado.", "error");
            } else {
                tableroRef.child(indiceTablero).remove(); 
                actualizarManoTrasJugada(); 
            }
        } else {
            mostrarToast("Usa el Jack sobre una ficha del oponente.", "warning");
        }
        return;
    }

    if (tieneFicha) return mostrarToast("Esta casilla ya está ocupada.", "warning");

    let jugadaValida = (cartaEnMano === cartaTablero || cartaEnMano.startsWith("J1"));

    if (jugadaValida) {
        tableroRef.child(indiceTablero).set(miJugador.color); 
        actualizarManoTrasJugada(); 
    } else {
        mostrarToast("Esa carta no coincide con esta casilla.", "error");
    }
}

function colocarFichaVisual(indice, color) {
    const casillas = document.querySelectorAll('.casilla');
    if (casillas[indice].querySelector('.ficha')) return; // Evita duplicados visuales

    const ficha = document.createElement('div');
    ficha.classList.add('ficha', `ficha-${color}`); 
    
    // MEJORA: Animación de rebote al colocar ficha
    ficha.style.transform = 'scale(0)';
    casillas[indice].appendChild(ficha);
    
    requestAnimationFrame(() => {
        ficha.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        ficha.style.transform = 'scale(1)';
    });
}

function quitarFichaVisual(indice) {
    const casillas = document.querySelectorAll('.casilla');
    const ficha = casillas[indice].querySelector('.ficha');
    if (ficha) {
        // MEJORA: Animación de desvanecimiento al quitar ficha con Jack
        ficha.style.transition = 'transform 0.2s ease-in, opacity 0.2s ease-in';
        ficha.style.transform = 'scale(0)';
        ficha.style.opacity = '0';
        ficha.addEventListener('transitionend', () => ficha.remove());
    }
}

function actualizarManoTrasJugada() {
    manoPropia.splice(cartaSeleccionadaIdx, 1);
    cartaSeleccionadaIdx = null;

    baseDatos.ref('sala_activa/mazo').transaction((mazoActual) => {
        if (mazoActual && mazoActual.length > 0) {
            let cartaRobada = mazoActual.pop();
            manoPropia.push(cartaRobada);
            return mazoActual;
        }
        return mazoActual;
    }).then(() => {
        miJugadorRef.child('mano').set(manoPropia).then(() => {
            pasarTurno();
        });
    });
}

function pasarTurno() {
    let indiceActual = listaOrdenTurnos.indexOf(miJugadorId);
    let siguienteIndice = (indiceActual + 1) % listaOrdenTurnos.length;
    let siguienteJugadorId = listaOrdenTurnos[siguienteIndice];
    baseDatos.ref('sala_activa/estado/turnoActual').set(siguienteJugadorId);
}

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
            baseDatos.ref('sala_activa/estado').onDisconnect().cancel();
            baseDatos.ref('sala_activa/estado/victoria').set(colorJugador);
        }

        console.log(`¡Sequence REAL completado para equipo ${colorJugador}! Total: ${secuenciasLogradas[colorJugador]}`);
    }
}

function reiniciarEstadoJuegoLocal() {
    secuenciasLogradas = { rojo: 0, azul: 0, verde: 0 };
    if (typeof generarTablero === 'function') generarTablero();
}

function descartarYRobarSinPasarTurno() {
    manoPropia.splice(cartaSeleccionadaIdx, 1);
    cartaSeleccionadaIdx = null;

    baseDatos.ref('sala_activa/mazo').transaction((mazoActual) => {
        if (mazoActual && mazoActual.length > 0) {
            let cartaRobada = mazoActual.pop();
            manoPropia.push(cartaRobada);
            return mazoActual;
        }
        return mazoActual;
    }).then(() => {
        miJugadorRef.child('mano').set(manoPropia).then(() => {
            renderizarMano();
        });
    });
}

window.intentarDescartarCartaMuerta = function() {
    if (!miTurno) return mostrarToast("¡Paciencia! Aún no es tu turno.", "warning");
    if (cartaSeleccionadaIdx === null) return mostrarToast("Selecciona la carta que quieres descartar.", "warning");

    const cartaEnMano = manoPropia[cartaSeleccionadaIdx];
    if (cartaEnMano.startsWith("J")) return mostrarToast("Los Jacks son comodines, nunca pueden ser cartas muertas.", "info");

    const casillas = document.querySelectorAll('.casilla');
    let indicesCarta = [];
    
    casillas.forEach((casilla, index) => {
        if (casilla.dataset.carta === cartaEnMano) indicesCarta.push(index);
    });

    let ocupadas = 0;
    indicesCarta.forEach(indice => {
        if (casillas[indice].querySelector('.ficha')) ocupadas++;
    });

    if (ocupadas === indicesCarta.length && indicesCarta.length > 0) {
        mostrarToast("¡Efectivamente! Es una carta muerta. Toma una nueva y continúa con tu turno.", "success");
        descartarYRobarSinPasarTurno(); 
    } else {
        mostrarToast("Esta carta NO es una carta muerta. Aún hay espacios libres en el tablero para ella.", "error");
    }
};
// Js/jugador.js

let manoPropia = [];
let cartaSeleccionadaIdx = null; 
const contenedorMano = document.getElementById('contenedor-cartas');

// Se conecta a TU bolsillo en Firebase y vigila tus cartas
function inicializarManoFirebase() {
    miJugadorRef.child('mano').on('value', (snapshot) => {
        if(snapshot.exists()) {
            manoPropia = snapshot.val();
        } else {
            manoPropia = [];
        }
        renderizarMano(); // Cada vez que Firebase detecte un cambio en tus cartas, redibuja tu mano
    });
}

function renderizarMano() {
    contenedorMano.innerHTML = "";
    
    manoPropia.forEach((carta, index) => {
        const contenedorCarta = document.createElement('div');
        // MEJORA: Clase añadida para compatibilidad con el nuevo CSS responsivo
        contenedorCarta.classList.add('contenedor-carta-individual'); 

        const imgCarta = document.createElement('img');
        
        let codigoAPI = carta;
        if (carta.startsWith("10")) codigoAPI = "0" + carta[2];
        if (carta.startsWith("J")) codigoAPI = carta.substring(0, 1) + carta.substring(2);

        imgCarta.src = `https://deckofcardsapi.com/static/img/${codigoAPI}.png`;
        imgCarta.classList.add('carta-mano');
        
        // MEJORA: Rendimiento y experiencia de usuario en móviles
        imgCarta.loading = 'lazy'; 
        imgCarta.draggable = false;
        
        if (index === cartaSeleccionadaIdx) {
            imgCarta.classList.add('carta-seleccionada');
        }

        if (carta.startsWith("J1")) {
            const etiqueta = document.createElement('span');
            etiqueta.innerText = "➕ 2 OJOS";
            etiqueta.classList.add('etiqueta-jack', 'jack-add');
            contenedorCarta.appendChild(etiqueta);
        } else if (carta.startsWith("J2")) {
            const etiqueta = document.createElement('span');
            etiqueta.innerText = "❌ 1 OJO";
            etiqueta.classList.add('etiqueta-jack', 'jack-remove');
            contenedorCarta.appendChild(etiqueta);
        }

        imgCarta.onclick = () => seleccionarCarta(index);
        
        contenedorCarta.appendChild(imgCarta);
        contenedorMano.appendChild(contenedorCarta);
    });
}

function seleccionarCarta(index) {
    cartaSeleccionadaIdx = (cartaSeleccionadaIdx === index) ? null : index;
    renderizarMano();
}

window.abrirReglas = function() {
    // Inserta dinámicamente cuántos sequences se necesitan
    document.getElementById('regla-victoria-dinamica').innerText = configuracionJuego.sequencesParaGanar;
    document.getElementById('modal-reglas').classList.remove('oculta-modal');
    document.getElementById('modal-reglas').style.display = 'flex';
};

window.cerrarReglas = function() {
    document.getElementById('modal-reglas').classList.add('oculta-modal');
    document.getElementById('modal-reglas').style.display = 'none';
};
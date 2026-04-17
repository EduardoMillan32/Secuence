// Js/config.js

// Objeto global para mantener el estado de las reglas
const firebaseConfig = {
  apiKey: "AIzaSyBO5oECBqVUBQzBX4Yb61DAHeIOw6hLm-Y",
  authDomain: "secuence-7d7af.firebaseapp.com",
  databaseURL: "https://secuence-7d7af-default-rtdb.firebaseio.com/",
  projectId: "secuence-7d7af",
  storageBucket: "secuence-7d7af.firebasestorage.app",
  messagingSenderId: "576327423344",
  appId: "1:576327423344:web:30f213dcfc5b2b133d2bb5"
};

firebase.initializeApp(firebaseConfig);
const baseDatos = firebase.database();

const configuracionJuego = {
    numeroJugadores: 0, 
    numeroEquipos: 0,   
    cartasPorJugador: 0,
    sequencesParaGanar: 0
};

function inicializarReglas(jugadoresTotales, equiposTotales) {
    configuracionJuego.numeroJugadores = jugadoresTotales;
    configuracionJuego.numeroEquipos = equiposTotales;

    // Regla de victoria
    if (equiposTotales === 3) {
        configuracionJuego.sequencesParaGanar = 1;
    } else {
        configuracionJuego.sequencesParaGanar = 2; 
    }

    // Regla de cartas a repartir
    if (jugadoresTotales === 2) configuracionJuego.cartasPorJugador = 7;
    else if (jugadoresTotales >= 3 && jugadoresTotales <= 4) configuracionJuego.cartasPorJugador = 6;
    else if (jugadoresTotales === 6) configuracionJuego.cartasPorJugador = 5;
    else if (jugadoresTotales >= 8 && jugadoresTotales <= 9) configuracionJuego.cartasPorJugador = 4;
    else if (jugadoresTotales >= 10 && jugadoresTotales <= 12) configuracionJuego.cartasPorJugador = 3;

    console.log("Las reglas dinámicas han sido configuradas:", configuracionJuego);
}

// Inicializamos la partida actual (Modifica esto si juegan más personas)
inicializarReglas(2, 2);
console.log("Reglas cargadas:", configuracionJuego);
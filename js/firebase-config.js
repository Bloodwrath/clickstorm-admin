// firebase-config.js
// Para mantener las credenciales privadas, crea un archivo .env o config.js
// y agrégalo a .gitignore

const firebaseConfig = {
    apiKey: "AIzaSyB0zm1B8qsOhR9V5dVW3rMNNYjQQY7OOwc",
    authDomain: "bussness-administrator.firebaseapp.com",
    projectId: "bussness-administrator",
    storageBucket: "bussness-administrator.firebasestorage.app",
    messagingSenderId: "302765878955",
    appId: "1:302765878955:web:97a537dda954460ddb51ee",
    measurementId: "G-BNZVVEXXJZ"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar servicios
const auth = firebase.auth();
const db = firebase.firestore();
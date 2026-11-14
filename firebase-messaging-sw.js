importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAiQo9h8luDPyLLuPHKauiFFxib7xoumRQ",
    authDomain: "orkap-d13c6.firebaseapp.com",
    databaseURL: "https://orkap-d13c6-default-rtdb.firebaseio.com",
    projectId: "orkap-d13c6",
    storageBucket: "orkap-d13c6.firebasestorage.app",
    messagingSenderId: "571248205991",
    appId: "1:571248205991:web:65dca626cee2be2f74fb82"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'Nova encomenda na Orkap!';

    const notificationOptions = {
        body: payload.notification?.body || 'Recebeste uma nova encomenda.',
        icon: '/perfil.png',
        data: {
            url: '/admin.html'
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow('/admin.html')
    );
});
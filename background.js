importScripts('socket.io.min.js');

let socket = null;
const SERVER_URL = 'http://localhost:9421'; // Modifiez cette URL en production (ex: 'https://monServeurReels.fr:9421')

// Etat de l'extension
let state = {
  connected: false,
  inRoom: false,
  roomCode: null,
  isHost: false,
  currentUrl: null
};

// Initialise la connexion Socket
function connectSocket() {
  if (socket) return;
  socket = io(SERVER_URL, {
    transports: ['websocket'], // Force websocket pour les extensions (evite xhr long polling)
  });

  socket.on('connect', () => {
    console.log('Connecté au serveur de Reels Party');
    state.connected = true;
    broadcastState();
  });

  socket.on('disconnect', () => {
    console.log('Déconnecté du serveur');
    state.connected = false;
    state.inRoom = false; // Reset en cas de deconnexion du serv
    broadcastState();
  });

  // Evenements room
  socket.on('host_left', () => {
    console.log('Le Host a quitté la room.');
    state.inRoom = false;
    state.roomCode = null;
    broadcastState();
    // TODO: notifier le content script si on veut afficher une alert() au guest
  });

  socket.on('new_url', (data) => {
    console.log('Nouvelle URL reçue:', data.url);
    state.currentUrl = data.url;
    // On previent l'onglet actif (Guest) qu'il faut changer d'URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
         chrome.tabs.sendMessage(tabs[0].id, { type: 'GOTO_URL', url: data.url });
      }
    });
  });

  socket.on('play_all', () => {
    console.log('Tous les membres ont chargé la vidéo. Lecture synchronisée !');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
         chrome.tabs.sendMessage(tabs[0].id, { type: 'PLAY_VIDEO' });
      }
    });
  });
}

// Fonction utilitaire pour informer tous les popups ou content scripts de l'etat
function broadcastState() {
  chrome.runtime.sendMessage({ type: 'STATE_UPDATE', state }).catch(() => {});
}

// Listener principal pour les actions recues du popup ou content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    sendResponse(state);
    return true;
  }

  // --- ACTIONS POPUP ---
  if (message.type === 'CREATE_ROOM') {
    socket.emit('create_room', (res) => {
      if (res.success) {
        state.inRoom = true;
        state.isHost = true;
        state.roomCode = res.roomCode;
        broadcastState();
      }
    });
    return true; // async response
  }

  if (message.type === 'JOIN_ROOM') {
    socket.emit('join_room', message.roomCode, (res) => {
      if (res.success) {
        state.inRoom = true;
        state.isHost = res.isHost;
        state.roomCode = message.roomCode;
        state.currentUrl = res.currentUrl;
        
        broadcastState();

        // Si l'hôte avait déjà une URL, on navigue le guest directement
        if (state.currentUrl) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'GOTO_URL', url: state.currentUrl });
              }
            });
        }

      } else {
        console.error(res.message);
      }
    });
    return true;
  }

  if (message.type === 'LEAVE_ROOM') {
    socket.disconnect(); 
    state.inRoom = false;
    state.roomCode = null;
    state.isHost = false;
    socket = null;
    connectSocket(); // Reconnect for a clean slate
    broadcastState();
    return true;
  }

  // --- ACTIONS CONTENT SCRIPT ---
  if (message.type === 'URL_CHANGED') {
    // Si nous sommes l'Hote et dans une room, on informe le serveur de la nouvelle URL
    if (state.inRoom && state.isHost) {
      if (state.currentUrl !== message.url) {
        state.currentUrl = message.url;
        socket.emit('update_url', { roomCode: state.roomCode, url: message.url });
      }
    }
  }

  if (message.type === 'VIDEO_READY') {
    if (state.inRoom) {
      socket.emit('video_ready', { roomCode: state.roomCode, url: message.url });
    }
  }

});

// Init
connectSocket();

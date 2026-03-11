const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // A ajuster selon les besoins de secu si on heberge
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 9421;

// Objet en memoire pour stocker l'etat des rooms
const rooms = {};

// Generateur de codes pour les rooms (ex: 6 caracteres alpha-numeriques)
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log(`Nouvelle connexion: ${socket.id}`);

  // Hote cree une room
  socket.on('create_room', (callback) => {
    const roomCode = generateRoomCode();
    
    // Initialise la room
    rooms[roomCode] = {
      host: socket.id,
      guests: [],
      currentUrl: null,
      readyUsers: []
    };

    socket.join(roomCode);
    console.log(`Room ${roomCode} cree par ${socket.id}`);
    
    // Renvoie le code a l'hote
    if (callback) callback({ success: true, roomCode });
  });

  // Hote ou Guest rejoint une room
  socket.on('join_room', (roomCode, callback) => {
    const room = rooms[roomCode];
    
    if (!room) {
      if (callback) callback({ success: false, message: "Room introuvable." });
      return;
    }

    socket.join(roomCode);
    
    if (socket.id !== room.host && !room.guests.includes(socket.id)) {
      room.guests.push(socket.id);
    }

    console.log(`Utilisateur ${socket.id} a rejoint la room ${roomCode}`);
    
    // Informe l'utilisateur du succes et lui donne l'URL courante si elle existe
    if (callback) callback({ 
      success: true, 
      isHost: socket.id === room.host,
      currentUrl: room.currentUrl 
    });

    // Optionnel: informer le host qu'un guest a rejoint
    socket.to(room.host).emit('guest_joined', { guestId: socket.id });
  });

  // Host envoie la nouvelle URL a ses guests
  socket.on('update_url', ({ roomCode, url }, callback) => {
    const room = rooms[roomCode];
    
    if (!room) {
      if (callback) callback({ success: false, message: "Room introuvable." });
      return;
    }

    // On s'assure que seul le host peut changer l'URL
    if (room.host !== socket.id) {
       if (callback) callback({ success: false, message: "Seul l'hote peut changer la video." });
       return;
    }

    room.currentUrl = url;
    room.readyUsers = []; // On réinitialise les utilisateurs prêts pour cette nouvelle vidéo
    console.log(`URL mise a jour dans la room ${roomCode}: ${url}`);

    // Diffuse a tous les memebres de la room SAUF l'emetteur (l'hote)
    socket.to(roomCode).emit('new_url', { url });
    
    if (callback) callback({ success: true });
  });

  // Nouveau: Un client signale qu'il est prêt à lire la vidéo actuelle
  socket.on('video_ready', ({ roomCode, url }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.currentUrl === url) {
      if (!room.readyUsers.includes(socket.id)) {
        room.readyUsers.push(socket.id);
      }

      const expectedUsers = 1 + room.guests.length; // Host + Guests
      console.log(`Room ${roomCode} | Prêts: ${room.readyUsers.length}/${expectedUsers} pour l'URL: ${url}`);

      // Si tous les membres présents sont prêts
      if (room.readyUsers.length >= expectedUsers) {
        console.log(`Tous prêts dans la room ${roomCode}. Broadcast de PLAY_ALL.`);
        io.to(roomCode).emit('play_all');
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Deconnexion: ${socket.id}`);
    // Nettoyage / gestion de la deconnexion (surtout si le host part)
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.host === socket.id) {
        // Le host est parti, on peut informer les guests et detruire la room
        socket.to(roomCode).emit('host_left');
        delete rooms[roomCode];
        // Un guest est parti, on l'enleve de la liste
        const index = room.guests.indexOf(socket.id);
        if (index !== -1) {
          room.guests.splice(index, 1);
        }
        
        // On l'enlève des readyUsers s'il y était
        const readyIndex = room.readyUsers.indexOf(socket.id);
        if (readyIndex !== -1) {
          room.readyUsers.splice(readyIndex, 1);
        }
        
        // On revérifie si les utilisateurs restants sont tous prêts
        const expectedUsers = 1 + room.guests.length;
        if (room.currentUrl && expectedUsers > 0 && room.readyUsers.length >= expectedUsers) {
           io.to(roomCode).emit('play_all');
        }
      }
    }
  });
});

app.get('/', (req, res) => {
  res.send('Serveur Reels Party actif.');
});

server.listen(PORT, () => {
  console.log(`Serveur Socket.io demarre sur le port ${PORT}`);
});

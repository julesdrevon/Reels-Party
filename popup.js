document.addEventListener('DOMContentLoaded', () => {
  const btnCreate = document.getElementById('btn-create');
  const btnJoin = document.getElementById('btn-join');
  const inputCode = document.getElementById('input-code');
  const btnLeave = document.getElementById('btn-leave');
  
  const actionsContainer = document.getElementById('actions-container');
  const roomInfo = document.getElementById('room-info');
  const displayCode = document.getElementById('display-code');
  const roleText = document.getElementById('role-text');
  const connectionStatus = document.getElementById('connection-status');

  // Met a jour l'affichage selon l'etat
  function updateUI(state) {
    if (state.connected) {
      connectionStatus.textContent = "Connecté au serveur";
      connectionStatus.className = "status-badge connected";
      btnCreate.disabled = false;
      btnJoin.disabled = false;
    } else {
      connectionStatus.textContent = "Serveur injoignable";
      connectionStatus.className = "status-badge disconnected";
      btnCreate.disabled = true;
      btnJoin.disabled = true;
    }

    if (state.inRoom) {
      actionsContainer.classList.add('hidden');
      roomInfo.classList.remove('hidden');
      displayCode.textContent = state.roomCode;
      roleText.textContent = state.isHost ? "Vous êtes l'Hôte 👑" : "Vous êtes Invité 🍿";
    } else {
      actionsContainer.classList.remove('hidden');
      roomInfo.classList.add('hidden');
      displayCode.textContent = "------";
    }
  }

  // Demander l'etat actuel au background (Polling a l'ouverture)
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    if(response) updateUI(response);
  });

  // Listener pour les changements d'etat envoyes par le background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATE_UPDATE') {
      updateUI(message.state);
    }
  });

  // Actions
  btnCreate.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CREATE_ROOM' });
  });

  btnJoin.addEventListener('click', () => {
    const code = inputCode.value.trim().toUpperCase();
    if (code.length === 6) {
      chrome.runtime.sendMessage({ type: 'JOIN_ROOM', roomCode: code });
    } else {
      alert("Le code doit faire 6 caractères.");
    }
  });

  btnLeave.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LEAVE_ROOM' });
  });
});

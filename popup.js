document.addEventListener('DOMContentLoaded', () => {
  const btnCreate = document.getElementById('btn-create');
  const btnJoin = document.getElementById('btn-join');
  const inputCode = document.getElementById('input-code');
  const inputUsername = document.getElementById('input-username');
  const btnLeave = document.getElementById('btn-leave');
  
  const actionsContainer = document.getElementById('actions-container');
  const roomInfo = document.getElementById('room-info');
  const displayCode = document.getElementById('display-code');
  const roleText = document.getElementById('role-text');
  const usersList = document.getElementById('users-list');
  const connectionStatus = document.getElementById('connection-status');
  
  // Settings
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const serverSelect = document.getElementById('server-select');
  const customServerUrl = document.getElementById('custom-server-url');
  const btnSaveSettings = document.getElementById('btn-save-settings');

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
    
    // MAJ Settings Data
    if (state.serverType === 'custom') {
       serverSelect.value = 'custom';
       customServerUrl.classList.remove('hidden');
       if (state.customServerUrl && !customServerUrl.value) customServerUrl.value = state.customServerUrl;
    } else {
       serverSelect.value = 'official';
       customServerUrl.classList.add('hidden');
    }

    if (state.inRoom) {
      actionsContainer.classList.add('hidden');
      settingsToggle.classList.add('hidden');
      settingsPanel.classList.add('hidden');
      roomInfo.classList.remove('hidden');
      displayCode.textContent = state.roomCode;
      roleText.textContent = state.isHost ? "Vous êtes l'Hôte 👑" : "Vous êtes Invité 🍿";
      
      // Afficher les utilisateurs
      usersList.innerHTML = `<div style="font-weight:bold; color:#ff0050; border-bottom:1px solid #333; padding-bottom:3px; margin-bottom:5px;">Membres (${state.users.length})</div>`;
      state.users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `
           <span>${u.isHost ? '👑 ' : ''}${u.username}</span>
           <span class="status-dot ${u.isReady ? 'ready' : ''}" title="${u.isReady ? 'Prêt' : 'En chargement'}"></span>
        `;
        usersList.appendChild(div);
      });

    } else {
      actionsContainer.classList.remove('hidden');
      settingsToggle.classList.remove('hidden');
      roomInfo.classList.add('hidden');
      displayCode.textContent = "------";
      
      // Restaurer le pseudo si connu
      if (state.username && !inputUsername.value) {
        inputUsername.value = state.username;
      }
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

  // Helpers pour set le pseudo avant toute action
  function setUsername(callback) {
     const val = inputUsername.value.trim();
     if (!val) {
        alert("Veuillez choisir un pseudo.");
        return;
     }
     chrome.runtime.sendMessage({ type: 'SET_USERNAME', username: val }, callback);
  }

  // --- ACTIONS SETTINGS ---
  settingsToggle.addEventListener('click', () => {
     settingsPanel.classList.toggle('hidden');
  });

  serverSelect.addEventListener('change', (e) => {
     if (e.target.value === 'custom') {
        customServerUrl.classList.remove('hidden');
     } else {
        customServerUrl.classList.add('hidden');
     }
  });

  btnSaveSettings.addEventListener('click', () => {
     const isCustom = serverSelect.value === 'custom';
     let url = customServerUrl.value.trim();
     
     if (isCustom && (!url.startsWith('http://') && !url.startsWith('https://'))) {
        alert("L'URL doit commencer par http:// ou https://");
        return;
     }

     chrome.runtime.sendMessage({ 
         type: 'UPDATE_SERVER_URL', 
         serverType: serverSelect.value, 
         customUrl: url 
     });
     
     settingsPanel.classList.add('hidden');
     connectionStatus.textContent = "Reconnexion...";
     connectionStatus.className = "status-badge";
  });

  // Actions Room
  btnCreate.addEventListener('click', () => {
    setUsername(() => {
       chrome.runtime.sendMessage({ type: 'CREATE_ROOM' });
    });
  });

  btnJoin.addEventListener('click', () => {
    setUsername(() => {
      const code = inputCode.value.trim().toUpperCase();
      if (code.length === 6) {
        chrome.runtime.sendMessage({ type: 'JOIN_ROOM', roomCode: code });
      } else {
        alert("Le code doit faire 6 caractères.");
      }
    });
  });

  btnLeave.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LEAVE_ROOM' });
  });
});

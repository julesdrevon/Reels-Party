let lastReportedUrl = location.href;
let currentVideo = null;
let isWaitingForOthers = false;
let isProgrammaticAction = false; // Permet de distinguer un clic utilisateur d'un ordre de l'extension

// Fonction de survie: verifier si l'extension a ete rafraichie
function isContextValid() {
  return chrome.runtime && !!chrome.runtime.id;
}

// 1. Détecter les changements d'URL sans rechargement de page (SPA)
function reportUrlChange() {
  if (!isContextValid()) return; // On stoppe tout si le contexte est mort

  const newUrl = location.href;
  if(newUrl !== lastReportedUrl) {
    lastReportedUrl = newUrl;
    console.log("Reels Party: Nouvelle URL détéctée ->", newUrl);
    
    try {
        chrome.runtime.sendMessage({ type: 'URL_CHANGED', url: newUrl });
    } catch (e) {
        console.warn("Reels Party: Erreur context (Veuillez rafraîchir la page)", e);
    }
    
    observeVideo();
  }
}

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
  originalPushState.apply(this, arguments);
  reportUrlChange();
};

history.replaceState = function() {
  originalReplaceState.apply(this, arguments);
  reportUrlChange();
};

window.addEventListener('popstate', reportUrlChange);

setInterval(() => {
  if (!isContextValid()) return; // Stoppe le check periodique si le context est mort
  if (location.href !== lastReportedUrl) {
    reportUrlChange();
  }
}, 1000);

// --- LOGIQUE DE LECTURE ET PAUSE SYNCHRONISÉE ---

document.addEventListener('play', (e) => {
  if (isWaitingForOthers && isContextValid() && e.target.tagName === 'VIDEO') {
    e.target.pause();
    console.log("Reels Party: Action de lecture interceptée et bloquée globalement.");
  }
}, true);

// Seuil max de confiance (en ms) permettant de considérer un "play/pause" comme venant d'un clic
let lastUserInteractionTime = 0;
document.addEventListener('pointerdown', () => lastUserInteractionTime = Date.now(), true);
document.addEventListener('keydown', () => lastUserInteractionTime = Date.now(), true);

// Détecte les vraies pauses manuelles de l'utilisateur
document.addEventListener('pause', (e) => {
  if (e.target.tagName !== 'VIDEO') return;
  if (!isWaitingForOthers && !isProgrammaticAction && isContextValid()) {
    // Est-ce qu'il y a eu un clic ou une touche clavier dans les 1000 dernières ms ?
    if (Date.now() - lastUserInteractionTime < 1000) {
      console.log("Reels Party: L'utilisateur a mis en pause.");
      chrome.runtime.sendMessage({ type: 'REQUEST_PAUSE' }).catch(()=>console.warn("Erreur context"));
    }
  }
}, true);

// Détecte les vraies lectures manuelles de l'utilisateur
document.addEventListener('play', (e) => {
  if (e.target.tagName !== 'VIDEO') return;
  if (!isWaitingForOthers && !isProgrammaticAction && isContextValid()) {
    // Est-ce qu'il y a eu un clic ou une touche clavier dans les 1000 dernières ms ?
    if (Date.now() - lastUserInteractionTime < 1000) {
      console.log("Reels Party: L'utilisateur a relancé la vidéo.");
      chrome.runtime.sendMessage({ type: 'REQUEST_PLAY' }).catch(()=>console.warn("Erreur context"));
    }
  }
}, true);

function findMainVideo() {
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;

  // Trouver la vidéo qui occupe le plus d'espace à l'écran (très utile sur Insta qui a 3 vidéos pré-chargées)
  let maxArea = 0;
  let mainVideo = videos[0];
  
  videos.forEach(v => {
    const rect = v.getBoundingClientRect();
    const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    const area = visibleWidth * visibleHeight;
    
    // Ignore les vidéos de moins de 100x100 de visibilité ou celles qui ne sont pas prêtes
    if (area > maxArea && v.readyState > 0 && v.offsetParent !== null) {
      maxArea = area;
      mainVideo = v;
    }
  });
  
  return mainVideo;
}

// Fonction pour simuler un clic sur le bouton "Mute/Unmute" natif d'Instagram (React override)
function applyInstagramMuteState(desiredMuted) {
    if (!window.location.hostname.includes('instagram.com')) return;

    // Cherche tous les SVG d'Instagram pour trouver celui du volume
    const svgs = Array.from(document.querySelectorAll('svg[aria-label]'));
    let muteBtn = svgs.find(svg => svg.getAttribute('aria-label').toLowerCase().includes('son est coupé') || svg.getAttribute('aria-label').toLowerCase().includes('mute'));
    let unmuteBtn = svgs.find(svg => svg.getAttribute('aria-label').toLowerCase().includes('son est activé') || svg.getAttribute('aria-label').toLowerCase().includes('audio'));
    
    // Si on veut MUTE et que le bouton visible est "Unmute/Son activé", on clique dessus
    if (desiredMuted && unmuteBtn) {
        console.log("Reels Party: Simulation clic pour MUTER Instagram");
        unmuteBtn.closest('div[role="button"]').click();
    } 
    // Si on veut UNMUTE et que le bouton visible est "Mute/Son coupé", on clique dessus
    else if (!desiredMuted && muteBtn) {
        console.log("Reels Party: Simulation clic pour DEMUTER Instagram");
        muteBtn.closest('div[role="button"]').click();
    }
}

function observeVideo() {
  isWaitingForOthers = true;
  currentVideo = null;

  // Coup de marteau immédiat sur les vidéos actuellement actives
  document.querySelectorAll('video').forEach(v => {
    if (!v.paused) v.pause();
  });

  const checkInterval = setInterval(() => {
    if (!isContextValid()) {
      clearInterval(checkInterval);
      return;
    }

    // Sécurité supplémentaire : on force la pause de tout en boucle pendant l'attente
    if (isWaitingForOthers && isContextValid()) {
      document.querySelectorAll('video').forEach(v => {
        if (!v.paused) v.pause();
      });
    } else {
        // Si on n'attend plus, on arrête de scruter agressivement
        clearInterval(checkInterval);
        return;
    }

    const video = findMainVideo();
    if (video && video !== currentVideo) {
      currentVideo = video;
      clearInterval(checkInterval);

      console.log("Reels Party: Vidéo principale identifiée. Prêt envoyé au serveur.");
      
      // Restauration de l'audio si on a sauvegardé quelque chose au préalable
      try {
        const savedMuted = localStorage.getItem('reelsParty_muted');
        const savedVolume = localStorage.getItem('reelsParty_volume');
        if (savedVolume !== null) video.volume = parseFloat(savedVolume);
        
        // Sur Instagram, modifier video.muted ne met pas a jour l'interface (React l'ecrase)
        // On doit simuler un vrai clic sur le bouton de volume d'Instagram
        if (savedMuted !== null) {
           const shouldBeMuted = savedMuted === 'true';
           applyInstagramMuteState(shouldBeMuted);
           // On applique aussi au tag natif au cas ou ce n'est pas Insta
           video.muted = shouldBeMuted; 
        }

      } catch (e) {
        console.warn("Reels Party: Impossible de restaurer le son", e);
      }

      // On informe le serveur qu'on est prêt
      try {
          chrome.runtime.sendMessage({ type: 'VIDEO_READY', url: location.href });
      } catch (e) {
          console.warn("Reels Party: Erreur context au moment du prèt", e);
      }
    }
  }, 300);
}

// Initialisation au chargement
reportUrlChange();
observeVideo();

// --- OVERLAY DE LECTURE (BYPASS AUTOPLAY FIREFOX) ---
function showPlayOverlay(videoElement) {
    if (document.getElementById('rp-play-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'rp-play-overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.8)', zIndex: '9999999',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        color: 'white', fontFamily: 'sans-serif', cursor: 'pointer'
    });

    overlay.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 20px;">▶️</div>
        <h2>Lecture bloquée par le navigateur</h2>
        <p>Cliquez n'importe où pour lancer la vidéo (Sécurité Firefox)</p>
    `;

    overlay.addEventListener('click', () => {
        isProgrammaticAction = true;
        videoElement.play().then(() => {
            overlay.remove();
        }).catch(err => {
            console.error("Reels Party: Toujours bloqué par le navigateur", err);
            overlay.remove(); // Retire l'overlay quoiqu'il arrive pour ne pas softlock
        });
        setTimeout(() => isProgrammaticAction = false, 500);
    });

    (document.body || document.documentElement).appendChild(overlay);
}

// 2. Écouter les ordres du background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GOTO_URL') {
    if (location.href !== message.url) {
      console.log('Reels Party: Demande de changement de vidéo ->', message.url);
      
      console.log("Reels Party: Redirection propre en cours vers la position de l'Hôte...");
      
      // Sauvegarde de l'état du son actuel juste avant de recharger la page
      try {
        const v = findMainVideo();
        if (v) {
          localStorage.setItem('reelsParty_muted', v.muted);
          localStorage.setItem('reelsParty_volume', v.volume);
        }
      } catch (e) { /* ignore */ }

      // La navigation via l'historique ou le DOM de React est bloquee ou instable sur ces sites.
      // Un rechargement est la maniere la plus fiable de synchroniser l'invite.
      window.location.assign(message.url);
    }
  }

  if (message.type === 'PLAY_VIDEO') {
    console.log("Reels Party: Autorisation de lecture reçue !");
    isWaitingForOthers = false; // Désactive immédiatement le bouclier global
    
    // On force la lecture uniquement sur la vidéo visible principale
    isProgrammaticAction = true;
    const main = findMainVideo();
    if (main && main.paused) {
        main.play().catch(e => {
            console.log("Reels Party: Auto-play bloqué par le navigateur", e);
            showPlayOverlay(main);
        });
    }
    setTimeout(() => isProgrammaticAction = false, 500);
  }

  // --- RECEPTION DES ORDRES MANUELS PLAY/PAUSE DES AUTRES ---
  if (message.type === 'FORCE_PAUSE') {
    console.log("Reels Party: Ordre de PAUSE reçu des autres membres.");
    isProgrammaticAction = true;
    document.querySelectorAll('video').forEach(v => {
      if (!v.paused) v.pause();
    });
    setTimeout(() => isProgrammaticAction = false, 500);
  }

  if (message.type === 'FORCE_PLAY') {
    console.log("Reels Party: Ordre de PLAY reçu des autres membres.");
    if (!isWaitingForOthers) { // On ne relance pas si on est encore en chargement synchro global
      isProgrammaticAction = true;
      const main = findMainVideo();
      if (main && main.paused) {
          main.play().catch(e => {
              console.log("Reels Party: Auto-play forcage bloqué", e);
              showPlayOverlay(main);
          });
      }
      setTimeout(() => isProgrammaticAction = false, 500);
    }
  }

  // --- RECEPTION DE L'ÉTAT SERVEUR (UI) ---
  if (message.type === 'STATE_UPDATE') {
    renderUsersHUD(message.state);
  }
});

// Demande l'état initial pour l'UI
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
   if (state) renderUsersHUD(state);
});

// -- FONCTION DE RENDU UI (HUD) --
function renderUsersHUD(state) {
  let overlay = document.getElementById('reels-party-overlay');
  
  if (!state.inRoom || !state.users || state.users.length === 0) {
    if (overlay) overlay.remove();
    return;
  }

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'reels-party-overlay';
    (document.body || document.documentElement).appendChild(overlay);
  }

  // Vider et reconstruire
  overlay.innerHTML = '';

  state.users.forEach(u => {
    const bubble = document.createElement('div');
    bubble.className = `rp-user-bubble ${u.isReady ? 'ready' : 'loading'}`;
    bubble.setAttribute('data-tooltip', u.username);
    
    // Initiale (1 ou 2 lettres max)
    const initial = u.username.substring(0, 2).toUpperCase();
    bubble.textContent = initial;

    if (u.isHost) {
       const crown = document.createElement('span');
       crown.className = 'rp-host-crown';
       crown.textContent = '👑';
       bubble.appendChild(crown);
    }

    overlay.appendChild(bubble);
  });
}

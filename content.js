let lastReportedUrl = location.href;
let currentVideo = null;
let isWaitingForOthers = false;

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

// Bloqueur global : empêche toute vidéo de démarrer si on attend les autres
// On utilise `useCapture = true` pour intercepter l'évènement avant qu'il n'atteigne React/Instagram
document.addEventListener('play', (e) => {
  if (isWaitingForOthers && isContextValid() && e.target.tagName === 'VIDEO') {
    e.target.pause();
    console.log("Reels Party: Action de lecture interceptée et bloquée globalement.");
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

// 2. Écouter les ordres du background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GOTO_URL') {
    if (location.href !== message.url) {
      console.log('Reels Party: Demande de changement de vidéo ->', message.url);
      
      console.log("Reels Party: Redirection propre en cours vers la position de l'Hôte...");
      
      // La navigation via l'historique ou le DOM de React est bloquee ou instable sur ces sites.
      // Un rechargement est la maniere la plus fiable de synchroniser l'invite.
      window.location.assign(message.url);
    }
  }

  if (message.type === 'PLAY_VIDEO') {
    console.log("Reels Party: Autorisation de lecture reçue !");
    isWaitingForOthers = false; // Désactive immédiatement le bouclier global
    
    // On force la lecture sur TOUTES les vidéos (la vidéo principale prendra le relai naturellement)
    document.querySelectorAll('video').forEach(v => {
      if (v.paused) {
         v.play().catch(e => console.log("Reels Party: Auto-play bloqué par le navigateur", e));
      }
    });
  }
});

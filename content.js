let lastReportedUrl = location.href;
let currentVideo = null;
let isWaitingForOthers = false;

// 1. Détecter les changements d'URL sans rechargement de page (SPA)
function reportUrlChange() {
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
  if (location.href !== lastReportedUrl) {
    reportUrlChange();
  }
}, 1000);

// --- LOGIQUE DE LECTURE ET PAUSE SYNCHRONISÉE ---

function findMainVideo() {
  const videos = Array.from(document.querySelectorAll('video'));
  return videos.find(v => v.readyState > 0 && v.offsetParent !== null) || videos[0];
}

function observeVideo() {
  isWaitingForOthers = true;
  currentVideo = null;

  const checkInterval = setInterval(() => {
    const video = findMainVideo();
    if (video && video !== currentVideo) {
      currentVideo = video;
      clearInterval(checkInterval);

      console.log("Reels Party: Vidéo trouvée. Mise en pause...");
      video.pause();
      
      const enforcePause = () => {
        if (isWaitingForOthers) video.pause();
      };
      
      video.addEventListener('play', enforcePause);
      
      // On informe le serveur qu'on est prêt
      try {
          chrome.runtime.sendMessage({ type: 'VIDEO_READY', url: location.href });
      } catch (e) {
          console.warn("Reels Party: Erreur context au moment du prèt", e);
      }
      
      const cleanup = setInterval(() => {
        if (!isWaitingForOthers || currentVideo !== video) {
          video.removeEventListener('play', enforcePause);
          clearInterval(cleanup);
        }
      }, 1000);
    }
  }, 500);
}

// Initialisation au chargement
reportUrlChange();
observeVideo();

// 2. Écouter les ordres du background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GOTO_URL') {
    if (location.href !== message.url) {
      console.log('Reels Party: Demande de changement de vidéo ->', message.url);

      // Simulation de la touche Flèche du bas (ArrowDown)
      // La plupart des plateformes (YT Shorts, Tiktok, Insta Reels) ecoutent cette touche
      // pour passer a la video suivante grance a leur propre logique de SPA
      let direction = 'ArrowDown'; // Simplification: on assume qu'on avance
      
      console.log("Reels Party: Simulation de la touche " + direction + "...");
      
      const arrowEvent = new KeyboardEvent('keydown', {
          key: direction,
          code: direction,
          keyCode: 40,
          which: 40,
          bubbles: true,
          cancelable: true
      });
      
      document.dispatchEvent(arrowEvent);
      
      // On verifie si l'URL a bien change apres un petit delai
      setTimeout(() => {
        if (location.href !== message.url) {
            console.log("Reels Party: La simulation de touche a echoue. Redirection SPA...");
            // Navigation de secours (marche pour YT Shorts souvent)
            history.pushState(null, '', message.url);
            window.dispatchEvent(new Event('popstate'));
            
            setTimeout(() => {
              if (location.href !== message.url) {
                  console.log("Reels Party: La navigation SPA a echoue. Rechargement complet.");
                  window.location.replace(message.url);
              } else {
                  observeVideo();
              }
            }, 800);
        } else {
            observeVideo();
        }
      }, 1000);
    }
  }

  if (message.type === 'PLAY_VIDEO') {
    console.log("Reels Party: Autorisation de lecture reçue !");
    isWaitingForOthers = false;
    if (currentVideo) {
      currentVideo.play().catch(e => console.log("Reels Party: Auto-play bloqué", e));
    }
  }
});

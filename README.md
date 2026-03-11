# Reels Party 🎉

Cette extension Chrome te permet de synchroniser le visionnage de vidéos (Instagram Reels, TikTok, YouTube Shorts) avec tes amis en temps réel ! 

## 1. Démarrer le Serveur (Backend)

L'extension a besoin d'un petit serveur local pour permettre aux utilisateurs de communiquer entre eux (créer des "rooms" et partager le lien de la vidéo en direct).

**Pour lancer le serveur :**
1. Ouvre un terminal (Invite de commandes ou PowerShell).
2. Va dans le dossier du serveur :
   ```bash
   cd chemin\vers\tutorial.hello-world\server
   ```
3. Installe les dépendances (la première fois uniquement) :
   ```bash
   npm install
   ```
4. Lance le serveur :
   ```bash
   npm start
   ```
   *Tu devrais voir le message : `Serveur Socket.io demarre sur le port 9421`.*
   Laisse ce terminal ouvert pendant que tu utilises l'extension !

## 2. Installer l'Extension Chrome

1. Ouvre Google Chrome et tape `chrome://extensions/` dans la barre d'adresse.
2. Active le **Mode développeur** (en haut à droite).
3. Clique sur **Charger l'extension non empaquetée**.
4. Sélectionne le dossier complet de ce projet (`tutorial.hello-world`).

## 3. Comment l'utiliser

1. Épingles l'extension "Reels Party" dans ta barre Chrome.
2. **Si tu es l'Hôte :** Ouvre une vidéo (ex: Instagram Reels), clique sur l'extension et fais "Créer une Room". Donne le code de 6 lettres à ton ami.
3. **Si tu es l'Invité :** Clique sur l'extension côté Guest, rentre le code et clique sur "Rejoindre".
4. Dès que l'hôte scroll ou change de vidéo, l'écran de l'invité changera tout seul pour regarder la même chose ! 🍿
# Madeira Companion

## Utilisation rapide
Cette application est une PWA statique. Pour l’essayer localement :

```bash
python -m http.server 8000
```

Puis ouvrez `http://localhost:8000/madeira-companion/` si le dossier est servi depuis `/mnt/data`, ou lancez la commande directement dans le dossier et ouvrez `http://localhost:8000`.

## Mise en ligne
Déposez le contenu du dossier sur GitHub Pages, Netlify, Vercel ou tout hébergeur statique HTTPS. L’installation sur l’écran d’accueil et le mode hors ligne nécessitent HTTPS (sauf localhost).

## Fonctionnalités
- lieux regroupés par zone ;
- tri selon vos notes (⭐⭐⭐ = priorité maximale) ;
- filtres par zone, catégorie et priorité ;
- liens Google Maps et Waze ;
- météo indicative par grands secteurs ;
- favoris, lieux faits et notes personnelles enregistrés sur le téléphone ;
- fonctionnement hors ligne après une première visite.


## Version 5
- règle de priorité explicitée : 3 étoiles = fort intérêt ;
- correction de la zone des deux cases à cocher sur mobile ;
- photos chargées progressivement depuis Wikimedia, avec visuel local de secours ;
- fiches enrichies avec informations pratiques et points d’intérêt à proximité ;
- activités affichées sur la carte avec des pictogrammes distincts.


## Version 6
- Tableau de bord Voyage avec vols Sébastien et Audrey.
- Deux fiches Airbnb.
- Fiche complète de location de voiture.
- Chronologie limitée aux vols, Airbnb et voiture.
- Pièces jointes conservées localement dans IndexedDB.
- Export JSON des informations saisies.

Pour publier : remplacer tous les fichiers du dépôt GitHub Pages par ceux de cette archive, puis recharger l’application.


## Version 7
- Vols aller et retour séparés pour Sébastien et Audrey.
- Recherche web d’un vol par numéro et date.
- Airbnb et agence de location ajoutés dynamiquement à la carte après saisie de leur adresse.
- Liens Google Maps et Waze pour chaque adresse.

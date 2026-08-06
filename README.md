# 📷 PhotoWall — Mur d'images interactif en Temps Réel

PhotoWall est une application web moderne construite avec **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui** et **Supabase (PostgreSQL, Auth & Realtime)**.

Elle permet à n'importe quel utilisateur d'uploader ou d'ajouter une photo et de la voir apparaître instantanément sur un écran / mur interactif sans jamais rafraîchir la page.

---

## ✨ Fonctionnalités Principales

- **Page d'Accueil (`/`)** : Présentation dynamique, aperçu des dernières photos en ligne et appels à l'action.
- **Formulaire d'Envoi (`/upload`)** : Import par fichier image (glisser-déposer / Drag & Drop) ou par URL web directe avec prévisualisation instantanée.
- **Mur Photo Temps Réel (`/wall`)** : Grille responsive avec animations de physique fluides (**Framer Motion**), écoute en direct via **Supabase Realtime WebSockets** et visionneuse grand écran (Lightbox Modal).
- **Administration Sécurisée (`/admin`)** : Espace sécurisé par **Supabase Auth** pour visualiser l'ensemble des photos (actives et masquées), masquer/restaurer des visuels ou les supprimer définitivement.

---

## 🛠️ Stack Technique

- **Framework** : Next.js 15.5 avec Turbopack & App Router
- **Langage** : TypeScript 5
- **Design & UI** : Tailwind CSS v4, shadcn/ui, Radix UI Primitives, Lucide Icons
- **Animations** : Framer Motion
- **Backend & Base de données** : Supabase PostgreSQL (`@supabase/ssr`)
- **Temps Réel** : Supabase Realtime (WebSockets)
- **Authentification** : Supabase Auth (Admin uniquement)

---

## 🚀 Préréquis & Installation

### 1. Cloner le projet et installer les dépendances
```bash
npm install
```

### 2. Variables d'environnement
Créez un fichier `.env.local` à la racine en recopiant le modèle `.env.example` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anonyme-publique
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-role
```

---

## 🗄️ Configuration Supabase & Migrations SQL

Exécutez les scripts SQL situés dans le dossier `supabase/migrations/` depuis le **SQL Editor** de votre projet Supabase :

1. **`20260728000000_create_photos_table.sql`** :
   - Création de la table `photos` (`id`, `image_url`, `status`, `created_at`, `deleted_at`).
   - Activation de `REPLICA IDENTITY FULL`.
   - Activation des politiques RLS (Row Level Security).
   - Ajout de la table à la publication `supabase_realtime`.

2. **`20260728000001_create_storage_bucket.sql`** *(Optionnel)* :
   - Création du bucket de stockage public `photos`.

---

## 🔐 Créer un Compte Administrateur

Pour accéder à la page d'administration `/admin`, créez un utilisateur administrateur dans Supabase Auth :

1. Rendez-vous dans le tableau de bord Supabase > **Authentication** > **Users**.
2. Cliquez sur **Add User** > **Create User**.
3. Renseignez un e-mail et un mot de passe (ex: `admin@photowall.com`).
4. Utilisez ces identifiants pour vous connecter sur la page `/admin`.

---

## 💻 Démarrage en Développement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

---

## 🌐 Déploiement sur Vercel

```bash
# Via Vercel CLI
npm i -g vercel
vercel --prod
```

Ou connectez votre dépôt GitHub à **Vercel** et renseignez les variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les paramètres du projet.

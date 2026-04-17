# Invoice Generator

Application de génération de factures — interface React permettant de créer, personnaliser et exporter des factures.

## User Context
- Utilisateur: Ahmed, développeur débutant mais très curieux et technique
- **ALWAYS** communiquer en français, avec des explications simples et générales
- **NEVER** utiliser du jargon technique avancé sans l'expliquer
- Être autonome et prendre les décisions intelligentes sans demander à chaque étape

## Tech Stack
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (config via `src/index.css`, pas de `tailwind.config.ts`)
- shadcn/ui (style `radix-nova`, Radix primitives)
- lucide-react (icônes)
- Geist Variable font

## Commands
- `npm run dev` — Lancer le projet en local
- `npm run build` — Compiler pour la production
- `npm run lint` — Vérifier les erreurs de code
- `npx shadcn add <component>` — Ajouter un composant shadcn

## Important Files
- `src/index.css` — Couleurs et thème (Tailwind v4)
- `components.json` — Config shadcn (style: radix-nova, aliases @/)
- `src/lib/utils.ts` — Helper `cn()` pour les classes CSS

## Rules
- **CRITICAL**: ALWAYS use shadcn/ui components first — check `npx shadcn add` before building anything custom
- ALWAYS use path alias `@/` (ex: `@/components/ui/button`)
- UI components → `src/components/ui/` ; logique métier → `src/components/`
- NEVER add a PDF library without user confirmation (jsPDF, react-pdf, etc.)
- NEVER build a custom component if shadcn has an equivalent (Button, Input, Card, Dialog, Table, Form…)

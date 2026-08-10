import path from 'node:path';

/** Emplacement de la session partagee par toute l'execution. */
export const FICHIER_SESSION = path.join(__dirname, '.auth', 'session.json');

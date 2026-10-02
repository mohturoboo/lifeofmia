import { getCurrentUser } from '@/lib/auth/session';
import { getDashboardData } from '@/lib/dashboard-data';
import { DashboardView, type DashboardData } from './dashboard-view';

/**
 * Tableau de bord.
 *
 * Les donnees sont lues cote serveur et arrivent avec le HTML : le contenu
 * (et donc le plus grand element visible) s'affiche sans attendre
 * l'hydratation puis un aller-retour reseau. La meteo et les horaires de
 * priere, qui dependent de services externes, ont un budget d'attente court ;
 * s'ils le depassent, la vue les redemande aussitot cote client.
 */
const BUDGET_EXTERNE_MS = 1200;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const initialData = user
    ? await getDashboardData(user, { budgetExterneMs: BUDGET_EXTERNE_MS }).catch(() => null)
    : null;

  // Meme forme que la reponse JSON de l'API (dates en chaines, etc.).
  const serialisable = initialData ? (JSON.parse(JSON.stringify(initialData)) as DashboardData) : null;

  return <DashboardView initialData={serialisable} />;
}

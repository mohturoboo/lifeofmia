import { titreDePage } from '@/lib/metadata';

export const generateMetadata = titreDePage('nav.dashboard');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

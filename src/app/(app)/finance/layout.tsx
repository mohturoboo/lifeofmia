import { titreDePage } from '@/lib/metadata';

export const generateMetadata = titreDePage('nav.finance');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

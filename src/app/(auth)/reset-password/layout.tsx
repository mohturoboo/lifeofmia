import { titreDePage } from '@/lib/metadata';

export const generateMetadata = titreDePage('auth.resetTitle');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import { titreDePage } from '@/lib/metadata';

export const generateMetadata = titreDePage('auth.login');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

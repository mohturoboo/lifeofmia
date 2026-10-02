import { titreDePage } from '@/lib/metadata';

export const generateMetadata = titreDePage('auth.register');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

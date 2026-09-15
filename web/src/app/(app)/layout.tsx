import AppShell from '@/components/AppShell'

/** Every signed-in route renders inside the shell: nav, search, theme, sign-out. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

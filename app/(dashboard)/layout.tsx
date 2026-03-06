import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { DashboardNav } from '@/components/dashboard-nav';
import { Toaster } from '@/components/ui/sonner';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // If no valid session, clear any stale cookies and redirect
  if (!session) {
    // Use redirect with a query param to prevent loop
    redirect('/login?expired=true');
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={session.user} />
      <main>{children}</main>
      <Toaster />
    </div>
  );
}

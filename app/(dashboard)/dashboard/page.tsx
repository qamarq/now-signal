import { Suspense } from 'react';
import { EventsList } from '@/components/events-list';
import { EventsFilter } from '@/components/events-filter';
import { getSession } from '@/lib/auth-server';
import { db, subscriptions } from '@/lib/db';
import { eq } from 'drizzle-orm';

interface Props {
  searchParams: Promise<{ status?: string; sort?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = params.status;
  const sort = params.sort;

  // Get user session and subscription settings
  const session = await getSession();
  let userCategories: string[] = [];

  if (session?.user) {
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.user.id))
      .limit(1);

    if (subscription.length > 0) {
      userCategories = subscription[0].categories || [];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor global events in real-time
        </p>
      </div>

      <EventsFilter />

      <Suspense key={`${status}-${sort}`} fallback={<EventsListSkeleton />}>
        <EventsList
          status={status}
          sort={sort}
          userCategories={userCategories}
        />
      </Suspense>
    </div>
  );
}

function EventsListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-32 rounded-lg border bg-card animate-pulse" />
      ))}
    </div>
  );
}

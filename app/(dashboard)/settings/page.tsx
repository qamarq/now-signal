import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { db, subscriptions } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { SubscriptionForm } from '@/components/subscription-form';
import { NotificationSettings } from '@/components/notification-settings';
import { Separator } from '@/components/ui/separator';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // Get or create subscription for user
  let subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .limit(1)
    .then((rows) => rows[0]);

  // Create default subscription if none exists
  if (!subscription) {
    const [newSub] = await db
      .insert(subscriptions)
      .values({
        userId: session.user.id,
        categories: [],
        regions: [],
        sensitivity: 'med',
        earlyEnabled: false,
        maxPushPerDay: 10,
      })
      .returning();
    subscription = newSub;
  }

  return (
    <div className="space-y-6 container mx-auto py-6 px-4 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your notification preferences
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">Subscriptions</h2>
          <SubscriptionForm subscription={subscription} />
        </section>

        <Separator />

        <section>
          <h2 className="text-xl font-semibold mb-4">Notifications</h2>
          <NotificationSettings
            userId={session.user.id}
            discordWebhook={subscription.discordWebhook}
          />
        </section>
      </div>
    </div>
  );
}

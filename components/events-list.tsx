import Link from 'next/link';
import { db, eventClusters } from '@/lib/db';
import { desc, eq, and, gte, gt, inArray } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Eye, MapPin, Clock } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants';

interface EventsListProps {
  status?: string;
  sort?: string;
  userCategories?: string[];
}

export async function EventsList({
  status,
  sort,
  userCategories,
}: EventsListProps) {
  // Get events from the last 24 hours
  const oneDayAgo = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

  // Always filter out low confidence events (10 or less)
  const conditions = [
    gte(eventClusters.lastSeen, oneDayAgo),
    gt(eventClusters.confidence, 10),
  ];

  // Handle "For You" tab - filter by user's selected categories
  if (
    (!status || status === 'for-you') &&
    userCategories &&
    userCategories.length > 0
  ) {
    conditions.push(inArray(eventClusters.category, userCategories));
  } else if (status && status !== 'all' && status !== 'for-you') {
    conditions.push(eq(eventClusters.status, status));
  }

  // Determine sorting
  let orderByClause;
  switch (sort) {
    case 'confidence':
      orderByClause = desc(eventClusters.confidence);
      break;
    case 'earlyScore':
      orderByClause = desc(eventClusters.earlyScore);
      break;
    case 'confirmScore':
      orderByClause = desc(eventClusters.confirmScore);
      break;
    case 'time':
    default:
      orderByClause = desc(eventClusters.lastSeen);
      break;
  }

  const events = await db
    .select()
    .from(eventClusters)
    .where(and(...conditions))
    .orderBy(orderByClause)
    .limit(50);

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">No events found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Events will appear here as they are detected
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

function EventCard({ event }: { event: typeof eventClusters.$inferSelect }) {
  const statusConfig = {
    confirmed: {
      icon: CheckCircle,
      variant: 'default' as const,
      label: 'Confirmed',
    },
    early: {
      icon: AlertTriangle,
      variant: 'secondary' as const,
      label: 'Early',
    },
    watch: {
      icon: Eye,
      variant: 'outline' as const,
      label: 'Watch',
    },
  };

  const config =
    statusConfig[event.status as keyof typeof statusConfig] ||
    statusConfig.watch;
  const StatusIcon = config.icon;

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg line-clamp-2">
                {event.hypothesis || 'Developing event...'}
              </CardTitle>
              <CardDescription className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.regions?.join(', ') || 'Unknown region'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(event.lastSeen)}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={config.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {config.label}
              </Badge>
              <Badge variant="outline">
                {CATEGORIES.find((val) => val.value === event.category)
                  ?.label || event.category}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Confidence: {event.confidence}%</span>
            <span>Early Score: {event.earlyScore}</span>
            <span>Confirm Score: {event.confirmScore}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

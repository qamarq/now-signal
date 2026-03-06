import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db, eventClusters, clusterSignals, signals } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  MapPin,
  Clock,
  ArrowLeft,
  ExternalLink,
  Globe,
} from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;

  const event = await db
    .select()
    .from(eventClusters)
    .where(eq(eventClusters.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!event) {
    notFound();
  }

  // Get related signals
  const relatedSignals = await db
    .select({
      signal: signals,
    })
    .from(clusterSignals)
    .innerJoin(signals, eq(clusterSignals.signalId, signals.id))
    .where(eq(clusterSignals.clusterId, id))
    .orderBy(signals.publishedAt);

  const statusConfig = {
    confirmed: {
      icon: CheckCircle,
      variant: 'default' as const,
      label: 'Confirmed',
      color: 'text-green-500',
    },
    early: {
      icon: AlertTriangle,
      variant: 'secondary' as const,
      label: 'Early Signal',
      color: 'text-yellow-500',
    },
    watch: {
      icon: Eye,
      variant: 'outline' as const,
      label: 'Watch',
      color: 'text-blue-500',
    },
  };

  const config =
    statusConfig[event.status as keyof typeof statusConfig] ||
    statusConfig.watch;
  const StatusIcon = config.icon;

  const evidence = event.evidence as {
    sources?: string[];
    signalCount?: number;
    uniqueDomains?: string[];
    keywords?: string[];
  } | null;

  return (
    <div className="space-y-6 container mx-auto py-6 px-4">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={config.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                    <Badge variant="outline">{event.category}</Badge>
                  </div>
                  <CardTitle className="text-2xl">
                    {event.hypothesis || 'Developing event...'}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {event.regions?.join(', ') || 'Unknown region'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      First seen: {event.firstSeen.toLocaleString()}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{event.confidence}%</div>
                  <div className="text-sm text-muted-foreground">
                    Confidence
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{event.earlyScore}</div>
                  <div className="text-sm text-muted-foreground">
                    Early Score
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{event.confirmScore}</div>
                  <div className="text-sm text-muted-foreground">
                    Confirm Score
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sources ({relatedSignals.length})</CardTitle>
              <CardDescription>
                Signals contributing to this event cluster
              </CardDescription>
            </CardHeader>
            <CardContent>
              {relatedSignals.length === 0 ? (
                <p className="text-muted-foreground">No signals found</p>
              ) : (
                <div className="space-y-4">
                  {relatedSignals.map(({ signal }) => (
                    <div
                      key={signal.id}
                      className="flex items-start gap-4 p-4 rounded-lg border">
                      <Globe className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium line-clamp-2">
                            {signal.title}
                          </h4>
                          <Badge variant="outline" className="shrink-0">
                            {signal.source}
                          </Badge>
                        </div>
                        {signal.content && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {signal.content}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{signal.publishedAt.toLocaleString()}</span>
                          <a
                            href={signal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary">
                            <ExternalLink className="h-3 w-3" />
                            View source
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Cluster Key
                </div>
                <div className="font-mono text-xs break-all">
                  {event.clusterKey}
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </div>
                <div>{event.lastSeen.toLocaleString()}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  TTL Expires
                </div>
                <div>{event.ttlExpiresAt.toLocaleString()}</div>
              </div>
              {event.lastNotifiedAt && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Last Notification
                    </div>
                    <div>
                      {event.lastNotifiedStatus} at{' '}
                      {event.lastNotifiedAt.toLocaleString()}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {evidence && (
            <Card>
              <CardHeader>
                <CardTitle>Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {evidence.uniqueDomains &&
                  evidence.uniqueDomains.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Unique Domains ({evidence.uniqueDomains.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {evidence.uniqueDomains.map((domain) => (
                          <Badge key={domain} variant="secondary">
                            {domain}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                {evidence.keywords && evidence.keywords.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">
                      Keywords
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {evidence.keywords.map((keyword) => (
                        <Badge key={keyword} variant="outline">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Globe, Bell, Zap, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="flex justify-center">
            <Globe className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            World Pulse
          </h1>
          <p className="text-xl text-muted-foreground">
            Real-time global event detection and notifications.
            Know what's happening in the world before everyone else.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Zap className="h-8 w-8" />}
              title="Early Detection"
              description="Get notified about emerging events based on signal analysis from multiple sources before they hit mainstream news."
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8" />}
              title="Confirmed Events"
              description="Only receive notifications for events confirmed by multiple trusted sources, minimizing false positives."
            />
            <FeatureCard
              icon={<Bell className="h-8 w-8" />}
              title="Smart Notifications"
              description="Customize your preferences by category, region, and sensitivity. Set quiet hours and daily limits."
            />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">
          Stay Informed, Stay Ahead
        </h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Join World Pulse to receive real-time alerts about global events
          that matter to you.
        </p>
        <Link href="/register">
          <Button size="lg">Create Free Account</Button>
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>World Pulse MVP - Global Event Detection System</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center space-y-4 p-6 rounded-lg border bg-card">
      <div className="flex justify-center text-primary">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

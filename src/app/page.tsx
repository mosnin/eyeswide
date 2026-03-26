import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Building2,
  ArrowRight,
  CheckCircle2,
  Send,
  Users,
  Shield,
  Zap,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">
                EW
              </span>
            </div>
            <span className="text-lg font-bold">EyesWide</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" render={<Link href="/login" />}>Sign in</Button>
            <Button render={<Link href="/signup" />}>Get started</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Connect creators &<br />
          brands for{" "}
          <span className="text-primary">PR packages</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          EyesWide is the platform where brands discover creators, send PR
          package offers, and manage campaigns — all in one place. Simple,
          transparent, and built for collaboration.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" render={<Link href="/signup" />}>
              Start for free
              <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/signup" />}>
              I&apos;m a brand
              <Building2 className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">1. Create your profile</h3>
              <p className="mt-2 text-muted-foreground">
                Creators add their social media accounts and niches. Brands
                set up their company profile.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Send className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">2. Connect & collaborate</h3>
              <p className="mt-2 text-muted-foreground">
                Brands browse creators, send PR package offers with clear
                terms, and creators accept or decline.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">3. Manage campaigns</h3>
              <p className="mt-2 text-muted-foreground">
                Track deliverables, message each other, and mark campaigns
                complete — all from your dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold">Simple pricing</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Free for creators, one simple plan for brands.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:mx-auto lg:max-w-3xl">
            {/* Creator Plan */}
            <div className="rounded-2xl border p-8">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Creator</h3>
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold">Free</span>
                <span className="text-muted-foreground"> forever</span>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  "Create your creator profile",
                  "Add unlimited social accounts",
                  "Receive PR package offers",
                  "In-app messaging",
                  "Campaign management",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button className="mt-8 w-full" variant="outline" render={<Link href="/signup" />}>Sign up free</Button>
            </div>

            {/* Brand Plan */}
            <div className="rounded-2xl border-2 border-primary p-8 relative">
              <div className="absolute -top-3 left-6">
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  3-day free trial
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Brand</h3>
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold">$99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  "Unlimited creator discovery",
                  "Direct outreach to creators",
                  "Campaign management & tracking",
                  "In-app messaging",
                  "Analytics and reporting",
                  "Priority support",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button className="mt-8 w-full" render={<Link href="/signup" />}>Start free trial</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center">
              <Shield className="mb-3 h-8 w-8 text-primary" />
              <h3 className="font-semibold">Transparent terms</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Every campaign has clear requirements and deliverables
              </p>
            </div>
            <div className="flex flex-col items-center">
              <Sparkles className="mb-3 h-8 w-8 text-primary" />
              <h3 className="font-semibold">Quality creators</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Verified social profiles across all major platforms
              </p>
            </div>
            <div className="flex flex-col items-center">
              <Zap className="mb-3 h-8 w-8 text-primary" />
              <h3 className="font-semibold">Simple workflow</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                From discovery to completion in one seamless platform
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold">
            Ready to connect with the right partners?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Whether you&apos;re a creator looking for PR opportunities or a
            brand wanting to reach new audiences, EyesWide makes it easy.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" render={<Link href="/signup" />}>
                Get started now
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                <span className="text-xs font-bold text-primary-foreground">
                  EW
                </span>
              </div>
              <span className="text-sm font-medium">EyesWide</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} EyesWide. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

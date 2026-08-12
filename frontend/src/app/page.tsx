"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Map, Database, Shield, Zap, ArrowRight, Globe } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Database className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">DataPulse</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/map">
              <Button variant="ghost" size="sm">Map</Button>
            </Link>
            <Link href="/data-centers">
              <Button variant="ghost" size="sm">Data Centers</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-6 py-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Decentralized verification on Sepolia — powered by UMA &amp; juror courts
            </div>

            <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              The Intelligence Layer for{" "}
              <span className="bg-gradient-to-r from-primary via-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Data Center Infrastructure
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Contribute data center facts with USDC stakes on-chain. Verifiers attest via
              UMA&apos;s Optimistic Oracle, disputes are decided by randomly drawn juror
              panels — no admins, fully decentralized.
            </p>

            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/map">
                <Button size="lg" className="gap-2">
                  Explore the Map <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="lg">
                  Start Contributing
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-6 md:grid-cols-4"
          >
            {[
              { label: "Data Centers", value: "10,000+" },
              { label: "Countries", value: "190+" },
              { label: "Contributors", value: "500+" },
              { label: "Verified Claims", value: "25,000+" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-primary">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How It Works</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              A decentralized verification network that turns local expertise into global intelligence.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Map,
                title: "Interactive Map",
                desc: "Explore data centers, power grid status, ownership, and interconnection queues on a global map with layered data views.",
              },
              {
                icon: Shield,
                title: "Optimistic Verification",
                desc: "Contributors stake 20 USDC to submit facts; verifiers stake 200 USDC and assert truth on UMA OOV3. No dispute in 7 days — the claim settles itself.",
              },
              {
                icon: Globe,
                title: "Jury Disputes & Rewards",
                desc: "Challenges go to a randomly drawn panel of staked jurors. Majority voters earn USDC rewards; minority voters get slashed. Earn for accurate data.",
              },
            ].map((feature) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="glass-card rounded-2xl p-8"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold">Ready to contribute?</h2>
          <p className="mt-4 text-muted-foreground">
            Join the network of data center experts earning rewards for verified intelligence.
          </p>
          <Link href="/register">
            <Button size="lg" className="mt-8 gap-2">
              Create Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
          DataPulse — Data Center Intelligence Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

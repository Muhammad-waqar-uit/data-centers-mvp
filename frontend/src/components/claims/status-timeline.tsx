"use client";

import { motion } from "framer-motion";
import { Check, FileText, ShieldCheck, Clock, Flag, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type TimelineStatus =
  | "pending"
  | "attested"
  | "challenged"
  | "finalized"
  | "rejected";

const steps = [
  { key: "submitted", label: "Submitted", icon: FileText },
  { key: "attested", label: "Attested", icon: ShieldCheck },
  { key: "window", label: "Challenge Window", icon: Clock },
  { key: "outcome", label: "Outcome", icon: Flag },
];

/** Active step index per claim status */
function progressFor(status: TimelineStatus): { active: number; terminal: "ok" | "bad" | null } {
  switch (status) {
    case "pending":
      return { active: 0, terminal: null };
    case "attested":
      return { active: 2, terminal: null };
    case "challenged":
      return { active: 3, terminal: "bad" };
    case "finalized":
      return { active: 3, terminal: "ok" };
    case "rejected":
      return { active: 3, terminal: "bad" };
  }
}

export function ClaimStatusTimeline({ status }: { status: TimelineStatus }) {
  const { active, terminal } = progressFor(status);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const done = i < active || (i === active && terminal !== null);
        const current = i === active && terminal === null;
        const isOutcome = step.key === "outcome";
        const badTerminal = isOutcome && terminal === "bad";

        const Icon = isOutcome ? (badTerminal ? XCircle : Flag) : step.icon;

        return (
          <div key={step.key} className="flex items-center gap-1 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.08 }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  done && !badTerminal && "border-emerald-500 bg-emerald-500/15 text-emerald-400",
                  done && badTerminal && "border-red-500 bg-red-500/15 text-red-400",
                  current && "border-primary bg-primary/15 text-primary",
                  !done && !current && "border-border bg-secondary/40 text-muted-foreground/50"
                )}
              >
                {done && !badTerminal ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center truncate max-w-full",
                  current ? "text-primary" : done ? "text-foreground" : "text-muted-foreground/60",
                  badTerminal && done && "text-red-400"
                )}
              >
                {isOutcome
                  ? status === "finalized"
                    ? "Finalized"
                    : status === "rejected"
                      ? "Rejected"
                      : status === "challenged"
                        ? "Disputed"
                        : "Outcome"
                  : step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 rounded-full mb-4",
                  i < active ? "bg-emerald-500/60" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

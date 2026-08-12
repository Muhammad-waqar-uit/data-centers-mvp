import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "operating":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "under_construction":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "planned":
      return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case "stalled":
      return "text-red-400 bg-red-400/10 border-red-400/20";
    case "decommissioned":
      return "text-gray-400 bg-gray-400/10 border-gray-400/20";
    default:
      return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  }
}

export function getClaimStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "text-yellow-400 bg-yellow-400/10";
    case "attested":
      return "text-blue-400 bg-blue-400/10";
    case "challenged":
      return "text-red-400 bg-red-400/10";
    case "finalized":
      return "text-emerald-400 bg-emerald-400/10";
    case "rejected":
      return "text-gray-400 bg-gray-400/10";
    default:
      return "text-gray-400 bg-gray-400/10";
  }
}

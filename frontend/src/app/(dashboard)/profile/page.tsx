"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  User, Wallet, Shield, Star, TrendingUp, Award,
  Copy, ExternalLink, FileText,
} from "lucide-react";
import { usersApi, stakingApi } from "@/lib/api";
import { formatAddress } from "@/lib/utils";
import type { User as UserType } from "@/types";

export default function ProfilePage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [stakingStats, setStakingStats] = useState({ totalStaked: 0, totalEarned: 0, totalSlashed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const [userRes, stakingRes] = await Promise.all([
        usersApi.me(),
        stakingApi.stats(),
      ]);
      setUser(userRes.data);
      setStakingStats(stakingRes.data);
    } catch {
      setUser({
        id: "u1", email: "contributor@datapulse.io", walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        role: "contributor", displayName: "Alex Chen", reputationScore: 92,
        totalClaimsSubmitted: 15, totalClaimsVerified: 8, totalEarnings: 1250,
        avatarUrl: null, createdAt: "2024-01-15",
      });
      setStakingStats({ totalStaked: 750, totalEarned: 1250, totalSlashed: 0 });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-full" /><div><Skeleton className="h-6 w-40 mb-2" /><Skeleton className="h-4 w-24" /></div></div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 text-xl" fallback={user.displayName?.charAt(0) || user.email.charAt(0)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold truncate">{user.displayName || user.email}</h1>
                  <Badge variant={user.role === "admin" ? "danger" : user.role === "verifier" ? "success" : "default"}>
                    {user.role}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.walletAddress && (
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-xs text-muted-foreground font-mono">{formatAddress(user.walletAddress)}</code>
                    <button className="text-muted-foreground hover:text-foreground cursor-pointer">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Star className="h-5 w-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold">{user.reputationScore}</p>
            <p className="text-xs text-muted-foreground">Reputation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <FileText className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{user.totalClaimsSubmitted}</p>
            <p className="text-xs text-muted-foreground">Claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Shield className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold">{user.totalClaimsVerified}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold">${user.totalEarnings}</p>
            <p className="text-xs text-muted-foreground">Earned</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Staking */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Staking Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-xl font-bold">${stakingStats.totalStaked}</p>
                <p className="text-xs text-muted-foreground">Total Staked</p>
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-400">${stakingStats.totalEarned}</p>
                <p className="text-xs text-muted-foreground">Rewards Earned</p>
              </div>
              <div>
                <p className="text-xl font-bold text-destructive">${stakingStats.totalSlashed}</p>
                <p className="text-xs text-muted-foreground">Slashed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Activity */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" /> Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

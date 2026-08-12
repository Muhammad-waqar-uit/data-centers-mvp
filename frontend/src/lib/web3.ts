"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, type Chain } from "wagmi";
import { sepolia } from "wagmi/chains";

const sepoliaChain: Chain = {
  ...sepolia,
  rpcUrls: {
    ...sepolia.rpcUrls,
    default: {
      http: [
        process.env.NEXT_PUBLIC_RPC_URL || sepolia.rpcUrls.default.http[0],
      ],
    },
  },
};

export const config = getDefaultConfig({
  appName: "DataPulse",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "datapulse-dev",
  chains: [sepoliaChain],
  transports: {
    [sepoliaChain.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL || sepolia.rpcUrls.default.http[0]
    ),
  },
  ssr: true,
});

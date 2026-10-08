import { base, baseSepolia } from "viem/chains";

export const networks = {
  "base-sepolia": {
    chain: baseSepolia,
    rpcs: ["https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"],
    explorer: "https://sepolia.basescan.org",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    weth: "0x4200000000000000000000000000000000000006",
    testnet: true,
  },
  base: {
    chain: base,
    rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://base.drpc.org"],
    explorer: "https://basescan.org",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    weth: "0x4200000000000000000000000000000000000006",
    // Aave v3 on Base, verified on-chain via PoolAddressesProvider 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    aUsdc: "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
    testnet: false,
  },
};

export function getNetwork(name) {
  const net = networks[name];
  if (!net) throw new Error(`Unknown network "${name}". Use one of: ${Object.keys(networks).join(", ")}`);
  return net;
}

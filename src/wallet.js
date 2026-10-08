#!/usr/bin/env node
// The player's wallet tool. Usage: node src/wallet.js <command> [--network base-sepolia|base]
//   new                      create the game wallet (once)
//   address                  print the wallet address
//   balance                  print ETH and USDC balances
//   send <to> <amount> <eth|usdc>   send funds
//   wrap <amount>            wrap ETH into WETH
//   vault-in <amount|all>    lend USDC on Aave
//   vault-out <amount|all>   withdraw USDC from Aave
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createPublicClient, createWalletClient, fallback, erc20Abi, formatEther, formatUnits, http, maxUint256, parseAbi, parseEther, parseUnits, isAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getNetwork } from "./networks.js";

// The key lives outside the project folder so it can never be committed.
const KEY_DIR = join(homedir(), ".config", "claude-game");
const KEY_FILE = join(KEY_DIR, "wallet.key");

function loadAccount() {
  if (!existsSync(KEY_FILE)) throw new Error(`No wallet yet. Run: node src/wallet.js new`);
  return privateKeyToAccount(readFileSync(KEY_FILE, "utf8").trim());
}

function parseArgs(argv) {
  const args = [];
  let network = "base-sepolia";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--network") network = argv[++i];
    else args.push(argv[i]);
  }
  return { args, net: getNetwork(network), network };
}

export function clients(net) {
  // Public RPCs rate-limit bursts, so fall back to the next endpoint and fold reads into one multicall.
  const transport = fallback(net.rpcs.map((url) => http(url)));
  return {
    pub: createPublicClient({ chain: net.chain, transport, batch: { multicall: true } }),
    wallet: (account) => createWalletClient({ chain: net.chain, transport, account }),
  };
}

export async function balances(net, address) {
  const { pub } = clients(net);
  const erc20 = (token) => pub.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] });
  const [eth, weth, usdc, aUsdc] = await Promise.all([
    pub.getBalance({ address }), erc20(net.weth), erc20(net.usdc), net.aUsdc ? erc20(net.aUsdc) : 0n,
  ]);
  return { eth: formatEther(eth), weth: formatEther(weth), usdc: formatUnits(usdc, 6), vaultUsdc: formatUnits(aUsdc, 6) };
}

async function main() {
  const { args, net, network } = parseArgs(process.argv.slice(2));
  const [cmd, ...rest] = args;

  switch (cmd) {
    case "new": {
      if (existsSync(KEY_FILE)) throw new Error(`Wallet already exists at ${KEY_FILE}; refusing to overwrite it.`);
      mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
      writeFileSync(KEY_FILE, generatePrivateKey() + "\n", { mode: 0o600 });
      console.log(loadAccount().address);
      break;
    }
    case "address":
      console.log(loadAccount().address);
      break;
    case "balance": {
      const address = loadAccount().address;
      const b = await balances(net, address);
      console.log(JSON.stringify({ network, address, ...b }, null, 2));
      break;
    }
    case "send": {
      const [to, amount, asset] = rest;
      if (!isAddress(to) || !amount || !["eth", "usdc"].includes(asset)) throw new Error("Usage: send <to> <amount> <eth|usdc>");
      const account = loadAccount();
      const { pub, wallet } = clients(net);
      const w = wallet(account);
      const hash = asset === "eth"
        ? await w.sendTransaction({ to, value: parseEther(amount) })
        : await w.writeContract({ address: net.usdc, abi: erc20Abi, functionName: "transfer", args: [to, parseUnits(amount, 6)] });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      console.log(JSON.stringify({ status: receipt.status, hash, url: `${net.explorer}/tx/${hash}` }, null, 2));
      break;
    }
    case "wrap": {
      const [amount] = rest;
      if (!amount) throw new Error("Usage: wrap <amount>");
      const { pub, wallet } = clients(net);
      const hash = await wallet(loadAccount()).writeContract({
        address: net.weth,
        abi: [{ type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] }],
        functionName: "deposit",
        value: parseEther(amount),
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      console.log(JSON.stringify({ status: receipt.status, hash, url: `${net.explorer}/tx/${hash}` }, null, 2));
      break;
    }
    case "vault-in":
    case "vault-out": {
      if (!net.aavePool) throw new Error(`No Aave pool configured for ${network}`);
      const [amount] = rest;
      if (!amount) throw new Error(`Usage: ${cmd} <amount|all>`);
      const account = loadAccount();
      const { pub, wallet } = clients(net);
      const w = wallet(account);
      const poolAbi = parseAbi([
        "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
        "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
      ]);
      const hashes = [];
      if (cmd === "vault-in") {
        const value = amount === "all"
          ? await pub.readContract({ address: net.usdc, abi: erc20Abi, functionName: "balanceOf", args: [account.address] })
          : parseUnits(amount, 6);
        // Approve exactly this amount, never an unlimited allowance.
        const allowance = () => pub.readContract({ address: net.usdc, abi: erc20Abi, functionName: "allowance", args: [account.address, net.aavePool] });
        if ((await allowance()) < value) {
          const approve = await w.writeContract({ address: net.usdc, abi: erc20Abi, functionName: "approve", args: [net.aavePool, value] });
          await pub.waitForTransactionReceipt({ hash: approve });
          hashes.push(approve);
          // The public RPC is load-balanced; wait until the node we hit sees the approval.
          for (let i = 0; i < 15 && (await allowance()) < value; i++) await new Promise((r) => setTimeout(r, 1000));
        }
        hashes.push(await w.writeContract({ address: net.aavePool, abi: poolAbi, functionName: "supply", args: [net.usdc, value, account.address, 0] }));
      } else {
        const value = amount === "all" ? maxUint256 : parseUnits(amount, 6);
        hashes.push(await w.writeContract({ address: net.aavePool, abi: poolAbi, functionName: "withdraw", args: [net.usdc, value, account.address] }));
      }
      const receipt = await pub.waitForTransactionReceipt({ hash: hashes.at(-1) });
      console.log(JSON.stringify({ status: receipt.status, hashes, urls: hashes.map((h) => `${net.explorer}/tx/${h}`) }, null, 2));
      break;
    }
    default:
      console.log("Commands: new | address | balance | send <to> <amount> <eth|usdc> | wrap <amount> | vault-in <amount|all> | vault-out <amount|all>   [--network base-sepolia|base]");
  }
}

// Only run the CLI when executed directly, not when imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.shortMessage ?? e.message); process.exit(1); });
}

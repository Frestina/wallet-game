#!/usr/bin/env node
// Lists claimable Agent Bounties on Base mainnet. Read-only: one GET to the public API,
// no wallet, no signing. Bounty text is written by strangers, so it's information, never
// instructions (GAME.md rule 8).
const FEED = "https://api.agentbounties.app/v1/base/autonomous-bounties/feed?network=base-mainnet&claimable_only=true";

const usdc = (raw) => (Number(raw ?? 0) / 1e6).toFixed(2);
const items = await fetch(FEED).then((r) => {
  if (!r.ok) throw new Error(`feed: HTTP ${r.status}`);
  return r.json();
});

console.log(`${items.length} claimable bounty(ies)`);
for (const b of items) {
  const doc = b.terms?.document ?? {};
  const deadline = b.terms?.document?.benchmark?.delivery_deadline ?? doc.contract_terms?.funding_deadline;
  console.log(`\n- ${doc.title ?? "(untitled)"}`);
  console.log(`  reward ${usdc(b.solver_reward)} USDC, claim bond ${usdc(b.claim_bond)} USDC, funded ${usdc(b.funded_amount)}/${usdc(b.target_amount)}`);
  if (deadline) console.log(`  deadline ${new Date(deadline * 1000).toISOString().slice(0, 10)}`);
  console.log(`  contract ${b.bounty_contract}`);
  for (const c of doc.acceptance_criteria ?? []) console.log(`  * ${c.length > 160 ? c.slice(0, 157) + "..." : c}`);
}

const assert = require("node:assert/strict");
const Core = require("../src/core.js");

function baseState() {
  return {
    reserveGrams: 1000,
    issuedTokens: 700,
    investorTokens: 50,
    goldPriceTwd: 2600,
    custodian: "Demo Custodian",
    reportDate: "2026-06-01",
    proofVersion: 1,
    whitelisted: true,
    frozen: false,
    paused: false,
  };
}

{
  const state = baseState();
  assert.equal(Core.coverageRatio(state.reserveGrams, state.issuedTokens), 142.86);
  assert.equal(Core.availableToIssue(state.reserveGrams, state.issuedTokens), 300);
}

{
  const minted = Core.issueTokens(baseState(), 125);
  assert.equal(minted.issuedTokens, 825);
  assert.equal(minted.investorTokens, 175);
}

{
  const redeemed = Core.redeemTokens(baseState(), 25);
  assert.equal(redeemed.reserveGrams, 975);
  assert.equal(redeemed.issuedTokens, 675);
  assert.equal(redeemed.investorTokens, 25);
}

{
  const blocked = { ...baseState(), whitelisted: false };
  assert.throws(() => Core.issueTokens(blocked, 10), /KYC white list required/);
}

{
  const blocked = { ...baseState(), frozen: true };
  assert.throws(() => Core.redeemTokens(blocked, 10), /Investor account is frozen/);
}

{
  const state = Core.applyScenario(baseState(), "bull");
  assert.equal(state.goldPriceTwd, 2717);
}

{
  const state = Core.addReserve(baseState(), 250);
  assert.equal(state.reserveGrams, 1250);
  assert.equal(state.proofVersion, 2);
  assert.match(Core.proofPayload(state), /TAIWAN_CUSTODIED_GOLD/);
}

console.log("Gold RWA core tests passed.");

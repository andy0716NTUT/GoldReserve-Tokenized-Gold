(function (root) {
  "use strict";

  const ROUND = 100;

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * ROUND) / ROUND;
  }

  function coverageRatio(reserveGrams, issuedTokens) {
    if (issuedTokens <= 0) return 100;
    return round2((reserveGrams / issuedTokens) * 100);
  }

  function availableToIssue(reserveGrams, issuedTokens) {
    return round2(Math.max(0, reserveGrams - issuedTokens));
  }

  function canIssue(state, grams) {
    if (!state.whitelisted) return { ok: false, reason: "KYC white list required" };
    if (state.frozen) return { ok: false, reason: "Investor account is frozen" };
    if (state.paused) return { ok: false, reason: "Contract is paused" };
    if (grams <= 0) return { ok: false, reason: "Amount must be greater than zero" };
    if (grams > availableToIssue(state.reserveGrams, state.issuedTokens)) {
      return { ok: false, reason: "Insufficient audited reserve coverage" };
    }
    return { ok: true, reason: "Ready" };
  }

  function canRedeem(state, tokens) {
    if (!state.whitelisted) return { ok: false, reason: "KYC white list required" };
    if (state.frozen) return { ok: false, reason: "Investor account is frozen" };
    if (state.paused) return { ok: false, reason: "Contract is paused" };
    if (tokens <= 0) return { ok: false, reason: "Amount must be greater than zero" };
    if (tokens > state.investorTokens) return { ok: false, reason: "Investor balance is not enough" };
    return { ok: true, reason: "Ready" };
  }

  function issueTokens(state, grams) {
    const check = canIssue(state, grams);
    if (!check.ok) throw new Error(check.reason);
    return {
      ...state,
      issuedTokens: round2(state.issuedTokens + grams),
      investorTokens: round2(state.investorTokens + grams),
    };
  }

  function redeemTokens(state, tokens) {
    const check = canRedeem(state, tokens);
    if (!check.ok) throw new Error(check.reason);
    return {
      ...state,
      reserveGrams: round2(state.reserveGrams - tokens),
      issuedTokens: round2(state.issuedTokens - tokens),
      investorTokens: round2(state.investorTokens - tokens),
    };
  }

  function addReserve(state, grams) {
    if (grams <= 0) throw new Error("Reserve amount must be greater than zero");
    return {
      ...state,
      reserveGrams: round2(state.reserveGrams + grams),
      proofVersion: state.proofVersion + 1,
    };
  }

  function applyScenario(state, scenario) {
    const scenarios = {
      bull: { priceDelta: 0.045, reserveDelta: 0 },
      flat: { priceDelta: 0, reserveDelta: 0 },
      stress: { priceDelta: -0.035, reserveDelta: -0.01 },
    };
    const selected = scenarios[scenario] || scenarios.flat;
    return {
      ...state,
      goldPriceTwd: round2(state.goldPriceTwd * (1 + selected.priceDelta)),
      reserveGrams: round2(state.reserveGrams * (1 + selected.reserveDelta)),
    };
  }

  function portfolioValue(state) {
    return round2(state.investorTokens * state.goldPriceTwd);
  }

  function proofPayload(state) {
    return JSON.stringify({
      asset: "TAIWAN_CUSTODIED_GOLD",
      custodian: state.custodian,
      reserveGrams: round2(state.reserveGrams),
      issuedTokens: round2(state.issuedTokens),
      proofVersion: state.proofVersion,
      reportDate: state.reportDate,
    });
  }

  const api = {
    addReserve,
    applyScenario,
    availableToIssue,
    canIssue,
    canRedeem,
    coverageRatio,
    issueTokens,
    portfolioValue,
    proofPayload,
    redeemTokens,
    round2,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.GoldRwaCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

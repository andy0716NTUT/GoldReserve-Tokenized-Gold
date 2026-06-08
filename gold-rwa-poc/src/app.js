const Core = window.GoldRwaCore;
const appConfig = window.GOLD_RWA_CONFIG;

const publicAbi = [
  "function reserveGrams() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function latestProofHash() view returns (bytes32)",
  "function paused() view returns (bool)",
  "event Minted(address indexed to, uint256 amount)",
  "event BurnedForRedemption(address indexed from, uint256 amount)",
  "event ProofUpdated(bytes32 indexed proofHash, uint256 reserveGrams, uint256 proofVersion)",
  "event PausedUpdated(bool paused)",
];

let state = {
  reserveGrams: 125000,
  issuedTokens: 102000,
  investorTokens: 250,
  goldPriceTwd: 2680,
  custodian: "Taiwan Bullion Custody",
  reportDate: "2026-06-01",
  proofVersion: 1,
  whitelisted: true,
  frozen: false,
  paused: false,
};

let chainState = {
  reserveGrams: state.reserveGrams,
  issuedTokens: state.issuedTokens,
  paused: state.paused,
  proofHash: "",
};

let publicProvider;
let publicContract;
let publicContractListeners;

const events = [
  {
    name: "InvestorViewLoaded",
    detail: "Loaded public reserve proof, token supply, and investor portfolio.",
  },
];

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function addEvent(name, detail) {
  events.unshift({ name, detail, time: new Date().toLocaleTimeString("zh-TW") });
  if (events.length > 9) events.pop();
}

function clearPublicListeners() {
  if (!publicContract || !publicContractListeners) return;
  for (const { eventName, handler } of publicContractListeners) {
    publicContract.off(eventName, handler);
  }
  publicContractListeners = undefined;
}

function setupPublicListeners() {
  if (!publicContract) return;
  clearPublicListeners();

  const listeners = [
    {
      eventName: "Minted",
      handler: async (to, amount) => {
        addEvent("ChainMintDetected", `偵測到鏈上新發行 ${amount.toString()} GGT 給 ${to}`);
        await refreshPublicChainState();
      },
    },
    {
      eventName: "BurnedForRedemption",
      handler: async (from, amount) => {
        addEvent("ChainBurnDetected", `偵測到鏈上燒毀 ${amount.toString()} GGT（${from}）`);
        await refreshPublicChainState();
      },
    },
    {
      eventName: "ProofUpdated",
      handler: async () => {
        addEvent("ProofUpdated", "偵測到最新儲備證明已更新。");
        await refreshPublicChainState();
      },
    },
    {
      eventName: "PausedUpdated",
      handler: async (paused) => {
        addEvent("ContractStatusUpdated", paused ? "偵測到合約已暫停。" : "偵測到合約已恢復運作。");
        await refreshPublicChainState();
      },
    },
  ];

  for (const listener of listeners) {
    publicContract.on(listener.eventName, listener.handler);
  }

  publicContractListeners = listeners;
}

async function refreshPublicChainState() {
  if (!publicContract) return;
  const [reserve, supply, proofHash, paused] = await Promise.all([
    publicContract.reserveGrams(),
    publicContract.totalSupply(),
    publicContract.latestProofHash(),
    publicContract.paused(),
  ]);

  chainState = {
    reserveGrams: Number(reserve),
    issuedTokens: Number(supply),
    paused,
    proofHash,
  };

  await render();
}

async function initPublicChainRead() {
  publicProvider = new ethers.JsonRpcProvider(appConfig.publicRpcUrl);
  publicContract = new ethers.Contract(appConfig.contractAddress, publicAbi, publicProvider);
  setupPublicListeners();
  addEvent("PublicChainReadReady", "已啟用公開鏈上讀取與事件監聽。");
  await refreshPublicChainState();
}

window.GoldRwaAddEvent = addEvent;
window.GoldRwaRenderEvents = render;

async function render() {
  const reserveGrams = chainState.reserveGrams;
  const issuedTokens = chainState.issuedTokens;
  const paused = chainState.paused;
  const coverage = Core.coverageRatio(reserveGrams, issuedTokens);
  const proof =
    chainState.proofHash && chainState.proofHash !== ethers.ZeroHash
      ? chainState.proofHash
      : `0x${await sha256(Core.proofPayload({ ...state, reserveGrams, issuedTokens }))}`;

  $("reserveGrams").textContent = `${fmt.format(reserveGrams)} g`;
  $("issuedTokens").textContent = `${fmt.format(issuedTokens)} GGT`;
  $("coverageRatio").textContent = `${fmt.format(coverage)}%`;
  $("coverageStatus").textContent = coverage >= 100 ? "fully backed" : "reserve warning";
  $("portfolioValue").textContent = money.format(Core.portfolioValue(state));
  $("investorTokens").textContent = `${fmt.format(state.investorTokens)} GGT`;
  $("investorHoldingReadout").textContent = `${fmt.format(state.investorTokens)} GGT`;
  $("proofHash").textContent = proof;
  $("custodian").textContent = state.custodian;
  $("goldPrice").textContent = `${money.format(state.goldPriceTwd)} / gram`;
  $("availableIssue").textContent = `${fmt.format(Core.availableToIssue(reserveGrams, issuedTokens))} GGT`;
  $("whitelistStatus").textContent = state.whitelisted ? "已通過" : "未通過";
  $("frozenStatus").textContent = state.frozen ? "已凍結" : "未凍結";
  $("pausedStatus").textContent = paused ? "已暫停" : "正常運作";

  $("eventLog").innerHTML = events
    .map((event) => {
      const time = event.time || "system";
      return `<tr><td>${time}</td><td>${event.name}</td><td>${event.detail}</td></tr>`;
    })
    .join("");
}

render();
initPublicChainRead().catch((error) => {
  addEvent("PublicChainReadFailed", error.shortMessage || error.message || "公開鏈上讀取失敗。");
  render();
});

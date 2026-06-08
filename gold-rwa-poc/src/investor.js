const investorConfig = window.GOLD_RWA_CONFIG;

const investorAbi = [
  "function balanceOf(address account) view returns (uint256)",
  "function whitelist(address account) view returns (bool)",
  "function frozen(address account) view returns (bool)",
  "function paused() view returns (bool)",
  "function burnForRedemption(uint256 amount)",
];

let investorProvider;
let investorSigner;
let investorContract;
let investorAccount = "";

const investor$ = (id) => document.getElementById(id);
const investorFmt = new Intl.NumberFormat("zh-TW");

function investorShort(address) {
  if (!address || address.length < 12) return address || "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function investorLog(name, detail) {
  if (window.GoldRwaAddEvent && window.GoldRwaRenderEvents) {
    window.GoldRwaAddEvent(name, detail);
    window.GoldRwaRenderEvents();
  }
}

async function switchInvestorToSepolia() {
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: investorConfig.chainIdHex }],
  });
}

async function connectInvestorWallet() {
  const shouldContinue = window.GoldRwaWallet?.ensureWalletProvider?.() ?? !!window.ethereum;
  if (!shouldContinue) return;
  await switchInvestorToSepolia();
  investorProvider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await investorProvider.send("eth_requestAccounts", []);
  investorSigner = await investorProvider.getSigner();
  investorAccount = accounts[0];
  investorContract = new ethers.Contract(investorConfig.contractAddress, investorAbi, investorSigner);
  investor$("investorWalletAddress").textContent = investorShort(investorAccount);
  investor$("connectInvestorBtn").textContent = "已連接 MetaMask";
  await refreshInvestorState();
}

async function refreshInvestorState() {
  if (!investorContract || !investorAccount) return;
  const [balance, allowed, isFrozen, isPaused] = await Promise.all([
    investorContract.balanceOf(investorAccount),
    investorContract.whitelist(investorAccount),
    investorContract.frozen(investorAccount),
    investorContract.paused(),
  ]);
  const status = [
    allowed ? "白名單已通過" : "尚未在白名單",
    isFrozen ? "帳戶已凍結" : "帳戶未凍結",
    isPaused ? "合約暫停" : "合約正常",
  ].join(" / ");
  investor$("chainInvestorBalance").textContent = `${investorFmt.format(Number(balance))} GGT`;
  investorLog("InvestorStatusRead", status);
}

async function ensureInvestorConnected() {
  if (!investorContract) {
    await connectInvestorWallet();
  }
}

function readPositiveAmount(id, label) {
  const value = BigInt(investor$(id).value || "0");
  if (value <= 0n) throw new Error(`${label} 必須大於 0`);
  return value;
}

investor$("connectInvestorBtn").addEventListener("click", () => {
  connectInvestorWallet().catch((error) => {
    investorLog("WalletConnectFailed", error.shortMessage || error.message);
  });
});

investor$("refreshInvestorViewBtn").addEventListener("click", async () => {
  try {
    if (investorContract) {
      await refreshInvestorState();
      investorLog("InvestorViewRefreshed", "已重新讀取鏈上 GGT 餘額與帳戶狀態。");
    } else {
      investorLog("InvestorViewRefreshed", "已刷新平台資料；連接 MetaMask 後可讀取鏈上餘額。");
    }
  } catch (error) {
    investorLog("InvestorRefreshFailed", error.shortMessage || error.message);
  }
});

investor$("subscribeRequestBtn").addEventListener("click", async () => {
  try {
    await ensureInvestorConnected();
    const amount = readPositiveAmount("subscribeAmountInput", "認購數量");
    const confirmed = window.confirm(
      `確認送出申購申請？\n\n錢包地址：${investorShort(investorAccount)}\n申購數量：${amount.toString()} GGT`,
    );
    if (!confirmed) {
      investorLog("SubscribeCancelled", "使用者取消送出申購申請。");
      return;
    }
    const request = window.GoldRwaRequests.addRequest(investorAccount, amount);
    investorLog(
      "SubscribeRequested",
      `${investorShort(investorAccount)} 申請認購 ${amount.toString()} GGT，申請編號 ${request.id}，等待管理者審核與鏈上發行。`,
    );
    window.alert(`已送出申購申請。\n\n申請編號：${request.id}\n申購數量：${amount.toString()} GGT`);
  } catch (error) {
    investorLog("SubscribeRejected", error.shortMessage || error.message);
  }
});

investor$("redeemOnchainBtn").addEventListener("click", async () => {
  try {
    await ensureInvestorConnected();
    const amount = readPositiveAmount("redeemChainAmountInput", "贖回數量");
    investorLog("RedeemStarted", "等待 MetaMask 確認 burnForRedemption 交易。");
    const tx = await investorContract.burnForRedemption(amount);
    investorLog("RedeemSubmitted", `交易已送出：${tx.hash}`);
    await tx.wait();
    investorLog("RedeemConfirmed", `${amount.toString()} GGT 已鏈上燒毀，請接續處理實體黃金提領流程。`);
    await refreshInvestorState();
  } catch (error) {
    investorLog("RedeemRejected", error.shortMessage || error.message);
  }
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => {
    connectInvestorWallet().catch(() => {});
  });
  window.ethereum.on("chainChanged", () => window.location.reload());
}

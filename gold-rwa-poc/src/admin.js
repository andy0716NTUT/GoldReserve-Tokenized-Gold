const config = window.GOLD_RWA_CONFIG;

const abi = [
  "function owner() view returns (address)",
  "function issuer() view returns (address)",
  "function auditor() view returns (address)",
  "function custodian() view returns (address)",
  "function paused() view returns (bool)",
  "function reserveGrams() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function latestProofHash() view returns (bytes32)",
  "function balanceOf(address account) view returns (uint256)",
  "function whitelist(address account) view returns (bool)",
  "function frozen(address account) view returns (bool)",
  "function updateReserveProof(uint256 newReserveGrams, bytes32 proofHash)",
  "function mintByReserve(address to, uint256 amount)",
  "function setWhitelist(address account, bool allowed)",
  "function setFrozen(address account, bool isFrozen)",
  "function setPaused(bool isPaused)",
  "event Minted(address indexed to, uint256 amount)",
  "event BurnedForRedemption(address indexed from, uint256 amount)",
  "event ProofUpdated(bytes32 indexed proofHash, uint256 reserveGrams, uint256 proofVersion)",
  "event PausedUpdated(bool paused)",
];

let provider;
let signer;
let contract;
let publicProvider;
let publicContract;
let currentAccount = "";
let activeListenerContract;
let activeContractListeners;

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat("zh-TW");

function shortAddress(address) {
  if (!address || address.length < 12) return address || "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function addLog(action, result, txHash) {
  const link = txHash
    ? `<a class="text-link" href="${config.etherscanBaseUrl}/tx/${txHash}" target="_blank" rel="noreferrer">${shortAddress(txHash)}</a>`
    : result;
  $("adminLog").insertAdjacentHTML(
    "afterbegin",
    `<tr><td>${new Date().toLocaleTimeString("zh-TW")}</td><td>${action}</td><td>${link}</td></tr>`,
  );
}

function clearContractListeners() {
  if (!activeContractListeners || !activeListenerContract) return;
  for (const { eventName, handler } of activeContractListeners) {
    activeListenerContract.off(eventName, handler);
  }
  activeListenerContract = undefined;
  activeContractListeners = undefined;
}

function getReadContract() {
  return publicContract || contract;
}

function setupContractListeners(contractInstance) {
  if (!contractInstance) return;
  clearContractListeners();

  const listeners = [
    {
      eventName: "Minted",
      handler: async (to, amount) => {
        addLog("Live Update", `偵測到發行 ${amount.toString()} GGT 給 ${shortAddress(to)}`);
        await refreshState();
      },
    },
    {
      eventName: "BurnedForRedemption",
      handler: async (from, amount) => {
        addLog("Live Update", `偵測到贖回燒毀 ${amount.toString()} GGT（${shortAddress(from)}）`);
        await refreshState();
      },
    },
    {
      eventName: "ProofUpdated",
      handler: async () => {
        addLog("Live Update", "偵測到儲備證明已更新");
        await refreshState();
      },
    },
    {
      eventName: "PausedUpdated",
      handler: async (paused) => {
        addLog("Live Update", paused ? "偵測到合約已暫停" : "偵測到合約已恢復");
        await refreshState();
      },
    },
  ];

  for (const listener of listeners) {
    contractInstance.on(listener.eventName, listener.handler);
  }

  activeListenerContract = contractInstance;
  activeContractListeners = listeners;
}

function renderSubscriptionRequests() {
  const container = $("subscriptionRequests");
  const requests = window.GoldRwaRequests.readRequests();

  if (!requests.length) {
    container.innerHTML = '<div class="empty-state">目前沒有申購申請。</div>';
    return;
  }

  container.innerHTML = requests
    .map((request) => {
      const created = new Date(request.createdAt).toLocaleString("zh-TW");
      const isProcessed = request.status === "processed";
      return `
        <article class="request-item ${request.status}">
          <div>
            <span>${created}</span>
            <strong>${shortAddress(request.walletAddress)} 申請 ${request.amount} GGT</strong>
            <code>${request.walletAddress}</code>
          </div>
          <div class="request-actions">
            <small>${isProcessed ? "已處理" : "待審核"}</small>
            <button class="command primary process-request" data-id="${request.id}" ${isProcessed ? "disabled" : ""}>${isProcessed ? "已發行完成" : "直接審核並發行"}</button>
            <button class="command load-request" data-id="${request.id}">帶入下方欄位</button>
            <button class="command mark-processed" data-id="${request.id}" ${isProcessed ? "disabled" : ""}>標記已處理</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function loadSubscriptionRequest(id) {
  const request = window.GoldRwaRequests.readRequests().find((item) => item.id === id);
  if (!request) {
    addLog("Load Request", "找不到申購申請");
    return;
  }
  $("controlAddressInput").value = request.walletAddress;
  $("mintToInput").value = request.walletAddress;
  $("mintAmountInput").value = request.amount;
  addLog("Load Request", `已載入 ${shortAddress(request.walletAddress)} / ${request.amount} GGT`);
}

async function processSubscriptionRequest(id) {
  const request = window.GoldRwaRequests.readRequests().find((item) => item.id === id);
  if (!request) {
    addLog("Process Request", "Request not found");
    return;
  }
  if (request.status === "processed") {
    addLog("Process Request", "Request already processed");
    return;
  }

  try {
    if (!contract) await connectWallet();

    const to = requireAddress(request.walletAddress, "申購地址");
    const amount = requireAmount(request.amount, "申購數量");

    $("controlAddressInput").value = to;
    $("mintToInput").value = to;
    $("mintAmountInput").value = amount.toString();

    const isWhitelisted = await contract.whitelist(to);
    if (!isWhitelisted) {
      addLog("Process Request", `Approve whitelist for ${shortAddress(to)}`);
      const whitelistTx = await contract.setWhitelist(to, true);
      addLog("Process Request", "Whitelist tx submitted", whitelistTx.hash);
      await whitelistTx.wait();
      addLog("Process Request", `Whitelist ready for ${shortAddress(to)}`, whitelistTx.hash);
    }

    addLog("Process Request", `Mint ${amount.toString()} GGT to ${shortAddress(to)}`);
    const mintTx = await contract.mintByReserve(to, amount);
    addLog("Process Request", "Mint tx submitted", mintTx.hash);
    await mintTx.wait();

    window.GoldRwaRequests.updateRequestStatus(id, "processed");
    renderSubscriptionRequests();
    addLog("Process Request", `Completed ${amount.toString()} GGT for ${shortAddress(to)}`, mintTx.hash);
    await refreshState();
  } catch (error) {
    addLog("Process Request", error.shortMessage || error.message || "Transaction failed");
  }
}

function requireAddress(value, label) {
  const address = value.trim();
  if (!ethers.isAddress(address)) {
    throw new Error(`${label} 不是有效的 Ethereum 地址`);
  }
  return address;
}

function requireAmount(value, label) {
  const amount = BigInt(value || "0");
  if (amount <= 0n) throw new Error(`${label} 必須大於 0`);
  return amount;
}

async function switchToSepolia() {
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: config.chainIdHex }],
  });
}

async function connectWallet() {
  const shouldContinue = window.GoldRwaWallet?.ensureWalletProvider?.() ?? !!window.ethereum;
  if (!shouldContinue) return;
  await switchToSepolia();
  provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  currentAccount = accounts[0];
  contract = new ethers.Contract(config.contractAddress, abi, signer);
  $("walletAddress").textContent = shortAddress(currentAccount);
  $("connectBtn").textContent = "已連接";
  $("mintToInput").value = currentAccount;
  $("controlAddressInput").value = currentAccount;
  await refreshState();
}

async function initPublicRead() {
  publicProvider = new ethers.JsonRpcProvider(config.publicRpcUrl);
  publicContract = new ethers.Contract(config.contractAddress, abi, publicProvider);
  setupContractListeners(publicContract);
  await refreshState();
}

async function hashProofNote() {
  const note = $("proofNoteInput").value.trim();
  const reserve = $("proofReserveInput").value;
  const payload = JSON.stringify({
    asset: "TAIWAN_CUSTODIED_GOLD",
    contract: config.contractAddress,
    reserveGrams: reserve,
    note,
    updatedAt: new Date().toISOString(),
  });
  return ethers.sha256(ethers.toUtf8Bytes(payload));
}

async function runTx(actionName, txFactory) {
  try {
    if (!contract) await connectWallet();
    addLog(actionName, "等待 MetaMask 簽名");
    const tx = await txFactory();
    addLog(actionName, "已送出交易", tx.hash);
    await tx.wait();
    addLog(actionName, "交易已確認", tx.hash);
    await refreshState();
  } catch (error) {
    addLog(actionName, error.shortMessage || error.message || "交易失敗");
  }
}

async function refreshState() {
  const readContract = getReadContract();
  if (!readContract) return;
  const [owner, issuer, auditor, custodian, paused, reserve, supply, proofHash] = await Promise.all([
    readContract.owner(),
    readContract.issuer(),
    readContract.auditor(),
    readContract.custodian(),
    readContract.paused(),
    readContract.reserveGrams(),
    readContract.totalSupply(),
    readContract.latestProofHash(),
  ]);

  const account = currentAccount ? currentAccount.toLowerCase() : "";
  const roles = [];
  if (account) {
    if (owner.toLowerCase() === account) roles.push("Owner");
    if (issuer.toLowerCase() === account) roles.push("Issuer");
    if (auditor.toLowerCase() === account) roles.push("Auditor");
    if (custodian.toLowerCase() === account) roles.push("Custodian");
  }

  const reserveNum = Number(reserve);
  const supplyNum = Number(supply);
  const coverage = supplyNum === 0 ? 100 : Math.round((reserveNum / supplyNum) * 10000) / 100;

  $("walletRole").textContent = roles.length
    ? roles.join(" / ")
    : currentAccount
      ? "Investor / no admin role"
      : "Public read-only";
  $("chainReserve").textContent = `${fmt.format(reserveNum)} g`;
  $("chainSupply").textContent = `${fmt.format(supplyNum)} GGT`;
  $("chainPaused").textContent = paused ? "Paused" : "Active";
  $("chainCoverage").textContent = `${fmt.format(coverage)}% reserve coverage`;
  $("chainProofHash").textContent = proofHash;
}

$("connectBtn").addEventListener("click", () => {
  connectWallet().catch((error) => addLog("Connect", error.shortMessage || error.message));
});

$("refreshRequestsBtn").addEventListener("click", () => {
  renderSubscriptionRequests();
  addLog("Refresh Requests", "已重新整理申購申請");
});

$("clearProcessedBtn").addEventListener("click", () => {
  window.GoldRwaRequests.clearCompleted();
  renderSubscriptionRequests();
  addLog("Clear Requests", "已清除已處理申請");
});

$("subscriptionRequests").addEventListener("click", (event) => {
  const processButton = event.target.closest(".process-request");
  const loadButton = event.target.closest(".load-request");
  const processedButton = event.target.closest(".mark-processed");
  if (processButton) {
    processSubscriptionRequest(processButton.dataset.id);
  }
  if (loadButton) {
    loadSubscriptionRequest(loadButton.dataset.id);
  }
  if (processedButton) {
    window.GoldRwaRequests.updateRequestStatus(processedButton.dataset.id, "processed");
    renderSubscriptionRequests();
    addLog("Mark Processed", "申購申請已標記為處理完成");
  }
});

$("updateProofBtn").addEventListener("click", () => {
  runTx("Update Proof", async () => {
    const reserve = BigInt($("proofReserveInput").value || "0");
    const proofHash = await hashProofNote();
    return contract.updateReserveProof(reserve, proofHash);
  });
});

$("mintBtn").addEventListener("click", () => {
  runTx("Mint GGT", async () => {
    const to = requireAddress($("mintToInput").value, "投資人地址");
    const amount = requireAmount($("mintAmountInput").value, "發行數量");
    return contract.mintByReserve(to, amount);
  });
});

$("allowBtn").addEventListener("click", () => {
  runTx("Whitelist Add", async () => contract.setWhitelist(requireAddress($("controlAddressInput").value, "帳戶地址"), true));
});

$("denyBtn").addEventListener("click", () => {
  runTx("Whitelist Remove", async () => contract.setWhitelist(requireAddress($("controlAddressInput").value, "帳戶地址"), false));
});

$("freezeBtn").addEventListener("click", () => {
  runTx("Freeze Account", async () => contract.setFrozen(requireAddress($("controlAddressInput").value, "帳戶地址"), true));
});

$("unfreezeBtn").addEventListener("click", () => {
  runTx("Unfreeze Account", async () => contract.setFrozen(requireAddress($("controlAddressInput").value, "帳戶地址"), false));
});

$("pauseBtn").addEventListener("click", () => {
  runTx("Pause Contract", async () => contract.setPaused(true));
});

$("unpauseBtn").addEventListener("click", () => {
  runTx("Unpause Contract", async () => contract.setPaused(false));
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => connectWallet().catch(() => {}));
  window.ethereum.on("chainChanged", () => window.location.reload());
}

$("contractAddress").textContent = config.contractAddress;
$("etherscanLink").href = `${config.etherscanBaseUrl}/address/${config.contractAddress}`;
addLog("Ready", "已啟用公開鏈上讀取；連接 MetaMask 後可直接管理");
renderSubscriptionRequests();
initPublicRead().catch((error) => addLog("Public Read", error.shortMessage || error.message || "公開鏈上讀取失敗"));

(function (root) {
  "use strict";

  const MOBILE_REGEX = /Android|iPhone|iPad|iPod/i;

  function isMobileBrowser() {
    return MOBILE_REGEX.test(root.navigator?.userAgent || "");
  }

  function buildMetaMaskDappDeeplink(url) {
    const targetUrl = (url || root.location.href).replace(/^https?:\/\//, "");
    return `https://metamask.app.link/dapp/${targetUrl}`;
  }

  function ensureWalletProvider() {
    if (root.ethereum) {
      return true;
    }

    if (isMobileBrowser()) {
      const deeplink = buildMetaMaskDappDeeplink();
      const confirmed = root.confirm(
        "手機版一般瀏覽器通常無法直接連接 MetaMask。\n\n要改用 MetaMask App 開啟這個頁面嗎？",
      );

      if (confirmed) {
        root.location.href = deeplink;
        return false;
      }

      throw new Error("請改用 MetaMask App 內建瀏覽器開啟此頁面");
    }

    throw new Error("找不到 MetaMask，請先安裝或啟用瀏覽器錢包");
  }

  root.GoldRwaWallet = {
    buildMetaMaskDappDeeplink,
    ensureWalletProvider,
    isMobileBrowser,
  };
})(window);

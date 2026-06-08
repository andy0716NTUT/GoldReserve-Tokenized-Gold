# GoldReserve 黃金儲備代幣化 RWA PoC

本專題是 RWA Design Workshop 的第 2 題：「黃金儲備代幣化平台」。

這是一個課堂展示用 PoC，不是投資建議，也不是正式合規產品。

## 內容用途

本系統把「實體黃金儲備」轉換成鏈上可驗證的數位權益。

核心概念是：

- 每 1 枚 `GGT` 代表 1 克經審計保管的黃金。
- 黃金本體、保管文件、審計報告放在鏈下。
- 鏈上只保存儲備數量、證明雜湊、發行量與管理事件。
- 管理者可以更新儲備證明、發行代幣、管理白名單、凍結帳戶與暫停合約。
- 投資人必須在白名單內，才能接收、轉讓或贖回 GGT。

這個 PoC 要解決的問題：

- 傳統黃金投資的儲備資訊不容易即時驗證。
- 小額投資人不一定適合直接保管實體黃金。
- 黃金保管、審計、發行、贖回紀錄常常分散在不同系統。
- RWA 需要展示鏈下實物與鏈上權益如何對應。

## 技術規格

資產類型：

- 臺灣保管的實體黃金
- 示範單位：`1 GGT = 1 gram gold`

鏈上合約：

- 合約名稱：`GoldReserveToken`
- 測試鏈：Sepolia
- 合約地址：`0x37b0Af27106949fB6B139F82B2E9236d5d807Fb9`
- 管理者示範地址：`0x43b04C2785908999c85d75aBdDd4A5C38782d652`

代幣設計：

- 代幣名稱：`Gold Gram Token`
- 代幣符號：`GGT`
- 小數位：`0`
- 教學模型中每枚 GGT 對應 1 克黃金。

合規控制：

- `whitelist`：只有白名單地址可以接收、轉讓、贖回。
- `frozen`：管理者可以凍結特定帳戶。
- `paused`：緊急時可以暫停整份合約。
- 本 PoC 只做教學用的合規 gate，不宣稱符合正式證券、商品或金融法規。

儲備證明：

- 管理者輸入黃金儲備克數與證明摘要。
- 前端把摘要資料轉成 `proofHash`。
- 合約只保存 `reserveGrams` 與 `latestProofHash`。
- 完整文件不放上鏈，避免暴露敏感資料。

角色權限：

- `Owner`：最高管理者，可設定白名單、凍結、暫停、角色。
- `Issuer`：發行方，可呼叫 `mintByReserve()`。
- `Auditor`：審計方，可呼叫 `updateReserveProof()`。
- `Custodian`：保管方，在 PoC 中代表黃金保管機構。
- `Investor`：投資人，通過白名單後可以持有或贖回 GGT。

## 專案檔案

- `src/index.html`：展示頁，偏簡報與模擬操作。
- `src/admin.html`：管理者頁面，連接 MetaMask 後可操作 Sepolia 合約。
- `src/config.js`：Sepolia 合約地址與示範地址設定。
- `src/admin.js`：MetaMask、Sepolia、合約讀寫邏輯。
- `src/app.js`：展示頁的本地模擬邏輯。
- `src/core.js`：儲備率、發行、贖回、證明資料等共用邏輯。
- `src/styles.css`：網站樣式。
- `contracts/GoldReserveToken.sol`：Solidity 智能合約。
- `tests/core.test.js`：本地邏輯測試。
- `server.mjs`：本地靜態伺服器，方便 MetaMask 在 localhost 使用。

## 如何啟動網站

請在 `gold-rwa-poc` 資料夾執行：

```powershell
node server.mjs
```

啟動後打開：

```text
http://127.0.0.1:5178/index.html
```

管理者頁面：

```text
http://127.0.0.1:5178/admin.html
```

線上部署網址：

```text
https://gold-rwa-poc.vercel.app/
```

線上管理者頁面：

```text
https://gold-rwa-poc.vercel.app/admin.html
```

如果只是看簡報展示，可使用 `index.html`。  
如果要真的操作 Sepolia 合約，請使用 `admin.html`。

## 展示頁怎麼操作

展示頁是本地模擬，不會真的送交易到 Sepolia。

操作順序：

1. 看上方四個指標：黃金儲備、GGT 已發行、儲備覆蓋率、投資人持有價值。
2. 查看「投資人可查看資料」，理解一般使用者只能看儲備證明、持有量與公開狀態。
3. 查看「公開可驗證資訊」，確認 proof hash、保管方、金價 Oracle 與可再發行量。
4. 點「金價上漲、金價持平、壓力下跌」可做本地 ROI 試算。
5. 下方事件紀錄會顯示展示頁上的試算操作。

展示頁不能做這些事情：

- 不能更新儲備證明。
- 不能發行 GGT。
- 不能修改白名單。
- 不能凍結帳戶。
- 不能暫停合約。
- 不能把資料寫入 Sepolia。

「金價上漲、金價持平、壓力下跌」只是課堂用情境試算，用來說明黃金價格變動如何影響投資人持有價值，不是 Oracle 寫鏈，也不是正式交易訊號。

展示頁適合上台說明 RWA 商業流程與產品概念。

## 使用者與管理者功能分工

一般使用者可以看到：

- 黃金儲備量。
- GGT 已發行量。
- 儲備覆蓋率。
- 投資人示範持有價值。
- Proof Hash。
- 保管方名稱。
- 金價 Oracle 示範值。
- 合約與帳戶狀態的只讀說明。
- 金價情境試算。

一般使用者可以操作：

- 連接 MetaMask。
- 讀取自己的鏈上 GGT 餘額。
- 送出認購申請。
- 呼叫 `burnForRedemption()` 燒毀自己的 GGT 並申請實體黃金提領。

認購申請的設計：

- 一般使用者不能直接 mint GGT。
- 使用者按「送出認購申請」會在平台產生申請紀錄。
- 管理者審核後，才到管理者頁面使用 `mintByReserve()` 發行 GGT。
- 這樣可以避免使用者繞過儲備證明與合規審核。

目前申購申請佇列是課堂 demo 版：

- 申請資料存放在瀏覽器 `localStorage`。
- 同一台電腦、同一個瀏覽器中，使用者頁面送出的申請可以在管理者頁面看到。
- 如果使用者和管理者在不同電腦或不同瀏覽器，管理者不會看到該申請。
- 正式產品需要後端資料庫，或新增智能合約申請事件/函式，才能跨使用者同步。

贖回的設計：

- 使用者必須已在白名單內。
- 使用者不能被凍結。
- 合約不能是暫停狀態。
- 使用者必須持有足夠 GGT。
- 成功後會鏈上燒毀 GGT，實體黃金提領仍需平台後續處理。

一般使用者不可以操作：

- `updateReserveProof()` 更新儲備證明。
- `mintByReserve()` 發行 GGT。
- `setWhitelist()` 加入或移出白名單。
- `setFrozen()` 凍結或解除凍結帳戶。
- `setPaused()` 暫停或恢復合約。

管理者頁面才可以操作：

- `Owner`：白名單、凍結、暫停、角色管理。
- `Auditor`：更新儲備證明。
- `Issuer`：發行 GGT。
- `Custodian`：代表黃金保管方，PoC 中主要作為角色顯示。

## 管理者頁面怎麼操作

管理者頁面會真的透過 MetaMask 對 Sepolia 合約送交易。

操作前確認：

- MetaMask 已安裝。
- MetaMask 已切到 Sepolia。
- 錢包裡有 Sepolia ETH 可支付 gas。
- 使用的錢包最好是部署合約的地址：`0x43b04C2785908999c85d75aBdDd4A5C38782d652`。

第一次操作建議照這個順序：

1. 打開 `http://127.0.0.1:5178/admin.html`。
2. 按「連接 MetaMask」。
3. 確認頁面顯示目前錢包與角色。
4. 查看「0. 使用者申購申請」。
5. 如果有申請，按「載入申請」，系統會自動帶入投資人地址與發行數量。
6. 在「新的審計黃金儲備」輸入 `125000`。
7. 按「更新 Proof Hash」。
8. MetaMask 跳出時確認交易。
9. 等待頁面下方顯示交易已確認。
10. 按「加入白名單」。
11. MetaMask 確認交易。
12. 按「發行給投資人」。
13. MetaMask 確認交易。
14. 按「標記已處理」將申購申請標示為完成。
15. 上方 `GGT 已發行` 應該會增加。

## 管理者按鈕對應的合約函式

「更新 Proof Hash」：

```solidity
updateReserveProof(uint256 newReserveGrams, bytes32 proofHash)
```

用途：更新鏈上的黃金儲備克數與證明雜湊。  
權限：`Auditor` 或 `Owner`。

「發行給投資人」：

```solidity
mintByReserve(address to, uint256 amount)
```

用途：發行 GGT 給白名單投資人。  
權限：`Issuer` 或 `Owner`。  
限制：發行後總量不能超過黃金儲備。

「加入白名單 / 移出白名單」：

```solidity
setWhitelist(address account, bool allowed)
```

用途：控制投資人是否可以接收、轉讓、贖回 GGT。  
權限：`Owner`。

「凍結帳戶 / 解除凍結」：

```solidity
setFrozen(address account, bool isFrozen)
```

用途：限制特定帳戶操作。  
權限：`Owner`。

「暫停合約 / 恢復合約」：

```solidity
setPaused(bool isPaused)
```

用途：緊急停止或恢復合約操作。  
權限：`Owner`。

## 常見錯誤

錯誤：`missing revert data` 或 `execution reverted`

可能原因：

- 你不是 `Owner / Issuer / Auditor`。
- 尚未更新儲備證明就嘗試發行。
- 投資人地址還沒加入白名單。
- 發行數量超過儲備量。
- 合約目前是暫停狀態。
- 帳戶被凍結。

錯誤：MetaMask 沒跳出

可能原因：

- 沒有用 `http://127.0.0.1:5178/admin.html` 開頁面。
- 直接用 `file://` 開啟，瀏覽器沒有注入 MetaMask。
- MetaMask 被鎖住。
- 瀏覽器沒有允許該頁面連接 MetaMask。

錯誤：交易一直失敗

請先照這個最小流程測：

1. 連接 MetaMask。
2. 更新儲備證明：`125000`。
3. 將自己的地址加入白名單。
4. 發行 `100` GGT 給自己的地址。

## 簡報架構建議

1. 痛點：黃金儲備不透明、小額參與不方便。
2. 解法：以 GGT 表示經審計的黃金克數。
3. 目標客戶：小額投資人、財富管理平台、黃金保管機構。
4. Tokenomics Canvas：GGT、1 克黃金 backing、發行限制、費用設計。
5. Use Case Canvas：申購、持有、轉讓、贖回。
6. Contract Role Map：Owner、Issuer、Auditor、Custodian、Investor。
7. 系統架構：鏈下黃金保管與鏈上 proof hash。
8. 合規控制：白名單、凍結、暫停。
9. Demo 流程：更新儲備、白名單、發行、事件紀錄。
10. 風險與下一步：保管、審計、KYC、價格 Oracle、法律審查。

## 測試

本地邏輯測試：

```powershell
node tests/core.test.js
```

通過時會看到：

```text
Gold RWA core tests passed.
```

## 下一步

- 增加投資人頁面，讓投資人可以查看自己的 GGT 餘額。
- 增加交易紀錄查詢與 Etherscan 連結。
- 把審計報告改成可上傳檔案後產生 hash。
- 加入更完整的 KYC / 合格投資人狀態欄位。

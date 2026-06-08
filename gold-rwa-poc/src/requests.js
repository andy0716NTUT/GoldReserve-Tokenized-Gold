(function (root) {
  "use strict";

  const STORAGE_KEY = "goldRwaSubscriptionRequests";

  function readRequests() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function writeRequests(requests) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  }

  function addRequest(walletAddress, amount) {
    const requests = readRequests();
    const request = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      walletAddress,
      amount: amount.toString(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    requests.unshift(request);
    writeRequests(requests);
    return request;
  }

  function updateRequestStatus(id, status) {
    const requests = readRequests().map((request) =>
      request.id === id ? { ...request, status, updatedAt: new Date().toISOString() } : request,
    );
    writeRequests(requests);
    return requests;
  }

  function clearCompleted() {
    const requests = readRequests().filter((request) => request.status !== "processed");
    writeRequests(requests);
    return requests;
  }

  root.GoldRwaRequests = {
    addRequest,
    clearCompleted,
    readRequests,
    updateRequestStatus,
  };
})(window);

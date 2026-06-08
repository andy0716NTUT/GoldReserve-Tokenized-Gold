// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GoldReserveToken
/// @notice Classroom RWA POC: 1 GGT represents 1 gram of audited custodied gold.
/// @dev This is a teaching contract draft. It intentionally avoids production KYC,
/// custody, oracle, and legal-compliance assumptions.
contract GoldReserveToken {
    string public constant name = "Gold Gram Token";
    string public constant symbol = "GGT";
    uint8 public constant decimals = 0;
    address public constant DEFAULT_DEMO_OPERATOR = 0x43b04C2785908999c85d75aBdDd4A5C38782d652;

    address public owner;
    address public issuer;
    address public auditor;
    address public custodian;

    bool public paused;
    uint256 public reserveGrams;
    uint256 public totalSupply;
    bytes32 public latestProofHash;
    uint256 public proofVersion;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public whitelist;
    mapping(address => bool) public frozen;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event ProofUpdated(bytes32 indexed proofHash, uint256 reserveGrams, uint256 proofVersion);
    event Minted(address indexed to, uint256 amount);
    event BurnedForRedemption(address indexed from, uint256 amount);
    event WhitelistUpdated(address indexed account, bool allowed);
    event FrozenUpdated(address indexed account, bool isFrozen);
    event PausedUpdated(bool paused);
    event RolesUpdated(address issuer, address auditor, address custodian);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyIssuer() {
        require(msg.sender == issuer || msg.sender == owner, "not issuer");
        _;
    }

    modifier onlyAuditor() {
        require(msg.sender == auditor || msg.sender == owner, "not auditor");
        _;
    }

    modifier transferable(address from, address to) {
        require(!paused, "paused");
        require(whitelist[from] && whitelist[to], "whitelist required");
        require(!frozen[from] && !frozen[to], "account frozen");
        _;
    }

    constructor() {
        owner = msg.sender;
        issuer = DEFAULT_DEMO_OPERATOR;
        auditor = DEFAULT_DEMO_OPERATOR;
        custodian = DEFAULT_DEMO_OPERATOR;
        whitelist[msg.sender] = true;
        whitelist[DEFAULT_DEMO_OPERATOR] = true;
    }

    function setRoles(address newIssuer, address newAuditor, address newCustodian) external onlyOwner {
        issuer = newIssuer;
        auditor = newAuditor;
        custodian = newCustodian;
        whitelist[newIssuer] = true;
        whitelist[newAuditor] = true;
        whitelist[newCustodian] = true;
        emit RolesUpdated(newIssuer, newAuditor, newCustodian);
    }

    function setWhitelist(address account, bool allowed) external onlyOwner {
        whitelist[account] = allowed;
        emit WhitelistUpdated(account, allowed);
    }

    function setFrozen(address account, bool isFrozen) external onlyOwner {
        frozen[account] = isFrozen;
        emit FrozenUpdated(account, isFrozen);
    }

    function setPaused(bool isPaused) external onlyOwner {
        paused = isPaused;
        emit PausedUpdated(isPaused);
    }

    function updateReserveProof(uint256 newReserveGrams, bytes32 proofHash) external onlyAuditor {
        require(proofHash != bytes32(0), "empty proof");
        require(newReserveGrams >= totalSupply, "reserve below supply");
        reserveGrams = newReserveGrams;
        latestProofHash = proofHash;
        proofVersion += 1;
        emit ProofUpdated(proofHash, newReserveGrams, proofVersion);
    }

    function mintByReserve(address to, uint256 amount) external onlyIssuer {
        require(!paused, "paused");
        require(whitelist[to] && !frozen[to], "recipient not eligible");
        require(totalSupply + amount <= reserveGrams, "insufficient reserve");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Minted(to, amount);
        emit Transfer(address(0), to, amount);
    }

    function burnForRedemption(uint256 amount) external {
        require(!paused, "paused");
        require(whitelist[msg.sender] && !frozen[msg.sender], "not eligible");
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        reserveGrams -= amount;
        emit BurnedForRedemption(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external transferable(msg.sender, to) returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        external
        transferable(from, to)
        returns (bool)
    {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "allowance");
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "zero address");
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

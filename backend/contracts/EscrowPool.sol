// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title EscrowPool
 * @dev Smart contract for invoice factoring escrow on Hedera
 * Handles deposits, releases, and refunds for invoice funding
 */
contract EscrowPool is ReentrancyGuard, Ownable, Pausable {
    struct Escrow {
        string invoiceId;
        string nftTokenId;
        uint256 nftSerialNumber;
        address investor;
        address supplier;
        uint256 amount;
        uint256 depositedAt;
        uint256 dueDate;
        EscrowStatus status;
        string fileHash;
    }

    enum EscrowStatus {
        PENDING,
        FUNDED,
        RELEASED,
        REFUNDED,
        DISPUTED
    }

    mapping(bytes32 => Escrow) public escrows;
    mapping(string => bytes32) public invoiceToEscrowId;
    
    uint256 public platformFeeRate = 250; // 2.5% in basis points
    uint256 public constant MAX_FEE_RATE = 1000; // 10% maximum
    address public feeRecipient;
    
    event EscrowCreated(
        bytes32 indexed escrowId,
        string indexed invoiceId,
        address indexed investor,
        address supplier,
        uint256 amount
    );
    
    event EscrowFunded(
        bytes32 indexed escrowId,
        string indexed invoiceId,
        uint256 amount
    );
    
    event EscrowReleased(
        bytes32 indexed escrowId,
        string indexed invoiceId,
        address indexed supplier,
        uint256 amount,
        uint256 fee
    );
    
    event EscrowRefunded(
        bytes32 indexed escrowId,
        string indexed invoiceId,
        address indexed investor,
        uint256 amount
    );
    
    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    constructor(address _feeRecipient, address initialOwner) Ownable(initialOwner) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Create and fund an escrow for an invoice
     * @param invoiceId Unique identifier for the invoice
     * @param nftTokenId Hedera NFT token ID
     * @param nftSerialNumber NFT serial number
     * @param supplier Address of the supplier
     * @param dueDate Due date timestamp
     * @param fileHash Hash of the invoice file
     */
    function deposit(
        string memory invoiceId,
        string memory nftTokenId,
        uint256 nftSerialNumber,
        address supplier,
        uint256 dueDate,
        string memory fileHash
    ) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        require(supplier != address(0), "Invalid supplier address");
        require(dueDate > block.timestamp, "Due date must be in the future");
        require(bytes(invoiceId).length > 0, "Invoice ID cannot be empty");
        require(invoiceToEscrowId[invoiceId] == bytes32(0), "Invoice already has escrow");

        bytes32 escrowId = keccak256(
            abi.encodePacked(invoiceId, msg.sender, block.timestamp)
        );

        escrows[escrowId] = Escrow({
            invoiceId: invoiceId,
            nftTokenId: nftTokenId,
            nftSerialNumber: nftSerialNumber,
            investor: msg.sender,
            supplier: supplier,
            amount: msg.value,
            depositedAt: block.timestamp,
            dueDate: dueDate,
            status: EscrowStatus.FUNDED,
            fileHash: fileHash
        });

        invoiceToEscrowId[invoiceId] = escrowId;

        emit EscrowCreated(escrowId, invoiceId, msg.sender, supplier, msg.value);
        emit EscrowFunded(escrowId, invoiceId, msg.value);
    }

    /**
     * @dev Release funds to supplier (called when invoice is paid)
     * @param invoiceId Invoice identifier
     */
    function release(string memory invoiceId) external nonReentrant whenNotPaused {
        bytes32 escrowId = invoiceToEscrowId[invoiceId];
        require(escrowId != bytes32(0), "Escrow not found");
        
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.FUNDED, "Escrow not in funded status");
        require(
            msg.sender == escrow.investor || msg.sender == owner(),
            "Only investor or owner can release"
        );

        uint256 fee = (escrow.amount * platformFeeRate) / 10000;
        uint256 supplierAmount = escrow.amount - fee;

        escrow.status = EscrowStatus.RELEASED;

        // Transfer fee to platform
        if (fee > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        // Transfer remaining amount to supplier
        (bool supplierSuccess, ) = escrow.supplier.call{value: supplierAmount}("");
        require(supplierSuccess, "Supplier transfer failed");

        emit EscrowReleased(escrowId, invoiceId, escrow.supplier, supplierAmount, fee);
    }

    /**
     * @dev Refund funds to investor (called when invoice defaults or is cancelled)
     * @param invoiceId Invoice identifier
     */
    function refund(string memory invoiceId) external nonReentrant whenNotPaused {
        bytes32 escrowId = invoiceToEscrowId[invoiceId];
        require(escrowId != bytes32(0), "Escrow not found");
        
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.FUNDED, "Escrow not in funded status");
        require(
            msg.sender == escrow.investor || 
            msg.sender == owner() || 
            block.timestamp > escrow.dueDate + 30 days,
            "Not authorized to refund or too early"
        );

        escrow.status = EscrowStatus.REFUNDED;

        // Refund full amount to investor
        (bool success, ) = escrow.investor.call{value: escrow.amount}("");
        require(success, "Refund transfer failed");

        emit EscrowRefunded(escrowId, invoiceId, escrow.investor, escrow.amount);
    }

    /**
     * @dev Get escrow details by invoice ID
     * @param invoiceId Invoice identifier
     */
    function getEscrow(string memory invoiceId) external view returns (Escrow memory) {
        bytes32 escrowId = invoiceToEscrowId[invoiceId];
        require(escrowId != bytes32(0), "Escrow not found");
        return escrows[escrowId];
    }

    /**
     * @dev Get escrow ID by invoice ID
     * @param invoiceId Invoice identifier
     */
    function getEscrowId(string memory invoiceId) external view returns (bytes32) {
        return invoiceToEscrowId[invoiceId];
    }

    /**
     * @dev Update platform fee rate (only owner)
     * @param newFeeRate New fee rate in basis points
     */
    function updateFeeRate(uint256 newFeeRate) external onlyOwner {
        require(newFeeRate <= MAX_FEE_RATE, "Fee rate too high");
        uint256 oldRate = platformFeeRate;
        platformFeeRate = newFeeRate;
        emit FeeRateUpdated(oldRate, newFeeRate);
    }

    /**
     * @dev Update fee recipient address (only owner)
     * @param newFeeRecipient New fee recipient address
     */
    function updateFeeRecipient(address newFeeRecipient) external onlyOwner {
        require(newFeeRecipient != address(0), "Invalid fee recipient");
        address oldRecipient = feeRecipient;
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(oldRecipient, newFeeRecipient);
    }

    /**
     * @dev Pause contract (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal (only owner, when paused)
     */
    function emergencyWithdraw() external onlyOwner whenPaused {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Emergency withdrawal failed");
    }

    /**
     * @dev Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Fallback function to receive Ether
     */
    receive() external payable {
        // Allow contract to receive Ether
    }
}
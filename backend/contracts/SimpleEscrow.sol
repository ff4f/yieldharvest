// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimpleEscrow
 * @dev Simplified escrow contract for testing deployment on Hedera
 */
contract SimpleEscrow {
    struct Escrow {
        string invoiceId;
        address investor;
        address supplier;
        uint256 amount;
        bool isReleased;
    }

    mapping(bytes32 => Escrow) public escrows;
    mapping(string => bytes32) public invoiceToEscrowId;
    
    address public owner;
    address public feeRecipient;
    uint256 public platformFeeRate = 250; // 2.5% in basis points
    
    event EscrowCreated(
        bytes32 indexed escrowId,
        string indexed invoiceId,
        address indexed investor,
        address supplier,
        uint256 amount
    );
    
    event EscrowReleased(
        bytes32 indexed escrowId,
        string indexed invoiceId,
        uint256 amount,
        uint256 fee
    );

    constructor(address _feeRecipient, address _owner) {
        feeRecipient = _feeRecipient;
        owner = _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function deposit(
        string memory invoiceId,
        address supplier
    ) external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        require(supplier != address(0), "Invalid supplier address");
        
        bytes32 escrowId = keccak256(abi.encodePacked(invoiceId, msg.sender, block.timestamp));
        require(escrows[escrowId].amount == 0, "Escrow already exists");
        
        escrows[escrowId] = Escrow({
            invoiceId: invoiceId,
            investor: msg.sender,
            supplier: supplier,
            amount: msg.value,
            isReleased: false
        });
        
        invoiceToEscrowId[invoiceId] = escrowId;
        
        emit EscrowCreated(escrowId, invoiceId, msg.sender, supplier, msg.value);
    }

    function release(string memory invoiceId) external onlyOwner {
        bytes32 escrowId = invoiceToEscrowId[invoiceId];
        require(escrowId != bytes32(0), "Escrow not found");
        
        Escrow storage escrow = escrows[escrowId];
        require(!escrow.isReleased, "Already released");
        require(escrow.amount > 0, "No funds to release");
        
        uint256 fee = (escrow.amount * platformFeeRate) / 10000;
        uint256 supplierAmount = escrow.amount - fee;
        
        escrow.isReleased = true;
        
        // Transfer fee to platform
        if (fee > 0) {
            payable(feeRecipient).transfer(fee);
        }
        
        // Transfer remaining amount to supplier
        payable(escrow.supplier).transfer(supplierAmount);
        
        emit EscrowReleased(escrowId, invoiceId, escrow.amount, fee);
    }

    function getEscrow(string memory invoiceId) external view returns (
        string memory,
        address,
        address,
        uint256,
        bool
    ) {
        bytes32 escrowId = invoiceToEscrowId[invoiceId];
        require(escrowId != bytes32(0), "Escrow not found");
        
        Escrow memory escrow = escrows[escrowId];
        return (
            escrow.invoiceId,
            escrow.investor,
            escrow.supplier,
            escrow.amount,
            escrow.isReleased
        );
    }

    function updateFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid address");
        feeRecipient = _feeRecipient;
    }

    function updatePlatformFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 1000, "Fee rate too high"); // Max 10%
        platformFeeRate = _feeRate;
    }
}
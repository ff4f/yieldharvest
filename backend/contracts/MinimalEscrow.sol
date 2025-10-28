// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MinimalEscrow
 * @dev Minimal escrow contract for testing deployment on Hedera
 */
contract MinimalEscrow {
    address public owner;
    address public feeRecipient;
    uint256 public platformFeeRate;
    
    mapping(string => uint256) public escrowAmounts;
    mapping(string => address) public escrowSuppliers;
    mapping(string => bool) public escrowReleased;
    
    event EscrowCreated(string indexed invoiceId, address indexed investor, address supplier, uint256 amount);
    event EscrowReleased(string indexed invoiceId, uint256 amount);

    constructor(address _feeRecipient, address _owner) {
        feeRecipient = _feeRecipient;
        owner = _owner;
        platformFeeRate = 250; // 2.5%
    }

    function deposit(string memory invoiceId, address supplier) external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        require(escrowAmounts[invoiceId] == 0, "Escrow already exists");
        
        escrowAmounts[invoiceId] = msg.value;
        escrowSuppliers[invoiceId] = supplier;
        
        emit EscrowCreated(invoiceId, msg.sender, supplier, msg.value);
    }

    function release(string memory invoiceId) external {
        require(msg.sender == owner, "Not owner");
        require(escrowAmounts[invoiceId] > 0, "Escrow not found");
        require(!escrowReleased[invoiceId], "Already released");
        
        uint256 amount = escrowAmounts[invoiceId];
        address supplier = escrowSuppliers[invoiceId];
        
        escrowReleased[invoiceId] = true;
        
        uint256 fee = (amount * platformFeeRate) / 10000;
        uint256 supplierAmount = amount - fee;
        
        if (fee > 0) {
            payable(feeRecipient).transfer(fee);
        }
        
        payable(supplier).transfer(supplierAmount);
        
        emit EscrowReleased(invoiceId, amount);
    }

    function getEscrow(string memory invoiceId) external view returns (uint256, address, bool) {
        return (escrowAmounts[invoiceId], escrowSuppliers[invoiceId], escrowReleased[invoiceId]);
    }
}
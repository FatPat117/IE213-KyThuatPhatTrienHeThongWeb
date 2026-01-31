// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FundRaising
 * @dev Contract mẫu cho đồ án Gây quỹ - bổ sung logic gây quỹ và cấp chứng chỉ
 */
contract FundRaising {
    address public owner;
    uint256 public totalRaised;
    mapping(address => uint256) public contributions;

    event Contributed(address indexed donor, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error OnlyOwner();
    error InvalidAmount();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function contribute() external payable {
        if (msg.value == 0) revert InvalidAmount();
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;
        emit Contributed(msg.sender, msg.value);
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool ok, ) = payable(owner).call{value: balance}("");
        require(ok, "Transfer failed");
        emit Withdrawn(owner, balance);
    }

    function getContribution(address account) external view returns (uint256) {
        return contributions[account];
    }
}

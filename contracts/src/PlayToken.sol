// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PlayToken is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1_000e18;
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

    mapping(address => uint256) public lastFaucetClaim;

    event FaucetClaimed(address indexed user, uint256 amount);

    constructor() ERC20("OSPM Play Token", "PLAY") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000e18);
    }

    function faucet() external {
        uint256 lastClaim = lastFaucetClaim[msg.sender];
        require(
            lastClaim == 0 || block.timestamp >= lastClaim + FAUCET_COOLDOWN,
            "Faucet: cooldown not elapsed"
        );
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    function canClaimFaucet(address user) external view returns (bool) {
        uint256 lastClaim = lastFaucetClaim[user];
        return lastClaim == 0 || block.timestamp >= lastClaim + FAUCET_COOLDOWN;
    }

    function timeUntilNextClaim(address user) external view returns (uint256) {
        uint256 lastClaim = lastFaucetClaim[user];
        if (lastClaim == 0) return 0;
        uint256 nextClaimTime = lastClaim + FAUCET_COOLDOWN;
        if (block.timestamp >= nextClaimTime) return 0;
        return nextClaimTime - block.timestamp;
    }

    function adminMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

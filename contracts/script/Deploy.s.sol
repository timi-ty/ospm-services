// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PlayToken} from "../src/PlayToken.sol";
import {MarketFactory} from "../src/MarketFactory.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("ORACLE_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerKey);

        PlayToken token = new PlayToken();
        console.log("PlayToken:", address(token));

        // Deployer is the initial oracle and factory owner
        MarketFactory factory = new MarketFactory(address(token), deployer);
        console.log("MarketFactory:", address(factory));

        // Approve factory to pull subsidy for market creation
        token.approve(address(factory), type(uint256).max);

        vm.stopBroadcast();
    }
}

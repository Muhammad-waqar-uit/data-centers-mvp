// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {DataCenterRegistry} from "../src/DataCenterRegistry.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {ClaimVerification} from "../src/ClaimVerification.sol";

/// @title Deploy
/// @notice Deploys DataCenterRegistry, StakeManager, and ClaimVerification contracts
contract Deploy is Script {
    function run() external {
        // Read env vars
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");

        console.log("Deploying contracts...");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("USDC Address:", usdcAddress);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy DataCenterRegistry
        DataCenterRegistry registry = new DataCenterRegistry();
        console.log("DataCenterRegistry deployed at:", address(registry));

        // 2. Deploy StakeManager
        StakeManager stakeManager = new StakeManager(usdcAddress);
        console.log("StakeManager deployed at:", address(stakeManager));

        // 3. Deploy ClaimVerification
        ClaimVerification claimVerification = new ClaimVerification(address(stakeManager));
        console.log("ClaimVerification deployed at:", address(claimVerification));

        // 4. Link contracts: authorize ClaimVerification on StakeManager
        stakeManager.authorizeContract(address(claimVerification));
        console.log("ClaimVerification authorized on StakeManager");

        // 5. Authorize deployer as registrar on DataCenterRegistry
        registry.addRegistrar(vm.addr(deployerPrivateKey));
        console.log("Deployer authorized as registrar");

        vm.stopBroadcast();

        // Write deployed addresses to JSON
        string memory addressesJson = string.concat(
            '{"DataCenterRegistry":"', vm.toString(address(registry)),
            '","StakeManager":"', vm.toString(address(stakeManager)),
            '","ClaimVerification":"', vm.toString(address(claimVerification)),
            '","USDC":"', vm.toString(usdcAddress),
            '"}'
        );

        vm.writeFile("deployed-addresses.json", addressesJson);
        console.log("Deployed addresses written to deployed-addresses.json");
    }
}

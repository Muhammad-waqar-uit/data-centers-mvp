// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {DataCenterRegistry} from "../src/DataCenterRegistry.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {ClaimVerification} from "../src/ClaimVerification.sol";
import {JurorCourt} from "../src/JurorCourt.sol";

/// @title Deploy
/// @notice Deploys DataCenterRegistry, StakeManager, JurorCourt, and ClaimVerification,
/// then wires up authorizations and UMA OOV3 integration.
contract Deploy is Script {
    function run() external {
        // Read env vars
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address oov3Address = vm.envAddress("OOV3_ADDRESS");

        console.log("Deploying contracts...");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("USDC Address:", usdcAddress);
        console.log("UMA OOV3 Address:", oov3Address);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy DataCenterRegistry
        DataCenterRegistry registry = new DataCenterRegistry();
        console.log("DataCenterRegistry deployed at:", address(registry));

        // 2. Deploy StakeManager
        StakeManager stakeManager = new StakeManager(usdcAddress);
        console.log("StakeManager deployed at:", address(stakeManager));

        // 3. Deploy JurorCourt
        JurorCourt court = new JurorCourt(address(stakeManager));
        console.log("JurorCourt deployed at:", address(court));

        // 4. Deploy ClaimVerification (UMA OOV3 integrated)
        ClaimVerification claimVerification = new ClaimVerification(address(stakeManager), oov3Address);
        console.log("ClaimVerification deployed at:", address(claimVerification));

        // 5. Wire contracts together
        stakeManager.authorizeContract(address(claimVerification));
        console.log("ClaimVerification authorized on StakeManager");

        stakeManager.authorizeContract(address(court));
        console.log("JurorCourt authorized on StakeManager");

        claimVerification.setCourt(address(court));
        console.log("JurorCourt set on ClaimVerification");

        court.setClaimVerification(address(claimVerification));
        console.log("ClaimVerification set on JurorCourt");

        // 6. Authorize deployer as registrar on DataCenterRegistry
        registry.addRegistrar(vm.addr(deployerPrivateKey));
        console.log("Deployer authorized as registrar");

        vm.stopBroadcast();

        // Write deployed addresses to JSON
        string memory addressesJson = string.concat(
            '{"DataCenterRegistry":"', vm.toString(address(registry)),
            '","StakeManager":"', vm.toString(address(stakeManager)),
            '","ClaimVerification":"', vm.toString(address(claimVerification)),
            '","JurorCourt":"', vm.toString(address(court)),
            '","USDC":"', vm.toString(usdcAddress),
            '","OOV3":"', vm.toString(oov3Address),
            '"}'
        );

        vm.writeFile("deployed-addresses.json", addressesJson);
        console.log("Deployed addresses written to deployed-addresses.json");
    }
}

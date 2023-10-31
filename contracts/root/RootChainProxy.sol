pragma solidity ^0.5.2;

import {RootChainStorage} from "./RootChainStorage.sol";
import {UpgradableProxy} from "../common/misc/UpgradableProxy.sol";
import {Registry} from "../common/Registry.sol";

contract RootChainProxy is UpgradableProxy, RootChainStorage {
  constructor(address _proxyTo, address _registry, string memory _heimdallId)
  public
  UpgradableProxy(_proxyTo)
  {
    registry = Registry(_registry);
    heimdallId = keccak256(abi.encodePacked(_heimdallId));
  }
}


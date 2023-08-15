pragma solidity ^0.5.2;

import {UpgradableProxy} from "../../common/misc/UpgradableProxy.sol";

contract RootChainManagerProxy is UpgradableProxy {
    constructor(address _proxyTo)
        public
        UpgradableProxy(_proxyTo)
    {}
}

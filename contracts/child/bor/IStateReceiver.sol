pragma solidity ^0.5.2;

interface IStateReceiver {
    function onStateReceive(uint256 id, bytes calldata data, bytes32 txHash) external;
}

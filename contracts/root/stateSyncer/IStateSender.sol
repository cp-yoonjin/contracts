pragma solidity ^0.5.2;

interface IStateSender {
    function syncState(address receiver, bytes calldata data) external;
}

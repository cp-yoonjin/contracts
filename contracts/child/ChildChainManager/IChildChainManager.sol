pragma solidity ^0.5.2;

interface IChildChainManager {
    event TokenMapped(address indexed rootToken, address indexed childToken);
    event TokenUnmapped(address indexed rootToken, address indexed childToken);

    function mapToken(address rootToken, address childToken, bool isErc721) external;
    function cleanMapToken(address rootToken, address childToken) external;
}

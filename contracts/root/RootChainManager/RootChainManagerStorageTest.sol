pragma solidity ^0.5.2;

import {IStateSender} from "../stateSyncer/IStateSender.sol";
import {ICheckpointManager} from "../ICheckpointManager.sol";
import {ProxyStorage} from "../../common/misc/ProxyStorage.sol";
import "../RootChainStorage.sol";
import "../RootChain.sol";

contract RootChainManagerStorageTest is ProxyStorage {
  mapping(bytes32 => address) public typeToPredicate;
  mapping(address => address) public rootToChildToken;
  mapping(address => address) public childToRootToken;
  mapping(address => bytes32) public tokenToType;
  mapping(bytes32 => bool) public processedExits;
  IStateSender internal _stateSender;
  // RootChainStorage internal _rootChainStorage;
  RootChain internal _rootChainStorage;
  address public childChainManagerAddress;
}

//contract RootChainStorage is ProxyStorage, RootChainHeader, ChainIdMixin {
//  bytes32 public heimdallId;
//  uint8 public constant VOTE_TYPE = 2;
//
//  uint16 internal constant MAX_DEPOSITS = 10000;
//  uint256 public _nextHeaderBlock = MAX_DEPOSITS;
//  uint256 internal _blockDepositId = 1;
//  mapping(uint256 => HeaderBlock) public headerBlocks;
//  Registry internal registry;
//}

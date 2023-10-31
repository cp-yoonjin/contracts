pragma solidity ^0.5.2;

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {IChildChainManager} from "./IChildChainManager.sol";
import {IMetaLockable} from "../IMetaLockable.sol";
import {Initializable} from "../../common/mixin/Initializable.sol";
import {IStateReceiver} from "../bor/IStateReceiver.sol";

contract ChildChainManager is
Ownable,
IChildChainManager,
Initializable,
  // AccessControlMixin,
IStateReceiver
{
  bytes32 public constant DEPOSIT = keccak256("DEPOSIT");
  bytes32 public constant MAP_TOKEN = keccak256("MAP_TOKEN");
  //    bytes32 public constant MAPPER_ROLE = keccak256("MAPPER_ROLE");
  //    bytes32 public constant STATE_SYNCER_ROLE = keccak256("STATE_SYNCER_ROLE");

  mapping(address => bool) public owners;
  mapping(address => address) public rootToChildToken;
  mapping(address => address) public childToRootToken;
  mapping(bytes32 => bool) public processedDeposit;

  function initialize(address ownerAddress) external initializer {
    _transferOwnership(ownerAddress);
    require(ownerAddress != address(0));
    require(owners[ownerAddress] == false);
    owners[ownerAddress] = true;
  }

  function addOwner(address owner) public onlyOwner {
    require(owner != address(0));
    require(owners[owner] == false);

    owners[owner] = true;
  }

  modifier onlyValidator() {
    bool isOwner = owners[msg.sender];
    //require(isOwner, "No Permission");
    _;
  }

  /**
   * @notice Map a token to enable its movement via the PoS Portal, callable only by mappers
     * Normally mapping should happen automatically using state sync
     * This function should be used only while initial deployment when state sync is not registrered or if it fails
     * @param rootToken address of token on root chain
     * @param childToken address of token on child chain
     */
  function mapToken(address rootToken, address childToken, bool isErc721) external onlyValidator {
    _mapToken(rootToken, childToken);
  }

  /**
   * @notice Receive state sync data from root chain, only callable by state syncer
     * @dev state syncing mechanism is used for both depositing tokens and mapping them
     * @param data bytes data from RootChainManager contract
     * `data` is made up of bytes32 `syncType` and bytes `syncData`
     * `syncType` determines if it is deposit or token mapping
     * in case of token mapping, `syncData` is encoded address `rootToken`, address `childToken` and bytes32 `tokenType`
     * in case of deposit, `syncData` is encoded address `user`, address `rootToken` and bytes `depositData`
     * `depositData` is token specific data (amount in case of ERC20). It is passed as is to child token
     */
  function onStateReceive(uint256, bytes calldata data, bytes32 txHash) external onlyValidator {

    (bytes32 syncType, bytes memory syncData) = abi.decode(
      data,
      (bytes32, bytes)
    );

    if (syncType == DEPOSIT) {
      _syncDeposit(syncData, txHash);
    } else if (syncType == MAP_TOKEN) {
      (address rootToken, address childToken, ) = abi.decode(
        syncData,
        (address, address, bytes32)
      );
      _mapToken(rootToken, childToken);
    } else {
      revert("ChildChainManager: INVALID_SYNC_TYPE");
    }
  }

  /**

   * @notice Clean polluted token mapping
     * @param rootToken address of token on root chain. Since rename token was introduced later stage,
     * clean method is used to clean pollulated mapping
     */
  function cleanMapToken(
    address rootToken,
    address childToken
  ) external onlyValidator {
    rootToChildToken[rootToken] = address(0);
    childToRootToken[childToken] = address(0);

    emit TokenUnmapped(rootToken, childToken);
  }

  function _mapToken(address rootToken, address childToken) private {
    address oldChildToken = rootToChildToken[rootToken];
    address oldRootToken = childToRootToken[childToken];

    if (rootToChildToken[oldRootToken] != address(0)) {
      rootToChildToken[oldRootToken] = address(0);
    }

    if (childToRootToken[oldChildToken] != address(0)) {
      childToRootToken[oldChildToken] = address(0);
    }

    rootToChildToken[rootToken] = childToken;
    childToRootToken[childToken] = rootToken;

    emit TokenMapped(rootToken, childToken);
  }

  function _syncDeposit(bytes memory syncData, bytes32 txHash) private {
    (address user, address rootToken, bytes memory depositData) = abi
    .decode(syncData, (address, address, bytes));

    require(
      processedDeposit[txHash] == false,
      "ChildChainManager: DEPOSIT_ALREADY_PROCESSED"
    );
    processedDeposit[txHash] = true;

    address childTokenAddress = rootToChildToken[rootToken];
    require(
      childTokenAddress != address(0x0),
      "ChildChainManager: TOKEN_NOT_MAPPED"
    );

    uint256 amount = abi.decode(depositData, (uint256));

    IMetaLockable childTokenContract = IMetaLockable(childTokenAddress);
    childTokenContract.deposit(user, amount);
  }
}


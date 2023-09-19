pragma solidity >=0.4.22 <0.6.0;

import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {IRootChainManager} from "./IRootChainManager.sol";
import {RootChainManagerStorage} from "./RootChainManagerStorage.sol";
import {IStateSender} from "../stateSyncer/IStateSender.sol";
// import {ICheckpointManager} from "../ICheckpointManager.sol";
import {ICheckpointManager} from "../ICheckpointManager.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {ExitPayloadReader} from "../../common/lib/ExitPayloadReader.sol";
import {MerklePatriciaProof} from "../../common/lib/MerklePatriciaProof.sol";
import {Merkle} from "../../common/lib/Merkle.sol";
// import {ITokenPredicate} from "../TokenPredicates/ITokenPredicate.sol";
import {Initializable} from "../../common/mixin/Initializable.sol";
// import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
// import {ContextMixin} from "../../common/lib/ContextMixin.sol";
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {META} from "../../common/tokens/META.sol";
import {RootChainManagerStorage} from "./RootChainManagerStorage.sol";
import {RootChain} from "../RootChain.sol";

contract RootChainManager is
    Ownable,
    IRootChainManager,
    Initializable,
    // AccessControl, // included to match old storage layout while upgrading
    RootChainManagerStorage // created to match old storage layout while upgrading
    // AccessControlMixin,
    // NativeMetaTransaction,
    // ContextMixin
{
    using ExitPayloadReader for bytes;
    using ExitPayloadReader for ExitPayloadReader.ExitPayload;
    using ExitPayloadReader for ExitPayloadReader.Log;
    using ExitPayloadReader for ExitPayloadReader.Receipt;

    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    using Merkle for bytes32;
    using SafeMath for uint256;

    // maybe DEPOSIT and MAP_TOKEN can be reduced to bytes4
    bytes32 public constant DEPOSIT = keccak256("DEPOSIT");
    bytes32 public constant MAP_TOKEN = keccak256("MAP_TOKEN");
    address public constant ETHER_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    bytes32 public constant MAPPER_ROLE = keccak256("MAPPER_ROLE");

//    function _msgSender()
//        internal
//        view
//        returns (address payable sender)
//    {
//        return ContextMixin.msgSender();
//    }

    /**
     * @notice Deposit ether by directly sending to the contract
     * The account sending ether receives WETH on child chain
     */
//    receive() external payable {
//        _depositEtherFor(msg.sender);
//    }

    /**
     * @notice Initialize the contract after it has been proxified
     * @dev meant to be called once immediately after deployment
     * @param _owner the account that should be granted admin role
     */
    function initialize(
        address _owner
    )
        external
        initializer
    {
        _transferOwnership(_owner);
    }

    // adding seperate function setupContractId since initialize is already called with old implementation
//    function setupContractId()
//        external
//        only(DEFAULT_ADMIN_ROLE)
//    {
//        _setupContractId("RootChainManager");
//    }

    // adding seperate function initializeEIP712 since initialize is already called with old implementation
//    function initializeEIP712()
//        external
//        only(DEFAULT_ADMIN_ROLE)
//    {
//        _setDomainSeperator("RootChainManager");
//    }

    /**
     * @notice Set the state sender, callable only by admins
     * @dev This should be the state sender from plasma contracts
     * It is used to send bytes from root to child chain
     * @param newStateSender address of state sender contract
     */
    function setStateSender(address newStateSender) external onlyOwner {
        require(newStateSender != address(0), "RootChainManager: BAD_NEW_STATE_SENDER");
        _stateSender = IStateSender(newStateSender);
    }

    /**
     * @notice Get the address of contract set as state sender
     * @return The address of state sender contract
     */
    function stateSenderAddress() external view returns (address) {
        return address(_stateSender);
    }

    /**
     * @notice Set the checkpoint manager, callable only by admins
     * @dev This should be the plasma contract responsible for keeping track of checkpoints
     * @param newCheckpointManager address of checkpoint manager contract
     */
    function setCheckpointManager(address newCheckpointManager) external {
      require(newCheckpointManager != address(0), "RootChainManager: BAD_NEW_CHECKPOINT_MANAGER");
      _rootChainStorage = RootChain(newCheckpointManager);
    }

    /**
     * @notice Get the address of contract set as checkpoint manager
     * @return The address of checkpoint manager contract
     */
    function checkpointManagerAddress() external view returns (address) {
        return address(_rootChainStorage);
    }

    /**
     * @notice Set the child chain manager, callable only by admins
     * @dev This should be the contract responsible to receive deposit bytes on_checkpointManager child chain
     * @param newChildChainManager address of child chain manager contract
     */
    function setChildChainManagerAddress(address newChildChainManager) external onlyOwner {
        require(newChildChainManager != address(0x0), "RootChainManager: INVALID_CHILD_CHAIN_ADDRESS");
        childChainManagerAddress = newChildChainManager;
    }

    /**
     * @notice Map a token to enable its movement via the PoS Portal, callable only by mappers
     * @param rootToken address of token on root chain
     * @param childToken address of token on child chain
     */
    function mapToken(address rootToken, address childToken) external onlyOwner {
        // explicit check if token is already mapped to avoid accidental remaps
        require(
            rootToChildToken[rootToken] == address(0) &&
            childToRootToken[childToken] == address(0),
            "RootChainManager: ALREADY_MAPPED"
        );
        _mapToken(rootToken, childToken);
    }

    /**
     * @notice Clean polluted token mapping
     * @param rootToken address of token on root chain. Since rename token was introduced later stage,
     * clean method is used to clean pollulated mapping
     */
    function cleanMapToken(address rootToken, address childToken) external onlyOwner {
        rootToChildToken[rootToken] = address(0);
        childToRootToken[childToken] = address(0);

        emit TokenMapped(rootToken, childToken);
    }

    /**
     * @notice Remap a token that has already been mapped, properly cleans up old mapping
     * Callable only by ADMIN
     * @param rootToken address of token on root chain
     * @param childToken address of token on child chain
     */
    function remapToken(address rootToken, address childToken) external onlyOwner {
        // cleanup old mapping
        address oldChildToken = rootToChildToken[rootToken];
        address oldRootToken = childToRootToken[childToken];

        if (rootToChildToken[oldRootToken] != address(0)) {
            rootToChildToken[oldRootToken] = address(0);
        }

        if (childToRootToken[oldChildToken] != address(0)) {
            childToRootToken[oldChildToken] = address(0);
        }

        _mapToken(rootToken, childToken);
    }

    function _mapToken(address rootToken, address childToken) private {
        rootToChildToken[rootToken] = childToken;
        childToRootToken[childToken] = rootToken;

        emit TokenMapped(rootToken, childToken);

//        bytes memory syncData = abi.encode(rootToken, childToken);
//        _stateSender.syncState(
//            childChainManagerAddress,
//            abi.encode(MAP_TOKEN, syncData)
//        );
    }

    /**
     * @notice Move ether from root to child chain, accepts ether transfer
     * Keep in mind this ether cannot be used to pay gas on child chain
     * Use Matic tokens deposited using plasma mechanism for that
     * @param user address of account that should receive WETH on child chain
     */
//    function depositEtherFor(address user) external payable {
//        _depositEtherFor(user);
//    }

    /**
     * @notice Move tokens from root to child chain
     * @dev This mechanism supports arbitrary tokens as long as its predicate has been registered and the token is mapped
     * @param user address of account that should receive this deposit on child chain
     * @param rootToken address of token that is being deposited
     * @param depositData bytes data that is sent to predicate and child token contracts to handle deposit
     */
    function depositFor(address user, address rootToken, bytes calldata depositData) external {
//        require(
//            rootToken != ETHER_ADDRESS,
//            "RootChainManager: INVALID_ROOT_TOKEN"
//        );
        _depositFor(user, rootToken, depositData);
    }

//    function _depositEtherFor(address user) private {
//        bytes memory depositData = abi.encode(msg.value);
//        _depositFor(user, ETHER_ADDRESS, depositData);
//
//        // payable(typeToPredicate[tokenToType[ETHER_ADDRESS]]).transfer(msg.value);
//        // transfer doesn't work as expected when receiving contract is proxified so using call
//        (bool success, /* bytes memory data */) = typeToPredicate[tokenToType[ETHER_ADDRESS]].call{value: msg.value}("");
//        if (!success) {
//            revert("RootChainManager: ETHER_TRANSFER_FAILED");
//        }
//    }

    function _depositFor(
        address user,
        address rootToken,
        bytes memory depositData
    ) private {
        require(
            rootToChildToken[rootToken] != address(0x0),
            "RootChainManager: TOKEN_NOT_MAPPED"
        );

        require(
            user != address(0),
            "RootChainManager: INVALID_USER"
        );

        // depositFor amount decoding
        uint256 amount = abi.decode(depositData, (uint256));

        // 토큰 설정
        META meta = META(rootToken);

        // 사용자 -> 이 컨트랙트 토큰 트랜스퍼
        meta.transferFrom(user, address(this), amount);

        meta.burn(address(this), amount);

        //TODO 두번째 테스트 state sync event 잘 되는가
        bytes memory syncData = abi.encode(user, rootToken, depositData);
        _stateSender.syncState(
            childChainManagerAddress,
            abi.encode(DEPOSIT, syncData)
        );
    }

    /**
     * @notice exit tokens by providing proof
     * @dev This function verifies if the transaction actually happened on child chain
     * the transaction log is then sent to token predicate to handle it accordingly
     *
     * @param inputData RLP encoded data of the reference tx containing following list of fields
     *  0 - headerNumber - Checkpoint header block number containing the reference tx
     *  1 - blockProof - Proof that the block header (in the child chain) is a leaf in the submitted merkle root
     *  2 - blockNumber - Block number containing the reference tx on child chain
     *  3 - blockTime - Reference tx block time
     *  4 - txRoot - Transactions root of block
     *  5 - receiptRoot - Receipts root of block
     *  6 - receipt - Receipt of the reference transaction
     *  7 - receiptProof - Merkle proof of the reference receipt
     *  8 - branchMask - 32 bits denoting the path of receipt in merkle tree
     *  9 - receiptLogIndex - Log Index to read from the receipt
     */
    function exit(bytes calldata inputData) external {
        ExitPayloadReader.ExitPayload memory payload = inputData.toExitPayload();

        bytes memory branchMaskBytes = payload.getBranchMaskAsBytes();
        // checking if exit has already been processed
        // unique exit is identified using hash of (blockNumber, branchMask, receiptLogIndex)

        //TODO 테스트 이후 실행
//        require(
//            processedExits[payload.getTxRoot()] == false,
//            "RootChainManager: EXIT_ALREADY_PROCESSED"
//        );
//        processedExits[payload.getTxRoot()] = true;
//
        ExitPayloadReader.Receipt memory receipt = payload.getReceipt();
        ExitPayloadReader.Log memory log = receipt.getLog();

        // log should be emmited only by the child token
        address rootToken = childToRootToken[log.getEmitter()];

        require(
            rootToken != address(0),
            "RootChainManager: TOKEN_NOT_MAPPED"
        );


        // branch mask can be maximum 32 bits
        require(
            payload.getBranchMaskAsUint() &
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000 ==
            0,
            "RootChainManager: INVALID_BRANCH_MASK"
        );

        // verify receipt inclusion
        require(
            MerklePatriciaProof.verify(
                receipt.toBytes(),
                branchMaskBytes,
                payload.getReceiptProof(),
                payload.getReceiptRoot()
            ),
            "RootChainManager: INVALID_PROOF"
        );

        // verify checkpoint inclusion
        _checkBlockMembershipInCheckpoint(
            payload.getBlockNumber(),
            payload.getBlockTime(),
            payload.getTxRoot(),
            payload.getReceiptRoot(),
            payload.getHeaderNumber(),
            payload.getBlockProof()
        );

        //TODO user decoding
        RLPReader.RLPItem[] memory logRLPList = log.toRlpBytes().toRlpItem().toList();
        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList();

        address withdrawal = address(logTopicRLPList[2].toUint());

        //TODO depositFor amount decoding
        uint256 amount = logRLPList[2].toUint();

        //TODO 토큰 설정
        META meta = META(rootToken);

        meta.mint(address(this), amount);

        //TODO 이 컨트랙트 -> 사용자 토큰 트랜스퍼
        meta.transfer(withdrawal, amount);
    }

    function _checkBlockMembershipInCheckpoint(
        uint256 blockNumber,
        uint256 blockTime,
        bytes32 txRoot,
        bytes32 receiptRoot,
        uint256 headerNumber,
        bytes memory blockProof
    ) private view {
        (
            bytes32 headerRoot,
            uint256 startBlock,
            ,
            ,

        ) = _rootChainStorage.headerBlocks(headerNumber);

        require(
            keccak256(
                abi.encodePacked(blockNumber, blockTime, txRoot, receiptRoot)
            )
                .checkMembership(
                blockNumber.sub(startBlock),
                headerRoot,
                blockProof
            ),
            "RootChainManager: INVALID_HEADER"
        );
    }

    function getCheckpoint() external view returns (bytes32){

      (
      bytes32 headerRoot,
      uint256 startBlock,
      ,
      ,

      ) = _rootChainStorage.headerBlocks(10000);

      return headerRoot;
    }

    function getThisAddress() external view returns (address){

      return address(this);
    }


    function checkpointVerify(uint256 blockNumber, uint256 blockTime, bytes32 txRoot, bytes32 receiptRoot, bytes calldata blockProof) external view returns (bytes32){
      _checkBlockMembershipInCheckpoint(
        blockNumber,
        blockTime,
        txRoot,
        receiptRoot,
        10000,
        blockProof
      );

      return keccak256(abi.encodePacked(blockNumber, blockTime, txRoot, receiptRoot));
    }
}

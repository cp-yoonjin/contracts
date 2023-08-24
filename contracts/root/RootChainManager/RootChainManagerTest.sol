pragma solidity >=0.4.22 <0.6.0;

import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {ExitPayloadReader} from "../../common/lib/ExitPayloadReader.sol";
import {MerklePatriciaProof} from "../../common/lib/MerklePatriciaProof.sol";
import {Merkle} from "../../common/lib/Merkle.sol";
import {ICheckpointManager} from "../ICheckpointManager.sol";
import "./RootChainManagerStorageTest.sol";

contract RootChainManagerTest is RootChainManagerStorageTest {
    using ExitPayloadReader for bytes;
    using ExitPayloadReader for ExitPayloadReader.ExitPayload;
    using ExitPayloadReader for ExitPayloadReader.Log;
    using ExitPayloadReader for ExitPayloadReader.Receipt;

    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    using Merkle for bytes32;
    using SafeMath for uint256;

    function setCheckpointManager(address newCheckpointManager) external {
      require(newCheckpointManager != address(0), "RootChainManager: BAD_NEW_CHECKPOINT_MANAGER");
      _rootChainStorage = RootChain(newCheckpointManager);
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
        bytes32 exitHash = keccak256(
            abi.encodePacked(
                payload.getBlockNumber(),
                // first 2 nibbles are dropped while generating nibble array
                // this allows branch masks that are valid but bypass exitHash check (changing first 2 nibbles only)
                // so converting to nibble array and then hashing it
                // TODO 임시: MerklePatriciaProof._getNibbleArray(branchMaskBytes),
                payload.getReceiptLogIndex()
            )
        );

        ExitPayloadReader.Receipt memory receipt = payload.getReceipt();
        ExitPayloadReader.Log memory log = receipt.getLog();

//        require(
//            payload.getBranchMaskAsUint() &
//            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000 ==
//            0,
//            "RootChainManager: INVALID_BRANCH_MASK"
//        );

        // verify receipt inclusion
//        require(
//            MerklePatriciaProof.verify(
//                receipt.toBytes(),
//                branchMaskBytes,
//                payload.getReceiptProof(),
//                payload.getReceiptRoot()
//            ),
//            "RootChainManager: INVALID_PROOF"
//        );
//
        // verify checkpoint inclusion
        _checkBlockMembershipInCheckpoint(
            payload.getBlockNumber(),
            payload.getBlockTime(),
            payload.getTxRoot(),
            payload.getReceiptRoot(),
            payload.getHeaderNumber(),
            payload.getBlockProof()
        );
//
//        //TODO user decoding
//        RLPReader.RLPItem[] memory logRLPList = log.toRlpBytes().toRlpItem().toList();
//        RLPReader.RLPItem[] memory logTopicRLPList = logRLPList[1].toList();
//
//        address withdrawal = address(logTopicRLPList[1].toUint());
//
//        //TODO depositFor amount decoding
//        uint256 amount = logRLPList[2].toUint();
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

  function getCheckpoint(uint256 headerNumber) external view returns (uint256){
    (
    bytes32 headerRoot,
    uint256 startBlock,
    uint256 end,
    uint256 createdAt,
    address proposer
    ) = _rootChainStorage.headerBlocks(headerNumber);

    return startBlock;
  }
}

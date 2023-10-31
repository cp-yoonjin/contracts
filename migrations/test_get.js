const META = artifacts.require('META')
const utils = require('./utils')
// const Buffer = require('safe-buffer').Buffer
const { bufferToHex, rlp, toBuffer, BN, keccak256 } = require('ethereumjs-util')
const Trie = require('merkle-patricia-tree')
const { Buffer } = require('safe-buffer')
const RootChainManagerTest = artifacts.require('RootChainManagerTest')

module.exports = async function(deployer, network, accounts) {
  await deployer

  const contractAddresses = utils.getContractAddresses()

  console.log('deploying RootChainManagerTest contracts...')
  await deployer.deploy(RootChainManagerTest)
  const RootChainManagerTestInstance = await RootChainManagerTest.at(RootChainManagerTest.address)

  console.log('set checkpoint manager... ', contractAddresses.root.RootChainProxy)
  await RootChainManagerTestInstance.setCheckpointManager(contractAddresses.root.RootChainProxy)

  const block = await getBlockData()
  const txReceipt = await getReceiptData()

  const value = await getReceiptBytes(txReceipt)
  console.log('* value: ', value)

  const receiptList = []

  receiptList.push(txReceipt)
  // receiptList.push(await getReceiptData2())
  // receiptList.push(await getReceiptData3())

  console.log('receiptList: ', receiptList)

  const receiptProof = await getReceiptProof(txReceipt, block, receiptList)

  const jsVerified = await verifyTxProof(receiptProof)
  if(!jsVerified) {
    console.log('*** Proof verification in js failed for receipt: ', txReceipt.transactionIndex)
  }

  const encodedPath = receiptProof.path
  console.log('* encodedPath: ', encodedPath)

  const rlpParentNodes = receiptProof.parentNodes
  console.log('* rlpParentNodes: ', rlpParentNodes)

  const root = block.receiptsRoot
  console.log('* root: ', root)

  const encodeData = bufferToHex(
    rlp.encode([
      20000, // headerBlock
      bufferToHex(Buffer.concat([])), // blockProof
      0, // blockNumber
      0, // timestamp
      bufferToHex(block.transactionsRoot), // txRoot
      bufferToHex(block.receiptsRoot),
      bufferToHex(value),
      bufferToHex(receiptProof.parentNodes),
      bufferToHex(receiptProof.path), // branch mask,
      0
    ])
  )

  await RootChainManagerTestInstance.mtVerify(encodeData).then(console.log)

  // bytes calldata value, bytes calldata encodedPath, bytes calldata rlpParentNodes, bytes32 root
  // RootChainManagerTestInstance.mtVerify(value, encodedPath, rlpParentNodes, root)
}


async function getReceiptProof(receipt, block, receipts) {
  const receiptsTrie = new Trie()

  for (let i = 0; i < receipts.length; i++) {
    const siblingReceipt = receipts[i]
    const path = rlp.encode(siblingReceipt.transactionIndex)
    console.log('path', i, ': ', path, ',', siblingReceipt.transactionIndex)
    const rawReceipt = await getReceiptBytes(siblingReceipt)
    await new Promise((resolve, reject) => {
      receiptsTrie.put(path, rawReceipt, err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  // promise
  return new Promise((resolve, reject) => {
    receiptsTrie.findPath(
      rlp.encode(receipt.transactionIndex),
      (err, rawReceiptNode, reminder, stack) => {
        if (err) {
          return reject(err)
        }

        if (reminder.length > 0) {
          return reject(new Error('Node does not contain the key'))
        }

        const prf = {
          blockHash: toBuffer(receipt.blockHash),
          parentNodes: stack.map(s => s.raw),
          path: rlp.encode(receipt.transactionIndex),
          value: rlp.decode(rawReceiptNode.value)
        }
        resolve(prf)
      }
    )
  })
}

async function getReceiptBytes(receipt) {
  console.log('* [getReceiptBytes] receipt.status: ', receipt.status)
  console.log('* [getReceiptBytes] receipt.cumulativeGasUsed: ', receipt.cumulativeGasUsed)
  console.log('* [getReceiptBytes] receipt.logsBloom: ', receipt.logsBloom)
  console.log('* [getReceiptBytes] receipt.logs: ', receipt.logs)
  let encodedData = rlp.encode([
    toBuffer('0x1'),
    toBuffer(web3.utils.toHex(receipt.cumulativeGasUsed)),
    toBuffer(receipt.logsBloom),

    // encoded log array
    receipt.logs.map(l => {
      // [address, [topics array], data]
      return [
        toBuffer(l.address), // convert address to buffer
        l.topics.map(toBuffer), // convert topics to buffer
        toBuffer(l.data) // convert data to buffer
      ]
    })
  ])

  if (await isTypedReceipt(receipt)) {
    encodedData = Buffer.concat([
      ethUtils.toBuffer(receipt.type),
      encodedData,
    ]);
  }

  return encodedData
}

async function isTypedReceipt(receipt) {
  const hexType = web3.utils.toHex(receipt.type);
  return receipt.status != null && hexType !== "0x0" && hexType !== "0x";
}


async function verifyTxProof(proof) {
  const path = proof.path.toString('hex')
  const value = proof.value
  const parentNodes = proof.parentNodes
  const txRoot = proof.root
  try {
    var currentNode
    var len = parentNodes.length
    var nodeKey = txRoot
    var pathPtr = 0
    for (var i = 0; i < len; i++) {
      currentNode = parentNodes[i]
      const encodedNode = Buffer.from(
        keccak256(rlp.encode(currentNode)),
        'hex'
      )
      if (!nodeKey.equals(encodedNode)) {
        return false
      }
      if (pathPtr > path.length) {
        return false
      }
      switch (currentNode.length) {
        case 17: // branch node
          if (pathPtr === path.length) {
            if (currentNode[16] === rlp.encode(value)) {
              return true
            } else {
              return false
            }
          }
          nodeKey = currentNode[parseInt(path[pathPtr], 16)] // must === sha3(rlp.encode(currentNode[path[pathptr]]))
          pathPtr += 1
          break
        case 2:
          // eslint-disable-next-line
          const traversed = nibblesToTraverse(
            currentNode[0].toString('hex'),
            path,
            pathPtr
          )
          if ((traversed + pathPtr) === path.length) {
            // leaf node
            if (currentNode[1].equals(rlp.encode(value))) {
              return true
            } else {
              return false
            }
          }
          // extension node
          if (traversed === 0) {
            return false
          }
          pathPtr += traversed
          nodeKey = currentNode[1]
          break
        default:
          console.log('all nodes must be length 17 or 2')
          return false
      }
    }
  } catch (e) {
    console.log(e)
    return false
  }
  return false
}

async function getReceiptData(){
  return {
    blockHash: "0xc5f5d92f92fabb067e65592480bf9a6adef79084aad32b2c0ec78b29582f8271",
    blockNumber: 65,
    contractAddress: null,
    cumulativeGasUsed: 92878,
    effectiveGasPrice: 110000000000,
    from: "0xa121d7b3c4174414ab69741a9a27dd809de91407",
    gasUsed: 92878,
    logs: [{
      address: "0x4f0ff11ebf566768a9269ff03e63e7e3197cebaf",
      blockHash: "0xc5f5d92f92fabb067e65592480bf9a6adef79084aad32b2c0ec78b29582f8271",
      blockNumber: 65,
      data: "0x00000000000000000000000000000000000000000000003635c9adc5dea00000",
      logIndex: 0,
      removed: false,
      topics: ["0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb", "0x00000000000000000000000010ed2e985311d97558658508fd0705ad841236bb", "0x000000000000000000000000a121d7b3c4174414ab69741a9a27dd809de91407"],
      transactionHash: "0x1973a28349c12456d9163be98d6b9605e559aec1b7b2e8da0fbc2e1e22851995",
      transactionIndex: 0
    }],
    logsBloom: "0x00400000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000020400000000000000000000000000000000000000000100000000000001000020000000000000004000000000000000000000000000000000000000000000000004000000008000000000000000000000000008000000000000000",
    status: "0x1",
    to: "0x4f0ff11ebf566768a9269ff03e63e7e3197cebaf",
    transactionHash: "0x1973a28349c12456d9163be98d6b9605e559aec1b7b2e8da0fbc2e1e22851995",
    transactionIndex: 0,
    type: "0x0"
  }
}

async function getReceiptData2(){
  return {
    blockHash: "0xc5f5d92f92fabb067e65592480bf9a6adef79084aad32b2c0ec78b29582f8271",
    blockNumber: 65,
    contractAddress: null,
    cumulativeGasUsed: 92878,
    effectiveGasPrice: 110000000000,
    from: "0xa121d7b3c4174414ab69741a9a27dd809de91407",
    gasUsed: 92878,
    logs: [{
      address: "0x4f0ff11ebf566768a9269ff03e63e7e3197cebaf",
      blockHash: "0xc5f5d92f92fabb067e65592480bf9a6adef79084aad32b2c0ec78b29582f8271",
      blockNumber: 65,
      data: "0x00000000000000000000000000000000000000000000003635c9adc5dea00000",
      logIndex: 0,
      removed: false,
      topics: ["0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb", "0x00000000000000000000000010ed2e985311d97558658508fd0705ad841236bb", "0x000000000000000000000000a121d7b3c4174414ab69741a9a27dd809de91407"],
      transactionHash: "0x1973a28349c12456d9163be98d6b9605e559aec1b7b2e8da0fbc2e1e22851996",
      transactionIndex: 0
    }],
    logsBloom: "0x00400000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000020400000000000000000000000000000000000000000100000000000001000020000000000000004000000000000000000000000000000000000000000000000004000000008000000000000000000000000008000000000000000",
    status: "0x1",
    to: "0x4f0ff11ebf566768a9269ff03e63e7e3197cebaf",
    transactionHash: "0x1973a28349c12456d9163be98d6b9605e559aec1b7b2e8da0fbc2e1e22851996",
    transactionIndex: 1,
    type: "0x0"
  }
}

async function getReceiptData3(){
  return {
    blockHash: "0xc5f5d92f92fabb067e65592480bf9a6adef79084aad32b2c0ec78b29582f8271",
    blockNumber: 65,
    contractAddress: null,
    cumulativeGasUsed: 92878,
    effectiveGasPrice: 110000000000,
    from: "0xa121d7b3c4174414ab69741a9a27dd809de91407",
    gasUsed: 92878,
    logs: [{
      address: "0x4f0ff11ebf566768a9269ff03e63e7e3197cebaf",
      blockHash: "0xc5f5d92f92fabb067e65592480bf9a6adef79084aad32b2c0ec78b29582f8271",
      blockNumber: 65,
      data: "0x00000000000000000000000000000000000000000000003635c9adc5dea00000",
      logIndex: 0,
      removed: false,
      topics: ["0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb", "0x00000000000000000000000010ed2e985311d97558658508fd0705ad841236bb", "0x000000000000000000000000a121d7b3c4174414ab69741a9a27dd809de91407"],
      transactionHash: "0x1973a28349c12456d9163be98d6b9605e559aec1b7b2e8da0fbc2e1e22851997",
      transactionIndex: 0
    }],
    logsBloom: "0x00400000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000020400000000000000000000000000000000000000000100000000000001000020000000000000004000000000000000000000000000000000000000000000000004000000008000000000000000000000000008000000000000000",
    status: "0x1",
    to: "0x4f0ff11ebf566768a9269ff03e63e7e3197cebaf",
    transactionHash: "0x1973a28349c12456d9163be98d6b9605e559aec1b7b2e8da0fbc2e1e22851997",
    transactionIndex: 2,
    type: "0x0"
  }
}

async function getBlockData() {
  return {
    baseFeePerGas: 0,
    difficulty: 1,
    extraData: "0xd5820908846765746886676f312e3139856c696e7578",
    fees: "0x244bece5b82800",
    gasLimit: 268435456,
    gasUsed: 92878,
    hash: "0xc5f5d92f92fabb067e65592480bf9a6adef79084aad32b2c0ec78b29582f8271",
    logsBloom: "0x00400000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000020400000000000000000000000000000000000000000100000000000001000020000000000000004000000000000000000000000000000000000000000000000004000000008000000000000000000000000008000000000000000",
    miner: "0xf7edbf0516329533e01a751269efbc0b8d9e3ecc",
    minerNodeId: "0xe8a68f000830a215307508b30751e419c7ba3d3a30caee173068850629aaa19841ec2f0b61d27a69ffcd7f9a84df0c2fb33f523e0d67db0af97aacf801dc8d6a",
    minerNodeSig: "0x6fe3accf9e6531b97471bef1ec00afa99061fdf34470856e252635c1210f9fab4d26bcf3b31234fa41b277a43618bfb9c8a62de72ba4b894ae153dcec303753201",
    mixHash: "0x447202f16b1a196021b834c288510dc11f3a0be94ba24e30cc92172de13d7c6c",
    nonce: "0x2c0c74883e2f060d",
    number: 65,
    parentHash: "0x7ddb7a6a727005e6275be9c16be6ef54090b7b8c9c07f0ce0857155f518c70ac",
    receiptsRoot: "0x7c50ce2476c590f4fe5a1f8276565d40299d7ceb4342acd592f1f1da08112dfa",
    rewards: "0x5b7b2261646472223a22307866376564626630353136333239353333653031613735313236396566626330623864396533656363222c22726577617264223a313134393336353235303030303030307d2c7b2261646472223a22307839363162626261333236646538656632376439313063326661616530323838633164633731363462222c22726577617264223a313134393336353235303030303030307d2c7b2261646472223a22307834363833336533656637613936663462616633653062353464366365373039313137343663636336222c22726577617264223a313134393336353235303030303030307d2c7b2261646472223a22307835386362316135383534376135336161363666373438323035303037663664646130646231373461222c22726577617264223a313134393336353235303030303030307d2c7b2261646472223a22307863353166613261623866303465613536643564333732633635313938613530636262393963396166222c22726577617264223a343539373436313030303030303030307d2c7b2261646472223a22307838313562623566323463636466623435383038623061346638616139313466393732373762396466222c22726577617264223a313032313635383030303030303030307d5d",
    sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
    size: 1310,
    stateRoot: "0x651157d44d408083792b21b463329c07e9eba9078a4dc88e04e16c37c43a43e4",
    timestamp: 1693226046,
    totalDifficulty: 66,
    transactions: [{
      blockHash: "0xc5f5d92f92fabb067e65592480bf9a6adef79084aad32b2c0ec78b29582f8271",
      blockNumber: 65,
      from: "0xa121d7b3c4174414ab69741a9a27dd809de91407",
      gas: 19161000,
      gasPrice: 110000000000,
      hash: "0x1973a28349c12456d9163be98d6b9605e559aec1b7b2e8da0fbc2e1e22851995",
      input: "0x2e1a7d4d00000000000000000000000000000000000000000000003635c9adc5dea00000",
      nonce: 6,
      r: "0xc044b6929bc854f359cc0acdbda2d1d695139b72562ab522840c0be5d503013f",
      s: "0x224eff213ca7c55aee5f345062b5641f795eabde3f3d4fb355ffff46a784a40b",
      to: "0x4f0ff11ebf566768a9269ff03e63e7e3197cebaf",
      transactionIndex: 0,
      type: "0x0",
      v: "0x39",
      value: 1e+21
    }],
    transactionsRoot: "0x88ab1872f59cd4cee6405ae8c56cbad26a627fd3a33b62cb6ff352c0f517603c",
    uncles: []
  }
}

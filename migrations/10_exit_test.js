const RootChainManager = artifacts.require('RootChainManager')
const META = artifacts.require('META')
const utils = require('./utils')
// const Buffer = require('safe-buffer').Buffer
const { bufferToHex, rlp, toBuffer, BN, keccak256 } = require('ethereumjs-util')
const Trie = require('merkle-patricia-tree')
const { Buffer } = require('safe-buffer')
const ChildChainManager = artifacts.require('ChildChainManager')


module.exports = async function(deployer, network, accounts) {
  await deployer

  const contractAddresses = utils.getContractAddresses()

  const ChildChainManagerInstance = await ChildChainManager.at(contractAddresses.child.ChildChainManager)

  console.log('* ChildChainManagerInstance: ', ChildChainManagerInstance)
  await ChildChainManagerInstance.owners(accounts[0]).then(console.log)
}

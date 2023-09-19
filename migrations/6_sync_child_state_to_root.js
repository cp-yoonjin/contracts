const ethUtils = require('ethereumjs-util')
const utils = require('./utils')

const Registry = artifacts.require('Registry')
const Governance = artifacts.require('Governance')
const StateSender = artifacts.require('StateSender')
const DepositManager = artifacts.require('DepositManager')
const RootChainManager = artifacts.require('RootChainManager')

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    const contractAddresses = utils.getContractAddresses()

    if (!contractAddresses.child) {
      return
    }

    const registry = await Registry.at(contractAddresses.root.Registry)
    const governance = await Governance.at(contractAddresses.root.GovernanceProxy)

    // await governance.update(
    //   registry.address,
    //   registry.contract.methods.mapToken(
    //     contractAddresses.root.tokens.MaticWeth,
    //     contractAddresses.child.tokens.MaticWeth,
    //     false /* isERC721 */
    //   ).encodeABI()
    // )

    // await governance.update(
    //   registry.address,
    //   registry.contract.methods.mapToken(
    //     contractAddresses.root.tokens.META,
    //     contractAddresses.child.tokens.META,
    //     false /* isERC721 */
    //   ).encodeABI()
    // )

    // await governance.update(
    //   registry.address,
    //   registry.contract.methods.mapToken(
    //     contractAddresses.root.tokens.TestToken,
    //     contractAddresses.child.tokens.TestToken,
    //     false /* isERC721 */
    //   ).encodeABI()
    // )
    //
    // await governance.update(
    //   registry.address,
    //   registry.contract.methods.mapToken(
    //     contractAddresses.root.tokens.RootERC721,
    //     contractAddresses.child.tokens.RootERC721,
    //     true /* isERC721 */
    //   ).encodeABI()
    // )

    await governance.update(
      registry.address,
      registry.contract.methods.updateContractMap(
        ethUtils.keccak256('childChain'),
        contractAddresses.child.ChildChainManager
      ).encodeABI()
    )

    const stateSenderContract = await StateSender.at(contractAddresses.root.StateSender)
    await stateSenderContract.register(contractAddresses.root.RootChainManager, contractAddresses.child.ChildChainManager)

    const RootChainManagerInstance = await RootChainManager.at(contractAddresses.root.RootChainManager)

    console.log('Setting StateSender')
    await RootChainManagerInstance.setStateSender(contractAddresses.root.StateSender)

    console.log('Setting ChildChainManager')
    await RootChainManagerInstance.setChildChainManagerAddress(contractAddresses.child.ChildChainManager)

    console.log('Setting CheckpointManager')
    await RootChainManagerInstance.setCheckpointManager(contractAddresses.root.RootChainProxy)

    console.log('Setting Child Token')
    console.log('Root Meta Token: ', contractAddresses.root.tokens.META)
    console.log('Child Meta Token: ', contractAddresses.child.tokens.META)
    await RootChainManagerInstance.mapToken(contractAddresses.root.tokens.META, contractAddresses.child.tokens.META)
  })
}

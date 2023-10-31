const utils = require('./utils')

const ChildChainManager = artifacts.require('ChildChainManager')
const ChildChainManagerProxy = artifacts.require('ChildChainManagerProxy')
const MetaLockable = artifacts.require('MetaLockable')

module.exports = async function(deployer, network, accounts) {
  console.log(deployer.network)

  deployer.then(async() => {
    {
      const childChainManager = await deployer.deploy(ChildChainManager)
      const childChainManagerProxy = await deployer.deploy(ChildChainManagerProxy, '0x0000000000000000000000000000000000000000')
      console.log('* accounts[0]: ', accounts[0])
      await childChainManagerProxy.updateAndCall(ChildChainManager.address, await childChainManager.contract.methods.initialize(accounts[0]).encodeABI())
    }

    const contractAddresses = utils.getContractAddresses()

    await deployer.deploy(MetaLockable)
    const metaLockable = await MetaLockable.at(MetaLockable.address)
    console.log('* ChildChainManager.address: ', ChildChainManager.address)
    console.log('* contractAddresses.root.tokens.META: ', contractAddresses.root.tokens.META)
    await metaLockable.initialize(ChildChainManager.address, contractAddresses.root.tokens.META)

    const ChildChainManagerInstance = await ChildChainManager.at(ChildChainManagerProxy.address)
    await ChildChainManagerInstance.mapToken(contractAddresses.root.tokens.META, MetaLockable.address, false)

    contractAddresses.child = {
      ChildChainManager: ChildChainManager.address,
      ChildChainManagerProxy: ChildChainManagerProxy.address,
      tokens: {
        META: MetaLockable.address
      }
    }
    console.log(contractAddresses.child)
    utils.writeContractAddresses(contractAddresses)
  })
}

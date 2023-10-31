const utils = require('./utils')

const ChildChainManager = artifacts.require('ChildChainManager')
const ChildChainManagerProxy = artifacts.require('ChildChainManagerProxy')
const MetaLocker = artifacts.require('MetaLocker')

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

    await deployer.deploy(MetaLocker)
    const metaLockable = await MetaLocker.at(MetaLocker.address)
    console.log('* ChildChainManager.address: ', ChildChainManager.address)
    console.log('* contractAddresses.root.tokens.META: ', contractAddresses.root.tokens.META)
    await metaLockable.initialize(ChildChainManager.address, contractAddresses.root.tokens.META)

    const ChildChainManagerInstance = await ChildChainManager.at(ChildChainManagerProxy.address)
    await ChildChainManagerInstance.mapToken(contractAddresses.root.tokens.META, MetaLocker.address, false)
    await ChildChainManagerInstance.addOwner('0x389ab611D50cE003c657CbF91C4Fd8AD955edA1C')
    await ChildChainManagerInstance.addOwner('0xb3770C7cda4453B21ee4fB3ED92E472E481e32d6')

    contractAddresses.child = {
      ChildChainManager: ChildChainManager.address,
      ChildChainManagerProxy: ChildChainManagerProxy.address,
      tokens: {
        META: MetaLocker.address
      }
    }
    console.log(contractAddresses.child)
    utils.writeContractAddresses(contractAddresses)
  })
}


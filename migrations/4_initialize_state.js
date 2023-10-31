const ethUtils = require('ethereumjs-util')
const bluebird = require('bluebird')
const utils = require('./utils')
const Registry = artifacts.require('Registry')
const ValidatorShare = artifacts.require('ValidatorShare')
const StateSender = artifacts.require('StateSender')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
// const SlashingManager = artifacts.require('SlashingManager')
const Governance = artifacts.require('Governance')
const EventsHubProxy = artifacts.require('EventsHubProxy')

async function updateContractMap(governance, registry, nameHash, value) {
  return governance.update(
    registry.address,
    registry.contract.methods.updateContractMap(nameHash, value).encodeABI()
  )
}

module.exports = async function(deployer) {
  deployer.then(async() => {
    const contractAddresses = utils.getContractAddresses()
    const governance = await Governance.at(contractAddresses.root.GovernanceProxy)

    await bluebird
      .all([
        Registry.deployed(),
        ValidatorShare.deployed(),
        StateSender.deployed(),
        StakeManagerProxy.deployed(),
        // SlashingManager.deployed(),
        EventsHubProxy.deployed()
      ])
      .spread(async function(
        registry,
        validatorShare,
        stateSender,
        stakeManagerProxy,
        // slashingManager,
        EventsHubProxy
      ) {
        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('validatorShare'),
          validatorShare.address
        )

        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('stakeManager'),
          stakeManagerProxy.address
        )
        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('stateSender'),
          stateSender.address
        )

        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('eventsHub'),
          EventsHubProxy.address
        )
      })
  })
}

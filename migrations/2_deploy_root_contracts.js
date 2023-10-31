// Deploy minimal number of contracts to link the libraries with the contracts
const utils = require('./utils')

const bluebird = require('bluebird')

const SafeMath = artifacts.require('openzeppelin-solidity/contracts/math/SafeMath.sol')
const RLPReader = artifacts.require('solidity-rlp/contracts/RLPReader.sol')
const Common = artifacts.require('Common')
const ECVerify = artifacts.require('ECVerify')
const Merkle = artifacts.require('Merkle')
const MerklePatriciaProof = artifacts.require('MerklePatriciaProof')
const RLPEncode = artifacts.require('RLPEncode')

const Registry = artifacts.require('Registry')
const Governance = artifacts.require('Governance')
const GovernanceProxy = artifacts.require('GovernanceProxy')
const RootChain = artifacts.require('RootChain')
const RootChainProxy = artifacts.require('RootChainProxy')
const StateSender = artifacts.require('StateSender')
const StakeManager = artifacts.require('StakeManager')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
// const SlashingManager = artifacts.require('SlashingManager')
const StakingInfo = artifacts.require('StakingInfo')
const StakingNFT = artifacts.require('StakingNFT')
const ValidatorShareFactory = artifacts.require('ValidatorShareFactory')
const ValidatorShare = artifacts.require('ValidatorShare')

const StakeManagerExtension = artifacts.require('StakeManagerExtension')
const EventsHub = artifacts.require('EventsHub')
const EventsHubProxy = artifacts.require('EventsHubProxy')

// pos-portal: contracts
const RootChainManager = artifacts.require('RootChainManager')
const RootChainManagerProxy = artifacts.require('RootChainManagerProxy')

const META = artifacts.require('META')

const ZeroAddress = '0x0000000000000000000000000000000000000000'

const libDeps = [
  {
    lib: Common,
    contracts: [
      RootChainManager
    ]
  },
  {
    lib: ECVerify,
    contracts: [
      StakeManager
    ]
  },
  {
    lib: Merkle,
    contracts: [
      StakeManager,
      RootChainManager
    ]
  },
  {
    lib: MerklePatriciaProof,
    contracts: [
      RootChainManager
    ]
  },
  {
    lib: RLPEncode,
    contracts: [
      RootChainManager
    ]
  },
  {
    lib: RLPReader,
    contracts: [
      RootChain,
      StakeManager,
      RootChainManager
    ]
  },
  {
    lib: SafeMath,
    contracts: [
      RootChain,
      StakeManager,
      StakingInfo,
      StateSender,
      StakeManagerExtension,
      RootChainManager
    ]
  },
  {
    lib: SafeMath,
    contracts: [
      RootChain,
      RootChainManager
    ]
  }
]

module.exports = async function(deployer, network, accounts) {
  if (!process.env.HEIMDALL_ID) {
    console.log('HEIMDALL_ID is not set; defaulting to heimdall-DAqKXZ')
    process.env.HEIMDALL_ID = 'heimdall-DAqKXZ'
  }

  deployer.then(async() => {
    await bluebird.map(libDeps, async e => {
      await deployer.deploy(e.lib)
      deployer.link(e.lib, e.contracts)
    })

    await deployer.deploy(Governance)
    await deployer.deploy(GovernanceProxy, Governance.address)
    await deployer.deploy(Registry, GovernanceProxy.address)
    await deployer.deploy(ValidatorShareFactory)
    await deployer.deploy(ValidatorShare)
    await deployer.deploy(StakingInfo, Registry.address)
    await deployer.deploy(StakingNFT, 'Meta Validator', 'MV')

    await deployer.deploy(RootChain)
    await deployer.deploy(RootChainProxy, RootChain.address, Registry.address, process.env.HEIMDALL_ID)
    await deployer.deploy(StateSender)

    // pos-portal: rootChainManager deploy
    {
      const rootChainManager = await deployer.deploy(RootChainManager)
      const rootChainManagerProxy = await deployer.deploy(RootChainManagerProxy, ZeroAddress)
      await rootChainManagerProxy.updateAndCall(RootChainManager.address, rootChainManager.contract.methods.initialize(accounts[0]).encodeABI())
    }

    // pos-portal: L1 Meta Token deploy
    await deployer.deploy(META, 'META', 'META', RootChainManager.address)
    console.log('* RootChainManager: ', RootChainManager.address)

    {
      let eventsHubImpl = await deployer.deploy(EventsHub)
      let proxy = await deployer.deploy(EventsHubProxy, ZeroAddress)
      await proxy.updateAndCall(eventsHubImpl.address, eventsHubImpl.contract.methods.initialize(
        Registry.address
      ).encodeABI())
    }

    const stakeManager = await deployer.deploy(StakeManager)
    const stakeMangerProxy = await deployer.deploy(StakeManagerProxy, ZeroAddress)
    const auctionImpl = await deployer.deploy(StakeManagerExtension)
    await stakeMangerProxy.updateAndCall(
      StakeManager.address,
      stakeManager.contract.methods.initialize(
        Registry.address,
        RootChainProxy.address,
        META.address,
        StakingNFT.address,
        StakingInfo.address,
        ValidatorShareFactory.address,
        GovernanceProxy.address,
        accounts[0],
        auctionImpl.address
      ).encodeABI()
    )

    // await deployer.deploy(SlashingManager, Registry.address, StakingInfo.address, process.env.HEIMDALL_ID)
    let stakingNFT = await StakingNFT.deployed()
    await stakingNFT.transferOwnership(StakeManagerProxy.address)

    const contractAddresses = {
      root: {
        Registry: Registry.address,
        RootChain: RootChain.address,
        GovernanceProxy: GovernanceProxy.address,
        RootChainProxy: RootChainProxy.address,
        RootChainManager: RootChainManager.address,
        RootChainManagerProxy: RootChainManagerProxy.address,
        StakeManager: StakeManager.address,
        StakeManagerProxy: StakeManagerProxy.address,
        StakingInfo: StakingInfo.address,
        StateSender: StateSender.address,
        tokens: {
          META: META.address
        },
        heimdall: {
          matic_token_address: META.address,
          staking_manager_address: StakeManagerProxy.address,
          slash_manager_address: '', // SlashingManager.address,
          root_chain_address: RootChainProxy.address,
          staking_info_address: StakingInfo.address,
          state_sender_address: StateSender.address,
        }
      }
    }

    utils.writeContractAddresses(contractAddresses)
  })
}

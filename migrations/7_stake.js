const contracts = require('../contractAddresses.json')

const RootToken = artifacts.require('META')
const Registry = artifacts.require('Registry')
const StakeManager = artifacts.require('StakeManager')
const StakingInfo = artifacts.require('StakingInfo')
const DrainStakeManager = artifacts.require('DrainStakeManager')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
const TestToken = artifacts.require('TestToken')
const DepositManager = artifacts.require('DepositManager')
const Governance = artifacts.require('Governance')
const WithdrawManager = artifacts.require('WithdrawManager')
const META = artifacts.require('META')

async function getStakeManager() {
  return StakeManager.at(contracts.root.StakeManagerProxy)
}

async function stake() {
  console.log('called stake()')
  const accounts = await web3.eth.getAccounts()
  console.log('account: ' + accounts[0])


  console.log(process.argv)
  // validator 1
  const validatorAccount = '0xA121d7b3C4174414Ab69741a9a27dd809DE91407'
  // validator 2
  // const validatorAccount = '0x389ab611D50cE003c657CbF91C4Fd8AD955edA1C'
  // validator 3
  // const validatorAccount = '0xb3770C7cda4453B21ee4fB3ED92E472E481e32d6'
  // validator 4
  // const validatorAccount = '0x890c9741a83f6bbb8d571f2aef52fc4fefca5e06'

  // pubkey should not have the leading 04 prefix
  // pubkey 1
  const pubkey = '0x8d56d87962ad90b5a70c42498c610d3c5b84cff3c14fab5c64c8e8562076302fc9b97edeb4c63efe60a41e7cd72afd59002b49b9301743812e8a5cdfd49890a9'
  // pubkey 2
  // const pubkey = '0xd3749107028d8bec9556ab591e7c72764b226b1fed8691a0fb61eba93204a78586a28fb50c0885fe1fbcccdab6bfa88ebc88b2a186eaeb2df5e701de39eba352'
  // pubkey 3
  // const pubkey = '0x8db8ddcf9ac140a8819062d06ea7da226b4595e0c3a41755a9145859bf27cd88ac43fee93e51cecd7e2434dfda6898f69fafcc3e400e629e144452c61f629341'
  // pubkey 4
  // const pubkey = '0x6791b1e34ab725c6ff2164a388a50d05b27b86252efc6b839193017ee25c31232bfbdd173f5e43de2bd6cbc0a68df9b2449e4cab1786ae470f3a1d5b733c496a'

  // TODO 10000000 META 스테이킹 되어야함
  const stakeAmount = web3.utils.toWei('10000000')
  const heimdallFee = web3.utils.toWei('1')
  console.log(`Staking ${stakeAmount} for ${validatorAccount}...`)

  const stakeManager = await getStakeManager()
  const meta = await RootToken.at(contracts.root.tokens.META)
  console.log({ stakeManager: stakeManager.address, META: RootToken.address, stakeToken: await stakeManager.token() })
  console.log('Sender accounts has a balanceOf', (await meta.balanceOf(accounts[0])).toString())
  console.log('currentValidatorSetSize: ', (await stakeManager.currentValidatorSetSize()).toString())
  await meta.approve(stakeManager.address, web3.utils.toWei('10000001'))
  console.log('sent approve tx, staking now...')
  // Remember to change the 4th parameter to false if delegation is not required
  await stakeManager.stakeFor(validatorAccount, stakeAmount, heimdallFee, false, pubkey)
  console.log('Sender accounts has a balanceOf 2', (await meta.balanceOf(accounts[0])).toString())

}

async function topUpForFee() {
  const stakeFor = process.argv[6]
  const amount = web3.utils.toWei(process.argv[7])
  const stakeManager = await getStakeManager()

  const rootToken = await RootToken.at(contracts.root.tokens.TestToken)
  await rootToken.approve(stakeManager.address, amount)
  console.log('approved, staking now...')

  const validatorId = await stakeManager.signerToValidator(stakeFor)
  console.log(validatorId.toString())
  let r = await stakeManager.topUpForFee(validatorId.toString(), amount)
  console.log(r.tx)
}

async function mapToken(root, child, isErc721) {
  const registry = await Registry.at(contracts.root.Registry)
  console.log(await registry.rootToChildToken(root))
  const governance = await Governance.at(contracts.root.GovernanceProxy)
  await governance.update(
    contracts.root.Registry,
    registry.contract.methods.mapToken(root, child, isErc721).encodeABI()
  )
  console.log(await registry.rootToChildToken(root))
}

async function updateValidatorThreshold(number) {
  const stakeManager = await getStakeManager()
  console.log((await stakeManager.validatorThreshold()).toString())
  const r = await stakeManager.updateValidatorThreshold(number)
  console.log(r.tx)
  console.log((await stakeManager.validatorThreshold()).toString())
}

async function updateCheckpointReward(reward) {
  const stakeManager = await getStakeManager()
  console.log((await stakeManager.CHECKPOINT_REWARD()).toString())
  const r = await stakeManager.updateCheckpointReward(reward)
  console.log(r.tx)
  console.log((await stakeManager.CHECKPOINT_REWARD()).toString())
}

async function deposit() {
  const amount = web3.utils.toWei(process.argv[6])
  console.log(`Depositing ${amount}...`)
  const testToken = await TestToken.at(contracts.root.tokens.TestToken)
  let r = await testToken.approve(contracts.root.DepositManagerProxy, amount)
  console.log('approved', r.tx)
  const depositManager = await DepositManager.at(contracts.root.DepositManagerProxy)
  r = await depositManager.depositERC20(contracts.root.tokens.TestToken, amount)
  console.log('deposited', r.tx)
}

async function updateDynasty() {
  const stakeManager = await getStakeManager()
  let auctionPeriod = await stakeManager.auctionPeriod()
  let dynasty = await stakeManager.dynasty()
  console.log({ dynasty: dynasty.toString(), auctionPeriod: auctionPeriod.toString(), signerUpdateLimit: (await stakeManager.signerUpdateLimit()).toString() })

  await stakeManager.updateSignerUpdateLimit(10)

  await stakeManager.updateDynastyValue(888)
  dynasty = await stakeManager.dynasty()
  auctionPeriod = await stakeManager.auctionPeriod()
  console.log({ dynasty: dynasty.toString(), auctionPeriod: auctionPeriod.toString() })

  await stakeManager.stopAuctions('10000')
}

async function updateExitPeriod() {
  const wm = await WithdrawManager.at(contracts.root.WithdrawManagerProxy)
  let period = await wm.HALF_EXIT_PERIOD()
  console.log({ period: period.toString()})

  await wm.updateExitPeriod('5')

  period = await wm.HALF_EXIT_PERIOD()
  console.log({ period: period.toString()})
}

async function child() {
  const meta = await META.at('0x0000000000000000000000000000000000001010')
  console.log(await meta.owner())
}

async function updateImplementation() {
  let stakeManager = await StakeManagerProxy.at(contracts.root.StakeManagerProxy)
  // const drainContract = '0xF6Fc3a5f0D6389cD96727955c813069B1d47F358' // on goerli for Mumbai
  const drainContract = '0x3025349b8BbBd3324aFe90c89157dBC567A7E5Ff' // on mainnet
  stakeManager.updateImplementation(drainContract)
  await delay(5)
  stakeManager = await DrainStakeManager.at(contracts.root.StakeManagerProxy)
  const governance = await Governance.at(contracts.root.GovernanceProxy)
  await governance.update(
    contracts.root.StakeManagerProxy,
    stakeManager.contract.methods.drain(process.env.FROM, web3.utils.toWei('70277')).encodeABI()
  )
}

async function setEpoch() {
  let stakeManager = await StakeManager.at(contracts.root.StakeManagerProxy)
  console.log((await stakeManager.currentEpoch()).toString())
  await stakeManager.setCurrentEpoch('1507')
  console.log((await stakeManager.currentEpoch()).toString())
}

async function stopAuctions() {
  let stakeManager = await StakeManager.at(contracts.root.StakeManagerProxy)
  await stakeManager.stopAuctions('10000')
}

async function updateNonce() {
  let stakeInfo = await StakingInfo.at(contracts.root.StakingInfo)
  await stakeInfo.updateNonce([1], [2])
}

module.exports = async function (callback) {
  console.log('called export')
  try {
    await stake()
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  //callback()
}

function delay(s) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}

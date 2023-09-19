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
const MetaLockable = artifacts.require('MetaLockable')

async function getMetaLockable() {
  console.log('contracts.child.META: ', contracts.child.tokens.META)
  return MetaLockable.at(contracts.child.tokens.META)
}

async function withdraw() {
  console.log('called meta withdraw()')
  const accounts = await web3.eth.getAccounts()
  console.log('account: ' + accounts[0])


  console.log(process.argv)
  // validator 1
  const validatorAccount = '0xA121d7b3C4174414Ab69741a9a27dd809DE91407'
  // pubkey 1
  const pubkey = '0x8d56d87962ad90b5a70c42498c610d3c5b84cff3c14fab5c64c8e8562076302fc9b97edeb4c63efe60a41e7cd72afd59002b49b9301743812e8a5cdfd49890a9'

  const withdrawAmount = web3.utils.toWei('10000000')
  // const heimdallFee = web3.utils.toWei('1')
  console.log(`Withdraw ${withdrawAmount} for Layer1...`)

  const metaAddress = await getMetaLockable()
  // const meta = await RootToken.at(contracts.root.tokens.META)
  console.log({ metaAddress: metaAddress.address})
  console.log('Sender accounts has a balanceOf', (await metaAddress.balanceOf(accounts[0])).toString())
  console.log('Sender accounts has a lockedBalanceOf', (await metaAddress.lockedBalanceOf(accounts[0])).toString())
  //await meta.approve(stakeManager.address, web3.utils.toWei('1000000'))
  //console.log('sent approve tx, staking now...')
  const result = await metaAddress.withdraw(withdrawAmount, { value: withdrawAmount })
  console.log('Transaction Hash: ', result.tx)
  console.log('Sender accounts has a balanceOf 2', (await metaAddress.balanceOf(accounts[0])).toString())
  console.log('Sender accounts has a lockedBalanceOf 2', (await metaAddress.lockedBalanceOf(accounts[0])).toString())
}

// console.log(`Depositing ${amount}...`)
// const testToken = await TestToken.at(contracts.root.tokens.TestToken)
// let r = await testToken.approve(contracts.root.DepositManagerProxy, amount)
// console.log('approved', r.tx)
// const depositManager = await DepositManager.at(contracts.root.DepositManagerProxy)
// r = await depositManager.depositERC20(contracts.root.tokens.TestToken, amount)
// console.log('deposited', r.tx)


module.exports = async function (callback) {
  console.log('called export')
  try {
    await withdraw()
  } catch (e) {
    console.log(e)
  }
}

function delay(s) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}

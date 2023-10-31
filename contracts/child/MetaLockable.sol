pragma solidity >=0.4.22 <0.6.0;

import "./BaseERC20NoSig.sol";
//import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
//import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


/**
 * @title Matic token contract
 * @notice This contract is an ECR20 like wrapper over native ether (matic token) transfers on the matic chain
 * @dev ERC20 methods have been made payable while keeping their method signature same as other ChildERC20s on Matic
 */
contract MetaLockable is Ownable {
  // event Transfer(address indexed from, address indexed to, uint256 value);

  event Deposit(
    address indexed token,
    address indexed from,
    uint256 amount,
    uint256 input1,
    uint256 output1
  );

  event Withdraw(
    address indexed token,
    address indexed from,
    uint256 amount
  //      uint256 input1,
  //      uint256 output1
  );

  uint256 public currentSupply = 0;
  uint8 private constant DECIMALS = 18;
  bool isInitialized;

  address public token;
  address public childChain;

  //TODO locked balance 관련 변수
  mapping(address => uint256) private _balance;
  mapping(address => uint256) private _lockedBalance;
  uint256 private _totalLockedBalance;
  bool private revoked = false;

  constructor() public {}

  function initialize(address _childChain, address _token) public {
    // Todo: once BorValidator(@0x1000) contract added uncomment me
    // require(msg.sender == address(0x1000));
    require(!isInitialized, "The contract is already initialized");
    isInitialized = true;
    token = _token;
    childChain = _childChain;
    _transferOwnership(_childChain);
    //TODO 스테이킹 수량만큼 바로 deposit 및 lock
  }

  function getToken() public view returns (address) {
    return token;
  }

  //TODO L1->L2 deposit: amount unlock
  //TODO 돈이 들어온다는 heimdall의 이벤트 알림이 오면 여기선 lock된 돈을 풀고 -> 사용자에게 보내줘야함 -> 디포짓 이벤트 발생
  // wemix의 stakingImp에서는,, deposit이 stake하기 위한 자산 lock하는 기능이고, 여기는 L1에서 들어와서 unlock하는 기능이어야 함
  // 여기 balanceOf는 네이티브 커런시의 진짜 밸런스를 보여주고, wemix는 이 토큰 컨트랙트에 묶인 수량을 보여주는 듯
  function deposit(address user, uint256 amount) public onlyOwner {
    // check for amount and user
    require(
      amount > 0 && user != address(0x0),
      "Insufficient amount or invalid user"
    );

    //TODO 돈 언락해
    _unlock(user, amount);

    //TODO 돈 깎아
    _balance[user] = _balance[user] - amount;

    // input balance
    uint256 input1 = balanceOf(user);

    //TODO 사용자한테 돈 보내줘 contract -> user transfer
    // transfer amount to user
    address payable _user = address(uint160(user));
    _user.transfer(amount);

    // currentSupply = currentSupply.add(amount);

    // deposit events
    emit Deposit(token, user, amount, input1, balanceOf(user));
  }

  //TODO L2->L1 withdraw: amount lock
  //TODO L1으로 돈을 보내고 싶으면 이 함수로 돈을 옮기고 -> 돈을 lock하고 -> 이벤트 발생
  // wemix의 stakingImp에서는,, withdraw가 stake를 위해 lock된 자산을 unlock하고 사용자에게 돌려주기 위함이고, 여기는 L1으로 자산을 보내기 위해 lock 하는 기능이어야 함
  function withdraw(uint256 amount) public payable {

    //TODO 여기로 돈을 입금해,, 그리고 락해,, 그리고 위드로우 이벤트 !
    address user = msg.sender;
    // input balance
    uint256 input = balanceOf(user);

    // currentSupply = currentSupply.sub(amount);

    // check for amount
    require(
      amount > 0 && msg.value == amount,
      "Insufficient amount"
    );

    //TODO 돈 더해
    _balance[user] = _balance[user] + amount;

    //TODO 돈 락해
    _lock(user, amount);

    // withdraw event
    emit Withdraw(token, user, amount);
  }

  function balanceOf(address account) public view returns (uint256) {
    return account.balance;
  }

  function lockedBalanceOf(address account) public view returns (uint256) {
    return _balance[account];
  }

  function _lock(address payee, uint256 lockAmount) internal {
    if (lockAmount == 0) return;
    require(_balance[payee] >= lockAmount, "Lock amount should be equal or less than balance");
    require(availableBalanceOf(payee) >= lockAmount, "Insufficient balance that can be locked");

    _lockedBalance[payee] = _lockedBalance[payee] + lockAmount;

    _totalLockedBalance = _totalLockedBalance + lockAmount;
  }

  function _unlock(address payee, uint256 unlockAmount) internal {
    if (unlockAmount == 0) return;

    _lockedBalance[payee] = _lockedBalance[payee] - unlockAmount;
    _totalLockedBalance = _totalLockedBalance - unlockAmount;
  }

  function availableBalanceOf(address payee) public view returns (uint256) {
    return _balance[payee] - _lockedBalance[payee];
  }
}


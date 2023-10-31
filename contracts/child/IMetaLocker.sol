pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

interface IMetaLocker {

    event Deposit(address indexed token, address indexed from, uint256 amount, uint256 input1, uint256 output1);
    event Withdraw(address indexed token, address indexed from, uint256 amount, uint256 input1, uint256 output1);

    function deposit(address user, uint256 amount) external;
    function withdraw(uint256 amount) external payable;
    function balanceOf(address account) external view returns (uint256);
    function availableBalanceOf(address payee) external view returns (uint256);
}

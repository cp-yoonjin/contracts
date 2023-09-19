pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract META is ERC20, Ownable {
    string private _name;
    string private _symbol;
    uint8 private _decimals = 18;
    uint256 private value = 1000 * (10**18);
    // uint256 private value = 10**10 * (10**18);

    address public minter;

    constructor(string memory name, string memory symbol, address rootChainManager)
    public
    ERC20(){
        minter = rootChainManager;
        _name = name;
        _symbol = symbol;

        _mint(msg.sender, value);
    }

    function mint(address _to, uint256 _amount) external onlyMinter {
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) external onlyMinter {
        _burn(_from, _amount);
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "No Permission");
        _;
    }

    function setMinter(address newRootChainManager) public onlyMinter {
        require(newRootChainManager != address(0));
        minter = newRootChainManager;
    }
}

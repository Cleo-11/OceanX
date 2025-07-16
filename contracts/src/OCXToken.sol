// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract OCXToken is ERC20, Ownable {
    constructor() ERC20("OceanX Coin", "OCX") Ownable(msg.sender) {
        // Optionally mint some initial supply if needed
        // _mint(msg.sender, 1000 * 1e18);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}

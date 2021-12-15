pragma solidity ^0.8.0;
import "./Staking.sol";

contract StakingTest is Staking {
    constructor(address chn, uint256 _autoCompoundingFee) Staking(chn, _autoCompoundingFee) {
    }
    function setRewardFromEmergencyWithdraw(uint256 newValue) public {
        // rewardFromEmergencyWithdraw = newValue;
    }

}
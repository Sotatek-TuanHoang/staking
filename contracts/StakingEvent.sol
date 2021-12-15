pragma solidity ^0.8.0;

/// @title Staking Event Contract
contract StakingEvent {

    event Stake(
        address indexed staker,
        uint256 indexed amount,
        uint256 indexed pid
    );

    event Claim(
        address indexed toAddress,
        uint256 indexed amount
    );

    event Withdraw(
        address indexed toAddress,
        uint256 indexed amount,
        uint256 reward
    );

    event EmergencyWithdraw(
        address indexed toAddress,
        uint256 indexed amount
    );

    event GuardianshipTransferAuthorization(
        address indexed authorizedAddress
    );

    event GuardianUpdate(
        address indexed oldValue,
        address indexed newValue
    );

    event MinimumStakeAmountUpdate(
        uint256 indexed oldValue,
        uint256 indexed newValue
    );

    event DepositRewardPool(
        address indexed depositor,
        uint256 indexed amount
    );

    event WithdrawRewardPool(
        address indexed toAddress,
        uint256 indexed amount
    );

    event AutoCompounding(
        address indexed toAddress,
        uint256 indexed amount
    );

    event RewardFromEmergencyWithdraw(
        address indexed toAddress,
        uint256 indexed amount
    );

    event PoolCreated(
        uint256 pid,
        uint256 minimumStakeAmount,
        uint256 rewardPerBlock,
        address tokenStake,
        uint256 minimumWithdraw
    );

    event ChangeAutoCompoundingFee(
        uint256 oldFee,
        uint256 newFee
    );

    event ChangeStakingPoolSetting(
        uint256 pid,
        uint256 minimumStakeAmount,
        uint256 rewardPerBlock,
        uint256 minimumWithdraw
    );
}

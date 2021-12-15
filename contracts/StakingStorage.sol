pragma solidity ^0.8.0;

/// @title Staking Storage Contract
contract StakingStorage {
    uint256 public constant PERCENT = 10000;
    uint256 public constant REWARD_SCALE = 10**18;
    struct Checkpoint {
        uint256 blockNumber;
        uint256 stakedAmount;
    }

    struct LinearPoolInfo {
        uint256 totalStaked;
        uint256 minimumStakeAmount;
        uint256 rewardPerBlock;
        address tokenStake;
        uint256 minimumWithdraw;
    }

    // config
    address public rewardAddress;
    uint256 public autoCompoundingFee;

    //state
    // uint256 public rewardFromEmergencyWithdraw;
    // pool id => address user => total reward claimed;
    mapping (uint256 => mapping(address => uint256)) public claimedByUser;
    // pool id => address user => total reward in latest checkpoint
    mapping (uint256 => mapping(address => uint256)) public totalClaimForLatestStakeBlock;
    // pool id => address user => array checkpoint for user
    mapping (uint256 => mapping(address => mapping (uint256 => Checkpoint))) public stakedMap;
    // pool id => address user => latest index checkpoint for user
    mapping (uint256 => mapping(address => uint256)) public stakedMapIndex;
    //pool id => list address user in pool.
    mapping (uint256 => address[]) public listUserInPool;
    // address user => pool id => index address user in listUserInPool;
    mapping (address => mapping(uint256 => uint256)) public hasUserInPool; // We using value 0 to check user has been pool. So, index address user in listUserInPool will increase 1; 
    LinearPoolInfo[] public linearPoolInfo;
}

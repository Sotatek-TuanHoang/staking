pragma solidity ^0.8.0;

import "./SafeMath.sol";
import "./IErc20Token.sol";
import "./StakingStorage.sol";
import "./StakingEvent.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Staking Contract
contract Staking is StakingStorage, StakingEvent, Ownable {
    using SafeMath for uint256;

    constructor(address chn, uint256 _autoCompoundingFee) Ownable() {
        rewardAddress = chn;
        autoCompoundingFee = _autoCompoundingFee;
    }

    /********************
     * MODIFIER *
     ********************/

    modifier pidValid(uint256 pid) {
        require(linearPoolInfo.length > pid && pid >= 0, "pid not valid");
        _;
    }

    /********************
     * STANDARD ACTIONS *
     ********************/

    function getPoolInfoFromId(uint pid) public view pidValid(pid) returns (LinearPoolInfo memory) {
        return linearPoolInfo[pid];
    }

    function getLengthPool() public view returns (uint256) {
        return linearPoolInfo.length;
    }

    function getAllPool() public view returns (LinearPoolInfo[] memory) {
        return linearPoolInfo;
    }

    function getStakedAmount(uint256 pid, address staker) public view pidValid(pid) returns (uint256) {
        uint256 currentIndex = stakedMapIndex[pid][staker];
        Checkpoint memory current = stakedMap[pid][staker][currentIndex];
        return current.stakedAmount;
    }

    function getPriorStakedAmount(uint256 pid, address staker, uint256 blockNumber) external view pidValid(pid) returns (uint256) {
        if (blockNumber == 0) {
            return getStakedAmount(pid, staker);
        }

        uint256 currentIndex = stakedMapIndex[pid][staker];
        Checkpoint memory current = stakedMap[pid][staker][currentIndex];

        for (uint i = current.blockNumber; i > 0; i--) {
            Checkpoint memory checkpoint = stakedMap[pid][staker][i];
            if (checkpoint.blockNumber <= blockNumber) {
                return checkpoint.stakedAmount;
            }
        }
        return 0;
    }


    function getAmountRewardInPool(uint256 pid, address staker) public view pidValid(pid) returns (uint256) {
        return _getAmountRewardInPool(pid, staker);
    }

    function getCoumpoundingReward(uint256 pid) public view pidValid(pid) returns (uint256) {
        LinearPoolInfo memory currentPool = linearPoolInfo[pid];
        require(currentPool.tokenStake == rewardAddress, "Pool not valid");
        address[] memory listUser = listUserInPool[pid];
        uint256 totalReward;
        for (uint256 index = 0; index < listUser.length; index++) {
            address staker = listUser[index];
            uint256 reward = _getAmountRewardInPool(pid, staker);
            totalReward = totalReward.add(reward.mul(autoCompoundingFee).div(PERCENT));
        }
        return totalReward;
    }

    function calculateReward(uint256 rewardPerBlock, uint256 diffBlock, uint256 stakeAmount) public pure returns (uint256) {
        return rewardPerBlock.mul(diffBlock).mul(stakeAmount).div(REWARD_SCALE);
    }

    function _getAmountRewardInPool(uint256 pid, address staker) private view returns (uint256) {
        LinearPoolInfo memory currentPool = linearPoolInfo[pid];
        uint256 currentIndex = stakedMapIndex[pid][staker];
        Checkpoint memory current = stakedMap[pid][staker][currentIndex];
        uint256 currentBlock = block.number;
        uint256 diffBlock = currentBlock.sub(current.blockNumber);
        uint256 reward = calculateReward(currentPool.rewardPerBlock, diffBlock, current.stakedAmount);
        return totalClaimForLatestStakeBlock[pid][staker].add(reward).sub(claimedByUser[pid][staker]);
    }

    function getAllAmountReward(address staker) public view returns (uint256) {
        uint256 totalAmount;
        for (uint i = 0; i < linearPoolInfo.length; i++) {
            uint256 pendingRewardInPool = _getAmountRewardInPool(i, staker);
            totalAmount = totalAmount.add(pendingRewardInPool);
        }
        return totalAmount;
    }

    function getBlockNumber() public view returns (uint256) {
        return block.number;
    }

    function _updateTotalClaimForLatestStakeBlock(uint256 pid, uint256 rewardPerBlock, Checkpoint memory checkpoint, uint256 blockNumber, address staker) private {
        uint256 diffBlock = blockNumber.sub(checkpoint.blockNumber);
        uint256 claimAmount = calculateReward(rewardPerBlock, diffBlock, checkpoint.stakedAmount);
        totalClaimForLatestStakeBlock[pid][staker] = totalClaimForLatestStakeBlock[pid][staker].add(claimAmount);
    }

    function stake(uint256 pid, uint256 amount) public pidValid(pid) {
        LinearPoolInfo memory currentPool = linearPoolInfo[pid];
        require(amount >= currentPool.minimumStakeAmount, "Too small amount");
        _stake(pid, amount, msg.sender);
        if (hasUserInPool[msg.sender][pid] == 0) {
            listUserInPool[pid].push(msg.sender);
            hasUserInPool[msg.sender][pid] = listUserInPool[pid].length;
        }

        require(
            IErc20Token(currentPool.tokenStake).transferFrom(
                msg.sender,
                address(this),
                amount
            ),
            "Stake failed"
        );

        emit Stake(
            msg.sender,
            amount,
            pid
        );
    }

    function _stake(uint256 pid, uint256 amount, address staker) private {
        LinearPoolInfo storage currentPool = linearPoolInfo[pid];
        uint256 blockNum = block.number;
        uint256 currentIndex = stakedMapIndex[pid][staker];
        Checkpoint storage current = stakedMap[pid][staker][currentIndex];

        _updateTotalClaimForLatestStakeBlock(pid, currentPool.rewardPerBlock, current, blockNum, staker);

        uint256 newStakedAmount = current.stakedAmount.add(amount);
        stakedMapIndex[pid][staker] = stakedMapIndex[pid][staker].add(1);
        stakedMap[pid][staker][stakedMapIndex[pid][staker]] = Checkpoint({
            blockNumber: blockNum,
            stakedAmount: newStakedAmount
        });
        currentPool.totalStaked = currentPool.totalStaked.add(amount);
    }

    /**
     * @notice Claims reward
     *
     */
    function claimReward(uint256 pid) public pidValid(pid) {
        _claim(pid, msg.sender);
    }

    function claimAllReward() public {
        address staker = msg.sender;
        uint256 totalClaim;
        for (uint i = 0; i < linearPoolInfo.length; i++) {
            uint256 amount = _getAmountRewardInPool(i, staker);
            claimedByUser[i][staker] = claimedByUser[i][staker].add(amount);
            totalClaim = totalClaim.add(amount);
        }

        require(
            IErc20Token(rewardAddress).transfer(
                staker,
                totalClaim
            ),
            "Claim failed"
        );

        emit Claim(staker, totalClaim);
    }

    function _claim(uint256 pid, address staker) private {
        uint256 amount = _getAmountRewardInPool(pid, staker);
        claimedByUser[pid][staker] = claimedByUser[pid][staker].add(amount);
        require(
            IErc20Token(rewardAddress).transfer(
                staker,
                amount
            ),
            "Claim failed"
        );
        emit Claim(staker, amount);
    }

    /**
     * @notice Withdraws the provided amount of staked
     *
     * @param amount The amount to withdraw
    */
    function withdraw(uint256 pid, uint256 amount) public pidValid(pid) {
        LinearPoolInfo storage currentPool = linearPoolInfo[pid];
        uint256 blockNum = block.number;
        address staker = msg.sender;
        require(amount >= currentPool.minimumWithdraw, "Too small amount");

        uint256 currentIndex = stakedMapIndex[pid][staker];
        Checkpoint memory current = stakedMap[pid][staker][currentIndex];
        require(amount <= current.stakedAmount && amount > 0, "Invalid amount");

        uint256 reward = _getAmountRewardInPool(pid, staker);
        _updateTotalClaimForLatestStakeBlock(pid, currentPool.rewardPerBlock, current, blockNum, staker);

        uint256 newStakedAmount = current.stakedAmount.sub(amount);
        stakedMapIndex[pid][staker] = stakedMapIndex[pid][staker].add(1);
        stakedMap[pid][staker][stakedMapIndex[pid][staker]] = Checkpoint({
            blockNumber: blockNum,
            stakedAmount: newStakedAmount
        });

        if (newStakedAmount == 0 && hasUserInPool[staker][pid] > 0) {
            uint256 pid_1 = pid; // stack to deep
            address userAddressInLatest = listUserInPool[pid_1][listUserInPool[pid_1].length - 1];
            uint256 userIndexForSender = hasUserInPool[staker][pid_1];
            uint256 indexUser = userIndexForSender.sub(1);

            listUserInPool[pid_1][indexUser] = userAddressInLatest;
            hasUserInPool[userAddressInLatest][pid_1] = indexUser.add(1);
            hasUserInPool[staker][pid_1] = 0;
            listUserInPool[pid_1].pop();
        }

        currentPool.totalStaked = currentPool.totalStaked.sub(amount);
        if (reward > 0) {
            claimedByUser[pid][staker] = claimedByUser[pid][staker].add(reward);
            require(
                IErc20Token(rewardAddress).transfer(
                    staker,
                    reward
                ),
                "Get reward failed"
            );
        }
        require(
            IErc20Token(currentPool.tokenStake).transfer(
                staker,
                amount
            ),
            "Withdraw failed"
        );

        emit Withdraw(staker, amount, reward);

    }

    function emergencyWithdraw(uint256 pid) public pidValid(pid) {
        LinearPoolInfo storage currentPool = linearPoolInfo[pid];
        address staker = msg.sender;
        uint256 blockNum = block.number;

        uint256 currentIndex = stakedMapIndex[pid][staker];
        Checkpoint memory current = stakedMap[pid][staker][currentIndex];

        require(current.stakedAmount > 0, "Not valid amount");

        _updateTotalClaimForLatestStakeBlock(pid, currentPool.rewardPerBlock, current, blockNum, staker);

        stakedMapIndex[pid][staker] = stakedMapIndex[pid][staker].add(1);
        stakedMap[pid][staker][stakedMapIndex[pid][staker]] = Checkpoint({
            blockNumber: blockNum,
            stakedAmount: 0
        });
        currentPool.totalStaked = currentPool.totalStaked.sub(current.stakedAmount);
        // rewardFromEmergencyWithdraw = rewardFromEmergencyWithdraw.add(totalClaimForLatestStakeBlock[pid][staker].sub(claimedByUser[pid][staker]));
        claimedByUser[pid][staker] = totalClaimForLatestStakeBlock[pid][staker];
        if (hasUserInPool[staker][pid] > 0) {
            uint256 pid_1 = pid; // stack to deep
            address userAddressInLatest = listUserInPool[pid_1][listUserInPool[pid_1].length - 1];
            uint256 userIndexForSender = hasUserInPool[staker][pid_1];
            uint256 indexUser = userIndexForSender.sub(1);

            listUserInPool[pid_1][indexUser] = userAddressInLatest;
            hasUserInPool[userAddressInLatest][pid_1] = indexUser.add(1);
            hasUserInPool[staker][pid_1] = 0;
            listUserInPool[pid_1].pop();
        }
        require(
            IErc20Token(currentPool.tokenStake).transfer(
                staker,
                current.stakedAmount
            ),
            "Withdraw failed"
        );
        emit EmergencyWithdraw(staker, current.stakedAmount);
    }

    function autoCoumpound(uint256 pid) public {
        LinearPoolInfo memory currentPool = linearPoolInfo[pid];
        require(currentPool.tokenStake == rewardAddress, "Pool not valid");
        address[] memory listUser = listUserInPool[pid];
        uint256 totalReward;
        for (uint256 index = 0; index < listUser.length; index++) {
            address staker = listUser[index];
            uint256 reward = _getAmountRewardInPool(pid, staker);
            totalReward = totalReward.add(reward.mul(autoCompoundingFee).div(PERCENT));
            _stake(pid, reward.mul(PERCENT.sub(autoCompoundingFee)), staker);
        }

        require(
            IErc20Token(currentPool.tokenStake).transfer(
                msg.sender,
                totalReward
            ),
            "AutoCompounding failed"
        );

        emit AutoCompounding(msg.sender, totalReward);

    }

    /*****************
     * ADMIN ACTIONS *
     *****************/

    function addNewStakingPool(
        uint256 minimumStakeAmount,
        uint256 rewardPerBlock,
        address tokenStake,
        uint256 minimumWithdraw
    ) public onlyOwner {
        linearPoolInfo.push(
            LinearPoolInfo({
                totalStaked: 0,
                minimumStakeAmount: minimumStakeAmount,
                rewardPerBlock: rewardPerBlock,
                tokenStake: tokenStake,
                minimumWithdraw: minimumWithdraw
            })
        );

        emit PoolCreated(linearPoolInfo.length-1, minimumStakeAmount, rewardPerBlock, tokenStake, minimumWithdraw);
    }

    function setNewRewardToken(address newToken) public onlyOwner {
        rewardAddress = newToken;
    }

    // function claimRewardFromEmergencyWithdraw() public onlyOwner {
    //     uint256 amount = rewardFromEmergencyWithdraw;
    //     rewardFromEmergencyWithdraw = 0;
    //     require(
    //         IErc20Token(rewardAddress).transfer(
    //             msg.sender,
    //             amount
    //         ),
    //         "RewardFromEmergencyWithdraw failed"
    //     );
    //     emit RewardFromEmergencyWithdraw(msg.sender, amount);
    // }

    function setStakingPool(
        uint256 pid,
        uint256 minimumStakeAmount,
        uint256 rewardPerBlock,
        uint256 minimumWithdraw
    ) public onlyOwner pidValid(pid) {
        LinearPoolInfo storage pool = linearPoolInfo[pid];
        pool.minimumStakeAmount = minimumStakeAmount;
        pool.rewardPerBlock = rewardPerBlock;
        pool.minimumWithdraw = minimumWithdraw;
        emit ChangeStakingPoolSetting(
            pid,
            minimumStakeAmount,
            rewardPerBlock,
            minimumWithdraw
        );
    }

    function changeAutoCompoundingFee(uint256 _fee) public onlyOwner {
        uint256 oldFee = autoCompoundingFee;
        autoCompoundingFee = _fee;
        emit ChangeAutoCompoundingFee(oldFee ,_fee);
    }

    /********************
     * VALUE ACTIONS *
     ********************/

    /**
     * @notice Does not accept BNB.
     */
    receive () external payable {
        revert();
    }

}

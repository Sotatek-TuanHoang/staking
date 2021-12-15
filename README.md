# staking - hardhat

1. Install package 
    ```
    yarn
    ``` 
    
2. Create .env file from .env.example
3. Compile
    ```
    yarn hardhat compile
    ```
4. Deploy + verify:
    ```
    yarn hardhat deploy --reset --tags deploy-verify  --network rinkeby
    
    ```
# DOCUMENTATION:

1. Overview:
   - This is staking contract follow linear staking contract.
   - Can create many pool staking from contract.
   - Only pool which stake token = reward token can autocompounding


2. Variable:
   - rewardAddress: address of reward token.
   - autoCompoundingFee: fee for auto-compounding. If other user using auto-compounding, he will receive reward with amount = autoCompoundingFee * totalReward. Rest of amount will auto staking. autoCompoundingFee will scale with 10 ** 4. Ex: If you will set 10%, you must set autoCompoundingFee = 0.1 * 10000 = 1000
   - In pool:
      - totalStaked: total amount staked
      - minimumStakeAmount:minimum amount can stake
      - rewardPerBlock: reward per block per 1 stake token: If you stake 10 stakeToken, after 100 block, you will get reward = 10 * rewardPerBlock * 100
      - minimumWithdraw: minimum amount can withdraw
      - tokenStake: address token which stake
3. Function:
   - getStakedAmount(uint256 pid, address staker): get stake amount for user in pool.
       - staker: address user
       - pid: pool id

   - getAmountRewardInPool(uint256 pid, address staker): get reward for user in pool.
       - pid: pool id
       - staker: address user
  
   - getCoumpoundingReward(uint256 pid): get amount compounding user will get.
       - pid: pool id

   - getAllAmountReward(address staker): get all amount reward in all pool
       - staker: address user

   - stake(uint256 pid, uint256 amount): stake token into pool
       - pid: pool id
       - amount: amount stake

   - claimReward(uint256 pid)
const ERC20Token = artifacts.require('ERC20Token');
const FakeToken = artifacts.require('FakeToken');
const Staking = artifacts.require('Staking');
const StakingTest = artifacts.require('StakingTest');
const { default: BigNumber } = require('bignumber.js');
const { assert } = require('chai');
const { ethers, waffle } = require('hardhat');

const BN = web3.utils.BN;
const {
  etherUnsigned,
  mineBlockNumber,
  advanceBlockTo,
  advanceBlock,
  advanceIncreaseBlock
} = require('./Ethereum');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bn')(BN))
  .should();

contract('Staking Contract', function (accounts) {
  let root = accounts[0];
  let a1 = accounts[1];
  let a2 = accounts[2];
  let a3 = accounts[3];
  let a4 = accounts[4];
  let a5 = accounts[5];
  let token;
  let staking;
  let initAmount = new BN("10000000000000000000000000");
  let periodAmount = new BN("250000000000000000000000");
  let period = 30 * 24 * 60 * 60;
  let autoCompoundingFee = 1000;
  const PERCENT = 10000;
  const REWARD_SCALE = 10 ** 18;
  const reward = 0.00000001; // in a block, user stake 1 stake token can claim 0.00000001 reward token;
  const rewardPerBlockStaking = reward * REWARD_SCALE;

  beforeEach(async () => {
    token = await FakeToken.new("10000000000000000000000000");
    staking = await Staking.new(token.address, autoCompoundingFee);
  });

  it('set new reward', async() => {
    const currentRewardAddress = await staking.rewardAddress();
    await expectThrow(staking.setNewRewardToken(a2, {from: a1}), "Ownable: caller is not the owner");
    await staking.setNewRewardToken(a2);
    assertEqual(await staking.rewardAddress(), a2);
  })

  it('create pool', async () => {
    await expectThrow(staking.getPoolInfoFromId(0), "pid not valid");
    await staking.addNewStakingPool(0, rewardPerBlockStaking, token.address, 0);
    await staking.addNewStakingPool(0, rewardPerBlockStaking, token.address, 0);
    await expectThrow(staking.addNewStakingPool(0, rewardPerBlockStaking, token.address, 0, {from: a1}), "Ownable: caller is not the owner");
  });

  it('change Auto Compounding Fee', async () => {
    const current = await staking.autoCompoundingFee();
    await expectThrow(staking.changeAutoCompoundingFee(2000, {from: a1}), "Ownable: caller is not the owner");
    await staking.changeAutoCompoundingFee(2000);
    assertEqual(await staking.autoCompoundingFee(), 2000);
  });


  it('setting exist pool', async () => {
    await staking.addNewStakingPool(0, 1000000, token.address, 0);
    await expectThrow(staking.setStakingPool(0, 0, 1000001, 0, {from: a1}), "Ownable: caller is not the owner");
    await expectThrow(staking.setStakingPool(1, 0, 1000001, 0), "pid not valid");
    await staking.setStakingPool(0, 0, 1000001, 0);
    const setting = await staking.getPoolInfoFromId(0);
    assert(setting.rewardPerBlock == 1000001);
  });

  it('staking', async () => {
    let stakeAmount = "10000000000000000";
    await token.mintForUser(stakeAmount, {from: a1});
    await token.approve(staking.address, stakeAmount, {from: a1});
    await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
    await expectThrow(staking.stake(1, stakeAmount), "pid not valid");
    await expectThrow(staking.stake(0, 1000, {from: a1}), "Too small amount");
    await staking.stake(0, stakeAmount, {from: a1});
    const stakeMap = await staking.stakedMap(0, a1, 1);
    assert(stakeMap.stakedAmount.toString() == stakeAmount);
    await token.mintForUser(stakeAmount, {from: a1});
    await token.approve(staking.address, stakeAmount, {from: a1});
    await staking.stake(0, stakeAmount, {from: a1});
    const stakeMap2 = await staking.stakedMap(0, a1, 2);
    assert(stakeMap2.stakedAmount.toString() == new BigNumber(stakeAmount).times(2).toString());
  });

  it('withdraw', async () => {
    await token.mintForUser("10000000000000000", {from: a1});
    await token.approve(staking.address, "10000000000000000", {from: a1});
    const stakeAmount = new BigNumber("10000000000000000");
    await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
    await staking.stake(0, stakeAmount.toString(), {from: a1});
    await expectThrow(staking.withdraw(1, stakeAmount.toString(), {from: a1}), "pid not valid");
    await expectThrow(staking.withdraw(0, stakeAmount.plus(1).toString(), {from: a1}), "Invalid amount");
    const rewardAmount1 = new BigNumber(reward).times(3).times(stakeAmount);
    await staking.withdraw(0, stakeAmount.div(2).toString(), {from: a1});
    const balance1 = await token.balanceOf(a1);
    assert(balance1.toString() == rewardAmount1.plus(stakeAmount.div(2)).toString());
    const rewardAmount2 = await staking.getAmountRewardInPool(0, a1);
    assert(rewardAmount2 == 0);
    await advanceIncreaseBlock(1000);
    const rewardAmount3 = await staking.getAmountRewardInPool(0, a1);
    const calculateReward3 = new BigNumber(reward).times(1000).times(stakeAmount.div(2));
    assert(rewardAmount3.toString() == calculateReward3.toString());
    
    // check status pool
    const poolInfo = await staking.linearPoolInfo(0);
    assert(poolInfo.totalStaked.toString() == stakeAmount.div(2).toString());
    // assertEqual(await staking.rewardFromEmergencyWithdraw(), 0);
  });

  it('emergency withdraw', async () => {
    await token.mintForUser("10000000000000000", {from: a1});
    await token.approve(staking.address, "10000000000000000", {from: a1});
    const stakeAmount = new BigNumber("10000000000000000");
    await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
    await staking.stake(0, stakeAmount.toString(), {from: a1});
    await expectThrow(staking.emergencyWithdraw(1, {from: a1}), "pid not valid"); // (1)
    await staking.emergencyWithdraw(0, {from: a1}); // (2)
    const balance1 = await token.balanceOf(a1);
    assert(balance1.toString() == stakeAmount.toString());
    
    //check status pool
    const poolInfo = await staking.linearPoolInfo(0);
    assert(poolInfo.totalStaked.toString() == "0");
    const diffBlock = 2 // (1) and (2)
    const calculateReward = new BigNumber(reward).times(diffBlock).times(stakeAmount);
    // assertEqual(await staking.rewardFromEmergencyWithdraw(), calculateReward.toString());
    await advanceIncreaseBlock(1000);
    const rewardAmount2 = await staking.getAmountRewardInPool(0, a1);
    assert(rewardAmount2 == 0);
    // assertEqual(await staking.rewardFromEmergencyWithdraw(), calculateReward.toString());
  });

  it('claim reward: only stake', async () => {
    await token.mintForUser("100000000000000000000000000000000000", {from: a1});
    await token.approve(staking.address, "100000000000000000000000000000000000", {from: a1});
    const stakeAmount = "10000000000000000";
    await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
    await staking.stake(0, stakeAmount, {from: a1});
    const stakeMap = await staking.stakedMap(0, a1, 1);
    assert(stakeMap.stakedAmount.toString() == stakeAmount);
    await advanceIncreaseBlock(1000);
    const rewardAmount = await staking.getAmountRewardInPool(0, a1);
    const calculateReward = new BigNumber(reward).times(1000).times(stakeAmount).toString();
    assert(rewardAmount.toString() == calculateReward.toString());
    await staking.stake(0, stakeAmount, {from: a1});  // (1)
    const stakeMap2 = await staking.stakedMap(0, a1, 2);
    assert(stakeMap2.stakedAmount.toString(), new BigNumber(stakeAmount).times(2));
    await advanceIncreaseBlock(1000);
    const rewardAmount2 = await staking.getAmountRewardInPool(0, a1);
    let stakeAmountCurrent = new BigNumber(stakeAmount).times(2);
    let plusReward = new BigNumber(reward).times(1).times(stakeAmount).toString(); // 1 block for stake in (1)
    const calculateReward2 = new BigNumber(reward).times(1000).times(stakeAmountCurrent).plus(calculateReward).plus(plusReward);
    assert(rewardAmount2.toString() == calculateReward2.toString());
    await advanceIncreaseBlock(2000);
    const rewardAmount3 = await staking.getAmountRewardInPool(0, a1);
    const calculateReward3 = new BigNumber(reward).times(2000).times(stakeAmountCurrent).plus(calculateReward2);
    assert(rewardAmount3.toString() == calculateReward3.toString());

    await staking.claimReward(0);
    plusReward = new BigNumber(reward).times(1).times(stakeAmountCurrent).toString();
    await staking.claimReward(0, {from: a1});
    assertEqual(await staking.getAmountRewardInPool(0, a1), 0);
  });

  it('claim reward: stake and claim', async () => {
    await token.mintForUser("100000000000000000000000000000000000", {from: a1});
    await token.approve(staking.address, "100000000000000000000000000000000000", {from: a1});
    const stakeAmount = "10000000000000000";
    await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
    await staking.stake(0, stakeAmount, {from: a1});
    const stakeMap = await staking.stakedMap(0, a1, 1);
    assert(stakeMap.stakedAmount.toString() == stakeAmount);
    await advanceIncreaseBlock(1000);
    const rewardAmount = await staking.getAmountRewardInPool(0, a1);
    const calculateReward = new BigNumber(reward).times(1000).times(stakeAmount).toString();
    assert(rewardAmount.toString() == calculateReward.toString());
    await staking.claimReward(0, {from: a1});
    await staking.stake(0, stakeAmount, {from: a1});  // (1)
    const stakeMap2 = await staking.stakedMap(0, a1, 2);
    assert(stakeMap2.stakedAmount.toString(), new BigNumber(stakeAmount).times(2));
    await advanceIncreaseBlock(1000);
    const rewardAmount2 = await staking.getAmountRewardInPool(0, a1);
    let stakeAmountCurrent = new BigNumber(stakeAmount).times(2);
    let plusReward = new BigNumber(reward).times(1).times(stakeAmount).toString(); // 1 block for stake in (1)
    const calculateReward2 = new BigNumber(reward).times(1000).times(stakeAmountCurrent).plus(plusReward);
    assert(rewardAmount2.toString() == calculateReward2.toString());
    await advanceIncreaseBlock(2000);
    const rewardAmount3 = await staking.getAmountRewardInPool(0, a1);
    const calculateReward3 = new BigNumber(reward).times(2000).times(stakeAmountCurrent).plus(calculateReward2);
    assert(rewardAmount3.toString() == calculateReward3.toString());
  });

  it('claimAllReward', async () => {
    await token.mintForUser("30000000000000000", {from: a1});
    await token.approve(staking.address, "30000000000000000", {from: a1});
    const stakeAmount = "10000000000000000";
    await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
    await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
    await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
    await staking.stake(0, stakeAmount, {from: a1});
    await staking.stake(1, stakeAmount, {from: a1});
    await staking.stake(2, stakeAmount, {from: a1});

    await advanceIncreaseBlock(999);
    await staking.claimAllReward({from: a1});
    const diffBlock1 = 1002;
    const diffBlock2 = 1001;
    const diffBlock3 = 1000;
    const rewardFor1 = new BigNumber(reward).times(diffBlock1).times(stakeAmount);
    const rewardFor2 = new BigNumber(reward).times(diffBlock2).times(stakeAmount);
    const rewardFor3 = new BigNumber(reward).times(diffBlock3).times(stakeAmount);

    const balance = await token.balanceOf(a1);
    const totalReward = rewardFor1.plus(rewardFor2).plus(rewardFor3);

    assert(balance.toString() == totalReward.toString());
  });

  it('auto compounding', async () => {
    await token.mintForUser("10000000000000000", {from: a1});
    await token.approve(staking.address, "10000000000000000", {from: a1});

    await token.mintForUser("10000000000000000", {from: a2});
    await token.approve(staking.address, "10000000000000000", {from: a2});

    await token.mintForUser("10000000000000000", {from: a3});
    await token.approve(staking.address, "10000000000000000", {from: a3});

    const stakeAmount = new BigNumber("10000000000000000");
    await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
    await staking.stake(0, stakeAmount, {from: a1});
    await staking.stake(0, stakeAmount, {from: a2});
    await staking.stake(0, stakeAmount, {from: a3});

    await advanceIncreaseBlock(999);
    const reward1 = await staking.getAmountRewardInPool(0, a1);
    await staking.autoCoumpound(0, {from: a4});
    
    const diffBlock1 = 1002;
    const diffBlock2 = 1001;
    const diffBlock3 = 1000;
    const rewardFor1 = new BigNumber(reward).times(diffBlock1).times(stakeAmount);
    const rewardFor2 = new BigNumber(reward).times(diffBlock2).times(stakeAmount);
    const rewardFor3 = new BigNumber(reward).times(diffBlock3).times(stakeAmount);

    const amountWillStakerPercent = new BigNumber(PERCENT).minus(autoCompoundingFee);
    assertEqual(await staking.getStakedAmount(0, a1), stakeAmount.plus(rewardFor1.times(amountWillStakerPercent)));
    assertEqual(await staking.getStakedAmount(0, a2), stakeAmount.plus(rewardFor2.times(amountWillStakerPercent)));
    assertEqual(await staking.getStakedAmount(0, a3), stakeAmount.plus(rewardFor3.times(amountWillStakerPercent)));

    const totalBalance = rewardFor1.plus(rewardFor2).plus(rewardFor3);
    assertEqual(await token.balanceOf(a4), totalBalance.times(autoCompoundingFee).div(PERCENT));
  });
  // it('claim reward from admin', async () => {
  //   await token.mintForUser("10000000000000000", {from: a1});
  //   await token.mintForUser("10000000000000000", {from: a2});
  //   await token.transfer(staking.address, "10000000000000000", {from: a2});
  //   await token.approve(staking.address, "10000000000000000", {from: a1});
  //   const stakeAmount = new BigNumber("10000000000000000");
  //   await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
  //   await staking.stake(0, stakeAmount.toString(), {from: a1});
  //   await expectThrow(staking.emergencyWithdraw(1, {from: a1}), "pid not valid"); // (1)
  //   await staking.emergencyWithdraw(0, {from: a1}); // (2)
  //   const balance1 = await token.balanceOf(a1);
  //   assert(balance1.toString() == stakeAmount.toString());
    
  //   //check status pool
  //   const poolInfo = await staking.linearPoolInfo(0);
  //   assert(poolInfo.totalStaked.toString() == "0");
  //   const diffBlock = 2 // (1) and (2)
  //   const calculateReward = new BigNumber(reward).times(diffBlock).times(stakeAmount);
  //   assertEqual(await staking.rewardFromEmergencyWithdraw(), calculateReward.toString());
  //   await advanceIncreaseBlock(1000);
  //   const rewardAmount2 = await staking.getAmountRewardInPool(0, a1);
  //   assert(rewardAmount2 == 0);
  //   assertEqual(await staking.rewardFromEmergencyWithdraw(), calculateReward.toString());
  //   await expectThrow(staking.claimRewardFromEmergencyWithdraw({from: a1}), "Ownable: caller is not the owner");
  //   await staking.claimRewardFromEmergencyWithdraw({from: root});
  //   assertEqual(await token.balanceOf(root), calculateReward);
  // });

  it('check list address', async () => {
    await token.mintForUser("10000000000000000", {from: a1});
    await token.mintForUser("10000000000000000", {from: a2});
    await token.mintForUser("10000000000000000", {from: a3});
    await token.mintForUser("10000000000000000", {from: a5});
    await token.transfer(staking.address, "10000000000000000", {from: a5});
    await token.approve(staking.address, "10000000000000000", {from: a1});
    await token.approve(staking.address, "10000000000000000", {from: a2});
    await token.approve(staking.address, "10000000000000000", {from: a3});
    const stakeAmount = new BigNumber("10000000000000000");
    await staking.addNewStakingPool(10000, rewardPerBlockStaking, token.address, 10000);
    await staking.stake(0, stakeAmount.toString(), {from: a1});
    await staking.stake(0, stakeAmount.toString(), {from: a2});
    await staking.stake(0, stakeAmount.toString(), {from: a3});
    let firstUser = await staking.listUserInPool(0, 0);
    let index = await staking.hasUserInPool(a1, 0);
    assert(firstUser == a1);
    assert(index == 1);

    let secondtUser = await staking.listUserInPool(0, 1);
    assert(secondtUser == a2);
    index = await staking.hasUserInPool(a2, 0);
    assert(index == 2);

    let thirdUser = await staking.listUserInPool(0, 2);
    assert(thirdUser == a3);
    index = await staking.hasUserInPool(a3, 0);
    assert(index == 3);

    await staking.withdraw(0, stakeAmount.div(2).toString(), {from: a1});
    firstUser = await staking.listUserInPool(0, 0);
    assert(firstUser == a1);
    index = await staking.hasUserInPool(a1, 0);
    assert(index == 1);
    await staking.withdraw(0, stakeAmount.div(2).toString(), {from: a1});
    firstUser = await staking.listUserInPool(0, 0);
    index = await staking.hasUserInPool(a1, 0);
    assert(index == 0);
    assert(firstUser == a3);

    await staking.emergencyWithdraw(0, {from: a2});
    firstUser = await staking.listUserInPool(0, 0);
    assert(firstUser == a3);
    index = await staking.hasUserInPool(a2, 0);
    assert(index == 0);
    await staking.emergencyWithdraw(0, {from: a3});
    index = await staking.hasUserInPool(a3, 0);
    assert(index == 0);
  });

});



function  assertEqual (val1, val2, errorStr) {
  val2 = val2.toString();
  val1 = val1.toString()
  assert(new BN(val1).should.be.a.bignumber.that.equals(new BN(val2)), errorStr);
}

function expectError(message, messageCompare) {
  messageCompare = "Error: VM Exception while processing transaction: reverted with reason string '" + messageCompare + "'";
  assert(message == messageCompare, 'Not valid message');
}

async function expectThrow(f1, messageCompare) {
  let check = false;
  try {
    await f1;
  } catch (e) {
    check = true;
    expectError(e.toString(), messageCompare)
  };

  if (!check) {
    assert(1 == 0, 'Not throw message');
  }
}

async function increaseTime(second) {
  await ethers.provider.send('evm_increaseTime', [second]); 
  await ethers.provider.send('evm_mine');
}
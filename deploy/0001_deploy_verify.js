require("dotenv").config();
const { deployments, ethers, artifacts } = require("hardhat");

const func = async function ({ deployments, getNamedAccounts, getChainId }) {
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log( {deployer} );

  const staking = await deploy("Staking", {
    from: deployer,
    args: [process.env.CHN_ADDRESS, process.env.AUTO_COMPOUNDING_FEE],
    log: true,
  });

  await sleep(60000);

  await hre.run('verify:verify', {
    address: staking.address,
    constructorArguments: [process.env.CHN_ADDRESS, process.env.AUTO_COMPOUNDING_FEE],
  })
};

module.exports = func;

module.exports.tags = ['deploy-verify'];

async function sleep(timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}
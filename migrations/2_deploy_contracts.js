const DecentralRent = artifacts.require("DecentralRent");

module.exports = (deployer, network, accounts) => {
    deployer.deploy(DecentralRent, accounts[1], 1)
  };

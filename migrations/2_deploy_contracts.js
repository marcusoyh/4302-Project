const DecentralRent = artifacts.require("DecentralRent");

module.exports = (deployer, network, accounts) => {
    deployer.deploy(DecentralRent, 1, 2, accounts[1])
  };

## Running the project

### Installing Ganache CLI
Our contract is too large to be run in the GUI version of Ganache, so the CLI version is needed to bypass the contract size limit.
<br/>
`npm install ganache --global`
<br/>
`ganache --chain.allowUnlimitedContractSize` -> to run Ganache

### Running Tests
`truffle test` from the root directory

### Failing Tests
If the test suite is failing, ganache can be run with another command instead: `ganache --chain.allowUnlimitedContractSize --chain.vmErrorsOnRPCResponse`

## Test Files

### test.js
This file contains our individual unit tests for our written functions.

### test_flow.js
This file contains our test flows covered in our presentation, representing usage scenarios.

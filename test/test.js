const _deploy_contracts = require("../migrations/2_deploy_contracts");
const truffleAssert = require('truffle-assertions');
var assert = require('assert');

const DecentralRent = artifacts.require("../contracts/DecentralRent.sol");

/* ACCOUNT IDENTITIES 
accounts[1] from 2_deploy_contracts -> support_team (from 2_deploy_contracts)
accounts[2] -> carOwnerAddress1
accounts[3] -> carOwnerAddress2
accounts[4] -> renterAddress1
*/

contract('DecentralRent', function(accounts) {
    before(async () => {
        decentralRentInstance = await DecentralRent.deployed();
    });

    it('1. Test car owner registration', async() => {

        let carOwnerAddress1 = await decentralRentInstance.register_car_owner({from: accounts[2]});
        truffleAssert.eventEmitted(carOwnerAddress1, 'CarOwnerRegistered');

        let carOwnerAddress2 = await decentralRentInstance.register_car_owner({from: accounts[3]});
        truffleAssert.eventEmitted(carOwnerAddress2, 'CarOwnerRegistered');
        let numTesting = 1;
        
        let error;
        try {
            let carOwnerAddress1Duplicate = await decentralRentInstance.register_car_owner({from: accounts[2]}); // should fail
        } catch (e) {
            error = e;
        }
        assert.equal(error?.reason, "car owner has already been registered");
    });

    it('blalba', async() => {
        console.log(`in blabla, ${numTesting}`);
    })




/* guidelines
anything payable, check balance afterwards to verify
any require statements, test for wrong case (make sure it fails)
*/


/* flow 
-- extra stuff --
singpassVerify
singpassVerifyCar 

-- main flow start --
register 2 x car owner
Car Owner 1 -> register 2 x car
Car Owner 2 -> register 1 x car
list all 3 cars
update 1 x car info


register 2 x car renter
get owner rating -> would be 0
renter 1 submit rental request 1
renter 2 submit rental request 2
renter 2 submit rental request 3

(owner 1) approve rental request 1
(owner 2) approve rental request 2
(owner 2) approve rental request 3

get renter rating for request 3 -> would be 0
(owner 2) recall rental offer 3

(renter 1) accept rental offer 1
(renter 2) accept rental offer 2


rent 1 - renter 1 confirm car received
rent 2 - renter 2 confirm car received
rent 1 - owner 1 confirm car returned  deposit 

(owner 1) leave rating for renter 1
(renter 1) leave rating for owner 1

-- main flow end --
Situations:
- renter 1, owner 1, rent 1 -> all good
- renter 2, owner 2, rent 2 -> nv return car

-- issues --

owner 2 report issue with rent 2 -> nv return car
(we call renter 2, gets him to return)
rent 2 - owner 2 confirm car returned  deposit
support team resolves issue

owner 2 reopen issue -> car scratched
(support gets renter to pay owner separately)
support team resolves issue again, done

-- extra stuff --
owner 1 unlist car

*/

    
});
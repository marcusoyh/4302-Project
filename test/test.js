const _deploy_contracts = require("../migrations/2_deploy_contracts");
const truffleAssert = require('truffle-assertions');
var assert = require('assert');

const DecentralRent = artifacts.require("../contracts/DecentralRent.sol");

/* ACCOUNT IDENTITIES 
accounts[1] from 2_deploy_contracts -> support_team (from 2_deploy_contracts)
accounts[2] -> carOwnerAddress1
accounts[3] -> carOwnerAddress2
accounts[4] -> renterAddress1
accounts[5] -> renterAddress2
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

    // PLACEHOLDER ACCOUNT CREATION FOR MY TESTING
    let startDate;
    let endDate;
    let hourlyRentalRate;
    let deposit;
    let carCondition;
    it('placeholder', async() => {
        // car owner register and list cars
        startDate =  new Date('2022-05-27T10:00');
        endDate = new Date('2022-05-30T10:30');
        hourlyRentalRate = 30;
        deposit = 50;
        carCondition = 10;
        await decentralRentInstance.register_car("mercedes","car1",{from: accounts[2]}); // owner 1, car 1
        await decentralRentInstance.register_car("mazda","car2",{from: accounts[3]}); // owner 2, car 2
        await decentralRentInstance.list_car_for_rental(1, startDate.getTime()/1000, endDate.getTime()/1000, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: accounts[2]}); 
        await decentralRentInstance.list_car_for_rental(2, startDate.getTime()/1000, endDate.getTime()/1000, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: accounts[3]}); 

        // renter register and try submit rental requests
        await decentralRentInstance.register_car_renter(accounts[4]);
        await decentralRentInstance.register_car_renter(accounts[5]);
        // rentIDs should give 1 and 2 but am getting an object for some reason
        await decentralRentInstance.submit_rental_request(accounts[4], 1, startDate.getTime(), endDate.getTime(), 20); //carID and offeredRate are the two ints
        await decentralRentInstance.submit_rental_request(accounts[5], 2, startDate.getTime(), endDate.getTime(), 20); //carID and offeredRate are the two ints

        // owner approve requests
        // await decentralRentInstance.approve_rental_request(1, { from: accounts[2] });
        // await decentralRentInstance.approve_rental_request(2, { from: accounts[3] });
    })
    // PLACEHOLDER ACCOUNTS DONE

    // it('Test accepting a rental offer', async() => {
    //     console.log("inside my first test");
    //     let hoursElapsed = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    //     let paymentAmount = (hoursElapsed * hourlyRentalRate) + deposit;
    //     // renter 1 accept rental offer 1
    //     let acceptRental1 = await decentralRentInstance.accept_rental_offer(1, { from: accounts[4], value: 10000000000000000});
    //     // let acceptRental1 = await decentralRentInstance.accept_rental_offer(1, { from: accounts[4], value: paymentAmount+1});
        
    //     // renter 2 accept rental offer 2
    //     // let acceptRental2 = await decentralRentInstance.accept_rental_offer(2, { from: accounts[5], value: 100});
        
    // });

    // it('Test confirming car received', async() => {
        
    // });

    // it('Test confirming car returned', async() => {
        
    // });

    // it('Test renter leaving a rating for owner', async() => {
        
    // });

    // it('Test owner leaving a rating for renter', async() => {
        
    // });




/* guidelines
anything payable, check balance afterwards to verify
any require statements, test for wrong case (make sure it fails)
*/

/* flow 
-- extra stuff --
singpassVerify
singpassVerifyCar 

-- main flow start --
*done* register 2 x car owner  
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
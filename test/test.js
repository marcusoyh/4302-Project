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
    let carOwnerAddress1  = accounts[2];
    let carOwnerAddress2  = accounts[3];
    let renterAddress1  = accounts[4];
    let renterAddress2  = accounts[5];
    let startDate =  new Date('2022-05-27T10:00');
    let endDate = new Date('2022-05-30T10:30');
    let hourlyRentalRate = 30;
    let deposit = 50;
    let carCondition = 10;
    
    before(async () => {
        decentralRentInstance = await DecentralRent.deployed();
    });

    it('1. Test car owner registration', async() => {

        let carOwnerRegistration1 = await decentralRentInstance.register_car_owner({from: carOwnerAddress1});
        truffleAssert.eventEmitted(carOwnerRegistration1, 'CarOwnerRegistered');

        let carOwnerRegistration2 = await decentralRentInstance.register_car_owner({from: carOwnerAddress2});
        truffleAssert.eventEmitted(carOwnerRegistration2, 'CarOwnerRegistered');
        
        let error;
        console.log(1);
        try {
            console.log(2);

            await decentralRentInstance.register_car_owner({from: carOwnerAddress1}); // expected fail
            console.log(3);

        } catch (e) {
            console.log(4);

            error = e;
            // console.log(e);
        }
        console.log(5);


        assert.equal(error?.reason, "car owner has already been registered"); //UNCOMMENT
    });

    // it('2. Test car registration', async() => {

    //     let car1 = await decentralRentInstance.register_car({from: accounts[2]});
    // });

    it('6. Test car renter registration', async() => {
        let carRenterRegistration1 = await decentralRentInstance.register_car_renter({from: renterAddress1});
        truffleAssert.eventEmitted(carRenterRegistration1, 'RenterRegistered');
        
        let carRenterRegistration2 = await decentralRentInstance.register_car_renter({from: renterAddress2});
        truffleAssert.eventEmitted(carRenterRegistration2, 'RenterRegistered');

        let error;
        try {
            await decentralRentInstance.register_car_renter({from: renterAddress1}); // should fail
        } catch (e) {
            error = e;
        }
        // truffleAssert.eventNotEmitted(duplicateCarRenterRegistration, 'RenterRegistered');
        assert.equal(error?.reason, "car renter has already been registered"); //UNCOMMENT

    });

    it('7a. Test Getting Car Owner Rating(Intital Rating)', async() => {
        let owner1Rating = await decentralRentInstance.get_owner_rating(carOwnerAddress1, {from: carOwnerAddress1});
        assert.strictEqual(owner1Rating.toNumber(), 0);
    });

    // PLACEHOLDER ACCOUNT CREATION FOR MY TESTING
    it('placeholder', async() => {
        // car owner register and list cars
        await decentralRentInstance.register_car("mercedes","car1",{from: carOwnerAddress1}); // owner 1, car 1
        await decentralRentInstance.register_car("mazda","car2",{from: carOwnerAddress2}); // owner 2, car 2
        await decentralRentInstance.list_car_for_rental(1, startDate.getTime()/1000, endDate.getTime()/1000, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: accounts[2]}); 
        await decentralRentInstance.list_car_for_rental(2, startDate.getTime()/1000, endDate.getTime()/1000, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: accounts[3]}); 

        // renter register and try submit rental requests
        // await decentralRentInstance.register_car_renter(accounts[4]);
        // await decentralRentInstance.register_car_renter(accounts[5]);
        // // rentIDs should give 1 and 2 but am getting an object for some reason
        // await decentralRentInstance.submit_rental_request(accounts[4], 1, startDate.getTime(), endDate.getTime(), 20); //carID and offeredRate are the two ints
        // await decentralRentInstance.submit_rental_request(accounts[5], 2, startDate.getTime(), endDate.getTime(), 20); //carID and offeredRate are the two ints

        // owner approve requests
        // await decentralRentInstance.approve_rental_request(1, { from: accounts[2] });
        // await decentralRentInstance.approve_rental_request(2, { from: accounts[3] });
    })

    it('8. Test rental request submission', async() => {
        //with offer
        let request1 = await decentralRentInstance.submit_rental_request_with_offer(1, startDate.getTime(), endDate.getTime(), 20, {from: renterAddress1});
        truffleAssert.eventEmitted(request1, 'RentalRequestedSubmitted', (ev) => {
            return ev.renter_address === renterAddress1;
            
        });
        truffleAssert.eventEmitted(request1, 'Notify_owner');

        //without offer
        let request2 = await decentralRentInstance.submit_rental_request_without_offer(1, startDate.getTime(), endDate.getTime(), {from: renterAddress2});
        truffleAssert.eventEmitted(request2, 'RentalRequestedSubmitted', (ev) => {
            return ev.renter_address === renterAddress2;
            
        });
        truffleAssert.eventEmitted(request2, 'Notify_owner');


        //Will fail as renter is not verified
        try {
            await decentralRentInstance.submit_rental_request_without_offer(1, startDate.getTime(), endDate.getTime(), {from: carOwnerAddress1});
        } catch(e) {
            err = e
        }
        assert.equal(err?.reason, "only verified car renter can perform this action"); //UNCOMMENT
        
        let request3 = await decentralRentInstance.submit_rental_request_with_offer(1, startDate.getTime(), endDate.getTime(), 30, {from: renterAddress2});
        truffleAssert.eventEmitted(request3, 'RentalRequestedSubmitted', (ev) => {
            return ev.renter_address === renterAddress2;
            
        });
        truffleAssert.eventEmitted(request3, 'Notify_owner');


        // let request2 = await decentralRentInstance.submit_rental_request(renterAddress1, 2, startDate.getTime(), endDate.getTime(), 20);
        
        
    });
    // PLACEHOLDER ACCOUNTS DONE

    // it('Test accepting a rental offer', async() => {
    //     // renter 1 accept rental offer 1
    //     let amountToPay = await decentralRentInstance.get_rent_price(1);
        
    //     let error; 
    //     // Testing for scenario with not enough Ether
    //     try {
    //         await decentralRentInstance.accept_rental_offer(1, { from: renterAddress1, value: amountToPay-1});
    //     } catch (e) {
    //         error = e;
    //     }
    //     assert.equal(error?.reason, "Please transfer enough Eth to pay for rental"); //UNCOMMENT

    //     // Testing for correct scenarios with enough Ether
    //     let acceptRental1 = await decentralRentInstance.accept_rental_offer(1, { from: renterAddress1, value: amountToPay});
    //     truffleAssert.eventEmitted(acceptRental1, 'RentalOfferAccepted');
    //     truffleAssert.eventEmitted(acceptRental1, 'Notify_owner');

        
    //     // renter 2 accept rental offer 2
    //     let acceptRental2 = await decentralRentInstance.accept_rental_offer(2, { from: renterAddress2, value: amountToPay});
    //     truffleAssert.eventEmitted(acceptRental2, 'RentalOfferAccepted');
    //     truffleAssert.eventEmitted(acceptRental2, 'Notify_owner');
    // });

    // it('Test confirming car received', async() => {
    //     let notRenterError;
    //     try {
    //         await decentralRentInstance.confirm_car_received(1, { from: renterAddress2});
    //     } catch (e) {
    //         notRenterError = e;
    //     }
    //     assert.equal(notRenterError?.reason, "You are not the renter!"); //UNCOMMENT
        
        
    //     // renter 1 confirm car received
    //     let confirmReceived1 = await decentralRentInstance.confirm_car_received(1, {from: renterAddress1});
    //     truffleAssert.eventEmitted(confirmReceived1, 'CarReceived');

    //     // renter 2 confirm car received
    //     let confirmReceived2 = await decentralRentInstance.confirm_car_received(2, {from: renterAddress2});
    //     truffleAssert.eventEmitted(confirmReceived2, 'CarReceived');
        
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
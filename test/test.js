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
    let startDate =  new Date('2022-05-27T10:00').getTime()/1000; // save in seconds
    let endDate = new Date('2022-05-30T10:30').getTime()/1000;
    let hourlyRentalRate = 30;
    let deposit = 50;
    let car1Deposit;
    let car2Deposit;
    let carCondition = 10;
    let amountToPayForRental1;
    
    before(async () => {
        decentralRentInstance = await DecentralRent.deployed();
    });

    it('1. Test car owner registration', async() => {

        let carOwnerRegistration1 = await decentralRentInstance.register_car_owner({from: carOwnerAddress1});
        truffleAssert.eventEmitted(carOwnerRegistration1, 'CarOwnerRegistered');

        let carOwnerRegistration2 = await decentralRentInstance.register_car_owner({from: carOwnerAddress2});
        truffleAssert.eventEmitted(carOwnerRegistration2, 'CarOwnerRegistered');
        
        await truffleAssert.reverts(decentralRentInstance.register_car_owner({from: carOwnerAddress1}), "car owner has already been registered");
    });

    it('2. Test car registration', async() => {

        let car1 = await decentralRentInstance.register_car("mercedes","car1",{from: carOwnerAddress1}); // owner 1, car 1
        truffleAssert.eventEmitted(car1 , "CarRegistered");

        let car1Status = await decentralRentInstance.get_car_status_toString(1);
        assert.strictEqual(car1Status, "Registered", "Car registeration failed");

        let car2 = await decentralRentInstance.register_car("mazda","car2",{from: carOwnerAddress2}); // owner 1, car 2
        truffleAssert.eventEmitted(car2 , "CarRegistered")

        let car2Status = await decentralRentInstance.get_car_status_toString(2);
        assert.strictEqual(car2Status, "Registered", "Car registeration failed");

        let car3 = await decentralRentInstance.register_car("honda","car3",{from: carOwnerAddress2}); // owner 2, car 3
        truffleAssert.eventEmitted(car2 , "CarRegistered");

        let car3Status = await decentralRentInstance.get_car_status_toString(3);
        assert.strictEqual(car2Status, "Registered", "Car registeration failed");
     });

     it('3. Test that car listing can only be done by car owner', async() => {
        await truffleAssert.reverts(decentralRentInstance.list_car_for_rental(1, startDate, endDate, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: carOwnerAddress2}), "only verified car owner can perform this action" );   
        let car1Status = await decentralRentInstance.get_car_status_toString(1);
        assert.strictEqual(car1Status, "Registered", "Car registeration failed");
    });

     it('4. Test car listing', async() => {

        let car1Listing = await decentralRentInstance.list_car_for_rental(1, startDate, endDate, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: carOwnerAddress1}); 
        truffleAssert.eventEmitted(car1Listing, "CarListed");
        car1Deposit = deposit;
        
        let car1Status = await decentralRentInstance.get_car_status_toString(1);
        assert.strictEqual(car1Status, "Available", "Car registeration failed");

        let car2Listing = await decentralRentInstance.list_car_for_rental(2, startDate, endDate, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: carOwnerAddress2});
        truffleAssert.eventEmitted(car2Listing, "CarListed");
        car2Deposit = deposit;

        let car2Status = await decentralRentInstance.get_car_status_toString(2);
        assert.strictEqual(car2Status, "Available", "Car registeration failed");

        let car3Listing = await decentralRentInstance.list_car_for_rental(3, startDate, endDate, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: carOwnerAddress2});
        truffleAssert.eventEmitted(car2Listing, "CarListed");

        let car3Status = await decentralRentInstance.get_car_status_toString(3);
        assert.strictEqual(car2Status, "Available", "Car registeration failed");
    });


    it('5. Update listed car info', async() => {
        // function update_listed_car_info(uint256 carId, uint256 hourlyRentalRate, uint256 deposit, uint256 availableStartDate, uint256 availableEndDate, string memory collectionPoint) 
        let newHourRentalRate = hourlyRentalRate + 40;
        let newDeposit = deposit + 100

        let car1Update = await decentralRentInstance.update_listed_car_info(1, newHourRentalRate , newDeposit , startDate, endDate, 'collectionPoint', {from: carOwnerAddress1}); 
        let newCarHourlyRentalRate = await decentralRentInstance.get_car_hourly_rental(1);
        let newCarDeposit = await decentralRentInstance.get_car_deposit(1);
        

        assert.strictEqual(newCarHourlyRentalRate.toNumber(), 70, "Car info update failed" );
        assert.strictEqual(newCarDeposit.toNumber(), 150, "Car info update failed");
        truffleAssert.eventEmitted(car1Update, "CarInfoUpdated");
        
        car1Deposit = newDeposit;
    });

    it('5. Test that only the owner can update listed car info', async() => {
        // function update_listed_car_info(uint256 carId, uint256 hourlyRentalRate, uint256 deposit, uint256 availableStartDate, uint256 availableEndDate, string memory collectionPoint) 
        let newHourRentalRate = hourlyRentalRate + 40;
        let newDeposit = deposit + 100

        await truffleAssert.reverts(decentralRentInstance.update_listed_car_info(1, newHourRentalRate , newDeposit , startDate, endDate, 'collectionPoint', {from: carOwnerAddress2}),"only verified car owner can perform this action"); 
    });




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
        // assert.equal(error?.reason, "car renter has already been registered"); //UNCOMMENT

    });

    it('7a. Test Getting Car Owner Rating(Intital Rating)', async() => {
        let owner1Rating = await decentralRentInstance.get_owner_rating(carOwnerAddress1, {from: carOwnerAddress1});
        assert.strictEqual(owner1Rating.toNumber(), 0);
    });

    it('8. Test rental request submission', async() => {
        //with offer
        let request1 = await decentralRentInstance.submit_rental_request_with_offer(1, startDate, endDate, 20, {from: renterAddress1});
        truffleAssert.eventEmitted(request1, 'RentalRequestedSubmitted', (ev) => {
            return ev.renter_address === renterAddress1;
            
        });
        truffleAssert.eventEmitted(request1, 'Notify_owner');

        //without offer
        let request2 = await decentralRentInstance.submit_rental_request_without_offer(2, startDate, endDate, {from: renterAddress2});
        truffleAssert.eventEmitted(request2, 'RentalRequestedSubmitted', (ev) => {
            return ev.renter_address === renterAddress2;
            
        });
        truffleAssert.eventEmitted(request2, 'Notify_owner');


        //Will fail as renter is not verified
        try {
            await decentralRentInstance.submit_rental_request_without_offer(1, startDate, endDate, {from: carOwnerAddress1});
        } catch(e) {
            err = e
        }
        assert.equal(err?.reason, "only verified car renter can perform this action"); //UNCOMMENT
        
        let request3 = await decentralRentInstance.submit_rental_request_with_offer(3, startDate, endDate, 30, {from: renterAddress2});
        truffleAssert.eventEmitted(request3, 'RentalRequestedSubmitted', (ev) => {
            return ev.renter_address === renterAddress2;
            
        });
        truffleAssert.eventEmitted(request3, 'Notify_owner');
    })
    
        // PLACEHOLDER ACCOUNT CREATION FOR MY TESTING
        it('placeholder', async() => {
            //     // car owner register and list cars
            //     await decentralRentInstance.register_car("mercedes","car1",{from: carOwnerAddress1}); // owner 1, car 1
            //     await decentralRentInstance.register_car("mazda","car2",{from: carOwnerAddress2}); // owner 2, car 2
            //     await decentralRentInstance.list_car_for_rental(1, startDate.getTime()/1000, endDate.getTime()/1000, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: accounts[2]}); 
            //     await decentralRentInstance.list_car_for_rental(2, startDate.getTime()/1000, endDate.getTime()/1000, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: accounts[3]}); 
        
            //     // renter register and try submit rental requests
            //     // await decentralRentInstance.register_car_renter(accounts[4]);
            //     // await decentralRentInstance.register_car_renter(accounts[5]);
            //     // // rentIDs should give 1 and 2 but am getting an object for some reason
            //     // await decentralRentInstance.submit_rental_request(accounts[4], 1, startDate.getTime(), endDate.getTime(), 20); //carID and offeredRate are the two ints
            //     // await decentralRentInstance.submit_rental_request(accounts[5], 2, startDate.getTime(), endDate.getTime(), 20); //carID and offeredRate are the two ints
        
            // owner approve requests
            await decentralRentInstance.approve_rental_request(1, { from: carOwnerAddress1 });
            await decentralRentInstance.approve_rental_request(2, { from: carOwnerAddress2 });
        })
    
    it('Test accepting a rental offer without enough Ether', async() => {
        let rentalPrice1 = await decentralRentInstance.get_total_rent_price(1);
        amountToPayForRental1 = rentalPrice1.toNumber() + car1Deposit;
        await truffleAssert.reverts( decentralRentInstance.accept_rental_offer(1, { from: renterAddress1, value: amountToPayForRental1-1}), "Please transfer enough Eth to pay for rental");
    });

    it('Test Car Renter 1 accepting a rental offer', async() => {
        let acceptRental1 = await decentralRentInstance.accept_rental_offer(1, { from: renterAddress1, value: amountToPayForRental1});
        truffleAssert.eventEmitted(acceptRental1, 'RentalOfferAccepted');
        truffleAssert.eventEmitted(acceptRental1, 'Notify_owner');
    });
    
    it('Test Car Renter 2 accepting a rental offer', async() => {
        let rentalPrice2 = await decentralRentInstance.get_total_rent_price(2);
        let amountToPay2 = rentalPrice2.toNumber() + car2Deposit;

        let acceptRental2 = await decentralRentInstance.accept_rental_offer(2, { from: renterAddress2, value: amountToPay2});
        
        truffleAssert.eventEmitted(acceptRental2, 'RentalOfferAccepted');
        truffleAssert.eventEmitted(acceptRental2, 'Notify_owner');
    });
    
    it(`Test that Car Renter cannot receive another renter's car`, async() => {
        await truffleAssert.reverts( decentralRentInstance.confirm_car_received(1, { from: renterAddress2}), "You are not the renter!");
    });

    it('Test that Car Renter 1 can confirm car received and transfer Eth to Car Owner 1', async() => {
        // Checking owner balance before
        let ownerBalanceBefore = await web3.eth.getBalance(carOwnerAddress1);

        // RECEIVING
        let confirmReceived1 = await decentralRentInstance.confirm_car_received(1, {from: renterAddress1});
        truffleAssert.eventEmitted(confirmReceived1, 'CarReceived');
        
        // CHECK RENTAL AMOUNT TRANSFER
        let ownerBalanceAfter = await web3.eth.getBalance(carOwnerAddress1);
        let totalRentalPrice = await decentralRentInstance.get_total_rent_price(1);
        let ownerBalanceIncrease = BigInt(ownerBalanceAfter) - BigInt(ownerBalanceBefore);
        
        assert.strictEqual(
            Number(ownerBalanceIncrease),
            totalRentalPrice.toNumber(),
            'Car Owner 1 did not receive correct eth amount'
        );
    });

    it('Test that rent and car status changed correctly after Car Renter 1 receives car', async() => {
        let rentStatusAfter = await decentralRentInstance.get_rent_status_toString(1);
        let carStatusAfter = await decentralRentInstance.get_car_status_toString(1);
        assert.strictEqual(
            rentStatusAfter,
            "Ongoing",
            `Expected Rent Status after returning to be "Ongoing"`
        );
        assert.strictEqual(
            carStatusAfter,
            "Reserved",
            `Expected Car Status after returning to be "Reserved"`
        );
    });

    it('Test that Car Renter 2 can confirm car received and transfer Eth to Car Owner 2', async() => {
    
        // Checking owner balance before
        let ownerBalanceBefore = await web3.eth.getBalance(carOwnerAddress2);
        
        // RECEIVING
        let confirmReceived2 = await decentralRentInstance.confirm_car_received(2, {from: renterAddress2});
        truffleAssert.eventEmitted(confirmReceived2, 'CarReceived');

        // CHECK RENTAL AMOUNT TRANSFER
        let ownerBalanceAfter = await web3.eth.getBalance(carOwnerAddress2);
        let totalRentalPrice = await decentralRentInstance.get_total_rent_price(2);
        let ownerBalanceIncrease = BigInt(ownerBalanceAfter) - BigInt(ownerBalanceBefore);
        
        assert.strictEqual(
            Number(ownerBalanceIncrease),
            totalRentalPrice.toNumber(),
            'Car Owner 2 did not receive correct eth amount for rental'
        );
    });

    it('Test that rent and car status changed correctly after Car Renter 2 receives car', async() => {
        let rentStatusAfter = await decentralRentInstance.get_rent_status_toString(2);
        let carStatusAfter = await decentralRentInstance.get_car_status_toString(2);
        assert.strictEqual(
            rentStatusAfter,
            "Ongoing",
            `Expected Rent Status after returning to be "Ongoing"`
        );
        assert.strictEqual(
            carStatusAfter,
            "Reserved",
            `Expected Car Status after returning to be "Reserved"`
        );
    });

    it('Test that only the car owner can confirm car returned', async() => {
        await truffleAssert.reverts(decentralRentInstance.confirm_car_returned(1), "only verified car owner can perform this action");
    });

    it('Test Car Owner 1 confirming car returned, with Eth transfer and updated rent count', async() => {

        // rent 1, owner 1, renter 1, car 1
        // Checking rent counts before the rental
        let ownerCompletedRentCountBefore = await decentralRentInstance.get_owner_completed_rent_count(carOwnerAddress1);
        let renterCompletedRentCountBefore = await decentralRentInstance.get_renter_completed_rent_count(renterAddress1);

        // Checking renter balance before
        let renterBalanceBefore = await web3.eth.getBalance(renterAddress1);

        // RETURNING
        let confirmCarReturned1 = await decentralRentInstance.confirm_car_returned(1, {from:carOwnerAddress1});
        truffleAssert.eventEmitted(confirmCarReturned1, 'CarReturned');

        // CHECK RENT COUNT CHANGE
        let ownerCompletedRentCountAfter = await decentralRentInstance.get_owner_completed_rent_count(carOwnerAddress1);
        let renterCompletedRentCountAfter = await decentralRentInstance.get_renter_completed_rent_count(renterAddress1);

        assert.strictEqual(
            ownerCompletedRentCountAfter.toNumber(),
            ownerCompletedRentCountBefore.toNumber()+1,
            "Car Owner 1's rent count did not increase by 1"
        );
        assert.strictEqual(
            renterCompletedRentCountAfter.toNumber(),
            renterCompletedRentCountBefore.toNumber()+1,
            "Car Renter 1's rent count did not increase by 1"
        );

        // CHECK DEPOSIT TRANSFER
        let renterBalanceAfter = await web3.eth.getBalance(renterAddress1);
        let renterBalanceIncrease = BigInt(renterBalanceAfter) - BigInt(renterBalanceBefore);
        let carDeposit = await decentralRentInstance.get_car_deposit(1);

        assert.strictEqual(
            Number(renterBalanceIncrease),
            carDeposit.toNumber(),
            'Car Renter 1 did not receive correct eth amount for deposit'
        );
    });

    it('Test that rent and car status changed correctly after renter 1 returns car', async() => {
        let rentStatusAfter = await decentralRentInstance.get_rent_status_toString(1);
        let carStatusAfter = await decentralRentInstance.get_car_status_toString(1);

        assert.strictEqual(
            rentStatusAfter,
            "Completed",
            `Expected Rent Status after returning to be "Completed"`
        );
        assert.strictEqual(
            carStatusAfter,
            "Available",
            `Expected Car Status after returning to be "Available"`
        );
    });

    it('Test that Car Renter cannot leave invalid rating for Car Owner', async() => {
        await truffleAssert.reverts(decentralRentInstance.leaveRating(1, 6, {from: renterAddress1}), "Rating has to be between 0 and 5!");
    });

    it(`Test that Car Renter cannot leave rating for someone else's car rental`, async() => {
        await truffleAssert.reverts(decentralRentInstance.leaveRating(1, 5, {from: renterAddress2}), "You are not involved in this rental.");
    });


    it('Test Car Renter 1 leaving a rating for Car Owner 1', async() => {
        let ownerRatingBefore = await decentralRentInstance.get_owner_rating(carOwnerAddress1);
        let ownerRatingCountBefore = await decentralRentInstance.get_owner_rating_count(carOwnerAddress1);
        let ratingToLeave = 5;

        let leaveRatingForOwner1 = await decentralRentInstance.leaveRating(1,ratingToLeave, {from: renterAddress1});
        let ownerRatingAfter = await decentralRentInstance.get_owner_rating(carOwnerAddress1);

        let expectedRatingAfter = (ownerRatingBefore.toNumber() * ownerRatingCountBefore.toNumber() + ratingToLeave) / (ownerRatingCountBefore.toNumber() + 1);

        assert.strictEqual(
            expectedRatingAfter,
            ownerRatingAfter.toNumber(),
            'Owner 1 rating did not change as expected'
        );
        truffleAssert.eventEmitted(leaveRatingForOwner1, 'CarOwnerNewRating');
        truffleAssert.eventEmitted(leaveRatingForOwner1, 'Notify_owner');
    });

    it('Test that Car Owner cannot leave invalid rating for Car Renter', async() => {
        await truffleAssert.reverts(decentralRentInstance.leaveRating(1, 6, {from: carOwnerAddress1}), "Rating has to be between 0 and 5!");
    });

    it(`Test that Car Owner cannot leave rating for someone else's car rental`, async() => {
        await truffleAssert.reverts(decentralRentInstance.leaveRating(1, 5, {from: carOwnerAddress2}), "You are not involved in this rental.");
    });


    it('Test Car Owner 1 leaving a rating for Car Renter 1', async() => {
        // checking rating values before
        let renterRatingBefore = await decentralRentInstance.get_renter_rating(renterAddress1);
        let renterRatingCountBefore = await decentralRentInstance.get_renter_rating_count(renterAddress1);
        let ratingToLeave = 5;

        // leaving rating
        let leaveRatingForRenter1 = await decentralRentInstance.leaveRating(1,ratingToLeave, {from: carOwnerAddress1});

        // checking rating values after
        let renterRatingAfter = await decentralRentInstance.get_renter_rating(renterAddress1);
        let expectedRatingAfter = (renterRatingBefore.toNumber() * renterRatingCountBefore.toNumber() + ratingToLeave) / (renterRatingCountBefore.toNumber() + 1);

        // checking values
        assert.strictEqual(
            expectedRatingAfter,
            renterRatingAfter.toNumber(),
            'Car Renter 1 rating did not change as expected'
        );
        truffleAssert.eventEmitted(leaveRatingForRenter1, 'RenterNewRating');
        truffleAssert.eventEmitted(leaveRatingForRenter1, 'Notify_renter');
    });




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
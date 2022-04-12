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
    let renterAddress3 = accounts[6];
    let startDate =  new Date('2022-05-27T10:00').getTime()/1000; // save in seconds
    let endDate = new Date('2022-05-30T10:30').getTime()/1000;
    let hourlyRentalRate = 30;
    let deposit = 50;
    let car1Deposit;
    let car2Deposit;
    let car3Deposit;
    let carCondition = 10;
    let amountToPayForRental1;
    let amountToPayForRental2;
    let decentralRentEthBalance;
    
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

        let car2 = await decentralRentInstance.register_car("mazda","car2",{from: carOwnerAddress2}); // owner 2, car 2
        truffleAssert.eventEmitted(car2 , "CarRegistered")

        let car2Status = await decentralRentInstance.get_car_status_toString(2);
        assert.strictEqual(car2Status, "Registered", "Car registeration failed");

        let car3 = await decentralRentInstance.register_car("honda","car3",{from: carOwnerAddress2}); // owner 2, car 3
        truffleAssert.eventEmitted(car3 , "CarRegistered");

        let car3Status = await decentralRentInstance.get_car_status_toString(3);
        assert.strictEqual(car3Status, "Registered", "Car registeration failed");
     });

     it('3a. Test unsuccessful car listing (only can be done by car owner)', async() => {
        await truffleAssert.reverts(decentralRentInstance.list_car_for_rental(1, startDate, endDate, "collectionPoint", hourlyRentalRate, deposit, carCondition, {from: carOwnerAddress2}), "only verified car owner can perform this action" );   
        let car1Status = await decentralRentInstance.get_car_status_toString(1);
        assert.strictEqual(car1Status, "Registered", "Car registeration failed");
    });

     it('3b. Test a successful car listing', async() => {

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
        truffleAssert.eventEmitted(car3Listing, "CarListed");
        car3Deposit = deposit;

        let car3Status = await decentralRentInstance.get_car_status_toString(3);
        assert.strictEqual(car3Status, "Available", "Car registeration failed");
    });

    it('4a. Test unsuccesful update of listed car info (Only can be done by car owner)', async() => {
        let newHourRentalRate = hourlyRentalRate + 40;
        let newDeposit = deposit + 100

        await truffleAssert.reverts(decentralRentInstance.update_listed_car_info(1, newHourRentalRate , newDeposit , startDate, endDate, 'collectionPoint', {from: carOwnerAddress2}),"only verified car owner can perform this action"); 
    });

    it('4b. Test successful update of listed car info', async() => {
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
    
    it('5a. Test successful car renter registration', async() => {
        let carRenterRegistration1 = await decentralRentInstance.register_car_renter({from: renterAddress1});
        truffleAssert.eventEmitted(carRenterRegistration1, 'RenterRegistered');
        
        let carRenterRegistration2 = await decentralRentInstance.register_car_renter({from: renterAddress2});
        truffleAssert.eventEmitted(carRenterRegistration2, 'RenterRegistered');  
    });
    
    it('5b. Test unsuccessful car renter registration (already registered)', async() => {
        await truffleAssert.reverts(decentralRentInstance.register_car_renter({from: renterAddress1}));
    });
    
    it('6. Test Getting Car Owner Rating(Intital Rating)', async() => {
        let owner1CarConditionDescription = await decentralRentInstance.get_owner_car_condition_description(carOwnerAddress1, {from: carOwnerAddress1});
        let owner1Attitude= await decentralRentInstance.get_owner_attitude(carOwnerAddress1, {from: carOwnerAddress1});
        let owner1ResponseSpeed = await decentralRentInstance.get_owner_response_speed(carOwnerAddress1, {from: carOwnerAddress1});
        assert.strictEqual(owner1CarConditionDescription.toNumber(), 0, "The car condition rating for car owner 1 should be 0");
        assert.strictEqual(owner1Attitude.toNumber(), 0, "The attitude for car owner 1 should be 0");
        assert.strictEqual(owner1ResponseSpeed.toNumber(), 0, "The response speed for car owner 1 should be 0");
    });

    it('7a. Test for successful rental request submission with offer price', async() => {
        //with offer
        let request1 = await decentralRentInstance.submit_rental_request_with_offer(1, startDate, endDate, 20, {from: renterAddress1});
        truffleAssert.eventEmitted(request1, 
            'RentalRequestedSubmitted', (ev) => {
                return ev.renter_address === renterAddress1;
            }, 
            "The renter address of rent instance does not match with renterAddress1");
        truffleAssert.eventEmitted(request1, 'Notify_owner');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(1), 
            "Pending",
            "The rental status should be in pending"
        );
    });

    it('7b. Test for successful rental request submission without offer price', async() => {
        //without offer
        let request2 = await decentralRentInstance.submit_rental_request_without_offer(2, startDate, endDate, {from: renterAddress2});
        truffleAssert.eventEmitted(request2, 'RentalRequestedSubmitted', (ev) => {
            return ev.renter_address === renterAddress2;
            
        }, "The renter address of rent instance does not match with renterAddress2");
        truffleAssert.eventEmitted(request2, 'Notify_owner');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(2), 
            "Pending",
            "The rental status should be in pending"
        );
    });

    it('7c. Test for unsuccessful rental request submission by unverified user', async() => {
        await truffleAssert.reverts(decentralRentInstance.submit_rental_request_without_offer(1, startDate, endDate, {from: carOwnerAddress1}), "only verified car renter can perform this action");
    });
    
    it('8a. Test for unsuccessful rental update request(Can only be done by car renter that submit the request)', async() => {
        let newOfferedRate = 40;
        await truffleAssert.reverts(decentralRentInstance.update_rental_request(2, startDate, endDate, newOfferedRate, {from: renterAddress1}), "You are not the owner of this rental request.");
    });
    
    it('8b. Test for successful rental update request(Can only be done by car renter that submit the request)', async() => {
        let newOfferedRate = 40;
    
        let car2Status = await decentralRentInstance.get_car_status_toString(2);
        assert.strictEqual(car2Status, "Available", "Car is not available");
        
        let rental2Status = await decentralRentInstance.get_rent_status_toString(2);
        assert.strictEqual(rental2Status, "Pending", "Rental status should be in pending");

        let updatedCarRentalRequest = await decentralRentInstance.update_rental_request(2, startDate, endDate, newOfferedRate, {from: renterAddress2});
        truffleAssert.eventEmitted(updatedCarRentalRequest, "RentRequestUpdated");
    });

    it('9a. Test for successful getting of car renter rating(Intital Rating)', async() => {
        let renter = await decentralRentInstance.get_rent_renter(3, {from: carOwnerAddress1});
        let renterAttitude = await decentralRentInstance.get_renter_attitude(renter, {from: carOwnerAddress1});
        let renterResponseSpeeed = await decentralRentInstance.get_renter_response_speed(renter, {from: carOwnerAddress1});
        assert.strictEqual(renterAttitude.toNumber(), 0, "The attitude rating for renter of request 3 should be 0");
        assert.strictEqual(renterResponseSpeeed.toNumber(), 0, "The response speed for renter of request 3 should be 0");
    });

    
    it('10a. Test for unsuccessful rental request approval (only car owner can approve)', async() => {
        //fail as carOwnerAddress2 does not own car(car1) that is involved in rent1
        await truffleAssert.reverts(decentralRentInstance.approve_rental_request(1, { from: carOwnerAddress2 }), "only verified car owner can perform this action");
    });

    it('10b. Test for successful rental request approval', async() => {

        let approval1 = await decentralRentInstance.approve_rental_request(1, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(approval1, 'RentalOfferApproved');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(1), 
            "Approved",
            "The status of the rent whould be changed to 'Approved'"
        );
        
        let approval2 = await decentralRentInstance.approve_rental_request(2, { from: carOwnerAddress2 });
        truffleAssert.eventEmitted(approval2, 'RentalOfferApproved');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(2), 
            "Approved",
            "The status of the rent whould be changed to 'Approved'"
        );
    });

    it('10c. Test for unsuccessful rental request approval (previous acceptance of rental request in the same period)', async() => {
        //Request3 and Request4 asks for the same car in the same period. After request 3 has already been approved, Request4 cannot be accepted again.
        let request3 = await decentralRentInstance.submit_rental_request_with_offer(3, startDate, endDate, 30, {from: renterAddress2});
        truffleAssert.eventEmitted(request3, 'RentalRequestedSubmitted', (ev) => {
            return ev.renter_address === renterAddress2;
            
        });
        truffleAssert.eventEmitted(request3, 'Notify_owner');

        let request4 = await decentralRentInstance.submit_rental_request_with_offer(3, startDate, endDate, 30, {from: renterAddress2});
        truffleAssert.eventEmitted(request3, 'RentalRequestedSubmitted', (ev) => {
            return ev.renter_address === renterAddress2;
            
        });
        truffleAssert.eventEmitted(request4, 'Notify_owner');

        let approval3 = await decentralRentInstance.approve_rental_request(3, { from: carOwnerAddress2 });
        truffleAssert.eventEmitted(approval3, 'RentalOfferApproved');
        assert.strictEqual(await decentralRentInstance.get_rent_status_toString(3), 
            "Approved",
            "The status of the rent whould be changed to 'Approved'"
        );

        await truffleAssert.reverts(decentralRentInstance.approve_rental_request(4, { from: carOwnerAddress2 }), "you have already approved for this time period");

        // await decentralRentInstance.approve_rental_request(2, { from: carOwnerAddress2 });
    });

    it('11a. Test for unsuccessful rental request rejection (not the car owner)', async() => {
        await decentralRentInstance.submit_rental_request_with_offer(3, startDate, endDate, 20, {from: renterAddress1});
        await truffleAssert.reverts(decentralRentInstance.reject_rental_request(5, { from: carOwnerAddress1 }), "only verified car owner can perform this action");
        
    });

    it('11b. Test for successful rental request rejection (previous acceptance of rental request in the same period)', async() => {
        // console.log(rentId.toNumber());
        // console.log()
        // console.log(rentId.toNumber());
        // console.log(await decentralRentInstance.get_rent_carId.call(rentId.toNumber()).toString());
        // console.log(carOwnerAddress2);
        // await 
        let rejection1 = await decentralRentInstance.reject_rental_request(5, { from: carOwnerAddress2 });
        truffleAssert.eventEmitted(rejection1, 'RentalRequestRejected');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(5), 
            "Rejected",
            "The status of the rent whould be changed to 'Rejected'"
        );
        //to submit another request after rejection
    });

    it('12a.Test for unsuccessful rental approval recallment (less than 24h since passing since approval)', async() => {
        await truffleAssert.reverts(decentralRentInstance.recall_approval(3, {from: carOwnerAddress2}), "You can only recall it after 24h since your approval.");
    });


    it('12b.Test for unsuccessful rental approval recallment (acceptance by non car owner)', async() => {
        await decentralRentInstance.revert_offer_date_by_1day(3);
        await truffleAssert.reverts(decentralRentInstance.recall_approval(3, { from: carOwnerAddress1 }), "only verified car owner can perform this action");
    });
    
    it('12c.Test for successful rental approval recallment', async() => {
        let recallment1 = await decentralRentInstance.recall_approval(3, {from: carOwnerAddress2});
        truffleAssert.eventEmitted(recallment1, 'OfferRecalled');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(3), 
            "Cancelled",
            "Car rental status should be changed to cancelled"
        );
        assert.strictEqual(await decentralRentInstance.get_car_status_toString(3), "Available");

    });

    it('13a. Test unsuccessful accepting of rental offer (not enough Ether)', async() => {
        let rentalPrice1 = await decentralRentInstance.get_total_rent_price(1);
        amountToPayForRental1 = rentalPrice1.toNumber() + car1Deposit;
        await truffleAssert.reverts( decentralRentInstance.accept_rental_offer(1, { from: renterAddress1, value: amountToPayForRental1-1}), "Please transfer enough Eth to pay for rental");
    });

    it('13b. Test Car Renter 1 successfully accepting a rental offer', async() => {
        // update contract Eth balance before Renter 1 accepts the offer
        decentralRentEthBalance = await web3.eth.getBalance(decentralRentInstance.address);
        
        let acceptRental1 = await decentralRentInstance.accept_rental_offer(1, { from: renterAddress1, value: amountToPayForRental1});
        truffleAssert.eventEmitted(acceptRental1, 'RentalOfferAccepted');
        truffleAssert.eventEmitted(acceptRental1, 'Notify_owner');
    });

    it('13c. Test that DecentralRent contract received correct Eth amount from Car Renter 1', async() => {
        let newContractBalance = await web3.eth.getBalance(decentralRentInstance.address);
        let contractBalanceIncrease = BigInt(newContractBalance) - BigInt(decentralRentEthBalance);
        
        assert.strictEqual(
            Number(contractBalanceIncrease),
            amountToPayForRental1,
            "DecentralRent Contract did not receive the correct amount of Ether from Renter 1!"
        );

        decentralRentEthBalance = newContractBalance;
    });
    
    it('14a. Test Car Renter 2 accepting a rental offer', async() => {
        let rentalPrice2 = await decentralRentInstance.get_total_rent_price(2);
        amountToPayForRental2 = rentalPrice2.toNumber() + car2Deposit;

        let acceptRental2 = await decentralRentInstance.accept_rental_offer(2, { from: renterAddress2, value: amountToPayForRental2});
        
        truffleAssert.eventEmitted(acceptRental2, 'RentalOfferAccepted');
        truffleAssert.eventEmitted(acceptRental2, 'Notify_owner');
    });

    it('14b. Test that DecentralRent contract received correct Eth amount from Car Renter 2', async() => {
        let newContractBalance = await web3.eth.getBalance(decentralRentInstance.address);
        let contractBalanceIncrease = BigInt(newContractBalance) - BigInt(decentralRentEthBalance);

        assert.strictEqual(
            Number(contractBalanceIncrease),
            amountToPayForRental2,
            `Increase by ${Number(contractBalanceIncrease)} and expected ${amountToPayForRental2} don't match`
        );

        decentralRentEthBalance = newContractBalance;
    });
    
    it(`15a. Test unsuccessful receiving of a car (another renter's car)`, async() => {
        await truffleAssert.reverts(decentralRentInstance.confirm_car_received(1, {from: renterAddress2}), "This rental request does not belong to you.");
    });

    it('15b. Test successful receiving of car by Car Renter 1, and transfer Eth to Car Owner 1', async() => {
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

    it('15c. Test that rent and car status changed correctly after Car Renter 1 receives car', async() => {
        let rentStatusAfter = await decentralRentInstance.get_rent_status_toString(1);
        let carStatusAfter = await decentralRentInstance.get_car_status_toString(1);
        assert.strictEqual(
            rentStatusAfter,
            "Ongoing",
            `Expected Rent Status after returning to be "Ongoing"`
        );
        assert.strictEqual(
            carStatusAfter,
            "Received",
            `Expected Car Status after returning to be "Reserved"`
        );
    });

    it('16a. Test successful receiving of car by Car Renter 2, and transfer Eth to Car Owner 2', async() => {
    
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

    it('16b. Test that rent and car status changed correctly after Car Renter 2 receives car', async() => {
        let rentStatusAfter = await decentralRentInstance.get_rent_status_toString(2);
        let carStatusAfter = await decentralRentInstance.get_car_status_toString(2);
        assert.strictEqual(
            rentStatusAfter,
            "Ongoing",
            `Expected Rent Status after returning to be "Ongoing"`
        );
        assert.strictEqual(
            carStatusAfter,
            "Received",
            `Expected Car Status after returning to be "Reserved"`
        );
    });

    it('17a. Test unsuccessful returning of a car (only car owner can confirm)', async() => {
        await truffleAssert.reverts(decentralRentInstance.confirm_car_returned(1), "only verified car owner can perform this action");
    });

    it('17b. Test successful confirmation that car is returned (Car Owner 1), with Eth transfer and updated rent count', async() => {

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

    it('17c. Test that rent and car status changed correctly after renter 1 returns car', async() => {
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

    it('18a. Test unsuccessful leaving of rating (Car Renter cannot leave invalid rating for Car Owner)', async() => {
        await truffleAssert.reverts(decentralRentInstance.renter_leave_rating(1, 6, 6, 6, {from: renterAddress1}), "Rating has to be between 0 and 5!");
    });

    it(`18b. Test unsuccessful leaving of rating (Car Renter cannot leave rating for someone else's car rental)`, async() => {
        await truffleAssert.reverts(decentralRentInstance.renter_leave_rating(1, 5, 5, 5, {from: renterAddress2}), "You are not involved in this rental.");
    });


    it('18c. Test successful leaving of rating (Car Renter 1) for Car Owner 1', async() => {
        // checking rating values before
        let ownerCarConditionDescriptionBefore = await decentralRentInstance.get_owner_car_condition_description(carOwnerAddress1);
        let ownerAttitudeBefore = await decentralRentInstance.get_owner_attitude(carOwnerAddress1);
        let ownerResponseSpeedBefore = await decentralRentInstance.get_owner_response_speed(carOwnerAddress1);
        let ownerRatingCountBefore = await decentralRentInstance.get_owner_rating_count(carOwnerAddress1);
        let carConditionDescriptionToLeave = 5;
        let attitudeToLeave = 5;
        let responseSpeedToLeave = 5

        // leaving rating
        let leaveRatingForOwner1 = await decentralRentInstance.renter_leave_rating(1, carConditionDescriptionToLeave, attitudeToLeave,  responseSpeedToLeave, {from: renterAddress1});
        let ownerCarConditionDescriptionAfter = await decentralRentInstance.get_owner_car_condition_description(carOwnerAddress1);
        let ownerAttitudeAfter = await decentralRentInstance.get_owner_attitude(carOwnerAddress1);
        let ownerResponseSpeedAfter = await decentralRentInstance.get_owner_response_speed(carOwnerAddress1);

        // checking rating values after
        let expectedCarConditionDescriptionAfter = (ownerCarConditionDescriptionBefore.toNumber() * ownerRatingCountBefore.toNumber() + carConditionDescriptionToLeave) / (ownerRatingCountBefore.toNumber() + 1);
        let expectedAttitudeAfter = (ownerAttitudeBefore.toNumber() * ownerRatingCountBefore.toNumber() + attitudeToLeave) / (ownerRatingCountBefore.toNumber() + 1);
        let expectedResponseSpeedAfter = (ownerResponseSpeedBefore.toNumber() * ownerRatingCountBefore.toNumber() + responseSpeedToLeave) / (ownerRatingCountBefore.toNumber() + 1);

        // checking values
        assert.strictEqual(
            expectedCarConditionDescriptionAfter,
            ownerCarConditionDescriptionAfter .toNumber(),
            'Owner 1 rating did not change as expected'
        );

        assert.strictEqual(
            expectedAttitudeAfter,
            ownerAttitudeAfter.toNumber(),
            'Owner 1 rating did not change as expected'
        );

        assert.strictEqual(
            expectedResponseSpeedAfter,
            ownerResponseSpeedAfter.toNumber(),
            'Owner 1 rating did not change as expected'
        );
        truffleAssert.eventEmitted(leaveRatingForOwner1, 'CarOwnerNewRating');
        truffleAssert.eventEmitted(leaveRatingForOwner1, 'Notify_owner');
    });

    it('19a. Test unsuccessful leaving of rating (Car Owner cannot leave invalid rating for Car Renter', async() => {
        await truffleAssert.reverts(decentralRentInstance.owner_leave_rating(1, 6, 6, {from: carOwnerAddress1}), "Rating has to be between 0 and 5!");
    });

    it(`19b. Test unsuccessful leaving of rating (Car Owner cannot leave rating for someone else's car rental)`, async() => {
        await truffleAssert.reverts(decentralRentInstance.owner_leave_rating(1, 5, 5, {from: carOwnerAddress2}), "You are not involved in this rental.");
    });

    it('19c. Test successful leaving of rating (Car Owner 1) for Car Renter 1', async() => {
        // checking rating values before
        let renterAttitudeBefore = await decentralRentInstance.get_renter_attitude(renterAddress1);
        let renterResponseSpeedBefore = await decentralRentInstance.get_renter_response_speed(renterAddress1);
        let renterRatingCountBefore = await decentralRentInstance.get_renter_rating_count(renterAddress1);
        let attitudeToLeave = 5;
        let responseSpeedToLeave = 5;

        // leaving rating
        let leaveRatingForRenter1 = await decentralRentInstance.owner_leave_rating(1, attitudeToLeave, responseSpeedToLeave, {from: carOwnerAddress1});

        // checking rating values after
        let renterAttitudeAfter = await decentralRentInstance.get_renter_attitude(renterAddress1);
        let renterResponseSpeedAfter = await decentralRentInstance.get_renter_response_speed(renterAddress1);

        let expectedAttitudeAfter = (renterAttitudeBefore.toNumber() * renterRatingCountBefore.toNumber() + attitudeToLeave) / (renterRatingCountBefore.toNumber() + 1);
        let expectedResponseSpeedAfter = (renterResponseSpeedBefore.toNumber() * renterRatingCountBefore.toNumber() + responseSpeedToLeave) / (renterRatingCountBefore.toNumber() + 1);

        // checking values
        assert.strictEqual(
            expectedAttitudeAfter,
            renterAttitudeAfter.toNumber(),
            'Car Renter 1 rating did not change as expected'
        );

        assert.strictEqual(
            expectedResponseSpeedAfter,
            renterResponseSpeedAfter.toNumber(),
            'Car Renter 1 rating did not change as expected'
        );

        truffleAssert.eventEmitted(leaveRatingForRenter1, 'RenterNewRating');
        truffleAssert.eventEmitted(leaveRatingForRenter1, 'Notify_renter');
    });

    it('20a. Test Unsuccessful Car Owner 1 report issue for Rent 2 (wrong owner)', async() => {
        await truffleAssert.reverts(decentralRentInstance.report_issue(2, "never return car", "88888888", "sudoUrl", {from: carOwnerAddress1}), "Issue does not involve you!");
    });

    it('20b. Test successful Car Owner 2 report issue for Rent 2 (Never return car)', async() => {
        let reportIssue1 = await decentralRentInstance.report_issue(2, "never return car", "88888888", "sudoUrl", {from: carOwnerAddress2})
        truffleAssert.eventEmitted(reportIssue1, 'IssueReported');
        truffleAssert.eventEmitted(reportIssue1, 'Notify_owner');
        truffleAssert.eventEmitted(reportIssue1, 'Notify_renter');
    });

    it('21a. Test non support team resolve issue (unsuccessful)', async() => {
        await truffleAssert.reverts(decentralRentInstance.resolve_issue(0, 1, {from: carOwnerAddress2}), "only support team can trigger this function");
    });

    it('22b. Test support team resolve issue', async() => {
        /*
        let renterBalanceBefore = await web3.eth.getBalance(renterAddress1);

        let confirmCarReturned2 = await decentralRentInstance.confirm_car_returned(2, {from:carOwnerAddress2});
        truffleAssert.eventEmitted(confirmCarReturned2, 'CarReturned');

        // CHECK DEPOSIT TRANSFER
        let renterBalanceAfter = await web3.eth.getBalance(renterAddress1);
        let renterBalanceIncrease = BigInt(renterBalanceAfter) - BigInt(renterBalanceBefore);
        let carDeposit = await decentralRentInstance.get_car_deposit(1);

        assert.strictEqual(
            Number(renterBalanceIncrease),
            carDeposit.toNumber(),
            'Car Renter 1 did not receive correct eth amount for deposit'
        );*/

        let creditScoreBefore = await decentralRentInstance.get_renter_credit_score(renterAddress2);
        let changeInCreditScore = 1;

        let resolveIssue1 = await decentralRentInstance.resolve_issue(0, changeInCreditScore, {from:accounts[1]});
        //let currentTime = decentralRentInstance.get_current_time();
        //console.log(currentTime);

        let creditScoreAfter = await decentralRentInstance.get_renter_credit_score(renterAddress2);
        let expectedScoreAfter = 0;
        if (creditScoreBefore - changeInCreditScore >= 0) {
            expectedScoreAfter = creditScoreBefore - changeInCreditScore;
        }

        assert.strictEqual(
            expectedScoreAfter,
            creditScoreAfter.toNumber(),
            'Car Renter 2 credit score did not change as expected'
        );
        
        truffleAssert.eventEmitted(resolveIssue1, 'IssueResolved');
        truffleAssert.eventEmitted(resolveIssue1, 'Notify_owner');
        truffleAssert.eventEmitted(resolveIssue1, 'Notify_renter');
    });

    it('23a. Test Car Owner 2 reopened issue', async() => {
        let reopenIssue1 = await decentralRentInstance.reopen_issue(0, 'car scratched',  {from: carOwnerAddress2});

        truffleAssert.eventEmitted(reopenIssue1, 'IssueReopened');
        truffleAssert.eventEmitted(reopenIssue1, 'Notify_owner');
        truffleAssert.eventEmitted(reopenIssue1, 'Notify_renter');
    });

    it('23b. Test support team resolve issue again', async() => {
        let resolveIssue2 = await decentralRentInstance.resolve_issue(0, 1, {from:accounts[1]});

        truffleAssert.eventEmitted(resolveIssue2, 'IssueResolved');
        truffleAssert.eventEmitted(resolveIssue2, 'Notify_owner');
        truffleAssert.eventEmitted(resolveIssue2, 'Notify_renter');
    }); 

    it('24a. Test Renter 3 report issue with Rent 3 (never receive car)', async() => {
        let carRenterRegistration3 = await decentralRentInstance.register_car_renter({from: renterAddress3});
        truffleAssert.eventEmitted(carRenterRegistration3, 'RenterRegistered');  

        let request5 = await decentralRentInstance.submit_rental_request_with_offer(3, startDate, endDate, 20, {from: renterAddress3});
        truffleAssert.eventEmitted(request5, 
            'RentalRequestedSubmitted', (ev) => {
                return ev.renter_address === renterAddress3;
            }, 
            "The renter address of rent instance does not match with renterAddress3");
        truffleAssert.eventEmitted(request5, 'Notify_owner');

        let approval4 = await decentralRentInstance.approve_rental_request(3, { from: carOwnerAddress2});
        truffleAssert.eventEmitted(approval4, 'RentalOfferApproved');

        let rentalPrice3 = await decentralRentInstance.get_total_rent_price(3);
        amountToPayForRental3 = rentalPrice3.toNumber() + car3Deposit;

        let acceptRental3 = await decentralRentInstance.accept_rental_offer(3, {from: renterAddress3, value: amountToPayForRental3});
        
        truffleAssert.eventEmitted(acceptRental3, 'RentalOfferAccepted');
        truffleAssert.eventEmitted(acceptRental3, 'Notify_owner');
        
        let reportIssue2 = await decentralRentInstance.report_issue(3, "never return car", "88888888", "sudoUrl", {from: carOwnerAddress2})
        truffleAssert.eventEmitted(reportIssue2, 'IssueReported');
        truffleAssert.eventEmitted(reportIssue2, 'Notify_owner');
        truffleAssert.eventEmitted(reportIssue2, 'Notify_renter');
    });

    it('24b. Test Transfer rent and deposit back to Renter 3', async() => {
        // Checking owner balance before
        let ownerBalanceBefore = await web3.eth.getBalance(renterAddress3);

        // RECEIVING
        let totalRefund = await decentralRentInstance.get_total_rent_price(3);
        let refund = await decentralRentInstance.support_team_transfer(1, totalRefund.toNumber() + car3Deposit, renterAddress3);
        
        // CHECK RENTAL AMOUNT TRANSFER
        let ownerBalanceAfter = await web3.eth.getBalance(renterAddress3);
        let renterBalanceIncrease = BigInt(ownerBalanceAfter) - BigInt(ownerBalanceBefore);
        
        assert.strictEqual(
            Number(renterBalanceIncrease),
            totalRefund.toNumber(),
            'Renter 3 did not receive correct eth amount'
        );
    });

    it('24c. Test reopen issue after 7 days (Unsuccessful)', async() => {
        await decentralRentInstance.revert_issue_resolved_date_by_7day(1);
        await truffleAssert.reverts(decentralRentInstance.reopen_issue(1, 'car scratched', {from: renterAddress3}), "you can only reopen an issue within 7 days after it is resolved");
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
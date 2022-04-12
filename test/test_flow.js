const _deploy_contracts = require("../migrations/2_deploy_contracts");
const truffleAssert = require('truffle-assertions');
var assert = require('assert');


const DecentralRent = artifacts.require("../contracts/DecentralRent.sol");

contract('DecentralRent', function(accounts) {
    before(async() => {
        decentralRentInstance = await DecentralRent.deployed();
    });

    it('1. Successful Flow', async() => {
        // Register owner 1 & renter 1 and 2 
        let carOwnerRegistration1 = await decentralRentInstance.register_car_owner({ from: carOwnerAddress1 });
        truffleAssert.eventEmitted(carOwnerRegistration1, 'CarOwnerRegistered');

        let carRenterRegistration1 = await decentralRentInstance.register_car_renter({ from: renterAddress1 });
        truffleAssert.eventEmitted(carRenterRegistration1, 'RenterRegistered');

        let carRenterRegistration2 = await decentralRentInstance.register_car_renter({ from: renterAddress2 });
        truffleAssert.eventEmitted(carRenterRegistration2, 'RenterRegistered');

        // Owner 1 register car 1
        let car1 = await decentralRentInstance.register_car("mercedes", "car1", { from: carOwnerAddress1 }); // owner 1, car 1
        truffleAssert.eventEmitted(car1, "CarRegistered");

        let car1Status = await decentralRentInstance.get_car_status_toString(1);
        assert.strictEqual(car1Status, "Registered", "Car registeration failed");

        // Owner 1 list car 1
        let car1Listing = await decentralRentInstance.list_car_for_rental(1, startDate, endDate, "collectionPoint", hourlyRentalRate, deposit, carCondition, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(car1Listing, "CarListed");
        car1Deposit = deposit;

        let car1NewStatus = await decentralRentInstance.get_car_status_toString(1);
        assert.strictEqual(car1NewStatus, "Available", "Car listing failed");

        // Renter 1 apply for car 1        
        let request1 = await decentralRentInstance.submit_rental_request_with_offer(1, startDate, endDate, 20, { from: renterAddress1 });
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

        // Renter 1 updated his request
        let newOfferedRate = 40;
        let updatedCarRentalRequest = await decentralRentInstance.update_rental_request(1, startDate, endDate, newOfferedRate, { from: renterAddress1 });
        truffleAssert.eventEmitted(updatedCarRentalRequest, "RentRequestUpdated");

        // Renter 2 apply for car 1
        // Owner 1 approve renter 1 
        // Owner 1 reject renter 2 
        // Renter 1 accept
        // Renter 1 confirms that the car is received
        // Owner 1 confirms car return. No issue raised
        // Contract owner withdraws the profit


    });
})
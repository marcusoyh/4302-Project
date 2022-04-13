const _deploy_contracts = require("../migrations/2_deploy_contracts");
const truffleAssert = require('truffle-assertions');
var assert = require('assert');


const DecentralRent = artifacts.require("../contracts/DecentralRent.sol");


// This test files tests for different flows of user stories.


contract('DecentralRentFlows', function(accounts) {
    let contractOwnerAddress = accounts[0];
    let carOwnerAddress1 = accounts[2];
    let renterAddress1 = accounts[3];
    let renterAddress2 = accounts[4];
    let renterAddress3 = accounts[5];
    let renterAddress4 = accounts[6];
    let renterAddress5 = accounts[7];
    let renterAddress6 = accounts[8];
    let renterAddress7 = accounts[9];
    let startDate = new Date('2022-05-27T10:00').getTime() / 1000; // save in seconds
    let endDate = new Date('2022-05-30T10:30').getTime() / 1000;
    let hourlyRentalRate = 30;
    let deposit = 50;
    let car1Deposit;
    let car2Deposit;
    let car3Deposit;
    let carCondition = 10;


    before(async() => {
        decentralRentInstance = await DecentralRent.deployed();
    });

    it('1. Typical User Journey', async() => {
        let platformFee_1 = await decentralRentInstance.get_platform_fee();
        let platformFee = platformFee_1.toNumber();
        console.log("=======================================================================================");
        console.log("-**-Flow of typical user journey start.-**-");

        // owner 1, renter 1 & 2, car 1, rent 1 & 2

        // Register owner 1 & renter 1 and 2 
        let carOwnerRegistration1 = await decentralRentInstance.register_car_owner({ from: carOwnerAddress1 });
        truffleAssert.eventEmitted(carOwnerRegistration1, 'CarOwnerRegistered');
        console.log("CarOwner1 registered.");


        let carRenterRegistration1 = await decentralRentInstance.register_car_renter({ from: renterAddress1 });
        truffleAssert.eventEmitted(carRenterRegistration1, 'RenterRegistered');
        console.log("Renter1 registered.");

        let carRenterRegistration2 = await decentralRentInstance.register_car_renter({ from: renterAddress2 });
        truffleAssert.eventEmitted(carRenterRegistration2, 'RenterRegistered');
        console.log("Renter2 registered.");



        // Owner 1 register car 1
        let car1 = await decentralRentInstance.register_car("mercedes", "car1", "image1", "image2", "image3", { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(car1, "CarRegistered");
        let car1Status = await decentralRentInstance.get_car_status_toString(1);
        assert.strictEqual(car1Status, "Registered", "Car registeration failed");
        console.log("Car1 registered by carOwner1.");



        // Owner 1 list car 1
        let car1Listing = await decentralRentInstance.list_car_for_rental(1, "collectionPoint", hourlyRentalRate, deposit, carCondition, { from: carOwnerAddress1, value: platformFee });
        truffleAssert.eventEmitted(car1Listing, "CarListed");
        let car1NewStatus = await decentralRentInstance.get_car_status_toString(1);
        assert.strictEqual(car1NewStatus, "Available", "Car listing failed");
        console.log("Car1 listed by carOwner1.");



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
        console.log("RentRequest1 for car1 submitted by renter1.");



        // Renter 2 apply for car 1
        let request2 = await decentralRentInstance.submit_rental_request_with_offer(1, startDate, endDate, 20, { from: renterAddress2 });
        truffleAssert.eventEmitted(request2,
            'RentalRequestedSubmitted', (ev) => {
                return ev.renter_address === renterAddress2;
            },
            "The renter address of rent instance does not match with renterAddress2");
        truffleAssert.eventEmitted(request1, 'Notify_owner');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(2),
            "Pending",
            "The rental status should be in pending"
        );
        console.log("RentRequest2 for car1 submitted by renter2.");



        // Renter 1 updated his request
        let newOfferedRate = 20;
        let updatedCarRentalRequest = await decentralRentInstance.update_rental_request(1, startDate, endDate, newOfferedRate, { from: renterAddress1 });
        truffleAssert.eventEmitted(updatedCarRentalRequest, "RentRequestUpdated");
        console.log("RentRequest1 updated by renter1.");



        // Owner 1 approve rent 1 
        let approval = await decentralRentInstance.approve_rental_request(1, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(approval, 'RentalOfferApproved');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(1),
            "Approved",
            "The status of the rent is not changed to 'Approved'"
        );
        console.log("RentRequest1 approved by carOwner1.");



        // Owner 1 reject renter 2 
        let rejection = await decentralRentInstance.reject_rental_request(2, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(rejection, 'RentalRequestRejected');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(2),
            "Rejected",
            "The status of the rent is not changed to 'Rejected'"
        );
        console.log("RentRequest2 rejected by carOwner1.");



        // Renter 1 accept offer
        decentralRentEthBalance = await web3.eth.getBalance(decentralRentInstance.address);

        let rentalPrice = await decentralRentInstance.get_total_rent_price(1);
        car1Deposit = deposit;
        amountToPayForRental = rentalPrice.toNumber() + car1Deposit;
        let acceptRental = await decentralRentInstance.accept_rental_offer(1, { from: renterAddress1, value: amountToPayForRental });

        truffleAssert.eventEmitted(acceptRental, 'RentalOfferAccepted');
        truffleAssert.eventEmitted(acceptRental, 'Notify_owner');
        console.log("RentRequest1 offer accepted by renter1.");

        let newContractBalance = await web3.eth.getBalance(decentralRentInstance.address);
        let contractBalanceIncrease = BigInt(newContractBalance) - BigInt(decentralRentEthBalance);

        assert.strictEqual(
            Number(contractBalanceIncrease),
            amountToPayForRental,
            "DecentralRent Contract did not receive the correct amount of Ether from Renter 1!"
        );

        decentralRentEthBalance = newContractBalance;
        console.log("Renter1 transfered correct deposit + rent to contract.");



        // Renter 1 confirms that the car is received
        let ownerBalanceBefore = await web3.eth.getBalance(carOwnerAddress1);

        let confirmReceived = await decentralRentInstance.confirm_car_received(1, { from: renterAddress1 });
        truffleAssert.eventEmitted(confirmReceived, 'CarReceived');
        assert.strictEqual(
            await decentralRentInstance.get_car_status_toString(1),
            "Received",
            "The status of the car is not changed to 'Received'"
        );
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(1),
            "Ongoing",
            `The status of the rent is not changed to "Ongoing"`
        );
        console.log("RentRequest1 car1 received by renter1.");

        let ownerBalanceAfter = await web3.eth.getBalance(carOwnerAddress1);
        let commissionPercent = await decentralRentInstance.get_commission_percent();
        let commissionCharge = Math.floor(commissionPercent.toNumber() * rentalPrice.toNumber() / 100);
        let finalRentalPrice = rentalPrice.toNumber() - commissionCharge;
        let ownerBalanceIncrease = BigInt(ownerBalanceAfter) - BigInt(ownerBalanceBefore);
        assert.strictEqual(
            Number(ownerBalanceIncrease),
            finalRentalPrice,
            'Car Owner 1 did not receive correct amount of rent'
        );
        console.log("RentRequest1 rent transfered to carOwner1. Commission fee charged.");



        // Owner 1 confirms car return. 
        let renterBalanceBefore = await web3.eth.getBalance(renterAddress1);

        let confirmCarReturned = await decentralRentInstance.confirm_car_returned(1, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(confirmCarReturned, 'CarReturned');
        assert.strictEqual(
            await decentralRentInstance.get_car_status_toString(1),
            "Available",
            "The status of the car is not changed to 'Available'"
        );
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(1),
            "Completed",
            `The status of the rent is not changed to "Completed"`
        );
        console.log("RentRequest1 car1 returned to carOwner1.");

        let renterBalanceAfter = await web3.eth.getBalance(renterAddress1);
        let renterBalanceIncrease = BigInt(renterBalanceAfter) - BigInt(renterBalanceBefore);
        let carDeposit = await decentralRentInstance.get_car_deposit(1);
        let refundDeposit = carDeposit.toNumber() - commissionCharge;
        assert.strictEqual(
            Number(renterBalanceIncrease),
            refundDeposit,
            'Car Renter 1 did not receive correct amount of deposit refund'
        );
        console.log("RentRequest1 deposit refunded to renter1. Commission fee charged.");



        // Renter 1 leave rating for owner 1
        // checking rating values before
        let ownerCarConditionDescriptionBefore = await decentralRentInstance.get_owner_car_condition_description(carOwnerAddress1);
        let ownerAttitudeBefore = await decentralRentInstance.get_owner_attitude(carOwnerAddress1);
        let ownerResponseSpeedBefore = await decentralRentInstance.get_owner_response_speed(carOwnerAddress1);
        let ownerRatingCountBefore = await decentralRentInstance.get_owner_rating_count(carOwnerAddress1);
        let carConditionDescriptionToLeave = 5;
        let attitudeToLeave = 5;
        let responseSpeedToLeave = 5

        // leaving rating
        let leaveRatingForOwner1 = await decentralRentInstance.renter_leave_rating(1, carConditionDescriptionToLeave, attitudeToLeave, responseSpeedToLeave, { from: renterAddress1 });
        let ownerCarConditionDescriptionAfter = await decentralRentInstance.get_owner_car_condition_description(carOwnerAddress1);
        let ownerAttitudeAfter = await decentralRentInstance.get_owner_attitude(carOwnerAddress1);
        let ownerResponseSpeedAfter = await decentralRentInstance.get_owner_response_speed(carOwnerAddress1);

        // checking rating values after
        let expectedCarConditionDescriptionAfter = (ownerCarConditionDescriptionBefore.toNumber() * ownerRatingCountBefore.toNumber() + carConditionDescriptionToLeave) / (ownerRatingCountBefore.toNumber() + 1);
        let expectedAttitudeAfter = (ownerAttitudeBefore.toNumber() * ownerRatingCountBefore.toNumber() + attitudeToLeave) / (ownerRatingCountBefore.toNumber() + 1);
        let expectedResponseSpeedAfter = (ownerResponseSpeedBefore.toNumber() * ownerRatingCountBefore.toNumber() + responseSpeedToLeave) / (ownerRatingCountBefore.toNumber() + 1);

        // checking values
        assert.strictEqual(
            ownerCarConditionDescriptionAfter.toNumber(),
            expectedCarConditionDescriptionAfter,
            'Owner 1 rating did not change as expected'
        );
        assert.strictEqual(
            ownerAttitudeAfter.toNumber(),
            expectedAttitudeAfter,
            'Owner 1 rating did not change as expected'
        );
        assert.strictEqual(
            ownerResponseSpeedAfter.toNumber(),
            expectedResponseSpeedAfter,
            'Owner 1 rating did not change as expected'
        );
        truffleAssert.eventEmitted(leaveRatingForOwner1, 'CarOwnerNewRating');
        truffleAssert.eventEmitted(leaveRatingForOwner1, 'Notify_owner');
        console.log("Renter1 left rating for carOwner1.");



        // Owner 1 leave rating for renter 1
        // checking rating values before
        let renterCarConditionMaintainingBefore = await decentralRentInstance.get_renter_car_condition_maintaining(renterAddress1);
        let renterAttitudeBefore = await decentralRentInstance.get_renter_attitude(renterAddress1);
        let renterResponseSpeedBefore = await decentralRentInstance.get_renter_response_speed(renterAddress1);
        let renterRatingCountBefore = await decentralRentInstance.get_renter_rating_count(renterAddress1);
        let carConditionMaintainingToLeave = 5;
        let attitudeToLeave1 = 5;
        let responseSpeedToLeave1 = 5;

        // leaving rating
        let leaveRatingForRenter1 = await decentralRentInstance.owner_leave_rating(1, carConditionMaintainingToLeave, attitudeToLeave1, responseSpeedToLeave1, { from: carOwnerAddress1 });

        // checking rating values after
        let renterCarConditionMaintainingAfter = await decentralRentInstance.get_renter_car_condition_maintaining(renterAddress1);
        let renterAttitudeAfter = await decentralRentInstance.get_renter_attitude(renterAddress1);
        let renterResponseSpeedAfter = await decentralRentInstance.get_renter_response_speed(renterAddress1);

        let expectedCarConditionMaintainingAfter = (renterCarConditionMaintainingBefore.toNumber() * renterRatingCountBefore.toNumber() + carConditionMaintainingToLeave) / (renterRatingCountBefore.toNumber() + 1);
        let expectedAttitudeAfter1 = (renterAttitudeBefore.toNumber() * renterRatingCountBefore.toNumber() + attitudeToLeave) / (renterRatingCountBefore.toNumber() + 1);
        let expectedResponseSpeedAfter1 = (renterResponseSpeedBefore.toNumber() * renterRatingCountBefore.toNumber() + responseSpeedToLeave) / (renterRatingCountBefore.toNumber() + 1);

        // checking values
        assert.strictEqual(
            expectedCarConditionMaintainingAfter,
            renterCarConditionMaintainingAfter.toNumber(),
            'Car Renter 1 rating did not change as expected'
        );
        assert.strictEqual(
            renterAttitudeAfter.toNumber(),
            expectedAttitudeAfter1,
            'Car Renter 1 rating did not change as expected'
        );
        assert.strictEqual(
            renterResponseSpeedAfter.toNumber(),
            expectedResponseSpeedAfter1,
            'Car Renter 1 rating did not change as expected'
        );
        truffleAssert.eventEmitted(leaveRatingForRenter1, 'RenterNewRating');
        truffleAssert.eventEmitted(leaveRatingForRenter1, 'Notify_renter');
        console.log("CarOwner1 left rating for renter1.");

        console.log("-**-Flow of typical user journey end.-**-");
    });


    it('2. Issue Flow -> renter never return car', async() => {
        let platformFee_1 = await decentralRentInstance.get_platform_fee();
        let platformFee = platformFee_1.toNumber();
        console.log("=======================================================================================");
        console.log("-**-Issue flow of renter not returning car start.-**-");

        // owner 1, renter 3, car 2, rent 3, issue 1
        // renter 3 register 
        let carRenterRegistration3 = await decentralRentInstance.register_car_renter({ from: renterAddress3 });
        truffleAssert.eventEmitted(carRenterRegistration3, 'RenterRegistered');
        console.log("Renter3 registered")

        // Owner 1 register car 2
        let car2 = await decentralRentInstance.register_car("mazda", "car2", "image1", "image2", "image3", { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(car2, "CarRegistered")

        let car2Status = await decentralRentInstance.get_car_status_toString(2);
        assert.strictEqual(car2Status, "Registered", "Car registeration failed");
        console.log("Car2 registered by carOwner1");

        // Owner 1 list car 2
        let car2Listing = await decentralRentInstance.list_car_for_rental(2, "collectionPoint", hourlyRentalRate, deposit, carCondition, { from: carOwnerAddress1, value: platformFee });
        truffleAssert.eventEmitted(car2Listing, "CarListed");
        car2Deposit = deposit;

        let car2NewStatus = await decentralRentInstance.get_car_status_toString(2);
        assert.strictEqual(car2NewStatus, "Available", "Car listing failed");
        console.log("Car2 listed by carOwner1");

        // Renter 3 apply for car 2 
        let request3 = await decentralRentInstance.submit_rental_request_with_offer(2, startDate, endDate, 20, { from: renterAddress3 });
        truffleAssert.eventEmitted(request3,
            'RentalRequestedSubmitted', (ev) => {
                return ev.renter_address === renterAddress3;
            },
            "The renter address of rent instance does not match with renterAddress1");
        truffleAssert.eventEmitted(request3, 'Notify_owner');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(3),
            "Pending",
            "The rental status should be in pending"
        );
        console.log("RentRequest3 for car2 submitted by renter3");

        // Owner 1 approves rent 3
        let approval3 = await decentralRentInstance.approve_rental_request(3, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(approval3, 'RentalOfferApproved');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(3),
            "Approved",
            "The status of the rent whould be changed to 'Approved'"
        );
        console.log("RentRequest3 approved by carOwner1");

        // Renter 3 accepts offer
        let rentalPrice3 = await decentralRentInstance.get_total_rent_price(3);
        amountToPayForRental3 = rentalPrice3.toNumber() + car2Deposit;

        let acceptRental3 = await decentralRentInstance.accept_rental_offer(3, { from: renterAddress3, value: amountToPayForRental3 });

        truffleAssert.eventEmitted(acceptRental3, 'RentalOfferAccepted');
        truffleAssert.eventEmitted(acceptRental3, 'Notify_owner');
        console.log("RentRequest3 offer accepted by renter3");

        // Renter 3 confirms the car received 
        // Checking owner balance before
        let ownerBalanceBefore = await web3.eth.getBalance(carOwnerAddress1);

        // RECEIVING
        let confirmReceived3 = await decentralRentInstance.confirm_car_received(3, { from: renterAddress3 });
        truffleAssert.eventEmitted(confirmReceived3, 'CarReceived');

        // CHECK RENTAL AMOUNT TRANSFER
        let ownerBalanceAfter = await web3.eth.getBalance(carOwnerAddress1);
        let commissionPercent = await decentralRentInstance.get_commission_percent();
        let totalRentalPrice = await decentralRentInstance.get_total_rent_price(3);
        let commissionCharge = Math.floor(commissionPercent.toNumber() * totalRentalPrice.toNumber() / 100);
        let finalRentalPrice = totalRentalPrice.toNumber() - commissionCharge;
        let ownerBalanceIncrease = BigInt(ownerBalanceAfter) - BigInt(ownerBalanceBefore);

        assert.strictEqual(
            Number(ownerBalanceIncrease),
            finalRentalPrice,
            'Car Owner 1 did not receive correct eth amount'
        );
        console.log("RentRequest3 car2 received by renter3.");

        // Owner 1 report issue - nv return car 
        let reportIssue1 = await decentralRentInstance.report_issue(3, "never return car", "88888888", "sudoUrl", { from: carOwnerAddress1 })
        truffleAssert.eventEmitted(reportIssue1, 'IssueReported');
        truffleAssert.eventEmitted(reportIssue1, 'Notify_owner');
        truffleAssert.eventEmitted(reportIssue1, 'Notify_renter');
        console.log("Issue1 submitted by carOwner1 for never return car.");

        // Support team resolve issue and terminate rent, update car and rent status

        // support team will chase for car return offline and make sure the car is properly returned, then proceed to handle rent closure
        // penalise renter for not returning car

        let renterTotalRentCount = await decentralRentInstance.get_renter_total_rent_count(renterAddress3);
        let renterSuccessfulRentCount = await decentralRentInstance.get_renter_completed_rent_count(renterAddress3);
        let renterExpectedScoreAfter = Math.floor(renterSuccessfulRentCount.toNumber() / (renterTotalRentCount.toNumber() + 1) * 100);

        let ownerTotalRentCount = await decentralRentInstance.get_owner_total_rent_count(carOwnerAddress1);
        let ownerSuccessfulRentCount = await decentralRentInstance.get_owner_completed_rent_count(carOwnerAddress1);
        let ownerExpectedScoreAfter = Math.floor((ownerSuccessfulRentCount.toNumber() + 1) / (ownerTotalRentCount.toNumber() + 1) * 100);

        // support team update credit score，rental status and car status
        // issue id 1
        await decentralRentInstance.penalty_log(1, 'renter', { from: accounts[1] });
        await decentralRentInstance.update_rental_status(1, 'Abnormal', 'Available', { from: accounts[1] });
        let resolveIssue1 = await decentralRentInstance.resolve_issue(1, { from: accounts[1] });

        let renterCreditScoreAfter = await decentralRentInstance.get_renter_credit_score(renterAddress3);
        let ownerCreditScoreAfter = await decentralRentInstance.get_owner_credit_score(carOwnerAddress1);

        assert.strictEqual(
            renterCreditScoreAfter.toNumber(),
            renterExpectedScoreAfter,
            'Car Renter 3 credit score did not change as expected'
        );

        assert.strictEqual(
            ownerCreditScoreAfter.toNumber(),
            ownerExpectedScoreAfter,
            'Car Owner 1 credit score did not change as expected'
        );

        truffleAssert.eventEmitted(resolveIssue1, 'IssueResolved');
        truffleAssert.eventEmitted(resolveIssue1, 'Notify_owner');
        truffleAssert.eventEmitted(resolveIssue1, 'Notify_renter');
        console.log("Support team resolved issue1, adds penalty log for renter3");
        console.log("Support team updates rental status and car status to close the rent");

        console.log("-**-Issue flow of renter not returning car end.-**-");
    });

    it('3. Issue Flow -> renter never receive car + renter scratch car + reopen issue', async() => {
        let platformFee_1 = await decentralRentInstance.get_platform_fee();
        let platformFee = platformFee_1.toNumber();
        console.log("=======================================================================================");
        console.log("-**-Issue flow of renter not receiving car & scratch car start.-**-");

        // owner 1, renter 4, car 3, rent 4, issue 2

        // Car renter 4 register
        let carRenterRegistration4 = await decentralRentInstance.register_car_renter({ from: renterAddress4 });
        truffleAssert.eventEmitted(carRenterRegistration4, 'RenterRegistered');
        console.log("Renter4 registered.");

        // Owner 1 register car 3 
        let car3 = await decentralRentInstance.register_car("honda", "car3", "image1", "image2", "image3", { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(car3, "CarRegistered")
        let car3Status = await decentralRentInstance.get_car_status_toString(3);
        assert.strictEqual(car3Status, "Registered", "Car registeration failed");
        console.log("Car3 registered by carOwner1.");

        // Owner 1 list car 3
        let car3Listing = await decentralRentInstance.list_car_for_rental(3, "collectionPoint", hourlyRentalRate, deposit, carCondition, { from: carOwnerAddress1, value: platformFee });
        truffleAssert.eventEmitted(car3Listing, "CarListed");
        car3Deposit = deposit;

        let car3NewStatus = await decentralRentInstance.get_car_status_toString(3);
        assert.strictEqual(car3NewStatus, "Available", "Car listing failed");
        console.log("Car3 listed by carOwner1.");


        // Renter 4 apply for car 3 
        let request4 = await decentralRentInstance.submit_rental_request_with_offer(3, startDate, endDate, 20, { from: renterAddress4 });
        truffleAssert.eventEmitted(request4,
            'RentalRequestedSubmitted', (ev) => {
                return ev.renter_address === renterAddress4;
            },
            "The renter address of rent instance does not match with renterAddress1");
        truffleAssert.eventEmitted(request4, 'Notify_owner');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(4),
            "Pending",
            "The rental status should be in pending"
        );
        console.log("RentRequest4 for car1 submitted by renter4.");


        // Owner 1 approves rent 4
        let approval4 = await decentralRentInstance.approve_rental_request(4, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(approval4, 'RentalOfferApproved');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(4),
            "Approved",
            "The status of the rent whould be changed to 'Approved'"
        );
        console.log("RentRequest4 approved by carOwner1.")


        // Renter 4 accepts offer
        let rentalPrice4 = await decentralRentInstance.get_total_rent_price(4);
        amountToPayForRental4 = rentalPrice4.toNumber() + car3Deposit;

        let acceptRental4 = await decentralRentInstance.accept_rental_offer(4, { from: renterAddress4, value: amountToPayForRental4 });

        truffleAssert.eventEmitted(acceptRental4, 'RentalOfferAccepted');
        truffleAssert.eventEmitted(acceptRental4, 'Notify_owner');
        console.log("RentRequest4 offer accepted by renter4.");
        console.log("Renter4 transfered correct deposit + rent to contract.");

        // issue id 2
        // Renter 4 report never receive car 
        let reportIssue2 = await decentralRentInstance.report_issue(4, "never receive car", "88888888", "sudoUrl", { from: renterAddress4 })
        truffleAssert.eventEmitted(reportIssue2, 'IssueReported');
        truffleAssert.eventEmitted(reportIssue2, 'Notify_owner');
        truffleAssert.eventEmitted(reportIssue2, 'Notify_renter');
        console.log("Issue2 submitted by renter4 for never receiving car.");


        // Support team resolve
        // support team will chase the owner to deliver car, record penalty log
        await decentralRentInstance.penalty_log(2, 'owner', { from: accounts[1] });
        let resolveIssue2 = await decentralRentInstance.resolve_issue(2, { from: accounts[1] });
        await decentralRentInstance.confirm_car_received(4, { from: renterAddress4 });
        console.log("Support team resolved issue2, added penalty log for owner1.");
        console.log("RentRequest4 car3 received by renter4.");


        truffleAssert.eventEmitted(resolveIssue2, 'IssueResolved');
        truffleAssert.eventEmitted(resolveIssue2, 'Notify_owner');
        truffleAssert.eventEmitted(resolveIssue2, 'Notify_renter');


        // Renter 4 reopen issue -> car scratched 
        let reopenIssue2 = await decentralRentInstance.reopen_issue(2, 'car scratched', { from: renterAddress4 });

        truffleAssert.eventEmitted(reopenIssue2, 'IssueReopened');
        truffleAssert.eventEmitted(reopenIssue2, 'Notify_owner');
        truffleAssert.eventEmitted(reopenIssue2, 'Notify_renter');
        console.log("Renter4 reopened issue2 for scratching.");

        // Support team resolve issue
        let amount = 2;
        let rentId = await decentralRentInstance.get_issue_rentId(2);
        let ownerAddress = await decentralRentInstance.get_rent_car_owner(rentId);

        let ownerBalanceBefore = await web3.eth.getBalance(ownerAddress);

        // penalise from deposit, record penalty log
        await decentralRentInstance.penalty_log(2, 'renter', { from: accounts[1] });
        await decentralRentInstance.support_team_transfer(2, amount, ownerAddress, { from: accounts[1] })
        let resolveIssue3 = await decentralRentInstance.resolve_issue(2, { from: accounts[1] });

        let ownerBalanceAfter = await web3.eth.getBalance(ownerAddress);
        let ownerBalanceIncrease = BigInt(ownerBalanceAfter) - BigInt(ownerBalanceBefore);

        assert.strictEqual(
            Number(ownerBalanceIncrease),
            amount,
            'Car Owner did not receive correct eth amount'
        );

        truffleAssert.eventEmitted(resolveIssue3, 'IssueResolved');
        truffleAssert.eventEmitted(resolveIssue3, 'Notify_owner');
        truffleAssert.eventEmitted(resolveIssue3, 'Notify_renter');
        console.log("Support team resolved issue2, added penalty log for renter4.");

        // Renter 4 reopen issue after 7 days -> unsuccessful 
        await decentralRentInstance.revert_issue_resolved_date_by_7day(2);
        await truffleAssert.reverts(decentralRentInstance.reopen_issue(2, 'car scratched', { from: renterAddress4 }), "you can only reopen an issue within 7 days after it is resolved");
        console.log("Renter4 wanted to reopen issue2 after 7 days but failed.");

        // calculate expected score 
        let renterTotalRentCount = await decentralRentInstance.get_renter_total_rent_count(renterAddress4);
        let renterSuccessfulRentCount = await decentralRentInstance.get_renter_completed_rent_count(renterAddress4);
        let renterExpectedScoreAfter = Math.floor(renterSuccessfulRentCount.toNumber() / (renterTotalRentCount.toNumber() + 1) * 100);

        let ownerTotalRentCount = await decentralRentInstance.get_owner_total_rent_count(carOwnerAddress1);
        let ownerSuccessfulRentCount = await decentralRentInstance.get_owner_completed_rent_count(carOwnerAddress1);
        let ownerExpectedScoreAfter = Math.floor((ownerSuccessfulRentCount.toNumber()) / (ownerTotalRentCount.toNumber() + 1) * 100);

        // Owner 1 confirms car returned at the end of rent
        await decentralRentInstance.confirm_car_returned(4, { from: carOwnerAddress1 });
        console.log("RentRequest4 car3 returned to carOwner1.")

        let renterCreditScoreAfter = await decentralRentInstance.get_renter_credit_score(renterAddress4);
        let ownerCreditScoreAfter = await decentralRentInstance.get_owner_credit_score(carOwnerAddress1);


        assert.strictEqual(
            ownerCreditScoreAfter.toNumber(),
            ownerExpectedScoreAfter,
            'Car Owner 1 credit score did not change as expected'
        );

        assert.strictEqual(
            renterCreditScoreAfter.toNumber(),
            renterExpectedScoreAfter,
            'Car Renter 4 credit score did not change as expected'
        );

        console.log("-**-Issue flow of renter not receiving car & scratch car end.-**-");
    });

    it('4. Car Owner Approve Rental Request then Recall Flow', async() => {
        let platformFee_1 = await decentralRentInstance.get_platform_fee();
        let platformFee = platformFee_1.toNumber();
        console.log("=======================================================================================");
        console.log("-**-Flow of offer recallment start.-**-");

        // Register renter 5
        let carRenterRegistration5 = await decentralRentInstance.register_car_renter({ from: renterAddress5 });
        truffleAssert.eventEmitted(carRenterRegistration5, 'RenterRegistered');
        console.log("Renter5 registered.");



        // Owner 1 register car 4
        let car4 = await decentralRentInstance.register_car("mercedes", "car4", "image1", "image2", "image3", { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(car4, "CarRegistered");
        assert.strictEqual(
            await decentralRentInstance.get_car_status_toString(4),
            "Registered",
            "The status of the car is not changed to 'Registered'"
        );
        console.log("Car4 registered by carOwner1.");



        // Owner 1 list car 4
        let car4Listing = await decentralRentInstance.list_car_for_rental(4, "collectionPoint", hourlyRentalRate, deposit, carCondition, { from: carOwnerAddress1, value: platformFee });
        truffleAssert.eventEmitted(car4Listing, "CarListed");
        assert.strictEqual(
            await decentralRentInstance.get_car_status_toString(4),
            "Available",
            "The status of the car is not changed to 'Available'"
        );
        console.log("Car4 listed by carOwner1.");



        // Renter 5 request for car 4
        let request5 = await decentralRentInstance.submit_rental_request_with_offer(4, startDate, endDate, 20, { from: renterAddress5 });
        truffleAssert.eventEmitted(request5,
            'RentalRequestedSubmitted', (ev) => {
                return ev.renter_address === renterAddress5;
            },
            "The renter address of rent instance does not match with renterAddress5");
        truffleAssert.eventEmitted(request5, 'Notify_owner');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(5),
            "Pending",
            "The rental status should be in pending"
        );
        console.log("RentRequest5 for car4 submitted by renter5.");



        // Owner 1 approve renter 5
        let approval5 = await decentralRentInstance.approve_rental_request(5, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(approval5, 'RentalOfferApproved');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(5),
            "Approved",
            "The status of the rent is not changed to 'Approved'"
        );
        console.log("RentRequest5 approved by carOwner1.");



        // Owner 1 recall approval -> failed because not 24h yet
        await truffleAssert.reverts(decentralRentInstance.recall_approval(5, { from: carOwnerAddress1 }), "You can only recall it after 24h since your approval.");
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(5),
            "Approved",
            "The status of the rent is not 'Approved'"
        );
        console.log("RentRequest5 offer recall by carOwner1 within 24h --- Failed");



        // 24h passed, owner 4 recall approval succeed
        await decentralRentInstance.revert_offer_date_by_1day(5);
        let recallOffer5 = await decentralRentInstance.recall_approval(5, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(recallOffer5, 'OfferRecalled');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(5),
            "Cancelled",
            "The status of the rent is not changed to 'Cancelled'"
        );
        assert.strictEqual(
            await decentralRentInstance.get_car_status_toString(4),
            "Available",
            "The status of the car is not changed to 'Available'"
        );
        console.log("RentRequest5 offer recalled by carOwner1 after 24h.");
        console.log("-**-Flow of offer recallment end.-**-");
    });

    it('5. Recall Flow', async() => {
        let platformFee_1 = await decentralRentInstance.get_platform_fee();
        let platformFee = platformFee_1.toNumber();
        console.log("=======================================================================================");
        console.log("-**-Flow of renter recall rental request start.-**-");

        // Register renter 6 and 7 
        let carRenterRegistration6 = await decentralRentInstance.register_car_renter({ from: renterAddress6 });
        truffleAssert.eventEmitted(carRenterRegistration6, 'RenterRegistered');
        console.log("Renter6 registered.");

        let carRenterRegistration7 = await decentralRentInstance.register_car_renter({ from: renterAddress7 });
        truffleAssert.eventEmitted(carRenterRegistration7, 'RenterRegistered');
        console.log("Renter7 registered.");

        // Owner 1 register car 5 and 6 
        let car5 = await decentralRentInstance.register_car("mercedes", "car5", "image1", "image2", "image3", { from: carOwnerAddress1 }); // owner 1, car 5
        truffleAssert.eventEmitted(car5, "CarRegistered");

        let car5Status = await decentralRentInstance.get_car_status_toString(5);
        assert.strictEqual(car5Status, "Registered", "Car registeration failed");
        console.log("Car5 registered by carOwner1.");

        let car6 = await decentralRentInstance.register_car("mercedes", "car6", "image1", "image2", "image3", { from: carOwnerAddress1 }); // owner 1, car 6
        truffleAssert.eventEmitted(car6, "CarRegistered");

        let car6Status = await decentralRentInstance.get_car_status_toString(6);
        assert.strictEqual(car6Status, "Registered", "Car registeration failed");
        console.log("Car6 registered by carOwner1.");

        // Owner 1 list car 5 and 6
        let car5Listing = await decentralRentInstance.list_car_for_rental(5, "collectionPoint", hourlyRentalRate, deposit, carCondition, { from: carOwnerAddress1, value: platformFee });
        truffleAssert.eventEmitted(car5Listing, "CarListed");
        car5Deposit = deposit;

        let car5NewStatus = await decentralRentInstance.get_car_status_toString(5);
        assert.strictEqual(car5NewStatus, "Available", "Car listing failed");
        console.log("Car6 listed by carOwner1.");

        let car6Listing = await decentralRentInstance.list_car_for_rental(6, "collectionPoint", hourlyRentalRate, deposit, carCondition, { from: carOwnerAddress1, value: platformFee });
        truffleAssert.eventEmitted(car6Listing, "CarListed");
        car6Deposit = deposit;

        let car6NewStatus = await decentralRentInstance.get_car_status_toString(6);
        assert.strictEqual(car6NewStatus, "Available", "Car listing failed");
        console.log("Car6 listed by carOwner1.");

        // Renter 6 apply for car 5 and 6         
        let request6 = await decentralRentInstance.submit_rental_request_with_offer(5, startDate, endDate, 20, { from: renterAddress6 });
        truffleAssert.eventEmitted(request6,
            'RentalRequestedSubmitted', (ev) => {
                return ev.renter_address === renterAddress6;
            },
            "The renter address of rent instance does not match with renterAddress1");
        truffleAssert.eventEmitted(request6, 'Notify_owner');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(6),
            "Pending",
            "The rental status should be in pending"
        );
        console.log("RentRequest6 for car5 submitted by renter6.");

        let request7 = await decentralRentInstance.submit_rental_request_with_offer(6, startDate, endDate, 20, { from: renterAddress6 });
        truffleAssert.eventEmitted(request7,
            'RentalRequestedSubmitted', (ev) => {
                return ev.renter_address === renterAddress6;
            },
            "The renter address of rent instance does not match with renterAddress1");
        truffleAssert.eventEmitted(request7, 'Notify_owner');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(7),
            "Pending",
            "The rental status should be in pending"
        );
        console.log("RentRequest7 for car6 submitted by renter6.");

        // Owner 1 approve car 5, leave 6 pending 
        let approval6 = await decentralRentInstance.approve_rental_request(6, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(approval6, 'RentalOfferApproved');
        console.log("RentRequest6 approved by carOwner1.");

        // Renter 6 recall car 5 request, unsuccessful 
        await truffleAssert.reverts(decentralRentInstance.recall_rental_request(6, { from: renterAddress6 }), " The status of this rental request is not allowed for this option.");
        console.log("RentRequest6 request recall by renter6 after it has been approved --- Failed.");

        // Renter 6 decline car 5
        let decline6 = await decentralRentInstance.decline_rental_offer(6, { from: renterAddress6 });

        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(6),
            'Cancelled',
            'The status of the rent is not updated correctly'
        );

        truffleAssert.eventEmitted(decline6, 'RentalOfferDeclined');
        truffleAssert.eventEmitted(decline6, 'Notify_owner');
        console.log("RentRequest6 offer declined by renter6.");

        // renter 6 recall car 6 request 
        let recallment1 = await decentralRentInstance.recall_rental_request(7, { from: renterAddress6 });
        truffleAssert.eventEmitted(recallment1, 'RentalRequestRecalled');
        truffleAssert.eventEmitted(recallment1, 'Notify_owner');
        console.log("RentRequest7 request recalled by renter6.");

        // renter 7 apply for car 5 
        let request8 = await decentralRentInstance.submit_rental_request_with_offer(5, startDate, endDate, 20, { from: renterAddress7 });
        truffleAssert.eventEmitted(request8,
            'RentalRequestedSubmitted', (ev) => {
                return ev.renter_address === renterAddress7;
            },
            "The renter address of rent instance does not match with renterAddress1");
        truffleAssert.eventEmitted(request8, 'Notify_owner');
        assert.strictEqual(
            await decentralRentInstance.get_rent_status_toString(8),
            "Pending",
            "The rental status should be in pending"
        );
        console.log("RentRequest8 for car5 submitted by renter7.");

        // Owner 1 offer car 5 to renter 7
        let approval8 = await decentralRentInstance.approve_rental_request(8, { from: carOwnerAddress1 });
        truffleAssert.eventEmitted(approval8, 'RentalOfferApproved');
        console.log("RentRequest8 approved by carOwner1.");

        console.log("-**-Flow of renter recall rental request end.-**-");
    });
})
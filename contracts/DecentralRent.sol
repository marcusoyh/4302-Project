pragma solidity >= 0.5.0; 

// try to optimise by using memory storage 
// try to integrate learnings from lecture 9 
// separate data storage and logic 
// satellite functions 

contract DecentralRent{
    address _owner = msg.sender;
    uint256 platformFee;
    address _support_team;    
    mapping (uint256 => car) carList; 
    mapping (uint256 => rent) rentList;
    mapping (address => carOwner) carOwnerInfo; 
    mapping (address => renter) renterList;
    mapping (uint256 => uint256) offer_dates;
    mapping (uint256 => uint256) rejection_dates;
    mapping (uint256 => issue) issueList; 
    uint256 carIdCount = 0;
    uint256 rentIdCount = 0;
    uint256 renterIDCount = 0;
    uint256 issueIDCount = 0;

    constructor(uint256 fee, address supportAddress) public {
        _support_team = supportAddress;
        platformFee = fee;
    }

    enum CarStatus {
        Registered,
        Available,
        Reserved,
        Received,
        Unavailable,
        Abnormal
    }

    enum RentalStatus {
        Pending,
        Approved,
        Rejected,
        Cancelled, 
        Ongoing,
        Completed
    } 
    //'Ongoing' when renter accept offer
    //'Cancelled' when owner recall approval/renter reject offer

    enum IssueStatus {
        Created,
        Solving,
        Solved
    }  

/***************************** STRUCTS ********************************/
    struct carOwner {
        bool verified; 
        uint256 carCount;
        uint256[] carList;
        uint256 completedRentCount;
        uint256 rating;
        uint256 ratingCount;
    }

    struct car {
        address owner;
        CarStatus carStatus;
        // (available, reserved, received, on_rent, returned, missing)
        string carPlate; // maybe can be revealed only after the rent has been confirmed;
        string carModel;
        uint256 hourlyRentalRate;
        uint256 deposit;
        uint256 carCondition; // 1-10
        uint256 availableStartDate; // in seconds, JS default
        uint256 availableEndDate;
        string collectionPoint;
        uint256[] requestedrentIdList; 
        uint256[] rentHistory;
        uint256[] rejectedrentIdList;
    }

    struct rent {
        uint256 carId;
        address renter;
        address carOwner;
        RentalStatus rentalStatus; // (pending, approved, rejected) 
        uint256 startDate;
        uint256 endDate;
        uint256 hourlyRentalRate; // Named offeredRate at submit_rental_requests, updates throughout nego
        uint256 deposit; // is fixed, no nego.
    }

    struct renter {
        bool verified;
        uint256 completedRentCount;
        uint256 totalRentCount; 
        uint256 creditScore;
        uint256 rating;
        uint256 ratingCount;
        uint256 currentCar; //Car ID if renting, 0 if not
        uint256[] rentalRequests; //Rent IDs
    }

    struct issue {
        uint256 rentId;
        address reporter;
        string details;
        string contactNumber;
        IssueStatus issueStatus;
    }

/***************************** EVENTS ********************************/
    event Notify_renter(address renter);
    event Notify_owner(address owner);

    //car owner
    event OfferRecalled(uint256 rentId);
    event CarReturned(uint256 carId);
    event CarUnlisted(uint256 carId);
    
    //car renter
    event RenterRegistered(address renter_address);
    event RentalRequestedSubmitted(address renter_address, uint256 rentId);
    event RentRequestUpdated(uint256 rentId);
    event RentalOfferAccepted(uint256 renterId, uint256 carId);
    event CarReceived(address renter_address, uint256 carId);
    event IssueReported(address reporter, uint256 rentId);
    event IssueResolved(uint256 issueId);
    event IssueReopened(uint256 issueId);

/***************************** MODIFIERS ********************************/
    modifier carOwnerOnly(address person, uint256 carId) {
        // this modifier requires the caller to be the owner of this car
        require(person == carList[carId].owner, "only verified car owner can perform this action");
        _;
    }

    modifier verifiedUserOnly(address person) {
        // this modifier requires to caller to be a verified user of DecentralRent
        require(carOwnerInfo[person].verified == true, "car owner is not verified");
        _;
    }

    modifier requestedRenter(uint256 carId, uint256 rentId) {
        // this modifier requires only when the renter submited a rental request for this car, s/he can be approved or rejected
        bool requested = false;
        uint256[] memory requests = carList[carId].requestedrentIdList;
        for (uint i=0; i<requests.length; i++) {
            if (requests[i] == rentId) {
                requested = true;
                break;
            }
        }
        require(requested == true, "renter needs to apply to rent this car first");
        _;
    }

    modifier canApprove(uint256 rentId) {
        // this modifier requires the owner to be able to approve only if he has not approved a rent in the same period
        bool approve = true;
        for (uint i=0; i<carList[rentList[rentId].carId].requestedrentIdList.length; i++) {
           if (rentList[carList[rentList[rentId].carId].requestedrentIdList[i]].rentalStatus == RentalStatus.Approved) {
                if (rentList[carList[rentList[rentId].carId].requestedrentIdList[i]].startDate >= rentList[rentId].startDate) {
                    if (rentList[carList[rentList[rentId].carId].requestedrentIdList[i]].startDate <= rentList[rentId].endDate) {
                        approve = false;
                    } else if (rentList[carList[rentList[rentId].carId].requestedrentIdList[i]].endDate <= rentList[rentId].endDate) {
                        approve = false;
                    }
                } else {
                    if (rentList[carList[rentList[rentId].carId].requestedrentIdList[i]].endDate <= rentList[rentId].endDate) {
                        approve = false;
                    }
                }         
           }     
        }
        require(approve == true, "you have already approved for this time period");
        _;
    }

    modifier rentalInStatus(uint256 rentId, RentalStatus status) {
        // this modifier requires rental in specific status
        require(rentList[rentId].rentalStatus == status, "The status of this rental request is not allowed for this option.");
        _;
    }

    modifier carInStatus(uint256 carId, CarStatus status) {
        // this modifier requires car in specific status
        require(carList[carId].carStatus == status, "The status of this car is not allowed for this option.");
        _;
    }

    function singPassVerify(address person) private pure returns(bool) {
        // this function simulates the verification through SingPass. 
        // Returns true by default. assuming the person passes real-name identification and driving license check
        bool singPass = false;
        if (person != address(0)) {
            singPass = true;
        }
        return singPass;
    }

    function singPassVerifyCar(address person, string memory carModel, string memory carPlate) private pure returns(bool){
        // this function simulates the verification of car ownership and model through SingPass. 
        // Returns true by default.
        bool singPassCar = false;
        if (person != address(0)) {
            singPassCar = true;
        }
        return singPassCar;
    }
    
//car owner 
    // xb
    function register_car_owner() public {
        // never use carOwner struct to register?
        require(carOwnerInfo[msg.sender].verified == false, "car owner has already been registered");
        if(singPassVerify(msg.sender)) {
            carOwnerInfo[msg.sender].verified = true;
        }
    }

    function register_car(string memory carModel, string memory carPlate) public verifiedUserOnly(msg.sender) {
        // require verification of car
        require(singPassVerifyCar(msg.sender, carModel, carPlate) == true, "car does not pass verification"); 
        // create new car struct
        uint256[] memory requestedrentIdList;
        uint256[] memory rentHistory;
        uint256[] memory rejectedList;
        carList[carIdCount] = car(msg.sender, CarStatus.Registered, carPlate, carModel, 0, 0, 0, 0, 0, "", requestedrentIdList, rentHistory, rejectedList);
        carOwnerInfo[msg.sender].carList.push(carIdCount);
        carOwnerInfo[msg.sender].carCount += 1;
        carIdCount += 1;
    }


    // xinyi
    function list_car_for_rental(uint256 carId, uint256 availableStartDate, uint256 availableEndDate, string memory collectionPoint, uint256 hourlyRentalRate, uint256 deposit, uint256 carCondition) 
        public carOwnerOnly(msg.sender, carId) carInStatus(carId, CarStatus.Registered) {

        // add information to the car struct
        carList[carId].availableStartDate = availableStartDate;
        carList[carId].availableEndDate = availableEndDate;
        carList[carId].collectionPoint = collectionPoint;
        carList[carId].deposit = deposit;
        carList[carId].hourlyRentalRate = hourlyRentalRate;
        carList[carId].carCondition = carCondition;
        carList[carId].carStatus = CarStatus.Available;
    }

    function update_listed_car_info(uint256 carId, uint256 hourlyRentalRate, uint256 deposit, uint256 availableStartDate, uint256 availableEndDate, string memory collectionPoint) 
        public carOwnerOnly(msg.sender, carId) carInStatus(carId, CarStatus.Available) {
        
        //modify information in the car struct
        carList[carId].availableStartDate = availableStartDate;
        carList[carId].availableEndDate= availableEndDate;
        carList[carId].collectionPoint = collectionPoint;
        carList[carId].deposit = deposit;
        carList[carId].hourlyRentalRate = hourlyRentalRate;
    }

    function approve_rental_request(uint256 rentId) public carOwnerOnly(msg.sender, rentList[rentId].carId) requestedRenter(rentList[rentId].carId, rentId) canApprove(rentId){
        // change the request status of the rent contract to be approved 
        rentList[rentId].rentalStatus = RentalStatus.Approved;
        offer_dates[rentId] = block.timestamp;

        // change the request status of the rest of the rent inside the request list to be rejected
        //for (uint i=0; i<registeredCarList[rentList[rentId].carId].requestedrentIdList.length; i++) {
        //   if (registeredCarList[rentList[rentId].carId].requestedrentIdList[i] != rentId) {
        //        rentList[registeredCarList[rentList[rentId].carId].requestedrentIdList[i]].rentalStatus = RentalStatus.Rejected;
                // delete rentList[registeredCarList[rentList[rentId].carId].requestedrentIdList[i]];
        //   /}     
        //}
    } // delete all id related to this car after the car return 

    function reject_rental_request(uint256 rentId) public carOwnerOnly(msg.sender, rentList[rentId].carId) requestedRenter(rentList[rentId].carId, rentId) {
        rentList[rentId].rentalStatus = RentalStatus.Rejected;

        // record the rejected requests of this car in a list
        // and record the rejection time
        // the rejected rent request will be deleted from storage if it's over 24h
        rejection_dates[rentId] = block.timestamp;
        carList[rentList[rentId].carId].rejectedrentIdList.push(rentId);
        // delete rentList[rentId];
    }

    // yitong
    function unlist_car(uint256 carId) public carOwnerOnly(msg.sender, carId) carInStatus(carId, CarStatus.Available) {
        carList[carId].carStatus = CarStatus.Unavailable;

        emit CarUnlisted(carId);
    }

    function offer_pending_1day(uint256 rentId) internal view returns (bool) {
        //auto-depre for recall approval
        return block.timestamp > offer_dates[rentId] + 1 days;
    }

    function recall_approval(uint256 rentId) public carOwnerOnly(msg.sender, rentList[rentId].carId) rentalInStatus(rentId, RentalStatus.Approved){
        require(offer_pending_1day(rentId), "You can only recall it after 24h since your approval.");
        //change rent request status and car status
        carList[rentList[rentId].carId].carStatus = CarStatus.Available;
        rentList[rentId].rentalStatus = RentalStatus.Cancelled;

        emit OfferRecalled(rentId);
    }

    function request_rejected_1day(uint256 rentId) internal view returns (bool) {
        //auto-depre for deletion of rejected rental request
        return block.timestamp > rejection_dates[rentId] + 1 days;
    }

    function confirm_car_returned(uint256 rentId) public carOwnerOnly(msg.sender, rentList[rentId].carId) {
        // change car status to returned
        carList[rentList[rentId].carId].carStatus = CarStatus.Available;
        
        // add rent to car's rentHistory
        carList[rentList[rentId].carId].rentHistory.push(rentId);
        
        // delete those rental request of this car that are rejected over 24h ago
        uint256[] memory newRejectedRentList;
        uint256 j = 0; // temporary index for memory array newRejectedRentList
        for (uint i=0; i<carList[rentList[rentId].carId].rejectedrentIdList.length; i++) {
            if (request_rejected_1day(carList[rentList[rentId].carId].rejectedrentIdList[i])) {
                // loop thru the existing rejected rent of this car
                // delete the corresponding rent struct if it has been rejected over 24h ago
                delete rentList[carList[rentList[rentId].carId].rejectedrentIdList[i]];
            } else {
                // if not over 24h, keep the rent id in the rejection list
                newRejectedRentList[j] = (carList[rentList[rentId].carId].rejectedrentIdList[i]);
                j++;
            }
        }
        // update the rejected list, remove those id we've alr deleted
        carList[rentList[rentId].carId].rejectedrentIdList = newRejectedRentList;
        
        // change rent status
        rentList[rentId].rentalStatus = RentalStatus.Completed;
        
        // update renter score 
        address renteradd = rentList[rentId].renter;
        renterList[renteradd].completedRentCount ++;
        renterList[renteradd].totalRentCount ++;
        renterList[renteradd].creditScore = renterList[renteradd].completedRentCount/renterList[renteradd].totalRentCount * 100; //maximum 100 marks
        
        // transfer deposit back to renter
        address payable recipient = address(uint160(renteradd));
        uint256 dep = carList[rentList[rentId].carId].deposit;
        recipient.transfer(dep);

        // update car owner completedRentCount also
        address owneradd = rentList[rentId].carOwner;
        carOwnerInfo[owneradd].completedRentCount ++;

        emit CarReturned(rentList[rentId].carId);
    }

    
/***************************** CAR RENTER ********************************/
//car renter -> guys 
    function register_car_renter(address renter_address) public {
        require(singPassVerify(renter_address));
        require(renterList[renter_address].verified == false, "car renter has already been registered");
        uint256[] memory rentalRequests;
        renter memory newRenter = renter(
            true,
            0,
            0,
            0,
            0,
            0,
            0,
            rentalRequests
        );

        
        emit RenterRegistered(renter_address);
    }

    // struct renter {
    //     address renter_address;
    //     uint256 completedRentCount;
    //     uint256 totalRentCount; 
    //     uint256 creditScore;
    //     uint8 rating;
    //     uint256 ratingCount;
    //     uint256 currentCar; //Car ID if renting, 0 if not
    //     uint256[] rentalRequests; //Rent IDs
    // }
    
    // for the renter to quickly make rent request using LISTING PRICE
    function submit_rental_request(address renter_address , uint256 carId, uint256 startDate,uint256 endDate) public returns (uint256) {
        submit_rental_request(renter_address, carId, startDate, endDate, carList[carId].hourlyRentalRate);
    }


    // if renter wants to offer a different price from listing
    function submit_rental_request(address renter_address , uint256 carId, uint256 startDate,uint256 endDate, uint256 offeredRate) public returns (uint256) {
        /**
        car renters can submit multiple rental requests

        rental request must have a way of expiring -> should include the start and end date of
        car rental, after rental offer accepted, only other requests with overlapping dates should expire

        this logic can be handled in decentralrent smart contract, rental requests can be modelled as a struct
        */
        //require(car to be listed)
        require(renter_address != address(0));
        renter memory currentRenter = renterList[renter_address]; 

        // make a new list of requests to append our new rentId in
        //uint256[] memory oldRequests = currentRenter.rentalRequests;
        //uint256 newRequestSize = oldRequests.length + 1;
        //uint256[] memory newRequests = new uint256[](newRequestSize);
        //for(uint i = 0; i < oldRequests.length; i++) {
        //    newRequests[i] = oldRequests[i];   
        //}
        // currentRenter.rentalRequests.push(carId);


        // create a new rent ID to put into renter struct
        
        //rentList[newrentId] = rentIdCount;
        //newRequests[oldRequests.length] = newrentId;
        //currentRenter.rentalRequests = newRequests;
        
        uint256 newrentId = rentIdCount++;
        // currentRenter.rentalRequests.push(newrentId);
        
        // creating our new rent struct and put into rentList
        rent memory newRentInstance = rent(
            carId,
            renter_address,
            carList[carId].owner,
            RentalStatus.Pending, // (pending, approved, rejected) 
            startDate,
            endDate,
            offeredRate,
            carList[carId].deposit
        );
        rentList[newrentId] = newRentInstance;

        
        emit RentalRequestedSubmitted(renter_address,newrentId);
        emit Notify_owner(carList[carId].owner);

        return newrentId;
    }
    

    function accept_rental_offer(uint256 rentId) public payable {
        rent memory rentInstance = rentList[rentId];
        require(rentInstance.renter == msg.sender, "This offer does not belong to you");
        require(rentInstance.rentalStatus == RentalStatus.Approved, "Offer not approved yet by car owner");

        // WE TAKE RENTAL PRICE + DEPOSIT FROM RENTER NOW
        // NEED FIND A WAY TO CALCULATE TOTAL HOURS ELAPSED
        // uint256 hoursElapsed = 3; //hardcoded first
        uint256 hoursElapsed = rentInstance.endDate - rentInstance.startDate * 60 * 60; 
        uint256 ethToPay = rentInstance.hourlyRentalRate * hoursElapsed + rentInstance.deposit;
        require(msg.value >= ethToPay, "Please transfer enough Eth to pay for rental");

        rentInstance.rentalStatus = RentalStatus.Ongoing;        

        emit RentalOfferAccepted(rentId, rentInstance.carId);
        emit Notify_owner(rentInstance.carOwner);

        if (msg.value > ethToPay) {
            // transfer back remaining Eth
            // address payable recipient = payable(msg.sender);
            address payable recipient = address(uint160(msg.sender));


            recipient.transfer(msg.value - ethToPay);
        }

        delete renterList[rentList[rentId].renter].rentalRequests;   //need to check if this works -- work around is each renter can only requests for max three requests at a time, array initialized at fix size of 0,3   
    }

    function update_rental_request(uint256 rentId, uint256 startDate,uint256 endDate, uint256 offeredRate, uint256 deposit) public carInStatus(rentList[rentId].carId, CarStatus.Available) rentalInStatus(rentId, RentalStatus.Pending) {
        require(msg.sender == rentList[rentId].renter, "You are not the owner of this rental request.");
        rentList[rentId].startDate = startDate;
        rentList[rentId].endDate = endDate;
        rentList[rentId].hourlyRentalRate = offeredRate;
        rentList[rentId].deposit = deposit;

        emit RentRequestUpdated(rentId);
    }
    
    function confirm_car_received(uint256 rentId) public {
        require(msg.sender == rentList[rentId].renter);
        address renter_address = msg.sender;
        // require(renterList[renter_address].renter_address == msg.sender);

        renter memory currentRenter = renterList[renter_address];
        
        uint256[] memory rentalRequests;
        currentRenter.rentalRequests = rentalRequests; //clear all other existing rental requests
        

        currentRenter.currentCar = rentList[rentId].carId;
        
        emit CarReceived(renter_address, rentId);
        
        // TRANSFER THE RENTAL PRICE TO OWNER
        rent memory rentInstance = rentList[rentId];
        // address payable recipient = payable(rentInstance.carOwner);
        address payable recipient = address(uint160(rentInstance.carOwner));

        
        
        // uint256 hoursElapsed = 3; //hardcoded first
        uint256 hoursElapsed = rentInstance.endDate - rentInstance.startDate * 60 * 60; 
        uint256 ethToPay = rentInstance.hourlyRentalRate * hoursElapsed;
        recipient.transfer(ethToPay);
    }
    
/***************************** COMMON FUNCTIONS ********************************/
    function leaveRating(uint256 rentId, uint256 rating) public rentalInStatus(rentId, RentalStatus.Completed){
        require(msg.sender == rentList[rentId].renter || msg.sender == rentList[rentId].carOwner, "You are not involved in this rental.");
        require(rating <= 5 && rating >=0, "Rating has to be between 0 and 5!");
        // update the owner / renter struct value 
        if (msg.sender == rentList[rentId].renter) {
            address rater_address = rentList[rentId].carOwner;
            carOwnerInfo[rater_address].rating = (carOwnerInfo[rater_address].rating * carOwnerInfo[rater_address].ratingCount + rating)/(carOwnerInfo[rater_address].ratingCount + 1);
            carOwnerInfo[rater_address].ratingCount++;
        }

        if (msg.sender == rentList[rentId].carOwner) {
            address rater_address = rentList[rentId].renter;
            renterList[rater_address].rating = (renterList[rater_address].rating * renterList[rater_address].ratingCount + rating)/(carOwnerInfo[rater_address].ratingCount + 1);
            renterList[rater_address].ratingCount++;
        }
    } 

//support team 

    // common for both
    function report_issues(uint256 rentId, string memory details, string memory contact) public rentalInStatus(rentId, RentalStatus.Ongoing) {
        //CHECK IF OWNER OR RENTER
        rent memory currentRent = rentList[rentId];
        address car_owner = currentRent.carOwner;
        address car_renter = currentRent.renter;

        require(msg.sender == car_owner || msg.sender == car_renter, "Issue does not involve you!");

        issueList[issueIDCount] = issue(rentId, msg.sender, details, contact, IssueStatus.Created);
        issueIDCount += 1;

        emit IssueReported(msg.sender, rentId);
        emit Notify_owner(currentRent.carOwner);
        emit Notify_renter(currentRent.renter); 
    }

    function resolve_issue(uint256 issueId) public {
        require(msg.sender == _support_team);
        issue memory issueInstance = issueList[issueId];
        issueInstance.issueStatus = IssueStatus.Solved;

        rent memory currentRent = rentList[issueInstance.rentId];
        emit Notify_owner(currentRent.carOwner);
        emit Notify_renter(currentRent.renter); 
        emit IssueResolved(issueId);
    }

    function reopen_issue(uint256 issueId) public {
        // could be renter or owner?
        uint256 rentId = issueList[issueId].rentId;
        rent memory currentRent = rentList[rentId];
        address car_owner = currentRent.carOwner;
        address car_renter = currentRent.renter;

        require(msg.sender == car_owner || msg.sender == car_renter, "Issue does not involve you!");

        issueList[issueId].issueStatus = IssueStatus.Created;

        // events
        emit IssueReopened(issueId);
        emit Notify_owner(currentRent.carOwner);
        emit Notify_renter(currentRent.renter); 
    }




    // getters
    function get_owner_rating(address userId) public view returns (uint256) {
        // return carOwnerInfo[owner].cumulativeRating / carOwnerInfo[owner].completedRentCount;
        return carOwnerInfo[userId].rating;
    }

    function get_renter_rating(address userId) public view returns (uint256) {
        // return renterList[renter].cumulativeRating / renterList[renter].completedRentCount;
        return renterList[userId].rating;
    }

    function get_car_count(address owner) public view returns(uint256) {
        return carOwnerInfo[owner].carCount;
    }

    function get_cars_owned(address owner) public view returns(uint256[] memory) {
        return carOwnerInfo[owner].carList;
    }

    function get_car_hourly_rental(uint256 carId) public view returns(uint256) {
        return carList[carId].hourlyRentalRate;
    }

    function get_car_model(uint256 carId) public view returns(string memory) {
        return carList[carId].carModel;
    }

    function get_car_deposit(uint256 carId) public view returns(uint256) {
        return carList[carId].deposit;
    }

    function get_car_owner(uint256 carId) public view returns(address) {
        return carList[carId].owner;
    }

    function get_car_available_start_date(uint256 carId) public view returns(uint256) {
        return carList[carId].availableStartDate;
    }

    function get_car_available_end_date(uint256 carId) public view returns(uint256 ) {
        return carList[carId].availableEndDate;
    }

    function get_car_requested_rent_IDs(uint256 carId) public view returns(uint256[] memory) {
        return carList[carId].requestedrentIdList;
    }

    function get_car_collection_point(uint256 carId) public view returns(string memory) {
        return carList[carId].collectionPoint;
    }

    function get_car_status(uint256 carId) public view returns(CarStatus) {
        return carList[carId].carStatus;
    }

    function get_rent_start_date(uint256 rentId) public view returns(uint256) {
        return rentList[rentId].startDate;
    }

    function get_rent_end_date(uint256 rentId) public view returns(uint256) {
        return rentList[rentId].endDate;
    }

    function get_rent_carId(uint256 rentId) public view returns(uint256) {
        return rentList[rentId].carId;
    }

    function get_rent_renter(uint256 rentId) public view returns(address) {
        return rentList[rentId].renter;
    }

    function get_rent_status(uint256 rentId) public view returns(RentalStatus) {
        return rentList[rentId].rentalStatus;
    }
    

}
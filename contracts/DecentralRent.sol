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
    mapping (uint256 => issue) issueList; 
    uint256 carIDCount = 0;
    uint256 rentIDCount = 0;
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
        uint8 rating;
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
        uint256 availableStartDate; // 202202102300 > 202201301000
        uint256 availableEndDate;
        string collectionPoint;
        uint256[] requestedRentIDList; 
        uint256[] rentHistory;
    }

    struct rent {
        uint256 carID;
        address renter;
        address carOwner;
        RentalStatus rentalStatus; // (pending, approved, rejected) 
        uint256 startDate;
        uint256 endDate;
        uint256 hourlyRentalRate; // Named offeredRate at submit_rental_requests, updates throughout nego
        uint256 deposit; // is fixed, no nego.
    }

    struct renter {
        address renter_address;
        uint256 completedRentCount;
        uint256 totalRentCount; 
        uint256 creditScore;
        uint8 rating;
        uint256 ratingCount;
        uint256 currentCar; //Car ID if renting, 0 if not
        uint256[] rentalRequests; //Rent IDs
    }

    struct issue {
        uint256 rentID;
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
    event RenterRegistered(uint256 renterId);
    event RentalRequestedSubmitted(uint256 renterId, uint256 rentId);
    event RentRequestUpdated(uint256 rentId);
    event RentalOfferAccepted(uint256 renterId, uint256 carId);
    event CarReceived(uint256 renterId, uint256 carId);
    event IssueReported(address reporter, uint256 rentId);
    event IssueResolved(uint256 issueId);
    event IssueReopened(uint256 issueId);

/***************************** MODIFIERS ********************************/
    modifier carOwnerOnly(address person, uint256 carID) {
        // this modifier requires the caller to be the owner of this car
        require(person == carList[carID].owner, "only verified car owner can perform this action");
        _;
    }

    modifier verifiedUserOnly(address person) {
        // this modifier requires to caller to be a verified user of DecentralRent
        require(carOwnerInfo[person].verified == true, "car owner is not verified");
        _;
    }

    modifier requestedRenter(uint256 carID, uint256 rentID) {
        // this modifier requires only when the renter submited a rental request for this car, s/he can be approved or rejected
        bool requested = false;
        uint256[] memory requests = carList[carID].requestedRentIDList;
        for (uint i=0; i<requests.length; i++) {
            if (requests[i] == rentID) {
                requested = true;
                break;
            }
        }
        require(requested == true, "renter needs to apply to rent this car first");
        _;
    }

    modifier canApprove(uint256 rentID) {
        // this modifier requires the owner to be able to approve only if he has not approved a rent in the same period
        bool approve = true;
        for (uint i=0; i<carList[rentList[rentID].carID].requestedRentIDList.length; i++) {
           if (rentList[carList[rentList[rentID].carID].requestedRentIDList[i]].rentalStatus == RentalStatus.Approved) {
                if (rentList[carList[rentList[rentID].carID].requestedRentIDList[i]].startDate >= rentList[rentID].startDate) {
                    if (rentList[carList[rentList[rentID].carID].requestedRentIDList[i]].startDate <= rentList[rentID].endDate) {
                        approve = false;
                    } else if (rentList[carList[rentList[rentID].carID].requestedRentIDList[i]].endDate <= rentList[rentID].endDate) {
                        approve = false;
                    }
                } else {
                    if (rentList[carList[rentList[rentID].carID].requestedRentIDList[i]].endDate <= rentList[rentID].endDate) {
                        approve = false;
                    }
                }         
           }     
        }
        require(approve == true, "you have already approved for this time period");
        _;
    }

    modifier rentalInStatus(uint256 rentID, RentalStatus status) {
        // this modifier requires rental in specific status
        require(rentList[rentID].rentalStatus == status, "The status of this rental request is not allowed for this option.");
        _;
    }

    modifier carInStatus(uint256 carID, CarStatus status) {
        // this modifier requires car in specific status
        require(carList[carID].carStatus == status, "The status of this car is not allowed for this option.");
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
        uint256[] memory requestedRentIDList;
        uint256[] memory rentHistory;
        carList[carIDCount] = car(msg.sender, CarStatus.Registered, carPlate, carModel, 0, 0, 0, 0, 0, "", requestedRentIDList, rentHistory);
        carOwnerInfo[msg.sender].carList.push(carIDCount);
        carOwnerInfo[msg.sender].carCount += 1;
        carIDCount += 1;
    }


    // xinyi
    function list_car_for_rental(uint256 carID, uint256 availableStartDate, uint256 availableEndDate, string memory collectionPoint, uint256 hourlyRentalRate, uint256 deposit, uint256 carCondition) 
        public carOwnerOnly(msg.sender, carID) carInStatus(carID, CarStatus.Registered) {

        // add information to the car struct
        carList[carID].availableStartDate = availableStartDate;
        carList[carID].availableEndDate = availableEndDate;
        carList[carID].collectionPoint = collectionPoint;
        carList[carID].deposit = deposit;
        carList[carID].hourlyRentalRate = hourlyRentalRate;
        carList[carID].carCondition = carCondition;
        carList[carID].carStatus = CarStatus.Available;
    }

    function update_listed_car_info(uint256 carID, uint256 hourlyRentalRate, uint256 deposit, uint256 availableStartDate, uint256 availableEndDate, string memory collectionPoint) 
        public carOwnerOnly(msg.sender, carID) carInStatus(carID, CarStatus.Available) {
        
        //modify information in the car struct
        carList[carID].availableStartDate = availableStartDate;
        carList[carID].availableEndDate= availableEndDate;
        carList[carID].collectionPoint = collectionPoint;
        carList[carID].deposit = deposit;
        carList[carID].hourlyRentalRate = hourlyRentalRate;
    }

    function approve_rental_request(uint256 rentID) public carOwnerOnly(msg.sender, rentList[rentID].carID) requestedRenter(rentList[rentID].carID, rentID) canApprove(rentID){
        // change the request status of the rent contract to be approved 
        rentList[rentID].rentalStatus = RentalStatus.Approved;
        offer_dates[rentID] = block.timestamp;

        // change the request status of the rest of the rent inside the request list to be rejected
        //for (uint i=0; i<registeredCarList[rentList[rentID].carID].requestedRentIDList.length; i++) {
        //   if (registeredCarList[rentList[rentID].carID].requestedRentIDList[i] != rentID) {
        //        rentList[registeredCarList[rentList[rentID].carID].requestedRentIDList[i]].rentalStatus = RentalStatus.Rejected;
                // delete rentList[registeredCarList[rentList[rentID].carID].requestedRentIDList[i]];
        //   /}     
        //}
    } // delete all id related to this car after the car return 

    function reject_rental_request(uint256 rentID) public carOwnerOnly(msg.sender, rentList[rentID].carID) requestedRenter(rentList[rentID].carID, rentID) {
        rentList[rentID].rentalStatus = RentalStatus.Rejected;
        // delete rentList[rentID];
    }

    // yitong
    function unlist_car(uint256 carID) public carOwnerOnly(msg.sender, carID) carInStatus(carID, CarStatus.Available) {
        carList[carID].carStatus = CarStatus.Unavailable;

        emit CarUnlisted(carID);
    }

    function offer_pending_1day(uint256 rentID) internal view returns (bool) {
        //auto-depre for recall approval
        return block.timestamp > offer_dates[rentID] + 1 days;
    }

    function recall_approval(uint256 rentID) public carOwnerOnly(msg.sender, rentList[rentID].carID) rentalInStatus(rentID, RentalStatus.Approved){
        require(offer_pending_1day(rentID), "You can only recall it after 24h since your approval.");
        //change rent request status and car status
        carList[rentList[rentID].carID].carStatus = CarStatus.Available;
        rentList[rentID].rentalStatus = RentalStatus.Cancelled;

        emit OfferRecalled(rentID);
    }

    function confirm_car_returned(uint256 rentID) public carOwnerOnly(msg.sender, rentList[rentID].carID) {
        // change car status to returned
        carList[rentList[rentID].carID].carStatus = CarStatus.Available;
        // add rent to car's rentHistory
        carList[rentList[rentID].carID].rentHistory.push(rentID);
        // change rent status
        rentList[rentID].rentalStatus = RentalStatus.Completed;
        // update renter score 
        address renteradd = rentList[rentID].renter;
        renterList[renteradd].completedRentCount ++;
        renterList[renteradd].totalRentCount ++;
        renterList[renteradd].creditScore = renterList[renteradd].completedRentCount/renterList[renteradd].totalRentCount * 100; //maximum 100 marks
        // transfer deposit back to renter
        address payable recipient = payable(renteradd);
        uint256 dep = carList[rentList[rentID].carID].deposit;
        recipient.transfer(dep);

        emit CarReturned(rentList[rentID].carID);
    }

    
/***************************** CAR RENTER ********************************/
//car renter -> guys 
    function register_car_renter(address renter_address) private returns (uint256) {
        uint256[] memory rentalRequests;
        renter memory newRenter = renter(
            renter_address,
            0,
            0,
            rentalRequests
        );

        uint256 newRenterId = renterIDCount++;
        renterList[newRenterId] = newRenter;
        
        emit RenterRegistered(newRenterId);
        return newRenterId;
    }
    
    // for the renter to quickly make rent request using LISTING PRICE
    function submit_rental_request(uint256 renterId , uint256 carId, uint256 startDate,uint256 endDate) public returns (uint256) {
        submit_rental_request(renterId, carId, startDate, endDate, carList[carId].hourlyRentalRate);
    }


    // if renter wants to offer a different price from listing
    function submit_rental_request(uint256 renterId , uint256 carId, uint256 startDate,uint256 endDate, uint256 offeredRate) public returns (uint256) {
        /**
        car renters can submit multiple rental requests

        rental request must have a way of expiring -> should include the start and end date of
        car rental, after rental offer accepted, only other requests with overlapping dates should expire

        this logic can be handled in decentralrent smart contract, rental requests can be modelled as a struct
        */
        //require(car to be listed)
        require(renterList[renterId].renter_address != address(0));
        renter memory currentRenter = renterList[renterId]; 

        // make a new list of requests to append our new rentID in
        //uint256[] memory oldRequests = currentRenter.rentalRequests;
        //uint256 newRequestSize = oldRequests.length + 1;
        //uint256[] memory newRequests = new uint256[](newRequestSize);
        //for(uint i = 0; i < oldRequests.length; i++) {
        //    newRequests[i] = oldRequests[i];   
        //}
        // currentRenter.rentalRequests.push(carId);


        // create a new rent ID to put into renter struct
        
        //rentList[newRentId] = rentIDCount;
        //newRequests[oldRequests.length] = newRentId;
        //currentRenter.rentalRequests = newRequests;
        
        uint256 newRentId = rentIDCount++;
        currentRenter.rentalRequests.push(newRentId);
        
        // creating our new rent struct and put into rentList
        rent memory newRentInstance = rent(
            carId,
            renterList[renterId].renter_address,
            carList[carId].owner,
            RentalStatus.Pending, // (pending, approved, rejected) 
            startDate,
            endDate,
            offeredRate,
            carList[carId].deposit
        );
        rentList[newRentId] = newRentInstance;

        
        emit RentalRequestedSubmitted(renterId,newRentId);
        emit Notify_owner(carList[carId].owner);

        return newRentId;
    }
    
    function accept_rental_offer(uint256 rentId) public {
        rent memory rentInstance = rentList[rentId];
        require(rentInstance.renter == msg.sender, "This offer does not belong to you");
        require(rentInstance.approved, "Offer not approved yet by car owner");

        rentInstance.accepted = true;

        delete renterList[rentList[rentId].renter].rentalRequests;   //need to check if this works -- work around is each renter can only requests for max three requests at a time, array initialized at fix size of 0,3   

        emit RentalOfferAccepted(rentId, rentInstance.carId);
        emit Notify_owner(rentInstance.carOwner);

        // TRANSFER RENTAL PRICE + DEPOSIT FROM RENTER TO THIS CONTRACT

    }

    function update_rental_request(uint256 rentID, uint256 startDate,uint256 endDate, uint256 offeredRate, uint256 deposit) public carInStatus(rentList[rentID].carID, CarStatus.Available) rentalInStatus(rentID, RentalStatus.Pending) {
        require(msg.sender == rentList[rentID].renter, "You are not the owner of this rental request.");
        rentList[rentID].startDate = startDate;
        rentList[rentID].endDate = endDate;
        rentList[rentID].hourlyRentalRate = offeredRate;
        rentList[rentID].deposit = deposit;

        emit RentRequestUpdated(rentID);
    }
    
    function confirm_car_received(uint256 renterId, uint256 rentID) public {
        require(renterList[renterId].renter_address == rentList[rentID].renter);
        require(renterList[renterId].renter_address == msg.sender);

        renter memory currentRenter = renterList[renterId];
        
        currentRenter.rentalRequests = uint256[]; //clear all other existing rental requests

        currentRenter.currentCar = rentList[rentID].carId;
        
        emit CarReceived(renterId, rentID);
        
        // TRANSFER THE RENTAL PRICE TO OWNER
    }
    
/***************************** COMMON FUNCTIONS ********************************/
    function leaveRating(uint256 rentID, uint8 rating) public rentalInStatus(rentID, RentalStatus.Completed){
        require(msg.sender == rentList[rentID].renter || msg.sender == rentList[rentID].carOwner, "You are not involved in this rental.");
        // update the owner / renter struct value 
        if (msg.sender == rentList[rentID].renter) {
            uint256 ratedId = rentList[rentID].carOwner;
            carOwnerInfo[ratedId].rating = (carOwnerInfo[ratedId].rating * carOwnerInfo[ratedId].ratingCount + rating)/(carOwnerInfo[ratedId].ratingCount + 1);
            carOwnerInfo[ratedId].ratingCount++;
        }

        if (msg.sender == rentList[rentID].carOwner) {
            uint256 ratedId = rentList[rentID].renter;
            renterList[ratedId].rating = (renterList[ratedId].rating * renterList[ratedId].ratingCount + rating)/(carOwnerInfo[ratedId].ratingCount + 1);
            renterList[ratedId].ratingCount++;
        }
    } 

//support team 

    // common for both
    function report_issues(uint256 rentID, string memory details, string memory contact) public rentalInStatus(rentID, RentalStatus.Ongoing) {
        //CHECK IF OWNER OR RENTER
        rent memory currentRent = rentList[rentID];
        address car_owner = currentRent.carOwner;
        address car_renter = currentRent.renter;

        require(msg.sender == car_owner || msg.sender == car_renter, "Issue does not involve you!");

        issueList[issueIDCount] = issue(rentID, msg.sender, details, contact, IssueStatus.Created);
        issueIDCount += 1;

        emit IssueReported(msg.sender, rentID);
        emit Notify_owner(currentRent.carOwner);
        emit Notify_renter(currentRent.renter); 
    }

    function resolve_issue(uint256 issueId) public {
        require(msg.sender == _support_team);
        issue = issueList[issueId];
        issue.state = IssueStatus.Solved;

        rent memory currentRent = rentList[issue.rentId];
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

        issueList[issueId].state = IssueStatus.Created;

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

    function get_car_hourly_rental(uint256 carID) public view returns(uint256) {
        return carList[carID].hourlyRentalRate;
    }

    function get_car_model(uint256 carID) public view returns(string memory) {
        return carList[carID].carModel;
    }

    function get_car_deposit(uint256 carID) public view returns(uint256) {
        return carList[carID].deposit;
    }

    function get_car_owner(uint256 carID) public view returns(address) {
        return carList[carID].owner;
    }

    function get_car_available_start_date(uint256 carID) public view returns(string memory) {
        return carList[carID].availableStartDate;
    }

    function get_car_available_end_date(uint256 carID) public view returns(string memory) {
        return carList[carID].availableEndDate;
    }

    function get_car_requested_rent_IDs(uint256 carID) public view returns(uint256[] memory) {
        return carList[carID].requestedRentIDList;
    }

    function get_car_collection_point(uint256 carID) public view returns(string memory) {
        return carList[carID].collectionPoint;
    }

    function get_car_status(uint256 carID) public view returns(CarStatus) {
        return carList[carID].carStatus;
    }

    function get_rent_start_date(uint256 rentID) public view returns(string memory) {
        return rentList[rentID].startDate;
    }

    function get_rent_end_date(uint256 rentID) public view returns(string memory) {
        return rentList[rentID].endDate;
    }

    function get_rent_carID(uint256 rentID) public view returns(uint256) {
        return rentList[rentID].carID;
    }

    function get_rent_renter(uint256 rentID) public view returns(address) {
        return rentList[rentID].renter;
    }

    function get_rent_status(uint256 rentID) public view returns(RentalStatus) {
        return rentList[rentID].rentalStatus;
    }
    

}
pragma solidity >= 0.5.0; 

contract DecentralRent{
    address _owner = msg.sender;
    uint256 platformFee;
    uint256 commissionPercent; // records the percentage of commission to be charged upon every deal. e.g. 2 means 2%
    address _support_team;    
    mapping (uint256 => car) carList; 
    mapping (uint256 => rent) rentList;
    mapping (address => carOwner) carOwnerInfo; 
    mapping (address => renter) renterList;
    mapping (uint256 => uint256) offer_dates;
    mapping (uint256 => uint256) cancellation_dates;
    mapping (uint256 => uint256) issue_resolved_dates;
    mapping (uint256 => uint256) request_submitted_dates;
    mapping (uint256 => issue) issueList; 
    uint256 carIdCount = 0;
    uint256 rentIdCount = 0;
    uint256 renterIDCount = 0;
    uint256 issueIDCount = 0;

    constructor(uint256 fee, uint256 percentage, address supportAddress) public {
        _support_team = supportAddress;
        platformFee = fee;
        commissionPercent = percentage;
    }

    enum CarStatus {
        Registered,
        Available,
        Received,
        Abnormal
    }

    enum RentalStatus {
        Pending,
        Approved,
        Rejected,
        Cancelled, 
        Ongoing,
        Completed,
        Abnormal
    } 
    //'Ongoing' when renter accept offer
    //'Cancelled' when owner recall approval/renter reject offer

    enum IssueStatus {
        Created,
        Solving,
        Solved,
        Rejected
    }  

/***************************** STRUCTS ********************************/
    struct carOwner {
        bool verified; 
        uint256 carCount;
        uint256[] carList;
        uint256 completedRentCount;
        uint256 totalRentCount;
        uint256 carConditionDescription;
        uint256 attitude;
        uint256 responseSpeed;
        uint256 ratingCount;
        uint256 creditScore;
        uint256[] rentalRequests; //Rent IDs
        uint256[] issueList;
    }

    struct car {
        address owner;
        CarStatus carStatus;
        // (available, received, on_rent, returned, missing)
        string carPlate; // maybe can be revealed only after the rent has been confirmed;
        string carModel;
        string imageURL1;
        string imageURL2;
        string imageURL3;
        uint256 hourlyRentalRate;
        uint256 deposit;
        uint256 carCondition; // 1-10
        string collectionPoint;
        uint256[] requestedrentIdList; 
        uint256[] rentHistory;
        uint256[] cancelledRentIdList;
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
        bool penaliseRenter;
        bool penaliseOwner;
    }

    struct renter {
        bool verified;
        uint256 completedRentCount;
        uint256 totalRentCount; 
        uint256 creditScore;
        uint256 carConditionMaintaining;
        uint256 attitude;
        uint256 responseSpeed;
        uint256 ratingCount;
        uint256[] currentCars; //Ongoing car IDs
        uint256[] rentalRequests; //Rent IDs
        uint256[] issueList;
    }

    struct issue {
        uint256 rentId;
        address reporter;
        string details;
        string contactNumber;
        string proofImageUrl;
        IssueStatus issueStatus;
    }

/***************************** EVENTS ********************************/
    event Notify_renter(address renter);
    event Notify_owner(address owner);

    //car owner
    event CarOwnerRegistered(address carOwner);
    event CarRegistered(uint256 carId);
    event CarListed(uint256 carId);
    event RentalOfferApproved(uint256 rentId);
    event RentalRequestRejected(uint256 rentId);
    event OfferRecalled(uint256 rentId);
    event CarReturned(uint256 carId);
    event CarUnlisted(uint256 carId);
    event CarInfoUpdated(uint256 carId);
    event CarOwnerNewRating(uint256 rentId);
    
    //car renter
    event RenterRegistered(address renter_address);
    event RentalRequestedSubmitted(address renter_address, uint256 rentId);
    event RentRequestUpdated(uint256 rentId);
    event RentalRequestRecalled(uint256 rentId);
    event RentalOfferAccepted(uint256 renterId, uint256 carId);
    event RentalOfferDeclined(uint256 renterId, uint256 carId);
    event CarReceived(address renter_address, uint256 carId);
    event IssueReported(address reporter, uint256 rentId);
    event IssueResolved(uint256 issueId);
    event IssueReopened(uint256 issueId);
    event RenterNewRating(uint256 rentId);

/***************************** MODIFIERS ********************************/
    modifier carOwnerOnly(address person, uint256 carId) {
        // this modifier requires the caller to be the owner of this car
        require(person == carList[carId].owner, "only verified car owner can perform this action");
        _;
    }

    modifier registeredCarRenterOnly(address renter_address) {
        require(renterList[renter_address].verified == true, "only verified car renter can perform this action");
        _;
    }

    modifier verifiedOwnerOnly(address person) {
        // this modifier requires to caller to be a verified user of DecentralRent
        require(carOwnerInfo[person].verified == true, "car owner is not verified");
        _;
    }

     modifier verifiedRenterOnly(address person) {
        // this modifier requires to caller to be a verified user of DecentralRent
        require(renterList[person].verified == true, "car renter is not verified");
        _;
    }

    modifier supportTeamOnly(address person) {
        require(person == _support_team, "only support team can trigger this function");
        _;
    }

    modifier decentralRentOwnerOnly(address person) {
        require(person == _owner, "only owner of DecentralRent can perform this action");
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

    modifier requesterOnly(address person, uint256 rentId) {
        require(rentList[rentId].renter == person, "This rental request does not belong to you.");
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

    modifier issueInStatus(uint256 issueId, IssueStatus status) {
        // this modifier requires rental in specific status
        require(issueList[issueId].issueStatus == status, "The status of this issue is not allowed for this option.");
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
        carModel = carPlate; // just for warning purpose. To be taken out/editted
        bool singPassCar = false;
        if (person != address(0)) {
            singPassCar = true;
        }
        return singPassCar;
    }
    
//car owner 
    function register_car_owner() public {
        // never use carOwner struct to register?
        require(carOwnerInfo[msg.sender].verified == false, "car owner has already been registered");
        if(singPassVerify(msg.sender)) {
            carOwnerInfo[msg.sender].verified = true;
        }

        emit CarOwnerRegistered(msg.sender);

    }

    function register_car(string memory carModel, string memory carPlate, string memory imageURL1, string memory imageURL2, string memory imageURL3) public verifiedOwnerOnly(msg.sender) {
        // require verification of car
        require(singPassVerifyCar(msg.sender, carModel, carPlate) == true, "car does not pass verification"); 
        // create new car struct
        uint256[] memory requestedrentIdList;
        uint256[] memory rentHistory;
        uint256[] memory cancelledList;
        carIdCount += 1;
        carList[carIdCount] = car(msg.sender, CarStatus.Registered, carPlate, carModel, imageURL1, imageURL2, imageURL3, 0, 0, 0, "", requestedrentIdList, rentHistory, cancelledList);
        carOwnerInfo[msg.sender].carList.push(carIdCount);
        carOwnerInfo[msg.sender].carCount += 1;

        emit CarRegistered(carIdCount);
    }

    function list_car_for_rental(uint256 carId, string memory collectionPoint, uint256 hourlyRentalRate, uint256 deposit, uint256 carCondition) 
        public payable carOwnerOnly(msg.sender, carId) carInStatus(carId, CarStatus.Registered) {
        require(msg.value >= platformFee, "please pay correct platform Fee");
       
        // add information to the car struct
        carList[carId].collectionPoint = collectionPoint;
        carList[carId].deposit = deposit;
        carList[carId].hourlyRentalRate = hourlyRentalRate;
        carList[carId].carCondition = carCondition;
        carList[carId].carStatus = CarStatus.Available;

        // return extra back to the car owner
        address payable owner = address(uint160(msg.sender));
        owner.transfer(msg.value - platformFee);

        emit CarListed(carId);
    }

    function update_listed_car_info(uint256 carId, uint256 hourlyRentalRate, uint256 deposit, string memory collectionPoint, string memory imageURL1, string memory imageURL2, string memory imageURL3 ) 
        public carOwnerOnly(msg.sender, carId) carInStatus(carId, CarStatus.Available) {
        
        //modify information in the car struct

        carList[carId].collectionPoint = collectionPoint;
        carList[carId].deposit = deposit;
        carList[carId].hourlyRentalRate = hourlyRentalRate;
        carList[carId].imageURL1 = imageURL1;
        carList[carId].imageURL2 = imageURL2;
        carList[carId].imageURL3 = imageURL3;


        emit CarInfoUpdated(carId);
    }

    function approve_rental_request(uint256 rentId) public carOwnerOnly(msg.sender, rentList[rentId].carId) requestedRenter(rentList[rentId].carId, rentId) canApprove(rentId){
        // change the request status of the rent contract to be approved 
        rentList[rentId].rentalStatus = RentalStatus.Approved;
        offer_dates[rentId] = block.timestamp;

        emit RentalOfferApproved(rentId);
    } 

    function reject_rental_request(uint256 rentId) public carOwnerOnly(msg.sender, rentList[rentId].carId) requestedRenter(rentList[rentId].carId, rentId) {
        rentList[rentId].rentalStatus = RentalStatus.Rejected;

        // record the rejected requests of this car in a list
        // record reject date
        // those rental requests rejected over 24h will be cleared from storage later
        cancellation_dates[rentId] = block.timestamp;
        carList[rentList[rentId].carId].cancelledRentIdList.push(rentId);
        emit RentalRequestRejected(rentId);
    }

    function unlist_car(uint256 carId) public carOwnerOnly(msg.sender, carId) carInStatus(carId, CarStatus.Available) {
        carList[carId].carStatus = CarStatus.Registered;

        emit CarUnlisted(carId);
    }

    function offer_pending_1day(uint256 rentId) internal view returns (bool) {
        //auto-depre for recall approval
        return block.timestamp > offer_dates[rentId] + 1 days;
    }

    function recall_approval(uint256 rentId) public carOwnerOnly(msg.sender, rentList[rentId].carId) rentalInStatus(rentId, RentalStatus.Approved) carInStatus(rentList[rentId].carId, CarStatus.Available) {
        require(offer_pending_1day(rentId), "You can only recall it after 24h since your approval.");
        //change rent request status and car status
        carList[rentList[rentId].carId].carStatus = CarStatus.Available;
        rentList[rentId].rentalStatus = RentalStatus.Cancelled;
        //rentList[rentId].renter = Address(0);

        emit OfferRecalled(rentId);
    }

    //only used for testing purposes
    function revert_offer_date_by_1day (uint256 rentId) public{
        offer_dates[rentId] = offer_dates[rentId] - 1 days - 1 minutes; 
    }

    function request_cancelled_1day(uint256 rentId) internal view returns (bool) {
        //auto-depre for deletion of cancelled rental request
        return block.timestamp > cancellation_dates[rentId] + 1 days;
    }

    function pending_10days(uint256 rentId) internal view returns (bool) {
        return block.timestamp > request_submitted_dates[rentId] + 10 days;
    }

    // helper function to handle loops
    function delete_expired_requests(uint256 rentId) internal {
        // delete those rental request of this car that are rejected/cancelled over 24h ago
        uint256[] memory newCancelledRentList;
        uint256 j = 0; // temporary index for memory array newCancelledRentList
        for (uint i=0; i<carList[rentList[rentId].carId].cancelledRentIdList.length; i++) {

            if (request_cancelled_1day(carList[rentList[rentId].carId].cancelledRentIdList[i])) {
                // loop thru the existing cancelled rent of this car
                // delete the corresponding rent struct if it has been rejected/cancelled over 24h ago
                delete rentList[carList[rentList[rentId].carId].cancelledRentIdList[i]];
            } else {
                // if not over 24h, keep the rent id in the cancellation list
                newCancelledRentList[j] = (carList[rentList[rentId].carId].cancelledRentIdList[i]);
                j++;
            }
        }
        // update the cancelled list, remove those id we've alr deleted
        carList[rentList[rentId].carId].cancelledRentIdList = newCancelledRentList;
        
    }

    function reject_expired_requests(uint256 rentId) internal {
        for (uint i=0; i<carList[rentList[rentId].carId].requestedrentIdList.length; i++) {
            uint256 thisRentId = carList[rentList[rentId].carId].requestedrentIdList[i];
            if ((pending_10days(thisRentId)) && (rentList[thisRentId].rentalStatus == RentalStatus.Pending)) {
                reject_rental_request(thisRentId);
            }
        }
    }

    // causes gas to run out, so i comment out first
    function confirm_car_returned(uint256 rentId) public carOwnerOnly(msg.sender, rentList[rentId].carId) rentalInStatus(rentId, RentalStatus.Ongoing) carInStatus(rentList[rentId].carId, CarStatus.Received) {
        // change car status to returned
        carList[rentList[rentId].carId].carStatus = CarStatus.Available;
        
        // add rent to car's rentHistory
        carList[rentList[rentId].carId].rentHistory.push(rentId);

        // remove car from the renter's current car list
        // commented out due to high gas fee involved.
        /* 
        uint256 currentCarIndex;
        //uint256 currentCarCount = renterList[rentList[rentId].renter].currentCars.length;
        for (uint i=0; i<renterList[rentList[rentId].renter].currentCars.length; i++) {
            if(renterList[rentList[rentId].renter].currentCars[i] == rentList[rentId].carId) {
                currentCarIndex = i;
                break;
            }
        }
        delete renterList[rentList[rentId].renter].currentCars[currentCarIndex];
        // move up the last element to the deleted gap
        renterList[rentList[rentId].renter].currentCars[currentCarIndex] = renterList[rentList[rentId].renter].currentCars[renterList[rentList[rentId].renter].currentCars.length - 1];
        delete renterList[rentList[rentId].renter].currentCars[renterList[rentList[rentId].renter].currentCars.length - 1];

        reject_expired_requests(rentId);
        delete_expired_requests(rentId);*/

        // change rent status
        rentList[rentId].rentalStatus = RentalStatus.Completed;
        
        // update users' credit score 
        address owneradd = rentList[rentId].carOwner;
        if(!rentList[rentId].penaliseOwner) {
            carOwnerInfo[owneradd].completedRentCount ++;
        }
        carOwnerInfo[owneradd].totalRentCount ++;
        carOwnerInfo[owneradd].creditScore = carOwnerInfo[owneradd].completedRentCount*100/carOwnerInfo[owneradd].totalRentCount; 
        
        
        address renteradd = rentList[rentId].renter;
        if(!rentList[rentId].penaliseRenter) {
            renterList[renteradd].completedRentCount ++;
        } 
        renterList[renteradd].totalRentCount ++;
        renterList[renteradd].creditScore = renterList[renteradd].completedRentCount*100/renterList[renteradd].totalRentCount; //maximum 100 marks
    
        
        // transfer deposit back to renter
        address payable recipient = address(uint160(renteradd));
        uint256 dep = rentList[rentId].deposit;
        uint256 commissionCharge = get_total_rent_price(rentId) * commissionPercent / 100;
        recipient.transfer(dep - commissionCharge);

        emit CarReturned(rentList[rentId].carId);
    } 

    
/***************************** CAR RENTER ********************************/
//car renter -> guys 
    function register_car_renter() public {
        require(singPassVerify(msg.sender));
        require(renterList[msg.sender].verified == false, "car renter has already been registered");
        renterList[msg.sender].verified = true;
        emit RenterRegistered(msg.sender);
    }
    
    // for the renter to quickly make rent request using LISTING PRICE
    function submit_rental_request_without_offer(uint256 carId, uint256 startDate,uint256 endDate) public registeredCarRenterOnly(msg.sender) returns (uint256) {
        return submit_rental_request_with_offer(carId, startDate, endDate, carList[carId].hourlyRentalRate);
    }


    // if renter wants to offer a different price from listing
    function submit_rental_request_with_offer(uint256 carId, uint256 startDate,uint256 endDate, uint256 offeredRate) public registeredCarRenterOnly(msg.sender) returns (uint256) {
        require(carList[carId].carStatus == CarStatus.Available || carList[carId].carStatus == CarStatus.Received, "The status of this car is not allowed for this option.");
        uint256 newrentId = ++rentIdCount;
        // currentRenter.rentalRequests.push(newrentId);

        renterList[msg.sender].rentalRequests.push(newrentId);
        carOwnerInfo[carList[carId].owner].rentalRequests.push(newrentId);
        carList[carId].requestedrentIdList.push(newrentId);
        
        // creating our new rent struct and put into rentList
        rent memory newRentInstance = rent(
            carId,
            msg.sender,
            carList[carId].owner,
            RentalStatus.Pending, // (pending, approved, rejected) 
            startDate,
            endDate,
            offeredRate,
            carList[carId].deposit,
            false,
            false
        );
        rentList[newrentId] = newRentInstance;
        request_submitted_dates[newrentId] = block.timestamp;
        
        emit RentalRequestedSubmitted(msg.sender,newrentId);
        emit Notify_owner(carList[carId].owner);
        
        return newrentId;
    }
    
    function recall_rental_request(uint256 rentId) public registeredCarRenterOnly(msg.sender) requesterOnly(msg.sender, rentId) rentalInStatus(rentId, RentalStatus.Pending){
        //change rent request status
        rentList[rentId].rentalStatus = RentalStatus.Cancelled;

        // record cancel date
        // those rental requests cancelled over 24h will be cleared from storage later
        cancellation_dates[rentId] = block.timestamp;
        carList[rentList[rentId].carId].cancelledRentIdList.push(rentId);

        emit RentalRequestRecalled(rentId);
        emit Notify_owner(rentList[rentId].carOwner);
    }

    function accept_rental_offer(uint256 rentId) public payable registeredCarRenterOnly(msg.sender) requesterOnly(msg.sender, rentId) rentalInStatus(rentId, RentalStatus.Approved){
    

        // WE TAKE RENTAL PRICE + DEPOSIT FROM RENTER NOW
        // uint256 hoursElapsed = 3; 
        uint256 hoursElapsed = (rentList[rentId].endDate - rentList[rentId].startDate) / (60 * 60); 
        uint256 ethToPay = rentList[rentId].hourlyRentalRate * hoursElapsed + rentList[rentId].deposit;
        require(msg.value >= ethToPay, "Please transfer enough Eth to pay for rental");

        rentList[rentId].rentalStatus = RentalStatus.Ongoing;        

        emit RentalOfferAccepted(rentId, rentList[rentId].carId);
        emit Notify_owner(rentList[rentId].carOwner);

        if (msg.value > ethToPay) {
            // transfer back remaining Eth
            // address payable recipient = payable(msg.sender);
            address payable recipient = address(uint160(msg.sender));


            recipient.transfer(msg.value - ethToPay);
        }
    }

    function decline_rental_offer(uint256 rentId) public registeredCarRenterOnly(msg.sender) requesterOnly(msg.sender, rentId) rentalInStatus(rentId, RentalStatus.Approved){
        // change the request status of the rent contract to be cancelled 
        rentList[rentId].rentalStatus = RentalStatus.Cancelled;

        // record cancel date
        // those rental requests cancelled over 24h will be cleared from storage later
        cancellation_dates[rentId] = block.timestamp;
        carList[rentList[rentId].carId].cancelledRentIdList.push(rentId);
        
        emit RentalOfferDeclined(rentId, rentList[rentId].carId);
        emit Notify_owner(rentList[rentId].carOwner);
    } 

    function update_rental_request(uint256 rentId, uint256 startDate,uint256 endDate, uint256 offeredRate) public carInStatus(rentList[rentId].carId, CarStatus.Available) rentalInStatus(rentId, RentalStatus.Pending) {
        require(msg.sender == rentList[rentId].renter, "You are not the owner of this rental request.");
        rentList[rentId].startDate = startDate;
        rentList[rentId].endDate = endDate;
        rentList[rentId].hourlyRentalRate = offeredRate;

        emit RentRequestUpdated(rentId);
    }
    
    function confirm_car_received(uint256 rentId) public rentalInStatus(rentId, RentalStatus.Ongoing) requesterOnly(msg.sender, rentId) carInStatus(rentList[rentId].carId, CarStatus.Available) {
        renterList[msg.sender].currentCars.push(rentList[rentId].carId);
        rentList[rentId].rentalStatus = RentalStatus.Ongoing;
        carList[rentList[rentId].carId].carStatus = CarStatus.Received;

        emit CarReceived(msg.sender, rentId);
        
        // TRANSFER THE RENTAL PRICE TO OWNER
        rent memory rentInstance = rentList[rentId];
        // address payable recipient = payable(rentInstance.carOwner);
        address payable recipient = address(uint160(rentInstance.carOwner));
        
        uint256 commissionCharge = get_total_rent_price(rentId) * commissionPercent / 100;
        uint256 ethToPay = get_total_rent_price(rentId) - commissionCharge;
        recipient.transfer(ethToPay);
    }
    
/***************************** COMMON FUNCTIONS ********************************/
    function renter_leave_rating(uint256 rentId, uint256 carConditionDescription, uint256 attitude, uint256 responseSpeed) public rentalInStatus(rentId, RentalStatus.Completed){
        require(msg.sender == rentList[rentId].renter, "You are not involved in this rental.");
        require(carConditionDescription <= 5 && carConditionDescription >=0, "Rating has to be between 0 and 5!");
        require(attitude <= 5 && attitude >=0, "Rating has to be between 0 and 5!");
        require(responseSpeed <= 5 && responseSpeed >=0, "Rating has to be between 0 and 5!");

        // update the renter struct value 
    
        address rater_address = rentList[rentId].carOwner;
        uint256 rating_count = carOwnerInfo[rater_address].ratingCount;
        carOwnerInfo[rater_address].carConditionDescription= (carOwnerInfo[rater_address].carConditionDescription * rating_count + carConditionDescription)/(rating_count + 1);
        carOwnerInfo[rater_address].attitude = (carOwnerInfo[rater_address].attitude * rating_count + attitude)/(rating_count + 1);
        carOwnerInfo[rater_address].responseSpeed = (carOwnerInfo[rater_address].responseSpeed * rating_count + responseSpeed)/(rating_count + 1);
        carOwnerInfo[rater_address].ratingCount++;
        emit Notify_owner(rater_address);
        emit CarOwnerNewRating(rentId);
    } 

    function owner_leave_rating(uint256 rentId, uint256 carConditionMaintaining, uint256 attitude, uint256 responseSpeed) public rentalInStatus(rentId, RentalStatus.Completed) {
        require(msg.sender == rentList[rentId].carOwner, "You are not involved in this rental.");
        require(carConditionMaintaining <= 5 && carConditionMaintaining >=0, "Rating has to be between 0 and 5!");
        require(attitude <= 5 && attitude >=0, "Rating has to be between 0 and 5!");
        require(responseSpeed <= 5 && responseSpeed >=0, "Rating has to be between 0 and 5!");

        address rated_address = rentList[rentId].renter;
        uint256 rating_count = renterList[rated_address].ratingCount;
        renterList[rated_address].carConditionMaintaining = (renterList[rated_address].carConditionMaintaining * rating_count + carConditionMaintaining)/(rating_count + 1);
        renterList[rated_address].attitude = (renterList[rated_address].attitude * rating_count + attitude)/(rating_count + 1);
        renterList[rated_address].responseSpeed = (renterList[rated_address].responseSpeed * rating_count + responseSpeed)/(rating_count + 1);
        renterList[rated_address].ratingCount++;
        emit Notify_renter(rated_address);
        emit RenterNewRating(rentId);
    }

//support team 

    // common for both
    function report_issue(uint256 rentId, string memory details, string memory contact, string memory proofImageUrl) public rentalInStatus(rentId, RentalStatus.Ongoing) {
        //CHECK IF OWNER OR RENTER
        rent memory currentRent = rentList[rentId];
        address car_owner = currentRent.carOwner;
        address car_renter = currentRent.renter;

        require(msg.sender == car_owner || msg.sender == car_renter, "Issue does not involve you!");
        
        issueIDCount += 1;
        issueList[issueIDCount] = issue(rentId, msg.sender, details, contact, proofImageUrl, IssueStatus.Created);
        

        if (msg.sender == car_owner) {
            carOwnerInfo[car_owner].issueList.push(issueIDCount);
        } else {
            renterList[car_renter].issueList.push(issueIDCount);
        }

        emit IssueReported(msg.sender, rentId);
        emit Notify_owner(currentRent.carOwner);
        emit Notify_renter(currentRent.renter); 
    }

    function support_team_transfer(uint256 issueId, uint256 amount, address recipientAddress) public supportTeamOnly(msg.sender) {
        // issue status set to Solving to guard against re-entrancy attack 
        require(issueList[issueId].issueStatus == IssueStatus.Solving || issueList[issueId].issueStatus == IssueStatus.Created, "The status of this issue is not allowed for this option.");
        issueList[issueId].issueStatus = IssueStatus.Solving;
        uint256 rentId = issueList[issueId].rentId; 

        if (rentList[rentId].carOwner == recipientAddress) {
            // if pay to car owner => deduct from deposit
            rentList[rentId].deposit -= amount; 
        }
        address payable recipient = address(uint160(recipientAddress));
        recipient.transfer(amount);
    }

    function penalty_log(uint256 issueId, string memory person) public supportTeamOnly(msg.sender) {
        require(issueList[issueId].issueStatus == IssueStatus.Solving || issueList[issueId].issueStatus == IssueStatus.Created, "The status of this issue is not allowed for this option.");
        issueList[issueId].issueStatus = IssueStatus.Solving;

        uint256 rentId = issueList[issueId].rentId;
        // update users' credit score 
        if (keccak256(abi.encodePacked(person)) == keccak256(abi.encodePacked('owner'))) {
            rentList[rentId].penaliseOwner = true;
        }
        if (keccak256(abi.encodePacked(person)) == keccak256(abi.encodePacked('renter'))) {
            rentList[rentId].penaliseRenter = true;
        }
    }

    function update_rental_status(uint256 issueId, string memory rentalStatusString, string memory carStatusString) public supportTeamOnly(msg.sender) {
        require(issueList[issueId].issueStatus == IssueStatus.Solving || issueList[issueId].issueStatus == IssueStatus.Created, "The status of this issue is not allowed for this option.");
        issueList[issueId].issueStatus = IssueStatus.Solving;

        uint256 rentId = issueList[issueId].rentId;
        if (keccak256(abi.encodePacked(rentalStatusString)) == keccak256(abi.encodePacked('Registered'))) {
            rentList[rentId].rentalStatus = RentalStatus.Pending;
        } else if (keccak256(abi.encodePacked(rentalStatusString)) == keccak256(abi.encodePacked('Approved'))) {
            rentList[rentId].rentalStatus = RentalStatus.Approved;
        } else if (keccak256(abi.encodePacked(rentalStatusString)) == keccak256(abi.encodePacked('Rejected'))) {
            rentList[rentId].rentalStatus = RentalStatus.Rejected;
        } else if (keccak256(abi.encodePacked(rentalStatusString)) == keccak256(abi.encodePacked('Cancelled'))) {
            rentList[rentId].rentalStatus = RentalStatus.Cancelled;
        } else if (keccak256(abi.encodePacked(rentalStatusString)) == keccak256(abi.encodePacked('Ongoing'))) {
            rentList[rentId].rentalStatus = RentalStatus.Ongoing;
        } else if (keccak256(abi.encodePacked(rentalStatusString)) == keccak256(abi.encodePacked('Completed'))) {
            rentList[rentId].rentalStatus = RentalStatus.Completed;
            carList[rentList[rentId].carId].rentHistory.push(rentId);
            
            // if rental closed, update creditscore accordingly
            address owneradd = rentList[rentId].carOwner;
            if(!rentList[rentId].penaliseOwner) {
                carOwnerInfo[owneradd].completedRentCount ++;
            }
            carOwnerInfo[owneradd].totalRentCount ++;
            carOwnerInfo[owneradd].creditScore = carOwnerInfo[owneradd].completedRentCount*100/carOwnerInfo[owneradd].totalRentCount; 
            address renteradd = rentList[rentId].renter;
            if(!rentList[rentId].penaliseRenter) {
                renterList[renteradd].completedRentCount ++;
            } 
            renterList[renteradd].totalRentCount ++;
            renterList[renteradd].creditScore = renterList[renteradd].completedRentCount*100/renterList[renteradd].totalRentCount; //maximum 100 marks

        } else if (keccak256(abi.encodePacked(rentalStatusString)) == keccak256(abi.encodePacked('Abnormal'))) {
            rentList[rentId].rentalStatus = RentalStatus.Abnormal;
            carList[rentList[rentId].carId].rentHistory.push(rentId);
            // if rental closed, update creditscore accordingly
            address owneradd = rentList[rentId].carOwner;
            if(!rentList[rentId].penaliseOwner) {
                carOwnerInfo[owneradd].completedRentCount ++;
            }
            carOwnerInfo[owneradd].totalRentCount ++;
            carOwnerInfo[owneradd].creditScore = carOwnerInfo[owneradd].completedRentCount*100/carOwnerInfo[owneradd].totalRentCount; 
            address renteradd = rentList[rentId].renter;
            if(!rentList[rentId].penaliseRenter) {
                renterList[renteradd].completedRentCount ++;
            } 
            renterList[renteradd].totalRentCount ++;
            renterList[renteradd].creditScore = renterList[renteradd].completedRentCount*100/renterList[renteradd].totalRentCount; //maximum 100 marks

        } 
        
        if (keccak256(abi.encodePacked(carStatusString)) == keccak256(abi.encodePacked('Registered'))) {
            carList[rentList[rentId].carId].carStatus = CarStatus.Registered;
        } else if (keccak256(abi.encodePacked(carStatusString)) == keccak256(abi.encodePacked('Available'))) {
            carList[rentList[rentId].carId].carStatus = CarStatus.Available;
        } else if (keccak256(abi.encodePacked(carStatusString)) == keccak256(abi.encodePacked('Received'))) {
            carList[rentList[rentId].carId].carStatus = CarStatus.Received;
        } else if (keccak256(abi.encodePacked(carStatusString)) == keccak256(abi.encodePacked('Abnormal'))) {
            carList[rentList[rentId].carId].carStatus = CarStatus.Registered;
        }

    }

    function resolve_issue(uint256 issueId) public supportTeamOnly(msg.sender)  {
        
        require(issueList[issueId].issueStatus == IssueStatus.Solving || issueList[issueId].issueStatus == IssueStatus.Created, "The status of this issue is not allowed for this option.");
        issueList[issueId].issueStatus = IssueStatus.Solved;

        rent memory currentRent = rentList[issueList[issueId].rentId];

        issue_resolved_dates[issueId] = block.timestamp;

        emit Notify_owner(currentRent.carOwner);
        emit Notify_renter(currentRent.renter); 
        emit IssueResolved(issueId);
    }

    function reject_issue(uint256 issueId) public {
        require(issueList[issueId].issueStatus == IssueStatus.Solving || issueList[issueId].issueStatus == IssueStatus.Created, "The status of this issue is not allowed for this option.");
        issueList[issueId].issueStatus = IssueStatus.Rejected;
    }

    //only used for testing purposes
    function revert_issue_resolved_date_by_7day(uint256 issueId) public{
        issue_resolved_dates[issueId] = issue_resolved_dates[issueId] - 7 days - 1 minutes; 
    }

    function reopen_within_7day(uint256 issueId) internal view returns (bool) {
        //auto-depre for deletion of cancelled rental request
        return block.timestamp <= issue_resolved_dates[issueId] + 7 days;
    }

    function reopen_issue(uint256 issueId, string memory updatedDetails) public {
        require(reopen_within_7day(issueId) == true, "you can only reopen an issue within 7 days after it is resolved");
        uint256 rentId = issueList[issueId].rentId;
        rent memory currentRent = rentList[rentId];
        address car_owner = currentRent.carOwner;
        address car_renter = currentRent.renter;

        require(msg.sender == car_owner || msg.sender == car_renter, "Issue does not involve you!");

        issueList[issueId].issueStatus = IssueStatus.Created;
        issueList[issueId].details = updatedDetails;

        // events
        emit IssueReopened(issueId);
        emit Notify_owner(currentRent.carOwner);
        emit Notify_renter(currentRent.renter); 
    }

// DecentralRent Contract Owner Functions 
    function update_platform_fee_and_commission_percentage(uint256 fee, uint256 commission_percentage) public decentralRentOwnerOnly(msg.sender) {
        // only owner of decentralRent can call this function 
        platformFee = fee;
        commissionPercent = commission_percentage;
    }

    function withdraw_profit(uint256 amount) public decentralRentOwnerOnly(msg.sender) {
        // only owner of decentralRent can call this function 
        address payable recipient = address(uint160(_owner));
        recipient.transfer(amount);
    }

// getters for smart contract
    function get_current_time()public view returns (uint256) {
        return block.timestamp;
    }

    function get_owner_car_condition_description(address user_address) public view returns (uint256) {
        return carOwnerInfo[user_address].carConditionDescription;
    }

    function get_owner_attitude(address user_address) public view returns (uint256) {
        return carOwnerInfo[user_address].attitude;
    }

    function get_owner_response_speed(address user_address) public view returns (uint256) {
        return carOwnerInfo[user_address].responseSpeed;
    }

    function get_renter_car_condition_maintaining(address user_address) public view returns (uint256) {
        return renterList[user_address].carConditionMaintaining;
    }

    function get_renter_attitude(address user_address) public view returns (uint256) {
        return renterList[user_address].attitude;
    }

    function get_renter_response_speed(address user_address) public view returns (uint256) {
        return renterList[user_address].responseSpeed;
    }

    function get_owner_total_rent_count(address user_address) public view returns (uint256) {
        return carOwnerInfo[user_address].totalRentCount;
    }

    function get_renter_total_rent_count(address user_address) public view returns (uint256) {
        return renterList[user_address].totalRentCount;
    }

    function get_owner_credit_score(address user_address) public view returns (uint256) {
        return carOwnerInfo[user_address].creditScore;
    }

    function get_renter_credit_score(address user_address) public view returns (uint256) {
        return renterList[user_address].creditScore;
    }

    function get_owner_rating_count(address user_address) public view returns (uint256) {
        return carOwnerInfo[user_address].ratingCount;
    }

    function get_renter_rating_count(address user_address) public view returns (uint256) {
        return renterList[user_address].ratingCount;
    }

    function get_owner_completed_rent_count(address user_address) public view returns (uint256) {
        return carOwnerInfo[user_address].completedRentCount;
    }

    function get_renter_completed_rent_count(address user_address) public view returns (uint256) {
        return renterList[user_address].completedRentCount;
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

    function get_car_requested_rent_IDs(uint256 carId) public view returns(uint256[] memory) {
        return carList[carId].requestedrentIdList;
    }

    function get_car_collection_point(uint256 carId) public view returns(string memory) {
        return carList[carId].collectionPoint;
    }

    function get_car_status(uint256 carId) public view returns(CarStatus) {
        return carList[carId].carStatus;
    }

    function get_car_status_toString(uint256 carId) public view returns (string memory){
        CarStatus temp = carList[carId].carStatus;
        if (temp == CarStatus.Registered) return "Registered";
        if (temp == CarStatus.Available) return "Available";
        if (temp == CarStatus.Received) return "Received";
        if (temp == CarStatus.Abnormal) return "Abnormal";
    }


    function get_rent_status_toString(uint256 rentId) public view returns (string memory){
        RentalStatus temp = rentList[rentId].rentalStatus;
        if (temp == RentalStatus.Pending) return "Pending";
        if (temp == RentalStatus.Approved) return "Approved";
        if (temp == RentalStatus.Rejected) return "Rejected";
        if (temp == RentalStatus.Cancelled) return "Cancelled";
        if (temp == RentalStatus.Ongoing) return "Ongoing";
        if (temp == RentalStatus.Completed) return "Completed";
    }

    function get_rent_start_date(uint256 rentId) public view returns(uint256) {
        return rentList[rentId].startDate;
    }

    function get_rent_end_date(uint256 rentId) public view returns(uint256) {
        return rentList[rentId].endDate;
    }

    function get_total_rent_price(uint256 rentId) public view returns(uint256) {
        // rent memory rentInstance = rentList[rentId];
        uint256 hoursElapsed = (rentList[rentId].endDate - rentList[rentId].startDate) / (60 * 60); 
        return rentList[rentId].hourlyRentalRate * hoursElapsed;
    }

    function get_rent_carId(uint256 rentId) public view returns(uint256) {
        return rentList[rentId].carId;
    }

    function get_rent_renter(uint256 rentId) public view returns(address) {
        return rentList[rentId].renter;
    }

    function get_rent_car_owner(uint256 rentId) public view returns(address) {
        return rentList[rentId].carOwner;
    }

    function get_rent_status(uint256 rentId) public view returns(RentalStatus) {
        return rentList[rentId].rentalStatus;
    }

    function get_issue_rentId(uint256 issueId) public view returns(uint256) {
        return issueList[issueId].rentId;
    }

    function get_issue_details(uint256 issueId) public view returns(string memory) {
        return issueList[issueId].details;
    }

    function get_issue_contact(uint256 issueId) public view returns(string memory) {
        return issueList[issueId].contactNumber;
    }

    function get_issue_image_url(uint256 issueId) public view returns(string memory) {
        return issueList[issueId].proofImageUrl;
    }

    function get_issue_reporter(uint256 issueId) public view returns(address) {
        return issueList[issueId].reporter;
    }

    function owner_get_my_issues() public view verifiedOwnerOnly(msg.sender) returns(uint256[] memory) {
        // only verified owner can call this function
        return carOwnerInfo[msg.sender].issueList;
    }

    function renter_get_my_issues() public view verifiedRenterOnly(msg.sender) returns(uint256[] memory) {
        // only verified renter can call this function
        return renterList[msg.sender].issueList;
    }

    function get_platform_fee() public view returns(uint256) {
        return platformFee;
    }

    function get_commission_percent() public view returns(uint256) {
        return commissionPercent;
    }

    // theoreticle getters for frontend
    // Commented out as it is for front-end integration, which will be our future implementation. 
    /*
    function view_all_cars() public view returns (car[] memory) {
        require(renterList[msg.sender].verified || carOwnerInfo[msg.sender].verified, "You do not have an account yet.");
        car[] memory allCars;
        for (uint i=1; i <= carIdCount; i++) {
            allCars[i] = carList[i];
        }
        return allCars;

    }

    function view_my_cars() public view verifiedOwnerOnly(msg.sender) returns (uint256[] memory)  {
        car[] memory myCars;
        for (uint i=0; i<carOwnerInfo[msg.sender].carList.length; i++) {
            uint256 id = carOwnerInfo[msg.sender].carList[i];
            myCars[i] = carList[id];
        }
        return myCars;
    }

    function view_car_info(uint256 carId) public view returns (car memory) {
        car memory thisCar;
        thisCar = carList[carId];
        return thisCar;
    }

    function get_my_rental_requests() public view returns (rent[] memory) {
        require(renterList[msg.sender].verified || carOwnerInfo[msg.sender].verified, "You do not have an account yet.");
        rent[] memory myRentList;
        if (renterList[msg.sender].verified) {
            for (uint i=0; i<renterList[msg.sender].rentalRequests.length; i++) {
                myRentList[i] = rentList[renterList[msg.sender].rentalRequests[i]];
            }
        } else if (carOwnerInfo[msg.sender].verified) {
            for (uint i=0; i<carOwnerInfo[msg.sender].rentalRequests.length; i++) {
                myRentList[i] = rentList[carOwnerInfo[msg.sender].rentalRequests[i]];
            }
        }
        return myRentList;
    }

    function get_car_rental_requests(uint256 carId) public view verifiedOwnerOnly(msg.sender) returns (rent[] memory) {
        // get my rental requests for a car
        // for car owner use only
        rent[] memory myRentList;
        for (uint i=0; i<carList[carId].requestedrentIdList.length; i++) {
            myRentList[i] = rentList[carList[carId].requestedrentIdList[i]];
        }
        return myRentList;
    }

    function get_a_rental_request_details(uint256 rentId) public view returns (rent memory) {
        require(msg.sender == rentList[rentId].renter || msg.sender == rentList[rentId].carOwner, "You are not involved in this rental.");
        
        return rentList[rentId];
    }

    function get_current_cars(address person) public view returns (car[] memory) {
        // get a renter's current cars
        require(renterList[person].verified, "This account is not a renter account.");
        car[] memory currCars;
        for (uint i=0; i<renterList[person].currentCars.length; i++) {
            currCars[i] = carList[renterList[person].currentCars[i]];
        }
        return currCars;
    } 

    function view_unsolved_issue() public view supportTeamOnly(msg.sender) returns(issue[] memory) {
        // only support team can call this function
        issue[] memory unsolvedIssues;
        for (uint i=0; i<issueIDCount; i++) {
            if (issueList[i].issueStatus == IssueStatus.Created || issueList[i].issueStatus == IssueStatus.Solving) {
                unsolvedIssues.push(issueList[i]);
            }
        }
        return unsolvedIssues;
    } */

}
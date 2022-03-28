pragma solidity >= 0.5.0; 

// try to optimise by using memory storage 
// try to integrate learnings from lecture 9 
// separate data storage and logic 
// satellite functions 

contract DecentralRent{
    address _owner = msg.sender;
    // address support_team = accounts[0];
    mapping (uint256 => car) registeredCarList;
    mapping (uint256 => rent) rentList;
    mapping (address => carOwner) carOwnerInfo; 
    mapping (address => renter) renterList;
    mapping (uint256 => uint256) offer_dates;
    mapping (uint256 => issue) issueList; 
    uint256 carIDCount;
    uint256 rentIDCount;
    uint256 renterIDCount;
    uint256 issueIDCount;

    enum CarStatus {
        Registered,
        Available,
        Reserved,
        Received,
        Returned,
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
        Solved,
        Rejected
    }  

    struct carOwner {
        bool verified; 
        uint256 carCount;
        uint256[] carList;  
    }
    
    struct car {
        address owner;
        CarStatus carStatus;
        // (available, reserved, received, on_rent, returned, missing)
        string car_plate; // maybe can be revealed only after the rent has been confirmed;
        string car_model;
        uint256 hourly_rental_rate;
        uint256 deposit;
        string available_start_date;
        string available_end_date;
        string collection_point;
        uint256[] requestedRentIDList; 
        uint256[] rentHistory;
    }

    struct rent {
        uint256 carID;
        address renter;
        RentalStatus rentalStatus; // (pending, approved, rejected) 
        string start_date;
        string end_date;
    }

    struct renter {
        uint256 completedRentCount;
        uint256 totalRentCount; 
        uint256 creditScore;
    }

    struct issue {
        uint256 rentID;
        string issueDesciption;
        string contactNumber;
        IssueStatus issueStatus;
    }

    modifier carOwnerOnly(address person, uint256 carID) {
        // this modifier requires the caller to be the owner of this car
        require(person == registeredCarList[carID].owner, "only verified car owner can perform this action");
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
        uint256[] memory requests = registeredCarList[carID].requestedRentIDList;
        for (uint i=0; i<requests.length; i++) {
            if (requests[i] == rentID) {
                requested = true;
                break;
            }
        }
        require(requested == true, "renter needs to apply to rent this car first");
        _;
    }

    modifier rentalInStatus(uint256 rentID, RentalStatus status) {
        // this modifier requires rental in specific status
        require(rentList[rentID].rentalStatus == status, "The status of this rental request is not allowed for this option.");
        _;
    }

    modifier carInStatus(uint256 carID, CarStatus status) {
        // this modifier requires car in specific status
        require(registeredCarList[carID].carStatus == status, "The status of this car is not allowed for this option.");
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

    function singPassVerifyCar(address person, string memory car_model, string memory car_plate) private pure returns(bool){
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
        require(carOwnerInfo[msg.sender].verified == false, "car owner has already been registered");
        if(singPassVerify(msg.sender)) {
            carOwnerInfo[msg.sender].verified = true;
        }
    }

    function register_car(string memory car_model, string memory car_plate) public verifiedUserOnly(msg.sender) {
        // require verification of car
        require(singPassVerifyCar(msg.sender, car_model, car_plate) == true, "car does not pass verification"); 
        // create new car struct
        uint256[] memory requestedRentIDList;
        registeredCarList[carIDCount] = car(msg.sender, CarStatus.Registered, car_plate, car_model, 0, 0, "", "", "", requestedRentIDList);
        carOwnerInfo[msg.sender].carList.push(carIDCount);
        carOwnerInfo[msg.sender].carCount += 1;
        carIDCount += 1;
    }


    // xinyi
    function list_car_for_rental(uint256 carID, string memory available_start_date, string memory available_end_date, string memory collection_point, uint256 hourly_rental_rate, uint256 deposit) 
        public carOwnerOnly(msg.sender, carID) carInStatus(carID, CarStatus.Registered) {

        // add information to the car struct
        registeredCarList[carID].available_start_date = available_start_date;
        registeredCarList[carID].available_end_date = available_end_date;
        registeredCarList[carID].collection_point = collection_point;
        registeredCarList[carID].deposit = deposit;
        registeredCarList[carID].hourly_rental_rate = hourly_rental_rate;
        registeredCarList[carID].carStatus = CarStatus.Available;
    }

    function update_listed_car_info(uint256 carID, uint256 hourly_rental_rate, uint256 deposit, string memory available_start_date, string memory available_end_date, string memory collection_point) 
        public carOwnerOnly(msg.sender, carID) carInStatus(carID, CarStatus.Available) {
        
        //modify information in the car struct
        registeredCarList[carID].available_start_date = available_start_date;
        registeredCarList[carID].available_end_date = available_end_date;
        registeredCarList[carID].collection_point = collection_point;
        registeredCarList[carID].deposit = deposit;
        registeredCarList[carID].hourly_rental_rate = hourly_rental_rate;
    }

    function approve_rental_request(uint256 rentID) public carOwnerOnly(msg.sender, rentList[rentID].carID) requestedRenter(rentList[rentID].carID, rentID) {
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
        registeredCarList[carID].carStatus = CarStatus.Unavailable;
    }

    function offer_pending_1day(uint256 rentID) internal view returns (bool) {
        //auto-depre for recall approval
        return block.timestamp > offer_dates[rentID] + 1 days;
    }

    function recall_approval(uint256 rentID) public carOwnerOnly(msg.sender, rentList[rentID].carID) rentalInStatus(rentID, RentalStatus.Approved){
        require(offer_pending_1day(rentID), "You can only recall it after 24h since your approval.");
        //change rent request status and car status
        registeredCarList[rentList[rentID].carID].carStatus = CarStatus.Available;
        rentList[rentID].rentalStatus = RentalStatus.Cancelled;
    }

    function confirm_car_returned(uint256 rentID) public carOwnerOnly(msg.sender, rentList[rentID].carID) {
        // change car status to returned
        registeredCarList[rentList[rentID].carID].carStatus = CarStatus.Available;
        // add rent to car's rentHistory
        // change rent status
        rentList[rentID].rentalStatus = RentalStatus.Completed;
        // update renter score 
        address renteradd = rentList[rentID].renter;
        renterList[renteradd].completedRentCount ++;
        renterList[renteradd].totalRentCount ++;
        renterList[renteradd].creditScore = renterList[renteradd].completedRentCount/renterList[renteradd].totalRentCount * 100; //maximum 100 marks
        // transfer deposit back to renter
        address payable recipient = payable(renteradd);
        uint256 dep = registeredCarList[rentList[rentID].carID].deposit;
        recipient.transfer(dep);
    }

    function report_issue(uint256 rentID, string memory desc, string memory contact) public rentalInStatus(rentID, RentalStatus.Ongoing) {
        issueList[issueIDCount] = issue(rentID, desc, contact, IssueStatus.Created);
        issueIDCount += 1;
    }


    //car renter 
    //    function register_car_renter() private {}
    //    function submit_rental_request() public {}
    function update_rental_request(uint256 rentID) public rentalInStatus(rentID, RentalStatus.Pending) {}
    //    function accept_rental_offer() public {}
    //    function confirm_car_received() public {}
    //    function report_issues() public {}

    //support team 
    //   function resolve_issue() public {}

    // getters
    function get_car_count(address owner) public view returns(uint256) {
        return carOwnerInfo[owner].carCount;
    }

    function get_cars_owned(address owner) public view returns(uint256[] memory) {
        return carOwnerInfo[owner].carList;
    }

    function get_car_hourly_rental(uint256 carID) public view returns(uint256) {
        return registeredCarList[carID].hourly_rental_rate;
    }

    function get_car_model(uint256 carID) public view returns(string memory) {
        return registeredCarList[carID].car_model;
    }

    function get_car_deposit(uint256 carID) public view returns(uint256) {
        return registeredCarList[carID].deposit;
    }

    function get_car_owner(uint256 carID) public view returns(address) {
        return registeredCarList[carID].owner;
    }

    function get_car_available_start_date(uint256 carID) public view returns(string memory) {
        return registeredCarList[carID].available_start_date;
    }

    function get_car_available_end_date(uint256 carID) public view returns(string memory) {
        return registeredCarList[carID].available_end_date;
    }

    function get_car_requested_rent_IDs(uint256 carID) public view returns(uint256[] memory) {
        return registeredCarList[carID].requestedRentIDList;
    }

    function get_car_collection_point(uint256 carID) public view returns(string memory) {
        return registeredCarList[carID].collection_point;
    }

    function get_car_status(uint256 carID) public view returns(CarStatus) {
        return registeredCarList[carID].carStatus;
    }

    function get_rent_start_date(uint256 rentID) public view returns(string memory) {
        return rentList[rentID].start_date;
    }

    function get_rent_end_date(uint256 rentID) public view returns(string memory) {
        return rentList[rentID].end_date;
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
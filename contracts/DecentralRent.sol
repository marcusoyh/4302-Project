pragma solidity >= 0.5.0; 

// try to optimise by using memory storage 
// try to integrate learnings from lecture 9 
// separate data storage and logic 
// satellite functions 

contract DecentralRent {
    address _owner = msg.sender;
    address support_team = accounts[1];
    mapping (uint256 => issue) issueList;

    struct carOwner {

    }
    
    struct car {

    }

    struct renter {

    }

    struct issue {
        
    }
    
//car owner 
    function register_car_owner() private {}
    function register_car() public {}
    function list_car_for_rental() public {}
    function approve_rental_request() public {}
    function reject_rental_request()  public {}
    function confirm_car_returned() public {}
    function report_issue() public {}


//car renter 
    function register_car_renter() private {}
    function submit_rental_request() public {}
    function accept_rental_offer() public {}
    function confirm_car_received() public {}
    function report_issues() public {}

//support team 
    function resolve_issue() public {}
}



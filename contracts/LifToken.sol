pragma solidity ^0.4.8;

import "./zeppelin/token/ERC20.sol";
import "./zeppelin/Ownable.sol";
import "./zeppelin/SafeMath.sol";

/*
 * Líf Token
 *
 * Líf is the cryptocurrency of the Winding Tree platform.
 *
 * Líf is an Old Norse feminine noun meaning "life, the life of the body".
 */


contract LifToken is Ownable, ERC20, SafeMath {

    // Token Name
    string constant NAME = "Líf";

    // Token Symbol
    string constant SYMBOL = "LIF";

    // Token decimals
    uint constant DECIMALS = 8;
    uint constant LIF_DECIMALS = 100000000;

    // Proposal fees in wei unit
    uint public baseProposalFee;

    // Maximun number of tokens
    uint public maxSupply;

    // DAO Proposals to be done
    Proposal[] public proposals;
    uint public totalProposals;

    // Minimun votes needed to create a proposal
    uint public minProposalVotes;

    // DAO Votes
    uint public totalVotes;
    mapping(address => uint) public sentTxVotes;
    mapping(address => uint) public receivedTxVotes;

    //Votes increment
    uint public votesIncrementSent;
    uint public votesIncrementReceived;

    //ERC20 token balances and allowance
    mapping(address => uint) balances;
    mapping (address => mapping (address => uint)) allowed;

    // Transactions
    mapping(address => uint) public txsSent;
    mapping(address => uint) public txsReceived;

    // Crowdsale Stages
    CrowdsaleStage[] public crowdsaleStages;

    // Contract status
    // 1 = Stoped
    // 2 = Created
    // 3 = Crowdsale
    // 4 = DAO
    uint public status;

    // The amount of blocks that a proposal has to be approved
    uint public proposalBlocksWait;

    // Minimun votes for DAO actions in %
    // An action can be a change o some variable on the contract
    // An action can only be a migration request to another contract
    // An action can also be the request to send ethers to another contract
    // An action can also be the request to call another contract sending specific bytes as arguments
    DAOAction[] public DAOActions;

    // Structure of the DAOActions
    struct DAOAction {
      address target;
      uint votesNeeded;
      bytes4 signature;
    }

    // Structure of the Proposals
    struct Proposal {
      address target;
      uint id;
      uint value;
      string description;
      uint status; // 0 = Declined, 1 = Accepted, 2 = Active
      uint creationBlock;
      uint maxBlock;
      uint agePerBlock;
      uint votesNeeded;
      bytes actionData;
      uint totalVotes;
      mapping (address => uint) votes; // 0 = Vote not done, 1 = Positive, 2 = Negative.
    }

    // Structure of the Crowdsale Stage
    struct CrowdsaleStage {
      uint startBlock;
      uint endBlock;
      uint tokenPrice;
      uint minCap;
      uint totalTokens;
      uint raised;
      uint tokensSold;
      uint status; // 0 = waiting, 1 = active, 2 = success, 3 = ended, 4 = failed
      mapping (address => uint) buyers;
    }

    // Edit of the ERC20 token events to support data argument
    event TransferData(address indexed from, address indexed to, uint value, string data);

    // Proposal events
    event proposalAdded(uint proposalId);
    event proposalExecuted(uint proposalId);
    event proposalRemoved(uint proposalId);

    // Vote event
    event VoteAdded(uint proposalId);

    // Change token variables Message
    event Message(string message);

    // Allow only token holders
    modifier onlyTokenHolder {
      if (balances[msg.sender] > 0)
        _;
    }

    // Allow only required status
    modifier onStatus(uint one, uint two, uint three) {
      if (((one != 0) && (status == one)) || ((two != 0) && (status == two)) || ((three != 0) && (status == three)))
        _;
    }

    // Dont allow on specified status
    modifier fromDAO() {
      if (msg.sender == address(this))
        _;
    }

    // LifToken constructor
    function LifToken(uint _baseProposalFee, uint _proposalBlocksWait, uint _votesIncrementSent, uint _votesIncrementReceived, uint _minProposalVotes) {

      baseProposalFee = _baseProposalFee;
      proposalBlocksWait = _proposalBlocksWait;
      votesIncrementReceived = _votesIncrementReceived;
      votesIncrementSent = _votesIncrementSent;
      minProposalVotes = _minProposalVotes;

      maxSupply = 0;
      totalProposals = 0;
      status = 2;

      proposals.length ++;
      DAOActions.length ++;

    }

    function addCrowdsaleStage(uint _startBlock, uint _endBlock, uint _tokenPrice, uint _minCap, uint _totalTokens) onlyOwner() {

      crowdsaleStages.push(CrowdsaleStage(_startBlock, _endBlock, _tokenPrice, _minCap, _totalTokens, 0, 0, 0));
      maxSupply = safeAdd(maxSupply, _totalTokens);

    }

    function editCrowdsaleStage(uint _stage, uint _startBlock, uint _endBlock, uint _tokenPrice, uint _minCap, uint _totalTokens) onlyOwner() {

      if ((crowdsaleStages[_stage].status == 1) || (crowdsaleStages[_stage].status == 2))
        throw;

      crowdsaleStages[_stage].startBlock = _startBlock;
      crowdsaleStages[_stage].endBlock = _endBlock;
      crowdsaleStages[_stage].tokenPrice = _tokenPrice;
      crowdsaleStages[_stage].minCap = _minCap;
      maxSupply = safeSub(maxSupply, crowdsaleStages[_stage].totalTokens);
      maxSupply = safeAdd(maxSupply, _totalTokens);
      crowdsaleStages[_stage].totalTokens = _totalTokens;

    }

    function getCrowdsaleStage(uint _stage) constant returns (uint, uint, uint, uint, uint, uint, uint, uint) {
      CrowdsaleStage c = crowdsaleStages[_stage];
      return (c.startBlock, c.endBlock, c.tokenPrice, c.minCap, c.totalTokens, c.status, c.raised, c.tokensSold);
    }

    function endCrowdsaleStage(uint _stage) onlyOwner() {
      if (crowdsaleStages[_stage].status != 1)
        throw;
      crowdsaleStages[_stage].status = 3;
      status = 4;
    }

    function checkCrowdsaleStage(uint _stage) onlyOwner() {
      bool onCrowdsale = false;

      if ((crowdsaleStages[_stage].tokensSold < crowdsaleStages[_stage].minCap) && (block.number > crowdsaleStages[_stage].endBlock))
        crowdsaleStages[_stage].status = 4;

      //Also check if the token status is on crowdsale
      for (uint i = 0; i < crowdsaleStages.length; i ++)
        if ((crowdsaleStages[i].startBlock <= block.number) && (block.number <= crowdsaleStages[i].endBlock))
          onCrowdsale = true;
      if (!onCrowdsale)
        status = 4;
      else
        status = 3;
    }

    function claimEth(uint _stage) returns (bool) {
      if ((crowdsaleStages[_stage].status != 4) && (crowdsaleStages[_stage].buyers[msg.sender] == 0))
        throw;
      if (msg.sender.send(crowdsaleStages[_stage].buyers[msg.sender]))
        return true;
      else
        return false;
    }

    // Create tokens for the recipient
    function createTokens(address recipient, uint tokens) payable {

      if (tokens == 0)
        throw;

      bool done = false;

      for (uint i = 0; i < crowdsaleStages.length; i ++) {
        if ((crowdsaleStages[i].status < 3) && (crowdsaleStages[i].startBlock <= block.number) && (block.number <= crowdsaleStages[i].endBlock)) {

          if (safeAdd(crowdsaleStages[i].tokensSold, tokens) > crowdsaleStages[i].totalTokens)
            throw;

          if (crowdsaleStages[i].status == 0){
            crowdsaleStages[i].status = 1;
            status = 3;
          } else if (((crowdsaleStages[i].status == 1) || (crowdsaleStages[i].status == 2)) && (safeAdd(crowdsaleStages[i].tokensSold,tokens) == crowdsaleStages[i].totalTokens)){
            crowdsaleStages[i].status = 3;
            status = 4;
          } else if ((crowdsaleStages[i].status == 1) && (safeAdd(crowdsaleStages[i].tokensSold,tokens) > crowdsaleStages[i].minCap)){
            crowdsaleStages[i].status = 2;
            status = 3;
          }

          uint weiCost = safeMul(tokens, crowdsaleStages[i].tokenPrice);
          uint formatedBalance = safeMul(tokens, LIF_DECIMALS);

          if (msg.value < weiCost) {
            break;
          } else {

            if (msg.value > weiCost){
              uint change = safeSub(msg.value, weiCost);
              if (!msg.sender.send(change))
                throw;
            }

            totalSupply = safeAdd(totalSupply, formatedBalance);
            balances[recipient] = safeAdd(balances[recipient], formatedBalance);
            crowdsaleStages[i].buyers[msg.sender] = weiCost;
            crowdsaleStages[i].raised = safeAdd(crowdsaleStages[i].raised, weiCost);
            crowdsaleStages[i].tokensSold = safeAdd(crowdsaleStages[i].tokensSold, tokens);
            done = true;
            break;

          }
        }
      }

      if ( !done && (msg.value > 0)){
        if (!msg.sender.send(msg.value))
          throw;
      }

    }

    // Get the token price at the current block if it is on a valid stage
    function getPrice(uint tokens) constant returns (uint) {
      bool found = false;
      for (uint i = 0; i < crowdsaleStages.length; i ++) {
        if ((crowdsaleStages[i].startBlock <= block.number) && (block.number <= crowdsaleStages[i].endBlock)) {
          return safeMul(tokens, crowdsaleStages[i].tokenPrice);
          break;
        }
      }
      if (!found)
        return 0;
    }

    // Change contract variable functions
    function setBaseProposalFee(uint _baseProposalFee) fromDAO() onStatus(4,0,0) returns (bool) {
      baseProposalFee = _baseProposalFee;
      Message("Base proposal fee changed");
      return true;
    }

    function setMinProposalVotes(uint _minProposalVotes) fromDAO() onStatus(4,0,0) returns (bool) {
      minProposalVotes = _minProposalVotes;
      Message("Min proposal votes changed");
      return true;
    }

    function setProposalBlocksWait(uint _proposalBlocksWait) fromDAO() onStatus(4,0,0) returns (bool) {
      proposalBlocksWait = _proposalBlocksWait;
      Message("Proposal blocks wait changed");
      return true;
    }

    // Send Ether with a DAO proposal approval
    function sendEther(address _to, uint _amount) fromDAO() onStatus(4,0,0) returns (bool) {
        if (_to.send(_amount)) {
          return true;
        } else {
          return false;
        }
    }

    // Set new status on the contract
    function setStatus(uint _newStatus) fromDAO() {
      if ((msg.sender == address(this)) || (msg.sender == owner))
        status = _newStatus;
    }

    //ERC20 token transfer method
    function transfer(address _to, uint _value) returns (bool success) {
      balances[msg.sender] = safeSub(balances[msg.sender], _value);
      balances[_to] = safeAdd(balances[_to], _value);
      giveVotes(msg.sender, _to);
      Transfer(msg.sender, _to, _value);
      return true;
    }

    //ERC20 token transfer method
    function transferFrom(address _from, address _to, uint _value) returns (bool success) {
      uint _allowance = allowed[_from][msg.sender];
      balances[_to] = safeAdd(balances[_to], _value);
      balances[_from] = safeSub(balances[_from], _value);
      allowed[_from][msg.sender] = safeSub(_allowance, _value);
      giveVotes(msg.sender, _to);
      Transfer(_from, _to, _value);
      return true;
    }

    //ERC20 token balanceOf method
    function balanceOf(address _owner) constant returns (uint balance) {
      return balances[_owner];
    }

    //ERC20 token approve method
    function approve(address _spender, uint _value) returns (bool success) {
      allowed[msg.sender][_spender] = _value;
      Approval(msg.sender, _spender, _value);
      return true;
    }

    //ERC20 token allowance method
    function allowance(address _owner, address _spender) constant returns (uint remaining) {
      return allowed[_owner][_spender];
    }

    // ERC20 transfer method but with data parameter.
    function transferData(address _to, uint _value, string _data) onlyTokenHolder() onStatus(3,4,0) returns (bool success) {

      // If transfer have value process it
      if (_value > 0) {
        balances[msg.sender] = safeSub(balances[msg.sender], _value);
        balances[_to] = safeAdd(balances[_to], _value);
        giveVotes(msg.sender, _to);
      }

      TransferData(msg.sender, _to, _value, _data);

    }

    // ERC20 transferFrom method but with data parameter.
    function transferDataFrom(address _from, address _to, uint _value, string _data) onStatus(3,4,0) returns (bool success) {

      // If transfer have value process it
      if (_value > 0) {
        uint _allowance = allowed[_from][msg.sender];
        balances[_from] = safeSub(balances[_from], _value);
        balances[_to] = safeAdd(balances[_to], _value);
        allowed[_from][msg.sender] = safeSub(_allowance, _value);
        giveVotes(msg.sender, _to);
      }

      TransferData(msg.sender, _to, _value, _data);

      return true;

    }

    // Create a new proposal
    function newProposal( address _target, uint _value, string _description, uint _agePerBlock, bytes4 _signature, bytes _actionData ) payable returns (bool success) {

      // Need to check status inside function because arguments stack is to deep to add modifier
      if ((status != 3) && (status != 4))
        throw;

      // Check sender necessary votes
      if (getVotes(msg.sender) < minProposalVotes)
        throw;

      // Check proposal fee
      if (msg.value < baseProposalFee)
        throw;

      // Get the needed votes % for action approval
      uint votesNeeded = 0;

      for (uint i = 1; i < DAOActions.length; i ++) {
        if ((DAOActions[i].target == _target) && (compareSignature(DAOActions[i].signature, _signature))) {
          uint votesPercentage = divide(totalVotes, 100, 1);
          votesNeeded = divide(safeMul(votesPercentage, DAOActions[i].votesNeeded), 100, 1);
        }
      }

      // If DAOAction exists votesNeeded will be more than cero, proposal is created.
      if (votesNeeded > 0) {
        totalProposals ++;
        uint pos = proposals.length++;
        uint _blocksWait = safeAdd(block.number, proposalBlocksWait);
        uint senderVotes = getVotes(msg.sender);
        proposals[pos] = Proposal(_target, totalProposals, _value, _description, 2, block.number, _blocksWait, _agePerBlock, votesNeeded, _actionData, senderVotes);
        proposals[pos].votes[msg.sender] = 1;
        proposalAdded(totalProposals);
      }

      return true;

    }

    // Vote a contract proposal
    function vote(uint _proposalID, bool _vote) onlyTokenHolder() onStatus(3,4,0) returns (bool) {

      //Get the proposal by proposalID
      Proposal p = proposals[_proposalID];

      // If user already voted throw error
      if (p.votes[msg.sender] > 0)
        throw;

      // If proposal is not active throw error
      if (p.status != 2)
        throw;

      // Add user vote
      if (_vote) {
        p.votes[msg.sender] = 1;
        uint senderVotes = getVotes(msg.sender);
        p.totalVotes = safeAdd(p.totalVotes, senderVotes);
      } else {
        p.votes[msg.sender] = 2;
      }

      VoteAdded(_proposalID);

      return true;

    }

    // Execute a proporal, only the owner can make this call, the check of the votes is optional because it can ran out of gas.
    function executeProposal(uint _proposalID) onlyTokenHolder() onStatus(4,0,0) returns (bool success) {

      // Get the proposal using proposalsIndex
      Proposal p = proposals[_proposalID];

      // If proposal reach maxBlocksWait throw.
      if (p.maxBlock < block.number)
        throw;

      // If proposal is not active throw.
      if (p.status != 2)
        throw;

      // Calculate the needed votes
      uint proposalAge = safeSub(block.number, p.creationBlock);
      uint ageVotes = 0;
      if (proposalAge > p.agePerBlock)
        ageVotes = safeDiv(proposalAge, p.agePerBlock);
      uint votesNeeded = safeAdd(p.votesNeeded, ageVotes);

      // See if proposal reached the needed votes
      if (p.totalVotes <= p.votesNeeded) {
        return false;
      } else {

        // Change the status of the proposal to accepted
        p.status = 1;

        if (p.target.call(p.actionData))
          return true;
        else
          return false;

      }

    }

    // Execute a proporal, only the owner can make this call.
    function removeProposal(uint _proposalID) onlyTokenHolder() onStatus(4,0,0) returns (bool success) {

      // Get the proposal using proposalsIndex
      Proposal p = proposals[_proposalID];

      // If proposal didnt reach maxBlocksWait throw.
      if (p.maxBlock > block.number)
        throw;

      // Change the status of the proposal to declined
      p.status = 0;

      return true;

    }

    // Functions to edit, add and remove DAOActions
    function changeDaoAction(address _target, uint _votesNeeded, bytes4 _signature) fromDAO() onStatus(4,0,0) returns (bool) {

      for (uint i = 1; i < DAOActions.length; i ++) {
        if ((DAOActions[i].target == _target) && (compareSignature(DAOActions[i].signature, _signature))) {
          DAOActions[i].votesNeeded = _votesNeeded;
          return true;
        }
      }
      return false;

    }

    function removeDAOAction(address _target, bytes4 _signature) fromDAO() onStatus(4,0,0) returns (bool) {

      for (uint i = 1; i < DAOActions.length; i ++) {
        if ((DAOActions[i].target == _target) && (compareSignature(DAOActions[i].signature, _signature))) {
          delete DAOActions[i];
          return true;
        }
      }
      return false;

    }

    function addDAOAction(address _target, uint _votesNeeded, bytes4 _signature) fromDAO() returns (bool) {

      if (((status == 2) && (msg.sender == owner)) || (status == 4))
        throw;

      uint pos = DAOActions.length ++;
      DAOActions[pos] = DAOAction(_target, _votesNeeded, _signature);

      return true;

    }

    // Get DAOActions array lenght
    function DAOActionsLength() external constant returns (uint) {
      return DAOActions.length;
    }

    // Get proposals array lenght
    function proposalsLenght() external constant returns (uint) {
      return proposals.length;
    }

    // As soon after the contract is created the deployer can set the DAOActions using buildMinVotes
    // Once the min votes are all configured the deployer can start the DAO
    function buildMinVotes(address _target, uint _votesNeeded, bytes4 _signature) onlyOwner() external onStatus(2,0,0) {
      uint pos = DAOActions.length ++;
      DAOActions[pos] = DAOAction(_target, _votesNeeded, _signature);
    }

    // Compare bytes4 function signatures
    function compareSignature(bytes4 _a, bytes4 _b) internal returns (bool) {
      if (_a.length != _b.length)
        return false;
      for (uint i = 0; i < _a.length; i ++) {
        if (_a[i] != _b[i])
          return false;
      }
      return true;
    }

    // Divide function to calculate needed votes
    function divide(uint numerator, uint denominator, uint precision) internal returns (uint) {
       // Check safe-to-multiply here
      uint _numerator = numerator * 10 ** (precision+1);
      // Rounding of last digit
      uint _quotient = ((_numerator / denominator) + 5) / 10;
      return ( _quotient);
    }

    // Internal contract function that add votes if necessary sent/receive txs amount is reached
    function giveVotes(address sender, address receiver) internal {
      if ((txsSent[sender] < (votesIncrementSent**sentTxVotes[sender])) && (safeAdd(txsSent[sender],1) >= (votesIncrementSent**sentTxVotes[sender]))) {
        sentTxVotes[sender] ++;
        totalVotes ++;
      }
      if ((txsReceived[receiver] < (votesIncrementReceived**receivedTxVotes[receiver])) && (safeAdd(txsReceived[receiver],1) >= (votesIncrementReceived**receivedTxVotes[receiver]))) {
        receivedTxVotes[receiver] ++;
        totalVotes ++;
      }
      txsSent[sender] ++;
      txsReceived[receiver] ++;
    }

    // Function to get the total votes of an address
    function getVotes(address voter) constant returns (uint) {
      uint senderVotes = safeAdd(sentTxVotes[voter], receivedTxVotes[voter]);
      return senderVotes;
    }

    // No fallback function
    function() {
      throw;
    }

}

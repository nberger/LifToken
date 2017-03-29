# Líf

Líf is the token of the Winding Tree platform.

Líf is based on the ERC20 token protocol, with the option to also send information between token holders uint new methods transferData and transferDataFrom.
Líf is also a DAO, the token holders can create proposals to change token variables and send value/data to another contracts.

## Install

```sh
npm install ethereumjs-testrpc -g
npm install truffle -g
npm install
```

## Contract Lífecycle

By Lífecycle we mean how the status changes, under what conditions, who can do it and what you can do each status.

1.- First the contract is deployed on status 0, where teh deployer specify the base proposal fee, max supply, proposal blocks wait, exponential increment of votes rewards and minimun votes needed to create a proposal.
  ```
  // LífToken constructor
  function LífToken(uint _baseProposalFee, uint _maxSupply, uint _proposalBlocksWait, uint _votesIncrementSent, uint _votesIncrementReceived, uint _minProposalVotes) {
      ...
  }
  ```
2.- Creation of the token crowdsale stages
  ```
  function addCrowdsaleStage(uint startBlock, uint endBlock, uint tokenPrice, uint minCap, uint totalTokens)
  ```
3.- Configuration of the DAO actions, this is how much votes will be needed to call a contract function from the token.
  ```
  function buildMinVotes(address target, uint votesPercentage, bytes4 signature)
  ```

## New Token Methods

Líf token is ERC20 compatible but it also has two more methods to allow the transference of data between users/contracts.

### transferData

Transfer tokens from one address to another.
```
transferData(address _to, uint _value, string _data) => (bool success)
```
Returns: bool, Success of the operation.

### transferDataFrom

Transfer  an allowed amount of tokens from one address to another.
```
transferDataFrom(address _from, address _to, uint _value, string _data) => (bool success)
```
Returns: bool, Success of the operation.

## DAO Methods

In order for the DAO to work the deployer of the contract has to set the minimun votes required for every action that the DAO can execute, so once the contract is created the deployer has to use buildMinVotes() function to define the votes needed for every action type, after that the start() method can be called by the deployer and start the DAO.

Every DAO proposal will be an action type, depend on the action type the amounts of votes that will be required by the contract to execute the proposal. Every function on Ethereum has a signature, data,  value.
The signature is what the contract need to know what function execute, the data is the data that will be sent to this function and the value are the ethers that would be transferred on the function call, each function call is a transaction on the blockhain.

### Standard DAO functions

This functions can be called only internally, in order to do that a token holder needs to create a proposal and reach the necessary votes to be executed.

```
setBaseProposalFee(uint _baseProposalFee)
setProposalBlocksWait(uint _proposalBlocksWait)
sendEther(address _to, uint _amount)
setStatus(uint _newStatus)
changeDaoAction(address _target, uint _balanceNeeded, bytes4 _signature)
removeDAOAction(address _target, bytes4 _signature)
addDAOAction(address _target, uint _balanceNeeded, bytes4 _signature)
```

### New Proposal

Creates a new proposal on the token, the token holder that creates the proposal needs to have the more than the fee charged for the proposal creation.
```
newProposal( address _target, uint _value, string _description, uint _agePerBlock, bytes4 _signature, bytes _actionData )
```
### Vote

Vote a proposal for yes or no using the proposal ID.
```
vote( uint _proposalID, bool _vote )
```

## Test

To test the token first run `npm run testrpc` and this will create a testnet locally with three acocunts with a lot of balance.

After testrpc starts run `npm test` or `truffle test`.

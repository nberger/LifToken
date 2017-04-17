
var protobuf = require("protobufjs");

var help = require("./helpers");

var LifToken = artifacts.require("./LifToken.sol");
var Message = artifacts.require("./Message.sol");

const LOG_EVENTS = true;

contract('LifToken DAO', function(accounts) {

  var token;
  var eventsWatcher;

  beforeEach(function(done) {
    LifToken.new(web3.toWei(10, 'ether'), 10000, 2, 3, 5)
      .then(function(_token) {
        token = _token;
        eventsWatcher = token.allEvents();
        eventsWatcher.watch(function(error, log){
          if (LOG_EVENTS)
            console.log('Event:', log.event, ':',log.args);
        });
        done();
      });
  });

  afterEach(function(done) {
    eventsWatcher.stopWatching();
    done();
  });

  it("Should add the min votes needed for native contract actions", function(done) {
    var signature = token.contract.setBaseProposalFee.getData(0x0).toString('hex').substring(0,10);
    console.log('Action setBaseProposalFee(uint256) signature', signature);
    token.buildMinVotes(token.contract.address, 86, signature, {from: accounts[0]})
      .then(function() {
        signature = token.contract.setProposalBlocksWait.getData(0x0).toString('hex').substring(0,10);
        console.log('Action setProposalBlocksWait(uint256) signature', signature);
        return token.buildMinVotes(token.contract.address, 87, signature, {from: accounts[0]});
      })
      .then(function() {
        signature = token.contract.addDAOAction.getData(0x0, 0x0, 0x0).toString('hex').substring(0,10);
        console.log('Action addDAOAction(address,uint,bytes4) signature', signature);
        return token.buildMinVotes(token.contract.address, 88, signature, {from: accounts[0]});
      })
      .then(function() {
        signature = token.contract.sendEther.getData(0x0, 0x0).toString('hex').substring(0,10);
        console.log('Action sendEther(address,uint) signature', signature);
        return token.buildMinVotes(token.contract.address, 89, signature, {from: accounts[0]});
      })
      .then(function() {
        signature = token.contract.setStatus.getData(0x0).toString('hex').substring(0,10);
        console.log('Action setStatus(uint) signature', signature);
        return token.buildMinVotes(token.contract.address, 90, signature, {from: accounts[0]});
      })
      .then(function() {
        return Promise.all([
          token.getActionDAO(token.contract.address, token.contract.setBaseProposalFee.getData(0x0).toString('hex').substring(0,10)),
          token.getActionDAO(token.contract.address, token.contract.setProposalBlocksWait.getData(0x0).toString('hex').substring(0,10)),
          token.getActionDAO(token.contract.address, token.contract.addDAOAction.getData(0x0).toString('hex').substring(0,10)),
          token.getActionDAO(token.contract.address, token.contract.sendEther.getData(0x0).toString('hex').substring(0,10)),
          token.getActionDAO(token.contract.address, token.contract.setStatus.getData(0x0).toString('hex').substring(0,10))
        ]);
      })
      .then(function(actions){
        assert.equal(actions[0], 86);
        assert.equal(actions[1], 87);
        assert.equal(actions[2], 88);
        assert.equal(actions[3], 89);
        assert.equal(actions[4], 90);
        done();
      });
  });

  it("Should add a setMinProposalVotes proposal, be voted by another user, check it and get executed.", function(done) {
    var signature, data;
    signature = token.contract.setMinProposalVotes.getData(0x0).toString('hex').substring(0,10);
    console.log('Action setMinProposalVotes(uint256) signature', signature);
    token.buildMinVotes(token.contract.address, 90, signature, {from: accounts[0]})
      .then(function() {
        return help.simulateCrowdsale(token, 10000000, web3.toWei(0.1, 'ether'), [4000000,3000000,2000000,1000000,0], accounts);
      })
      .then(function() {
        var transfers = [];
        for (var i = 0; i < 15; i++)
          transfers.push(token.transfer(accounts[1], help.formatBalance(100), "", {from: accounts[2]}));
        for (i = 0; i < 6; i++)
          transfers.push(token.transfer(accounts[3], help.formatBalance(10), "", {from: accounts[1]}));
        return Promise.all(transfers);
      })
      .then(function() {
        return help.checkValues(token, accounts, 1000000, 10000000, 0, [4001440,2998500,2000060,1000000,0], [6, 4, 2, 0, 0], [6, 15, 0, 0, 0], [15, 0, 6, 0, 0]);
      })
      .then(function() {
        data = token.contract.setMinProposalVotes.getData( web3.toHex(10) ).toString('hex');
        return token.newProposal(token.contract.address, 0, 'Set minProposalVotes to 10', 100, signature, data, {from: accounts[1], value: web3.toWei(10, 'ether')});
      })
      .then(function() {
        return token.vote(1, true, {from: accounts[2]});
      })
      .then(function() {
        return token.vote(1, true, {from: accounts[3]});
      })
      .then(function(result) {
        return token.executeProposal(1, {from: accounts[1]});
      })
      .then(function() {
        data = token.contract.setMinProposalVotes.getData( web3.toHex(20) ).toString('hex');
        return token.newProposal(token.contract.address, 0, 'Set minProposalVotes to 20', 100, signature, data, {from: accounts[1], value: web3.toWei(10, 'ether')});
      })
      .catch(function(error) {
        if (error.message.indexOf('invalid JUMP') < 0) throw error;
      })
      .then(function() {
        return token.minProposalVotes();
      })
      .then(function(minProposalVotes){
        console.log('New minProposalVotes on token:', parseInt(minProposalVotes));
        assert.equal(parseInt(minProposalVotes), 10);
        help.checkValues(token, accounts, 1000010, 10000000, 0, [4001440,2998500,2000060,1000000,0], [6, 4, 2, 0, 0], [6, 15, 0, 0, 0], [15, 0, 6, 0, 0]);
      }).then(function(){
        done();
      });
  });

  it("Should add a setBaseProposalFee proposal, be voted by another user, check it and get executed.", function(done) {
    var signature, data;
    signature = token.contract.setBaseProposalFee.getData(0x0).toString('hex').substring(0,10);
    console.log('Action setBaseProposalFee(uint256) signature', signature);
    token.buildMinVotes(token.contract.address, 90, signature, {from: accounts[0]})
      .then(function() {
        return help.simulateCrowdsale(token, 10000000, web3.toWei(0.1, 'ether'), [4000000,3000000,2000000,1000000,0], accounts);
      })
      .then(function() {
        var transfers = [];
        for (var i = 0; i < 15; i++)
          transfers.push(token.transfer(accounts[1], help.formatBalance(100), "", {from: accounts[2]}));
        for (i = 0; i < 6; i++)
          transfers.push(token.transfer(accounts[3], help.formatBalance(10), "", {from: accounts[1]}));
        return Promise.all(transfers);
      })
      .then(function() {
        return help.checkValues(token, accounts, 1000000, 10000000, 0, [4001440,2998500,2000060,1000000,0], [6, 4, 2, 0, 0], [6, 15, 0, 0, 0], [15, 0, 6, 0, 0]);
      })
      .then(function() {
        var data = token.contract.setBaseProposalFee.getData( web3.toHex( web3.toWei(60, 'ether') ) ).toString('hex');
        return token.newProposal(token.contract.address, 0, 'Set baseProposalFee to 60 ETH', 100, signature, data, {from: accounts[1], value: web3.toWei(10, 'ether')});
      })
      .then(function() {
        return token.vote(1, true, {from: accounts[2]});
      })
      .then(function() {
        return token.vote(1, true, {from: accounts[3]});
      })
      .then(function(result) {
        return token.executeProposal(1, {from: accounts[1]});
      })
      .then(function() {
        return token.baseProposalFee();
      })
      .then(function(baseProposalFee) {
        assert.equal(parseInt(baseProposalFee), web3.toWei(60, 'ether'));
        var data = token.contract.setBaseProposalFee.getData( web3.toHex( web3.toWei(100, 'ether') ) ).toString('hex');
        return token.newProposal(token.contract.address, 0, 'Set baseProposalFee to 100 ETH', 100, signature, data, {from: accounts[1], value: web3.toWei(10, 'ether')});
      })
      .catch(function(error) {
        if (error.message.indexOf('invalid JUMP') < 0) throw error;
      })
      .then(function() {
        var data = token.contract.setBaseProposalFee.getData( web3.toHex( web3.toWei(100, 'ether') ) ).toString('hex');
        return token.newProposal(token.contract.address, 0, 'Set baseProposalFee to 100 ETH', 100, signature, data, {from: accounts[1], value: web3.toWei(60, 'ether')});
      })
      .then(function() {
        return token.vote(2, true, {from: accounts[2]});
      })
      .then(function() {
        return token.vote(2, true, {from: accounts[3]});
      })
      .then(function(result) {
        return token.executeProposal(2, {from: accounts[1]});
      })
      .then(function() {
        return token.baseProposalFee();
      })
      .then(function(baseProposalFee){
        console.log('New baseProposalFee on token:', parseInt(baseProposalFee));
        assert.equal(parseInt(baseProposalFee), web3.toWei(100, 'ether'));
        return help.checkValues(token, accounts, 1000070, 10000000, 0, [4001440,2998500,2000060,1000000,0], [6, 4, 2, 0, 0], [6, 15, 0, 0, 0], [15, 0, 6, 0, 0]);
      }).then(function(){
        done();
      });
  });

  it("Should change proposalBlocksWait using a proposal, create another proposal and reach enough blocks to be removed.", function(done) {
    var signature, data;
    signature = token.contract.setProposalBlocksWait.getData(0x0).toString('hex').substring(0,10);
    console.log('Action setProposalBlocksWait(uint256) signature', signature);
    token.buildMinVotes(token.contract.address, 90, signature, {from: accounts[0]})
      .then(function() {
        return help.simulateCrowdsale(token, 10000000, web3.toWei(0.1, 'ether'), [4000000,3000000,2000000,1000000,0], accounts);
      })
      .then(function() {
        var transfers = [];
        for (var i = 0; i < 15; i++)
          transfers.push(token.transfer(accounts[1], help.formatBalance(100), "", {from: accounts[2]}));
        for (i = 0; i < 6; i++)
          transfers.push(token.transfer(accounts[3], help.formatBalance(10), "", {from: accounts[1]}));
        return Promise.all(transfers);
      })
      .then(function() {
        return help.checkValues(token, accounts, 1000000, 10000000, 0, [4001440,2998500,2000060,1000000,0], [6, 4, 2, 0, 0], [6, 15, 0, 0, 0], [15, 0, 6, 0, 0]);
      })
      .then(function() {
        var data = token.contract.setProposalBlocksWait.getData( web3.toHex(10) ).toString('hex');
        return token.newProposal(token.contract.address, 0, 'Set setProposalBlocksWait to 10 blocks', 100, signature, data, {from: accounts[1], value: web3.toWei(10, 'ether')});
      })
      .then(function(proposals) {
        return token.vote(1, true, {from: accounts[2]});
      })
      .then(function(result) {
        return token.executeProposal(1, {from: accounts[1]});
      })
      .then(function() {
        return token.proposalBlocksWait();
      })
      .then(function(proposalBlocksWait){
        console.log('New proposal blocks wait:', parseInt(proposalBlocksWait));
        assert.equal(parseInt(proposalBlocksWait), 10);
        return help.checkValues(token, accounts, 1000010, 10000000, 0, [4001440,2998500,2000060,1000000,0], [6, 4, 2, 0, 0], [6, 15, 0, 0, 0], [15, 0, 6, 0, 0]);
      })
      .then(function() {
        var data = token.contract.setProposalBlocksWait.getData( web3.toHex(999) ).toString('hex');
        return token.newProposal(token.contract.address, 0, 'Set setProposalBlocksWait to 999 blocks', 100, signature, data, {from: accounts[1], value: web3.toWei(10, 'ether')});
      })
      .then(function(proposals) {
        return token.vote(2, true, {from: accounts[2]});
      })
      .then(function(proposals) {
        return help.waitBlocks(11, accounts);
      })
      .then(function() {
        return token.executeProposal(2, {from: accounts[1]});
      })
      .catch(function(error) {
        if (error.message.indexOf('invalid JUMP') < 0) throw error;
      })
      .then(function(result) {
        return token.removeProposal(2, {from: accounts[2]});
      })
      .then(function() {
        done();
      });
  });

  it("Should add a proposal to send ethers to another address, be voted by another user, check it and get executed.", function(done) {
    var signature, data;
    signature = token.contract.sendEther.getData(0x0,0x0).toString('hex').substring(0,10);
    console.log('Action sendEther(address,uint256) signature', signature);
    token.buildMinVotes(token.contract.address, 90, signature, {from: accounts[0]})
      .then(function() {
        return help.simulateCrowdsale(token, 10000000, web3.toWei(0.1, 'ether'), [4000000,3000000,2000000,1000000,0], accounts);
      })
      .then(function() {
        var transfers = [];
        for (var i = 0; i < 15; i++)
          transfers.push(token.transfer(accounts[1], help.formatBalance(100), "", {from: accounts[2]}));
        for (i = 0; i < 6; i++)
          transfers.push(token.transfer(accounts[3], help.formatBalance(10), "", {from: accounts[1]}));
        return Promise.all(transfers);
      })
      .then(function() {
        return help.checkValues(token, accounts, 1000000, 10000000, 0, [4001440,2998500,2000060,1000000,0], [6, 4, 2, 0, 0], [6, 15, 0, 0, 0], [15, 0, 6, 0, 0]);
      })
      .then(function() {
        var data = token.contract.sendEther.getData(accounts[3], web3.toWei(6, 'ether')).toString('hex');
        return token.newProposal(token.contract.address, 0, 'Call sendEther(address,uint256)', 100, signature, data, {from: accounts[1], value: web3.toWei(10, 'ether')});
      })
      .then(function() {
        return token.vote(1, true, {from: accounts[2]});
      })
      .then(function(result) {
        return token.executeProposal(1, {from: accounts[3]});
      })
      .then(function() {
        return help.checkValues(token, accounts, 1000004, 10000000, 0, [4001440,2998500,2000060,1000000,0], [6, 4, 2, 0, 0], [6, 15, 0, 0, 0], [15, 0, 6, 0, 0]);
      }).then(function(){
        done();
      });
  });

  it("Should add a proposal to call a function outside the contract, be voted by another user, check it and get executed.", function(done) {
    var signature, test;
    Message.new()
      .then(function(_message) {
        message = _message;
        signature = message.contract.showMessage.getData(0x0, 0x0, 0x0).toString('hex').substring(0,10);
        console.log('Action showMessage(bytes32,uint256,string) signature', signature);
        return token.buildMinVotes(message.contract.address, 90, signature, {from: accounts[0]});
      })
      .then(function() {
        return help.simulateCrowdsale(token, 10000000, web3.toWei(0.1, 'ether'), [4000000,3000000,2000000,1000000,0], accounts);
      })
      .then(function() {
        var transfers = [];
        for (var i = 0; i < 15; i++)
          transfers.push(token.transfer(accounts[1], help.formatBalance(100), "", {from: accounts[2]}));
        for (i = 0; i < 6; i++)
          transfers.push(token.transfer(accounts[3], help.formatBalance(10), "", {from: accounts[1]}));
        return Promise.all(transfers);
      })
      .then(function() {
        return help.checkValues(token, accounts, 1000000, 10000000, 0, [4001440,2998500,2000060,1000000,0], [6, 4, 2, 0, 0], [6, 15, 0, 0, 0], [15, 0, 6, 0, 0]);
      })
      .then(function() {
        var data = message.contract.showMessage.getData( web3.toHex('Test Bytes32'), web3.toHex(666), 'Test String' ).toString('hex');
        return token.newProposal(message.contract.address, 0, 'Call showMessage(bytes32,uint256,string)', 100, signature, data, {from: accounts[1], value: web3.toWei(10, 'ether')});
      })
      .then(function() {
        return token.vote(1, true, {from: accounts[2]});
      })
      .then(function() {
        return token.executeProposal(1, {from: accounts[3]});
      })
      .then(function() {
        return new Promise(function(resolve, reject){
          message.allEvents().get(function(error, log){
            if (error)
              reject(error);
            assert.equal(log[0].event, 'Show');
            assert.equal(log[0].args.b32, '0x5465737420427974657333320000000000000000000000000000000000000000');
            assert.equal(parseInt(log[0].args.number), 666);
            assert.equal(log[0].args.text, 'Test String');
            resolve();
          });
        });
      }).then(function(){
        return help.checkValues(token, accounts, 1000010, 10000000, 0, [4001440,2998500,2000060,1000000,0], [6, 4, 2, 0, 0], [6, 15, 0, 0, 0], [15, 0, 6, 0, 0]);
      }).then(function(){
        done();
      });
  });

});

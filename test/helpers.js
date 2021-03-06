
var LifToken = artifacts.require("./LifToken.sol");
var abiDecoder = require('abi-decoder');
abiDecoder.addABI(LifToken._json.abi);

const TOKEN_DECIMALS = 8;
const DEBUG_MODE = false;

module.exports = {

  abiDecoder: abiDecoder,

  hexEncode: function(str){
    var hex, i;
    var result = "";
    for (i=0; i < str.length; i++) {
      hex = str.charCodeAt(i).toString(16);
      result += ("000"+hex).slice(-4);
    }
    return result;
  },

  hexDecode: function(str){
    var j;
    var hexes = str.match(/.{1,4}/g) || [];
    var back = "";
    for(j = 0; j<hexes.length; j++) {
      back += String.fromCharCode(parseInt(hexes[j], 16));
    }
    return back;
  },

  parseBalance: function(balance){
    return (balance/Math.pow(10,TOKEN_DECIMALS)).toPrecision(TOKEN_DECIMALS);
  },
  formatBalance: function(balance){
    return (balance*Math.pow(10,TOKEN_DECIMALS));
  },

  toEther: function(wei){
    return web3.fromWei(parseFloat(wei), 'ether');
  },

  toWei: function(ether){
    return web3.toWei(parseFloat(ether), 'wei');
  },

  waitBlocks: function(toWait, accounts){
    return new Promise(function(resolve, reject) {
      toWait += parseInt(web3.eth.blockNumber);
      var wait = setInterval( function() {
        if (DEBUG_MODE)
          console.log('Waiting '+parseInt(web3.eth.blockNumber-toWait)+' blocks..');
        if (web3.eth.blockNumber >= toWait) {
          clearInterval(wait);
          resolve();
        } else {
          web3.eth.sendTransaction({from: accounts[0], to: accounts[1], value: 1});
        }
      }, 100 );
    });
  },

  waitToBlock: function(blockNumber, accounts){
    return new Promise(function(resolve, reject) {
      var wait = setInterval( function() {
        if (DEBUG_MODE)
          console.log('Waiting '+parseInt(-(web3.eth.blockNumber-blockNumber))+' blocks..');
        if (web3.eth.blockNumber >= blockNumber) {
          clearInterval(wait);
          resolve(true);
        } else {
          web3.eth.sendTransaction({from: accounts[0], to: accounts[1], value: 1});
        }
      }, 10 );
    });
  },

  checkValues: async function(token, accounts, etherBalance, totalSupply, tokenPrice, balances, votes, txsSent, txsReceived) {
    var values = await Promise.all([
      web3.eth.getBalance(token.contract.address),
      token.totalSupply(),
      token.getPrice(1),
      token.totalVotes(),
      token.votesIncrementSent(),
      token.votesIncrementReceived(),
      token.balanceOf(accounts[1]),
      token.balanceOf(accounts[2]),
      token.balanceOf(accounts[3]),
      token.balanceOf(accounts[4]),
      token.balanceOf(accounts[5]),
      token.getVotes(accounts[1]),
      token.getVotes(accounts[2]),
      token.getVotes(accounts[3]),
      token.getVotes(accounts[4]),
      token.getVotes(accounts[5]),
      token.txsSent(accounts[1]),
      token.txsSent(accounts[2]),
      token.txsSent(accounts[3]),
      token.txsSent(accounts[4]),
      token.txsSent(accounts[5]),
      token.txsReceived(accounts[1]),
      token.txsReceived(accounts[2]),
      token.txsReceived(accounts[3]),
      token.txsReceived(accounts[4]),
      token.txsReceived(accounts[5]),
    ]);

    if (DEBUG_MODE) {
      console.log('Contract Balance:', this.toEther(values[0]), 'Ether;', this.toWei(values[0]), 'Wei');
      console.log('Total Supply:', parseInt(values[1]));
      console.log('Token Price:', parseInt(values[2]));
      console.log('Dao Total Votes:', parseInt(values[3]), 'Dao Votes Increment Exponent sent/received:', parseInt(values[4]),'/',parseInt(values[5]));
      console.log('Account[1]', accounts[1], ", Balance:", this.parseBalance(values[6]), ", Votes:", parseInt(values[11]), ", txsSent / txsReceived:", parseInt(values[16]), parseInt(values[21]));
      console.log('Account[2]', accounts[2], ", Balance:", this.parseBalance(values[7]), ", Votes:", parseInt(values[12]), ", txsSent / txsReceived:", parseInt(values[17]), parseInt(values[22]));
      console.log('Account[3]', accounts[3], ", Balance:", this.parseBalance(values[8]), ", Votes:", parseInt(values[13]), ", txsSent / txsReceived:", parseInt(values[18]), parseInt(values[23]));
      console.log('Account[4]', accounts[4], ", Balance:", this.parseBalance(values[9]), ", Votes:", parseInt(values[14]), ", txsSent / txsReceived:", parseInt(values[19]), parseInt(values[24]));
      console.log('Account[5]', accounts[5], ", Balance:", this.parseBalance(values[10]), ", Votes:", parseInt(values[15]), ", txsSent / txsReceived:", parseInt(values[20]), parseInt(values[25]));
    }

    if (etherBalance)
      assert.equal(this.toEther(values[0]), etherBalance);
    if (totalSupply)
      assert.equal(parseInt(values[1]), totalSupply);
    if (tokenPrice)
      assert.equal(this.toWei(values[2]), tokenPrice);
    if (balances){
      assert.equal(this.parseBalance(values[6]), balances[0]);
      assert.equal(this.parseBalance(values[7]), balances[1]);
      assert.equal(this.parseBalance(values[8]), balances[2]);
      assert.equal(this.parseBalance(values[9]), balances[3]);
      assert.equal(this.parseBalance(values[10]), balances[4]);
    }
    if (votes){
      assert.equal(parseInt(values[11]), votes[0]);
      assert.equal(parseInt(values[12]), votes[1]);
      assert.equal(parseInt(values[13]), votes[2]);
      assert.equal(parseInt(values[14]), votes[3]);
      assert.equal(parseInt(values[15]), votes[4]);
    }
    if (txsSent){
      assert.equal(parseInt(values[16]), txsSent[0]);
      assert.equal(parseInt(values[17]), txsSent[1]);
      assert.equal(parseInt(values[18]), txsSent[2]);
      assert.equal(parseInt(values[19]), txsSent[3]);
      assert.equal(parseInt(values[20]), txsSent[4]);
    }
    if (txsReceived){
      assert.equal(parseInt(values[21]), txsReceived[0]);
      assert.equal(parseInt(values[22]), txsReceived[1]);
      assert.equal(parseInt(values[23]), txsReceived[2]);
      assert.equal(parseInt(values[24]), txsReceived[3]);
      assert.equal(parseInt(values[25]), txsReceived[4]);
    }
  },

  getProposal: async function(token, id) {
    var proposal = await token.proposals.call(id);
    var parsedProposal = {
      target: proposal[0],
      id: parseInt(proposal[1]),
      value: parseInt(proposal[2]),
      description: proposal[3],
      status: parseInt(proposal[4]),
      creationBlock: parseInt(proposal[5]),
      maxBlock: parseInt(proposal[6]),
      agePerBlock: parseInt(proposal[7]),
      votesNeeded: parseInt(proposal[8]),
      actionData: proposal[9],
      totalVotes: parseInt(proposal[10])
    };
    console.log('['+parsedProposal.id+'] To: '+parsedProposal.target+', Value: '+parsedProposal.value +', MaxBlock: '+parsedProposal.maxBlock+', Desc: '+parsedProposal.description+', Status: '+parsedProposal.status, ', Votes: ',parsedProposal.totalVotes);
  },

  getStage: async function(token, number) {
    let stageData = await token.crowdsaleStages.call(number);
    console.log('[Stage '+number+'] Blocks: '+parseInt(stageData[0])+' - '+parseInt(stageData[1]) +', Start Price: '+this.toEther(stageData[2])+', ChangePerBlock: '+parseInt(stageData[3])+'/'+this.toEther(stageData[4])+' ETH, MinCap: '+this.toEther(stageData[5])+' ETH, MaxCap: '+this.toEther(stageData[6])+' ETH, Total Tokens: '+parseInt(stageData[7])+', Presale Discount: '+parseInt(stageData[8])+', Presale ETH Raised: '+this.toEther(stageData[10])+', Crowdsale Raised: '+this.toEther(stageData[11])+'ETH, Tokens Sold: '+parseInt(stageData[12])+', Final Price: '+this.toEther(stageData[13])+'ETH');
    return stageData;
  },

  simulateCrowdsale: async function(token, total, price, balances, accounts){
    var startBlock = web3.eth.blockNumber;
    var endBlock = web3.eth.blockNumber+6;
    var targetBalance = parseFloat(total*price);
    await token.addCrowdsaleStage(startBlock, endBlock, price, 10, web3.toWei(0.1, 'ether'), 1, targetBalance, total, 0, 0);
    if (balances[0] > 0)
      await token.submitBid({ value: balances[0]*price, from: accounts[1] });
    if (balances[1] > 0)
      await token.submitBid({ value: balances[1]*price, from: accounts[2] });
    if (balances[2] > 0)
      await token.submitBid({ value: balances[2]*price, from: accounts[3] });
    if (balances[3] > 0)
      await token.submitBid({ value: balances[3]*price, from: accounts[4] });
    if (balances[4] > 0)
      await token.submitBid({ value: balances[4]*price, from: accounts[5] });
    await this.waitToBlock(endBlock+1, accounts);
    await token.checkCrowdsaleStage(0);
    let auctionEnded = await token.crowdsaleStages.call(0);
    let tokenStatus = await token.status();
    assert.equal(parseInt(tokenStatus), 4);
    if (balances[0] > 0)
      await token.distributeTokens(0, accounts[1], false, { from: accounts[0] });
    if (balances[1] > 0)
      await token.distributeTokens(0, accounts[2], false, { from: accounts[0] });
    if (balances[2] > 0)
      await token.distributeTokens(0, accounts[3], false, { from: accounts[0] });
    if (balances[3] > 0)
      await token.distributeTokens(0, accounts[4], false, { from: accounts[0] });
    if (balances[4] > 0)
      await token.distributeTokens(0, accounts[5], false, { from: accounts[0] });
  }
};

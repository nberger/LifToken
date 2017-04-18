
var protobuf = require("protobufjs");

var help = require("./helpers");

var LifToken = artifacts.require("./LifToken.sol");

const LOG_EVENTS = false;

contract('LifToken Crowdsale', function(accounts) {

  var token;
  var eventsWatcher;

  beforeEach(async function() {
    token = await LifToken.new(web3.toWei(10, 'ether'), 10000, 2, 3, 5)
    eventsWatcher = token.allEvents();
    eventsWatcher.watch(function(error, log){
      if (LOG_EVENTS)
        console.log('Event:', log.event, ':',log.args);
    });
  });

  afterEach(function(done) {
    eventsWatcher.stopWatching();
    done();
  });

  it("Should simulate a crowdsale of 7m tokens with on ducth auction stage, using future discount and distribute 3M of the tokens using futurePayments", async function() {
    var currentBlock = web3.eth.blockNumber;
    var startBlock = currentBlock+10;
    var endBlock = currentBlock+110;
    var totalWeiSent = 0;
    var totalTokensBought = 0;
    var lastPrice = 0;
    var presaleTokens = 0;
    // Add crowdsale stage to sell 7M tokens using dutch auction and the future payments.
    await Promise.all([
      token.addCrowdsaleStage(startBlock, endBlock, web3.toWei(5, 'ether'), 10, web3.toWei(0.4, 'ether'), web3.toWei(10000000, 'ether'), web3.toWei(40000000, 'ether'), 7000000, 40),
      token.addFuturePayment(accounts[0], endBlock, 625000, web3.toHex("Founding Team first year retribution tokens")),
      token.addFuturePayment(accounts[0], endBlock+10, 625000, web3.toHex("Founding Team second year retribution tokens")),
      token.addFuturePayment(accounts[0], endBlock+20, 625000, web3.toHex("Founding Team third year retribution tokens")),
      token.addFuturePayment(accounts[0], endBlock+30, 625000, web3.toHex("Founding Team four year retribution tokens")),
      token.addFuturePayment(accounts[0], endBlock, 500000, web3.toHex("Tokens for future WT employees"))
    ])
    await token.addDiscount(accounts[10], 0, web3.toWei(250000, 'ether'));
    let [
      dutchAuction,
      maxSupply,
      FTPaymentFirstYear,
      FTPaymentSecondYear,
      FTPaymentThirdYear,
      FTPaymentFourthPayment,
      futureMembersPayment
    ] = await Promise.all([
      help.getStage(token, 0),
      token.maxSupply(),
      token.futurePayments.call(0),
      token.futurePayments.call(1),
      token.futurePayments.call(2),
      token.futurePayments.call(3),
      token.futurePayments.call(4)
    ]);
    // Check that the crowdsale stage and payments created succesfully with the right values
    assert.equal(FTPaymentFirstYear[0], accounts[0]);
    assert.equal(parseFloat(FTPaymentFirstYear[1]), endBlock);
    assert.equal(parseFloat(FTPaymentFirstYear[2]), 625000);
    assert.equal(FTPaymentSecondYear[0], accounts[0]);
    assert.equal(parseFloat(FTPaymentSecondYear[1]), endBlock+10);
    assert.equal(parseFloat(FTPaymentSecondYear[2]), 625000);
    assert.equal(FTPaymentThirdYear[0], accounts[0]);
    assert.equal(parseFloat(FTPaymentThirdYear[1]), endBlock+20);
    assert.equal(parseFloat(FTPaymentThirdYear[2]), 625000);
    assert.equal(FTPaymentFourthPayment[0], accounts[0]);
    assert.equal(parseFloat(FTPaymentFourthPayment[1]), endBlock+30);
    assert.equal(parseFloat(FTPaymentFourthPayment[2]), 625000);
    assert.equal(futureMembersPayment[0], accounts[0]);
    assert.equal(parseFloat(futureMembersPayment[1]), endBlock);
    assert.equal(parseFloat(futureMembersPayment[2]), 500000);
    assert.equal(parseFloat(dutchAuction[2]), web3.toWei(5, 'ether'));
    assert.equal(parseFloat(dutchAuction[3]), 10);
    assert.equal(parseFloat(dutchAuction[4]), web3.toWei(0.4, 'ether'));
    assert.equal(parseFloat(dutchAuction[5]), web3.toWei(10000000, 'ether'));
    assert.equal(parseFloat(maxSupply), 10000000);
    // Shouldnt be able to submit the bid since first stage didnt started, the ethers will be returned
    try {
      await token.submitBid(accounts[1], 10, { value: web3.toWei(1, 'ether'), from: accounts[1] });
    } catch (error) {
      if (error.message.search('invalid JUMP') == -1) throw error;
    }
    await help.waitToBlock(startBlock, accounts);

    let price = await token.getPrice(500000);
    lastPrice = parseFloat(price)/500000;
    assert.equal(price, web3.toWei(5, 'ether')*500000);
    totalWeiSent += parseFloat(price);
    totalTokensBought += 500000;

    await token.submitBid(accounts[1], 500000, { value: web3.toWei(5, 'ether')*500000, from: accounts[1] });
    await help.checkValues(token, accounts, help.toEther(500000*web3.toWei(5, 'ether')), 0, web3.toWei(5, 'ether'), [0, 0, 0, 0, 0]);
    await help.waitToBlock(startBlock+10, accounts);

    price = await token.getPrice(1);
    lastPrice = parseFloat(price);
    totalWeiSent += parseFloat(price)*1000000;
    totalWeiSent += parseFloat(price)*500000;
    totalTokensBought += 1000000;
    totalTokensBought += 500000;
    await Promise.all([
      token.submitBid(accounts[2], 1000000, { value: price*1000000, from: accounts[2] }),
      token.submitBid(accounts[3], 500000, { value: price*500000, from: accounts[3] })
    ]);
    await help.waitToBlock(startBlock+20, accounts);

    price = await token.getPrice(1);
    lastPrice = parseFloat(price);
    totalWeiSent += parseFloat(price)*1000000;
    totalWeiSent += parseFloat(price)*2000000;
    totalTokensBought += 1000000;
    totalTokensBought += 2000000;

    await Promise.all([
      token.submitBid(accounts[4], 1000000, { value: price*1000000, from: accounts[4] }),
      token.submitBid(accounts[5], 2000000, { value: price*2000000, from: accounts[5] })
    ]);
    await help.waitToBlock(startBlock+40, accounts);

    price = await token.getPrice(1);
    lastPrice = parseFloat(price);
    totalWeiSent += parseFloat(price)*750000;
    totalWeiSent += parseFloat(price)*1000000;
    totalWeiSent += parseFloat(price)*127451;
    totalTokensBought += 750000;
    totalTokensBought += 1000000;
    totalTokensBought += 127451;

    await Promise.all([
      token.submitBid(accounts[6], 750000, { value: price*750000, from: accounts[6] }),
      token.submitBid(accounts[7], 1000000, { value: price*1000000, from: accounts[7] }),
      token.submitBid(accounts[8], 127451, { value: price*127451, from: accounts[8] })
    ]);

    let auctionSuccess = await help.getStage(token, 0);
    // Check that the crowdsale stage is ready to be completed and reached the completion
    assert.equal(parseFloat(auctionSuccess[2]), web3.toWei(5, 'ether'));
    assert.equal(parseFloat(auctionSuccess[3]), 10);
    assert.equal(parseFloat(auctionSuccess[4]), web3.toWei(0.4, 'ether'));
    assert.equal(parseFloat(auctionSuccess[5]), web3.toWei(10000000, 'ether'));
    assert.equal(parseFloat(auctionSuccess[6]), web3.toWei(40000000, 'ether'));
    assert.equal(parseFloat(auctionSuccess[7]), 7000000);
    assert.equal(parseFloat(auctionSuccess[8]), 40);
    assert.equal(help.toEther(auctionSuccess[9]), 250000);
    assert.equal(help.parseBalance(auctionSuccess[10]), help.parseBalance(totalWeiSent));
    assert.equal(parseFloat(auctionSuccess[11]), totalTokensBought);
    assert.equal(parseFloat(auctionSuccess[12]), lastPrice);
    assert.equal(parseFloat(auctionSuccess[13]), 3);
    presaleTokens = help.toWei(250000)/(lastPrice*0.6);

    let status = await token.status();
    assert.equal(parseFloat(status), 4);

    await help.waitToBlock(endBlock+1, accounts);
    await token.checkCrowdsaleStage(0);
    let [auctionEnded, tokenStatus] = await Promise.all([
      help.getStage(token, 0),
      token.status()
    ]);
    // Check the values of the ended crowdsale stage, token status, and claim the tokens
    assert.equal(parseInt(tokenStatus), 4);
    assert.equal(parseFloat(auctionEnded[2]), web3.toWei(5, 'ether'));
    assert.equal(parseFloat(auctionEnded[3]), 10);
    assert.equal(parseFloat(auctionEnded[4]), web3.toWei(0.4, 'ether'));
    assert.equal(parseFloat(auctionEnded[5]), web3.toWei(10000000, 'ether'));
    assert.equal(parseFloat(auctionEnded[6]), web3.toWei(40000000, 'ether'));
    assert.equal(parseFloat(auctionEnded[7]), 7000000);
    assert.equal(parseFloat(auctionEnded[8]), 40);
    assert.equal(help.toEther(auctionEnded[9]), 250000);
    assert.equal(help.parseBalance(auctionEnded[10]), help.parseBalance(totalWeiSent));
    assert.equal(parseFloat(auctionEnded[11]), totalTokensBought);
    assert.equal(parseFloat(auctionEnded[12]), lastPrice);
    assert.equal(parseFloat(auctionEnded[13]), 3);

    await Promise.all([
      token.distributeTokens(0, accounts[1], false, {from: accounts[0]}),
      token.distributeTokens(0, accounts[2], false, {from: accounts[0]}),
      token.distributeTokens(0, accounts[3], false, {from: accounts[0]}),
      token.distributeTokens(0, accounts[4], false, {from: accounts[0]}),
      token.distributeTokens(0, accounts[5], false, {from: accounts[0]}),
      token.distributeTokens(0, accounts[6], false, {from: accounts[0]}),
      token.distributeTokens(0, accounts[7], false, {from: accounts[0]}),
      token.distributeTokens(0, accounts[8], false, {from: accounts[0]}),
      token.distributeTokens(0, accounts[10], true, {from: accounts[0]})
    ]);
    await help.checkValues(token, accounts, 0, 7000000, 0, [500000, 1000000, 500000, 1000000, 2000000]);

    // Shouldnt allow to a claim a payment before the requested block
    try {
      await token.claimTokensPayment(3, {from: accounts[0]});
    } catch (error) {
      if (error.message.search('invalid JUMP') == -1) throw error;
    }
    await help.waitToBlock(endBlock+31, accounts);

    // Should be able to claim all the payments
    await Promise.all([
      token.claimTokensPayment(0, {from: accounts[0]}),
      token.claimTokensPayment(1, {from: accounts[0]}),
      token.claimTokensPayment(2, {from: accounts[0]}),
      token.claimTokensPayment(3, {from: accounts[0]}),
      token.claimTokensPayment(4, {from: accounts[0]})
    ]);
    // Check all final values
    await help.checkValues(token, accounts, 0, 10000000, 0, [500000, 1000000, 500000, 1000000, 2000000]);
  });


  it("Should simulate a crowdsale of 7m tokens with three dutch auction stages, using future discount and distribute 3M of the tokens using futurePayments", function(done) {
    var currentBlock = web3.eth.blockNumber;
    var startBlock = currentBlock+10;
    var endBlock = currentBlock+110;
    var totalWeiSent = 0;
    var totalTokensBought = 0;
    var lastPrice = 0;
    var presaleTokens = 0;
    // Add crowdsale stage to sell 7M tokens using dutch auction and the future payments.
    Promise.all([
      token.addCrowdsaleStage(startBlock, endBlock, web3.toWei(5, 'ether'), 10, web3.toWei(0.2, 'ether'), web3.toWei(10000000, 'ether'), web3.toWei(40000000, 'ether'), 7000000, 50),
      token.addFuturePayment(accounts[0], endBlock, 625000, web3.toHex("Founding Team first year retribution tokens")),
      token.addFuturePayment(accounts[0], endBlock+10, 625000, web3.toHex("Founding Team second year retribution tokens")),
      token.addFuturePayment(accounts[0], endBlock+20, 625000, web3.toHex("Founding Team third year retribution tokens")),
      token.addFuturePayment(accounts[0], endBlock+30, 625000, web3.toHex("Founding Team four year retribution tokens")),
      token.addFuturePayment(accounts[0], endBlock, 500000, web3.toHex("Tokens for future WT employees"))
    ])
    .then(function() {
      return token.addDiscount(accounts[10], 0, web3.toWei(250000, 'ether'));
    })
    .then(function() {
      return Promise.all([
        help.getStage(token, 0),
        token.maxSupply(),
        token.futurePayments.call(0),
        token.futurePayments.call(1),
        token.futurePayments.call(2),
        token.futurePayments.call(3),
        token.futurePayments.call(4)
      ]);
    })
    // Check that the crowdsale stage and payments created succesfully with the right values
    .then(function([dutchAuction, maxSupply, FTPaymentFirstYear, FTPaymentSecondYear, FTPaymentThirdYear, FTPaymentFourthPayment, futureMembersPayment]) {
      assert.equal(FTPaymentFirstYear[0], accounts[0]);
      assert.equal(parseFloat(FTPaymentFirstYear[1]), endBlock);
      assert.equal(parseFloat(FTPaymentFirstYear[2]), 625000);
      assert.equal(FTPaymentSecondYear[0], accounts[0]);
      assert.equal(parseFloat(FTPaymentSecondYear[1]), endBlock+10);
      assert.equal(parseFloat(FTPaymentSecondYear[2]), 625000);
      assert.equal(FTPaymentThirdYear[0], accounts[0]);
      assert.equal(parseFloat(FTPaymentThirdYear[1]), endBlock+20);
      assert.equal(parseFloat(FTPaymentThirdYear[2]), 625000);
      assert.equal(FTPaymentFourthPayment[0], accounts[0]);
      assert.equal(parseFloat(FTPaymentFourthPayment[1]), endBlock+30);
      assert.equal(parseFloat(FTPaymentFourthPayment[2]), 625000);
      assert.equal(futureMembersPayment[0], accounts[0]);
      assert.equal(parseFloat(futureMembersPayment[1]), endBlock);
      assert.equal(parseFloat(futureMembersPayment[2]), 500000);
      assert.equal(parseFloat(dutchAuction[2]), web3.toWei(5, 'ether'));
      assert.equal(parseFloat(dutchAuction[3]), 10);
      assert.equal(parseFloat(dutchAuction[4]), web3.toWei(0.2, 'ether'));
      assert.equal(parseFloat(dutchAuction[5]), web3.toWei(10000000, 'ether'));
      assert.equal(parseFloat(maxSupply), 10000000);
    })
    .then(function() {
      return help.waitToBlock(startBlock, accounts);
    })
    .then(function() {
      return token.getPrice(1);
    })
    .then(function(price) {
      lastPrice = parseFloat(price);
      totalWeiSent += parseFloat(price)*700000;
      totalWeiSent += parseFloat(price)*400000;
      totalTokensBought += 700000;
      totalTokensBought += 400000;
      return Promise.all([
        token.submitBid(accounts[1], 700000, { value: price*700000, from: accounts[1] }),
        token.submitBid(accounts[2], 400000, { value: price*400000, from: accounts[2] })
      ]);
    })
    .then(function() {
      return help.checkValues(token, accounts, help.toEther(totalWeiSent), 0, web3.toWei(5, 'ether'), [0, 0, 0, 0, 0]);
    })
    .then(function() {
      return help.waitToBlock(startBlock+10, accounts);
    })
    .then(function() {
      return token.getPrice(1);
    })
    .then(function(price) {
      lastPrice = parseFloat(price);
      totalWeiSent += parseFloat(price)*200000;
      totalWeiSent += parseFloat(price)*200000;
      totalWeiSent += parseFloat(price)*500000;
      totalTokensBought += 200000;
      totalTokensBought += 200000;
      totalTokensBought += 500000;
      return Promise.all([
        token.submitBid(accounts[3], 200000, { value: price*200000, from: accounts[3] }),
        token.submitBid(accounts[4], 200000, { value: price*200000, from: accounts[4] }),
        token.submitBid(accounts[5], 500000, { value: price*500000, from: accounts[5] })
      ]);
    })
    .then(function() {
      return help.waitToBlock(startBlock+20, accounts);
    })
    .then(function() {
      return token.getPrice(1);
    })
    .then(function(price) {
      lastPrice = parseFloat(price);
      totalWeiSent += parseFloat(price)*600000;
      totalWeiSent += parseFloat(price)*900000;
      totalTokensBought += 600000;
      totalTokensBought += 900000;
      return Promise.all([
        token.submitBid(accounts[6], 600000, { value: price*600000, from: accounts[6] }),
        token.submitBid(accounts[7], 900000, { value: price*900000, from: accounts[7] })
      ]);
    })
    .then(function() {
      return help.waitToBlock(startBlock+50, accounts);
    })
    .then(function() {
      return token.getPrice(1);
    })
    .then(function(price) {
      lastPrice = parseFloat(price);
      totalWeiSent += parseFloat(price)*500000;
      totalTokensBought += 500000;
      return token.submitBid(accounts[8], 500000, { value: price*500000, from: accounts[8] });
    })
    .then(function() {
      return help.getStage(token, 0);
    })
    // Check that the crowdsale stage is ready to be completed and reached the completion
    .then(function(auctionSuccess) {
      assert.equal(parseFloat(auctionSuccess[2]), web3.toWei(5, 'ether'));
      assert.equal(parseFloat(auctionSuccess[3]), 10);
      assert.equal(parseFloat(auctionSuccess[4]), web3.toWei(0.2, 'ether'));
      assert.equal(parseFloat(auctionSuccess[5]), web3.toWei(10000000, 'ether'));
      assert.equal(parseFloat(auctionSuccess[6]), web3.toWei(40000000, 'ether'));
      assert.equal(parseFloat(auctionSuccess[7]), 7000000);
      assert.equal(parseFloat(auctionSuccess[8]), 50);
      assert.equal(help.toEther(auctionSuccess[9]), 250000);
      assert.equal(help.parseBalance(auctionSuccess[10]), help.parseBalance(totalWeiSent));
      assert.equal(parseFloat(auctionSuccess[11]), totalTokensBought);
      assert.equal(parseFloat(auctionSuccess[12]), lastPrice);
      assert.equal(parseFloat(auctionSuccess[13]), 2);
      presaleTokens = help.toWei(250000)/(lastPrice*0.5);
      return token.status();
    })
    .then(function(status) {
      assert.equal(parseFloat(status), 3);
      return help.waitToBlock(endBlock, accounts);
    })
    .then(function() {
      return token.checkCrowdsaleStage(0);
    })
    .then(function() {
      return Promise.all([
        help.getStage(token, 0),
        token.status()
      ]);
    })
    // Check the values of the ended crowdsale stage, token status, and claim the tokens
    .then(function([auctionEnded, tokenStatus]) {
      assert.equal(parseInt(tokenStatus), 4);
      assert.equal(parseFloat(auctionEnded[2]), web3.toWei(5, 'ether'));
      assert.equal(parseFloat(auctionEnded[3]), 10);
      assert.equal(parseFloat(auctionEnded[4]), web3.toWei(0.2, 'ether'));
      assert.equal(parseFloat(auctionEnded[5]), web3.toWei(10000000, 'ether'));
      assert.equal(parseFloat(auctionEnded[6]), web3.toWei(40000000, 'ether'));
      assert.equal(parseFloat(auctionEnded[7]), 7000000);
      assert.equal(parseFloat(auctionEnded[8]), 50);
      assert.equal(help.toEther(auctionEnded[9]), 250000);
      assert.equal(help.parseBalance(auctionEnded[10]), help.parseBalance(totalWeiSent));
      assert.equal(parseFloat(auctionEnded[11]), totalTokensBought);
      assert.equal(parseFloat(auctionEnded[12]), lastPrice);
      assert.equal(parseFloat(auctionEnded[13]), 3);
      return Promise.all([
        token.distributeTokens(0, accounts[1], false, {from: accounts[0]}),
        token.distributeTokens(0, accounts[2], false, {from: accounts[0]}),
        token.distributeTokens(0, accounts[3], false, {from: accounts[0]}),
        token.distributeTokens(0, accounts[4], false, {from: accounts[0]}),
        token.distributeTokens(0, accounts[5], false, {from: accounts[0]}),
        token.distributeTokens(0, accounts[6], false, {from: accounts[0]}),
        token.distributeTokens(0, accounts[7], false, {from: accounts[0]}),
        token.distributeTokens(0, accounts[8], false, {from: accounts[0]}),
        token.distributeTokens(0, accounts[10], true, {from: accounts[0]}),
      ]);
    })
    .then(function() {
      return help.checkValues(token, accounts, 0, 4125000, 0, [700000, 400000, 200000, 200000, 500000]);
    })
    // Start another stage to try to sell the remaining tokens
    .then(function() {
      currentBlock = web3.eth.blockNumber;
      startBlock = currentBlock+10;
      endBlock = currentBlock+110;
      return token.addCrowdsaleStage(startBlock, endBlock, web3.toWei(7, 'ether'), 10, web3.toWei(0.2, 'ether'), web3.toWei(10000000, 'ether'), web3.toWei(30000000, 'ether'), 2875000, 0);
    })
    //Try to add a discount, but it will be rejected due to not discount on auction
    .then(function() {
      return token.addDiscount(accounts[10], 0, web3.toWei(250000, 'ether'));
    })
    .catch(function(error) {
      if (error.message.search('invalid JUMP') == -1) throw error;
    })
    .then(function() {
      return Promise.all([
        help.getStage(token, 1),
        token.maxSupply()
      ]);
    })
    // Check that the crowdsale stage and payments created succesfully with the right values
    .then(function([secondDutchAuction, maxSupply]) {
      assert.equal(parseFloat(secondDutchAuction[2]), web3.toWei(7, 'ether'));
      assert.equal(parseFloat(secondDutchAuction[3]), 10);
      assert.equal(parseFloat(secondDutchAuction[4]), web3.toWei(0.2, 'ether'));
      assert.equal(parseFloat(secondDutchAuction[5]), web3.toWei(10000000, 'ether'));
      assert.equal(parseFloat(maxSupply), 10000000);
    })
    .then(function() {
      return help.waitToBlock(startBlock, accounts);
    })
    .then(function() {
      return token.getPrice(1);
    })
    .then(function(price) {
      lastPrice = parseFloat(price);
      totalWeiSent = 0;
      totalTokensBought = 0;
      totalWeiSent += parseFloat(price)*100000;
      totalWeiSent += parseFloat(price)*300000;
      totalTokensBought += 100000;
      totalTokensBought += 300000;
      return Promise.all([
        token.submitBid(accounts[3], 100000, { value: price*100000, from: accounts[3] }),
        token.submitBid(accounts[4], 300000, { value: price*300000, from: accounts[4] })
      ]);
    })
    .then(function() {
      return help.waitToBlock(startBlock+10, accounts);
    })
    .then(function() {
      return token.getPrice(1);
    })
    .then(function(price) {
      lastPrice = parseFloat(price);
      totalWeiSent += parseFloat(price)*400000;
      totalTokensBought += 400000;
      return token.submitBid(accounts[6], 400000, { value: price*400000, from: accounts[6] });
    })
    .then(function() {
      return help.waitToBlock(startBlock+20, accounts);
    })
    .then(function() {
      return token.getPrice(1);
    })
    .then(function(price) {
      lastPrice = parseFloat(price);
      totalWeiSent += parseFloat(price)*600000;
      totalWeiSent += parseFloat(price)*600000;
      totalTokensBought += 600000;
      totalTokensBought += 600000;
      return Promise.all([
        token.submitBid(accounts[7], 600000, { value: price*600000, from: accounts[7] }),
        token.submitBid(accounts[8], 600000, { value: price*600000, from: accounts[8] })
      ]);
    })
    .then(function() {
      return help.getStage(token, 1);
    })
    // Check that the crowdsale stage is ready to be completed and reached the completion
    .then(function(auctionSuccess) {
      assert.equal(parseFloat(auctionSuccess[2]), web3.toWei(7, 'ether'));
      assert.equal(parseFloat(auctionSuccess[3]), 10);
      assert.equal(parseFloat(auctionSuccess[4]), web3.toWei(0.2, 'ether'));
      assert.equal(parseFloat(auctionSuccess[5]), web3.toWei(10000000, 'ether'));
      assert.equal(parseFloat(auctionSuccess[6]), web3.toWei(30000000, 'ether'));
      assert.equal(parseFloat(auctionSuccess[7]), 2875000);
      assert.equal(parseFloat(auctionSuccess[8]), 0);
      assert.equal(help.toEther(auctionSuccess[9]), 0);
      assert.equal(help.parseBalance(auctionSuccess[10]), help.parseBalance(totalWeiSent));
      assert.equal(parseFloat(auctionSuccess[11]), totalTokensBought);
      assert.equal(parseFloat(auctionSuccess[12]), lastPrice);
      assert.equal(parseFloat(auctionSuccess[13]), 2);
      return token.status();
    })
    .then(function(status) {
      assert.equal(parseFloat(status), 3);
      return help.waitToBlock(endBlock, accounts);
    })
    .then(function() {
      return token.checkCrowdsaleStage(1);
    })
    .then(function() {
      return Promise.all([
        help.getStage(token, 1),
        token.status()
      ]);
    })
    // Check the values of the ended crowdsale stage, token status, and claim the tokens
    .then(function([auctionEnded, tokenStatus]) {
      assert.equal(parseInt(tokenStatus), 4);
      assert.equal(parseFloat(auctionEnded[2]), web3.toWei(7, 'ether'));
      assert.equal(parseFloat(auctionEnded[3]), 10);
      assert.equal(parseFloat(auctionEnded[4]), web3.toWei(0.2, 'ether'));
      assert.equal(parseFloat(auctionEnded[5]), web3.toWei(10000000, 'ether'));
      assert.equal(parseFloat(auctionEnded[6]), web3.toWei(30000000, 'ether'));
      assert.equal(parseFloat(auctionEnded[7]), 2875000);
      assert.equal(parseFloat(auctionEnded[8]), 0);
      assert.equal(help.toEther(auctionEnded[9]), 0);
      assert.equal(help.parseBalance(auctionEnded[10]), help.parseBalance(totalWeiSent));
      assert.equal(parseFloat(auctionEnded[11]), totalTokensBought);
      assert.equal(parseFloat(auctionEnded[12]), lastPrice);
      assert.equal(parseFloat(auctionEnded[13]), 3);
      return Promise.all([
        token.distributeTokens(1, accounts[3], false, {from: accounts[0]}),
        token.distributeTokens(1, accounts[4], false, {from: accounts[0]}),
        token.distributeTokens(1, accounts[6], false, {from: accounts[0]}),
        token.distributeTokens(1, accounts[7], false, {from: accounts[0]}),
        token.distributeTokens(1, accounts[8], false, {from: accounts[0]})
      ]);
    })
    .then(function() {
      return help.checkValues(token, accounts, 0, 6125000, 0, [700000, 400000, 300000, 500000, 500000]);
    })
    // Start another stage to try to sell the remaining tokens
    .then(function() {
      currentBlock = web3.eth.blockNumber;
      startBlock = currentBlock+10;
      endBlock = currentBlock+110;
      return token.addCrowdsaleStage(startBlock, endBlock, web3.toWei(10, 'ether'), 5, web3.toWei(0.1, 'ether'), web3.toWei(10000000, 'ether'), web3.toWei(30000000, 'ether'), 875000, 0);
    })
    .then(function() {
      return Promise.all([
        help.getStage(token, 2),
        token.maxSupply()
      ]);
    })
    // Check that the crowdsale stage and payments created succesfully with the right values
    .then(function([secondDutchAuction, maxSupply]) {
      assert.equal(parseFloat(secondDutchAuction[2]), web3.toWei(10, 'ether'));
      assert.equal(parseFloat(secondDutchAuction[3]), 5);
      assert.equal(parseFloat(secondDutchAuction[4]), web3.toWei(0.1, 'ether'));
      assert.equal(parseFloat(secondDutchAuction[5]), web3.toWei(10000000, 'ether'));
      assert.equal(parseFloat(maxSupply), 10000000);
    })
    .then(function() {
      return help.waitToBlock(startBlock, accounts);
    })
    .then(function() {
      return token.getPrice(1);
    })
    .then(function(price) {
      lastPrice = parseFloat(price);
      totalWeiSent = 0;
      totalTokensBought = 0;
      totalWeiSent += parseFloat(price)*175000;
      totalWeiSent += parseFloat(price)*300000;
      totalTokensBought += 175000;
      totalTokensBought += 300000;
      return Promise.all([
        token.submitBid(accounts[1], 175000, { value: price*175000, from: accounts[1] }),
        token.submitBid(accounts[2], 300000, { value: price*300000, from: accounts[2] })
      ]);
    })
    .then(function() {
      return help.waitToBlock(startBlock+5, accounts);
    })
    .then(function() {
      return token.getPrice(1);
    })
    .then(function(price) {
      lastPrice = parseFloat(price);
      totalWeiSent += parseFloat(price)*200000;
      totalTokensBought += 200000;
      return token.submitBid(accounts[3], 200000, { value: price*200000, from: accounts[3] });
    })
    .then(function() {
      return help.waitToBlock(startBlock+10, accounts);
    })
    .then(function() {
      return token.getPrice(1);
    })
    .then(function(price) {
      lastPrice = parseFloat(price);
      totalWeiSent += parseFloat(price)*200000;
      totalTokensBought += 200000;
      return token.submitBid(accounts[4], 200000, { value: price*200000, from: accounts[4] });
    })
    .then(function() {
      return Promise.all([
        help.getStage(token, 2),
        token.status()
      ]);
    })
    // Check the values of the ended crowdsale stage, token status, and claim the tokens
    .then(function([auctionEnded, tokenStatus]) {
      assert.equal(parseInt(tokenStatus), 4);
      assert.equal(parseFloat(auctionEnded[2]), web3.toWei(10, 'ether'));
      assert.equal(parseFloat(auctionEnded[3]), 5);
      assert.equal(parseFloat(auctionEnded[4]), web3.toWei(0.1, 'ether'));
      assert.equal(parseFloat(auctionEnded[5]), web3.toWei(10000000, 'ether'));
      assert.equal(parseFloat(auctionEnded[6]), web3.toWei(30000000, 'ether'));
      assert.equal(parseFloat(auctionEnded[7]), 875000);
      assert.equal(parseFloat(auctionEnded[8]), 0);
      assert.equal(help.toEther(auctionEnded[9]), 0);
      assert.equal(help.parseBalance(auctionEnded[10]), help.parseBalance(totalWeiSent));
      assert.equal(parseFloat(auctionEnded[11]), totalTokensBought);
      assert.equal(parseFloat(auctionEnded[12]), lastPrice);
      assert.equal(parseFloat(auctionEnded[13]), 3);
      return help.waitToBlock(endBlock, accounts);
    })
    .then(function() {
      return Promise.all([
        token.distributeTokens(2, accounts[1], false, {from: accounts[0]}),
        token.distributeTokens(2, accounts[2], false, {from: accounts[0]}),
        token.distributeTokens(2, accounts[3], false, {from: accounts[0]}),
        token.distributeTokens(2, accounts[4], false, {from: accounts[0]})
      ]);
    })
    .then(function() {
      return help.checkValues(token, accounts, 0, 7000000, 0, [875000, 700000, 500000, 700000, 500000]);
    })
    // Should be able to claim all the payments
    .then(function() {
      return Promise.all([
        token.claimTokensPayment(0, {from: accounts[0]}),
        token.claimTokensPayment(1, {from: accounts[0]}),
        token.claimTokensPayment(2, {from: accounts[0]}),
        token.claimTokensPayment(3, {from: accounts[0]}),
        token.claimTokensPayment(4, {from: accounts[0]})
      ]);
    })
    // Check all final values
    .then(function() {
      return help.checkValues(token, accounts, 0, 10000000, 0, [875000, 700000, 500000, 700000, 500000]);
    })
    .then(function() {
      done();
    });
  });

});

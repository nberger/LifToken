pragma solidity ^0.4.13;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./LifToken.sol";

contract VestedPayment is Ownable {
  using SafeMath for uint256;

  // when the vested schedule starts
  uint256 public startTime;

  // how much seconds each period will last
  uint256 public secondsPerPeriod;

  // how much periods will have in total
  uint256 public totalPeriods;

  // the amount of tokens to be vested in total
  uint256 public tokens;

  // how much tokens were claimed
  uint256 public claimed;

  // the token contract
  LifToken public token;

  // duration (in periods) of the initial cliff in the vesting schedule
  uint256 public cliffDuration;

  // if the vested payment was funded or not
  bool public funded = false;

  function VestedPayment(
    uint256 _startTime, uint256 _secondsPerPeriod,
    uint256 _totalPeriods, uint256 _cliffDuration, address tokenAddress
  ){
    require(_startTime >= block.timestamp);
    require(_secondsPerPeriod > 0);
    require(_totalPeriods > 0);
    require(tokenAddress != address(0));
    require(_cliffDuration < _totalPeriods);

    startTime = _startTime;
    secondsPerPeriod = _secondsPerPeriod;
    totalPeriods = _totalPeriods;
    cliffDuration = _cliffDuration;
    token = LifToken(tokenAddress);
  }

  // fund the vesting contract with tokens allowed to be spent by the contract
  function fund(uint256 _tokens) onlyOwner {
    assert(!funded);

    token.transferFrom(owner, address(this), _tokens);
    tokens = _tokens;
    funded = true;
  }

  // how much tokens are available to be claimed
  function getAvailableTokens() public constant returns (uint256) {
    uint256 period = block.timestamp.sub(startTime).div(secondsPerPeriod);

    if ((period < cliffDuration) || !funded) {
      return 0;
    } else if (period >= totalPeriods) {
      return tokens.sub(claimed);
    } else {
      return tokens.mul(period.add(1)).div(totalPeriods).sub(claimed);
    }
  }

  // claim the tokens, they can be claimed only by the owner of the contract
  function claimTokens(uint256 amount) onlyOwner {
    assert(funded);
    assert(getAvailableTokens() >= amount);

    claimed = claimed.add(amount);
    token.transfer(owner, amount);
  }

}

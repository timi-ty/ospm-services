// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {LMSR} from "./LMSR.sol";

contract BinaryMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Types ────────────────────────────────────────────────────────────

    enum Status { OPEN, PROPOSED, RESOLVED, DISPUTED }

    struct Bet {
        uint256 shares;
        bool outcome;     // true = YES
        uint256 costBasis;
        bool claimed;
    }

    // ── Immutables ───────────────────────────────────────────────────────

    IERC20 public immutable playToken;
    address public immutable oracle;
    address public immutable factory;
    string public question;
    string public sourceUrl;
    uint256 public immutable bettingCloseTimestamp;
    uint256 public immutable resolutionTimestamp;
    uint256 public immutable b; // LMSR liquidity parameter (WAD)

    // ── State ────────────────────────────────────────────────────────────

    Status public status;
    bool public resolvedOutcome;
    uint256 public proposedTimestamp;
    uint256 public constant DISPUTE_WINDOW = 2 hours;

    int256 public qYes;
    int256 public qNo;

    mapping(address => Bet) public bets;

    // ── Events ───────────────────────────────────────────────────────────

    event BetPlaced(address indexed user, bool outcome, uint256 shares, uint256 cost);
    event ResolutionProposed(bool outcome, uint256 timestamp);
    event MarketResolved(bool outcome);
    event MarketDisputed(address indexed disputer, string reason);
    event WinningsClaimed(address indexed user, uint256 amount);

    // ── Modifiers ────────────────────────────────────────────────────────

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }

    modifier whenOpen() {
        require(status == Status.OPEN, "Market not open");
        require(block.timestamp < bettingCloseTimestamp, "Betting closed");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────

    constructor(
        address _playToken,
        address _oracle,
        string memory _question,
        string memory _sourceUrl,
        uint256 _bettingCloseTimestamp,
        uint256 _resolutionTimestamp,
        uint256 _b
    ) {
        require(_b > 0, "b must be > 0");
        require(_bettingCloseTimestamp < _resolutionTimestamp, "Invalid timestamps");
        require(_bettingCloseTimestamp > block.timestamp, "Close time in past");

        playToken = IERC20(_playToken);
        oracle = _oracle;
        factory = msg.sender;
        question = _question;
        sourceUrl = _sourceUrl;
        bettingCloseTimestamp = _bettingCloseTimestamp;
        resolutionTimestamp = _resolutionTimestamp;
        b = _b;
        status = Status.OPEN;
    }

    // ── Read ─────────────────────────────────────────────────────────────

    function costToBuy(bool _outcome, uint256 _shares) external view returns (uint256) {
        return LMSR.costForShares(_outcome, qYes, qNo, b, _shares);
    }

    function getOdds() external view returns (uint256 pYes, uint256 pNo) {
        return LMSR.prices(qYes, qNo, b);
    }

    // ── Betting ──────────────────────────────────────────────────────────

    function placeBet(bool _outcome, uint256 _maxCost)
        external
        nonReentrant
        whenOpen
        returns (uint256 shares)
    {
        require(_maxCost > 0, "Amount must be > 0");
        require(bets[msg.sender].shares == 0, "Already placed bet");

        shares = LMSR.sharesForCost(_outcome, qYes, qNo, b, _maxCost);
        require(shares > 0, "Shares too small");

        uint256 actualCost = LMSR.costForShares(_outcome, qYes, qNo, b, shares);
        require(actualCost <= _maxCost, "Cost exceeds max");

        playToken.safeTransferFrom(msg.sender, address(this), actualCost);

        if (_outcome) {
            qYes += int256(shares);
        } else {
            qNo += int256(shares);
        }

        bets[msg.sender] = Bet({
            shares: shares,
            outcome: _outcome,
            costBasis: actualCost,
            claimed: false
        });

        emit BetPlaced(msg.sender, _outcome, shares, actualCost);
    }

    // ── Resolution ───────────────────────────────────────────────────────

    function proposeResolution(bool _outcome) external onlyOracle {
        require(
            status == Status.OPEN || status == Status.DISPUTED,
            "Cannot propose in current status"
        );
        require(block.timestamp >= resolutionTimestamp, "Too early to resolve");

        status = Status.PROPOSED;
        resolvedOutcome = _outcome;
        proposedTimestamp = block.timestamp;

        emit ResolutionProposed(_outcome, block.timestamp);
    }

    function finalizeResolution() external {
        require(status == Status.PROPOSED, "Not in proposed state");
        require(
            block.timestamp >= proposedTimestamp + DISPUTE_WINDOW,
            "Dispute window active"
        );

        status = Status.RESOLVED;
        emit MarketResolved(resolvedOutcome);
    }

    function disputeResolution(string calldata _reason) external {
        require(status == Status.PROPOSED, "Not in proposed state");
        require(
            block.timestamp < proposedTimestamp + DISPUTE_WINDOW,
            "Dispute window closed"
        );
        require(bets[msg.sender].shares > 0, "Must have bet to dispute");

        status = Status.DISPUTED;
        emit MarketDisputed(msg.sender, _reason);
    }

    // ── Claims ───────────────────────────────────────────────────────────

    function claimWinnings() external nonReentrant {
        require(status == Status.RESOLVED, "Market not resolved");

        Bet storage bet = bets[msg.sender];
        require(bet.shares > 0, "No bet placed");
        require(!bet.claimed, "Already claimed");
        require(bet.outcome == resolvedOutcome, "Did not win");

        bet.claimed = true;
        uint256 payout = bet.shares;
        playToken.safeTransfer(msg.sender, payout);

        emit WinningsClaimed(msg.sender, payout);
    }
}

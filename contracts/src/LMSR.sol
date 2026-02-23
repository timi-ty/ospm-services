// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @title LMSR — Logarithmic Market Scoring Rule
/// @notice Pure math library for binary prediction market pricing.
///         All values scaled by 1e18 (WAD).
library LMSR {
    int256 private constant WAD = 1e18;

    /// @notice Cost function: C(q) = b * ln(exp(qYes/b) + exp(qNo/b)).
    ///         Uses log-sum-exp trick for numerical stability.
    function cost(int256 _qYes, int256 _qNo, uint256 _b) internal pure returns (uint256) {
        int256 b = int256(_b);
        int256 a = (_qYes * WAD) / b;
        int256 d = (_qNo * WAD) / b;

        int256 m = a > d ? a : d;
        int256 sumExp = FixedPointMathLib.expWad(a - m) + FixedPointMathLib.expWad(d - m);
        int256 result = (b * (m + FixedPointMathLib.lnWad(sumExp))) / WAD;

        return result > 0 ? uint256(result) : 0;
    }

    /// @notice Current probabilities. pYes + pNo ≈ 1e18.
    function prices(int256 _qYes, int256 _qNo, uint256 _b) internal pure returns (uint256 pYes, uint256 pNo) {
        int256 b = int256(_b);
        int256 a = (_qYes * WAD) / b;
        int256 d = (_qNo * WAD) / b;

        int256 m = a > d ? a : d;
        int256 expA = FixedPointMathLib.expWad(a - m);
        int256 expD = FixedPointMathLib.expWad(d - m);
        int256 sum = expA + expD;

        pYes = uint256((expA * WAD) / sum);
        pNo = uint256((expD * WAD) / sum);
    }

    /// @notice Token cost to buy `_shares` of `_outcome`.
    function costForShares(
        bool _outcome,
        int256 _qYes,
        int256 _qNo,
        uint256 _b,
        uint256 _shares
    ) internal pure returns (uint256) {
        int256 s = int256(_shares);
        int256 newQYes = _outcome ? _qYes + s : _qYes;
        int256 newQNo = _outcome ? _qNo : _qNo + s;

        uint256 oldCost = cost(_qYes, _qNo, _b);
        uint256 newCost = cost(newQYes, newQNo, _b);
        return newCost > oldCost ? newCost - oldCost : 0;
    }

    /// @notice Binary search: max shares purchasable for `_maxCost` tokens.
    function sharesForCost(
        bool _outcome,
        int256 _qYes,
        int256 _qNo,
        uint256 _b,
        uint256 _maxCost
    ) internal pure returns (uint256) {
        if (_maxCost == 0) return 0;

        uint256 low = 0;
        uint256 high = _maxCost * 2;

        for (uint256 i; i < 60; ++i) {
            if (low >= high) break;
            uint256 mid = low + (high - low + 1) / 2;
            if (costForShares(_outcome, _qYes, _qNo, _b, mid) <= _maxCost) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return low;
    }
}

/**
 * Calculate points for a single prediction.
 *
 * Scoring:
 *  - Exact score (win or draw)                       → 6 pts
 *  - Correct winner + 1 goal correct                 → 4 pts
 *  - Correct draw (wrong score)                      → 4 pts
 *  - Correct winner + 0 goals correct                → 3 pts
 *  - Wrong result + 1 goal correct                   → 1 pt
 *  - Wrong result + 0 goals correct                  → 0 pts
 *
 * Possible scores: 0, 1, 3, 4, 6
 */
export function calculatePoints(
  actualHome: number,
  actualAway: number,
  predictedHome: number,
  predictedAway: number
): number {
  // Exact score
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return 6;
  }

  const actualResult = Math.sign(actualHome - actualAway); // 1, 0, -1
  const predictedResult = Math.sign(predictedHome - predictedAway);
  const correctResult = actualResult === predictedResult;

  const homeGoalCorrect = predictedHome === actualHome ? 1 : 0;
  const awayGoalCorrect = predictedAway === actualAway ? 1 : 0;
  const goalsCorrect = homeGoalCorrect + awayGoalCorrect;

  if (correctResult) {
    // Correct draw (not exact — already handled above)
    if (actualResult === 0) return 4;
    // Correct winner
    return 3 + goalsCorrect; // 3 or 4
  }

  // Wrong result
  return goalsCorrect; // 0 or 1
}

/**
 * Determine result type: "home" | "draw" | "away"
 */
export function getResult(home: number, away: number): "home" | "draw" | "away" {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

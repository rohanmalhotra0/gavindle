export type LetterState = "correct" | "present" | "absent" | "empty";

export function evaluateGuess(guess: string, solution: string): LetterState[] {
  const length = solution.length;
  const states: LetterState[] = Array.from<LetterState>({ length }).fill("empty");

  const solutionChars = solution.split("");
  const guessChars = guess.split("");
  const remaining: Record<string, number> = {};

  // First pass: correct positions
  for (let i = 0; i < length; i++) {
    if (guessChars[i] === solutionChars[i]) {
      states[i] = "correct";
    } else {
      const c = solutionChars[i];
      remaining[c] = (remaining[c] ?? 0) + 1;
    }
  }

  // Second pass: present elsewhere honoring counts
  for (let i = 0; i < length; i++) {
    if (states[i] !== "empty") continue;
    const c = guessChars[i];
    if (remaining[c] && remaining[c] > 0) {
      states[i] = "present";
      remaining[c] -= 1;
    } else {
      states[i] = "absent";
    }
  }

  return states;
}

export function mergeKeyStates(
  prior: Record<string, LetterState>,
  guess: string,
  states: LetterState[]
): Record<string, LetterState> {
  const priority: Record<LetterState, number> = { correct: 3, present: 2, absent: 1, empty: 0 };
  const result = { ...prior };
  for (let i = 0; i < guess.length; i++) {
    const key = guess[i];
    const state = states[i];
    if (!result[key] || priority[state] > priority[result[key]]) {
      result[key] = state;
    }
  }
  return result;
}




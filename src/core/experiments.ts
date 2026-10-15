export interface Experiment {
  readonly id: string;
  readonly letter: string;
  readonly title: string;
  /** Input text loaded into the simulator. Empty for the custom experiment. */
  readonly sequence: string;
  /** What the sequence models. */
  readonly represents: string;
  readonly objective: string;
  /** What to watch while stepping. Guidance only: no precomputed results. */
  readonly observe: string;
}

export const EXPERIMENTS: readonly Experiment[] = [
  {
    id: 'loop',
    letter: 'A',
    title: 'Loop-like branch',
    sequence: 'T T T T T T T N',
    represents: 'The backward branch at the bottom of a loop that runs 8 times: taken 7 times to repeat the body, then not taken once to exit.',
    objective: 'Observe how each predictor behaves when a branch is mostly TAKEN and then exits the loop.',
    observe: 'Watch the first prediction (decided by the initial state) and the last one (the loop exit). Note the state each predictor is left in after the exit.',
  },
  {
    id: 'alternating',
    letter: 'B',
    title: 'Alternating outcomes',
    sequence: 'T N T N T N T N',
    represents: 'A branch whose direction flips every time, such as an if-statement testing whether a loop counter is even.',
    objective: 'Compare how the two predictor types react to an alternating branch pattern.',
    observe: 'Follow the state column. The 1-bit predictor always predicts the previous outcome; see where the 2-bit counter settles and what it predicts from there. Try different initial states.',
  },
  {
    id: 'mostly-nt',
    letter: 'C',
    title: 'Mostly NOT TAKEN',
    sequence: 'N N N N T N N N',
    represents: 'A rarely-taken branch, such as an error check that almost never fires.',
    objective: 'Observe prediction behavior when an occasional TAKEN outcome occurs in a mostly NOT TAKEN sequence.',
    observe: 'Look at the two branches after the single T: does the predictor recover immediately or does the anomaly cost a second misprediction?',
  },
  {
    id: 'independent',
    letter: 'D',
    title: 'Independent branch addresses',
    sequence: 'B1:T B2:N B1:T B2:N B1:N B2:T B1:T B2:N',
    represents: 'Two different branch instructions (B1 and B2) executing in an interleaved order.',
    objective: 'Verify that separate branch addresses maintain independent predictor states.',
    observe: 'Use the predictor table to switch between B1 and B2. The state before each step must equal the state after the previous step of the same address, never of the other branch.',
  },
  {
    id: 'custom',
    letter: 'E',
    title: 'Custom experiment',
    sequence: '',
    represents: 'Your own sequence: any mix of T/N outcomes, optionally tagged with branch addresses.',
    objective: 'Design a sequence to test a hypothesis, for example one where the 1-bit predictor outperforms the 2-bit predictor.',
    observe: 'Change the initial states and penalty and re-run to see which results depend on the configuration.',
  },
  {
    id: 'nested-loop',
    letter: 'F',
    title: 'Loop executed repeatedly',
    sequence: 'T T T N T T T N T T T N',
    represents: 'An inner loop of 4 iterations entered 3 times by an outer loop: the inner loop branch is taken 3 times, then exits, and the pattern repeats.',
    objective: 'See how each predictor handles a loop exit followed by re-entry into the same loop.',
    observe: 'Compare the predictions on the first branch of the second and third passes, right after each exit.',
  },
];

export function findExperiment(id: string): Experiment | undefined {
  return EXPERIMENTS.find((e) => e.id === id);
}

export function AboutPage() {
  return (
    <div className="doc-layout doc-layout--single">
      <article className="doc">
        <h1>About BranchLab</h1>
        <p className="lead">
          BranchLab is an academic project for Computer Organization and Architecture. It is an interactive simulator of 1-bit and 2-bit branch prediction for
          analysing prediction accuracy, mispredictions, branch penalties and estimated pipeline performance.
        </p>

        <h2>Objectives</h2>
        <ul>
          <li>Implement the 1-bit and 2-bit saturating-counter predictors with independent state per branch address.</li>
          <li>Let users build branch-outcome sequences, step through them one branch at a time and inspect every prediction and state update.</li>
          <li>Measure accuracy and mispredictions, and estimate penalty cycles, total cycles and CPI under a clearly stated pipeline model.</li>
          <li>Compare both predictors on identical inputs and explain the results.</li>
        </ul>

        <h2>How to demonstrate it</h2>
        <ol>
          <li>Load <strong>Experiment A</strong> and press <strong>Step Forward</strong> a few times. Point out that each prediction comes from the state <em>before</em> the update.</li>
          <li>Switch to <strong>2-bit</strong> and watch the highlighted state and arrow in the diagram follow the trace.</li>
          <li>Load <strong>Experiment F</strong>, choose <strong>Compare both</strong> and run it. The 1-bit predictor mispredicts both the loop exit and the re-entry.</li>
          <li>Load <strong>Experiment D</strong> to show that B1 and B2 keep separate entries in the predictor table.</li>
          <li>Change the penalty P or the initial states and re-run to show which results depend on the configuration.</li>
        </ol>

        <h2>Implementation</h2>
        <table className="data-table doc-table">
          <tbody>
            <tr><th scope="row">Stack</th><td>React 18, TypeScript, Vite; unit tests with Vitest. No backend, account or network access is needed.</td></tr>
            <tr><th scope="row">Predictor logic</th><td>Pure, UI-independent functions in <code>src/core</code>: <code>predictors.ts</code>, <code>simulator.ts</code>, <code>parser.ts</code>, <code>metrics.ts</code>, <code>pipeline.ts</code>, <code>analysis.ts</code>.</td></tr>
            <tr><th scope="row">Simulation</th><td>Each step reads the branch's entry, predicts from it, compares with the actual outcome and then updates the entry. Run Simulation repeats exactly the same step function.</td></tr>
            <tr><th scope="row">Comparison</th><td>Both predictors process the same event array with separate tables, so neither can influence the other.</td></tr>
            <tr><th scope="row">Charts</th><td>Drawn as plain SVG from the measured results; no charting library.</td></tr>
          </tbody>
        </table>

        <h2>Assumptions and limitations</h2>
        <ul>
          <li>The cycle model is <span className="mono">I + (L − 1) + M × P</span>: an ideal pipeline plus a fixed penalty per misprediction. Other stalls, cache misses and overlapping effects are ignored.</li>
          <li>Every branch address has its own predictor entry (no table size limit, no aliasing) and no branch target buffer is modelled.</li>
          <li>The branch sequence is an input trace; BranchLab does not execute real programs or measure real hardware.</li>
          <li>Real branch resolution stages and penalties vary by processor design.</li>
        </ul>
      </article>
    </div>
  );
}

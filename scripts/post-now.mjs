import { runOnce } from '../dist/jobs/runCycle.js';

runOnce()
  .then(() => {
    console.log('posted');
  })
  .catch(err => {
    console.error(err);
    process.exit(2);
  });

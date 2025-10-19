module.exports = {
  apps: [{
    name: 'aurora-signals',
    script: 'dist/index.js',
    env: { NODE_ENV: 'production' }
  }]
};

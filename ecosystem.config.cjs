module.exports = {
  apps: [{
    name: 'med-stack',
    script: 'bash',
    args: ['-c', 'docker compose up -d'],
    cwd: '/root',
    autorestart: false
  }]
};
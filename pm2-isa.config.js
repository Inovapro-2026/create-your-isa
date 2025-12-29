module.exports = {
  apps: [{
    name: 'whatsapp-isa-server',
    script: 'src/server.ts',
    interpreter: 'node',
    interpreter_args: '-r ts-node/register/transpile-only',
    cwd: '/root/INOVAPRO /whatsapp-isa',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};

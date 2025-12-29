module.exports = {
  apps: [{
    name: 'whatsapp-isa-multi',
    script: './examples/rest/multi-account-server.js',
    cwd: '/root/INOVAPRO /whatsapp-isa',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/root/INOVAPRO /whatsapp-isa/logs/err.log',
    out_file: '/root/INOVAPRO /whatsapp-isa/logs/out.log',
    log_file: '/root/INOVAPRO /whatsapp-isa/logs/combined.log',
    time: true
  }]
};
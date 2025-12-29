const wppconnect = require('./dist');

wppconnect
  .create({
    headless: true, // Run in headless mode for server deployment
    session: 'isa-session', // Named session for PM2 management
    browserArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--memory-pressure-off'
    ],
    executablePath: '/usr/bin/chromium-browser', // Use system chromium
  })
  .then((client) => start(client))
  .catch((error) => {
    console.log('Error starting WPPConnect:', error);
    process.exit(1);
  });

function start(client) {
  console.log('WPPConnect started successfully!');
  
  client.onMessage((message) => {
    console.log('Received message:', message.body);
    
    if (message.body === 'hi' && message.isGroupMsg === false) {
      client
        .sendText(message.from, 'Hello! This is WPPConnect running on PM2. 🤖')
        .then((result) => {
          console.log('Message sent successfully');
        })
        .catch((error) => {
          console.error('Error sending message:', error);
        });
    }
  });
  
  // Handle process termination
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, closing WPPConnect...');
    client.close();
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('Received SIGINT, closing WPPConnect...');
    client.close();
    process.exit(0);
  });
}

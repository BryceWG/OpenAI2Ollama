const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
    name: 'OpenAI2Ollama',
    description: 'OpenAI to Ollama Proxy Server',
    script: path.join(__dirname, 'index.js'),
    nodeOptions: [
        '--harmony',
        '--max_old_space_size=4096'
    ]
});

svc.on('install', function() {
    console.log('Service installed successfully!');
    console.log('Starting service...');
    svc.start();
});

svc.on('start', function() {
    console.log('Service started successfully!');
    console.log('OpenAI2Ollama is now running as a Windows service.');
});

svc.on('error', function(err) {
    console.error('Service error:', err);
});

console.log('Installing OpenAI2Ollama as Windows service...');
svc.install();
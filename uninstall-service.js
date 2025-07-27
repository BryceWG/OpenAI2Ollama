const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
    name: 'OpenAI2Ollama',
    script: path.join(__dirname, 'index.js')
});

svc.on('uninstall', function() {
    console.log('Service uninstalled successfully!');
});

svc.on('error', function(err) {
    console.error('Service error:', err);
});

console.log('Uninstalling OpenAI2Ollama Windows service...');
svc.uninstall();
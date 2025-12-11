
// ============================================================================
// Local Gun.js Relay Server
// ============================================================================
import { createServer } from "http";
import Gun from "gun";

const GUN_PORT = 8765;

const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-requested-with');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (Gun.serve(req, res)) {
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Gun relay running.');
});

// Initialize Gun with the server instance
const gun = Gun({ 
    web: server,
    file: 'radata',
});

server.listen(GUN_PORT, () => {
    console.log(`🔫 Gun relay running at http://localhost:${GUN_PORT}/gun`);
});

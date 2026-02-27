import { spawn } from 'child_process';
import axios from 'axios';
import * as path from 'path';

const PORT = 3000;
const HEALTH_URL = `http://localhost:${PORT}/health`;
const MAX_RETRIES = 30; // 30 seconds (assuming ~1s interval)
const CHECK_INTERVAL = 1000;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkHealth(): Promise<boolean> {
    try {
        const response = await axios.get(HEALTH_URL);
        if (response.status === 200 && response.data.status === 'ok') {
            return true;
        }
        console.log(`Health check status: ${response.status} ${JSON.stringify(response.data)}`);
        return false;
    } catch (error: any) {
        // If connection refused (server not up yet) or 503 (starting), return false
        if (error.code === 'ECONNREFUSED' || (error.response && error.response.status === 503)) {
            return false;
        }
        // Other errors might be fatal, but for smoke test we can retry
        console.log(`Health check error: ${error.message}`);
        return false;
    }
}

async function runSmokeTest() {
    console.log('🚀 Starting Smoke Test...');

    const botProcess = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, PORT: String(PORT) }
    });

    let healthCheckPassed = false;

    // Give it a moment to initialize spawn
    await sleep(2000);

    for (let i = 0; i < MAX_RETRIES; i++) {
        process.stdout.write('.');
        if (await checkHealth()) {
            console.log('\n✅ Health check passed!');
            healthCheckPassed = true;
            break;
        }
        await sleep(CHECK_INTERVAL);
    }

    if (!healthCheckPassed) {
        console.error('\n❌ Smoke test failed: Health check timed out.');
    }

    // Cleanup
    console.log('\n🛑 Stopping bot process...');
    botProcess.kill('SIGTERM');

    // Windows might need stronger kill
    if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', botProcess.pid!.toString(), '/f', '/t']);
    }

    process.exit(healthCheckPassed ? 0 : 1);
}

runSmokeTest().catch(err => {
    console.error('Test script error:', err);
    process.exit(1);
});

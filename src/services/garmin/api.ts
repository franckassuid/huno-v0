import { spawn } from 'child_process';
import path from 'path';

export async function fetchGarminDataFromPython(email?: string, password?: string): Promise<any> {

    // Check if running on Vercel (Production/Preview)
    // VERCEL_URL is automatically set by Vercel
    if (process.env.VERCEL_URL) {
        const protocol = 'https'; // Vercel is always https
        const url = `${protocol}://${process.env.VERCEL_URL}/api/garmin_py`;

        console.log("🚀 VERCEL DETECTED: Fetching from Python Serverless Function:", url);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Python API Error (${res.status}): ${text}`);
            }

            const json = await res.json();
            if (json.success === false) {
                throw new Error(json.error || 'Unknown Garmin API Error from Python');
            }
            return json;

        } catch (e: any) {
            console.error("Vercel Python Fetch Fail:", e);
            throw new Error(`Vercel Python Error: ${e.message}`);
        }
    }

    // --- LOCAL FALLBACK (Spawn) ---
    console.log("🏠 LOCAL DETECTED: Spawning Python script...");
    const scriptPath = path.join(process.cwd(), 'python', 'fetch_data.py');
    const args = [scriptPath];
    if (email && password) {
        args.push(email, password);
    }

    // We assume 'python3' is available. In some envs it might be 'python'.
    // Allow override via PYTHON_PATH env var
    const pythonCommand = process.env.PYTHON_PATH || 'python3';

    const pythonProcess = spawn(pythonCommand, args);

    let dataString = '';
    let errorString = '';

    return new Promise((resolve, reject) => {
        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorString += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Python script exited with code ${code}: ${errorString}`));
            }
            try {
                if (!dataString.trim()) {
                    return reject(new Error("Empty output from Python script"));
                }
                const json = JSON.parse(dataString.trim());
                if (json.success === false) {
                    return reject(new Error(json.error || 'Unknown Garmin API Error'));
                }
                resolve(json);
            } catch (e: any) {
                console.error("Failed to parse Python output:", dataString);
                reject(new Error(`JSON Parse Error: ${e.message}`));
            }
        });

        pythonProcess.on('error', (err) => {
            reject(err);
        });
    });
}

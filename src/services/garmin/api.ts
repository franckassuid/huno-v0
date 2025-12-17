import { spawn } from 'child_process';
import path from 'path';

export async function fetchGarminDataFromPython(email?: string, password?: string): Promise<any> {
    const scriptPath = path.join(process.cwd(), 'python', 'fetch_data.py');
    const args = [scriptPath];
    if (email && password) {
        args.push(email, password);
    }

    // We assume 'python3' is available. In some envs it might be 'python'.
    const pythonProcess = spawn('python3', args);

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

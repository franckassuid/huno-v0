
const { GarminConnect } = require('garmin-connect');
const path = require('path');
const fs = require('fs');

async function testSession() {
    console.log("Testing session loading...");
    const sessionPath = path.join('/tmp', 'session.json');
    console.log("Path:", sessionPath);

    if (fs.existsSync(sessionPath)) {
        const stats = fs.statSync(sessionPath);
        console.log("Is Directory:", stats.isDirectory());
        if (stats.isDirectory()) {
            console.log("Contents:", fs.readdirSync(sessionPath));
        }
    } else {
        console.log("Path does not exist.");
        return;
    }

    const gc = new GarminConnect({ username: 'dummy', password: 'dummy' });
    try {
        // Try loading
        await gc.loadTokenByFile(sessionPath); // If it expects file, this might fail on dir
        console.log("Success: Token loaded!");

        // Try simple profile fetch to verify
        const profile = await gc.getUserProfile();
        console.log("Profile Name:", profile.fullName);

        console.log("--- DIAGNOSTIC WELLNESS ---");
        const todayStr = new Date().toISOString().split('T')[0];
        console.log("Date:", todayStr);

        // Sleep
        try {
            console.log("Fetching Sleep...");
            const sleep = await gc.getSleepData(new Date(todayStr));
            console.log("Sleep Success:", sleep ? "Yes (Size: " + Object.keys(sleep).length + ")" : "NULL");
        } catch (e) { console.error("Sleep Error:", e.message, e.response?.statusCode); }

        // Body Battery (Direct)
        try {
            console.log("Fetching Body Battery...");
            const bb = await gc.client.get(`https://connect.garmin.com/wellness-service/wellness/dailyBodyBattery/${todayStr}/${todayStr}`);
            console.log("Body Battery Success:", bb ? "Yes" : "NULL");
        } catch (e) { console.error("Body Battery Error:", e.message, e.statusCode); }

        // Stress (Direct)
        try {
            console.log("Fetching Stress...");
            const stress = await gc.client.get(`https://connect.garmin.com/wellness-service/wellness/dailyStress/${todayStr}/${todayStr}`);
            console.log("Stress Success:", stress ? "Yes" : "NULL");
        } catch (e) { console.error("Stress Error:", e.message, e.statusCode); }

        // HRV (Direct)
        try {
            console.log("Fetching HRV...");
            const hrv = await gc.client.get(`https://connect.garmin.com/hrv-service/hrv/daily/${todayStr}/${todayStr}`);
            console.log("HRV Success:", hrv ? "Yes" : "NULL");
        } catch (e) { console.error("HRV Error:", e.message, e.statusCode); }

    } catch (e) {
        console.error("Error loading token:", e);

        // Experiment: if directory, try loading internal file?
        if (fs.existsSync(sessionPath) && fs.statSync(sessionPath).isDirectory()) {
            // garmin-connect usually wants the file that contains oauth1/2 tokens.
            // If it split them, we might be in trouble or need to load differently.
            console.log("Attempting to load specific JSON inside...");
            // No obvious API for loading partials, usually 'session.json' implies the file.
        }
    }
}

testSession();

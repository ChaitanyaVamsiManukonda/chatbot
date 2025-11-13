// test_invoke.js
// Simple script to invoke the Netlify function handler locally without Netlify CLI.
// It sends a dummy base64 payload so the function will exercise the audio save path.

const path = require('path');
const fs = require('fs');

(async () => {
  try {
    // Ensure the function module is loaded
    const handlerModule = require('./netlify/functions/ai-query');
    // Create a fake short text and base64-encode it to simulate audio
    const fakeContent = 'This is a fake audio file used for testing.';
    const fakeBase64 = Buffer.from(fakeContent).toString('base64');

    // Build a fake event similar to Netlify's
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        api: 'openai',
        messages: [],
        audio: fakeBase64,
        audioName: 'test_audio.txt',
        audioType: 'text/plain'
      })
    };

    // Set environment to avoid transcription attempt
    process.env.TRANSCRIBE_WITH_OPENAI = 'false';

    console.log('Invoking handler...');
    const result = await handlerModule.handler(event, {});
    console.log('Handler result:', result);

    // If the function saved a file, check tmp
    const os = require('os');
    const tmpDir = os.tmpdir();
    const possiblePath = path.join(tmpDir, 'test_audio.txt');
    if (fs.existsSync(possiblePath)) {
      console.log('Saved file exists at', possiblePath);
      console.log('Saved file content preview:', fs.readFileSync(possiblePath, 'utf8').slice(0,200));
    } else {
      console.log('Saved file not found at expected path; check function logs above.');
    }
  } catch (err) {
    console.error('Error invoking handler:', err);
    process.exit(1);
  }
})();

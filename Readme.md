# AI Chat Interface

A web-based interface for interacting with OpenAI and Anthropic AI models, designed to be deployed on GitHub Pages with Netlify Functions for backend support.

## Project Structure

```
.
├── index.html           # Main HTML page
├── app.js               # Frontend JavaScript
├── netlify.toml         # Netlify configuration
├── netlify/functions/   # Serverless functions directory
│   └── ai-query.js      # AI API serverless function
└── package.json         # Project dependencies
```

## Setup Instructions

### 1. Prerequisites

- GitHub account
- Netlify account (free tier works fine)
- OpenAI API key
- Anthropic API key

### 2. GitHub Setup

1. Create a new GitHub repository
2. Clone the repository to your local machine
3. Add all files from this project to the repository
4. Push the changes to GitHub

### 3. Netlify Setup

1. Log in to Netlify and click "New site from Git"
2. Select your GitHub repository
3. Configure build settings:
   - Build command: leave blank
   - Publish directory: `.`
4. Click "Deploy site"

### 4. Configure Environment Variables

1. In Netlify dashboard, go to Site settings > Environment variables
2. Add the following environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `ANTHROPIC_API_KEY`: Your Anthropic API key

### 5. Connect to GitHub Pages (Optional)

1. If you want to use your GitHub Pages domain (`username.github.io`), you can set up a custom domain in Netlify:
   - Go to Site settings > Domain management
   - Add custom domain
   - Enter your GitHub Pages domain
   - Follow the instructions to configure DNS settings

## Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the project root with environment variables:
   - Copy `.env.example` as a template: `cp .env.example .env`
   - Edit `.env` and add your configuration:
     ```
     SITE_PASSWORD=12345
     OPENAI_API_KEY=your_openai_key_here
     ANTHROPIC_API_KEY=your_anthropic_key_here
     TRANSCRIBE_WITH_OPENAI=false
     ```
   - **Important**: Never commit `.env` to git. Add `.env` to your `.gitignore` if not already there.

3. Switch to Node LTS (18 or 20) if not already on it. Using nvm (macOS/Linux):
   ```
   nvm install 18
   nvm use 18
   ```

4. Start the local development server:
   ```
   npx netlify dev
   ```

5. Open `http://localhost:8888` in your browser
   - You'll be redirected to the login page. Enter the password you set in `.env` (e.g., 12345).
   - After login, use the microphone feature, chat, and test recording/playback.

## Security Notes

- API keys are stored as environment variables in Netlify and are never exposed to the client
- All API requests are processed through Netlify Functions, which acts as a secure proxy
- HTTPS is enabled by default for all Netlify sites

## Features

- Support for both OpenAI and Anthropic (Claude) APIs
- Model selection
- Image upload capability
- Chat history with message threading
- Responsive design that works on mobile and desktop
- **Voice-triggered RAG training**: Record audio, transcribe it, and train the RAG model with your voice input.

## Microphone / Voice recording & RAG Training

This project includes a simple microphone recorder in the chat UI with integrated RAG training. Features:

- **Record audio** from your browser (click the 🎤 button).
- **Live speech-to-text** (Web Speech API) in supporting browsers — transcribe as you speak.
- **Play back and download** recorded audio.
- **Train RAG with transcript** — after recording, click "📚 Train RAG with transcript" to add your transcript to the retrieval index.
- **Send audio to server** for processing and optional cloud transcription.

### Voice-to-RAG Training Workflow

1. Click 🎤 to start recording audio.
2. Speak naturally into your microphone. The browser's live speech-to-text will capture your words as you speak.
3. Stop recording when done (the timer will show how long you recorded).
4. After recording, you'll see:
   - **Insert transcript** — adds the transcript to the chat input.
   - **📚 Train RAG with transcript** — saves the transcript as a training document in the retrieval index.
   - **Send audio** — sends the audio file to the server for optional cloud transcription.
5. Click **Train RAG with transcript** to add your voice input to the model's knowledge base.
6. Your transcript is now indexed and will be retrieved when relevant queries are asked.

### Optional Server Transcription

- If you want the Netlify function to automatically transcribe uploaded audio using OpenAI's transcription endpoint, set:
   - `OPENAI_API_KEY` (your OpenAI key)
   - `TRANSCRIBE_WITH_OPENAI=true`
- The function requires the `form-data` package:
```
npm install form-data
```

### RAG Index Management

- The retrieval index is stored in `data/index.json` (generated automatically).
- **Ingest API**: Send documents to `/.netlify/functions/ingest`:
  ```json
  {
    "docs": [
      { "id": "doc1", "title": "My Document", "text": "Content here" },
      { "id": "doc2", "title": "Another Doc", "text": "More content" }
    ],
    "mode": "append"
  }
  ```
  - `mode: "append"` (default) — adds docs to existing index.
  - `mode: "replace"` — replaces entire index with new docs.

- **Query with retrieval**: When you send a message, if no LLM API keys are configured, you'll receive the top-K retrieved documents from the index (zero-cost retrieval). If API keys are present, retrieved docs are injected as context before calling the LLM.

### Privacy and Browser Support

- Audio is recorded locally and only uploaded when you click "Send audio" or "Train RAG with transcript".
- Live speech-to-text uses the Web Speech API (free, runs in browser) — available in Chrome/Edge with webkit prefixes.
- Server-side transcription uses OpenAI APIs and will send audio to their servers — configure only if you accept data transmission.
- Training transcripts are added to a local JSON index (`data/index.json`) and are not sent to external services unless you enable LLM calls.

````

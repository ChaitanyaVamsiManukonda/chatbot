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

2. Create a `.env` file with your API keys:
   ```
   OPENAI_API_KEY=your_openai_key_here
   ANTHROPIC_API_KEY=your_anthropic_key_here
   ```

3. Start the local development server:
   ```
   npx netlify dev
   ```

4. Open `http://localhost:8888` in your browser

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
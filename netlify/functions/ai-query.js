// netlify/functions/ai-query.js
const fetch = require('node-fetch');
require('dotenv').config();

// Default models
const OPENAI_DEFAULT_MODEL = 'gpt-4.1-2025-04-14';
const CLAUDE_DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // Parse request body
        const data = JSON.parse(event.body);
        const { api, messages } = data;

        // Validate API selection
        if (api !== 'openai' && api !== 'anthropic') {
            throw new Error('Invalid API selection');
        }

        // Get API keys from environment variables
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

        console.log(`OpenAI API Key defined: ${Boolean(OPENAI_API_KEY)}`);
        console.log(`Anthropic API Key defined: ${Boolean(ANTHROPIC_API_KEY)}`);

        let response;
        let assistantMessage;

        if (api === 'openai') {
            // Call OpenAI API
            if (!OPENAI_API_KEY) {
                throw new Error('OpenAI API key is not configured');
            }

            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: OPENAI_DEFAULT_MODEL,
                    messages: messages,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('OpenAI API Error:', errorData);
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const responseData = await response.json();
            assistantMessage = responseData.choices[0].message.content;
        } else {
            // Call Anthropic API
            if (!ANTHROPIC_API_KEY) {
                throw new Error('Anthropic API key is not configured');
            }

            // Format messages for Anthropic API
            const formattedMessages = messages.map(msg => ({
                role: msg.role,
                content: typeof msg.content === 'string' 
                    ? [{ type: 'text', text: msg.content }] 
                    : msg.content
            }));

            response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'anthropic-version': '2023-06-01',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: CLAUDE_DEFAULT_MODEL,
                    messages: formattedMessages,
                    max_tokens: 1024,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Anthropic API Error:', errorData);
                throw new Error(`Anthropic API error: ${response.status}`);
            }

            const responseData = await response.json();
            
            // Check if the response has content array and extract the text
            if (responseData.content && Array.isArray(responseData.content)) {
                // Find the first text content
                const textContent = responseData.content.find(item => item.type === 'text');
                if (textContent && textContent.text) {
                    assistantMessage = textContent.text;
                } else {
                    throw new Error('Unexpected response format from Anthropic API');
                }
            } else {
                throw new Error('Unexpected response format from Anthropic API');
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: assistantMessage })
        };
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
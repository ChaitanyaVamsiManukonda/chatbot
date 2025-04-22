// netlify/functions/ai-query.js
const fetch = require('node-fetch');

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
        const { api, model, messages } = data;

        // Get API keys from environment variables
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
                    model: model,
                    messages: messages,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
            }

            const responseData = await response.json();
            assistantMessage = responseData.choices[0].message.content;
        } else {
            // Call Anthropic API
            if (!ANTHROPIC_API_KEY) {
                throw new Error('Anthropic API key is not configured');
            }

            // Format messages for Anthropic API
            response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'anthropic-version': '2023-06-01',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    max_tokens: 1024,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Anthropic API error: ${JSON.stringify(errorData)}`);
            }

            const responseData = await response.json();
            assistantMessage = responseData.content[0].text;
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

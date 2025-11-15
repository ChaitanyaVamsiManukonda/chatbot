exports.handler = async function(event, context) {
    // Support GET to check whether a password is required, and POST to validate.
    const SITE_PASSWORD = process.env.SITE_PASSWORD;

    if (event.httpMethod === 'GET') {
        // Return whether password protection is enabled
        return {
            statusCode: 200,
            body: JSON.stringify({ required: Boolean(SITE_PASSWORD) })
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // Parse request body
        const data = JSON.parse(event.body || '{}');
        const { password } = data;

        // If no SITE_PASSWORD configured, authentication is not required — accept any login
        if (!SITE_PASSWORD) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Authentication not required' })
            };
        }

        if (password === SITE_PASSWORD) {
            // Correct password
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Authentication successful' })
            };
        } else {
            // Incorrect password
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Authentication failed' })
            };
        }
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

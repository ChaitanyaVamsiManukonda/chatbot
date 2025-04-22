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
        const { password } = data;
        
        // Get correct password from environment variable
        const SITE_PASSWORD = process.env.SITE_PASSWORD;
        
        if (!SITE_PASSWORD) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Site password not configured' })
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

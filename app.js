document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const apiSelection = document.getElementById('apiSelection');
    const openaiModels = document.getElementById('openaiModels');
    const claudeModels = document.getElementById('claudeModels');
    const messageForm = document.getElementById('messageForm');
    const userInput = document.getElementById('userInput');
    const messagesContainer = document.getElementById('messages');
    const clearChatBtn = document.getElementById('clearChat');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const imageInput = document.getElementById('imageInput');
    const imageStatus = document.getElementById('imageStatus');
    const loader = document.getElementById('loader');

    // Conversation history
    let conversationHistory = [];
    let currentImageBase64 = null;
    let currentImageType = null;

    // API selection change handler
    apiSelection.addEventListener('change', function() {
        if (this.value === 'openai') {
            openaiModels.style.display = 'block';
            claudeModels.style.display = 'none';
        } else {
            openaiModels.style.display = 'none';
            claudeModels.style.display = 'block';
        }
    });

    // Form submission handler
    messageForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const userMessage = userInput.value.trim();
        
        if (userMessage === '') return;
        
        // Add user message to UI
        addMessageToUI('user', userMessage);
        userInput.value = '';
        
        // Show loader
        loader.style.display = 'block';
        
        try {
            // Get selected API and model
            const api = apiSelection.value;
            const model = api === 'openai' 
                ? document.getElementById('openaiModel').value
                : document.getElementById('claudeModel').value;
            
            // Prepare message content
            let messageContent;
            
            if (currentImageBase64) {
                if (api === 'openai') {
                    // OpenAI format for images
                    messageContent = [
                        { type: "text", text: userMessage },
                        { 
                            type: "image_url", 
                            image_url: {
                                url: `data:${currentImageType};base64,${currentImageBase64}`
                            }
                        }
                    ];
                } else {
                    // Claude format for images
                    messageContent = [
                        { type: "text", text: userMessage },
                        { 
                            type: "image", 
                            source: {
                                type: "base64",
                                media_type: currentImageType,
                                data: currentImageBase64
                            }
                        }
                    ];
                }
                
                // Clear image after sending
                currentImageBase64 = null;
                currentImageType = null;
                imageStatus.textContent = '';
            } else {
                messageContent = userMessage;
            }
            
            // Add message to history
            if (typeof messageContent === 'string') {
                conversationHistory.push({
                    role: "user",
                    content: messageContent
                });
            } else {
                // For multimodal content, we handle it differently
                conversationHistory.push({
                    role: "user",
                    content: messageContent
                });
            }
            
            // Call the serverless function
            const response = await fetch('/.netlify/functions/ai-query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    api: api,
                    model: model,
                    messages: conversationHistory
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();
            const assistantMessage = data.message;
            
            // Add assistant message to UI
            addMessageToUI('assistant', assistantMessage);
            
            // Add to conversation history
            conversationHistory.push({
                role: "assistant",
                content: assistantMessage
            });
        } catch (error) {
            console.error('Error:', error);
            addMessageToUI('assistant', `Error: ${error.message}. Please try again.`);
        } finally {
            // Hide loader
            loader.style.display = 'none';
        }
    });

    // Clear chat button handler
    clearChatBtn.addEventListener('click', function() {
        messagesContainer.innerHTML = `
            <div class="assistant-message">
                Hello! I'm an AI assistant. How can I help you today?
            </div>
        `;
        conversationHistory = [];
        currentImageBase64 = null;
        currentImageType = null;
        imageStatus.textContent = '';
    });

    // Image upload button handler
    uploadImageBtn.addEventListener('click', function() {
        imageInput.click();
    });

    // Image selection handler
    imageInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64String = e.target.result.split(',')[1]; // Remove data URL prefix
                currentImageBase64 = base64String;
                currentImageType = file.type;
                imageStatus.textContent = `Image ready: ${file.name}`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Function to add message to UI
    function addMessageToUI(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = role === 'user' ? 'user-message self-end' : 'assistant-message';
        
        // Handle markdown in assistant messages
        if (role === 'assistant') {
            // This is a simple markdown parser for code blocks, could be replaced with a library
            let formattedContent = content
                .replace(/```([a-z]*)([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded overflow-x-auto"><code>$2</code></pre>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
            
            messageDiv.innerHTML = formattedContent;
        } else {
            messageDiv.textContent = content;
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});
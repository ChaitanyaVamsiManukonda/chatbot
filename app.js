document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const apiSelection = document.getElementById('apiSelection');
    const messageForm = document.getElementById('messageForm');
    const userInput = document.getElementById('userInput');
    const messagesContainer = document.getElementById('messages');
    const clearChatBtn = document.getElementById('clearChat');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const imageInput = document.getElementById('imageInput');
    const imageStatus = document.getElementById('imageStatus');
    const loader = document.getElementById('loader');
    const micBtn = document.getElementById('micBtn');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const voiceControls = document.getElementById('voiceControls');
    const recordedAudio = document.getElementById('recordedAudio');
    const downloadAudioBtn = document.getElementById('downloadAudioBtn');
    const sendAudioBtn = document.getElementById('sendAudioBtn');
    const insertTranscriptBtn = document.getElementById('insertTranscriptBtn');
    const sttSupportNote = document.getElementById('sttSupportNote');
    const allowServerUpload = document.getElementById('allowServerUpload');
    const useSttToggle = document.getElementById('useSttToggle');
    const sttTips = document.getElementById('sttTips');
    const sendBtn = document.getElementById('sendBtn');
    const recordingTimer = document.getElementById('recordingTimer');
    const showSourcesToggle = document.getElementById('showSourcesToggle');

    // Conversation history
    let conversationHistory = [];
    let currentImageBase64 = null;
    let currentImageType = null;
    // Recording state
    let mediaRecorder = null;
    let audioChunks = [];
    let latestAudioBlob = null;
    let isRecording = false;
    // SpeechRecognition (optional live transcription)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    let recognition = null;
    let latestTranscript = '';
    let recordingInterval = null;
    let recordingStart = null;

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
            // Get selected API
            const api = apiSelection.value;
            
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
                    messages: conversationHistory
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();
            const assistantMessage = data.message;

            // If the user requested sources, show retrieved documents as a separate assistant message
            if (showSourcesToggle && showSourcesToggle.checked && data.retrieved && data.retrieved.length > 0) {
                showRetrievedSources(data.retrieved);
            }
            
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

    // Microphone / recording handlers
    micBtn.addEventListener('click', async function() {
        if (isRecording) {
            // stop
            stopRecording();
            return;
        }

        // start recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.addEventListener('dataavailable', e => {
                if (e.data && e.data.size > 0) audioChunks.push(e.data);
            });

            mediaRecorder.addEventListener('stop', () => {
                latestAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(latestAudioBlob);
                recordedAudio.src = url;
                recordedAudio.style.display = 'inline-block';
                downloadAudioBtn.href = url;
                downloadAudioBtn.download = `recording_${Date.now()}.webm`;
                downloadAudioBtn.style.display = 'inline-block';
                insertTranscriptBtn.style.display = SpeechRecognition ? 'inline-block' : 'none';
                trainWithTranscriptBtn.style.display = (SpeechRecognition && latestTranscript) ? 'inline-block' : 'none';
                voiceControls.classList.remove('hidden');
            });

            mediaRecorder.start();
            isRecording = true;
            recordingIndicator.style.display = 'inline';
            // show timer and start counting
            if (recordingTimer) {
                recordingTimer.style.display = 'inline';
                recordingStart = Date.now();
                recordingInterval = setInterval(() => {
                    const elapsed = Date.now() - recordingStart;
                    const seconds = Math.floor(elapsed / 1000) % 60;
                    const minutes = Math.floor(elapsed / 60000);
                    recordingTimer.textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
                }, 250);
            }
            // disable other controls while recording
            if (sendBtn) sendBtn.disabled = true;
            if (uploadImageBtn) uploadImageBtn.disabled = true;
            userInput.disabled = true;
            voiceControls.classList.remove('hidden');
            micBtn.textContent = '⏹️';

            // If browser supports SpeechRecognition, run it live to capture transcript
            if (SpeechRecognition && useSttToggle && useSttToggle.checked) {
                recognition = new SpeechRecognition();
                recognition.interimResults = true;
                recognition.continuous = true;
                // Set recognition language to the browser locale for better accuracy
                recognition.lang = navigator.language || 'en-US';
                latestTranscript = '';

                recognition.addEventListener('result', (ev) => {
                    // Build a transcript string consisting of all final results (more stable)
                    let finalTranscript = '';
                    let interimTranscript = '';
                    for (let i = 0; i < ev.results.length; ++i) {
                        const res = ev.results[i];
                        if (res.isFinal) finalTranscript += (res[0].transcript + ' ');
                        else interimTranscript += (res[0].transcript + ' ');
                    }
                    // Prefer final transcript (more accurate); show interim as hint
                    latestTranscript = finalTranscript.trim() || interimTranscript.trim();
                    if (finalTranscript.trim()) {
                        sttSupportNote.textContent = `Transcript: ${latestTranscript}`;
                    } else if (interimTranscript.trim()) {
                        sttSupportNote.textContent = `Listening... ${interimTranscript.trim()}`;
                    } else {
                        sttSupportNote.textContent = '';
                    }
                });

                recognition.addEventListener('end', () => {
                    // Restart recognition automatically while recording and toggle is on
                    if (isRecording && useSttToggle && useSttToggle.checked) {
                        try { recognition.start(); } catch (e) { /* ignore */ }
                    }
                });

                recognition.start();
                sttSupportNote.textContent = 'Live transcription enabled';
                if (sttTips) sttTips.style.display = 'block';
            } else if (!SpeechRecognition) {
                sttSupportNote.textContent = 'SpeechRecognition not supported in this browser.';
                if (sttTips) sttTips.style.display = 'none';
            } else {
                sttSupportNote.textContent = 'Live transcription is disabled (toggle off).';
            }

        } catch (err) {
            console.error('Could not start recording:', err);
            addMessageToUI('assistant', 'Microphone access denied or not available.');
            isRecording = false;
            recordingIndicator.style.display = 'none';
            micBtn.textContent = '🎤';
        }
    });

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream && mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }
        if (recognition) {
            try { recognition.stop(); } catch (e) { }
            recognition = null;
        }
        isRecording = false;
        recordingIndicator.style.display = 'none';
        micBtn.textContent = '🎤';
        // stop and reset timer
        if (recordingInterval) {
            clearInterval(recordingInterval);
            recordingInterval = null;
        }
        if (recordingTimer) {
            recordingTimer.textContent = '00:00';
            recordingTimer.style.display = 'none';
        }
        // re-enable controls
        if (sendBtn) sendBtn.disabled = false;
        if (uploadImageBtn) uploadImageBtn.disabled = false;
        userInput.disabled = false;
    }

    // Download button is an anchor, set href when blob created
    downloadAudioBtn.addEventListener('click', function(ev) {
        // It's an anchor; the href is set when recording stops
    });

    // Insert live transcript into user input
    insertTranscriptBtn.addEventListener('click', function() {
        if (latestTranscript) {
            userInput.value = (userInput.value + ' ' + latestTranscript).trim();
        } else {
            addMessageToUI('assistant', 'No transcript available.');
        }
    });

    // Train RAG model with transcript
    const trainWithTranscriptBtn = document.getElementById('trainWithTranscriptBtn');
    const trainingStatus = document.getElementById('trainingStatus');

    trainWithTranscriptBtn.addEventListener('click', async function() {
        if (!latestTranscript) {
            addMessageToUI('assistant', 'No transcript available to train with.');
            return;
        }

        trainingStatus.textContent = 'Training...';
        trainingStatus.style.display = 'inline';

        try {
            // Create a training document from the transcript
            const trainingDoc = {
                id: `transcript_${Date.now()}`,
                title: 'Voice Transcript',
                text: latestTranscript
            };

            // Call the ingest function to add this transcript to the RAG index
            const resp = await fetch('/.netlify/functions/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docs: [trainingDoc] })
            });

            const result = await resp.json();
            if (!resp.ok) {
                throw new Error(result.error || `Server error ${resp.status}`);
            }

            trainingStatus.textContent = `✓ RAG trained with transcript (${result.indexed} doc indexed)`;
            trainingStatus.style.color = 'green';
            setTimeout(() => {
                trainingStatus.style.display = 'none';
            }, 3000);

            addMessageToUI('assistant', `✓ Successfully trained RAG model with your transcript: "${latestTranscript.substring(0, 50)}..."`);
        } catch (err) {
            console.error('Error training RAG:', err);
            trainingStatus.textContent = `✗ Training failed: ${err.message}`;
            trainingStatus.style.color = 'red';
            addMessageToUI('assistant', `Error training RAG: ${err.message}`);
        }
    });

    // Send recorded audio to serverless function
    sendAudioBtn.addEventListener('click', async function() {
        // Safety: require explicit user opt-in before uploading audio to server to avoid accidental API charges
        if (allowServerUpload && !allowServerUpload.checked) {
            addMessageToUI('assistant', 'Server upload is disabled. Toggle "Allow server upload" to enable sending recorded audio to the server (may incur charges).');
            return;
        }
        if (!latestAudioBlob) {
            addMessageToUI('assistant', 'No audio recorded yet.');
            return;
        }

        const blobToBase64 = (blob) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result; // data:audio/webm;base64,...
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        try {
            const base64 = await blobToBase64(latestAudioBlob);
            loader.style.display = 'block';

            const payload = {
                api: apiSelection.value,
                messages: conversationHistory,
                audio: base64,
                audioName: `recording_${Date.now()}.webm`,
                audioType: latestAudioBlob.type
            };

            const resp = await fetch('/.netlify/functions/ai-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await resp.json();
            if (!resp.ok) {
                throw new Error(result.error || `Server error ${resp.status}`);
            }

            if (result.transcript) {
                addMessageToUI('assistant', `Transcription: ${result.transcript}`);
                userInput.value = (userInput.value + ' ' + result.transcript).trim();
                conversationHistory.push({ role: 'user', content: result.transcript });
            }

            if (result.message) {
                addMessageToUI('assistant', result.message);
                conversationHistory.push({ role: 'assistant', content: result.message });
            }

            // Show retrieved sources if requested (audio flow)
            if (showSourcesToggle && showSourcesToggle.checked && result.retrieved && result.retrieved.length > 0) {
                showRetrievedSources(result.retrieved);
            }
        } catch (err) {
            console.error('Error sending audio:', err);
            addMessageToUI('assistant', `Error sending audio: ${err.message}`);
        } finally {
            loader.style.display = 'none';
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

    function showRetrievedSources(retrieved) {
        const container = document.createElement('div');
        container.className = 'assistant-message';
        let html = '<strong>Retrieved sources:</strong><br>';
        retrieved.forEach((r, i) => {
            const excerpt = (r.text || '').substring(0, 240).replace(/\n/g, ' ');
            html += `<div class="mt-2"><em>[${i+1}] ${r.title || 'doc'}</em>: ${excerpt}</div>`;
        });
        container.innerHTML = html;
        messagesContainer.appendChild(container);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});
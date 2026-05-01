import { useState, useEffect } from 'react';

export const useIgnitionVoice = (onCommand, voiceMode) => {
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    // This is the mock for the WebSpeech API (Scribe AI)
    // If voiceMode is PROXIMITY_WAKE, it constantly listens.
    // For now, we will safely return false so the iPad doesn't crash during testing.
    
    // In production:
    // const recognition = new webkitSpeechRecognition();
    // ...
  }, [voiceMode, onCommand]);

  return { isListening };
};
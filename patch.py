import re

with open("frontend/src/pages/candidate/LiveInterview.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace states
content = re.sub(
    r"const \[isListening, setIsListening\] = useState\(false\);\n  const \[currentSpeech, setCurrentSpeech\] = useState\(''\);",
    "const [isRecording, setIsRecording] = useState(false);\n  const [isTranscribing, setIsTranscribing] = useState(false);\n  const mediaRecorderRef = useRef(null);\n  const audioChunksRef = useRef([]);",
    content
)

# Remove setupSpeechRecognition definition and its call
content = re.sub(
    r"// 3\. Setup Speech Recognition\n\s*setupSpeechRecognition\(data\.language\);\n",
    "",
    content
)

setup_speech_regex = r"const setupSpeechRecognition = \(lang\) => \{.*?\};\n\n"
content = re.sub(setup_speech_regex, "", content, flags=re.DOTALL)

# Remove recognitionRef.current.stop() in cleanup
content = re.sub(
    r"if \(recognitionRef\.current\) \{\n\s*recognitionRef\.current\.stop\(\);\n\s*\}\n",
    "if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {\n        mediaRecorderRef.current.stop();\n      }\n",
    content
)

# Update manualListenToggle
listen_toggle = """const toggleRecording = () => {
    if (!stream || status !== 'active' || !micOn) return;
    
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      window.speechSynthesis.cancel(); // Stop AI speaking if user interrupts
      audioChunksRef.current = [];
      const options = { mimeType: 'audio/webm' };
      try {
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setIsTranscribing(true);
          try {
            const res = await interviewAPI.transcribe(audioBlob);
            if (res.data.text) {
              setAnswerText(prev => prev + (prev ? ' ' : '') + res.data.text);
            }
          } catch (err) {
            console.error("Transcription error:", err);
            setErrorMsg("Transcription failed. Please try again or type your answer.");
          } finally {
            setIsTranscribing(false);
          }
        };
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (e) {
        console.error("MediaRecorder start error:", e);
        setErrorMsg("Your browser does not support audio recording.");
      }
    }
  };"""

content = re.sub(
    r"const manualListenToggle = \(\) => \{.*?\n  \};\n",
    listen_toggle + "\n",
    content,
    flags=re.DOTALL
)

# Update speech synthesis onend
content = re.sub(
    r"utterance\.onend = \(\) => \{\n.*?\}\s*\} catch\(e\) \{\} // Ignore if already started\n\s*\}\n\s*\};",
    "utterance.onend = () => {\n      // No automatic recording start in Whisper mode\n    };",
    content,
    flags=re.DOTALL
)

# Update toggleMic
content = re.sub(
    r"if \(audioTrack\.enabled && recognitionRef.*?\}\n\s*\}\n",
    "if (!audioTrack.enabled && isRecording && mediaRecorderRef.current) {\n          mediaRecorderRef.current.stop();\n          setIsRecording(false);\n        }\n      }\n",
    content,
    flags=re.DOTALL
)

# Update handleCandidateResponse
content = re.sub(
    r"if \(recognitionRef\.current\) \{\n\s*try \{ recognitionRef\.current\.stop\(\); \} catch\(e\) \{\}\n\s*setIsListening\(false\);\n\s*\}",
    "if (mediaRecorderRef.current && isRecording) {\n        mediaRecorderRef.current.stop();\n        setIsRecording(false);\n      }",
    content
)

# Update UI elements
content = content.replace("isListening", "isRecording")
content = content.replace("manualListenToggle", "toggleRecording")
content = content.replace("{currentSpeech && (", "{isTranscribing && (\n            <div className=\"live-caption\">\n              Transcribing audio with AI...\n            </div>\n          )}\n          {false && (")

with open("frontend/src/pages/candidate/LiveInterview.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched.")

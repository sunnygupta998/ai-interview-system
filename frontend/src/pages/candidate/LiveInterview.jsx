import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { interviewAPI } from '../../api/api';
import { FiMic, FiMicOff, FiVideo, FiVideoOff } from 'react-icons/fi';
import io from 'socket.io-client';
import './LiveInterview.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const LiveInterview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPractice = location.pathname.includes('/practice/');
  
  const videoRef = useRef(null);
  const audioRef = useRef(new Audio());
  
  const [interviewId, setInterviewId] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [language, setLanguage] = useState('English');
  const [status, setStatus] = useState('initializing');
  const [errorMsg, setErrorMsg] = useState('');
  const [tabSwitches, setTabSwitches] = useState(0);
  const [aiIsSpeaking, setAiIsSpeaking] = useState(false);
  const [aiStreamingText, setAiStreamingText] = useState('');
  
  // Media states
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null);
  
  // Audio Analysis for Interruption
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // WebSockets
  const socketRef = useRef(null);
  
  const recognitionRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const micBarsRef = useRef([]);

  useEffect(() => {
    let activeStream = null;
    let isMounted = true;
    
    // Setup Socket
    socketRef.current = io(SOCKET_URL);
    
    socketRef.current.on('connect', () => {
      console.log('Socket connected');
    });

    socketRef.current.on('status_update', (data) => {
      setStatus(data.status); // transcribing, thinking, speaking, idle
      if (data.status === 'speaking') {
        setAiIsSpeaking(true);
      } else if (data.status === 'idle') {
        setAiIsSpeaking(false);
      }
    });

    socketRef.current.on('transcript_update', (data) => {
      // User transcript came back from server
      setTranscript(prev => [...prev, { role: 'candidate', content: data.text, timestamp: new Date().toISOString() }]);
      setIsTranscribing(false);
    });

    socketRef.current.on('llm_start', () => {
      setAiStreamingText('');
      // Optimistically push a temporary empty AI message that we will stream into
      setTranscript(prev => [...prev, { role: 'ai', content: '', timestamp: new Date().toISOString(), isStreaming: true }]);
    });

    socketRef.current.on('llm_token', (data) => {
      setAiStreamingText(prev => prev + data.token);
      setTranscript(prev => {
        const newTrans = [...prev];
        const lastMsg = newTrans[newTrans.length - 1];
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content += data.token;
        }
        return newTrans;
      });
    });

    socketRef.current.on('llm_end', (data) => {
      setTranscript(prev => {
        const newTrans = [...prev];
        const lastMsg = newTrans[newTrans.length - 1];
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = data.full_text;
          delete lastMsg.isStreaming;
        }
        return newTrans;
      });
      setAiStreamingText('');
    });

    socketRef.current.on('tts_audio', (data) => {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audioData = `data:audio/mp3;base64,${data.audio}`;
        audioRef.current.src = audioData;
        audioRef.current.play().catch(e => console.error("TTS Play Error:", e));
        setAiIsSpeaking(true);
        audioRef.current.onended = () => setAiIsSpeaking(false);
      } catch (e) {
        console.error("Socket TTS Error:", e);
      }
    });
    
    socketRef.current.on('tts_browser_fallback', (data) => {
      speakText(data.text, language);
    });
    
    socketRef.current.on('error', (data) => {
      console.error("Socket Error:", data.message);
      setIsTranscribing(false);
      setStatus('idle');
      alert(`Server Error: ${data.message}`);
    });

    const initInterview = async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        if (!isMounted) {
          localStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        activeStream = localStream;
        setStream(activeStream);
        streamRef.current = activeStream;
        
        // Setup Audio Analyser for Interruptions
        setupAudioAnalyser(activeStream);

        let res;
        if (isPractice) {
          res = await interviewAPI.startPractice(id);
        } else {
          res = await interviewAPI.start(id);
        }
        const data = res.data;
        
        if (data.status === 'completed') {
          setStatus('completed');
          setTranscript(data.transcript || []);
          return;
        }
        
        setInterviewId(data.interview_id);
        setTranscript(data.transcript);
        setLanguage(data.language);
        setStatus('idle');
        
        socketRef.current.emit('join_interview', { interview_id: data.interview_id });
                
        if (data.first_question) {
          setTranscript(prev => [...prev, { role: 'ai', content: data.first_question, timestamp: new Date().toISOString() }]);
          speakText(data.first_question, data.language);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setStatus('error');
        setErrorMsg("Camera and Microphone access is required for the live interview.");
      }
    };

    initInterview();

    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      window.speechSynthesis.cancel();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [id, isPractice]);
  
  const setupAudioAnalyser = (mediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(mediaStream);
      source.connect(analyser);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      
      monitorAudioLevel();
    } catch (e) {
      console.error("Failed to setup audio analyser", e);
    }
  };
  
  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const averageVolume = sum / dataArray.length;
    
    // INTERRUPTION LOGIC: If candidate speaks loudly (> 30) while AI is talking, cut AI off!
    // Using a ref or checking aiIsSpeaking inside the loop can be tricky with closures,
    // so we rely on the audioRef's actual play state and window.speechSynthesis
    if (averageVolume > 30) {
      if (audioRef.current && !audioRef.current.paused) {
        console.log("INTERRUPTION DETECTED! Stopping AI Audio.");
        audioRef.current.pause();
        setAiIsSpeaking(false);
      }
      if (window.speechSynthesis.speaking) {
        console.log("INTERRUPTION DETECTED! Stopping TTS.");
        window.speechSynthesis.cancel();
        setAiIsSpeaking(false);
      }
    }
    
    // Update visualizer bars
    if (micBarsRef.current && micBarsRef.current.length > 0) {
      const step = Math.floor(dataArray.length / 5);
      for (let i = 0; i < 5; i++) {
        let bandSum = 0;
        for (let j = 0; j < step; j++) {
          bandSum += dataArray[i * step + j];
        }
        const bandAvg = bandSum / step;
        const height = Math.max(4, Math.min(24, (bandAvg / 255) * 30));
        if (micBarsRef.current[i]) {
          micBarsRef.current[i].style.height = `${height}px`;
        }
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
  };

  useEffect(() => {
    if (isPractice) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPractice]);

  useEffect(() => {
    if (isPractice) return;
    
    if (tabSwitches === 1 || tabSwitches === 2) {
      alert(`WARNING: You are not allowed to switch tabs during the live interview. This is strike ${tabSwitches} of 3. On the 3rd strike, your interview will be instantly terminated.`);
    } else if (tabSwitches >= 3) {
      alert("You have switched tabs too many times. Your interview is being terminated and a score of 0 will be recorded.");
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      setStatus('processing');
      interviewAPI.end(interviewId, { tab_switches: tabSwitches, cheating_detected: true })
        .then(() => {
          setStatus('completed');
          if (socketRef.current) socketRef.current.disconnect();
        })
        .catch(err => {
          console.error("Error terminating:", err);
          navigate('/candidate/dashboard');
        });
    }
  }, [tabSwitches, isPractice, interviewId, navigate]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream, status]);

  const speakText = async (text, lang) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      let selectedVoice = null;
      
      if (lang === 'English') {
        selectedVoice = voices.find(v => v.name.includes('Google UK English Female')) ||
                        voices.find(v => v.name.includes('Microsoft Zira'));
        utterance.lang = 'en-US';
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.rate = 0.95;
      
      utterance.onstart = () => setAiIsSpeaking(true);
      utterance.onend = () => setAiIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Browser TTS error:", err);
    }
  };

  const endInterview = async () => {
    if (!window.confirm("Are you sure you want to end the interview?")) return;
    
    try {
      setStatus('processing');
      
      // Stop Camera and Mic immediately to switch off hardware indicators
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        setCameraOn(false);
        setMicOn(false);
        setStream(null);
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
      
      // Pass proctoring data directly via standard HTTP route
      await interviewAPI.end(interviewId, { tab_switches: tabSwitches });
      
      setStatus('completed');
      if (socketRef.current) socketRef.current.disconnect();
    } catch (err) {
      console.error("Error ending interview:", err);
      alert("Failed to end interview. Please try again.");
      setStatus('idle');
    }
  };

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
        
        if (!audioTrack.enabled && isRecording && mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      }
    }
  };

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOn(videoTrack.enabled);
      }
    }
  };
  
  const toggleRecording = () => {
    if (!stream || !micOn) return;
    
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      if (audioRef.current) audioRef.current.pause(); 
      window.speechSynthesis.cancel(); 
      audioChunksRef.current = [];
      
      try {
        const audioTrack = stream.getAudioTracks()[0];
        const audioStream = new MediaStream([audioTrack]);
        const mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
          setIsTranscribing(true);
          
          // Convert Blob to ArrayBuffer for reliable Socket.IO transmission
          const reader = new FileReader();
          reader.onload = () => {
            if (socketRef.current) {
              socketRef.current.emit('submit_audio', {
                interview_id: interviewId,
                audio: reader.result,
                target_question_count: 5 // Default questions
              });
            }
          };
          reader.readAsArrayBuffer(audioBlob);
        };
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (e) {
        console.error("MediaRecorder start error:", e);
        setErrorMsg("Your browser does not support audio recording. " + e.message);
      }
    }
  };

  if (status === 'initializing') {
    return (
      <div className="live-interview-container initializing-state">
        <div className="spinner"></div>
        <p>Connecting to secure AI Interview server...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="live-interview-container error-state">
        <h3>Interview Connection Failed</h3>
        <p>{errorMsg}</p>
        <button className="btn btn-primary" onClick={() => navigate('/candidate/dashboard')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="live-interview-container completed-state">
        <div className="glass-card success-card animate-fade">
          <h2>Interview Completed Successfully</h2>
          <p>Thank you for your time. The AI is analyzing your responses.</p>
          <div className="completed-actions"style={{ display: 'flex',justifyContent: 'space-around',padding: '20px' }}>
            <button className="btn btn-primary" onClick={() => navigate('/candidate/dashboard')}>
              Return to Dashboard
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(`/candidate/results/${id}`)}>
              View Detailed Results
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="live-interview-container">
      <div className="interview-header">
        <div className="interview-title">
          <h2>Live AI Interview</h2>
          <span className="live-badge"><span className="pulse-dot"></span> Live</span>
        </div>
        <div className="interview-controls">
          <button className="btn btn-danger btn-sm" onClick={endInterview} disabled={status === 'processing' || status === 'thinking' || status === 'transcribing'}>
            End Interview
          </button>
        </div>
      </div>

      <div className="interview-workspace">
        <div className="main-video-area">
          <div className="video-wrapper">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={cameraOn ? '' : 'hidden-video'}
            ></video>
            {!cameraOn && (
              <div className="camera-off-placeholder">
                <FiVideoOff size={48} color="var(--text-muted)" />
                <p>Camera is disabled</p>
              </div>
            )}
            
            <div className="ai-overlay">
              <div className={`ai-avatar ${aiIsSpeaking ? 'speaking' : ''}`}>
                <div className="ai-rings">
                  <div className="ring ring-1"></div>
                  <div className="ring ring-2"></div>
                  <div className="ring ring-3"></div>
                </div>
                <div className="ai-core">
                  <span>AI</span>
                </div>
              </div>
              <div className="ai-status">
                {aiIsSpeaking ? 'AI is speaking...' : (status === 'thinking' ? 'AI is thinking...' : (isRecording ? 'Listening to you...' : 'Waiting for you to Answer...'))}
              </div>
            </div>
            
            <div className="media-controls-overlay">
              <div className="mic-visualizer" title="Microphone Volume">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="mic-bar" ref={el => micBarsRef.current[i] = el}></div>
                ))}
              </div>
              
              <button className={`media-btn ${micOn ? 'on' : 'off'}`} onClick={toggleMic} title={micOn ? "Mute Microphone" : "Unmute Microphone"}>
                {micOn ? <FiMic /> : <FiMicOff />}
              </button>
              
              {/* PRIMARY PUSH TO TALK BUTTON */}
              <button 
                className={`ptt-button ${isRecording ? 'recording' : ''}`}
                onClick={toggleRecording}
                disabled={!micOn || status === 'thinking' || status === 'transcribing'}
              >
                {isRecording ? 'Stop Answering' : 'Answer'}
              </button>
              
              <button className={`media-btn ${cameraOn ? 'on' : 'off'}`} onClick={toggleCamera} title={cameraOn ? "Turn off Camera" : "Turn on Camera"}>
                {cameraOn ? <FiVideo /> : <FiVideoOff />}
              </button>
            </div>
          </div>
        </div>

        <div className="transcript-panel">
          <h3>Live Transcript</h3>
          <div className="transcript-scroll-area">
            {transcript.length === 0 && <p className="empty-transcript">The interview will begin shortly. Click "Answer" to speak when you are ready.</p>}
            
            {transcript.map((msg, idx) => (
              <div key={idx} className={`transcript-message ${msg.role}`}>
                <div className="message-sender">{msg.role === 'ai' ? 'AI Recruiter' : 'You'}</div>
                <div className="message-content">{msg.content}</div>
                {msg.isStreaming && <span className="streaming-cursor">█</span>}
              </div>
            ))}
            
            {isTranscribing && (
              <div className="transcript-message candidate transcribing">
                <div className="message-sender">You</div>
                <div className="message-content typing-indicator">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              </div>
            )}
            
            {status === 'thinking' && !aiStreamingText && (
              <div className="transcript-message ai thinking">
                <div className="message-sender">AI Recruiter</div>
                <div className="message-content typing-indicator">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveInterview;

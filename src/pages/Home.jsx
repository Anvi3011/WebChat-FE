import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Form.css";
import "./Home.css";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { 
  FiSend, 
  FiVideo, 
  FiUser, 
  FiImage, 
  FiLogOut, 
  FiMic, 
  FiMicOff, 
  FiVideoOff, 
  FiPhoneOff 
} from "react-icons/fi";
import { io } from "socket.io-client";

// Public Google STUN Servers (Completely free connection route helpers)
const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function Home() {
  let [chat, setChat] = useState([]);
  let [message, setMessage] = useState("");
  let [username, setUsername] = useState(null);
  
  // Real-time presence and typing
  let [onlineUsers, setOnlineUsers] = useState({}); 
  let [typingUsers, setTypingUsers] = useState({});
  let [isTypingState, setIsTypingState] = useState(false);

  // Calling states
  let [callingUser, setCallingUser] = useState(null); 
  let [incomingCall, setIncomingCall] = useState(null);
  let [isCallActive, setIsCallActive] = useState(false);
  let [activePeerName, _setActivePeerName] = useState(null);
  
  // Audio & Video Toggles
  let [isMuted, setIsMuted] = useState(false);
  let [isCameraOff, setIsCameraOff] = useState(false);

  let socketRef = useRef(null); 
  let endRef = useRef(null);
  let typingTimeoutRef = useRef(null);
  
  // WebRTC Media references
  let pcRef = useRef(null);
  let localStreamRef = useRef(null);
  let remoteStreamRef = useRef(null);

  // Keep a reference of the active call partner to avoid stale socket closures
  let activePeerNameRef = useRef(null);

  let auth = getAuth();
  let nav = useNavigate();

  function setActivePeerName(name) {
    activePeerNameRef.current = name;
    _setActivePeerName(name);
  }

  useEffect(() => {
    function checkUser(user) {
      if (!user) nav("/login");
      else setUsername(user.email);
    }
    let stopWatching = onAuthStateChanged(auth, checkUser);
    return () => stopWatching();
  }, [nav, auth]);

  // SOCKET AND WEBRTC SIGNALING LIFECYCLE
  useEffect(() => {
    if (!username) return; 

    socketRef.current = io("https://webchat-be.onrender.com", {
      query: { username: username }
    });

    const socket = socketRef.current;

    socket.on("history", (data) => setChat(data));
    socket.emit("getHistory");
    socket.on("message", (data) => setChat((prev) => [...prev, data]));

    // Handle global user status lists (both initial and live updates) from MongoDB
    socket.on("user_statuses", (data) => {
      const statusMap = {};
      data.forEach(item => {
        statusMap[item.username] = { status: item.status, lastSeen: item.lastSeen };
      });
      setOnlineUsers(statusMap);

      // If our active call partner goes offline, end the call immediately
      if (activePeerNameRef.current) {
        const partnerStatus = statusMap[activePeerNameRef.current];
        if (partnerStatus && partnerStatus.status === "offline") {
          cleanupMedia();
        }
      }
    });

    // Handle individual status change broadcast events
    socket.on("user_status_change", (data) => {
      setOnlineUsers((prev) => {
        const updated = { 
          ...prev, 
          [data.username]: { status: data.status, lastSeen: data.lastSeen } 
        };
        
        // If our active call partner goes offline, end the call immediately
        if (data.status === "offline" && activePeerNameRef.current === data.username) {
          cleanupMedia();
        }
        
        return updated;
      });
    });

    // Handle typing states
    socket.on("display_typing", (data) => {
      setTypingUsers((prev) => ({ ...prev, [data.username]: data.isTyping }));
    });

    // WEBRTC SIGNALING EVENTS:
    // A. Receive notification that another user is calling us
    socket.on("incoming_call", ({ from, offer }) => {
      setIncomingCall({ from, offer });
    });

    // B. Target user accepted our call offer
    socket.on("call_accepted", async ({ answer }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setIsCallActive(true);
      }
    });

    // C. Handle incoming network routing packets
    socket.on("ice_candidate", async ({ candidate }) => {
      if (pcRef.current && candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      }
    });

    // D. Remote user hung up
    socket.on("call_ended", () => {
      cleanupMedia();
    });

    return () => {
      socket.off("history");
      socket.off("message");
      socket.off("user_statuses");
      socket.off("display_typing");
      socket.off("incoming_call");
      socket.off("call_accepted");
      socket.off("ice_candidate");
      socket.off("call_ended");
      socket.disconnect();
    };
  }, [username]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, typingUsers]);

  // Callback refs to assign srcObject when video elements mount
  const localVideoCallback = (el) => {
    if (el) {
      el.srcObject = localStreamRef.current;
    }
  };

  const remoteVideoCallback = (el) => {
    if (el) {
      el.srcObject = remoteStreamRef.current;
    }
  };

  // CORE CALLING MECHANICS
  async function startCall(targetUser) {
    setActivePeerName(targetUser);
    setCallingUser(targetUser);
    
    try {
      // 1. Capture user webcam and audio hardware
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;

      // 2. Instantiate peer-to-peer connection
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      // Stream out local tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Listen for incoming media streams
      pc.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        setIsCallActive(true);
      };

      // Send discovered local network paths
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit("ice_candidate", { to: targetUser, candidate: event.candidate });
        }
      };

      // 3. Formulate Connection Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socketRef.current.emit("call_user", { to: targetUser, offer });
    } catch (err) {
      console.error("Failed to start call:", err);
      alert("Could not access camera or microphone. Please check system permissions.");
      cleanupMedia();
    }
  }

  async function acceptCall() {
    if (!incomingCall) return;
    const targetUser = incomingCall.from;
    setActivePeerName(targetUser);
    setIsCallActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        // Trigger re-render to invoke callback ref
        setIsCallActive(true);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit("ice_candidate", { to: targetUser, candidate: event.candidate });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit("answer_call", { to: targetUser, answer });
      setIncomingCall(null);
    } catch (err) {
      console.error("Failed to accept call:", err);
      alert("Could not access camera or microphone.");
      cleanupMedia();
    }
  }

  function endCall() {
    const peer = activePeerNameRef.current || callingUser || (incomingCall ? incomingCall.from : null);
    if (peer && socketRef.current) {
      socketRef.current.emit("end_call", { to: peer });
    }
    cleanupMedia();
  }

  function cleanupMedia() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    remoteStreamRef.current = null;
    setCallingUser(null);
    setIncomingCall(null);
    setIsCallActive(false);
    setActivePeerName(null);
    setIsMuted(false);
    setIsCameraOff(false);
  }

  function toggleMute() {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  }

  function handleInputChange(e) {
    setMessage(e.target.value);
    if (!socketRef.current) return;

    if (!isTypingState) {
      setIsTypingState(true);
      socketRef.current.emit("typing_state", { isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingState(false);
      socketRef.current.emit("typing_state", { isTyping: false });
    }, 3000);
  }

  function sendMessage() {
    if (username && message.trim() && socketRef.current) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setIsTypingState(false);
      socketRef.current.emit("typing_state", { isTyping: false });
      socketRef.current.emit("message", { username, message: message.trim() });
      setMessage("");
    }
  }

  // Format last seen timestamp relatively
  function formatLastSeen(isoString) {
    if (!isoString) return "never";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }

  const typingUsernames = Object.keys(typingUsers).filter(user => typingUsers[user] && user !== username);

  return (
    <div className="chat-layout-container">
      {/* Sidebar - Left section */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-logo">💬</span>
            <span className="brand-name">WebChat</span>
          </div>
          <div className="current-user-info">
            <div className="avatar-circle">
              {username ? username.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="user-details">
              <span className="user-email" title={username}>{username}</span>
              <span className="user-status-badge">Online</span>
            </div>
          </div>
        </div>

        <div className="sidebar-actions">
          <button className="action-btn btn-profile" onClick={() => nav("/profile")} title="Profile">
            <FiUser size={16} />
            <span>Profile</span>
          </button>
          <button className="action-btn btn-snaps" onClick={() => nav("/photos")} title="Snaps">
            <FiImage size={16} />
            <span>Snaps</span>
          </button>
          <button className="action-btn btn-logout" onClick={() => signOut(auth).then(() => nav("/login"))} title="Logout">
            <FiLogOut size={16} />
            <span>Logout</span>
          </button>
        </div>

        <div className="sidebar-contacts-section">
          <h3 className="section-title">Members</h3>
          <div className="contacts-list">
            {Object.keys(onlineUsers).map((user) => {
              if (user === username) return null;
              const isOnline = onlineUsers[user].status === "online";
              const lastSeenVal = onlineUsers[user].lastSeen;
              return (
                <div key={user} className="contact-item">
                  <div className="contact-avatar">
                    {user.charAt(0).toUpperCase()}
                    <span className={`status-indicator-dot ${isOnline ? "online" : "offline"}`} />
                  </div>
                  <div className="contact-info">
                    <span className="contact-name" title={user}>{user}</span>
                    <span className="contact-status-text">
                      {isOnline ? "Active now" : `Last seen ${formatLastSeen(lastSeenVal)}`}
                    </span>
                  </div>
                  {isOnline && (
                    <button className="contact-call-btn" onClick={() => startCall(user)} title="Call Member">
                      <FiVideo size={15} />
                    </button>
                  )}
                </div>
              );
            })}
            {Object.keys(onlineUsers).filter(u => u !== username).length === 0 && (
              <div className="no-contacts">No other members discovered</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Workspace - Right section */}
      <div className="chat-main-workspace">
        <div className="chat-workspace-header">
          <div className="room-info">
            <h2 className="room-name">General Lounge</h2>
            <p className="room-description">Real-time chat room and video channel</p>
          </div>
        </div>

        <div className="chat-messages-container">
          {chat.map((data, index) => {
            const isMe = data.username && username && data.username.trim().toLowerCase() === username.trim().toLowerCase();
            return (
              <div key={index} className={`message-row ${isMe ? "row-sent" : "row-received"}`}>
                {!isMe && (
                  <div className="message-avatar">
                    {data.username ? data.username.charAt(0).toUpperCase() : "?"}
                  </div>
                )}
                <div className="message-bubble-wrapper">
                  {!isMe && <span className="message-sender-name">{data.username}</span>}
                  <div className={`message-bubble ${isMe ? "bubble-sent" : "bubble-received"}`}>
                    {data.message}
                  </div>
                </div>
              </div>
            );
          })}
          
          {typingUsernames.length > 0 && (
            <div className="message-row row-received">
              <div className="message-avatar typing-avatar">💬</div>
              <div className="typing-indicator-bubble">
                <span className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
                <span className="typing-text">
                  {typingUsernames.join(", ")} {typingUsernames.length === 1 ? "is" : "are"} typing...
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="chat-input-container">
          <div className="chat-input-bar">
            <input
              type="text"
              className="chat-text-input"
              placeholder="Type a message..."
              value={message}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
            />
            <button className="chat-send-btn" onClick={sendMessage} disabled={!message.trim()}>
              <FiSend size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Incoming Call Overlay Alert Banner */}
      {incomingCall && (
        <div className="incoming-call-alert-banner">
          <div className="alert-content">
            <div className="alert-avatar">
              {incomingCall.from.charAt(0).toUpperCase()}
            </div>
            <div className="alert-info">
              <span className="alert-title">Incoming Call</span>
              <span className="alert-subtitle">{incomingCall.from} is calling...</span>
            </div>
          </div>
          <div className="alert-actions">
            <button onClick={acceptCall} className="btn-call-accept">Accept</button>
            <button onClick={cleanupMedia} className="btn-call-decline">Decline</button>
          </div>
        </div>
      )}

      {/* WebRTC Video calling HUD Overlay */}
      {(callingUser || isCallActive) && (
        <div className="video-calling-hud-overlay">
          <div className="video-calling-card">
            <div className="card-header">
              <span className="card-title">
                {isCallActive ? `In Call with ${activePeerName}` : `Calling ${callingUser}...`}
              </span>
              <span className="connection-status-dot pulse-animation" />
            </div>
            <div className="streams-view-viewport">
              {/* Remote Stream is the full background */}
              {isCallActive ? (
                <video ref={remoteVideoCallback} autoPlay playsInline className="remote-stream-view" />
              ) : (
                <div className="calling-spinner-container">
                  <div className="calling-avatar">
                    {activePeerName ? activePeerName.charAt(0).toUpperCase() : "?"}
                  </div>
                  <span className="calling-label">Connecting peer...</span>
                </div>
              )}
              {/* Local Stream is PIP in the corner */}
              <video 
                ref={localVideoCallback} 
                autoPlay 
                playsInline 
                muted 
                className={`local-stream-pip ${isCameraOff ? "camera-off" : ""}`} 
              />
              {/* Controls overlaid on video */}
              <div className="card-controls-row">
                <div className="control-btn-wrapper">
                  <button 
                    onClick={toggleMute} 
                    className={`control-circle-btn ${isMuted ? "active-alert" : ""}`}
                    title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                  >
                    {isMuted ? <FiMicOff size={22} /> : <FiMic size={22} />}
                  </button>
                  <span className="control-btn-label">{isMuted ? "Unmute" : "Mute"}</span>
                </div>
                <div className="control-btn-wrapper">
                  <button 
                    onClick={toggleCamera} 
                    className={`control-circle-btn ${isCameraOff ? "active-alert" : ""}`}
                    title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
                  >
                    {isCameraOff ? <FiVideoOff size={22} /> : <FiVideo size={22} />}
                  </button>
                  <span className="control-btn-label">{isCameraOff ? "Camera On" : "Camera Off"}</span>
                </div>
                <div className="control-btn-wrapper">
                  <button 
                    onClick={endCall} 
                    className="control-circle-btn end-call-btn"
                    title="End Call"
                  >
                    <FiPhoneOff size={22} />
                  </button>
                  <span className="control-btn-label">End Call</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
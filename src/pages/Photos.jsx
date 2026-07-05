import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { FiPlus, FiArrowLeft, FiImage } from "react-icons/fi";
import axios from "axios";
import "./Form.css";
import "./Photos.css";

let API = "https://webchat-be.onrender.com";

function Photos() {
  let [files, setFiles] = useState([]);
  let [file, setFile] = useState(null);
  let [caption, setCaption] = useState("");
  let [uploading, setUploading] = useState(false);
  let [showForm, setShowForm] = useState(false);
  let [email, setEmail] = useState(null);
  let endRef = useRef(null);

  let auth = getAuth();
  let nav = useNavigate();

  useEffect(() => {
    let unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) nav("/login");
      else setEmail(user.email);
    });
    return () => unsubscribe();
  }, [nav, auth]);

  let loadFiles = () => {
    axios.get(`${API}/files`)
      .then((res) => setFiles(res.data))
      .catch((err) => alert(err));
  };

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [files]);

  let closeForm = () => {
    setShowForm(false);
    setFile(null);
    setCaption("");
  };

  let handleUpload = (event) => {
    event.preventDefault();

    if (!file) {
      alert("Please choose an image");
      return;
    }
    if (caption.trim() === "") {
      alert("Caption cannot be empty");
      return;
    }

    let formData = new FormData();
    formData.append("file", file);
    formData.append("caption", caption.trim());
    formData.append("username", email);

    setUploading(true);
    axios.post(`${API}/upload`, formData)
      .then(() => {
        closeForm();
        loadFiles();
      })
      .catch((err) => alert(err))
      .finally(() => setUploading(false));
  };

  let handleDelete = (id) => {
    axios.delete(`${API}/delete/${id}`)
      .then(() => loadFiles())
      .catch((err) => alert(err));
  };

  return (
    <div className="photos-layout-container">
      {/* Top Header Navigation */}
      <div className="photos-header">
        <div className="header-brand" onClick={() => nav("/home")}>
          <span className="brand-logo">📸</span>
          <span className="brand-name">Snaps Feed</span>
        </div>
        
        <div className="header-actions">
          <button className="photos-btn btn-add-snap" onClick={() => setShowForm(true)}>
            <FiPlus size={16} />
            <span>Add Snap</span>
          </button>
          <button className="photos-btn btn-back-home" onClick={() => nav("/home")}>
            <FiArrowLeft size={16} />
            <span>Lounge</span>
          </button>
        </div>
      </div>

      {/* Main Grid Feed */}
      <div className="photos-grid-viewport">
        <div className="photos-grid-feed">
          {files.map((item) => {
            let mine = item.username === email;
            return (
              <div className="snap-card" key={item._id}>
                <div className="snap-card-header">
                  <div className="snap-creator-info">
                    <div className="snap-creator-avatar">
                      {item.username ? item.username.charAt(0).toUpperCase() : "?"}
                    </div>
                    <span className="snap-creator-email" title={item.username}>
                      {item.username}
                    </span>
                  </div>
                  {mine && (
                    <button
                      className="snap-delete-btn"
                      onClick={() => handleDelete(item._id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
                
                <div className="snap-card-media">
                  <img className="snap-image" src={item.file_url} alt={item.caption} />
                </div>
                
                <div className="snap-card-footer">
                  <p className="snap-caption">{item.caption}</p>
                </div>
              </div>
            );
          })}
        </div>

        {files.length === 0 && (
          <div className="no-snaps-placeholder">
            <FiImage size={40} className="placeholder-icon" />
            <p>No snaps uploaded yet. Be the first to share one!</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Upload Snap Modal */}
      {showForm && (
        <div className="photos-modal-overlay" onClick={closeForm}>
          <div className="photos-modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>New Snap</h2>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label>Choose Image</label>
                <div className="file-input-wrapper">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="custom-file-input"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Caption</label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption..."
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="submit" disabled={uploading} className="btn-upload">
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button type="button" onClick={closeForm} className="btn-cancel">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Photos;

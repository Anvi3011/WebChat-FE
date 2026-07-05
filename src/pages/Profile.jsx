
import { useNavigate } from "react-router-dom";
import "./Form.css";
import { getAuth, reauthenticateWithCredential, EmailAuthProvider, deleteUser, onAuthStateChanged, updatePassword } from "firebase/auth";
import { useState, useEffect } from "react";

function Profile(){

  let auth = getAuth();
  let nav = useNavigate();

  let [activeTab, setActiveTab] = useState(null);

  useEffect(()=>{
    let unsubscribe = onAuthStateChanged(auth,(user)=>{
      if(!user) nav("/login");
    });
    return ()=>unsubscribe();
  } , [] );

  let handleDeleteDetails = () => {
    setActiveTab("delete");
  };

  let handleChangePassword = () => {
    setActiveTab("changePassword");
  };

  let handleSubmit = async (event) => {
    event.preventDefault();

    if(activeTab === "changePassword")
    {
      let newPassword = event.target.newPassword.value;
      let confirmPassword = event.target.confirmPassword.value;

      if(newPassword !== confirmPassword)
      {
        alert("Not Same");
        return;
      }

      updatePassword(auth.currentUser, newPassword)
      .then(()=>{
        alert("Password Changed Successful");
        setActiveTab(null);
      })
      .catch((error)=>alert(error))
      return;
    }

    if(activeTab === "delete")
    {
      if(event.target.confirmText.value !== "CONFIRM")
      {
        alert("Type CONFIRM to delete");
        return;
      }
      deleteUser(auth.currentUser)
      .then(()=>{
        alert("Account Deleted");
        nav("/login");
      })
      .catch((error)=>alert(error))
    }
  };

  let handleBackToHome = () => {
    nav("/home");
  };

  return (
    <div className="container">
      <div className="form-box">
        <h2>My Profile</h2>

        <div className="button-group">
          <button onClick={handleChangePassword} style={{ backgroundColor: "#ffc107", padding: "8px", fontSize: "14px" }}>
            Change Password
          </button>

          <button onClick={handleDeleteDetails} style={{ backgroundColor: "#dc3545", padding: "8px", fontSize: "14px" }}>
            Delete Details
          </button>
        </div>

        {activeTab === "changePassword" && (
          <form onSubmit={handleSubmit} style={{ marginTop: "20px", textAlign: "left" }}>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                name="newPassword"
                placeholder="Enter your new password"


                required
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm your new password"


                required
              />
            </div>
            <button type="submit" style={{ backgroundColor: "#ffc107", width: "100%" }}>
              Change Password
            </button>
          </form>
        )}

        {activeTab === "delete" && (
          <form onSubmit={handleSubmit} style={{ marginTop: "20px", textAlign: "left" }}>
            <div className="form-group">
              <label>Confirm Deletion</label>
              <p style={{ color: "#ccc", marginBottom: "10px" }}>
                Are you sure you want to delete your account? This action cannot be undone.
              </p>
              <p style={{ color: "#ccc", marginBottom: "10px", fontSize: "12px" }}>
                Type <strong>CONFIRM</strong> in the box below to proceed.
              </p>
              <input
                type="text"
                name="confirmText"
                placeholder="Type CONFIRM to delete"


                required
              />
            </div>
            <button type="submit" style={{ backgroundColor: "#dc3545", width: "100%" }}>
              Delete Account
            </button>
          </form>
        )}

        <button onClick={handleBackToHome} style={{ marginTop: "20px", width: "100%", backgroundColor: "#6c757d", padding: "12px" }}>
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default Profile;


import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, updatePassword, onAuthStateChanged } from "firebase/auth";
import "./Form.css";  

function ChangePassword(){
  let [newPassword, setNewPassword] = useState("");
  let [confirmPassword, setConfirmPassword] = useState("");
  
  let auth = getAuth();
    let nav = useNavigate();

    useEffect(()=>{
      let unsubscribe = onAuthStateChanged(auth,(user)=>{
        if(!user) nav("/login");
      });
      return ()=>unsubscribe();
    } , [] );

    let handleSubmit = (event)=>{
          event.preventDefault();
          if(newPassword===confirmPassword)
          {
            updatePassword(auth.currentUser,newPassword)
            .then(()=>{
              alert("Password Changed Successful");
              nav("/home"); //DOT MAT MAR
            })
            .catch((error)=>alert(error))
            .finally(()=>{
              setNewPassword("");
              setConfirmPassword("");
            })
          }
          else
          {
            alert("Not Same");
            setNewPassword("");
            setConfirmPassword("");
          }
    } 
  return (
    <div className="container">
      <div className="form-box">
        <h2>Change Password</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Enter new password"
            />
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm new password"
            />
          </div>

          <button type="submit">Change Password</button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
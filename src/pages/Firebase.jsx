// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDbsl1cje_TmPG1DCa2XywNzaPQqdLuUKs",
  authDomain: "auth-30-11-2006.firebaseapp.com",
  projectId: "auth-30-11-2006",
  storageBucket: "auth-30-11-2006.firebasestorage.app",
  messagingSenderId: "197845097232",
  appId: "1:197845097232:web:afcc7c7b35704a1faf2395",
  measurementId: "G-J6LNQWD1G6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export default app;
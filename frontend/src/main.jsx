import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { LanguageProvider } from "./context/LanguageContext";

import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

ReactDOM.createRoot(document.getElementById("root")).render(
  <LanguageProvider>
    <App />
    <ToastContainer
      position="top-center"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable={false}
      theme="dark"
      toastClassName="diasense-centered-toast"
      bodyClassName="diasense-toast-body"
      progressClassName="diasense-toast-progress"
      limit={3}
    />
  </LanguageProvider>
);

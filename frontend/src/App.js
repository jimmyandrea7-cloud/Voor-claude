import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ScanWizard from "./pages/ScanWizard";
import ScanResult from "./pages/ScanResult";
import Unlock from "./pages/Unlock";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import { PaymentSuccess, PaymentCancel } from "./pages/Payment";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/scan" element={<ProtectedRoute><ScanWizard /></ProtectedRoute>} />
      <Route path="/scan/:scanId" element={<ProtectedRoute><ScanWizard /></ProtectedRoute>} />
      <Route path="/report/:scanId" element={<ProtectedRoute><ScanResult /></ProtectedRoute>} />
      <Route path="/unlock/:scanId" element={<ProtectedRoute><Unlock /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
      <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
      <Route path="/payment/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-center" theme="light" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

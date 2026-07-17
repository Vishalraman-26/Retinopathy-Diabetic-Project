import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import PatientList from './pages/PatientList';
import PatientDetails from './pages/PatientDetails';
import Dashboard from './pages/Dashboard';
import ReportView from './pages/ReportView';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/patients" element={<PatientList />} />
        <Route path="/patient/:id" element={<PatientDetails />} />
        <Route path="/patient/:id/scan" element={<Dashboard />} />
        <Route path="/patient/:id/report/:visitId" element={<ReportView />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Users, ChevronRight, Plus, Search } from 'lucide-react';

export default function PatientList() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({ first_name: '', last_name: '', medical_id: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch('http://localhost:8000/api/patients/', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.status === 401) {
          navigate('/login');
          return;
        }

        const data = await response.json();
        setPatients(data);
      } catch (err) {
        console.error('Failed to fetch patients', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [navigate]);

  const handleAddPatient = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/patients/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPatient)
      });
      
      if (response.ok) {
        const data = await response.json();
        setPatients([data, ...patients]);
        setIsModalOpen(false);
        setNewPatient({ first_name: '', last_name: '', medical_id: '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Topbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-teal-600 p-2 rounded-lg text-white">
            <Eye size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">RetinaScan <span className="text-teal-600">PRO</span></h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 hidden sm:flex">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            System Online
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('access_token');
              navigate('/login');
            }}
            className="text-sm font-bold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-2"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-1">Patient Directory</h2>
            <p className="text-slate-500">Manage patients and view their retinal scan history.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md active:scale-95"
          >
            <Plus size={20} /> Add Patient
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 text-slate-400">Loading patients...</div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center shadow-sm">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Users size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Patients Found</h3>
            <p className="text-slate-500 mb-6">Add your first patient to begin using the system.</p>
            <button onClick={() => setIsModalOpen(true)} className="text-teal-600 font-semibold hover:text-teal-700">
              + Add Patient
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {patients.map(patient => (
              <div 
                key={patient.id} 
                onClick={() => navigate(`/patient/${patient.id}`)}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-teal-50 p-3 rounded-full text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{patient.first_name} {patient.last_name}</h3>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">ID: {patient.medical_id}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-sm text-slate-500">
                    {patient.last_visit_date ? `Last Visit: ${new Date(patient.last_visit_date).toLocaleDateString()}` : 'No visits yet'}
                  </span>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-teal-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Add New Patient</h2>
            </div>
            <form onSubmit={handleAddPatient} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">First Name</label>
                  <input 
                    type="text" 
                    value={newPatient.first_name} 
                    onChange={e => setNewPatient({...newPatient, first_name: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Name</label>
                  <input 
                    type="text" 
                    value={newPatient.last_name} 
                    onChange={e => setNewPatient({...newPatient, last_name: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Medical ID</label>
                  <input 
                    type="text" 
                    value={newPatient.medical_id} 
                    onChange={e => setNewPatient({...newPatient, medical_id: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                    required 
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-md"
                >
                  {submitting ? 'Saving...' : 'Add Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, ArrowLeft, Plus, Calendar, Activity, Clock, Trash2 } from 'lucide-react';

export default function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          navigate('/login');
          return;
        }
        const res = await fetch(`http://localhost:8000/api/patients/${id}/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401) {
          navigate('/login');
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          setPatient(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatientData();
  }, [id, navigate]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading patient details...</div>;
  }

  if (!patient) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Patient not found</div>;
  }

  const getDiagnosisColor = (diagnosis) => {
    if (diagnosis === 'No DR') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (diagnosis.includes('Mild')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (diagnosis.includes('Moderate')) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-rose-100 text-rose-700 border-rose-200';
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
        {/* Header */}
        <button 
          onClick={() => navigate('/patients')}
          className="flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors mb-6 font-medium text-sm"
        >
          <ArrowLeft size={16} /> Back to Patients
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{patient.first_name} {patient.last_name}</h2>
            <div className="flex flex-wrap gap-4 text-slate-500 text-sm">
              <span className="flex items-center gap-1.5"><Activity size={16} /> ID: {patient.medical_id}</span>
              <span className="flex items-center gap-1.5"><Clock size={16} /> Registered: {patient.last_visit_date ? new Date(patient.last_visit_date).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
          <button 
            onClick={() => navigate(`/patient/${id}/scan`)}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <Plus size={20} /> Start New AI Scan
          </button>
        </div>

        {/* Scan History */}
        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Calendar size={24} className="text-slate-400" /> Scan History
          </h3>
          
          {(!patient.visits || patient.visits.length === 0) ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center flex flex-col items-center justify-center">
              <div className="bg-slate-100 p-4 rounded-full mb-4 text-slate-400">
                <Eye size={32} />
              </div>
              <h4 className="text-lg font-semibold text-slate-700 mb-2">No Scans Yet</h4>
              <p className="text-slate-500 max-w-sm mb-6">This patient doesn't have any retinal scans in their history.</p>
              <button 
                onClick={() => navigate(`/patient/${id}/scan`)}
                className="text-teal-600 font-semibold hover:text-teal-700"
              >
                Start their first scan
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {patient.visits.map((visit) => (
                <div 
                  key={visit.id} 
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col"
                >
                  <div 
                    onClick={() => navigate(`/patient/${id}/report/${visit.id}`)}
                    className="aspect-[4/3] bg-slate-100 relative overflow-hidden flex items-center justify-center cursor-pointer"
                  >
                    {visit.image_data ? (
                      <img src={visit.image_data} alt="Retinal Scan" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <Eye size={48} className="text-slate-300" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                      <span className="text-white font-medium text-sm flex items-center gap-1.5">View Full Report &rarr;</span>
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-sm font-medium text-slate-500">{new Date(visit.date).toLocaleDateString()}</span>
                        {visit.confidence && <span className="text-xs font-bold text-slate-400">{Math.round(visit.confidence * 100)}% Conf.</span>}
                      </div>
                      <div className={`inline-block px-3 py-1 rounded-md text-sm font-semibold border ${getDiagnosisColor(visit.diagnosis)}`}>
                        {visit.diagnosis}
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to delete this scan from the history?')) {
                            const token = localStorage.getItem('access_token');
                            fetch(`http://localhost:8000/api/patients/${id}/visits/${visit.id}/`, {
                              method: 'DELETE',
                              headers: { 'Authorization': `Bearer ${token}` }
                            }).then(res => {
                              if (res.ok) {
                                setPatient(prev => ({
                                  ...prev,
                                  visits: prev.visits.filter(v => v.id !== visit.id)
                                }));
                              }
                            }).catch(console.error);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1.5 text-sm font-medium"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

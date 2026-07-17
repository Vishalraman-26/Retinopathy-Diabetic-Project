import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Eye } from 'lucide-react';

export default function ReportView() {
  const { id, visitId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [visit, setVisit] = useState(null);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`http://localhost:8000/api/patients/${id}/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPatient(data);
          const v = data.visits?.find(x => x.id.toString() === visitId);
          if (v) setVisit(v);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPatientData();
  }, [id, visitId]);

  if (!patient || !visit) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading Report...</div>;
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* Topbar - Non-printable */}
      <div className="print:hidden bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/patient/${id}`)} className="mr-4 text-slate-400 hover:text-teal-600">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-teal-600 p-2 rounded-lg text-white">
            <Eye size={20} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">RetinaScan <span className="text-teal-600">PRO</span></h1>
        </div>
        <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <Printer size={18} /> Export PDF / Print
        </button>
      </div>

      <div className="flex-1 p-4 print:p-0 flex justify-center">
        <div className="w-full max-w-5xl bg-white shadow-xl print:shadow-none print:border-none border border-slate-200 p-8 print:p-0">
          
          <div className="border-b-2 border-slate-800 pb-4 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black text-slate-900 mb-1">Diagnostic Report</h1>
              <p className="text-slate-500 font-medium">RetinaScan PRO Automated Analysis</p>
            </div>
            <div className="text-right">
              <Eye size={32} className="text-slate-300 ml-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">REPORT ID: {visit.id}-{id}-{new Date(visit.date).getTime().toString().slice(-6)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Patient Information</h3>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="font-bold text-lg text-slate-900">{patient.first_name} {patient.last_name}</p>
                <p className="text-slate-600 mt-1">Medical ID: <span className="font-medium text-slate-800">{patient.medical_id}</span></p>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Scan Details</h3>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-slate-600">Date: <span className="font-medium text-slate-800">{new Date(visit.date).toLocaleString()}</span></p>
                <p className="text-slate-600 mt-1">Attending: <span className="font-medium text-slate-800">Dr. {patient.doctor_name || 'Admin'}</span></p>
                {patient.hospital_name && (
                  <p className="text-slate-600 mt-1">Hospital: <span className="font-medium text-slate-800">{patient.hospital_name}</span></p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8 mb-6 border-t border-b border-slate-100 py-6">
            <div className="md:w-1/3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Input Fundus Scan</h3>
              {visit.image_data ? (
                <img src={visit.image_data} alt="Scan" className="w-full rounded-xl border border-slate-200 shadow-sm object-contain max-h-[300px] bg-slate-50" />
              ) : (
                <div className="w-full aspect-square bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                  <span className="text-slate-400">Image not available</span>
                </div>
              )}
            </div>
            <div className="md:w-2/3 flex flex-col justify-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">AI Analysis Results</h3>
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Primary Diagnosis</p>
                <div className="flex flex-col gap-1">
                  <p className={`text-4xl font-black tracking-tight ${visit.diagnosis === 'No DR' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {visit.diagnosis}
                  </p>
                  <p className="text-base text-slate-600 font-medium leading-relaxed mt-2 max-w-lg">
                    {(() => {
                      if (!visit.diagnosis) return '';
                      if (visit.diagnosis === 'No DR') return 'No abnormalities detected. The retina appears healthy with no signs of diabetic retinopathy.';
                      if (visit.diagnosis.includes('Mild')) return 'Microaneurysms detected. This is the earliest stage of diabetic eye disease.';
                      if (visit.diagnosis.includes('Moderate')) return 'Blood vessels that nourish the retina are blocked. Multiple microaneurysms and dot-and-blot hemorrhages are present.';
                      if (visit.diagnosis.includes('Severe')) return 'More blood vessels are blocked, depriving several areas of the retina with their blood supply. High risk of progression.';
                      if (visit.diagnosis.includes('PDR')) return 'Proliferative Diabetic Retinopathy. Advanced stage with new fragile blood vessels growing. High risk of severe vision loss.';
                      return '';
                    })()}
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 self-start">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Model Confidence</p>
                <p className="text-2xl font-bold text-slate-800">{(visit.confidence * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400 mt-8 pt-4 border-t border-slate-100">
            <p>This report was generated automatically by RetinaScan PRO using the APSO-GRESNET inference pipeline.</p>
            <p className="mt-1">AI-assisted diagnostics should be correlated with clinical findings and verified by a qualified ophthalmologist.</p>
          </div>

        </div>
      </div>
    </div>
  );
}

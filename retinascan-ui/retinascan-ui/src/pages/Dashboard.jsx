import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, Upload, CheckCircle2, ArrowLeft, Save, Activity, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [patient, setPatient] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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
        } else {
          navigate('/patients');
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPatientData();
  }, [id, navigate]);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

  const startInference = async (file, previewUrl) => {
    setError(null);
    setResult(null);
    setUploadedImage(previewUrl);
    setIsProcessing(true);

    try {
      const b64 = await fileToBase64(file);
      setImageBase64(b64);

      const token = localStorage.getItem('access_token');
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('http://localhost:8000/api/infer/', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
        body: form,
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Inference failed');
      }

      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Failed to run inference');
      setUploadedImage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    startInference(file, previewUrl);
  };

  const handleSaveToHistory = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        diagnosis: result.label,
        confidence: result.confidence,
        processing_time_ms: result.processing_time_ms,
        features: result.features || [],
        image_base64: imageBase64
      };

      const res = await fetch(`http://localhost:8000/api/patients/${id}/visits/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        navigate(`/patient/${id}`);
      } else {
        throw new Error('Failed to save visit');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving to history: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getDiagnosisColor = (diagnosis) => {
    if (!diagnosis) return 'bg-slate-100 text-slate-700';
    if (diagnosis === 'No DR') return 'bg-emerald-100 text-emerald-700';
    if (diagnosis.includes('Mild')) return 'bg-blue-100 text-blue-700';
    if (diagnosis.includes('Moderate')) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const getDiagnosisDescription = (diagnosis) => {
    if (!diagnosis) return '';
    if (diagnosis === 'No DR') return 'No abnormalities detected. The retina appears healthy with no signs of diabetic retinopathy.';
    if (diagnosis.includes('Mild')) return 'Microaneurysms detected. This is the earliest stage of diabetic eye disease.';
    if (diagnosis.includes('Moderate')) return 'Blood vessels that nourish the retina are blocked. Multiple microaneurysms and dot-and-blot hemorrhages are present.';
    if (diagnosis.includes('Severe')) return 'More blood vessels are blocked, depriving several areas of the retina with their blood supply. High risk of progression.';
    if (diagnosis.includes('PDR')) return 'Proliferative Diabetic Retinopathy. Advanced stage with new fragile blood vessels growing. High risk of severe vision loss.';
    return '';
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* Topbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-teal-600 p-2 rounded-lg text-white">
            <Eye size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">RetinaScan <span className="text-teal-600">PRO</span></h1>
        </div>
        <div className="flex items-center gap-6">
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

      <div className="flex-1 max-w-5xl mx-auto w-full p-8">
        <button 
          onClick={() => navigate(`/patient/${id}`)}
          className="flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors mb-6 font-medium text-sm"
        >
          <ArrowLeft size={16} /> Cancel & Back
        </button>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">New AI Scan</h2>
          {patient && <p className="text-slate-500 mt-1">Patient: {patient.first_name} {patient.last_name} ({patient.medical_id})</p>}
        </div>

        {!uploadedImage ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-16 text-center shadow-sm hover:border-teal-500 transition-colors group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            <div className="bg-teal-50 text-teal-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Upload size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Upload Fundus Image</h3>
            <p className="text-slate-500 mb-6">Drag and drop, or click to browse (JPEG, PNG)</p>
            {error && <p className="text-rose-500 bg-rose-50 px-4 py-2 rounded-md inline-block">{error}</p>}
          </div>
        ) : isProcessing ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="relative w-48 h-48 mx-auto mb-8 rounded-full overflow-hidden border-4 border-slate-100 shadow-inner">
              <img src={uploadedImage} alt="Scanning" className="w-full h-full object-cover opacity-50" />
              <div className="absolute top-0 left-0 w-full h-1 bg-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2 flex items-center justify-center gap-2">
              <RefreshCw className="animate-spin text-teal-600" /> Analyzing Image...
            </h3>
            <p className="text-slate-500">Running APSO-GRESNET inference pipeline</p>
            <style>{`
              @keyframes scan {
                0% { top: 0%; }
                50% { top: 100%; }
                100% { top: 0%; }
              }
            `}</style>
          </div>
        ) : result && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-1/2 bg-slate-100 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200">
              <h3 className="text-sm uppercase tracking-wider text-slate-500 font-bold mb-4">Input Scan</h3>
              <img src={uploadedImage} alt="Fundus" className="rounded-xl shadow-md max-h-80 object-contain bg-black" />
            </div>
            
            <div className="md:w-1/2 p-8 flex flex-col">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h3 className="text-sm uppercase tracking-wider text-slate-500 font-bold mb-2">AI Diagnosis</h3>
                <div className="flex flex-col gap-2">
                  <div className={`self-start text-2xl font-bold px-4 py-2 rounded-lg ${getDiagnosisColor(result.label)}`}>
                    {result.label}
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{getDiagnosisDescription(result.label)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Confidence</span>
                  <div className="text-xl font-bold text-slate-800 flex items-end gap-2">
                    {(result.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-teal-500 h-full rounded-full" style={{ width: `${result.confidence * 100}%` }}></div>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Processing Time</span>
                  <div className="text-xl font-bold text-slate-800">
                    {(result.processing_time_ms / 1000).toFixed(2)}s
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Activity size={12}/> Model: APSO-GRESNET</div>
                </div>
              </div>

              {result.probabilities && (
                <div className="mb-6">
                  <h3 className="text-sm uppercase tracking-wider text-slate-500 font-bold mb-3">Class Probabilities</h3>
                  <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    {Object.entries(result.probabilities)
                      .sort(([, a], [, b]) => b - a)
                      .map(([className, prob]) => (
                      <div key={className} className="flex items-center text-sm">
                        <div className="w-28 text-slate-600 font-medium truncate pr-2">{className}</div>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                          <div 
                            className={`h-full rounded-full ${className === result.label ? 'bg-teal-500' : 'bg-slate-300'}`} 
                            style={{ width: `${Math.max(prob * 100, 2)}%` }}
                          ></div>
                        </div>
                        <div className="w-12 text-right text-xs font-bold text-slate-500">{(prob * 100).toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-8 flex-1">
                <h3 className="text-sm uppercase tracking-wider text-slate-500 font-bold mb-3">Detected Features</h3>
                <ul className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {result.features?.map((f, i) => {
                    // Skip the top predictions feature since we now have the chart
                    if (f.startsWith('Top predictions:')) return null;
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle2 size={16} className="text-teal-500 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <button 
                onClick={handleSaveToHistory}
                disabled={isSaving}
                className="w-full flex justify-center items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white py-3.5 rounded-xl font-bold shadow-md transition-all active:scale-95 mt-auto"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                {isSaving ? 'Saving...' : 'Save to Patient History'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

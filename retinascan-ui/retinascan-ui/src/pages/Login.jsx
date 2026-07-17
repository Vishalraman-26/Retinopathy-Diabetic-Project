import { Eye, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      setError('');
      if (mode === 'register') {
        const reg = await fetch('http://localhost:8000/api/auth/register/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, doctor_name: doctorName, hospital_name: hospitalName })
        });
        if (!reg.ok && reg.status !== 409) {
          const msg = await reg.text();
          throw new Error(msg || 'Registration failed');
        }
      }

      const response = await fetch('http://localhost:8000/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        navigate('/patients');
      } else {
        setError('Invalid credentials.');
      }
    } catch (err) {
      setError(err?.message || 'Unable to connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <div className="hidden lg:flex w-1/2 bg-slate-900 text-white flex-col justify-between p-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/40 to-slate-900 z-0"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>
        
        <div className="relative z-10 flex items-center gap-3 text-sm font-bold tracking-widest text-teal-400">
          <Eye size={24} />
          RETINASCAN PLATFORM
        </div>
        
        <div className="relative z-10 my-auto max-w-lg">
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
            Understanding<br />
            Diabetic<br />
            Retinopathy
          </h1>
          <p className="text-slate-300 text-lg mb-12">
            Early detection is our best defense against irreversible vision loss. Use our AI-powered tool to scan and assist clinical diagnosis.
          </p>

          
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50 relative">
        <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          
          <div className="lg:hidden flex items-center gap-3 mb-10 text-teal-600">
            <div className="bg-teal-50 p-3 rounded-xl"><Eye size={24} /></div>
            <span className="font-bold tracking-widest text-sm">RETINASCAN PRO</span>
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-2">{mode === 'register' ? 'Create Account' : 'Access Portal'}</h2>
          <p className="text-slate-500 mb-8">
            {mode === 'register' ? 'Register a new user, then sign in.' : 'Sign in to access the testing interface.'}
          </p>

          {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl font-medium">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Medical ID / Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all text-slate-900"
                required 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all text-slate-900"
                required 
              />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Doctor Name</label>
                  <input 
                    type="text" 
                    value={doctorName} 
                    onChange={e => setDoctorName(e.target.value)} 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all text-slate-900"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hospital Name</label>
                  <input 
                    type="text" 
                    value={hospitalName} 
                    onChange={e => setHospitalName(e.target.value)} 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all text-slate-900"
                    required 
                  />
                </div>
              </>
            )}

            {mode === 'login' && (
              <div className="flex justify-between items-center text-sm">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input type="checkbox" className="rounded text-teal-600 focus:ring-teal-500" />
                  Remember me
                </label>
                <a href="#" className="font-semibold text-teal-600 hover:text-teal-700">Forgot Password?</a>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-70 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-slate-900/20 active:scale-95 mt-8"
            >
              {loading ? 'Processing...' : (mode === 'register' ? 'Register & Sign In' : 'Sign In')}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-8 text-center text-slate-500 text-sm">
            {mode === 'register' ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
              className="font-bold text-teal-600 hover:text-teal-700 underline underline-offset-2"
            >
              {mode === 'register' ? 'Sign in' : 'Register'}
            </button>
          </div>
          
          <div className="mt-12 text-center text-xs text-slate-400 border-t border-slate-100 pt-6">
            Powered by <strong className="text-slate-600">APSO-GRESNET</strong> Architecture
          </div>
        </div>
      </div>
    </div>
  );
}

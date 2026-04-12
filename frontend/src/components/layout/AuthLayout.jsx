const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '4s' }}></div>

      <div className="bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/5 w-full max-w-md relative z-10">
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl mx-auto mb-4 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Welcome back</h2>
          <p className="text-slate-500 mt-2 text-sm">Please enter your details to continue.</p>
        </div>
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
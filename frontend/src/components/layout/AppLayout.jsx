const AppLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-72 bg-white border-r border-slate-200 px-6 py-8 flex flex-col justify-between hidden md:flex z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white font-bold">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700">App Name</h1>
          </div>
          
          <nav className="space-y-2">
            {['Dashboard', 'Analytics', 'Settings'].map((item, i) => (
              <a key={item} href="#" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${i === 0 ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600 font-medium'}`}>
                <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-indigo-600' : 'bg-transparent'}`}></div>
                {item}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-100 flex items-center gap-4 px-2">
           <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" className="w-12 h-12 rounded-full border-2 border-white shadow-sm ring-2 ring-slate-100" alt="User" />
           <div>
             <p className="text-sm font-bold text-slate-800">Jane Doe</p>
             <p className="text-xs text-slate-500 font-medium">Pro Plan</p>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
          <div className="items-center gap-4 hidden md:flex">
             <h2 className="text-xl font-bold text-slate-800">Dashboard Overview</h2>
          </div>
          <div className="flex md:hidden items-center gap-3">
             <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-lg shadow-md flex items-center justify-center text-white font-bold">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
             </div>
             <h1 className="text-lg font-bold text-slate-800">App Name</h1>
          </div>
          <div className="flex items-center gap-4">
             <button className="relative p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
               <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
             </button>
             <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" className="w-10 h-10 rounded-full md:hidden" alt="User" />
          </div>
        </header>
        <div className="flex-1 p-6 sm:p-10 overflow-y-auto w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
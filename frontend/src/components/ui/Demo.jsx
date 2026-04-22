import { useState } from "react";
import Button from "./Button";
import Input from "./Input";
import Avatar from "./Avatar";
import AuthDemo from "./AuthDemo";

const Demo = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) {
      setError(""); 
    } else if (!emailRegex.test(value)) {
      setError("Please enter a valid email address."); 
    } else {
      setError(""); 
    }
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-80px)] py-16 px-4 sm:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-16">
        
        <div className="text-center space-y-4 mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
            UI Design <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">System</span>
          </h1>
          <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">
            A beautiful, premium component library built with Tailwind CSS. Showcasing polished buttons, inputs, and avatars with rich interactions.
          </p>
        </div>

        {/* Buttons Section */}
        <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full mix-blend-multiply blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2"></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-8 border-b border-slate-100 pb-4 relative z-10">Buttons</h2>
          <div className="flex flex-wrap gap-6 items-center relative z-10">
            <Button>Primary Action</Button>
            <Button variant="secondary">Secondary Option</Button>
            <Button variant="danger">Delete Item</Button>
            <Button isLoading={true}>Processing...</Button>
          </div>
        </section>

        {/* Inputs Section */}
        <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
          <h2 className="text-2xl font-bold text-slate-800 mb-8 border-b border-slate-100 pb-4 relative z-10">Inputs & Forms</h2>
          
          <div className="grid md:grid-cols-2 gap-8 relative z-10">
            <div className="space-y-6">
              <Input
                label="Full Name"
                placeholder="Nguyễn Văn A"
              />
              <Input
                label="Email Address"
                placeholder="a@gmail.com"
                value={email}
                onChange={handleEmailChange}
                error={error}
              />
            </div>
            <div className="space-y-6">
               <Input
                label="Search"
                placeholder="Search resources..."
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>}
              />
               <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                icon={<svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>}
              />
            </div>
          </div>
        </section>

        {/* Avatars Section */}
        <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-50 rounded-full mix-blend-multiply blur-3xl opacity-50 -translate-x-1/2 translate-y-1/2"></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-8 border-b border-slate-100 pb-4 relative z-10">Avatars</h2>
          
          <div className="flex flex-wrap gap-12 items-end relative z-10">
            <div className="flex flex-col items-center gap-3">
              <Avatar size="sm" src="https://i.pravatar.cc/100?u=1" />
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Small</span>
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <Avatar size="md" src="https://i.pravatar.cc/150?u=2" isOnline />
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Mid / Online</span>
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <Avatar size="lg" src="https://i.pravatar.cc/200?u=3" />
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Large</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <Avatar size="md" isOnline alt="John" />
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Fallback</span>
            </div>
          </div>
        </section>

        {/* Auth Demo Section */}
        <section className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
          <h2 className="text-2xl font-bold text-slate-800 mb-8 border-b border-slate-100 pb-4 relative z-10">Authentication</h2>
          <div className="relative z-10">
            <AuthDemo />
          </div>
        </section>
        
      </div>
    </div>
  );
};

export default Demo;

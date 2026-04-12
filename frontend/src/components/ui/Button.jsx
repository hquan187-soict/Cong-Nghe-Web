import Spinner from "./Spinner";

const variants = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg ring-indigo-600/50",
  secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm ring-slate-200/50",
  danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-md hover:shadow-lg ring-rose-500/50",
};

const Button = ({ children, variant = "primary", isLoading, className = "", ...props }) => {
  return (
    <button
      className={`relative inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium tracking-wide transition-all duration-300 focus:outline-none focus:ring-4 active:scale-95 disabled:opacity-70 disabled:pointer-events-none ${variants[variant]} ${className}`}
      disabled={isLoading}
      {...props}
    >
      {isLoading && <Spinner className="-ml-1 mr-2 h-4 w-4" />}
      {children}
    </button>
  );
};

export default Button;
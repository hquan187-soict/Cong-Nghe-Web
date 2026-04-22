const Input = ({
  label,
  error,
  icon,
  rightIcon,
  onRightIconClick,
  placeholder,
  value,
  onChange,
  className = "",
  type = "text",
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}

      <div className="relative group/input">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within/input:text-indigo-500">
            {icon}
          </span>
        )}

        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full px-4 py-2.5 rounded-xl border-2 outline-none transition-all duration-300 text-slate-700 font-medium
          bg-white placeholder-slate-400
          ${icon ? "pl-11" : ""}
          ${rightIcon ? "pr-11" : ""}
          ${
            error
              ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20"
              : "border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20"
          } ${className}`}
          {...props}
        />

        {rightIcon && (
          <button
            type="button"
            onClick={onRightIconClick}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
            tabIndex={-1}
          >
            {rightIcon}
          </button>
        )}
      </div>

      {error && (
        <span className="text-rose-500 text-sm font-medium animate-in fade-in slide-in-from-top-1">
          {error}
        </span>
      )}
    </div>
  );
};

export default Input;
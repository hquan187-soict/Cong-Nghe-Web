const Input = ({
  label,
  error,
  icon,
  placeholder,
  value,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">{label}</label>

      <div className="relative">
        {icon && <span className="absolute left-3 top-2.5">{icon}</span>}

        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full px-4 py-2.5 rounded-xl border outline-none
          placeholder-gray-400
          ${icon ? "pl-10" : ""}
          ${
            error
              ? "border-red-500"
              : "border-gray-300 focus:ring-2 focus:ring-indigo-200"
          }`}
        />
      </div>

      {error && <span className="text-red-500 text-sm">{error}</span>}
    </div>
  );
};

export default Input;
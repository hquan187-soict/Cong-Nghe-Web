const sizes = {
  sm: "w-10 h-10 ring-2",
  md: "w-14 h-14 ring-2",
  lg: "w-20 h-20 ring-4",
};

const badgeSizes = {
  sm: "w-3 h-3 border-2 right-0 bottom-0",
  md: "w-4 h-4 border-2 right-0 bottom-0",
  lg: "w-5 h-5 border-[3px] right-1 bottom-1",
};

const Avatar = ({ src, size = "md", isOnline, alt = "Avatar" }) => {
  return (
    <div className="relative inline-flex items-center justify-center">
      <div
        className={`relative rounded-full overflow-hidden shadow-md ring-white ${sizes[size]} transition-transform duration-300 hover:scale-105`}
      >
        {src ? (
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold text-xl">
            {alt.charAt(0)}
          </div>
        )}
      </div>

      {isOnline && (
        <span
          className={`absolute bg-emerald-500 rounded-full border-white ${badgeSizes[size]}`}
          title="Online"
        />
      )}
    </div>
  );
};

export default Avatar;
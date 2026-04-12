const sizes = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-20 h-20",
};

const Avatar = ({ src, size = "md", isOnline }) => {
  return (
    <div className={`relative ${sizes[size]}`}>
      <img
        src={src}
        className="w-full h-full rounded-full object-cover border-2 border-white shadow"
      />

      {isOnline && (
        <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
      )}
    </div>
  );
};

export default Avatar;
const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded-xl shadow-soft w-full max-w-md">
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
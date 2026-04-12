const AppLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-gray-800 text-white p-6">
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </aside>

      <main className="flex-1 p-10">{children}</main>
    </div>
  );
};

export default AppLayout;
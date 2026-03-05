const CsvDashboard = () => {
  return (
    <div className="min-h-screen p-10">
      <h1 className="text-3xl font-bold mb-4">CSV Dashboard Tool</h1>

      <input type="file" accept=".csv" className="mb-4" />

      <p>
        Upload your bunq CSV export and analyze your monthly spending.
      </p>
    </div>
  );
};

export default CsvDashboard;

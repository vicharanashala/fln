import React, { useEffect, useState } from "react";

interface Intervention {
  studentId: string;
  studentName: string;
  className: string;
  priority: string;
  latestScorePercent: number;
  averageScorePercent: number;
  reasons: string[];
}

interface Props {
  token: string;
}

export default function InterventionsView({ token }: Props) {
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const totalStudents = data.length;

  const high = data.filter(student => student.priority === "High").length;
const medium = data.filter(student => student.priority === "Medium").length;
const low = data.filter(student => student.priority === "Low").length;
const filteredData = data.filter((s) =>
  s.studentName.toLowerCase().includes(search.toLowerCase())
);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/interventions/dashboard", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();
        console.log("Status:", res.status);
console.log("Response:", json);

        if (res.ok) {
          setData(json);
        } else {
          setError(json.error || "Failed to load interventions");
        }
      } catch {
        setError("Unable to connect to server");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  if (loading) {
    return <div className="p-6">Loading interventions...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Interventions Dashboard
      </h1>
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  <div className="bg-red-50 border border-red-300 rounded-lg p-4">
    <h2 className="text-red-600 font-semibold">High Priority</h2>
    <p className="text-3xl font-bold">{high}</p>
  </div>

  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
    <h2 className="text-yellow-700 font-semibold">Medium Priority</h2>
    <p className="text-3xl font-bold">{medium}</p>
  </div>

  <div className="bg-green-50 border border-green-300 rounded-lg p-4">
    <h2 className="text-green-600 font-semibold">Low Priority</h2>
    <p className="text-3xl font-bold">{low}</p>
  </div>

  <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
    <h2 className="text-blue-700 font-semibold">Total Students</h2>
    <p className="text-3xl font-bold">{totalStudents}</p>
  </div>
</div>

<div className="mb-4">
  <input
    type="text"
    placeholder="Search student..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="w-full md:w-80 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
  />
</div>
      {data.length === 0 ? (
        <p>No students currently require intervention.</p>
      ) : (
        <div className="overflow-hidden rounded-xl shadow-lg border border-gray-200">
  <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-blue-50">
              <th className="p-3 border font-semibold">Student</th>
              <th className="p-2 border">Class</th>
              <th className="p-2 border">Priority</th>
              <th className="p-2 border">Latest %</th>
              <th className="p-2 border">Average %</th>
            </tr>
          </thead>

          <tbody>
            {filteredData.map((s) => (
              <tr key={s.studentId}>
                <td className="p-2 border">{s.studentName}</td>
                <td className="p-2 border">{s.className}</td>
                <td className="p-2 border">
  <span
    className={`px-3 py-1 rounded-full text-sm font-semibold ${
      s.priority === "High"
        ? "bg-red-100 text-red-700"
        : s.priority === "Medium"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-green-100 text-green-700"
    }`}
  >
    {s.priority}
  </span>
</td>
                <td className="p-2 border">{s.latestScorePercent}%</td>
                <td className="p-2 border">{s.averageScorePercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    </div>
  );
}
         
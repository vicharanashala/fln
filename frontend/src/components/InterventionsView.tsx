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
  const [data, setData] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      {data.length === 0 ? (
        <p>No students currently require intervention.</p>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Student</th>
              <th className="p-2 border">Class</th>
              <th className="p-2 border">Priority</th>
              <th className="p-2 border">Latest %</th>
              <th className="p-2 border">Average %</th>
            </tr>
          </thead>

          <tbody>
            {data.map((s) => (
              <tr key={s.studentId}>
                <td className="p-2 border">{s.studentName}</td>
                <td className="p-2 border">{s.className}</td>
                <td className="p-2 border">{s.priority}</td>
                <td className="p-2 border">{s.latestScorePercent}%</td>
                <td className="p-2 border">{s.averageScorePercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
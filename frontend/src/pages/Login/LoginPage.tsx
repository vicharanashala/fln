import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("superadmin@fln.org");
  const [password, setPassword] = useState("Welcome1!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password, "superadmin");
      toast.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const e = err as Error;
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex">
        <div className="hidden lg:flex flex-col flex-1 bg-gradient-to-br from-blue-600 to-blue-800 p-12 text-white relative overflow-hidden">
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500 rounded-full opacity-20" />
          <div className="absolute top-12 right-12 w-32 h-32 bg-blue-400 rounded-full opacity-20" />

          <div className="flex items-center gap-2 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur grid place-items-center">
              <svg viewBox="0 0 16 16" fill="white" className="w-5 h-5"><path d="M8 1 2 4.5 8 8l6-3.5L8 1Zm0 7 6 3.5L8 15 2 11.5 8 8Z"/></svg>
            </div>
            <span className="text-lg font-bold">FLN Platform</span>
          </div>

          <div className="mt-auto relative z-10">
            <h2 className="text-3xl font-bold leading-tight">
              Foundational Literacy<br />& Numeracy Platform
            </h2>
            <p className="text-blue-100 mt-3 text-sm">
              AI-powered assessment platform for nationwide educational excellence
            </p>

            <div className="grid grid-cols-3 gap-4 mt-8">
              <div><p className="text-2xl font-bold">28</p><p className="text-xs text-blue-100">States + UTs</p></div>
              <div><p className="text-2xl font-bold">1.2M</p><p className="text-xs text-blue-100">Students</p></div>
              <div><p className="text-2xl font-bold">4.3K</p><p className="text-xs text-blue-100">Assessments</p></div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-10 lg:p-12 flex flex-col justify-center">
          <div className="max-w-sm mx-auto w-full">
            <div className="lg:hidden mb-6 text-center">
              <ShieldCheck className="w-10 h-10 text-blue-600 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Super Admin Login</h2>
            <p className="text-sm text-slate-500 mt-1.5">Sign in to access the national dashboard</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-slate-600">Remember me</span>
                </label>
                <a href="#" className="text-blue-600 font-medium">Forgot password?</a>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Sign in <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            <p className="text-xs text-slate-400 text-center mt-6">
              Default: superadmin@fln.org / Welcome1!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
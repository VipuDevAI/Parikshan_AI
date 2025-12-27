import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@shared/routes";
import { Loader2, KeyRound, User, Lock, Building2 } from "lucide-react";
import { motion } from "framer-motion";

const loginSchema = api.auth.login.input;

export default function AuthPage() {
  const { login, isLoggingIn } = useAuth();
  const [activeTab, setActiveTab] = useState<"staff" | "parent">("staff");

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      schoolCode: "",
      username: "",
      password: "",
    },
  });

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    login(data);
  };

  return (
    <div className="min-h-screen w-full flex ai-background">
      {/* Animated AI particles */}
      <div className="ai-particles" />
      
      {/* Left Panel - Forest Green Branding */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center p-12 text-white">
        {/* Glowing orbs */}
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-gradient-to-br from-emerald-500/20 to-transparent blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-gradient-to-tl from-green-400/15 to-transparent blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-20" style={{ 
          backgroundImage: 'linear-gradient(hsla(145, 60%, 50%, 0.1) 1px, transparent 1px), linear-gradient(90deg, hsla(145, 60%, 50%, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />

        <div className="relative z-10 max-w-lg text-center space-y-6">
          {/* Logo */}
          <div className="mx-auto">
            <img 
              src="/logo.png" 
              alt="Parikshan.AI" 
              className="w-32 h-32 mx-auto rounded-2xl shadow-2xl ring-4 ring-white/20 object-cover"
            />
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-display font-extrabold tracking-tight">
            <span>Parikshan</span>
            <span className="text-orange-400">.AI</span>
          </h1>
          <p className="text-xl text-white/90 leading-relaxed font-light max-w-md mx-auto">
            Smart Vision Platform
          </p>
          <p className="text-base text-white/70 leading-relaxed">
            AI-powered surveillance, automated attendance, real-time alerts, and intelligent insights for modern education.
          </p>
          
          <div className="grid grid-cols-2 gap-4 pt-8 text-left">
            <div className="bg-white/10 p-5 rounded-xl border border-white/20">
              <h3 className="font-bold text-lg mb-2">AI Monitoring</h3>
              <p className="text-sm text-white/70">Face recognition, mood detection, discipline alerts</p>
            </div>
            <div className="bg-white/10 p-5 rounded-xl border border-white/20">
              <h3 className="font-bold text-lg mb-2">Smart Substitution</h3>
              <p className="text-sm text-white/70">Auto-assign replacements with scoring engine</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 bg-white/95 dark:bg-card/95 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white/20 dark:border-border/50"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-4">
            <div className="inline-flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Parikshan.AI" 
                className="w-12 h-12 rounded-xl shadow-md object-cover"
              />
              <span className="text-2xl font-display font-extrabold">
                <span className="text-foreground">Parikshan</span>
                <span className="text-orange-500">.AI</span>
              </span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold font-display text-foreground">Sign in to your account</h2>
            <p className="text-muted-foreground text-sm">Enter your credentials to access the portal</p>
          </div>

          <div className="grid grid-cols-2 bg-muted p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("staff")}
              className={`py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === "staff" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-staff"
            >
              Staff & Admin
            </button>
            <button
              onClick={() => setActiveTab("parent")}
              className={`py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === "parent" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-parent"
            >
              Parent / Student
            </button>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground ml-1">School Code</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <input
                  {...form.register("schoolCode")}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Enter school code"
                  data-testid="input-school-code"
                />
              </div>
              {form.formState.errors.schoolCode && (
                <p className="text-xs text-destructive ml-1">{form.formState.errors.schoolCode.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground ml-1">Username / Email</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <input
                  {...form.register("username")}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder={activeTab === 'staff' ? "Enter username" : "Enter email"}
                  data-testid="input-username"
                />
              </div>
              {form.formState.errors.username && (
                <p className="text-xs text-destructive ml-1">{form.formState.errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground ml-1">Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  {...form.register("password")}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Enter password"
                  data-testid="input-password"
                />
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive ml-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-border text-primary focus:ring-primary" />
                <span className="text-muted-foreground">Remember me</span>
              </label>
              <a href="#" className="text-primary hover:underline font-medium">Forgot password?</a>
            </div>

            <button
              disabled={isLoggingIn}
              className="w-full py-3.5 rounded-xl gradient-primary text-white font-bold text-base shadow-lg shadow-emerald-900/40 hover:shadow-xl hover:shadow-emerald-800/50 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-emerald-600/30"
              data-testid="button-login"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Sign In Securely
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs text-muted-foreground">
            <p>&copy; 2025 Parikshan.AI - Smart School Intelligence</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

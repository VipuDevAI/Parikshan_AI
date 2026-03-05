import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { loginSchema, type LoginInput } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { LogIn, Loader2, Mail, Lock, Eye, EyeOff, Grid3X3 } from "lucide-react";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  const [location, navigate] = useLocation();
  const { user, login, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.role === "super_admin") {
        navigate("/superadmin");
      } else {
        navigate("/dashboard");
      }
    }
  }, [isAuthenticated, isLoading, navigate, user]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      schoolCode: "",
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginInput) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (!data || !data.user) {
        toast({
          title: "Login Failed",
          description: "Invalid response from server",
          variant: "destructive",
        });
        return;
      }
      login(data.user, data.token);
      
      if (data.user.mustChangePassword) {
        toast({
          title: "Password Change Required",
          description: "Please change your password to continue",
        });
        navigate("/change-password");
        return;
      }
      
      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.user.name}`,
      });
      
      if (data.user.role === "super_admin") {
        navigate("/superadmin");
      } else {
        navigate("/dashboard");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginInput) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden login-cosmic-bg">
      {/* Animated Stars Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="stars-layer-1"></div>
        <div className="stars-layer-2"></div>
        <div className="stars-layer-3"></div>
      </div>

      {/* Gradient Orbs */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-600/40 via-cyan-500/30 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-to-tl from-orange-500/40 via-pink-500/30 to-transparent rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
      <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>

      {/* Login Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="login-card-glow">
          <div className="login-card-inner">
            {/* Logo */}
            <div className="flex flex-col items-center mb-6" data-testid="img-logo">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-orange-400 rounded-full blur-xl opacity-60 scale-110"></div>
                <img 
                  src={BRAND.loginLogo} 
                  alt={BRAND.name}
                  className="relative w-24 h-24 object-contain drop-shadow-2xl"
                />
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white tracking-wider mb-1">
                PRASHNAKOSH
              </h1>
              <p className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400 text-sm font-semibold tracking-[0.3em] uppercase">
                — {BRAND.tagline} —
              </p>
            </div>

            {/* Sign In Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-white mb-1">Sign In</h2>
              <p className="text-gray-400 text-sm">Enter your school code and credentials</p>
            </div>

            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="schoolCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-xl blur-sm group-focus-within:from-cyan-500/40 group-focus-within:to-purple-500/40 transition-all duration-300"></div>
                          <div className="relative flex items-center bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden group-focus-within:border-cyan-500/50 transition-all duration-300">
                            <div className="px-4 py-3.5 bg-gradient-to-r from-cyan-500/10 to-transparent">
                              <Grid3X3 className="w-5 h-5 text-cyan-400" />
                            </div>
                            <input
                              {...field}
                              placeholder="School Code"
                              className="flex-1 bg-transparent py-3.5 pr-4 text-white placeholder-gray-500 focus:outline-none"
                              data-testid="input-school-code"
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage className="text-pink-400 text-xs ml-2" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl blur-sm group-focus-within:from-purple-500/40 group-focus-within:to-pink-500/40 transition-all duration-300"></div>
                          <div className="relative flex items-center bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden group-focus-within:border-purple-500/50 transition-all duration-300">
                            <div className="px-4 py-3.5 bg-gradient-to-r from-purple-500/10 to-transparent">
                              <Mail className="w-5 h-5 text-purple-400" />
                            </div>
                            <input
                              {...field}
                              type="email"
                              placeholder="Enter your email"
                              className="flex-1 bg-transparent py-3.5 pr-4 text-white placeholder-gray-500 focus:outline-none"
                              data-testid="input-email"
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage className="text-pink-400 text-xs ml-2" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-xl blur-sm group-focus-within:from-orange-500/40 group-focus-within:to-pink-500/40 transition-all duration-300"></div>
                          <div className="relative flex items-center bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden group-focus-within:border-orange-500/50 transition-all duration-300">
                            <div className="px-4 py-3.5 bg-gradient-to-r from-orange-500/10 to-transparent">
                              <Lock className="w-5 h-5 text-orange-400" />
                            </div>
                            <input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Password"
                              className="flex-1 bg-transparent py-3.5 pr-4 text-white placeholder-gray-500 focus:outline-none"
                              data-testid="input-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="px-4 text-gray-400 hover:text-white transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage className="text-pink-400 text-xs ml-2" />
                    </FormItem>
                  )}
                />

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="login-btn-gradient w-full mt-6"
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="font-semibold text-lg">Sign In</span>
                  )}
                </button>
              </form>
            </Form>

            {/* Forgot Password */}
            <div className="mt-6 text-center">
              <a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                Forgot Password?
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 text-center text-gray-500 text-sm">
          © 2025 {BRAND.name}. All rights reserved.
        </footer>
      </div>

      {/* Custom Styles */}
      <style>{`
        .login-cosmic-bg {
          background: linear-gradient(135deg, 
            #0a0a1a 0%, 
            #0d1033 20%,
            #1a0a2e 40%,
            #0d1033 60%,
            #0a0a1a 80%,
            #1a0a2e 100%
          );
          background-size: 400% 400%;
          animation: gradient-shift 15s ease infinite;
        }

        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .stars-layer-1, .stars-layer-2, .stars-layer-3 {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(2px 2px at 20px 30px, #fff, transparent),
            radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 90px 40px, #fff, transparent),
            radial-gradient(2px 2px at 160px 120px, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 230px 80px, #fff, transparent),
            radial-gradient(2px 2px at 300px 150px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 370px 50px, #fff, transparent),
            radial-gradient(2px 2px at 440px 180px, rgba(255,255,255,0.8), transparent);
          background-repeat: repeat;
          background-size: 500px 200px;
          animation: twinkle 4s ease-in-out infinite;
        }

        .stars-layer-2 {
          background-size: 700px 300px;
          animation-delay: 1s;
          opacity: 0.7;
        }

        .stars-layer-3 {
          background-size: 900px 400px;
          animation-delay: 2s;
          opacity: 0.5;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .login-card-glow {
          position: relative;
          padding: 2px;
          border-radius: 1.5rem;
          background: linear-gradient(135deg, 
            #00d4ff 0%, 
            #0099ff 15%,
            #8b5cf6 35%,
            #a855f7 50%,
            #ec4899 65%,
            #f97316 85%,
            #fbbf24 100%
          );
          background-size: 200% 200%;
          animation: border-glow 4s ease infinite;
        }

        @keyframes border-glow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .login-card-glow::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 1.5rem;
          padding: 2px;
          background: inherit;
          filter: blur(20px);
          opacity: 0.6;
          z-index: -1;
        }

        .login-card-inner {
          background: rgba(10, 15, 30, 0.85);
          backdrop-filter: blur(20px);
          border-radius: calc(1.5rem - 2px);
          padding: 2.5rem;
        }

        .login-btn-gradient {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem 2rem;
          border-radius: 0.75rem;
          background: linear-gradient(90deg, 
            #0099ff 0%, 
            #00d4ff 20%,
            #8b5cf6 40%,
            #a855f7 60%,
            #f97316 80%,
            #fbbf24 100%
          );
          background-size: 200% 100%;
          color: white;
          font-weight: 600;
          border: none;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s ease;
          animation: btn-gradient 3s ease infinite;
        }

        @keyframes btn-gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .login-btn-gradient:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(139, 92, 246, 0.4),
                      0 0 20px rgba(0, 212, 255, 0.3),
                      0 0 40px rgba(249, 115, 22, 0.3);
        }

        .login-btn-gradient:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .login-btn-gradient::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s ease;
        }

        .login-btn-gradient:hover::before {
          left: 100%;
        }
      `}</style>
    </div>
  );
}

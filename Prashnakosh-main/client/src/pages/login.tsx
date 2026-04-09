import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { loginSchema, type LoginInput } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Loader2 } from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  const [location, navigate] = useLocation();
  const { user, login, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Redirect based on user role
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
      
      // Check if user must change password
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
      
      // Redirect super_admin to their dashboard
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
    <div className="min-h-screen corporate-gradient flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8" data-testid="img-logo">
            <img 
              src={BRAND.logo} 
              alt={BRAND.name}
              className="w-20 h-20 rounded-full object-cover shadow-xl ring-4 ring-white/50 dark:ring-slate-700/50 mb-4"
            />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 dark:from-slate-100 dark:via-slate-200 dark:to-slate-300 bg-clip-text text-transparent">
              {BRAND.name}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-base">{BRAND.tagline}</p>
          </div>

          <Card className="card-premium border-0 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.4)]">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]">Sign In</CardTitle>
              <CardDescription className="text-[#64748B] dark:text-[#94A3B8]">Enter your school code and credentials</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="schoolCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter school code"
                          data-testid="input-school-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your email"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your password"
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  variant="premium"
                  size="lg"
                  disabled={loginMutation.isPending}
                  className="w-full mt-6"
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      Sign In Securely
                    </>
                  )}
                </Button>
              </form>
            </Form>
            </CardContent>
          </Card>
        </div>
      </div>
      <footer className="py-4 px-4 sm:px-6 text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col items-center gap-1 max-w-7xl mx-auto text-center">
          <span>© 2025 {BRAND.footer.left}</span>
          <span>{BRAND.footer.right}</span>
        </div>
      </footer>
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-primary/10 to-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

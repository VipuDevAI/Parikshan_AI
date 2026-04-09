import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import logoImg from "@/assets/logo.png";

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  // Check if this is a forced password change
  const isForcedChange = (user as any)?.mustChangePassword === true;

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordInput) => {
      const response = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: isForcedChange ? undefined : data.currentPassword,
        newPassword: data.newPassword,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully. Please log in again.",
      });
      logout();
      navigate("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Change Password",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ChangePasswordInput) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen edtech-gradient-animated flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img 
              src={logoImg} 
              alt="Question Bank" 
              className="w-28 h-28 mx-auto mb-4 object-contain drop-shadow-lg"
              data-testid="img-logo"
            />
            <h1 className="text-3xl font-bold text-[#0F172A] dark:text-[#F1F5F9]">Question Bank</h1>
            <p className="text-[#475569] dark:text-[#94A3B8] mt-2 text-base">Assessment & Practice Platform</p>
          </div>

          <Card className="card-premium border-0">
            <CardHeader className="text-center pb-2">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]">Change Password</CardTitle>
              <CardDescription className="text-[#64748B] dark:text-[#94A3B8]">
                {isForcedChange 
                  ? "You must change your password before continuing"
                  : "Update your account password"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  {!isForcedChange && (
                    <FormField
                      control={form.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter current password"
                              data-testid="input-current-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter new password"
                            data-testid="input-new-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Confirm new password"
                            data-testid="input-confirm-password"
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
                    disabled={changePasswordMutation.isPending}
                    className="w-full mt-6"
                    data-testid="button-change-password"
                  >
                    {changePasswordMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <KeyRound className="w-5 h-5" />
                        Update Password
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
      <footer className="py-4 text-center text-sm text-[hsl(210_15%_50%)] dark:text-[hsl(200_15%_60%)]">
        Powered by <span className="font-semibold text-[hsl(199_89%_40%)] dark:text-[hsl(199_89%_55%)]">SmartGenEduX</span>
      </footer>
    </div>
  );
}

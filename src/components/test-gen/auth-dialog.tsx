"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GraduationCap,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { loginApi, registerApi, type AuthUser } from "./lib";
import { supabaseBrowser } from "@/lib/supabase-client";

export function AuthDialog({
  open,
  onClose,
  onSuccess,
  defaultTab = "login",
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  defaultTab?: "login" | "register";
}) {
  const [tab, setTab] = useState<"login" | "register">(defaultTab);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Sync active tab whenever dialog opens with a specific defaultTab
  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      setError(null);
    }
  }, [open, defaultTab]);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setError(null);
    setShowPassword(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await loginApi({ email: email.trim().toLowerCase(), password });
      toast.success(`Welcome back, ${user.name || user.email}!`, { id: "auth-action" });
      onSuccess(user);
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await registerApi({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
      });
      toast.success(`Account created! Welcome, ${user.name || user.email}!`, { id: "auth-action" });
      onSuccess(user);
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { data, error: gErr } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          skipBrowserRedirect: true,
        },
      });
      if (gErr) throw gErr;
      if (!data?.url) {
        throw new Error("Unable to initialize Google Sign-In.");
      }

      // Check if provider is enabled before full page navigation to prevent raw JSON error screen
      try {
        const testRes = await fetch(data.url, { method: "GET" });
        if (!testRes.ok) {
          const body = await testRes.json().catch(() => null);
          if (body?.msg?.includes("not enabled") || testRes.status === 400) {
            throw new Error(
              "Google Sign-In is not enabled yet in your Supabase project (hpzuvqoviudcgwqcsdog). Please enable Google in Supabase Dashboard → Authentication → Providers → Google (with Google Client ID & Secret)."
            );
          }
        }
      } catch (checkErr) {
        if (checkErr instanceof Error && checkErr.message.includes("not enabled")) {
          throw checkErr;
        }
        // If it's just a redirect or network restriction, proceed safely to URL
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate Google Sign-In.");
      setGoogleLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
            <GraduationCap className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold">
            {tab === "login" ? "Sign in to ExamForge" : "Create an Account"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {tab === "login"
              ? "Sign in to generate, practice, and manage tests securely."
              : "Register an account to generate, customize, and save test papers."}
          </DialogDescription>
        </DialogHeader>

        {/* Google OAuth Button */}
        <div className="mt-2 space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-2.5 h-10 border-border hover:bg-muted font-medium text-xs shadow-xs"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </Button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/80" />
            </div>
            <span className="relative bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Or continue with email
            </span>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "login" | "register");
            setError(null);
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="flex items-center gap-1.5 text-xs">
              <LogIn className="h-3.5 w-3.5" /> Sign In
            </TabsTrigger>
            <TabsTrigger value="register" className="flex items-center gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" /> Register
            </TabsTrigger>
          </TabsList>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          {/* SIGN IN TAB */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-3.5 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs font-medium">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    required
                    placeholder="user@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" /> Sign In
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* REGISTER TAB */}
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-3.5 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-xs font-medium">
                  Full name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder="Ali Khan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-xs font-medium">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-email"
                    type="email"
                    required
                    placeholder="user@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs font-medium">
                  Password (min. 6 characters)
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" /> Create Account
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

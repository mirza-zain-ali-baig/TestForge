"use client";

import { useState } from "react";
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
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { loginApi, registerApi, type AuthUser, type UserRole } from "./lib";

const ROLES: {
  id: UserRole;
  label: string;
  desc: string;
  icon: typeof GraduationCap;
}[] = [
  {
    id: "student",
    label: "Student",
    desc: "Practice question bank, take online tests, and generate study quizzes.",
    icon: BookOpen,
  },
  {
    id: "educator",
    label: "Educator",
    desc: "Author official exam papers, generate multi-set batches, and save/delete papers.",
    icon: GraduationCap,
  },
  {
    id: "admin",
    label: "Admin",
    desc: "Full administrative access to analytics, question bank, and repository papers.",
    icon: ShieldCheck,
  },
];

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
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [showPassword, setShowPassword] = useState(false);

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
      const user = await loginApi({ email, password });
      toast.success(`Welcome back, ${user.name || user.email} (${user.role})!`);
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
      const user = await registerApi({ email, password, name, role });
      toast.success(`Account created as ${user.role}! Welcome, ${user.name || user.email}!`);
      onSuccess(user);
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const selectedRoleInfo = ROLES.find((r) => r.id === role) ?? ROLES[0];

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
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
            <GraduationCap className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold">
            {tab === "login" ? "Sign in to TestForge" : "Create an Account"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {tab === "login"
              ? "Sign in as a Student, Educator, or Admin to access your personalized workspace."
              : "Register as a Student to practice & take tests, or as an Educator to author & manage exams."}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "login" | "register");
            setError(null);
          }}
          className="mt-2 w-full"
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
                <Label className="text-xs font-medium">Select Account Role</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => {
                    const Icon = r.icon;
                    const active = role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className={[
                          "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-all",
                          active
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{r.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  <strong className="text-foreground">{selectedRoleInfo.label}:</strong>{" "}
                  {selectedRoleInfo.desc}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-xs font-medium">
                  Full name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder={role === "student" ? "Ali Khan" : "Prof. Alex Smith"}
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
                    placeholder={role === "student" ? "student@school.edu" : "educator@school.edu"}
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
                    <UserPlus className="mr-2 h-4 w-4" /> Register as {selectedRoleInfo.label}
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

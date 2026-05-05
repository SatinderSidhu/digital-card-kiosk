import { isAdminConfigured, isAuthenticated } from "@/lib/admin-auth";
import { LoginForm } from "@/components/admin/login-form";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAdminConfigured()) {
    return (
      <main className="min-h-dvh w-full flex items-center justify-center px-6 text-center">
        <div className="max-w-md flex flex-col gap-3">
          <h1 className="text-xl font-bold text-shimmer">
            Admin not configured
          </h1>
          <p className="text-sm text-white/65">
            Set <code className="text-white/85">ADMIN_PASSWORD</code> in your
            environment to enable the admin section.
          </p>
        </div>
      </main>
    );
  }

  if (!(await isAuthenticated())) {
    return <LoginForm />;
  }

  return <AdminShell>{children}</AdminShell>;
}

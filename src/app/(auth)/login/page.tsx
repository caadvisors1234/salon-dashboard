import { LoginForm } from "@/components/auth/login-form";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "リンクが無効です。再度お試しください。",
  auth_error: "認証に失敗しました。再度お試しください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <>
      {errorMessage && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
          {errorMessage}
        </div>
      )}
      <LoginForm />
    </>
  );
}

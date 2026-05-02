import { saveSession } from "./session";

type LoginParams = {
  email: string;
  password: string;
  remember: boolean;
};

export async function loginUser(params: LoginParams) {
  const email = params.email.trim();
  const password = params.password.trim();

  if (!email || !password) {
    throw new Error("Введите email и пароль");
  }

  // Временно mock-login.
  // Позже тут будет запрос в auth-site.
  await new Promise((resolve) => setTimeout(resolve, 600));

  const mockSession = {
    userId: `user_${Date.now()}`,
    sessionId: `session_${crypto.randomUUID()}`,
  };

  saveSession(mockSession, params.remember);

  return mockSession;
}
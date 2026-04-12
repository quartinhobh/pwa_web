/**
 * Maps Firebase auth error codes to user-facing messages.
 * Never leaks raw codes. Login errors stay generic to avoid user enumeration.
 */
export function mapAuthError(code: string, mode: 'signin' | 'signup'): string {
  if (mode === 'signin') {
    return 'email ou senha incorretos';
  }
  if (code === 'auth/weak-password') {
    return 'senha precisa ter pelo menos 8 caracteres';
  }
  if (code === 'auth/invalid-email') {
    return 'email inválido';
  }
  return 'não foi possível criar conta com esses dados';
}

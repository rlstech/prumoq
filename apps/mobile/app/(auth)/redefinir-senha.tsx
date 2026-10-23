import { Redirect } from 'expo-router';

// Os links de redefinição enviados pelo Supabase apontavam para esta rota. Com o Clerk, a redefinição é por
// código, na tela de recuperação.
export default function RedefinirSenhaScreen() {
  return <Redirect href="/(auth)/recuperar-senha" />;
}

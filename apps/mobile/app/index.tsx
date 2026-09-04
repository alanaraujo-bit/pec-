import { Redirect } from 'expo-router';

/**
 * Entrada. O porteiro em `_layout` já decide para onde ir; aqui só evitamos
 * uma rota raiz vazia enquanto isso acontece.
 */
export default function Index() {
  return <Redirect href="/(app)" />;
}

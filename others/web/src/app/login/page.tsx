import Login from '@ui/pages/login';
import portal from '../../portal';

export const metadata = { title: 'Sign in' };
export default function LoginPage() {
  return <Login portal={portal} />;
}

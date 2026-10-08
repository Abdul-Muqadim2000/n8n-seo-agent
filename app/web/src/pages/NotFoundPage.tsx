import { useNavigate } from 'react-router';
import { ArrowLeft, Compass } from 'lucide-react';
import { StatusScreen } from '@/components/layout/StatusScreen';
import { Button, ButtonLink } from '@/components/ui/button';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <StatusScreen
      code="404"
      icon={<Compass className="size-5" />}
      title="Page not found"
      actions={
        <>
          <ButtonLink to="/" size="lg">
            Back to home
          </ButtonLink>
          <Button variant="secondary" size="lg" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(-1)}>
            Go back
          </Button>
        </>
      }
    >
      <p>The page you opened does not exist or was moved. Check the address, or start again from the home page.</p>
    </StatusScreen>
  );
}

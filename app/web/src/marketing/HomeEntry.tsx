import MarketingLayout from './MarketingLayout';
import HomePage from './pages/HomePage';

/** The marketing home inside the site layout (loaded by RootRoute for visitors). */
export default function HomeEntry() {
  return (
    <MarketingLayout>
      <HomePage />
    </MarketingLayout>
  );
}

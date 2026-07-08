import HomeClient from './home-client';

// Prevent static prerendering (env vars needed at runtime)
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <HomeClient />;
}
